import { Injectable } from '@nestjs/common';
import { Prisma, AuditLog } from '@prisma/client';
import { PrismaService } from '@database/prisma.service';
import { ListAuditLogsDto } from './dto';

export interface CursorPayload {
  id: string;
  createdAt: string;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    nextCursor: string | null;
    previousCursor: string | null;
    hasMore: boolean;
    totalCount: number;
  };
}

/**
 * Represents a Prisma transaction client that can be used
 * for transactional audit logging.
 */
export type PrismaTransaction = Omit<
  PrismaService,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

@Injectable()
export class AuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create an audit log record. If tx is provided, uses the
   * transaction client to participate in the caller's transaction.
   */
  async create(
    data: Prisma.AuditLogCreateInput,
    tx?: PrismaTransaction,
  ): Promise<AuditLog> {
    const client = tx ?? this.prisma;
    return client.auditLog.create({ data });
  }

  /**
   * Find audit logs with cursor pagination, filtering, and sorting.
   * Search applies ILIKE on entity, entityId, performedBy, and requestId.
   */
  async findWithCursor(
    params: ListAuditLogsDto,
  ): Promise<PaginatedResult<AuditLog>> {
    const {
      cursor,
      limit = 20,
      sortDir = 'desc',
      sortBy = 'createdAt',
    } = params;

    // Build filter conditions (without cursor)
    const filterConditions = this.buildFilterConditions(params);

    // Build cursor condition
    const cursorCondition = this.buildCursorCondition(cursor, sortBy, sortDir);

    // Combine all conditions with AND
    const conditions: Prisma.AuditLogWhereInput[] = [];
    if (Object.keys(filterConditions).length > 0) {
      conditions.push(filterConditions);
    }
    if (cursorCondition) {
      conditions.push(cursorCondition);
    }

    const where: Prisma.AuditLogWhereInput =
      conditions.length > 0 ? { AND: conditions } : {};

    // Get total count using only filter conditions (no cursor)
    const countWhere =
      Object.keys(filterConditions).length > 0 ? filterConditions : {};
    const totalCount = await this.prisma.auditLog.count({ where: countWhere });

    // Fetch limit + 1 to detect hasMore
    const records = await this.prisma.auditLog.findMany({
      where,
      orderBy: [{ [sortBy]: sortDir }, { id: sortDir }],
      take: limit + 1,
    });

    const hasMore = records.length > limit;
    const data = hasMore ? records.slice(0, limit) : records;

    const nextCursor =
      hasMore && data.length > 0
        ? this.encodeCursor({
            id: data[data.length - 1].id,
            createdAt: data[data.length - 1].createdAt.toISOString(),
          })
        : null;

    const previousCursor =
      cursor && data.length > 0
        ? this.encodeCursor({
            id: data[0].id,
            createdAt: data[0].createdAt.toISOString(),
          })
        : null;

    return {
      data,
      pagination: {
        nextCursor,
        previousCursor,
        hasMore,
        totalCount,
      },
    };
  }

  private buildFilterConditions(
    params: ListAuditLogsDto,
  ): Prisma.AuditLogWhereInput {
    const { search, dateFrom, dateTo, entity, entityId, action, performedBy } =
      params;
    const conditions: Prisma.AuditLogWhereInput[] = [];

    if (entity) {
      conditions.push({ entity });
    }

    if (entityId) {
      conditions.push({ entityId });
    }

    if (action) {
      conditions.push({ action });
    }

    if (performedBy) {
      conditions.push({ performedBy });
    }

    if (dateFrom) {
      conditions.push({ createdAt: { gte: new Date(dateFrom) } });
    }

    if (dateTo) {
      conditions.push({ createdAt: { lte: new Date(dateTo) } });
    }

    if (search) {
      conditions.push({
        OR: [
          { entity: { contains: search, mode: 'insensitive' } },
          { entityId: { contains: search, mode: 'insensitive' } },
          { performedBy: { contains: search, mode: 'insensitive' } },
          { requestId: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    if (conditions.length === 0) {
      return {};
    }

    if (conditions.length === 1) {
      return conditions[0];
    }

    return { AND: conditions };
  }

  private buildCursorCondition(
    cursor: string | undefined,
    sortBy: string,
    sortDir: 'asc' | 'desc',
  ): Prisma.AuditLogWhereInput | null {
    if (!cursor) {
      return null;
    }

    const decoded = this.decodeCursor(cursor);
    if (!decoded) {
      return null;
    }

    const cursorDate = new Date(decoded.createdAt);
    const operator = sortDir === 'desc' ? 'lt' : 'gt';

    // For cursor pagination with composite tiebreaker (sortField, id):
    // DESC: WHERE (sortField < cursorValue) OR (sortField = cursorValue AND id < cursorId)
    // ASC:  WHERE (sortField > cursorValue) OR (sortField = cursorValue AND id > cursorId)
    return {
      OR: [
        { createdAt: { [operator]: cursorDate } },
        { createdAt: cursorDate, id: { [operator]: decoded.id } },
      ],
    };
  }

  encodeCursor(payload: CursorPayload): string {
    return Buffer.from(JSON.stringify(payload)).toString('base64');
  }

  decodeCursor(cursor: string): CursorPayload | null {
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
      const parsed = JSON.parse(decoded) as CursorPayload;
      if (parsed.id && parsed.createdAt) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }
}
