import { NextRequest, NextResponse } from 'next/server';
import { getCountryData } from '@/lib/data/store';

/**
 * Read-only research API over the published record.
 *
 * Lets the FTW Research Tool query the same data the site shows. Guarded by a
 * shared secret in .env.local:
 *   RESEARCH_API_TOKEN=<random string>
 *
 * Body: { country?: "in", collection, filter?: { field: value }, limit? }
 * A filter matches when every field equals the value, or (for array fields)
 * contains it. No writes.
 */

const COLLECTIONS = ['entities', 'regions', 'countries', 'info_requests', 'toll_roads'] as const;
type Collection = (typeof COLLECTIONS)[number];

function rows(country: string, collection: Collection): Record<string, unknown>[] {
    const d = getCountryData(country);
    if (!d) return [];
    switch (collection) {
        case 'entities': return [...d.persons, ...d.infrastructure] as unknown as Record<string, unknown>[];
        case 'regions': return d.regions as unknown as Record<string, unknown>[];
        case 'countries': return [d.config as unknown as Record<string, unknown>];
        case 'info_requests': return (d.infoRequests?.requests ?? []) as unknown as Record<string, unknown>[];
        case 'toll_roads': return d.tollRoads as unknown as Record<string, unknown>[];
    }
}

function matches(doc: Record<string, unknown>, filter: Record<string, unknown>): boolean {
    return Object.entries(filter).every(([k, v]) => {
        const field = doc[k];
        return Array.isArray(field) ? field.includes(v) : field === v;
    });
}

export async function POST(req: NextRequest) {
    const token = req.headers.get('x-research-token');
    const expected = process.env.RESEARCH_API_TOKEN;
    if (!expected) {
        return NextResponse.json({ error: 'Research API disabled - set RESEARCH_API_TOKEN in .env.local to enable' }, { status: 503 });
    }
    if (!token || token !== expected) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: { country?: string; collection?: string; filter?: Record<string, unknown>; limit?: number };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const collection = body.collection as Collection;
    if (!COLLECTIONS.includes(collection)) {
        return NextResponse.json({ error: `collection must be one of: ${COLLECTIONS.join(', ')}` }, { status: 400 });
    }
    const limit = Math.min(Math.max(body.limit ?? 20, 1), 200);
    const { countryCode, ...filter } = body.filter && typeof body.filter === 'object' ? body.filter : {};
    // The old MongoDB API accepted operators ($or, $regex, ...). Say so instead of silently matching nothing.
    const unsupported = Object.entries(filter).filter(
        ([k, v]) => k.startsWith('$') || (v !== null && typeof v === 'object' && !Array.isArray(v))
    );
    if (unsupported.length) {
        return NextResponse.json(
            { error: `Only equality filters are supported (field: value). Unsupported: ${unsupported.map(([k]) => k).join(', ')}` },
            { status: 400 }
        );
    }
    // Clients built for the MongoDB API pass the country as filter.countryCode.
    const country = body.country ?? (typeof countryCode === 'string' ? countryCode : 'in');
    const docs = rows(country, collection).filter(d => matches(d, filter)).slice(0, limit);
    return NextResponse.json({ collection, count: docs.length, docs });
}
