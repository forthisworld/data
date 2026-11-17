/**
 * Country Service
 *
 * Country configs and overviews, read from the published record
 * (src/lib/data/store.ts).
 */

import { getCountryData, findEntity } from '@/lib/data/store';
import { CountryConfig, Overview } from '@/types';

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

/**
 * One entry per region that has a page, with how much is published for it.
 * Keyed by slug, which matches the map's boundary files.
 */
export async function getMapRegions(countryCode: string): Promise<Record<string, { slug: string; name: string; tollRoads: number; people: number }>> {
    const d = getCountryData(countryCode);
    if (!d) return {};
    const linked = (e: { regionId?: string; regionIds?: string[] }, id: string) => e.regionId === id || (e.regionIds ?? []).includes(id);
    return Object.fromEntries(
        d.regions.map(r => [
            r.slug,
            {
                slug: r.slug,
                name: r.name,
                tollRoads: d.tollRoads.filter(t => linked(t, r.id)).length,
                people: d.persons.filter(p => linked(p, r.id)).length,
            },
        ])
    );
}

export async function isCountrySupported(countryCode: string): Promise<boolean> {
    return getCountryData(countryCode) !== null;
}
