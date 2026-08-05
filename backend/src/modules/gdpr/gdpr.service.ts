import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@database/prisma.service';
import { PaginatedResult } from '@modules/audit/audit.repository';
import { GdprExportQueryDto } from './dto';

export interface GdprRecord {
  type: 'enquiry' | 'audit';
  data: Record<string, unknown>;
}

export interface GdprEraseResponse {
  erasedEnquiries: number;
  erasedWebhookEvents: number;
  erasedAuditRecords: number;
  erasedAt: string;
}

interface CursorPayload {
  id: string;
  createdAt: string;
  source: 'enquiry' | 'audit';
}

@Injectable()
export class GdprService {
  private readonly logger = new Logger(GdprService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Export all data associated with an email address with cursor pagination.
   * Supports filtering by entity type (enquiry, audit, or all).
   */
  async exportData(email: string, query: GdprExportQueryDto): Promise<PaginatedResult<GdprRecord>> {
    const { cursor, limit = 50, entity = 'all' } = query;
    const decodedCursor = cursor ? this.decodeCursor(cursor) : null;

    const records: GdprRecord[] = [];
    let hasMore = false;

    if (entity === 'enquiry' || entity === 'all') {
      const enquiryRecords = await this.fetchEnquiryRecords(
        email,
        limit,
        decodedCursor?.source === 'enquiry' ? decodedCursor : null,
      );
      records.push(...enquiryRecords);
    }

    if (entity === 'audit' || entity === 'all') {
      const remainingLimit = limit - records.length;
      if (remainingLimit > 0) {
        const auditRecords = await this.fetchAuditRecords(
          email,
          remainingLimit,
          decodedCursor?.source === 'audit' ? decodedCursor : null,
        );
        records.push(...auditRecords);
      }
    }

    // If we got more than limit, we have more data
    if (records.length > limit) {
      hasMore = true;
      records.splice(limit);
    }

    const totalCount = await this.countTotalRecords(email, entity);

    const nextCursor =
      hasMore && records.length > 0
        ? this.encodeCursor({
            id: (records[records.length - 1].data as { id: string }).id,
            createdAt: (records[records.length - 1].data as { createdAt: string }).createdAt,
            source: records[records.length - 1].type,
          })
        : null;

    const previousCursor =
      cursor && records.length > 0
        ? this.encodeCursor({
            id: (records[0].data as { id: string }).id,
            createdAt: (records[0].data as { createdAt: string }).createdAt,
            source: records[0].type,
          })
        : null;

    return {
      data: records,
      pagination: {
        nextCursor,
        previousCursor,
        hasMore,
        totalCount,
      },
    };
  }

  /**
   * Erase/anonymize all personal data for a given email using a
   * Serializable isolation transaction to prevent concurrent PII reads.
   */
  async eraseData(email: string): Promise<GdprEraseResponse> {
    return this.prisma.$transaction(
      async (tx) => {
        // 1. Update enquiries: anonymize PII
        const enquiryResult = await tx.enquiry.updateMany({
          where: { email },
          data: {
            name: '[REDACTED]',
            email: 'redacted@example.com',
            phone: null,
            message: '[REDACTED]',
          },
        });

        // 2. Get affected enquiry IDs for webhook event updates
        const affectedEnquiries = await tx.enquiry.findMany({
          where: { email: 'redacted@example.com' },
          select: { id: true },
        });
        const enquiryIds = affectedEnquiries.map((e) => e.id);

        // 3. Update webhook events linked to those enquiries: clear payload
        const webhookResult = await tx.webhookEvent.updateMany({
          where: { enquiryId: { in: enquiryIds } },
          data: { payload: Prisma.JsonNull },
        });

        // 4. Update audit logs for those entities: clear before/after, redact performedBy
        const auditResult = await tx.auditLog.updateMany({
          where: {
            entity: 'Enquiry',
            entityId: { in: enquiryIds },
          },
          data: {
            before: Prisma.JsonNull,
            after: Prisma.JsonNull,
            performedBy: '[REDACTED]',
          },
        });

        // 5. Record the erasure in audit log within the same transaction
        await tx.auditLog.create({
          data: {
            entity: 'GDPR',
            entityId: email,
            action: 'DELETE',
            before: Prisma.JsonNull,
            after: Prisma.JsonNull,
            performedBy: 'system',
            requestId: '',
          },
        });

        const erasedAt = new Date().toISOString();

        this.logger.log(
          `GDPR erasure completed for email=${email}: ${enquiryResult.count} enquiries, ${webhookResult.count} webhook events, ${auditResult.count} audit records`,
        );

        return {
          erasedEnquiries: enquiryResult.count,
          erasedWebhookEvents: webhookResult.count,
          erasedAuditRecords: auditResult.count,
          erasedAt,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 10000,
      },
    );
  }

  private async fetchEnquiryRecords(
    email: string,
    limit: number,
    cursor: CursorPayload | null,
  ): Promise<GdprRecord[]> {
    const where: Prisma.EnquiryWhereInput = { email };

    if (cursor) {
      const cursorDate = new Date(cursor.createdAt);
      where.OR = [
        { createdAt: { lt: cursorDate } },
        { createdAt: cursorDate, id: { lt: cursor.id } },
      ];
    }

    const enquiries = await this.prisma.enquiry.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    return enquiries.map((e) => ({
      type: 'enquiry' as const,
      data: e as unknown as Record<string, unknown>,
    }));
  }

  private async fetchAuditRecords(
    email: string,
    limit: number,
    cursor: CursorPayload | null,
  ): Promise<GdprRecord[]> {
    // Fetch enquiry IDs for this email to find related audit logs
    const enquiries = await this.prisma.enquiry.findMany({
      where: { email },
      select: { id: true },
    });
    const enquiryIds = enquiries.map((e) => e.id);

    if (enquiryIds.length === 0) {
      return [];
    }

    const where: Prisma.AuditLogWhereInput = {
      entity: 'Enquiry',
      entityId: { in: enquiryIds },
    };

    if (cursor) {
      const cursorDate = new Date(cursor.createdAt);
      where.AND = [
        {
          OR: [{ createdAt: { lt: cursorDate } }, { createdAt: cursorDate, id: { lt: cursor.id } }],
        },
      ];
    }

    const auditLogs = await this.prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    return auditLogs.map((a) => ({
      type: 'audit' as const,
      data: a as unknown as Record<string, unknown>,
    }));
  }

  private async countTotalRecords(
    email: string,
    entity: 'enquiry' | 'audit' | 'all',
  ): Promise<number> {
    let total = 0;

    if (entity === 'enquiry' || entity === 'all') {
      total += await this.prisma.enquiry.count({ where: { email } });
    }

    if (entity === 'audit' || entity === 'all') {
      const enquiries = await this.prisma.enquiry.findMany({
        where: { email },
        select: { id: true },
      });
      const enquiryIds = enquiries.map((e) => e.id);
      if (enquiryIds.length > 0) {
        total += await this.prisma.auditLog.count({
          where: { entity: 'Enquiry', entityId: { in: enquiryIds } },
        });
      }
    }

    return total;
  }

  private encodeCursor(payload: CursorPayload): string {
    return Buffer.from(JSON.stringify(payload)).toString('base64');
  }

  private decodeCursor(cursor: string): CursorPayload | null {
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
      const parsed = JSON.parse(decoded) as CursorPayload;
      if (parsed.id && parsed.createdAt && parsed.source) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }
}
