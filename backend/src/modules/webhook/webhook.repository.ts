import { Injectable } from '@nestjs/common';
import { Prisma, WebhookEvent, WebhookStatus } from '@prisma/client';
import { PrismaService } from '@database/prisma.service';
import { ListWebhookEventsDto } from './dto';

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

@Injectable()
export class WebhookRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.WebhookEventCreateInput): Promise<WebhookEvent> {
    return this.prisma.webhookEvent.create({ data });
  }

  async findByEventId(eventId: string): Promise<WebhookEvent | null> {
    return this.prisma.webhookEvent.findUnique({ where: { eventId } });
  }

  async findById(id: string): Promise<WebhookEvent | null> {
    return this.prisma.webhookEvent.findUnique({ where: { id } });
  }

  async updateStatus(
    id: string,
    status: WebhookStatus,
    errorMessage?: string,
  ): Promise<WebhookEvent> {
    const data: Prisma.WebhookEventUpdateInput = { status };

    if (status === WebhookStatus.PROCESSED) {
      data.processedAt = new Date();
    }

    if (errorMessage !== undefined) {
      data.error = errorMessage;
    }

    return this.prisma.webhookEvent.update({
      where: { id },
      data,
    });
  }

  async findWithCursor(
    params: ListWebhookEventsDto,
  ): Promise<PaginatedResult<WebhookEvent>> {
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
    const conditions: Prisma.WebhookEventWhereInput[] = [];
    if (Object.keys(filterConditions).length > 0) {
      conditions.push(filterConditions);
    }
    if (cursorCondition) {
      conditions.push(cursorCondition);
    }

    const where: Prisma.WebhookEventWhereInput =
      conditions.length > 0 ? { AND: conditions } : {};

    // Get total count using only filter conditions (no cursor)
    const countWhere =
      Object.keys(filterConditions).length > 0 ? filterConditions : {};
    const totalCount = await this.prisma.webhookEvent.count({
      where: countWhere,
    });

    // Fetch limit + 1 to detect hasMore
    const records = await this.prisma.webhookEvent.findMany({
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
    params: ListWebhookEventsDto,
  ): Prisma.WebhookEventWhereInput {
    const { search, dateFrom, dateTo, status, type, source } = params;
    const conditions: Prisma.WebhookEventWhereInput[] = [];

    if (status) {
      conditions.push({ status });
    }

    if (type) {
      conditions.push({ type });
    }

    if (source) {
      conditions.push({ source });
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
          { eventId: { contains: search, mode: 'insensitive' } },
          { type: { contains: search, mode: 'insensitive' } },
          { source: { contains: search, mode: 'insensitive' } },
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
  ): Prisma.WebhookEventWhereInput | null {
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
