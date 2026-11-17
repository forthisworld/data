/**
 * Toll Road Service
 *
 * Reads curated toll-road datasets from data/<country>/toll-roads/*.json.
 * File-based (like the info-request service) so it works without MongoDB;
 * the seed script mirrors this data into the toll_roads collection.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { TollRoad, FundingComponent } from '@/types';

export async function getAllTollRoads(countryCode: string): Promise<TollRoad[]> {
    const dir = path.join(process.cwd(), 'data', countryCode, 'toll-roads');
    try {
        const files = (await fs.readdir(dir))
            .filter(f => f.endsWith('.json') && !f.startsWith('_'))
            .sort();
        const roads = await Promise.all(
            files.map(async f => {
                const content = await fs.readFile(path.join(dir, f), 'utf-8');
                return JSON.parse(content) as TollRoad;
            })
        );
        return roads;
    } catch {
        return [];
    }
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
