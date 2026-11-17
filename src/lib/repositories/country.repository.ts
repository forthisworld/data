/**
 * Country Repository
 * 
 * Handles all MongoDB operations for country-related data including
 * configurations and overview statistics.
 */

import { Document, WithId } from 'mongodb';
import { BaseRepository, cache, cacheKeys, cacheTTL } from './base.repository';
import { CountryConfig, Overview } from '@/types';

interface CountryDocument extends Document {
    countryCode: string;
    name?: string;
    entityId?: string;
    entityType?: string;
    metrics?: unknown[];
    highlights?: unknown[];
    quickLinks?: unknown[];
    // Config fields
    code?: string;
    currency?: string;
    currencySymbol?: string;
    coordinates?: [number, number];
    regionLevels?: string[];
    entityTypes?: string[];
    personRoles?: string[];
    infraCategories?: string[];
    features?: Record<string, boolean>;
}

class CountryRepository extends BaseRepository<CountryDocument> {
    protected collectionName = 'countries';

    /**
     * Get country configuration
     * Cached for 1 hour as configs rarely change
     */
    async getConfig(countryCode: string): Promise<CountryConfig | null> {
        const cacheKey = cacheKeys.countryConfig(countryCode);

        return cache.getOrSet(
            cacheKey,
            async () => {
                const doc = await this.findOne({ countryCode });
                if (!doc) return null;

                // Transform document to CountryConfig
                return this.toCountryConfig(doc);
            },
            cacheTTL.countryConfig
        );
    }

    /**
     * Get country overview data
     * Cached for 5 minutes
     */
    async getOverview(countryCode: string): Promise<Overview | null> {
        const cacheKey = cacheKeys.countryOverview(countryCode);

        return cache.getOrSet(
            cacheKey,
            async () => {
                const doc = await this.findOne({ countryCode });
                if (!doc) return null;

                // Transform document to Overview
                return this.toOverview(doc);
            },
            cacheTTL.countryOverview
        );
    }

    /**
     * Transform MongoDB document to CountryConfig
     */
    private toCountryConfig(doc: WithId<CountryDocument>): CountryConfig {
        return {
            code: doc.code || doc.countryCode,
            name: doc.name || '',
            currency: doc.currency || 'INR',
            currencySymbol: doc.currencySymbol || '₹',
            coordinates: doc.coordinates || [20.5937, 78.9629],
            regionLevels: (doc.regionLevels || []) as CountryConfig['regionLevels'],
            entityTypes: (doc.entityTypes || []) as CountryConfig['entityTypes'],
            personRoles: (doc.personRoles || []) as CountryConfig['personRoles'],
            infraCategories: (doc.infraCategories || []) as CountryConfig['infraCategories'],
            features: doc.features,
        };
    }

    /**
     * Transform MongoDB document to Overview
     */
    private toOverview(doc: WithId<CountryDocument>): Overview {
        return {
            entityId: doc.entityId || doc.countryCode,
            entityType: (doc.entityType || 'region') as Overview['entityType'],
            name: doc.name || '',
            metrics: (doc.metrics || []) as Overview['metrics'],
            highlights: doc.highlights as Overview['highlights'],
            quickLinks: doc.quickLinks as Overview['quickLinks'],
        };
    }
}

// Export singleton instance
export const countryRepository = new CountryRepository();
