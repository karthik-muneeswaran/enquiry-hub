import { Injectable } from '@nestjs/common';
import { Prisma, Property } from '@prisma/client';
import { PrismaService } from '@database/prisma.service';
import { PropertySortField, SortDirection } from './dto/property-connection.args';

export interface FindWithCursorParams {
  first: number;
  after?: string;
  search?: string;
  sortBy?: PropertySortField;
  sortDir?: SortDirection;
}

export interface CursorResult<T> {
  items: T[];
  hasNextPage: boolean;
  endCursor: string | null;
}

@Injectable()
export class PropertyRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find properties with cursor-based pagination, search, and sort.
   */
  async findWithCursor(params: FindWithCursorParams): Promise<CursorResult<Property>> {
    const {
      first,
      after,
      search,
      sortBy = PropertySortField.CACHED_AT,
      sortDir = SortDirection.DESC,
    } = params;

    const where: Prisma.PropertyWhereInput = {};

    // Search (ILIKE on title, content, excerpt)
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
        { excerpt: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Build orderBy based on sortBy field
    const orderByField = this.mapSortField(sortBy);
    const direction = sortDir === SortDirection.ASC ? 'asc' : 'desc';
    const orderBy: Prisma.PropertyOrderByWithRelationInput = { [orderByField]: direction };

    // Decode cursor
    let cursor: Prisma.PropertyWhereUniqueInput | undefined;
    if (after) {
      const decodedCursor = this.decodeCursor(after);
      if (decodedCursor) {
        cursor = { id: decodedCursor.id };
      }
    }

    // Fetch one extra to determine hasNextPage
    const items = await this.prisma.property.findMany({
      where,
      orderBy: [orderBy, { id: 'asc' }], // secondary sort for stability
      take: first + 1,
      ...(cursor ? { cursor, skip: 1 } : {}),
    });

    const hasNextPage = items.length > first;
    const resultItems = hasNextPage ? items.slice(0, first) : items;

    const endCursor =
      resultItems.length > 0
        ? this.encodeCursor(resultItems[resultItems.length - 1])
        : null;

    return { items: resultItems, hasNextPage, endCursor };
  }

  /**
   * Find a property by slug.
   */
  async findBySlug(slug: string): Promise<Property | null> {
    return this.prisma.property.findUnique({ where: { slug } });
  }

  /**
   * Find a property by WordPress ID.
   */
  async findByWpId(wpId: number): Promise<Property | null> {
    return this.prisma.property.findUnique({ where: { wpId } });
  }

  /**
   * Find properties by IDs (batch load for DataLoader).
   */
  async findByIds(ids: string[]): Promise<Property[]> {
    return this.prisma.property.findMany({
      where: { id: { in: ids } },
    });
  }

  /**
   * Upsert a batch of properties.
   */
  async upsertBatch(
    properties: Array<{
      wpId: number;
      slug: string;
      title: string;
      content?: string | null;
      excerpt?: string | null;
      featuredImage?: string | null;
      propertyType?: string | null;
      price?: number | null;
      bedrooms?: number | null;
      bathrooms?: number | null;
      area?: number | null;
      location?: string | null;
      status?: string;
    }>,
  ): Promise<void> {
    await this.prisma.$transaction(
      async (tx) => {
        for (const prop of properties) {
          await tx.property.upsert({
            where: { wpId: prop.wpId },
            create: { ...prop, cachedAt: new Date() },
            update: { ...prop, cachedAt: new Date() },
          });
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  private mapSortField(sortBy: PropertySortField): string {
    switch (sortBy) {
      case PropertySortField.TITLE:
        return 'title';
      case PropertySortField.CREATED_AT:
        return 'createdAt';
      case PropertySortField.CACHED_AT:
        return 'cachedAt';
      default:
        return 'cachedAt';
    }
  }

  private encodeCursor(property: Property): string {
    return Buffer.from(
      JSON.stringify({ id: property.id, createdAt: property.createdAt.toISOString() }),
    ).toString('base64');
  }

  private decodeCursor(cursor: string): { id: string; createdAt: string } | null {
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
      const parsed = JSON.parse(decoded);
      if (parsed && typeof parsed.id === 'string') {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }
}
