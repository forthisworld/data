import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db/mongodb';

/**
 * Read-only research API.
 *
 * Lets the local FTW Research Tool query platform collections without ever
 * holding MongoDB credentials. Guarded by a shared secret set in .env.local:
 *   RESEARCH_API_TOKEN=<random string>
 *
 * Only `find` is exposed, with a hard limit. No writes, no aggregations.
 */

const ALLOWED_COLLECTIONS = ['entities', 'regions', 'countries', 'info_requests', 'toll_roads'] as const;

export async function POST(req: NextRequest) {
    const token = req.headers.get('x-research-token');
    const expected = process.env.RESEARCH_API_TOKEN;
    if (!expected) {
        return NextResponse.json({ error: 'Research API disabled - set RESEARCH_API_TOKEN in .env.local to enable' }, { status: 503 });
    }
    if (!token || token !== expected) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: { collection?: string; filter?: Record<string, unknown>; limit?: number; projection?: Record<string, unknown> };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const collection = body.collection;
    if (!collection || !ALLOWED_COLLECTIONS.includes(collection as (typeof ALLOWED_COLLECTIONS)[number])) {
        return NextResponse.json({ error: `collection must be one of: ${ALLOWED_COLLECTIONS.join(', ')}` }, { status: 400 });
    }

    const limit = Math.min(Math.max(body.limit ?? 20, 1), 200);
    const filter = body.filter && typeof body.filter === 'object' ? body.filter : {};

    try {
        const db = await getDatabase();
        let cursor = db.collection(collection).find(filter, { limit });
        if (body.projection && typeof body.projection === 'object') {
            cursor = db.collection(collection).find(filter, { limit, projection: body.projection });
        }
        const docs = await cursor.toArray();
        return NextResponse.json({ collection, count: docs.length, docs });
    } catch (error) {
        console.error('Research API query failed:', error);
        return NextResponse.json({ error: 'Query failed' }, { status: 500 });
    }
}
