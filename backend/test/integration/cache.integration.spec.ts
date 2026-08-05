import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { CacheService, REDIS_CLIENT } from '@/cache/cache.service';
import Redis from 'ioredis';
import { createTestApp, flushRedis } from './setup/test-module.factory';

describe('Cache Integration Tests', () => {
  let app: INestApplication;
  let module: TestingModule;
  let cacheService: CacheService;
  let redis: Redis;

  beforeAll(async () => {
    ({ app, module } = await createTestApp());
    cacheService = module.get(CacheService);
    redis = module.get(REDIS_CLIENT);
  }, 30000);

  beforeEach(async () => {
    await flushRedis(redis);
  });

  afterAll(async () => {
    await app.close();
  }, 30000);

  describe('Basic cache operations', () => {
    it('should set and get a value from Redis', async () => {
      await cacheService.set('test:key1', { name: 'Test', value: 42 });

      const result = await cacheService.get<{ name: string; value: number }>('test:key1');
      expect(result).toEqual({ name: 'Test', value: 42 });
    });

    it('should return null for non-existent keys', async () => {
      const result = await cacheService.get('test:nonexistent');
      expect(result).toBeNull();
    });

    it('should delete a cached key', async () => {
      await cacheService.set('test:to-delete', 'value');
      await cacheService.delete('test:to-delete');

      const result = await cacheService.get('test:to-delete');
      expect(result).toBeNull();
    });
  });

  describe('SWR (Stale-While-Revalidate) behavior', () => {
    it('should return "fresh" for recently cached data', async () => {
      await cacheService.set('swr:fresh', { data: 'fresh' });

      const result = await cacheService.getWithSWR<{ data: string }>('swr:fresh');
      expect(result.status).toBe('fresh');
      expect(result.data).toEqual({ data: 'fresh' });
    });

    it('should return "miss" for non-existent key', async () => {
      const result = await cacheService.getWithSWR('swr:missing');
      expect(result.status).toBe('miss');
      expect(result.data).toBeNull();
    });

    it('should return "stale" for data between staleTtl and expireTtl', async () => {
      // Manually write an entry with an old cachedAt timestamp (6 minutes ago)
      const sixMinutesAgo = Date.now() - 6 * 60 * 1000;
      const entry = JSON.stringify({ data: { value: 'stale-data' }, cachedAt: sixMinutesAgo });
      await redis.set('swr:stale', entry, 'EX', 900); // expire in 15 min

      const result = await cacheService.getWithSWR<{ value: string }>('swr:stale');
      expect(result.status).toBe('stale');
      expect(result.data).toEqual({ value: 'stale-data' });
    });

    it('should return "miss" for data beyond expireTtl', async () => {
      // Write an entry with a very old cachedAt timestamp (20 minutes ago)
      const twentyMinutesAgo = Date.now() - 20 * 60 * 1000;
      const entry = JSON.stringify({ data: { value: 'expired' }, cachedAt: twentyMinutesAgo });
      await redis.set('swr:expired', entry, 'EX', 3600);

      const result = await cacheService.getWithSWR<{ value: string }>('swr:expired');
      expect(result.status).toBe('miss');
    });
  });

  describe('Pattern invalidation', () => {
    it('should invalidate all keys matching a pattern', async () => {
      await cacheService.set('property:slug-1', { id: 1 });
      await cacheService.set('property:slug-2', { id: 2 });
      await cacheService.set('other:key', { id: 3 });

      await cacheService.invalidatePattern('property:*');

      const prop1 = await cacheService.get('property:slug-1');
      const prop2 = await cacheService.get('property:slug-2');
      const other = await cacheService.get('other:key');

      expect(prop1).toBeNull();
      expect(prop2).toBeNull();
      expect(other).toEqual({ id: 3 }); // Should remain
    });
  });

  describe('Pipeline operations', () => {
    it('should execute multiple operations in a single pipeline', async () => {
      await cacheService.pipeline([
        { type: 'set', key: 'pipe:a', value: 'alpha' },
        { type: 'set', key: 'pipe:b', value: 'beta' },
        { type: 'set', key: 'pipe:c', value: 'gamma' },
      ]);

      const a = await cacheService.get('pipe:a');
      const b = await cacheService.get('pipe:b');
      const c = await cacheService.get('pipe:c');

      expect(a).toBe('alpha');
      expect(b).toBe('beta');
      expect(c).toBe('gamma');
    });

    it('should support delete operations in pipeline', async () => {
      await cacheService.set('pipe:del', 'to-be-deleted');

      await cacheService.pipeline([{ type: 'del', key: 'pipe:del' }]);

      const result = await cacheService.get('pipe:del');
      expect(result).toBeNull();
    });
  });

  describe('Health check', () => {
    it('should report healthy when Redis is connected', async () => {
      const healthy = await cacheService.isHealthy();
      expect(healthy).toBe(true);
    });
  });
});
