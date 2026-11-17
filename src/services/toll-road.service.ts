/**
 * Toll Road Service
 *
 * Curated toll roads from data/<country>/toll-roads/*.json, read through the
 * published-record store (src/lib/data/store.ts).
 */

import { getCountryData } from '@/lib/data/store';
import { TollRoad, FundingComponent } from '@/types';

export async function getAllTollRoads(countryCode: string): Promise<TollRoad[]> {
    return getCountryData(countryCode)?.tollRoads ?? [];
}

export async function getTollRoadBySlug(countryCode: string, slug: string): Promise<TollRoad | undefined> {
    const roads = await getAllTollRoads(countryCode);
    return roads.find(r => r.slug === slug);
}

export async function getTollRoadsByRegion(countryCode: string, regionSlug: string): Promise<TollRoad[]> {
    const roads = await getAllTollRoads(countryCode);
    return roads.filter(r => r.regionIds.includes(regionSlug));
}

/**
 * Sum of funding components that have real values (ignores 0 placeholders
 * used for "value unknown / not monetary" entries like land grants).
 */
export function quantifiedFunding(road: TollRoad): FundingComponent[] {
    return (road.funding ?? []).filter(f => f.amount.value > 0);
}

export function formatMoney(value: number, currency = 'INR'): string {
    if (currency !== 'INR') return `${currency} ${value.toLocaleString('en-IN')}`;
    if (Math.abs(value) >= 1e7) return `₹${(value / 1e7).toFixed(value % 1e7 === 0 ? 0 : 2)} Cr`;
    if (Math.abs(value) >= 1e5) return `₹${(value / 1e5).toFixed(2)} L`;
    return `₹${value.toLocaleString('en-IN')}`;
}
