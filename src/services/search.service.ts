/**
 * Search Service
 * 
 * Provides full-text search across all entity types.
 * Uses cached repository methods for efficient search.
 */

import { entityRepository, regionRepository } from '@/lib/repositories';
import { cache, cacheKeys, cacheTTL } from '@/lib/cache';
import { SearchResult, EntityType } from '@/types';

/**
 * Search across all entity types
 * @param countryCode - ISO country code
 * @param query - Search query string
 * @param regionSlug - Optional region slug to filter results within a specific region
 * @returns Array of search results sorted by relevance
 */
export async function searchAll(countryCode: string, query: string, regionSlug?: string): Promise<SearchResult[]> {
    if (!query || query.length < 2) {
        return [];
    }

    // Check cache first (include region in cache key)
    const cacheKey = cacheKeys.search(countryCode, `${query}${regionSlug ? `:${regionSlug}` : ''}`);
    const cached = cache.get<SearchResult[]>(cacheKey);
    if (cached) return cached;

    const queryLower = query.toLowerCase();
    const results: SearchResult[] = [];

    try {
        // Search in parallel for better performance
        const [regions, entities] = await Promise.all([
            regionRepository.search(countryCode, query),
            entityRepository.search(countryCode, query),
        ]);

        // If filtering by region, we need to find the target region first
        let targetRegionId: string | undefined;
        if (regionSlug) {
            const targetRegion = await regionRepository.findBySlug(countryCode, regionSlug);
            targetRegionId = targetRegion?.id;
        }

        // Process regions (only if not filtering by region)
        if (!regionSlug) {
            for (const region of regions) {
                results.push({
                    id: region.id,
                    type: 'region',
                    name: region.name,
                    slug: region.slug,
                    description: region.description,
                    path: `/${countryCode}/${region.slug}`,
                    score: calculateScore(region.name, queryLower),
                });
            }
        }

        // Process entities (persons and infrastructure)
        for (const entity of entities) {
            // If filtering by region, check if entity belongs to the region
            if (targetRegionId) {
                const entityRegionId = (entity as { regionId?: string }).regionId;
                const entityRegionIds = (entity as { regionIds?: string[] }).regionIds;

                // Check if entity belongs to the target region
                const belongsToRegion =
                    entityRegionId === targetRegionId ||
                    (entityRegionIds && entityRegionIds.includes(targetRegionId));

                if (!belongsToRegion) {
                    continue; // Skip entities not in the target region
                }
            }

            const entityType = entity.type as EntityType;
            let path: string;
            let description: string | undefined;

            if (entityType === 'person') {
                const person = entity as { role?: string; party?: string; constituency?: string };
                path = `/${countryCode}/person/${entity.slug}`;
                description = `${(person.role || '').toUpperCase()} - ${person.party || ''} ${person.constituency || ''}`.trim();
            } else if (entityType === 'infrastructure') {
                const infra = entity as { category?: string };
                path = `/${countryCode}/infrastructure/${infra.category || 'other'}/${entity.slug}`;
                description = infra.category;
            } else {
                path = `/${countryCode}/${entity.slug}`;
                description = entity.description;
            }

            results.push({
                id: entity.id,
                type: entityType,
                name: entity.name,
                slug: entity.slug,
                description,
                path,
                score: calculateScore(entity.name, queryLower),
            });
        }

        // Sort by score (higher is better)
        results.sort((a, b) => (b.score || 0) - (a.score || 0));

        // Limit results and cache
        const limitedResults = results.slice(0, 20);
        cache.set(cacheKey, limitedResults, cacheTTL.search);

        return limitedResults;
    } catch (error) {
        console.error('Search error:', error);
        return [];
    }
}

/**
 * Calculate relevance score for a name against a query
 * Higher scores indicate better matches
 */
function calculateScore(name: string, query: string): number {
    const nameLower = name.toLowerCase();

    // Exact match gets highest score
    if (nameLower === query) {
        return 1.0;
    }

    // Starts with query gets high score
    if (nameLower.startsWith(query)) {
        return 0.9;
    }

    // Contains at word boundary
    if (nameLower.includes(` ${query}`)) {
        return 0.7;
    }

    // Contains anywhere
    if (nameLower.includes(query)) {
        return 0.5;
    }

    // Partial match
    return 0.3;
}

/**
 * Get search suggestions (autocomplete)
 * Returns quick suggestions for partial queries
 */
export async function getSearchSuggestions(
    countryCode: string,
    query: string,
    limit: number = 5
): Promise<string[]> {
    if (!query || query.length < 1) {
        return [];
    }

    const results = await searchAll(countryCode, query);
    return results.slice(0, limit).map(r => r.name);
}
