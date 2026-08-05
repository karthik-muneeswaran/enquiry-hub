import { Injectable, Logger } from '@nestjs/common';
import { Property } from '@prisma/client';
import { CacheService, CacheOptions } from '@cache/cache.service';
import { PropertyConnection } from './models';
import * as crypto from 'crypto';

/** Default cache TTL options for properties */
const PROPERTY_CACHE_OPTIONS: CacheOptions = {
  staleTtl: 5 * 60, // 5 minutes before stale
  expireTtl: 15 * 60, // 15 minutes before expired
};

/**
 * Property-specific caching with standardized key patterns.
 *
 * Key patterns:
 *   - property:slug:{slug}
 *   - property:wpId:{wpId}
 *   - properties:list:{hash}
 */
@Injectable()
export class PropertyCacheService {
  private readonly logger = new Logger(PropertyCacheService.name);

  constructor(private readonly cacheService: CacheService) {}

  /**
   * Get or refresh a property by slug with SWR caching.
   */
  async getBySlugOrRefresh(
    slug: string,
    refreshFn: () => Promise<Property | null>,
  ): Promise<Property | null> {
    const key = this.slugKey(slug);
    return this.cacheService.getOrRefresh<Property | null>(key, refreshFn, PROPERTY_CACHE_OPTIONS);
  }

  /**
   * Get or refresh a property by WordPress ID with SWR caching.
   */
  async getByWpIdOrRefresh(
    wpId: number,
    refreshFn: () => Promise<Property | null>,
  ): Promise<Property | null> {
    const key = this.wpIdKey(wpId);
    return this.cacheService.getOrRefresh<Property | null>(key, refreshFn, PROPERTY_CACHE_OPTIONS);
  }

  /**
   * Get or refresh a property list with SWR caching.
   */
  async getListOrRefresh(
    params: Record<string, unknown>,
    refreshFn: () => Promise<PropertyConnection>,
  ): Promise<PropertyConnection> {
    const key = this.listKey(params);
    return this.cacheService.getOrRefresh<PropertyConnection>(
      key,
      refreshFn,
      PROPERTY_CACHE_OPTIONS,
    );
  }

  /**
   * Cache a property by slug.
   */
  async setBySlug(slug: string, property: Property): Promise<void> {
    await this.cacheService.set(this.slugKey(slug), property, PROPERTY_CACHE_OPTIONS);
  }

  /**
   * Cache a property by WordPress ID.
   */
  async setByWpId(wpId: number, property: Property): Promise<void> {
    await this.cacheService.set(this.wpIdKey(wpId), property, PROPERTY_CACHE_OPTIONS);
  }

  /**
   * Invalidate all property-related cache entries.
   */
  async invalidateAll(): Promise<void> {
    this.logger.log('Invalidating all property cache entries');
    await this.cacheService.invalidatePattern('property:*');
    await this.cacheService.invalidatePattern('properties:*');
  }

  /**
   * Invalidate cache for a specific property.
   */
  async invalidateProperty(slug: string, wpId: number): Promise<void> {
    await this.cacheService.delete(this.slugKey(slug));
    await this.cacheService.delete(this.wpIdKey(wpId));
  }

  private slugKey(slug: string): string {
    return `property:slug:${slug}`;
  }

  private wpIdKey(wpId: number): string {
    return `property:wpId:${wpId}`;
  }

  private listKey(params: Record<string, unknown>): string {
    const hash = crypto
      .createHash('md5')
      .update(JSON.stringify(params))
      .digest('hex')
      .substring(0, 12);
    return `properties:list:${hash}`;
  }
}
