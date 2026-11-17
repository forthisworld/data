/**
 * Entity Repository
 * 
 * Handles all MongoDB operations for entities including persons,
 * infrastructure, and organizations.
 */

import { Document, WithId, Filter } from 'mongodb';
import { BaseRepository, cache, cacheKeys, cacheTTL, hashFilter } from './base.repository';
import { Entity, Person, Infrastructure, Filters, PaginatedResponse, EntityType } from '@/types';

interface EntityDocument extends Document {
    countryCode: string;
    id: string;
    type: EntityType;
    name: string;
    slug: string;
    description?: string;
    role?: string;
    roles?: string[];
    category?: string;
    party?: string;
    constituency?: string;
    regionId?: string;
    regionIds?: string[];
    status?: string;
    metadata?: Record<string, unknown>;
    _sourceFile?: string;
}

class EntityRepository extends BaseRepository<EntityDocument> {
    protected collectionName = 'entities';

    /**
     * Find entities by type with filters and pagination
     */
    async findByType(
        countryCode: string,
        type: 'person' | 'infrastructure',
        filters?: Filters
    ): Promise<PaginatedResponse<Entity>> {
        // Build MongoDB filter
        const mongoFilter: Filter<EntityDocument> = {
            countryCode,
        };

        // Determine entity type based on type parameter
        if (type === 'person') {
            mongoFilter.role = { $exists: true };
        } else if (type === 'infrastructure') {
            mongoFilter.category = { $exists: true };
        }

        // Apply additional filters
        if (filters?.role) {
            mongoFilter.$or = [
                { role: filters.role },
                { roles: filters.role },
            ];
        }
        if (filters?.category) {
            mongoFilter.category = filters.category;
        }
        if (filters?.regionId) {
            mongoFilter.$or = [
                { regionId: filters.regionId },
                { regionIds: filters.regionId },
            ];
        }
        if (filters?.search) {
            mongoFilter.$or = [
                { name: { $regex: filters.search, $options: 'i' } },
                { description: { $regex: filters.search, $options: 'i' } },
            ];
        }

        const limit = filters?.limit || 20;
        const offset = filters?.offset || 0;

        // Try cache first
        const cacheKey = cacheKeys.entities(countryCode, type, hashFilter(mongoFilter as Record<string, unknown>));
        const cached = cache.get<PaginatedResponse<Entity>>(cacheKey);
        if (cached) return cached;

        // Get total count
        const total = await this.count(mongoFilter);

        // Get paginated data
        const docs = await this.findMany(mongoFilter, {
            skip: offset,
            limit,
            sort: { name: 1 },
        });

        const result: PaginatedResponse<Entity> = {
            data: docs.map(doc => this.toEntity(doc, type)),
            total,
            limit,
            offset,
            hasMore: offset + limit < total,
        };

        // Cache for 2 minutes
        cache.set(cacheKey, result, cacheTTL.entities);
        return result;
    }

    /**
     * Find a single entity by slug
     */
    async findBySlug(
        countryCode: string,
        slug: string,
        type?: 'person' | 'infrastructure'
    ): Promise<Entity | null> {
        const cacheKey = cacheKeys.entity(countryCode, type || 'any', slug);
        const cached = cache.get<Entity>(cacheKey);
        if (cached) return cached;

        const filter: Filter<EntityDocument> = { countryCode, slug };

        if (type === 'person') {
            filter.role = { $exists: true };
        } else if (type === 'infrastructure') {
            filter.category = { $exists: true };
        }

        const doc = await this.findOne(filter);
        if (!doc) return null;

        const entity = this.toEntity(doc, type);
        cache.set(cacheKey, entity, cacheTTL.entity);
        return entity;
    }

