/**
 * Search Service
 *
 * Searches regions, people, infrastructure and toll roads in the published
 * record. The record is small and bundled with the site, so this is an
 * in-memory scan; swap in an index (Pagefind, Postgres FTS) when it grows.
 */

import { getCountryData, findEntity } from '@/lib/data/store';
import { SearchResult } from '@/types';

/**
 * Search across all entity types.
 * @param regionSlug - optional: only results linked to this region
 */
export async function searchAll(countryCode: string, query: string, regionSlug?: string): Promise<SearchResult[]> {
    if (!query || query.length < 2) return [];
    const d = getCountryData(countryCode);
    if (!d) return [];

    const q = query.toLowerCase();
    const matches = (...fields: (string | undefined)[]) => fields.some(f => f?.toLowerCase().includes(q));
    const region = regionSlug ? findEntity(d.regions, regionSlug) : undefined;
    const inScope = (e: { regionId?: string; regionIds?: string[] }) =>
        !region || e.regionId === region.id || (e.regionIds ?? []).includes(region.id);

    const results: SearchResult[] = [];

    if (!region) {
        for (const r of d.regions) {
            if (!matches(r.name, r.capital, r.code)) continue;
            results.push({
                id: r.id, type: 'region', name: r.name, slug: r.slug,
                description: r.level === 'union_territory' ? 'Union territory' : r.level === 'state' ? 'State' : r.level,
                path: `/${countryCode}/${r.slug}`, score: score(r.name, q),
            });
        }
    }

    for (const p of d.persons) {
        if (!inScope(p) || !matches(p.name, p.description, p.party, p.constituency)) continue;
        results.push({
            id: p.id, type: 'person', name: p.name, slug: p.slug,
            description: [p.role.toUpperCase(), p.party, p.constituency].filter(Boolean).join(' · '),
            path: `/${countryCode}/person/${p.slug}`, score: score(p.name, q),
        });
    }

    for (const i of d.infrastructure) {
        if (!inScope(i) || !matches(i.name, i.description, i.operator)) continue;
        results.push({
            id: i.id, type: 'infrastructure', name: i.name, slug: i.slug, description: i.category,
            path: `/${countryCode}/infrastructure/${i.slug}`, score: score(i.name, q),
        });
    }

    for (const t of d.tollRoads) {
        if (!inScope(t) || !matches(t.name, t.officialName, t.operatorCompany, t.concession?.operator)) continue;
        results.push({
            id: t.id, type: 'infrastructure', name: t.name, slug: t.slug,
            description: t.tolling?.status === 'toll_free' ? 'Toll road (now toll-free)' : 'Toll road',
            path: `/${countryCode}/infrastructure/toll-roads/${t.slug}`, score: score(t.name, q),
        });
    }

    return results.sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 20);
}

/** Higher is better: exact > prefix > word start > anywhere. */
function score(name: string, q: string): number {
    const n = name.toLowerCase();
    if (n === q) return 1.0;
    if (n.startsWith(q)) return 0.9;
    if (n.includes(` ${q}`) || n.includes(`(${q}`)) return 0.7;
    if (n.includes(q)) return 0.5;
    return 0.3;
}

export async function getSearchSuggestions(countryCode: string, query: string, limit = 5): Promise<string[]> {
    return (await searchAll(countryCode, query)).slice(0, limit).map(r => r.name);
}
