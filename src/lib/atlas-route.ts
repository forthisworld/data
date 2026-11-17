/**
 * The atlas's URLs. Every view in the panel has a real path, so links can be shared, the
 * server can render a title and summary for it, and the browser's Back button closes the panel.
 *
 *   /in                                  nothing selected
 *   /in/<state-slug>                     a state or union territory
 *   /in/<state-slug>/district/<code>     a district (Census 2011 code)
 *   /in/person/<slug>                    a person
 *   /in/infrastructure/toll-roads        all toll roads
 *   /in/infrastructure/toll-roads/<slug> a toll road
 *
 * /in/info-requests is a separate page (a form, not a record).
 */

export type AtlasRoute =
    | { kind: 'home' }
    | { kind: 'state'; slug: string }
    | { kind: 'district'; state: string; code: string }
    | { kind: 'person'; slug: string }
    | { kind: 'roads' }
    | { kind: 'road'; slug: string };

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Path segments after the country code → a route, or null if the path is not an atlas view. */
export function parseAtlasPath(segments: string[]): AtlasRoute | null {
    const s = segments.filter(Boolean).map(decodeURIComponent);
    if (s.length === 0) return { kind: 'home' };
    if (s[0] === 'person') return s.length === 2 && SLUG.test(s[1]) ? { kind: 'person', slug: s[1] } : null;
    if (s[0] === 'infrastructure') {
        if (s[1] !== 'toll-roads') return null;
        if (s.length === 2) return { kind: 'roads' };
        return s.length === 3 && SLUG.test(s[2]) ? { kind: 'road', slug: s[2] } : null;
    }
    if (s[0] === 'info-requests') return null;
    if (!SLUG.test(s[0])) return null;
    if (s.length === 1) return { kind: 'state', slug: s[0] };
    if (s.length === 3 && s[1] === 'district' && /^\d+$/.test(s[2])) return { kind: 'district', state: s[0], code: s[2] };
    return null;
}

export function atlasPath(country: string, r: AtlasRoute): string {
    switch (r.kind) {
        case 'home': return `/${country}`;
        case 'state': return `/${country}/${r.slug}`;
        case 'district': return `/${country}/${r.state}/district/${r.code}`;
        case 'person': return `/${country}/person/${r.slug}`;
        case 'roads': return `/${country}/infrastructure/toll-roads`;
        case 'road': return `/${country}/infrastructure/toll-roads/${r.slug}`;
    }
}

/** Is this URL path shown by the full-screen atlas (so the site header and footer stay hidden)? */
export function isAtlasPathname(pathname: string): boolean {
    const [country, ...rest] = pathname.split('/').filter(Boolean);
    return !!country && /^[a-z]{2}$/.test(country) && parseAtlasPath(rest) !== null;
}
