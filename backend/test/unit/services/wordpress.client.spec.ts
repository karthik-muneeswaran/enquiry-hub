import { WordPressClient } from '@/modules/property/wordpress.client';
import { AppConfigService } from '@/config/config.service';
import { CacheService } from '@/cache/cache.service';

// Mock axios — must return a factory that produces an instance with `post`
const mockPost = jest.fn();
jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: () => ({
      post: mockPost,
    }),
  },
}));

// Mock circuit breaker to just call the function directly
jest.mock('@/common/circuit-breaker', () => ({
  createCircuitBreaker: (_name: string, fn: Function, _opts: any) => ({
    fire: (...args: any[]) => fn(...args),
    opened: false,
    closed: true,
    status: { stats: {} },
    on: jest.fn(),
  }),
}));

describe('WordPressClient', () => {
  let client: WordPressClient;
  let mockConfigService: any;
  let mockCacheService: any;

  const mockPropertyNode = {
    id: 'cG9zdDoxMjM=',
    databaseId: 123,
    title: 'Test Property',
    slug: 'test-property',
    content: '<p>Content</p>',
    excerpt: 'Content',
    featuredImage: { node: { sourceUrl: 'https://img.com/1.jpg' } },
    date: '2026-01-01',
  };

  beforeEach(() => {
    mockPost.mockReset();

    mockConfigService = {
      wordpressGraphqlUrl: 'http://wordpress:80/graphql',
    };

    mockCacheService = {
      set: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(null),
      getWithSWR: jest.fn().mockResolvedValue({ status: 'miss', data: null }),
    };

    client = new WordPressClient(
      mockConfigService as unknown as AppConfigService,
      mockCacheService as unknown as CacheService,
    );
  });

  describe('fetchProperties', () => {
    it('should return property connection on success', async () => {
      mockPost.mockResolvedValue({
        data: {
          data: {
            posts: {
              edges: [{ node: mockPropertyNode, cursor: 'cursor-1' }],
              pageInfo: { hasNextPage: true, endCursor: 'cursor-1' },
            },
          },
          errors: undefined,
        },
      });

      const result = await client.fetchProperties(20);

      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].node.title).toBe('Test Property');
      expect(result.pageInfo.hasNextPage).toBe(true);
    });

    it('should throw when GraphQL returns errors', async () => {
      mockPost.mockResolvedValue({
        data: {
          data: null,
          errors: [{ message: 'Query failed' }],
        },
      });

      await expect(client.fetchProperties(20)).rejects.toThrow('WPGraphQL errors');
    });

    it('should throw on network error', async () => {
      mockPost.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(client.fetchProperties(20)).rejects.toThrow('ECONNREFUSED');
    });
  });

  describe('fetchPropertyBySlug', () => {
    it('should return property node for valid slug', async () => {
      mockPost.mockResolvedValue({
        data: {
          data: {
            post: mockPropertyNode,
          },
          errors: undefined,
        },
      });

      const result = await client.fetchPropertyBySlug('test-property');

      expect(result).toBeDefined();
      expect(result!.slug).toBe('test-property');
    });

    it('should return null when property not found', async () => {
      mockPost.mockResolvedValue({
        data: {
          data: { post: null },
          errors: undefined,
        },
      });

      const result = await client.fetchPropertyBySlug('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('fetchPropertyByWpId', () => {
    it('should return property node for valid wpId', async () => {
      mockPost.mockResolvedValue({
        data: {
          data: {
            post: mockPropertyNode,
          },
          errors: undefined,
        },
      });

      const result = await client.fetchPropertyByWpId(123);

      expect(result).toBeDefined();
      expect(result!.databaseId).toBe(123);
    });
  });

  describe('getCircuitState', () => {
    it('should return circuit breaker state', () => {
      const state = client.getCircuitState();
      expect(state).toBeDefined();
    });
  });
});
