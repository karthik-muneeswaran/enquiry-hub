import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { WordPressClient, WPPropertyNode } from './wordpress.client';
import { PropertyCacheService } from './property-cache.service';
import { PropertyConnectionArgs } from './dto/property-connection.args';
import { PropertyConnection, PropertyEdge } from './models';

@Injectable()
export class PropertyService {
  private readonly logger = new Logger(PropertyService.name);

  constructor(
    private readonly wordpressClient: WordPressClient,
    private readonly propertyCacheService: PropertyCacheService,
  ) {}

  /**
   * Fetch properties from WordPress via the cache layer.
   * Cache: SWR (stale-while-revalidate) — serves stale, refreshes in background.
   */
  async findProperties(args: PropertyConnectionArgs): Promise<PropertyConnection> {
    try {
      const cacheParams = {
        first: args.first,
        after: args.after,
        search: args.search,
        sortBy: args.sortBy,
        sortDir: args.sortDir,
      };

      return await this.propertyCacheService.getListOrRefresh(cacheParams, async () => {
        const connection = await this.wordpressClient.fetchProperties(
          args.first ?? 20,
          args.after ?? undefined,
        );

        return this.wpConnectionToGraphQL(connection.edges, connection.pageInfo);
      });
    } catch (error) {
      this.logger.error(`Failed to fetch properties: ${(error as Error).message}`);
      return { edges: [], pageInfo: { hasNextPage: false, endCursor: null } };
    }
  }

  /**
   * Fetch a single property by slug from WordPress via cache.
   */
  async findProperty(slug?: string, wpId?: number): Promise<any> {
    if (!slug && wpId === undefined) {
      throw new NotFoundException('Either slug or wpId must be provided');
    }

    try {
      let wpNode: WPPropertyNode | null = null;

      if (slug) {
        wpNode = await this.wordpressClient.fetchPropertyBySlug(slug);
      } else if (wpId !== undefined) {
        wpNode = await this.wordpressClient.fetchPropertyByWpId(wpId);
      }

      if (!wpNode) {
        throw new NotFoundException(
          `Property not found${slug ? ` with slug "${slug}"` : ` with wpId ${wpId}`}`,
        );
      }

      return this.wpNodeToModel(wpNode);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Failed to fetch property: ${(error as Error).message}`);
      throw new NotFoundException('Property not found or service unavailable');
    }
  }

  /**
   * Invalidate all property caches — forces fresh fetch from WordPress on next request.
   */
  async invalidateCache(): Promise<void> {
    this.logger.log('Invalidating all property cache entries');
    await this.propertyCacheService.invalidateAll();
  }

  private wpConnectionToGraphQL(
    edges: Array<{ node: WPPropertyNode; cursor: string }>,
    pageInfo: { hasNextPage: boolean; endCursor: string | null },
  ): PropertyConnection {
    const graphQLEdges: PropertyEdge[] = edges.map((edge) => ({
      node: this.wpNodeToModel(edge.node) as any,
      cursor: edge.cursor,
    }));

    return {
      edges: graphQLEdges,
      pageInfo: {
        hasNextPage: pageInfo.hasNextPage,
        endCursor: pageInfo.endCursor,
      },
    };
  }

  private wpNodeToModel(node: WPPropertyNode): Record<string, unknown> {
    return {
      id: node.id,
      wpId: node.databaseId,
      slug: node.slug,
      title: node.title,
      content: node.content,
      excerpt: node.excerpt,
      featuredImage: node.featuredImage?.node?.sourceUrl ?? null,
      propertyType: null,
      price: null,
      bedrooms: null,
      bathrooms: null,
      area: null,
      location: null,
      status: 'publish',
      cachedAt: new Date(),
      createdAt: new Date(node.date),
      updatedAt: new Date(node.date),
    };
  }
}
