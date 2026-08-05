import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import CircuitBreaker = require('opossum');
import axios, { AxiosInstance } from 'axios';
import { AppConfigService } from '@config/config.service';
import { CacheService } from '@cache/cache.service';
import { createCircuitBreaker } from '@common/circuit-breaker';

export interface WPPropertyNode {
  id: string;
  databaseId: number;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  featuredImage?: {
    node?: {
      sourceUrl: string;
    };
  };
  date: string;
}

export interface WPPropertyEdge {
  node: WPPropertyNode;
  cursor: string;
}

export interface WPPropertyConnection {
  edges: WPPropertyEdge[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor: string | null;
  };
}

export interface WPGraphQLResponse<T> {
  data: T;
  errors?: Array<{ message: string }>;
}

/** Reset timeout for the WordPress circuit breaker (30s) */
const WP_RESET_TIMEOUT_MS = 30000;

@Injectable()
export class WordPressClient {
  private readonly logger = new Logger(WordPressClient.name);
  private readonly httpClient: AxiosInstance;
  private readonly breaker: CircuitBreaker<[string, Record<string, unknown>?], unknown>;

  constructor(
    private readonly configService: AppConfigService,
    private readonly cacheService: CacheService,
  ) {
    this.httpClient = axios.create({
      baseURL: this.configService.wordpressGraphqlUrl,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 5000,
    });

    // Create circuit breaker wrapping the raw GraphQL fetch
    this.breaker = createCircuitBreaker('wordpress', this.executeGraphQL.bind(this), {
      timeout: 5000,
      errorThresholdPercentage: 50,
      resetTimeout: WP_RESET_TIMEOUT_MS,
      volumeThreshold: 5,
    });
  }

  /**
   * Fetch a paginated list of properties from WPGraphQL.
   */
  async fetchProperties(first: number = 20, after?: string): Promise<WPPropertyConnection> {
    const cacheKey = `wp:properties:${first}:${after ?? 'start'}`;

    try {
      const query = `
        query GetProperties($first: Int!, $after: String) {
          posts(first: $first, after: $after) {
            edges {
              node {
                id
                databaseId
                title
                slug
                content
                excerpt
                featuredImage {
                  node {
                    sourceUrl
                  }
                }
                date
              }
              cursor
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      `;

      const variables: Record<string, unknown> = { first };
      if (after) {
        variables.after = after;
      }

      const result = await this.fireWithFallback<{ posts: WPPropertyConnection }>(
        cacheKey,
        query,
        variables,
      );

      return result.posts;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      this.logger.error(`Failed to fetch properties: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Fetch a single property by slug from WPGraphQL.
   */
  async fetchPropertyBySlug(slug: string): Promise<WPPropertyNode | null> {
    const cacheKey = `wp:property:slug:${slug}`;

    try {
      const query = `
        query GetPropertyBySlug($slug: ID!) {
          post(id: $slug, idType: SLUG) {
            id
            databaseId
            title
            slug
            content
            excerpt
            featuredImage {
              node {
                sourceUrl
              }
            }
            date
          }
        }
      `;

      const result = await this.fireWithFallback<{ post: WPPropertyNode | null }>(cacheKey, query, {
        slug,
      });

      return result.post;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      this.logger.error(`Failed to fetch property by slug "${slug}": ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Fetch a single property by WordPress database ID.
   */
  async fetchPropertyByWpId(wpId: number): Promise<WPPropertyNode | null> {
    const cacheKey = `wp:property:wpId:${wpId}`;

    try {
      const query = `
        query GetPropertyByWpId($wpId: ID!) {
          post(id: $wpId, idType: DATABASE_ID) {
            id
            databaseId
            title
            slug
            content
            excerpt
            featuredImage {
              node {
                sourceUrl
              }
            }
            date
          }
        }
      `;

      const result = await this.fireWithFallback<{ post: WPPropertyNode | null }>(cacheKey, query, {
        wpId,
      });

      return result.post;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      this.logger.error(`Failed to fetch property by wpId ${wpId}: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Returns the current state of the circuit breaker.
   */
  getCircuitState(): string {
    if (this.breaker.opened) return 'OPEN';
    if (this.breaker.closed) return 'CLOSED';
    return 'HALF-OPEN';
  }

  // --- Private methods ---

  /**
   * Execute the GraphQL request against the WPGraphQL endpoint.
   * This is the action wrapped by the circuit breaker.
   */
  private async executeGraphQL(
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<unknown> {
    const response = await this.httpClient.post<WPGraphQLResponse<unknown>>('', {
      query,
      variables,
    });

    if (response.data.errors && response.data.errors.length > 0) {
      const errorMessages = response.data.errors.map((e) => e.message).join('; ');
      throw new Error(`WPGraphQL errors: ${errorMessages}`);
    }

    return response.data.data;
  }

  /**
   * Fire the circuit breaker with cache fallback.
   * On OPEN state: serve cached data if available, else throw 503 with Retry-After hint.
   */
  private async fireWithFallback<T>(
    cacheKey: string,
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<T> {
    try {
      const result = (await this.breaker.fire(query, variables)) as T;

      // Store successful result in cache
      await this.cacheService.set(cacheKey, result, {
        staleTtl: 5 * 60, // 5 minutes
        expireTtl: 15 * 60, // 15 minutes
      });

      return result;
    } catch (error) {
      // If circuit is open, try to serve from cache
      if (this.breaker.opened) {
        const cached = await this.cacheService.get<T>(cacheKey);
        if (cached) {
          this.logger.warn(`Circuit OPEN — serving cached data for key "${cacheKey}"`);
          return cached;
        }

        // No cached data available — return 503 with Retry-After hint
        throw new ServiceUnavailableException({
          message: 'WordPress service temporarily unavailable',
          retryAfter: Math.ceil(WP_RESET_TIMEOUT_MS / 1000),
        });
      }

      // Re-throw non-circuit-breaker errors (e.g. timeout, network error)
      throw error;
    }
  }
}
