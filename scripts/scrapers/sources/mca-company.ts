/**
 * Ministry of Corporate Affairs (MCA) company-data adapter.
 *
 * WHY MCA MATTERS: toll revenue and project costs for private concessionaires
 * (NICE Ltd, Noida Toll Bridge Company Ltd) are legally disclosed through
 * annual financial statements filed with MCA. This is the single most
 * authoritative source for "how much money went in / came out" on state PPP
 * toll roads that don't publish revenue.
 *
 * HOW MCA ACCESS WORKS (as of 2025):
 *   - Company Master Data (name, CIN, status, capital) is free at
 *       https://www.mca.gov.in/mcafoportal/viewCompanyMasterData.do
 *     but is captcha-gated, so we generate deep links instead of scraping.
 *   - Full financial statements (balance sheet, P&L) are pay-per-document
 *     (~Rs 100/doc) via "View Public Documents" on the V3 portal.
 *   - LISTED companies (e.g., NTBCL on BSE) publish the same statements free
 *     on BSE/NSE - prefer those when available.
 *
 * OUTPUT: data/in/toll-roads/_overlays/mca/lookup-links.json
 *
 * USAGE: npx tsx scripts/scrapers/run-toll-roads.ts --source mca
 */

import { writeFileSync, mkdirSync, existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const OUT_DIR = join(process.cwd(), 'data', 'in', 'toll-roads', '_overlays', 'mca');

interface McaLookup {
    roadSlug: string;
    company: string;
    cin?: string;
    masterDataUrl: string;
    publicDocumentsUrl: string;
    instructions: string[];
}

function loadCompanies(): { slug: string; company?: string; cin?: string }[] {
    const dir = join(process.cwd(), 'data', 'in', 'toll-roads');
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
        .filter(f => f.endsWith('.json') && !f.startsWith('_'))
        .map(f => {
            const data = JSON.parse(readFileSync(join(dir, f), 'utf-8'));
            return { slug: data.slug, company: data.operatorCompany, cin: data.cin };
        })
        .filter(r => r.company);
}

export function buildLookup(road: { slug: string; company?: string; cin?: string }): McaLookup | null {
    if (!road.company) return null;
    const cinQuery = road.cin ? `&cin=${road.cin}` : '';
    return {
        roadSlug: road.slug,
        company: road.company,
        cin: road.cin,
        masterDataUrl: `https://www.mca.gov.in/mcafoportal/viewCompanyMasterData.do${cinQuery}`,
        publicDocumentsUrl: 'https://www.mca.gov.in/bin/mca/viewpublicdocuments',
        instructions: [
            '1. Open masterDataUrl and solve the captcha to confirm CIN, registered address and capital.',
            '2. Use publicDocumentsUrl, search by CIN, and purchase the latest 2-3 annual reports (AOC-4 / financial statements).',
            '3. Extract: total income, toll revenue line, interest/finance cost, accumulated reserves, related-party transactions.',
            '4. Record findings as FundingComponent / TollRevenueYear entries in the curated JSON with sourceId "mca-filings".',
        ],
    };
}

export async function run(): Promise<void> {
    mkdirSync(OUT_DIR, { recursive: true });
    const lookups = loadCompanies().map(buildLookup).filter((x): x is McaLookup => x !== null);
    const outPath = join(OUT_DIR, 'lookup-links.json');
    writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), lookups }, null, 2));
    console.log(`[mca] wrote ${lookups.length} company lookups -> ${outPath}`);
}
