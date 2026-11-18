/**
 * The published record, read from data/<country>/ (see data/SOURCING.md).
 *
 * Data is bundled at build time through files.generated.ts, so nothing here
 * touches the filesystem or a database at request time (meant to let the site
 * run on Cloudflare Workers; not yet tested there). Everything is a
 * plain, synchronous lookup.
 */

import { dataFiles } from './files.generated';
import type {
    CountryConfig,
    Entity,
    Infrastructure,
    InfoRequest,
    InfoRequestConfig,
    InfoRequestStats,
    InfoRequestTarget,
    Overview,
    Person,
    Region,
    TollRoad,
    ElectionHistoryRecord,
    Legislature,
    LocalBody,
    MpladsRecord,
} from '@/types';

export interface InfoRequestData {
    config: InfoRequestConfig;
    requests: InfoRequest[];
    targets: InfoRequestTarget[];
    stats: InfoRequestStats;
}

export interface CountryData {
    code: string;
    config: CountryConfig;
    overview: Overview | null;
    regions: Region[];
    regionOverviews: Record<string, Overview>;
    persons: Person[];
    infrastructure: Infrastructure[];
    tollRoads: TollRoad[];
    legislatures: Legislature[];
    mplads: MpladsRecord[];
    localBodies: LocalBody[];
    elections: ElectionHistoryRecord[];
    infoRequests: InfoRequestData | null;
}

const byCountry = new Map<string, CountryData>();

function build(code: string): CountryData | null {
    const prefix = `${code}/`;
    const entries = Object.entries(dataFiles).filter(([p]) => p.startsWith(prefix));
    const config = dataFiles[`${prefix}config.json`] as CountryConfig | undefined;
    if (!config) return null;

    const data: CountryData = {
        code,
        config,
        overview: (dataFiles[`${prefix}overview.json`] as Overview | undefined) ?? null,
        regions: [],
        regionOverviews: {},
        persons: [],
        infrastructure: [],
        tollRoads: [],
        legislatures: [],
        mplads: [],
        localBodies: [],
        elections: [],
        infoRequests: (dataFiles[`${prefix}info-requests.json`] as InfoRequestData | undefined) ?? null,
    };

    for (const [path, json] of entries) {
        const rel = path.slice(prefix.length);
        if (rel.startsWith('toll-roads/')) {
            data.tollRoads.push(json as TollRoad);
        } else if (rel.startsWith('mplads/')) {
            data.mplads.push(json as MpladsRecord);
        } else if (rel.startsWith('elections/')) {
            data.elections.push(json as ElectionHistoryRecord);
        } else if (rel.startsWith('local-bodies/')) {
            data.localBodies.push(json as LocalBody);
        } else if (rel.startsWith('representatives/')) {
            data.legislatures.push(json as Legislature);
        } else if (rel.startsWith('regions/')) {
            const m = rel.match(/^regions\/([^/]+)\/overview\.json$/);
            if (m) data.regionOverviews[m[1]] = json as Overview;
            else if (Array.isArray(json)) data.regions.push(...(json as Region[]));
        } else if (rel.startsWith('entities/') && Array.isArray(json)) {
            for (const e of json as Entity[]) {
                if (e.type === 'person') data.persons.push(e as Person);
                else if (e.type === 'infrastructure') data.infrastructure.push(e as Infrastructure);
                else if (e.type === 'region') data.regions.push(e as Region);
            }
        }
    }

    const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
    data.regions.sort(byName);
    data.persons.sort(byName);
    data.infrastructure.sort(byName);
    data.tollRoads.sort((a, b) => a.slug.localeCompare(b.slug));
    return data;
}

/** All data for a country, or null if the country isn't published. */
export function getCountryData(code: string): CountryData | null {
    if (!byCountry.has(code)) {
        const d = build(code);
        if (!d) return null;
        byCountry.set(code, d);
    }
    return byCountry.get(code)!;
}

/** Country codes with published data. */
export function listCountries(): string[] {
    return [...new Set(Object.keys(dataFiles).map(p => p.split('/')[0]))].sort();
}

/** Find an entity by id or slug. */
export function findEntity<T extends Entity>(list: T[], idOrSlug: string): T | undefined {
    return list.find(e => e.id === idOrSlug || e.slug === idOrSlug);
}

/** Entities linked to a region through regionId or regionIds. */
export function inRegion<T extends { regionId?: string; regionIds?: string[] }>(list: T[], regionId: string): T[] {
    return list.filter(e => e.regionId === regionId || e.regionIds?.includes(regionId));
}
