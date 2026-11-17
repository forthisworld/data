/**
 * Country Service
 *
 * Country configs and overviews, read from the published record
 * (src/lib/data/store.ts).
 */

import { getCountryData, findEntity } from '@/lib/data/store';
import { CountryConfig, LegislatureSeat, MpladsRecord, MpladsSeat, Overview, Person, SourceCitation, TollRoad } from '@/types';

export async function getCountryConfig(countryCode: string): Promise<CountryConfig> {
    const d = getCountryData(countryCode);
    if (!d) throw new Error(`Country configuration not found for: ${countryCode}`);
    return d.config;
}

/**
 * Overview for a country, or for a region when regionPath is given.
 * A region without an overview file gets an empty overview (no metrics).
 */
export async function getOverview(countryCode: string, regionPath?: string[]): Promise<Overview> {
    const d = getCountryData(countryCode);
    if (!d) throw new Error(`Country not found: ${countryCode}`);

    if (regionPath && regionPath.length > 0) {
        const slug = regionPath[regionPath.length - 1];
        const overview = d.regionOverviews[slug];
        if (overview) return overview;
        const region = findEntity(d.regions, slug);
        if (!region) throw new Error(`Region not found: ${regionPath.join('/')}`);
        // No overview file: show the region's own sourced facts.
        const src = region.sources?.[0];
        const metrics: Overview['metrics'] =
            region.population && src
                ? [{
                      key: 'population',
                      label: 'Population',
                      value: region.population,
                      year: region.populationAsOf?.match(/\d{4}/)?.[0],
                      source: src.title.startsWith('Census') ? 'Census of India 2011, Primary Census Abstract' : src.title,
                      sourceUrl: src.url,
                  }]
                : [];
        return { entityId: region.id, entityType: 'region', name: region.name, metrics, highlights: [], quickLinks: [] };
    }

    if (!d.overview) throw new Error(`Country overview not found for: ${countryCode}`);
    return d.overview;
}

export interface AtlasRegion {
    slug: string;
    name: string;
    level: string;
    capital?: string;
    population?: number;
    populationAsOf?: string;
    populationSource?: { title: string; url?: string };
    tollRoads: { slug: string; name: string; tolling?: 'tolled' | 'toll_free' }[];
    people: { slug: string; name: string; role: string }[];
}

/**
 * What the atlas shows for each region that has a page, keyed by slug (which
 * matches the map's boundary files). Only published, sourced facts.
 */
export async function getAtlasRegions(countryCode: string): Promise<Record<string, AtlasRegion>> {
    const d = getCountryData(countryCode);
    if (!d) return {};
    const linked = (e: { regionId?: string; regionIds?: string[] }, id: string) => e.regionId === id || (e.regionIds ?? []).includes(id);
    return Object.fromEntries(
        d.regions.map(r => {
            const src = r.sources?.[0];
            return [
                r.slug,
                {
                    slug: r.slug,
                    name: r.name,
                    level: r.level,
                    capital: r.capital,
                    population: src ? r.population : undefined,
                    populationAsOf: src ? r.populationAsOf : undefined,
                    populationSource: src ? { title: src.title, url: src.url } : undefined,
                    tollRoads: d.tollRoads.filter(t => linked(t, r.id)).map(t => ({ slug: t.slug, name: t.name, tolling: t.tolling?.status })),
                    people: d.persons.filter(p => linked(p, r.id)).map(p => ({ slug: p.slug, name: p.name, role: p.role })),
                } satisfies AtlasRegion,
            ];
        })
    );
}

/**
 * Everything the atlas needs to work on its own (search, panel, offline): the
 * regions, and the full published road and people records. Small for now; split
 * per state and load on demand once it grows.
 */
export interface AtlasData {
    regions: Record<string, AtlasRegion>;
    roads: TollRoad[];
    people: Person[];
    /** Who holds each Lok Sabha seat (data/in/representatives). */
    lokSabha: HouseData | null;
    /** State assemblies we have, by state slug. */
    assemblies: Record<string, HouseData>;
    /** MPLADS for the current Lok Sabha, by seat id. */
    mplads: { term: number; asOf: string; source: SourceCitation; totals: MpladsRecord['totals']; bySeat: Record<string, Omit<MpladsSeat, 'seat' | 'sourceId'>>; worksStates: string[] } | null;
}

/** A house's seats for the atlas; every seat cites the same list, so the source is sent once. */
export interface HouseData { house: string; term: number; asOf: string; source: SourceCitation; seats: Omit<LegislatureSeat, 'sourceId'>[] }

function houseData(l: { house: string; term: number; asOf: string; sources: SourceCitation[]; seats: LegislatureSeat[] }): HouseData {
    return { house: l.house, term: l.term, asOf: l.asOf, source: l.sources[0], seats: l.seats.map(seat => { const { sourceId, ...rest } = seat; void sourceId; return rest; }) };
}

export async function getAtlasData(countryCode: string): Promise<AtlasData> {
    const d = getCountryData(countryCode);
    const ls = d?.legislatures.find(l => l.house === 'Lok Sabha');
    const mp = d?.mplads.find(m => m.house === 'Lok Sabha' && m.term === ls?.term);
    return {
        regions: await getAtlasRegions(countryCode),
        roads: d?.tollRoads ?? [],
        people: d?.persons ?? [],
        // Every seat cites the same member list, so it is sent once.
        lokSabha: ls ? houseData(ls) : null,
        mplads: mp ? {
            term: mp.term, asOf: mp.asOf, source: mp.sources[0], totals: mp.totals,
            bySeat: Object.fromEntries(mp.seats.map(({ seat, sourceId, ...rest }) => { void sourceId; return [seat, rest]; })),
            // States with a per-work list in public/data/mplads (scripts/fetch-mplads.mjs WORK_STATES).
            worksStates: ['karnataka'],
        } : null,
        assemblies: Object.fromEntries((d?.legislatures ?? []).filter(l => l.state).map(l => [l.state!, houseData(l)])),
    };
}

export async function isCountrySupported(countryCode: string): Promise<boolean> {
    return getCountryData(countryCode) !== null;
}