    /**
     * Find a single entity by ID
     */
    async findById(
        countryCode: string,
        id: string,
        type?: 'person' | 'infrastructure'
    ): Promise<Entity | null> {
        const cacheKey = cacheKeys.entity(countryCode, type || 'any', id);
        const cached = cache.get<Entity>(cacheKey);
        if (cached) return cached;

        const filter: Filter<EntityDocument> = { countryCode, id };

        if (type === 'person') {
            filter.role = { $exists: true };
        } else if (type === 'infrastructure') {
            filter.category = { $exists: true };
        }

        const doc = await this.findOne(filter);
        if (!doc) {
            // Try by slug as fallback
            return this.findBySlug(countryCode, id, type);
        }

        const entity = this.toEntity(doc, type);
        cache.set(cacheKey, entity, cacheTTL.entity);
        return entity;
    }

    /**
     * Search entities by text query
     */
    async search(countryCode: string, query: string): Promise<Entity[]> {
        const cacheKey = cacheKeys.search(countryCode, `entity:${query}`);
        const cached = cache.get<Entity[]>(cacheKey);
        if (cached) return cached;

        const queryLower = query.toLowerCase();

        // Use regex search (text index would be more efficient for production)
        const docs = await this.findMany(
            {
                countryCode,
                $or: [
                    { name: { $regex: queryLower, $options: 'i' } },
                    { description: { $regex: queryLower, $options: 'i' } },
                    { party: { $regex: queryLower, $options: 'i' } },
                    { constituency: { $regex: queryLower, $options: 'i' } },
                ],
            },
            { limit: 20 }
        );

        const results = docs.map(doc => this.toEntity(doc));
        cache.set(cacheKey, results, cacheTTL.search);
        return results;
    }

    /**
     * Get all persons
     */
    async getPersons(countryCode: string): Promise<Person[]> {
        const filter: Filter<EntityDocument> = {
            countryCode,
            role: { $exists: true },
        };

        const docs = await this.findMany(filter, { sort: { name: 1 } });
        return docs.map(doc => this.toPerson(doc));
    }

    /**
     * Get all infrastructure
     */
    async getInfrastructure(countryCode: string): Promise<Infrastructure[]> {
        const filter: Filter<EntityDocument> = {
            countryCode,
            category: { $exists: true },
        };

        const docs = await this.findMany(filter, { sort: { name: 1 } });
        return docs.map(doc => this.toInfrastructure(doc));
    }

    /**
     * Transform document to Entity
     */
    private toEntity(doc: WithId<EntityDocument>, type?: 'person' | 'infrastructure'): Entity {
        // Determine type from document
        if (doc.role || type === 'person') {
            return this.toPerson(doc);
        }
        if (doc.category || type === 'infrastructure') {
            return this.toInfrastructure(doc);
        }

        // Generic entity
        return {
            id: doc.id,
            type: doc.type || 'person',
            name: doc.name,
            slug: doc.slug,
            description: doc.description,
            metadata: doc.metadata,
        };
    }

    /**
     * Transform document to Person
     */
    private toPerson(doc: WithId<EntityDocument>): Person {
        return {
            id: doc.id,
            type: 'person',
            name: doc.name,
            slug: doc.slug,
            description: doc.description,
            role: (doc.role || 'other') as Person['role'],
            roles: doc.roles as Person['roles'],
            party: doc.party,
            constituency: doc.constituency,
            regionId: doc.regionId,
            regionIds: doc.regionIds,
            metadata: doc.metadata,
        };
    }

    /**
     * Transform document to Infrastructure
     */
    private toInfrastructure(doc: WithId<EntityDocument>): Infrastructure {
        return {
            id: doc.id,
            type: 'infrastructure',
            name: doc.name,
            slug: doc.slug,
            description: doc.description,
            category: (doc.category || 'other') as Infrastructure['category'],
            regionId: doc.regionId,
            regionIds: doc.regionIds,
            status: doc.status as Infrastructure['status'],
            metadata: doc.metadata,
        };
    }
}

// Export singleton instance
export const entityRepository = new EntityRepository();
