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
        return { entityId: region.id, entityType: 'region', name: region.name, metrics: [], highlights: [], quickLinks: [] };
    }

    if (!d.overview) throw new Error(`Country overview not found for: ${countryCode}`);
    return d.overview;
}

export async function isCountrySupported(countryCode: string): Promise<boolean> {
    return getCountryData(countryCode) !== null;
}
