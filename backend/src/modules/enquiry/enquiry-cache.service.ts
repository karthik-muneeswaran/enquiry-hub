import { Injectable, Logger } from '@nestjs/common';
import { Enquiry } from '@prisma/client';
import * as crypto from 'crypto';
import { CacheService, CacheOptions } from '@cache/cache.service';
import { ListEnquiriesDto } from './dto/list-enquiries.dto';
import { PaginatedResult } from './enquiry.repository';

/** Cache TTL configuration for enquiry data */
const ENQUIRY_BY_ID_OPTIONS: CacheOptions = {
  staleTtl: 5 * 60,   // 5 minutes before considered stale
  expireTtl: 15 * 60, // 15 minutes hard expiry
};

const ENQUIRY_LIST_OPTIONS: CacheOptions = {
  staleTtl: 30,        // 30 seconds before list is stale
  expireTtl: 2 * 60,  // 2 minutes hard expiry (lists change more often)
};

const ENQUIRY_DUP_TTL_SECONDS = 10 * 60; // 10 minutes (matches duplicate window)

/** Key prefixes */
const KEY_PREFIX = 'enquiry';
const KEY_BY_ID = `${KEY_PREFIX}:id`;
const KEY_LIST = `${KEY_PREFIX}:list`;
const KEY_DUP = `${KEY_PREFIX}:dup`;

@Injectable()
export class EnquiryCacheService {
  private readonly logger = new Logger(EnquiryCacheService.name);

  constructor(private readonly cacheService: CacheService) {}

  // ─── READ: Get by ID (with mutex stampede protection) ────────────────

  /**
   * Get a single enquiry by ID from cache, or fetch from DB if miss/stale.
   * Uses mutex lock so only ONE request hits DB on concurrent misses.
   */
  async getById(
    id: string,
    fetchFn: () => Promise<Enquiry | null>,
  ): Promise<Enquiry | null> {
    const key = `${KEY_BY_ID}:${id}`;

    return this.cacheService.getOrRefreshWithLock<Enquiry | null>(
      key,
      fetchFn,
      { ...ENQUIRY_BY_ID_OPTIONS, lockTtlMs: 3000, waitTimeoutMs: 2000 },
    );
  }

  // ─── READ: Get list (with mutex stampede protection) ─────────────────

  /**
   * Get paginated list from cache, or fetch from DB if miss/stale.
   * Cache key is derived from hashed query params.
   */
  async getList(
    params: ListEnquiriesDto,
    fetchFn: () => Promise<PaginatedResult<Enquiry>>,
  ): Promise<PaginatedResult<Enquiry>> {
    const key = this.listKey(params);

    return this.cacheService.getOrRefreshWithLock<PaginatedResult<Enquiry>>(
      key,
      fetchFn,
      { ...ENQUIRY_LIST_OPTIONS, lockTtlMs: 5000, waitTimeoutMs: 3000 },
    );
  }

  // ─── READ: Duplicate check ──────────────────────────────────────────

  /**
   * Fast duplicate check via Redis before hitting DB.
   * Returns true if a recent enquiry exists for this email+propertyId.
   */
  async isDuplicate(email: string, propertyId: string): Promise<boolean | null> {
    const key = this.dupKey(email, propertyId);
    const result = await this.cacheService.get<string>(key);
    // null means cache miss (need to check DB), "1" means duplicate exists
    return result === null ? null : true;
  }

  /**
   * Mark that an enquiry exists for this email+propertyId (set on create).
   */
  async setDuplicateMarker(email: string, propertyId: string): Promise<void> {
    const key = this.dupKey(email, propertyId);
    await this.cacheService.set(key, '1', {
      staleTtl: ENQUIRY_DUP_TTL_SECONDS,
      expireTtl: ENQUIRY_DUP_TTL_SECONDS,
    });
  }

  // ─── WRITE: Invalidation (mark stale, don't delete) ─────────────────

  /**
   * Called after a new enquiry is created.
   * - Caches the new enquiry by ID (write-through)
   * - Marks all list caches as stale (not deleted — SWR serves stale + refreshes)
   * - Sets duplicate marker
   */
  async onEnquiryCreated(enquiry: Enquiry): Promise<void> {
    // Write-through: cache the new record immediately
    await this.cacheService.set(
      `${KEY_BY_ID}:${enquiry.id}`,
      enquiry,
      ENQUIRY_BY_ID_OPTIONS,
    );

    // Mark all list caches stale (they'll serve stale + refresh in background)
    await this.cacheService.markStaleByPattern(`${KEY_LIST}:*`);

    // Set duplicate marker
    await this.setDuplicateMarker(enquiry.email, enquiry.propertyId);

    this.logger.debug(`Cache updated for new enquiry ${enquiry.id}`);
  }

  /**
   * Called after an enquiry is updated.
   * - Updates the cached record by ID
   * - Marks list caches stale
   */
  async onEnquiryUpdated(enquiry: Enquiry): Promise<void> {
    await this.cacheService.set(
      `${KEY_BY_ID}:${enquiry.id}`,
      enquiry,
      ENQUIRY_BY_ID_OPTIONS,
    );

    await this.cacheService.markStaleByPattern(`${KEY_LIST}:*`);

    this.logger.debug(`Cache updated for enquiry ${enquiry.id}`);
  }

  /**
   * Called after an enquiry is deleted.
   * - Removes the cached record
   * - Marks list caches stale
   */
  async onEnquiryDeleted(id: string): Promise<void> {
    await this.cacheService.delete(`${KEY_BY_ID}:${id}`);
    await this.cacheService.markStaleByPattern(`${KEY_LIST}:*`);

    this.logger.debug(`Cache invalidated for deleted enquiry ${id}`);
  }

  // ─── Key generation ─────────────────────────────────────────────────

  private listKey(params: ListEnquiriesDto): string {
    // Create a deterministic hash of all query params
    const normalized = JSON.stringify({
      cursor: params.cursor || '',
      limit: params.limit || 20,
      search: params.search || '',
      dateFrom: params.dateFrom || '',
      dateTo: params.dateTo || '',
      sortDir: params.sortDir || 'desc',
      sortBy: params.sortBy || 'createdAt',
      status: params.status || '',
    });

    const hash = crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
    return `${KEY_LIST}:${hash}`;
  }

  private dupKey(email: string, propertyId: string): string {
    const normalized = `${email.toLowerCase()}:${propertyId}`;
    return `${KEY_DUP}:${normalized}`;
  }
}
