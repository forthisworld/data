import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCountryConfig, getAtlasData, type AtlasData } from '@/services/country.service';
import AtlasLoader from '@/components/atlas/AtlasLoader';
import { parseAtlasPath, type AtlasRoute } from '@/lib/atlas-route';
import { places } from '@/lib/data/places.generated';

/**
 * Every record has its own URL, and every URL opens the atlas with that record in the panel.
 * The atlas draws on the client, so the server also renders the record's title and summary
 * (for search engines, link previews and readers without JavaScript).
 */

interface Props {
    params: Promise<{ country: string; path: string[] }>;
}

/** What the server can say about a route; null when the record does not exist. */
function describe(country: string, route: AtlasRoute, data: AtlasData): { title: string; summary: string } | null {
    const known = places[country];
    switch (route.kind) {
        case 'home':
            return { title: 'Atlas', summary: '' };
        case 'roads':
            return { title: 'Toll roads', summary: data.roads.map(r => r.name).join('; ') };
        case 'road': {
            const r = data.roads.find(x => x.slug === route.slug);
            return r ? { title: r.name, summary: r.analysis?.summary ?? r.officialName ?? '' } : null;
        }
        case 'person': {
            const p = data.people.find(x => x.slug === route.slug);
            return p ? { title: p.name, summary: p.description ?? '' } : null;
        }
        case 'state': {
            const name = known?.states[route.slug];
            if (!name) return null;
            return { title: name, summary: `What is on record for ${name}: roads, office-holders and open questions.` };
        }
        case 'district': {
            const d = known?.districts[route.code];
            if (!d || d[1] !== route.state) return null;
            const state = known.states[d[1]] ?? d[1];
            return { title: `${d[0]}, ${state}`, summary: `What is on record for ${d[0]} district (${state}), and what is still unknown.` };
        }
    }
}

async function load(country: string, path: string[]) {
    const route = parseAtlasPath(path);
    if (!route) return null;
    let config;
    try {
        config = await getCountryConfig(country);
    } catch {
        return null;
    }
    const data = await getAtlasData(country);
    const about = describe(country, route, data);
    return about ? { route, config, data, about } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { country, path } = await params;
    const r = await load(country, path);
    if (!r) return {};
    return { title: r.about.title, description: r.about.summary.slice(0, 300) || undefined };
}

export default async function AtlasRoutePage({ params }: Props) {
    const { country, path } = await params;
    const r = await load(country, path);
    if (!r) notFound();
    return (
        <>
            <article className="sr-only">
                <h1>{r.about.title}</h1>
                {r.about.summary && <p>{r.about.summary}</p>}
            </article>
            <AtlasLoader countryCode={country} countryName={r.config.name} data={r.data} initial={r.route} />
        </>
    );
}
