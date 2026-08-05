import {
  Injectable,
  Inject,
  Optional,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Prisma, Enquiry, EnquiryStatus } from '@prisma/client';
import Redis from 'ioredis';
import { PrismaService } from '@database/prisma.service';
import { REDIS_CLIENT } from '@cache/cache.service';
import { ApiErrorCode } from '@common/response';
import { NotificationProducer } from '@queue/index';
import { MetricsService } from '@observability/metrics.service';
import { EnquiryRepository, PaginatedResult } from './enquiry.repository';
import { EnquiryCacheService } from './enquiry-cache.service';
import { CreateEnquiryDto } from './dto/create-enquiry.dto';
import { ListEnquiriesDto } from './dto/list-enquiries.dto';
import { IAuditService, AUDIT_SERVICE } from './interfaces';

@Injectable()
export class EnquiryService {
  private readonly logger = new Logger(EnquiryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly enquiryRepository: EnquiryRepository,
    private readonly enquiryCacheService: EnquiryCacheService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly metricsService: MetricsService,
    @Optional() private readonly notificationProducer?: NotificationProducer,
    @Optional()
    @Inject(AUDIT_SERVICE)
    private readonly auditService?: IAuditService,
  ) {}

  /**
   * Create a new enquiry with idempotency, duplicate detection,
   * and transactional audit logging.
   */
  async create(dto: CreateEnquiryDto, idempotencyKey?: string): Promise<Enquiry> {
    // 1. Check idempotency key in Redis
    if (idempotencyKey) {
      const cached = await this.getIdempotencyResponse(idempotencyKey);
      if (cached) {
        this.logger.log(`Idempotent duplicate detected for key: ${idempotencyKey}`);
        return cached;
      }
    }

    // 2. Check for duplicate enquiry (Redis-first, then DB fallback)
    const cachedDup = await this.enquiryCacheService.isDuplicate(dto.email, dto.propertyId);

    if (cachedDup === true) {
      // Redis confirmed duplicate exists
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: 'A duplicate enquiry for this property was submitted within the last 10 minutes',
        code: ApiErrorCode.DUPLICATE_ENQUIRY,
      });
    }

    // Cache miss — check DB as fallback
    if (cachedDup === null) {
      const duplicate = await this.enquiryRepository.findDuplicate(dto.email, dto.propertyId, 10);

      if (duplicate) {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          message: 'A duplicate enquiry for this property was submitted within the last 10 minutes',
          code: ApiErrorCode.DUPLICATE_ENQUIRY,
        });
      }
    }

    // 3. Execute transactional creation (enquiry + audit log)
    const enquiry = await this.prisma.$transaction(
      async (tx) => {
        const created = await tx.enquiry.create({
          data: {
            name: dto.name,
            email: dto.email,
            phone: dto.phone || null,
            propertyId: dto.propertyId,
            propertyTitle: dto.propertyTitle,
            message: dto.message,
            source: dto.source,
            consentGiven: dto.consentGiven,
            status: 'PENDING',
            idempotencyKey: idempotencyKey || null,
          },
        });

        // Record audit log within the same transaction
        await tx.auditLog.create({
          data: {
            entity: 'Enquiry',
            entityId: created.id,
            action: 'CREATE',
            before: Prisma.JsonNull,
            after: created as unknown as Prisma.InputJsonValue,
            performedBy: 'system',
            requestId: idempotencyKey || created.id,
          },
        });

        return created;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 10000,
      },
    );

    // 4. Record business metric
    this.metricsService.incrementCounter('enquiry_created_total', {
      source: dto.source || 'unknown',
    });

    // 5. Store idempotency key in Redis with 24h TTL
    if (idempotencyKey) {
      await this.storeIdempotencyResponse(idempotencyKey, enquiry);
    }

    // 6. Update cache (write-through for record, mark lists stale, set dup marker)
    await this.enquiryCacheService.onEnquiryCreated(enquiry);

    // 7. Enqueue notifications (don't fail the request if queue is down)
    await this.enqueueNotifications(enquiry);

    return enquiry;
  }

  /**
   * Find an enquiry by ID. Uses Redis cache with mutex stampede protection.
   * Throws NotFoundException if not found.
   */
  async findById(id: string): Promise<Enquiry> {
    const enquiry = await this.enquiryCacheService.getById(id, () =>
      this.enquiryRepository.findById(id),
    );

    if (!enquiry) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'Not Found',
        message: `Enquiry with ID "${id}" not found`,
        code: ApiErrorCode.NOT_FOUND,
      });
    }

    return enquiry;
  }

  /**
   * Find all enquiries with cursor pagination, filtering, and sorting.
   * Uses Redis cache with SWR + mutex stampede protection.
   */
  async findAll(params: ListEnquiriesDto): Promise<PaginatedResult<Enquiry>> {
    return this.enquiryCacheService.getList(params, () =>
      this.enquiryRepository.findWithCursor(params),
    );
  }

  /**
   * Update the status of an enquiry.
   * Records an audit log and updates cache.
   */
  async updateStatus(id: string, status: EnquiryStatus, performedBy: string): Promise<Enquiry> {
    // Verify the enquiry exists
    const existing = await this.enquiryRepository.findById(id);
    if (!existing) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'Not Found',
        message: `Enquiry with ID "${id}" not found`,
        code: ApiErrorCode.NOT_FOUND,
      });
    }

    const previousStatus = existing.status;

    // Update status in DB with audit log in a transaction
    const updated = await this.prisma.$transaction(async (tx) => {
      const enquiry = await tx.enquiry.update({
        where: { id },
        data: { status },
      });

      await tx.auditLog.create({
        data: {
          entity: 'Enquiry',
          entityId: id,
          action: 'UPDATE',
          before: {
            status: previousStatus,
            name: existing.name,
            propertyTitle: existing.propertyTitle,
          } as unknown as Prisma.InputJsonValue,
          after: {
            status,
            name: existing.name,
            propertyTitle: existing.propertyTitle,
          } as unknown as Prisma.InputJsonValue,
          performedBy,
          requestId: id,
        },
      });

      return enquiry;
    });

    // Update cache
    await this.enquiryCacheService.onEnquiryUpdated(updated);

    this.logger.log(
      `Enquiry ${id} status updated: ${previousStatus} → ${status} by ${performedBy}`,
    );

    return updated;
  }

  /**
   * Check Redis for an existing idempotency response.
   */
  private async getIdempotencyResponse(key: string): Promise<Enquiry | null> {
    try {
      const cached = await this.redis.get(`idempotency:${key}`);
      if (cached) {
        return JSON.parse(cached) as Enquiry;
      }
      return null;
    } catch (error) {
      this.logger.warn(`Failed to check idempotency key in Redis: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Store an idempotency response in Redis with 24-hour TTL.
   */
  private async storeIdempotencyResponse(key: string, enquiry: Enquiry): Promise<void> {
    try {
      await this.redis.set(
        `idempotency:${key}`,
        JSON.stringify(enquiry),
        'EX',
        86400, // 24 hours
      );
    } catch (error) {
      this.logger.warn(`Failed to store idempotency key in Redis: ${(error as Error).message}`);
    }
  }

  /**
   * Enqueue email notifications. Failures are logged but don't fail the request.
   */
  private async enqueueNotifications(enquiry: Enquiry): Promise<void> {
    if (!this.notificationProducer) {
      this.logger.debug('NotificationProducer not available, skipping notification enqueue');
      return;
    }

    try {
      await Promise.all([
        this.notificationProducer.enqueueConfirmationEmail(enquiry),
        this.notificationProducer.enqueueAdminNotification(enquiry),
      ]);
    } catch (error) {
      this.logger.warn(
        `Failed to enqueue notifications for enquiry ${enquiry.id}: ${(error as Error).message}`,
      );
    }
  }
}
