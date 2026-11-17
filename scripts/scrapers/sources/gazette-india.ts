/**
 * Gazette of India / State Gazette source adapters.
 *
 * WHY THE GAZETTE MATTERS: every toll in India exists only because of a
 * notification in an official gazette (central or state). Toll rates, toll
 * extensions and cesses all appear there FIRST, before any website. For
 * state PPP roads like NICE, the Karnataka Gazette holds the concession
 * and toll notification history.
 *
 * PORTALS:
 *   Central:  https://egazette.gov.in        (Gazette of India, searchable)
 *   Karnataka: https://gazette.karnataka.gov.in  (part-I/II/IV notifications)
 *   UP:       https://gazette.up.gov.in
 *   Maharashtra: https://gazette.maharashtra.gov.in
 *
 * REALITY CHECK: most gazette portals are ASP.NET apps with session-based
 * search and PDF-only results, so full automation is brittle. This adapter:
 *   1. builds precise search deep-links for each toll road (for manual/LLM review)
 *   2. scrapes the central eGazette search results page where possible
 *   3. records candidate notification URLs into an overlay for human curation
 *
 * OUTPUT: data/in/toll-roads/_overlays/gazette/candidates.json
 *
 * USAGE: npx tsx scripts/scrapers/run-toll-roads.ts --source gazette
 */

import { writeFileSync, mkdirSync, existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { fetchText } from '../lib/http';

const OUT_DIR = join(process.cwd(), 'data', 'in', 'toll-roads', '_overlays', 'gazette');

interface GazetteCandidate {
    roadSlug: string;
    portal: string;
    searchUrl: string;
    query: string;
    note: string;
}

function loadCuratedRoads(): { slug: string; name: string; keywords: string[] }[] {
    const dir = join(process.cwd(), 'data', 'in', 'toll-roads');
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
        .filter(f => f.endsWith('.json') && !f.startsWith('_'))
        .map(f => {
            const data = JSON.parse(readFileSync(join(dir, f), 'utf-8'));
            return {
                slug: data.slug,
                name: data.officialName || data.name,
                keywords: [data.name, data.operatorCompany].filter(Boolean) as string[],
            };
        });
}

export function buildSearchLinks(road: { slug: string; name: string; keywords: string[] }): GazetteCandidate[] {
    const q = road.keywords.map(encodeURIComponent).join('+');
    return [
        {
            roadSlug: road.slug,
            portal: 'egazette.gov.in (Central)',
            searchUrl: `https://egazette.gov.in/(S(xynz1jj4xjy1xq4544q4z455))/Search.aspx?query=${q}`,
            query: road.keywords.join(' '),
            note: 'Use the simple-search UI if the session URL fails; search year-wise PDFs for toll notifications.',
        },
        {
            roadSlug: road.slug,
            portal: 'Karnataka Gazette',
            searchUrl: 'https://gazette.karnataka.gov.in',
            query: road.keywords.join(' '),
            note: 'State gazettes publish toll notifications under Part-II/III; browse by year and search within PDFs.',
        },
    ];
}

/**
 * Attempt to scrape central eGazette search results. Returns [] when the
 * portal blocks non-session requests (common) - callers should fall back to
 * the generated deep-links for manual review.
 */
export async function scrapeCentralSearch(query: string): Promise<{ title: string; url: string }[]> {
    try {
        const html = await fetchText(`https://egazette.gov.in/SearchResults.aspx?query=${encodeURIComponent(query)}`, {
            retries: 1,
            timeoutMs: 15000,
        });
        const results: { title: string; url: string }[] = [];
        const linkRe = /<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;
        for (const m of html.matchAll(linkRe)) {
            results.push({ title: m[2].replace(/<[^>]+>/g, '').trim(), url: new URL(m[1], 'https://egazette.gov.in/').toString() });
        }
        return results;
    } catch (err) {
        console.warn(`[gazette] central search unavailable (${(err as Error).message}); emitting deep-links only.`);
        return [];
    }
}

export async function run(): Promise<void> {
    const roads = loadCuratedRoads();
    mkdirSync(OUT_DIR, { recursive: true });

    const candidates: (GazetteCandidate & { scrapedResults?: { title: string; url: string }[] })[] = [];
    for (const road of roads) {
        const links = buildSearchLinks(road);
        const scraped = await scrapeCentralSearch(road.name);
        candidates.push(...links.map(l => ({ ...l, scrapedResults: scraped })));
        console.log(`[gazette] ${road.slug}: ${links.length} deep-links, ${scraped.length} scraped results`);
    }

    const outPath = join(OUT_DIR, 'candidates.json');
    writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), candidates }, null, 2));
    console.log(`[gazette] wrote candidates -> ${outPath}`);
}
