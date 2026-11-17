/**
 * Toll-road data pipeline runner.
 *
 * Pipeline:  curated JSON (data/in/toll-roads/*.json)   <- human-reviewed, cited
 *            + overlays from source adapters (_overlays/<source>/...)
 *            -> merged output (_merged/<slug>.json)      <- review, then promote
 *
 * USAGE:
 *   npx tsx scripts/scrapers/run-toll-roads.ts --source all
 *   npx tsx scripts/scrapers/run-toll-roads.ts --source nhai-tis --max-id 300
 *   npx tsx scripts/scrapers/run-toll-roads.ts --source data-gov --resource <id>
 *   npx tsx scripts/scrapers/run-toll-roads.ts --validate
 */

import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';
import { TollRoad } from '../../src/types';
import * as nhaiTis from './sources/nhai-tis';
import * as dataGov from './sources/data-gov-in';
import * as gazette from './sources/gazette-india';
import * as mca from './sources/mca-company';

config({ path: '.env.local' });

const ROADS_DIR = join(process.cwd(), 'data', 'in', 'toll-roads');
const MERGED_DIR = join(ROADS_DIR, '_merged');

function loadCurated(): TollRoad[] {
    if (!existsSync(ROADS_DIR)) return [];
    return readdirSync(ROADS_DIR)
        .filter(f => f.endsWith('.json') && !f.startsWith('_'))
        .map(f => JSON.parse(readFileSync(join(ROADS_DIR, f), 'utf-8')) as TollRoad);
}

// --------------------------------------------
// Validation
// --------------------------------------------

function validateRoad(road: TollRoad): string[] {
    const errors: string[] = [];

    if (!road.id || !road.slug || !road.name) errors.push('missing id/slug/name');
    if (!Array.isArray(road.regionIds) || road.regionIds.length === 0) errors.push('regionIds required');
    if (!Array.isArray(road.sources) || road.sources.length === 0) errors.push('at least one source citation required');

    if (road.projectCost && road.funding?.length) {
        const fundingTotal = road.funding.reduce((sum, f) => sum + (f.amount.value || 0), 0);
        // Only warn when components are fully populated (no zero placeholders)
        const hasPlaceholders = road.funding.some(f => f.amount.value === 0);
        if (!hasPlaceholders && Math.abs(fundingTotal - road.projectCost.value) / road.projectCost.value > 0.15) {
            errors.push(
                `funding components sum to ${fundingTotal} but projectCost is ${road.projectCost.value} (>15% mismatch)`
            );
        }
    }

    for (const s of road.sources ?? []) {
        if (!s.id || !s.title || !s.publisher) errors.push(`source ${s.id || '?'} missing id/title/publisher`);
    }

    return errors;
}

// --------------------------------------------
// Merge overlays into curated data
// --------------------------------------------

function mergeOverlays(road: TollRoad): { merged: TollRoad; changes: string[] } {
    const merged: TollRoad = structuredClone(road);
    const changes: string[] = [];

    // NHAI TIS overlay: match plazas by name to attach scraped rates
    const tisPath = join(ROADS_DIR, '_overlays', 'nhai-tis', 'plazas.json');
    if (existsSync(tisPath)) {
        const { plazas } = JSON.parse(readFileSync(tisPath, 'utf-8')) as { plazas: nhaiTis.ScrapedPlaza[] };
        for (const plaza of merged.plazas ?? []) {
            const match = plazas.find(p =>
                p.name && plaza.name &&
                p.name.toLowerCase().includes(plaza.name.toLowerCase().split(' ')[0])
            );
            if (match && match.rates.length > 0 && !plaza.nhaiTisId) {
                plaza.nhaiTisId = String(match.nhaiTisId);
                changes.push(`linked plaza "${plaza.name}" to TIS id ${match.nhaiTisId}`);
                if (match.rates.length > 0 && (merged.currentRates ?? []).length === 0) {
                    merged.currentRates = match.rates.map(r => ({
                        vehicleClass: r.vehicleClass,
                        amount: { value: r.feeInRupees ?? 0, currency: 'INR', note: `Scraped from NHAI TIS (${match.effectiveDate ?? 'date unknown'})` },
                        trip: 'single' as const,
                    }));
                    changes.push(`populated currentRates from TIS`);
                }
            }
        }
    }

    return { merged, changes };
}

// --------------------------------------------
// Main
// --------------------------------------------

async function main(): Promise<void> {
    const args = process.argv.slice(2);
    const getArg = (name: string): string | undefined => {
        const i = args.indexOf(`--${name}`);
        return i >= 0 ? args[i + 1] : undefined;
    };
    const source = getArg('source') ?? 'all';

    if (args.includes('--validate')) {
        const roads = loadCurated();
        let failed = false;
        for (const road of roads) {
            const errors = validateRoad(road);
            if (errors.length) {
                failed = true;
                console.error(`✗ ${road.slug}:`);
                errors.forEach(e => console.error(`   - ${e}`));
            } else {
                console.log(`✓ ${road.slug} valid`);
            }
        }
        process.exit(failed ? 1 : 0);
    }

    switch (source) {
        case 'nhai-tis':
            await nhaiTis.run(Number(getArg('max-id') ?? 1200));
            break;
        case 'data-gov':
            await dataGov.run(getArg('resource'));
            break;
        case 'gazette':
            await gazette.run();
            break;
        case 'mca':
            await mca.run();
            break;
        case 'all':
            await gazette.run();
            await mca.run();
            console.log('[run] nhai-tis and data-gov need network/API keys; run them individually when ready.');
            break;
        default:
            console.error(`Unknown source: ${source}`);
            process.exit(1);
    }

    // Merge step: always produce _merged outputs for review
    mkdirSync(MERGED_DIR, { recursive: true });
    for (const road of loadCurated()) {
        const errors = validateRoad(road);
        if (errors.length) {
            console.warn(`[merge] skipping ${road.slug} (invalid): ${errors.join('; ')}`);
            continue;
        }
        const { merged, changes } = mergeOverlays(road);
        merged.lastVerified = new Date().toISOString().slice(0, 10);
        writeFileSync(join(MERGED_DIR, `${road.slug}.json`), JSON.stringify(merged, null, 2));
        console.log(`[merge] ${road.slug}: ${changes.length} change(s)${changes.length ? ' -> ' + changes.join('; ') : ''}`);
    }

    console.log('\nDone. Review _merged/ then copy files back over the curated JSONs.');
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
