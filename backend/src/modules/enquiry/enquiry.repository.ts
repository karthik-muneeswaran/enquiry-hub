import { Injectable } from '@nestjs/common';
import { Prisma, Enquiry } from '@prisma/client';
import { PrismaService } from '@database/prisma.service';
import { ListEnquiriesDto } from './dto';

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
export class EnquiryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.EnquiryCreateInput): Promise<Enquiry> {
    return this.prisma.enquiry.create({ data });
  }

  async findById(id: string): Promise<Enquiry | null> {
    return this.prisma.enquiry.findUnique({ where: { id } });
  }

  async updateStatus(id: string, status: string): Promise<Enquiry> {
    return this.prisma.enquiry.update({
      where: { id },
      data: { status: status as any },
    });
  }

  async findDuplicate(
    email: string,
    propertyId: string,
    withinMinutes: number,
  ): Promise<Enquiry | null> {
    const threshold = new Date(Date.now() - withinMinutes * 60 * 1000);

    return this.prisma.enquiry.findFirst({
      where: {
        email,
        propertyId,
        createdAt: { gt: threshold },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findWithCursor(params: ListEnquiriesDto): Promise<PaginatedResult<Enquiry>> {
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
    const conditions: Prisma.EnquiryWhereInput[] = [];
    if (Object.keys(filterConditions).length > 0) {
      conditions.push(filterConditions);
    }
    if (cursorCondition) {
      conditions.push(cursorCondition);
    }

    const where: Prisma.EnquiryWhereInput =
      conditions.length > 0 ? { AND: conditions } : {};

    // Get total count using only filter conditions (no cursor)
    const countWhere =
      Object.keys(filterConditions).length > 0 ? filterConditions : {};
    const totalCount = await this.prisma.enquiry.count({ where: countWhere });

    // Fetch limit + 1 to detect hasMore
    const records = await this.prisma.enquiry.findMany({
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
    params: ListEnquiriesDto,
  ): Prisma.EnquiryWhereInput {
    const { search, dateFrom, dateTo, status } = params;
    const conditions: Prisma.EnquiryWhereInput[] = [];

    if (status) {
      conditions.push({ status });
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
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { message: { contains: search, mode: 'insensitive' } },
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
  ): Prisma.EnquiryWhereInput | null {
    if (!cursor) {
      return null;
    }

    const decoded = this.decodeCursor(cursor);
    if (!decoded) {
      return null;
    }

    const cursorDate = new Date(decoded.createdAt);

    // For cursor pagination with composite tiebreaker (sortField, id):
    // DESC: WHERE (sortField < cursorValue) OR (sortField = cursorValue AND id < cursorId)
    // ASC:  WHERE (sortField > cursorValue) OR (sortField = cursorValue AND id > cursorId)
    const operator = sortDir === 'desc' ? 'lt' : 'gt';

    if (sortBy === 'createdAt') {
      return {
        OR: [
          { createdAt: { [operator]: cursorDate } },
          { createdAt: cursorDate, id: { [operator]: decoded.id } },
        ],
      };
    }

    // For non-createdAt sort fields, we still use createdAt from cursor
    // as the tiebreaker reference since the cursor encodes id + createdAt
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
