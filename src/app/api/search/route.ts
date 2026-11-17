import { NextRequest, NextResponse } from 'next/server';
import { searchAll } from '@/services/search.service';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const country = searchParams.get('country') || 'in';
    const query = searchParams.get('q') || '';
    const region = searchParams.get('region') || undefined;

    if (!query || query.length < 2) {
        return NextResponse.json([]);
    }

    try {
        const results = await searchAll(country, query, region);
        return NextResponse.json(results);
    } catch (error) {
        console.error('Search API error:', error);
        return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }
}
