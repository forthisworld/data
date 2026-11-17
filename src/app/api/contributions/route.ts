import { NextRequest, NextResponse } from 'next/server';
import { submitContribution, ContributionSchema, bundledFile } from '@/lib/contrib/contribute';

/**
 * POST a contribution; if it passes the sourcing checks it becomes a pull
 * request against the `data` branch (see src/lib/contrib/contribute.ts).
 * Used by the hosted MCP endpoint and the local MCP server.
 */

// Light abuse protection until Turnstile is wired in: a few submissions per address per hour.
const recent = new Map<string, number[]>();
function limited(ip: string): boolean {
    const now = Date.now();
    const hits = (recent.get(ip) ?? []).filter(t => now - t < 3600_000);
    hits.push(now);
    recent.set(ip, hits);
    return hits.length > 10;
}

export async function POST(req: NextRequest) {
    const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'local';
    if (limited(ip)) return NextResponse.json({ error: 'Too many submissions; try again later' }, { status: 429 });

    const parsed = ContributionSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ status: 'rejected', errors: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`) }, { status: 400 });
    }
    const c = parsed.data;
    try {
        const result = await submitContribution(c, bundledFile(c.country, c.entityType, c.entitySlug));
        return NextResponse.json(result, { status: result.status === 'rejected' ? 422 : 200 });
    } catch (e) {
        console.error('Contribution failed:', e);
        return NextResponse.json({ status: 'error', error: 'Could not open the pull request; try again later' }, { status: 502 });
    }
}
