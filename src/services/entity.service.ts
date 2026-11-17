/**
 * Entity Service
 *
 * Persons, infrastructure, regions and URL path resolution, read from the
 * published record (src/lib/data/store.ts).
 */

import { getCountryData, findEntity, inRegion } from '@/lib/data/store';
import { Entity, Person, Infrastructure, Region, Filters, PaginatedResponse } from '@/types';

function data(countryCode: string) {
    const d = getCountryData(countryCode);
    if (!d) throw new Error(`No published data for country: ${countryCode}`);
    return d;
}

export async function getPersons(countryCode: string): Promise<Person[]> {
    return data(countryCode).persons;
}

export async function getPersonById(countryCode: string, personId: string): Promise<Person | undefined> {
    return findEntity(data(countryCode).persons, personId);
}

export async function getInfrastructure(countryCode: string): Promise<Infrastructure[]> {
    return data(countryCode).infrastructure;
}

export async function getInfrastructureById(countryCode: string, infraId: string): Promise<Infrastructure | undefined> {
    return findEntity(data(countryCode).infrastructure, infraId);
}

export async function getRegions(countryCode: string): Promise<Region[]> {
    return data(countryCode).regions;
}

export async function getRegionById(countryCode: string, regionId: string): Promise<Region | undefined> {
    return findEntity(data(countryCode).regions, regionId);
}

/**
 * Entities of one type, filtered and paginated.
 */
export async function getEntities(
    countryCode: string,
    type: 'person' | 'infrastructure' | 'region',
    filters?: Filters
): Promise<PaginatedResponse<Entity>> {
    const d = data(countryCode);
    let list: Entity[] = type === 'person' ? d.persons : type === 'infrastructure' ? d.infrastructure : d.regions;

    if (filters?.role) {
        const role = filters.role;
        list = (list as Person[]).filter(p => p.role === role || p.roles?.includes(role));
    }
    if (filters?.category) {
        const category = filters.category;
        list = (list as Infrastructure[]).filter(i => i.category === category);
    }
    if (filters?.regionId) {
        list = inRegion(list as (Entity & { regionId?: string; regionIds?: string[] })[], filters.regionId);
    }
    if (filters?.search) {
        const q = filters.search.toLowerCase();
        list = list.filter(e => e.name.toLowerCase().includes(q) || e.description?.toLowerCase().includes(q));
    }

    const limit = filters?.limit || 20;
    const offset = filters?.offset || 0;
    return {
        data: list.slice(offset, offset + limit),
        total: list.length,
        limit,
        offset,
        hasMore: offset + limit < list.length,
    };
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

    if (first === 'region') {
        return { type: 'category', category: 'region' };
    }

    if (first === 'person') {
        if (rest.length > 0) {
            const person = await getPersonById(countryCode, rest[0]);
            if (person) return { type: 'person', entity: person };
            return { type: 'not_found' };
        }
        return { type: 'category', category: 'person' };
    }

    if (first === 'infrastructure') {
        if (rest.length > 0) {
            // /infrastructure/toll-roads and /infrastructure/toll-roads/[slug]
            if (rest[0] === 'toll-roads') {
                if (rest.length > 1) return { type: 'toll_road', tollRoadSlug: rest[1] };
                return { type: 'toll_roads_list' };
            }
            // /infrastructure/[category] and /infrastructure/[category]/[region]
            const config = data(countryCode).config;
            if (config.infraCategories.includes(rest[0] as never)) {
                return {
                    type: 'category',
                    category: rest[0],
                    filters: rest.length > 1 ? { regionId: rest[1] } : undefined,
                };
            }
            const infra = await getInfrastructureById(countryCode, rest[0]);
            if (infra) return { type: 'infrastructure', entity: infra };
            return { type: 'not_found' };
        }
        return { type: 'category', category: 'infrastructure' };
    }

    const region = await getRegionById(countryCode, first);
    // No sub-pages under a region yet: /in/maharashtra/anything is a 404, not the region page.
    if (region && rest.length === 0) return { type: 'region', entity: region };

    return { type: 'not_found' };
}
