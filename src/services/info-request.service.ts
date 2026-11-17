/**
 * Info Request (RTI) Service, read from the published record.
 */

import { getCountryData, InfoRequestData } from '@/lib/data/store';
import { InfoRequest } from '@/types';

export type { InfoRequestData };

export async function getInfoRequestData(countryCode: string): Promise<InfoRequestData | null> {
    return getCountryData(countryCode)?.infoRequests ?? null;
}

/** Requests linked to a region (by regionIds, falling back to tags). */
export async function getInfoRequestsByRegion(countryCode: string, regionSlug: string): Promise<InfoRequest[]> {
    const data = await getInfoRequestData(countryCode);
    if (!data || !data.config.enabled) return [];
    return data.requests.filter(req => req.regionIds?.includes(regionSlug) || req.tags?.includes(regionSlug));
}

export async function getAllInfoRequests(countryCode: string): Promise<InfoRequest[]> {
    const data = await getInfoRequestData(countryCode);
    if (!data || !data.config.enabled) return [];
    return data.requests;
}
