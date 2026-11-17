/**
 * NHAI Toll Information System (TIS) scraper.
 *
 * SOURCE: https://tis.nhai.gov.in - official toll plaza list, rates and
 * exemptions for all NHAI-operated toll roads. Each plaza has a page like
 *   https://tis.nhai.gov.in/TollInformation.aspx?TollPlazaID={id}
 *
 * COVERAGE NOTE: TIS only covers NATIONAL highway tolls operated/oversen by
 * NHAI. State PPP roads (like NICE Road, Bengaluru) and state-authority roads
 * (like DND Flyway) are NOT in TIS - for those use gazette + RTI + MCA sources.
 *
 * STRATEGY:
 *   1. Probe TollPlazaID=1..N (IDs are sequential; stop after a run of misses)
 *   2. Parse the per-plaza tables: name, location, NH number, state,
 *      fee rates by vehicle class, effective date
 *   3. Write an overlay file keyed by plaza name for the merge step
 *
 * OUTPUT: data/in/toll-roads/_overlays/nhai-tis/plazas.json
 *
 * USAGE: npx tsx scripts/scrapers/run-toll-roads.ts --source nhai-tis [--max-id 1200]
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { fetchText, extractTables, sleep } from '../lib/http';
import { parseIndianMoney, parseIndianDate } from '../lib/format';

const TIS_BASE = 'https://tis.nhai.gov.in';
const OUT_DIR = join(process.cwd(), 'data', 'in', 'toll-roads', '_overlays', 'nhai-tis');

export interface ScrapedPlaza {
    nhaiTisId: number;
    name?: string;
    location?: string;
    state?: string;
    nhNumber?: string;
    rates: { vehicleClass: string; feeInRupees: number | null; rawFee: string }[];
    effectiveDate?: string;
    url: string;
}

/** Parse one TollInformation.aspx page into structured data. */
export function parsePlazaPage(html: string, tisId: number): ScrapedPlaza {
    const tables = extractTables(html);
    const plaza: ScrapedPlaza = { nhaiTisId: tisId, rates: [], url: `${TIS_BASE}/TollInformation.aspx?TollPlazaID=${tisId}` };

    for (const table of tables) {
        for (const row of table) {
            const joined = row.join(' | ');
            // Header-ish rows carry the plaza name / location
            if (!plaza.name && /toll\s*plaza/i.test(joined) && joined.length < 200) {
                plaza.name = row[0]?.replace(/^.*?plaza[:\s]*/i, '').trim() || undefined;
            }
            if (!plaza.nhNumber) {
                const nh = joined.match(/\bNH\s*[-–]?\s*(\d+[A-Z]?)/i);
                if (nh) plaza.nhNumber = `NH-${nh[1]}`;
            }
            // Fee rows look like: [Vehicle class, Single trip fee, Return fee, ...]
            if (row.length >= 2 && /(car|jeep|van|lcv|truck|bus|multi.?axle|heavy)/i.test(row[0])) {
                const fee = parseIndianMoney(row[1]);
                plaza.rates.push({
                    vehicleClass: row[0].trim(),
                    feeInRupees: fee?.valueInRupees ?? null,
                    rawFee: row[1],
                });
            }
            if (!plaza.effectiveDate) {
                const eff = joined.match(/effective\s*(?:from)?[:\s]*([0-9]{1,2}\s*\w+\s*[0-9]{4}|[0-9]{4}-[0-9]{2}-[0-9]{2})/i);
                if (eff) plaza.effectiveDate = parseIndianDate(eff[1]) ?? undefined;
            }
        }
    }
    return plaza;
}

export async function run(maxId = 1200, missLimit = 25): Promise<ScrapedPlaza[]> {
    const plazas: ScrapedPlaza[] = [];
    let consecutiveMisses = 0;

    for (let id = 1; id <= maxId; id++) {
        const url = `${TIS_BASE}/TollInformation.aspx?TollPlazaID=${id}`;
        try {
            const html = await fetchText(url, { timeoutMs: 20000 });
            if (/no\s*(?:such|record|information)/i.test(html) && html.length < 5000) {
                throw new Error('empty page');
            }
            const plaza = parsePlazaPage(html, id);
            if (plaza.name || plaza.rates.length > 0) {
                plazas.push(plaza);
                console.log(`[nhai-tis] #${id}: ${plaza.name ?? '?'} (${plaza.nhNumber ?? 'NH?'}) - ${plaza.rates.length} rate rows`);
                consecutiveMisses = 0;
            } else {
                throw new Error('unparsed page');
            }
        } catch (err) {
            consecutiveMisses++;
            console.warn(`[nhai-tis] #${id} skipped: ${(err as Error).message}`);
            if (consecutiveMisses >= missLimit) {
                console.warn(`[nhai-tis] ${missLimit} consecutive misses - stopping at id ${id}`);
                break;
            }
        }
        await sleep(1200); // be polite to a government server
    }

    mkdirSync(OUT_DIR, { recursive: true });
    const outPath = join(OUT_DIR, 'plazas.json');
    writeFileSync(
        outPath,
        JSON.stringify({ source: 'nhai-tis', fetchedAt: new Date().toISOString(), plazas }, null, 2)
    );
    console.log(`[nhai-tis] wrote ${plazas.length} plazas -> ${outPath}`);
    return plazas;
}
