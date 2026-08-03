import { Injectable, Logger, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { InMemoryLRUCache } from './in-memory-lru.cache';

/** Token for injecting the Redis client */
export const REDIS_CLIENT = 'REDIS_CLIENT';

/** Default SWR thresholds in seconds */
const DEFAULT_STALE_TTL = 5 * 60; // 5 minutes
const DEFAULT_EXPIRE_TTL = 15 * 60; // 15 minutes

/** Timeout for Redis operations in milliseconds */
const REDIS_OPERATION_TIMEOUT_MS = 2000;

export interface CacheOptions {
  /** Time in seconds before data is considered stale (default: 300s / 5 min) */
  staleTtl?: number;
  /** Time in seconds before data expires entirely (default: 900s / 15 min) */
  expireTtl?: number;
}

export interface CacheEntry<T> {
  data: T;
  cachedAt: number;
}

export type SWRResult<T> =
  | { status: 'fresh'; data: T }
  | { status: 'stale'; data: T }
  | { status: 'miss'; data: null };

export interface CacheOperation {
  type: 'get' | 'set' | 'del';
  key: string;
  value?: unknown;
  options?: CacheOptions;
}

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly fallbackCache = new InMemoryLRUCache(1000, 60);
  private redisHealthy = false;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  onModuleInit(): void {
    this.setupRedisEventListeners();
    this.startHealthMonitoring();
  }

  onModuleDestroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Get a value from cache.
   * Returns null if not found or expired.
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.redisHealthy) {
      return this.fallbackCache.get<T>(key);
    }

    try {
      const raw = await this.withTimeout(this.redis.get(key));
      if (!raw) {
        return null;
      }

      const entry: CacheEntry<T> = JSON.parse(raw);
      return entry.data;
    } catch (error) {
      this.logger.warn(`Redis GET failed for key "${key}", falling back to in-memory`, (error as Error).message);
      this.handleRedisFailure();
      return this.fallbackCache.get<T>(key);
    }
  }

  /**
   * Get a value with SWR (Stale-While-Revalidate) semantics.
   * Returns the status (fresh/stale/miss) along with data.
   */
  async getWithSWR<T>(key: string, options?: CacheOptions): Promise<SWRResult<T>> {
    const staleTtl = (options?.staleTtl ?? DEFAULT_STALE_TTL) * 1000;
    const expireTtl = (options?.expireTtl ?? DEFAULT_EXPIRE_TTL) * 1000;

    if (!this.redisHealthy) {
      const data = this.fallbackCache.get<T>(key);
      return data !== null ? { status: 'fresh', data } : { status: 'miss', data: null };
    }

    try {
      const raw = await this.withTimeout(this.redis.get(key));
      if (!raw) {
        return { status: 'miss', data: null };
      }

      const entry: CacheEntry<T> = JSON.parse(raw);
      const age = Date.now() - entry.cachedAt;

      if (age < staleTtl) {
        return { status: 'fresh', data: entry.data };
      }

      if (age < expireTtl) {
        return { status: 'stale', data: entry.data };
      }

      // Expired — treat as a miss
      return { status: 'miss', data: null };
    } catch (error) {
      this.logger.warn(`Redis GET (SWR) failed for key "${key}", falling back to in-memory`, (error as Error).message);
      this.handleRedisFailure();
      const data = this.fallbackCache.get<T>(key);
      return data !== null ? { status: 'fresh', data } : { status: 'miss', data: null };
    }
  }

  /**
   * Get or refresh: returns cached data if available, otherwise calls refreshFn.
   * Implements SWR: fresh → serve, stale → serve + background refresh, expired → fetch fresh.
   */
  async getOrRefresh<T>(
    key: string,
    refreshFn: () => Promise<T>,
    options?: CacheOptions,
  ): Promise<T> {
    const result = await this.getWithSWR<T>(key, options);

    switch (result.status) {
      case 'fresh':
        return result.data;

      case 'stale':
        // Serve stale data immediately, trigger background refresh
        this.backgroundRefresh(key, refreshFn, options).catch((err) => {
          this.logger.warn(`Background refresh failed for key "${key}"`, (err as Error).message);
        });
        return result.data;

      case 'miss':
        // Fetch fresh data
        const freshData = await refreshFn();
        await this.set(key, freshData, options);
        return freshData;
    }
  }

  /**
   * Set a value in cache with SWR metadata.
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const expireTtl = options?.expireTtl ?? DEFAULT_EXPIRE_TTL;

    const entry: CacheEntry<T> = {
      data: value,
      cachedAt: Date.now(),
    };

    if (!this.redisHealthy) {
      this.fallbackCache.set(key, value, 60); // In-memory fallback uses 60s TTL
      return;
    }

    try {
      await this.withTimeout(
        this.redis.set(key, JSON.stringify(entry), 'EX', expireTtl),
      );
    } catch (error) {
      this.logger.warn(`Redis SET failed for key "${key}", falling back to in-memory`, (error as Error).message);
      this.handleRedisFailure();
      this.fallbackCache.set(key, value, 60);
    }
  }

  /**
   * Delete a key from cache.
   */
  async delete(key: string): Promise<void> {
    this.fallbackCache.delete(key);

    if (!this.redisHealthy) {
      return;
    }

    try {
      await this.withTimeout(this.redis.del(key));
    } catch (error) {
      this.logger.warn(`Redis DEL failed for key "${key}"`, (error as Error).message);
      this.handleRedisFailure();
    }
  }

  /**
   * Invalidate all keys matching a pattern using SCAN + DEL.
   * Uses SCAN to avoid blocking Redis on large datasets.
   */
  async invalidatePattern(pattern: string): Promise<void> {
    this.fallbackCache.clear();

    if (!this.redisHealthy) {
      return;
    }

    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.withTimeout(
          this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100),
        );
        cursor = nextCursor;

        if (keys.length > 0) {
          await this.withTimeout(this.redis.del(...keys));
        }
      } while (cursor !== '0');
    } catch (error) {
      this.logger.warn(`Redis invalidatePattern failed for "${pattern}"`, (error as Error).message);
      this.handleRedisFailure();
    }
  }

  /**
   * Execute multiple cache operations in a Redis pipeline for efficiency.
   */
  async pipeline(ops: CacheOperation[]): Promise<void> {
    if (!this.redisHealthy) {
      // Fallback: execute against in-memory cache
      for (const op of ops) {
        switch (op.type) {
          case 'get':
            // Pipeline get results are discarded in this simplified version
            break;
          case 'set':
            if (op.value !== undefined) {
              this.fallbackCache.set(op.key, op.value, 60);
            }
            break;
          case 'del':
            this.fallbackCache.delete(op.key);
            break;
        }
      }
      return;
    }

    try {
      const pipe = this.redis.pipeline();

      for (const op of ops) {
        switch (op.type) {
          case 'get':
            pipe.get(op.key);
            break;
          case 'set': {
            const expireTtl = op.options?.expireTtl ?? DEFAULT_EXPIRE_TTL;
            const entry: CacheEntry<unknown> = {
              data: op.value,
              cachedAt: Date.now(),
            };
            pipe.set(op.key, JSON.stringify(entry), 'EX', expireTtl);
            break;
          }
          case 'del':
            pipe.del(op.key);
            break;
        }
      }

      await this.withTimeout(pipe.exec());
    } catch (error) {
      this.logger.warn('Redis pipeline failed, falling back to in-memory', (error as Error).message);
      this.handleRedisFailure();

      // Fallback: execute against in-memory cache
      for (const op of ops) {
        if (op.type === 'set' && op.value !== undefined) {
          this.fallbackCache.set(op.key, op.value, 60);
        } else if (op.type === 'del') {
          this.fallbackCache.delete(op.key);
        }
      }
    }
  }

  /**
   * Returns true if Redis is connected and responsive.
   */
  async isHealthy(): Promise<boolean> {
    if (!this.redisHealthy) {
      return false;
    }

    try {
      const result = await this.withTimeout(this.redis.ping());
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  /**
   * Returns the current Redis health status (synchronous check of last known state).
   */
  get isRedisHealthy(): boolean {
    return this.redisHealthy;
  }

  /**
   * Returns the in-memory fallback cache instance (useful for testing/monitoring).
   */
  get fallback(): InMemoryLRUCache {
    return this.fallbackCache;
  }

  /**
   * Acquire a distributed mutex lock using SET NX PX.
   * Returns the lock token on success, null if lock is already held.
   * Use releaseLock() with the returned token to safely release.
   */
  async acquireLock(key: string, ttlMs = 5000): Promise<string | null> {
    const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      const result = await this.withTimeout(
        this.redis.set(`lock:${key}`, token, 'PX', ttlMs, 'NX'),
      );
      return result === 'OK' ? token : null;
    } catch {
      return null;
    }
  }

  /**
   * Release a distributed mutex lock safely using Lua script.
   * Only deletes the lock if the token matches (prevents releasing another client's lock).
   */
  async releaseLock(key: string, token: string): Promise<void> {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      end
      return 0
    `;
    try {
      await this.withTimeout(
        this.redis.eval(script, 1, `lock:${key}`, token),
      );
    } catch (error) {
      this.logger.warn(`Failed to release lock "${key}"`, (error as Error).message);
    }
  }

  /**
   * Get-or-refresh with mutex stampede protection.
   * On cache miss, only ONE caller fetches from DB. Others wait and serve fresh result.
   * On stale, serves stale immediately + one background refresh (mutex-protected).
   */
  async getOrRefreshWithLock<T>(
    key: string,
    refreshFn: () => Promise<T>,
    options?: CacheOptions & { lockTtlMs?: number; waitTimeoutMs?: number },
  ): Promise<T> {
    const lockTtlMs = options?.lockTtlMs ?? 5000;
    const waitTimeoutMs = options?.waitTimeoutMs ?? 3000;

    const result = await this.getWithSWR<T>(key, options);

    switch (result.status) {
      case 'fresh':
        return result.data;

      case 'stale':
        // Serve stale immediately, trigger mutex-protected background refresh
        this.refreshWithLock(key, refreshFn, lockTtlMs, options).catch((err) => {
          this.logger.warn(`Background refresh with lock failed for "${key}"`, (err as Error).message);
        });
        return result.data;

      case 'miss': {
        // Try to acquire lock — only one caller rebuilds cache
        const token = await this.acquireLock(key, lockTtlMs);

        if (token) {
          // We got the lock — fetch from DB, cache it, release lock
          try {
            const freshData = await refreshFn();
            await this.set(key, freshData, options);
            return freshData;
          } finally {
            await this.releaseLock(key, token);
          }
        }

        // Lock held by someone else — poll until cache is populated or timeout
        const data = await this.pollForCache<T>(key, waitTimeoutMs);
        if (data !== null) {
          return data;
        }

        // Timeout — fallback to DB directly (rare edge case)
        return refreshFn();
      }
    }
  }

  /**
   * Mark a cache entry as stale without deleting it.
   * Rewrites the entry with cachedAt backdated so SWR considers it stale.
   */
  async markStale(key: string): Promise<void> {
    if (!this.redisHealthy) return;

    try {
      const raw = await this.withTimeout(this.redis.get(key));
      if (!raw) return;

      const entry: CacheEntry<unknown> = JSON.parse(raw);
      // Backdate cachedAt to make it appear stale (older than any staleTtl)
      entry.cachedAt = 0;

      // Keep the existing TTL
      const ttl = await this.withTimeout(this.redis.ttl(key));
      if (ttl > 0) {
        await this.withTimeout(
          this.redis.set(key, JSON.stringify(entry), 'EX', ttl),
        );
      }
    } catch (error) {
      this.logger.warn(`Failed to mark key "${key}" as stale`, (error as Error).message);
    }
  }

  /**
   * Mark all keys matching a pattern as stale (using SCAN to avoid blocking).
   */
  async markStaleByPattern(pattern: string): Promise<void> {
    if (!this.redisHealthy) return;

    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.withTimeout(
          this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100),
        );
        cursor = nextCursor;

        for (const key of keys) {
          await this.markStale(key);
        }
      } while (cursor !== '0');
    } catch (error) {
      this.logger.warn(`Failed to mark stale by pattern "${pattern}"`, (error as Error).message);
    }
  }

  // --- Private methods ---

  private async backgroundRefresh<T>(
    key: string,
    refreshFn: () => Promise<T>,
    options?: CacheOptions,
  ): Promise<void> {
    const freshData = await refreshFn();
    await this.set(key, freshData, options);
  }

  /**
   * Mutex-protected background refresh: only one caller refreshes at a time.
   */
  private async refreshWithLock<T>(
    key: string,
    refreshFn: () => Promise<T>,
    lockTtlMs: number,
    options?: CacheOptions,
  ): Promise<void> {
    const token = await this.acquireLock(key, lockTtlMs);
    if (!token) return; // Another instance is already refreshing

    try {
      const freshData = await refreshFn();
      await this.set(key, freshData, options);
    } finally {
      await this.releaseLock(key, token);
    }
  }

  /**
   * Poll Redis for a cache key until it appears or timeout.
   * Used by waiters when another instance holds the rebuild lock.
   */
  private async pollForCache<T>(key: string, timeoutMs: number): Promise<T | null> {
    const interval = 50; // poll every 50ms
    const maxAttempts = Math.ceil(timeoutMs / interval);

    for (let i = 0; i < maxAttempts; i++) {
      const data = await this.get<T>(key);
      if (data !== null) return data;
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
    return null;
  }

  private setupRedisEventListeners(): void {
    this.redis.on('connect', () => {
      this.logger.log('Redis connected');
      this.redisHealthy = true;
    });

    this.redis.on('ready', () => {
      this.logger.log('Redis ready');
      this.redisHealthy = true;
    });

    this.redis.on('error', (err: Error) => {
      this.logger.error(`Redis error: ${err.message}`);
      this.handleRedisFailure();
    });

    this.redis.on('close', () => {
      this.logger.warn('Redis connection closed');
      this.handleRedisFailure();
    });

    this.redis.on('reconnecting', () => {
      this.logger.log('Redis reconnecting...');
    });

    // Set initial state based on current connection status
    this.redisHealthy = this.redis.status === 'ready';
  }

  /**
   * Monitors Redis health every 10 seconds.
   * Detects recovery within 10s as per requirements.
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const result = await this.withTimeout(this.redis.ping());
        if (result === 'PONG' && !this.redisHealthy) {
          this.logger.log('Redis connectivity restored — resuming Redis-backed operations');
          this.redisHealthy = true;
        }
      } catch {
        if (this.redisHealthy) {
          this.handleRedisFailure();
        }
      }
    }, 10_000);
  }

  private handleRedisFailure(): void {
    if (this.redisHealthy) {
      this.logger.warn('Redis unavailable — switching to in-memory LRU cache fallback');
      this.redisHealthy = false;
    }
  }

  /**
   * Wraps a Redis operation with a 2-second timeout.
   */
  private withTimeout<T>(promise: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Redis operation timed out (2s)'));
      }, REDIS_OPERATION_TIMEOUT_MS);

      promise
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }
}
