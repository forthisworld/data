/**
 * Region Repository
 * 
 * Handles all MongoDB operations for region data including
 * states, districts, cities, and constituencies.
 */

import { Document, WithId } from 'mongodb';
import { BaseRepository, cache, cacheKeys, cacheTTL } from './base.repository';
import { Region, RegionLevel, Overview } from '@/types';

interface RegionDocument extends Document {
    countryCode: string;
    id: string;
    name: string;
    slug: string;
    description?: string;
    level?: RegionLevel;
    parentId?: string;
    code?: string;
    coordinates?: [number, number];
    population?: number;
    area?: number;
    capital?: string;
    children?: string[];
    // Overview fields (merged from overview.json)
    entityId?: string;
    entityType?: string;
    metrics?: unknown[];
    highlights?: unknown[];
    quickLinks?: unknown[];
    _sourceFile?: string;
}

class RegionRepository extends BaseRepository<RegionDocument> {
    protected collectionName = 'regions';

    /**
     * Get all regions for a country
     * Cached for 10 minutes
     */
    async findAll(countryCode: string): Promise<Region[]> {
        const cacheKey = cacheKeys.regions(countryCode);
        const cached = cache.get<Region[]>(cacheKey);
        if (cached) return cached;

        // Only find documents with a slug (proper regions, not orphan overview docs)
        const docs = await this.findMany(
            { countryCode, slug: { $exists: true } },
            { sort: { name: 1 } }
        );

        const regions = docs.map(doc => this.toRegion(doc));
        cache.set(cacheKey, regions, cacheTTL.regions);
        return regions;
    }

    /**
     * Find a region by slug
     */
    async findBySlug(countryCode: string, slug: string): Promise<Region | null> {
        const cacheKey = cacheKeys.region(countryCode, slug);
        const cached = cache.get<Region>(cacheKey);
        if (cached) return cached;

        const doc = await this.findOne({ countryCode, slug });
        if (!doc) {
            // Try by id as fallback
            const docById = await this.findOne({ countryCode, id: slug });
            if (!docById) return null;

            const region = this.toRegion(docById);
            cache.set(cacheKey, region, cacheTTL.entity);
            return region;
        }

        const region = this.toRegion(doc);
        cache.set(cacheKey, region, cacheTTL.entity);
        return region;
    }

    /**
     * Find a region by ID
     */
    async findById(countryCode: string, id: string): Promise<Region | null> {
        return this.findBySlug(countryCode, id);
    }

    /**
     * Find regions by level (e.g., all states, all districts)
     */
    async findByLevel(countryCode: string, level: RegionLevel): Promise<Region[]> {
        const docs = await this.findMany(
            { countryCode, level, slug: { $exists: true } },
            { sort: { name: 1 } }
        );
        return docs.map(doc => this.toRegion(doc));
    }

    /**
     * Find child regions
     */
    async findChildren(countryCode: string, parentId: string): Promise<Region[]> {
        const docs = await this.findMany(
            { countryCode, parentId, slug: { $exists: true } },
            { sort: { name: 1 } }
        );
        return docs.map(doc => this.toRegion(doc));
    }

    /**
     * Get overview for a region
     * Cached for 5 minutes
     */
    async getOverview(countryCode: string, regionSlug: string): Promise<Overview | null> {
        const cacheKey = cacheKeys.countryOverview(countryCode, [regionSlug]);
        const cached = cache.get<Overview>(cacheKey);
        if (cached) return cached;

        // The region document contains overview data (merged during seeding)
        const doc = await this.findOne({ countryCode, slug: regionSlug });
        if (!doc) return null;

        const overview = this.toOverview(doc);
        cache.set(cacheKey, overview, cacheTTL.countryOverview);
        return overview;
    }

    /**
     * Search regions by text query
     */
    async search(countryCode: string, query: string): Promise<Region[]> {
        const cacheKey = cacheKeys.search(countryCode, `region:${query}`);
        const cached = cache.get<Region[]>(cacheKey);
        if (cached) return cached;

        // Only search documents with a slug (proper regions)
        const docs = await this.findMany(
            {
                countryCode,
                slug: { $exists: true },
                name: { $regex: query, $options: 'i' },
            },
            { limit: 20 }
        );

        const results = docs.map(doc => this.toRegion(doc));
        cache.set(cacheKey, results, cacheTTL.search);
        return results;
    }

    /**
     * Transform document to Region
     */
    private toRegion(doc: WithId<RegionDocument>): Region {
        return {
            id: doc.id,
            type: 'region',
            name: doc.name,
            slug: doc.slug,
            description: doc.description,
            level: doc.level || 'state',
            parentId: doc.parentId,
            code: doc.code,
            coordinates: doc.coordinates,
            population: doc.population,
            area: doc.area,
            capital: doc.capital,
            children: doc.children,
        };
    }

    /**
     * Transform document to Overview
     */
    private toOverview(doc: WithId<RegionDocument>): Overview {
        return {
            entityId: doc.entityId || doc.id,
            entityType: 'region',
            name: doc.name,
            metrics: (doc.metrics || []) as Overview['metrics'],
            highlights: doc.highlights as Overview['highlights'],
            quickLinks: doc.quickLinks as Overview['quickLinks'],
        };
    }
}

// Export singleton instance
export const regionRepository = new RegionRepository();
