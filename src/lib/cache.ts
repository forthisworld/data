/**
 * Simple in-memory cache with TTL support
 * 
 * This provides a lightweight caching layer for frequently accessed data
 * like country configs and overviews. For production at scale, consider
 * using Redis or similar distributed cache.
 */

interface CacheEntry<T> {
    data: T;
    expiresAt: number;
}

class MemoryCache {
    private cache: Map<string, CacheEntry<unknown>> = new Map();
    private defaultTTL: number;

    constructor(defaultTTLSeconds: number = 300) { // 5 minutes default
        this.defaultTTL = defaultTTLSeconds * 1000;
    }

    /**
     * Get a cached value
     */
    get<T>(key: string): T | undefined {
        const entry = this.cache.get(key);
        if (!entry) {
            return undefined;
        }

        // Check if expired
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return undefined;
        }

        return entry.data as T;
    }

    /**
     * Set a cached value with optional custom TTL
     */
    set<T>(key: string, data: T, ttlSeconds?: number): void {
        const ttl = ttlSeconds ? ttlSeconds * 1000 : this.defaultTTL;
        this.cache.set(key, {
            data,
            expiresAt: Date.now() + ttl,
        });
    }

    /**
     * Delete a cached value
     */
    delete(key: string): boolean {
        return this.cache.delete(key);
    }

    /**
     * Clear all cached values
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * Clear all entries matching a pattern (prefix)
     */
    clearPattern(prefix: string): void {
        for (const key of this.cache.keys()) {
            if (key.startsWith(prefix)) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Get or set - returns cached value or fetches and caches it
     */
    async getOrSet<T>(
        key: string,
        fetcher: () => Promise<T>,
        ttlSeconds?: number
    ): Promise<T> {
        const cached = this.get<T>(key);
        if (cached !== undefined) {
            return cached;
        }

        const data = await fetcher();
        this.set(key, data, ttlSeconds);
        return data;
    }

    /**
     * Get cache stats for debugging
     */
    getStats(): { size: number; entries: string[] } {
        return {
            size: this.cache.size,
            entries: Array.from(this.cache.keys()),
        };
    }
}

// Singleton cache instance
// Different TTLs for different data types:
// - Country config: rarely changes (1 hour)
// - Overview: changes occasionally (5 minutes)
// - Entities: changes more frequently (2 minutes)
// - Search results: short-lived (30 seconds)
export const cache = new MemoryCache(300);

// Cache key generators for consistency
export const cacheKeys = {
    countryConfig: (countryCode: string) => `country:config:${countryCode}`,
    countryOverview: (countryCode: string, regionPath?: string[]) =>
        `country:overview:${countryCode}:${regionPath?.join('/') || 'root'}`,
    entities: (countryCode: string, type: string, hash: string) =>
        `entities:${countryCode}:${type}:${hash}`,
    entity: (countryCode: string, type: string, id: string) =>
        `entity:${countryCode}:${type}:${id}`,
    regions: (countryCode: string) => `regions:${countryCode}`,
    region: (countryCode: string, slug: string) => `region:${countryCode}:${slug}`,
    search: (countryCode: string, query: string) => `search:${countryCode}:${query}`,
    infoRequests: (countryCode: string) => `info_requests:${countryCode}`,
};

// TTL constants (in seconds)
export const cacheTTL = {
    countryConfig: 3600,     // 1 hour
    countryOverview: 300,    // 5 minutes
    entities: 120,           // 2 minutes
    entity: 300,             // 5 minutes
    regions: 600,            // 10 minutes
    search: 30,              // 30 seconds
    infoRequests: 300,       // 5 minutes
};

export default cache;
