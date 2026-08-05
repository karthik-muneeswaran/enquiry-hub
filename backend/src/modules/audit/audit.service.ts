import { Injectable, Logger } from '@nestjs/common';
import { Prisma, AuditLog } from '@prisma/client';
import { PrismaService } from '@database/prisma.service';
import { IAuditService } from '@modules/enquiry/interfaces';
import { AuditRepository, PaginatedResult, PrismaTransaction } from './audit.repository';
import { ListAuditLogsDto } from './dto';

export interface LogChangeParams {
  entity: string;
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  performedBy?: string;
  requestId?: string;
}

@Injectable()
export class AuditService implements IAuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditRepository: AuditRepository,
  ) {}

  /**
   * Log a data mutation to the audit log.
   * If tx is provided, the audit record is created within the caller's transaction.
   * If no tx, a standalone write is performed.
   */
  async logChange(params: LogChangeParams & { tx?: PrismaTransaction }): Promise<void> {
    const {
      entity,
      entityId,
      action,
      before = null,
      after = null,
      performedBy = 'system',
      requestId = '',
      tx,
    } = params;

    const data: Prisma.AuditLogCreateInput = {
      entity,
      entityId,
      action,
      before: (before as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      after: (after as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      performedBy,
      requestId,
    };

    try {
      await this.auditRepository.create(data, tx);
    } catch (error) {
      this.logger.error(
        `Failed to create audit log for ${entity}:${entityId} (${action}): ${(error as Error).message}`,
      );
      // Re-throw if within a transaction so the caller can handle rollback
      if (tx) {
        throw error;
      }
    }
  }

  /**
   * Find all audit logs with cursor pagination, filtering, and sorting.
   */
  async findAll(params: ListAuditLogsDto): Promise<PaginatedResult<AuditLog>> {
    return this.auditRepository.findWithCursor(params);
  }
}
