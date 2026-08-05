import { NotFoundException } from '@nestjs/common';
import { PropertyService } from '@/modules/property/property.service';
import { WordPressClient, WPPropertyNode } from '@/modules/property/wordpress.client';
import { PropertyCacheService } from '@/modules/property/property-cache.service';

describe('PropertyService', () => {
  let service: PropertyService;
  let mockWordPressClient: any;
  let mockPropertyCacheService: any;

  const mockWPNode: WPPropertyNode = {
    id: 'cG9zdDoxMjM=',
    databaseId: 123,
    title: '3 Bed Apartment',
    slug: '3-bed-apartment',
    content: '<p>A lovely apartment</p>',
    excerpt: 'A lovely apartment',
    featuredImage: { node: { sourceUrl: 'https://example.com/img.jpg' } },
    date: '2026-01-15T10:00:00',
  };

  beforeEach(() => {
    mockWordPressClient = {
      fetchProperties: jest.fn(),
      fetchPropertyBySlug: jest.fn(),
      fetchPropertyByWpId: jest.fn(),
    };

    mockPropertyCacheService = {
      getListOrRefresh: jest.fn((params, refreshFn) => refreshFn()),
      getBySlugOrRefresh: jest.fn(),
      getByWpIdOrRefresh: jest.fn(),
      invalidateAll: jest.fn().mockResolvedValue(undefined),
    };

    service = new PropertyService(
      mockWordPressClient as unknown as WordPressClient,
      mockPropertyCacheService as unknown as PropertyCacheService,
    );
  });

  describe('findProperties', () => {
    it('should return property connection from WordPress', async () => {
      const mockConnection = {
        edges: [{ node: mockWPNode, cursor: 'cursor1' }],
        pageInfo: { hasNextPage: false, endCursor: null },
      };
      mockWordPressClient.fetchProperties.mockResolvedValue(mockConnection);

      const result = await service.findProperties({ first: 10 });

      expect(result.edges).toHaveLength(1);
      expect(result.pageInfo.hasNextPage).toBe(false);
    });

    it('should return empty edges on error', async () => {
      mockPropertyCacheService.getListOrRefresh.mockImplementation((_, fn) => fn());
      mockWordPressClient.fetchProperties.mockRejectedValue(new Error('Network error'));

      const result = await service.findProperties({ first: 10 });

      expect(result.edges).toEqual([]);
      expect(result.pageInfo.hasNextPage).toBe(false);
    });

    it('should pass pagination args to WordPress client', async () => {
      const mockConnection = {
        edges: [],
        pageInfo: { hasNextPage: false, endCursor: null },
      };
      mockWordPressClient.fetchProperties.mockResolvedValue(mockConnection);

      await service.findProperties({ first: 5, after: 'cursor-abc' });

      expect(mockWordPressClient.fetchProperties).toHaveBeenCalledWith(5, 'cursor-abc');
    });
  });

  describe('findProperty', () => {
    it('should find property by slug', async () => {
      mockWordPressClient.fetchPropertyBySlug.mockResolvedValue(mockWPNode);

      const result = await service.findProperty('3-bed-apartment');

      expect(result).toBeDefined();
      expect(mockWordPressClient.fetchPropertyBySlug).toHaveBeenCalledWith('3-bed-apartment');
    });

    it('should find property by wpId', async () => {
      mockWordPressClient.fetchPropertyByWpId.mockResolvedValue(mockWPNode);

      const result = await service.findProperty(undefined, 123);

      expect(result).toBeDefined();
      expect(mockWordPressClient.fetchPropertyByWpId).toHaveBeenCalledWith(123);
    });

    it('should throw NotFoundException when neither slug nor wpId provided', async () => {
      await expect(service.findProperty(undefined, undefined)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when property not found by slug', async () => {
      mockWordPressClient.fetchPropertyBySlug.mockResolvedValue(null);

      await expect(service.findProperty('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when WordPress errors', async () => {
      mockWordPressClient.fetchPropertyBySlug.mockRejectedValue(new Error('timeout'));

      await expect(service.findProperty('some-slug')).rejects.toThrow(NotFoundException);
    });
  });

  describe('invalidateCache', () => {
    it('should call invalidateAll on cache service', async () => {
      await service.invalidateCache();

      expect(mockPropertyCacheService.invalidateAll).toHaveBeenCalled();
    });
  });
});
