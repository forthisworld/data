/**
 * Base Repository Class
 * 
 * Provides common MongoDB operations and abstractions for all repositories.
 * Includes built-in caching support and consistent error handling.
 */

import { Collection, Document, Filter, FindOptions, WithId } from 'mongodb';
import { getDatabase } from '@/lib/db/mongodb';
import cache, { cacheKeys, cacheTTL } from '@/lib/cache';

export abstract class BaseRepository<T extends Document> {
    protected abstract collectionName: string;

    /**
     * Get the MongoDB collection
     */
    protected async getCollection(): Promise<Collection<T>> {
        const db = await getDatabase();
        return db.collection<T>(this.collectionName);
    }

    /**
     * Find a single document
     */
    async findOne(filter: Filter<T>): Promise<WithId<T> | null> {
        const collection = await this.getCollection();
        return collection.findOne(filter);
    }

    /**
     * Find multiple documents with optional pagination and sorting
     */
    async findMany(
        filter: Filter<T>,
        options?: FindOptions & { limit?: number; skip?: number }
    ): Promise<WithId<T>[]> {
        const collection = await this.getCollection();
        let cursor = collection.find(filter);

        if (options?.sort) {
            cursor = cursor.sort(options.sort);
        }
        if (options?.skip) {
            cursor = cursor.skip(options.skip);
        }
        if (options?.limit) {
            cursor = cursor.limit(options.limit);
        }
        if (options?.projection) {
            cursor = cursor.project(options.projection);
        }

        return cursor.toArray() as Promise<WithId<T>[]>;
    }

    /**
     * Count documents matching a filter
     */
    async count(filter: Filter<T>): Promise<number> {
        const collection = await this.getCollection();
        return collection.countDocuments(filter);
    }

    /**
     * Run an aggregation pipeline
     */
    async aggregate<TResult extends Document = Document>(pipeline: Document[]): Promise<TResult[]> {
        const collection = await this.getCollection();
        return collection.aggregate<TResult>(pipeline).toArray();
    }

    /**
     * Check if a document exists
     */
    async exists(filter: Filter<T>): Promise<boolean> {
        const collection = await this.getCollection();
        const count = await collection.countDocuments(filter, { limit: 1 });
        return count > 0;
    }
}

/**
 * Generate a hash for filter objects (for cache keys)
 */
export function hashFilter(filter: Record<string, unknown>): string {
    return Buffer.from(JSON.stringify(filter)).toString('base64').slice(0, 20);
}

export { cache, cacheKeys, cacheTTL };
