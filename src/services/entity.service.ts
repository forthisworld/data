/**
 * Entity Service
 * 
 * Business logic for entity-related operations.
 * Handles persons, infrastructure, regions, and path resolution.
 */

import { entityRepository, regionRepository, countryRepository } from '@/lib/repositories';
import {
    Entity,
    Person,
    Infrastructure,
    Region,
    Filters,
    PaginatedResponse,
} from '@/types';

/**
 * Get all persons for a country
 */
export async function getPersons(countryCode: string): Promise<Person[]> {
    return entityRepository.getPersons(countryCode);
}

/**
 * Get a person by ID or slug
 */
export async function getPersonById(countryCode: string, personId: string): Promise<Person | undefined> {
    const person = await entityRepository.findById(countryCode, personId, 'person');
    return person as Person | undefined;
}

/**
 * Get all infrastructure for a country
 */
export async function getInfrastructure(countryCode: string): Promise<Infrastructure[]> {
    return entityRepository.getInfrastructure(countryCode);
}

/**
 * Get infrastructure by ID or slug
 */
export async function getInfrastructureById(countryCode: string, infraId: string): Promise<Infrastructure | undefined> {
    const infra = await entityRepository.findById(countryCode, infraId, 'infrastructure');
    return infra as Infrastructure | undefined;
}

/**
 * Get all regions for a country
 */
export async function getRegions(countryCode: string): Promise<Region[]> {
    return regionRepository.findAll(countryCode);
}

/**
 * Get a region by ID or slug
 */
export async function getRegionById(countryCode: string, regionId: string): Promise<Region | undefined> {
    const region = await regionRepository.findBySlug(countryCode, regionId);
    return region || undefined;
}

/**
 * Get entities with filters and pagination
 */
export async function getEntities(
    countryCode: string,
    type: 'person' | 'infrastructure' | 'region',
    filters?: Filters
): Promise<PaginatedResponse<Entity>> {
    if (type === 'region') {
        // Regions handled separately
        const allRegions = await regionRepository.findAll(countryCode);
        let data: Entity[] = allRegions;

        // Apply filters
        if (filters?.search) {
            const searchLower = filters.search.toLowerCase();
            data = data.filter(r =>
                r.name.toLowerCase().includes(searchLower) ||
                r.description?.toLowerCase().includes(searchLower)
            );
        }

        const limit = filters?.limit || 20;
        const offset = filters?.offset || 0;
        const paginatedData = data.slice(offset, offset + limit);

        return {
            data: paginatedData,
            total: data.length,
            limit,
            offset,
            hasMore: offset + limit < data.length,
        };
    }

    return entityRepository.findByType(countryCode, type, filters);
}

/**
 * Path Resolution Types
 */
export interface PathResolution {
    type: 'dashboard' | 'region' | 'person' | 'infrastructure' | 'category' | 'toll_roads_list' | 'toll_road' | 'not_found';
    entity?: Entity;
    category?: string;
    filters?: Filters;
    tollRoadSlug?: string;
}

/**
 * Resolve a URL path to determine what content to show
 */
export async function resolvePath(countryCode: string, pathSegments: string[]): Promise<PathResolution> {
    if (!pathSegments || pathSegments.length === 0) {
        return { type: 'dashboard' };
    }

    const [first, ...rest] = pathSegments;

    // Check if it's a known category
    if (first === 'region') {
        return { type: 'category', category: 'region' };
    }

    if (first === 'person') {
        if (rest.length > 0) {
            const person = await getPersonById(countryCode, rest[0]);
            if (person) {
                return { type: 'person', entity: person };
            }
        }
        return { type: 'category', category: 'person' };
    }

    if (first === 'infrastructure') {
        if (rest.length > 0) {
            // Toll roads section: /infrastructure/toll-roads and /infrastructure/toll-roads/[slug]
            if (rest[0] === 'toll-roads') {
                if (rest.length > 1) {
                    return { type: 'toll_road', tollRoadSlug: rest[1] };
                }
                return { type: 'toll_roads_list' };
            }
            // Check if second segment is a category or an entity
            const config = await countryRepository.getConfig(countryCode);
            if (config && config.infraCategories.includes(rest[0] as never)) {
                return {
                    type: 'category',
                    category: rest[0],
                    filters: rest.length > 1 ? { regionId: rest[1] } : undefined,
                };
            }
            const infra = await getInfrastructureById(countryCode, rest[0]);
            if (infra) {
                return { type: 'infrastructure', entity: infra };
            }
        }
        return { type: 'category', category: 'infrastructure' };
    }

    // Check if it's a region
    const region = await getRegionById(countryCode, first);
    if (region) {
        return { type: 'region', entity: region };
    }

    return { type: 'not_found' };
}
