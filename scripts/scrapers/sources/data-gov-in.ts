/**
 * data.gov.in (Open Government Data platform) API client.
 *
 * SOURCE: https://data.gov.in - machine-readable datasets via
 *   https://api.data.gov.in/resource/{RESOURCE_ID}?api-key=...&format=json&limit=1000
 *
 * Requires a free API key: register at https://data.gov.in/user/register
 * then set DATA_GOV_IN_API_KEY in .env.local
 *
 * RELEVANT DATASETS (search "toll" on data.gov.in catalog):
 *   - Toll locations/rates on National Highways (MoRTH / NHAI)
 *   - Road transport statistics (annual revenue from tolls by state)
 *   - Bharatmala / NHDP project cost listings
 *
 * OUTPUT: raw dataset dump into data/in/toll-roads/_overlays/data-gov-in/{resource}.json
 *
 * USAGE: npx tsx scripts/scrapers/run-toll-roads.ts --source data-gov --resource <id>
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';
import { fetchJson } from '../lib/http';

config({ path: '.env.local' });

const API_BASE = 'https://api.data.gov.in/resource';
const OUT_DIR = join(process.cwd(), 'data', 'in', 'toll-roads', '_overlays', 'data-gov-in');

interface OgResponse {
    records?: Record<string, unknown>[];
    total?: number;
    count?: number;
}

export async function fetchResource(resourceId: string, limit = 1000): Promise<Record<string, unknown>[]> {
    const apiKey = process.env.DATA_GOV_IN_API_KEY;
    if (!apiKey) {
        throw new Error(
            'DATA_GOV_IN_API_KEY not set. Register free at https://data.gov.in/user/register and add it to .env.local'
        );
    }

    const records: Record<string, unknown>[] = [];
    let offset = 0;

    while (true) {
        const url = `${API_BASE}/${resourceId}?api-key=${apiKey}&format=json&limit=${Math.min(limit, 1000)}&offset=${offset}`;
        const data = await fetchJson<OgResponse>(url);
        const batch = data.records ?? [];
        records.push(...batch);
        offset += batch.length;
        if (batch.length === 0 || offset >= (data.total ?? 0)) break;
    }

    return records;
}

export async function run(resourceId?: string): Promise<void> {
    if (!resourceId) {
        console.error(
            '[data-gov] Provide --resource <dataset-id>. Browse https://www.data.gov.in/catalogs and copy the resource id from its API tab.'
        );
        process.exit(1);
    }

    console.log(`[data-gov] fetching resource ${resourceId}`);
    const records = await fetchResource(resourceId);
    mkdirSync(OUT_DIR, { recursive: true });
    const outPath = join(OUT_DIR, `${resourceId}.json`);
    writeFileSync(
        outPath,
        JSON.stringify({ source: 'data-gov-in', resourceId, fetchedAt: new Date().toISOString(), records }, null, 2)
    );
    console.log(`[data-gov] wrote ${records.length} records -> ${outPath}`);
}
