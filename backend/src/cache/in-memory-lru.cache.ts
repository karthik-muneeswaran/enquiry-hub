/**
 * In-memory LRU cache with TTL support.
 * Used as a fallback when Redis is unavailable.
 * Max capacity: 1000 items, default TTL: 60 seconds.
 */
export class InMemoryLRUCache {
  private readonly maxSize: number;
  private readonly defaultTtlMs: number;
  private readonly cache = new Map<string, LRUEntry>();

  constructor(maxSize = 1000, defaultTtlSeconds = 60) {
    this.maxSize = maxSize;
    this.defaultTtlMs = defaultTtlSeconds * 1000;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    // Check TTL expiry
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Promote to most recently used (re-insert at end of Map)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlSeconds?: number): void {
    // If key already exists, delete it first to update position
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evict LRU entry if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    const ttlMs = ttlSeconds ? ttlSeconds * 1000 : this.defaultTtlMs;
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

interface LRUEntry {
  value: unknown;
  expiresAt: number;
}
