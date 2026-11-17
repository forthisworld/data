'use client';

/**
 * The home screen: a full-screen political map of India in the style of an old
 * school atlas, with a search bar at the bottom. Zooming in reveals more:
 *   country  - states in atlas colours, state names, a mark on states with records
 *   state    - district borders and the larger districts' names
 *   district - every district name
 * Selecting a state or district opens a card with what is published for it.
 *
 * Boundaries only, no basemap tiles: a basemap draws its own international
 * borders, which could contradict the official boundary of India that the
 * outline follows (see public/geo/in/ATTRIBUTION.md).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import maplibregl, { type LngLatBoundsLike, type MapGeoJSONFeature } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import Fuse from 'fuse.js';
import { Search, X, Route, FileText, HandHeart, Bot, Loader2, MapPin, User, ArrowUpRight } from 'lucide-react';
import type { AtlasRegion } from '@/services/country.service';
import type { SearchResult } from '@/types';

type Geom = GeoJSON.Polygon | GeoJSON.MultiPolygon;
type Bounds = [[number, number], [number, number]];

interface Place {
    kind: 'state' | 'district';
    name: string;
    state?: string;
    stateSlug: string;
    code?: string;
    bounds: Bounds;
}

interface Label {
    name: string;
    kind: 'state' | 'district';
    stateSlug: string;
    code?: string;
    area: number;
    lngLat: [number, number];
}

const INDIA_BOUNDS: LngLatBoundsLike = [[67.5, 6.2], [98.0, 37.6]];
const DISTRICT_ZOOM = 5.2;

// An old-atlas palette: pastel inks on a pale sea.
const SEA = '#bcd8e3';
const INKS = ['#f2d79b', '#cfe2a8', '#f1bfae', '#d8c8e6', '#f7e8a6', '#b9dccd'];
const LINE = { outline: '#4a3b2c', state: '#6f5d49', district: '#a3927b', selected: '#b4271a' };

function bboxOf(geom: Geom): Bounds {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const rings = geom.type === 'Polygon' ? geom.coordinates : geom.coordinates.flat();
    for (const ring of rings) for (const [x, y] of ring) {
        if (x < minX) minX = x; if (y < minY) minY = y;
        if (x > maxX) maxX = x; if (y > maxY) maxY = y;
    }
    return [[minX, minY], [maxX, maxY]];
}

/** Greedy map colouring: states that share a border get different inks. */
function colourStates(features: GeoJSON.Feature<Geom, { slug: string }>[]): Record<string, number> {
    const owners = new Map<string, Set<string>>();
    for (const f of features) {
        const rings = f.geometry.type === 'Polygon' ? f.geometry.coordinates : f.geometry.coordinates.flat();
        for (const ring of rings) for (const [x, y] of ring) {
            const k = `${x.toFixed(3)},${y.toFixed(3)}`;
            if (!owners.has(k)) owners.set(k, new Set());
            owners.get(k)!.add(f.properties.slug);
        }
    }
    const adj = new Map<string, Set<string>>(features.map(f => [f.properties.slug, new Set()]));
    for (const set of owners.values()) {
        if (set.size < 2) continue;
        for (const a of set) for (const b of set) if (a !== b) adj.get(a)!.add(b);
    }
    const order = [...adj.keys()].sort((a, b) => adj.get(b)!.size - adj.get(a)!.size);
    const colour: Record<string, number> = {};
    for (const s of order) {
        const used = new Set([...adj.get(s)!].map(n => colour[n]).filter(c => c !== undefined));
        let c = 0;
        while (used.has(c) && c < INKS.length - 1) c++;
        colour[s] = c;
    }
    return colour;
}

function labelsFromFeatures(states: GeoJSON.FeatureCollection, districts: GeoJSON.FeatureCollection): Label[] {
    const centre = (b: Bounds): [number, number] => [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2];
    const area = (b: Bounds) => Math.abs((b[1][0] - b[0][0]) * (b[1][1] - b[0][1])) * 11000;
    return [
        ...(states.features as GeoJSON.Feature<Geom, Record<string, string>>[]).map(f => {
            const b = bboxOf(f.geometry);
            return { name: f.properties.name, kind: 'state' as const, stateSlug: f.properties.slug, area: area(b), lngLat: centre(b) };
        }),
        ...(districts.features as GeoJSON.Feature<Geom, Record<string, string>>[]).map(f => {
            const b = bboxOf(f.geometry);
            return { name: f.properties.name, kind: 'district' as const, stateSlug: f.properties.stateSlug, code: f.properties.census2011Code, area: area(b), lngLat: centre(b) };
        }),
    ];
}

/** Districts big enough to label at this zoom (smaller ones appear as you zoom in). */
const districtAreaThreshold = (zoom: number) => 25000 / Math.pow(2.6, zoom - DISTRICT_ZOOM);

interface AtlasProps {
    countryCode: string;
    countryName: string;
    regions: Record<string, AtlasRegion>;
}

export default function Atlas({ countryCode, countryName, regions }: AtlasProps) {
    const router = useRouter();
    const container = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const markersRef = useRef<{ states: maplibregl.Marker[]; districts: maplibregl.Marker[] }>({ states: [], districts: [] });
    const selectedRef = useRef<{ source: string; id: string } | null>(null);

    const [ready, setReady] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const [places, setPlaces] = useState<Place[]>([]);
    const [selected, setSelected] = useState<Place | null>(null);
    const [query, setQuery] = useState('');
    const [records, setRecords] = useState<SearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);

    const fuse = useMemo(() => new Fuse(places, { keys: ['name', 'state'], threshold: 0.3 }), [places]);
    const placeMatches = query.length >= 2 ? fuse.search(query, { limit: 6 }).map(r => r.item) : [];

    // Records (people, toll roads, ...) from the site's search API.
    useEffect(() => {
        if (query.length < 2) { setRecords([]); return; }
        const t = setTimeout(async () => {
            setSearching(true);
            try {
                const res = await fetch(`/api/search?country=${countryCode}&q=${encodeURIComponent(query)}`);
                const data = await res.json();
                setRecords(Array.isArray(data) ? data.filter((r: SearchResult) => r.type !== 'region').slice(0, 6) : []);
            } catch {
                setRecords([]);
            } finally {
                setSearching(false);
            }
        }, 180);
        return () => clearTimeout(t);
    }, [query, countryCode]);

    const selectPlace = useCallback((place: Place, fly = true) => {
        const map = mapRef.current;
        if (!map) return;
        if (selectedRef.current) map.setFeatureState(selectedRef.current, { selected: false });
        selectedRef.current = place.kind === 'state' ? { source: 'states', id: place.stateSlug } : { source: 'districts', id: place.code! };
        map.setFeatureState(selectedRef.current, { selected: true });
        setSelected(place);
        setQuery('');
        setSearchOpen(false);
        // Leave room for the card (left on wide screens, above the search bar on phones).
        const wide = window.innerWidth >= 640;
        if (fly) map.fitBounds(place.bounds, { padding: { top: 80, bottom: wide ? 120 : 320, left: wide ? 360 : 30, right: 40 }, maxZoom: place.kind === 'district' ? 7.5 : 6.5, duration: 900 });
    }, []);

    const clearSelection = useCallback(() => {
        const map = mapRef.current;
        if (map && selectedRef.current) map.setFeatureState(selectedRef.current, { selected: false });
        selectedRef.current = null;
        setSelected(null);
    }, []);

    useEffect(() => {
        if (!container.current) return;
        const map = new maplibregl.Map({
            container: container.current,
            style: { version: 8, sources: {}, layers: [{ id: 'sea', type: 'background', paint: { 'background-color': SEA } }] },
            bounds: INDIA_BOUNDS,
            fitBoundsOptions: { padding: { top: 70, bottom: 110, left: 20, right: 20 } },
            maxBounds: [[40, -10], [125, 50]],
            minZoom: 2.5,
            maxZoom: 10,
            dragRotate: false,
            pitchWithRotate: false,
            attributionControl: false,
        });
        map.touchZoomRotate.disableRotation();
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
        mapRef.current = map;

        map.on('load', async () => {
            let india: GeoJSON.FeatureCollection, states: GeoJSON.FeatureCollection, districts: GeoJSON.FeatureCollection;
            try {
                [india, states, districts] = await Promise.all(['india', 'states', 'districts'].map(f =>
                    fetch(`/geo/${countryCode}/${f}.geojson`).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
                ));
            } catch {
                setLoadError(true);
                return;
            }
            let labels: Label[];
            try {
                const lj = await fetch(`/geo/${countryCode}/labels.geojson`).then(r => { if (!r.ok) throw new Error(); return r.json(); });
                labels = (lj.features as GeoJSON.Feature<GeoJSON.Point, Record<string, string | number>>[]).map(f => ({
                    name: String(f.properties.name), kind: f.properties.kind as 'state' | 'district', stateSlug: String(f.properties.stateSlug),
                    code: f.properties.census2011Code ? String(f.properties.census2011Code) : undefined,
                    area: Number(f.properties.areaKm2 ?? 0), lngLat: f.geometry.coordinates as [number, number],
                }));
            } catch {
                labels = labelsFromFeatures(states, districts);
            }

            const colours = colourStates(states.features as GeoJSON.Feature<Geom, { slug: string }>[]);
            map.addSource('states', { type: 'geojson', data: states, promoteId: 'slug' });
            map.addSource('districts', { type: 'geojson', data: districts, promoteId: 'census2011Code' });
            map.addSource('india', { type: 'geojson', data: india });
            for (const [slug, c] of Object.entries(colours)) map.setFeatureState({ source: 'states', id: slug }, { ink: c });

            map.addLayer({
                id: 'states-fill', type: 'fill', source: 'states',
                paint: {
                    'fill-color': ['match', ['coalesce', ['feature-state', 'ink'], 0], ...INKS.flatMap((c, i) => [i, c]), INKS[0]] as unknown as string,
                },
            });
            map.addLayer({
                id: 'hover-shade', type: 'fill', source: 'states',
                paint: { 'fill-color': '#000', 'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.07, 0] },
            });
            map.addLayer({
                id: 'districts-fill', type: 'fill', source: 'districts', minzoom: DISTRICT_ZOOM,
                paint: { 'fill-color': '#000', 'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.08, 0] },
            });
            map.addLayer({
                id: 'districts-line', type: 'line', source: 'districts', minzoom: DISTRICT_ZOOM - 0.4,
                paint: { 'line-color': LINE.district, 'line-width': 0.7, 'line-dasharray': [3, 2] },
            });
            map.addLayer({
                id: 'states-line', type: 'line', source: 'states',
                paint: { 'line-color': LINE.state, 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.6, 7, 1.6] },
            });
            map.addLayer({
                id: 'india-outline', type: 'line', source: 'india',
                paint: { 'line-color': LINE.outline, 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1.6, 7, 3] },
            });
            // Selection drawn as an outline, the way an atlas would mark it.
            for (const src of ['states', 'districts'] as const) {
                map.addLayer({
                    id: `${src}-selected`, type: 'line', source: src,
                    paint: { 'line-color': LINE.selected, 'line-width': ['case', ['boolean', ['feature-state', 'selected'], false], 2.5, 0] },
                });
            }

            // Search index
            setPlaces([
                ...(states.features as GeoJSON.Feature<Geom, Record<string, string>>[]).map(f => ({
                    kind: 'state' as const, name: f.properties.name, stateSlug: f.properties.slug, bounds: bboxOf(f.geometry),
                })),
                ...(districts.features as GeoJSON.Feature<Geom, Record<string, string>>[]).map(f => ({
                    kind: 'district' as const, name: f.properties.name, state: f.properties.state, stateSlug: f.properties.stateSlug,
                    code: f.properties.census2011Code, bounds: bboxOf(f.geometry),
                })),
            ]);

            // State labels, with a mark on states that have published records.
            const stateLabels = labels.filter(x => x.kind === 'state').map(l => {
                const r = regions[l.stateSlug];
                const n = r ? r.tollRoads.length + r.people.length : 0;
                const el = document.createElement('div');
                el.className = 'atlas-label atlas-label-state';
                el.innerHTML = `<span>${l.name}</span>${n ? `<em title="${n} published record${n === 1 ? '' : 's'}">${n}</em>` : ''}`;
                const marker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(l.lngLat).addTo(map);
                markersRef.current.states.push(marker);
                return { label: l, el, records: n };
            });
            const districtLabels = labels.filter(x => x.kind === 'district').sort((a, b) => b.area - a.area);

            // Place labels the way an atlas does: biggest places first, skip any that would
            // overlap one already placed. Smaller places appear as you zoom in.
            const layoutLabels = () => {
                const z = map.getZoom();
                const zoomed = z >= DISTRICT_ZOOM;
                container.current?.classList.toggle('atlas-zoomed', zoomed);
                const small = window.innerWidth < 640;
                const placed: [number, number, number, number][] = [];
                const fits = (x: number, y: number, w: number, h: number) => {
                    const box: [number, number, number, number] = [x - w / 2, y - h / 2, x + w / 2, y + h / 2];
                    if (placed.some(p => box[0] < p[2] && box[2] > p[0] && box[1] < p[3] && box[3] > p[1])) return false;
                    placed.push(box);
                    return true;
                };
                const statePx = zoomed ? 15 : small ? 9 : 12;
                const stateOrder = [...stateLabels].sort((a, b) => (b.records ? 1 : 0) - (a.records ? 1 : 0) || b.label.area - a.label.area);

                // Districts take priority once zoomed in; state names fade behind them.
                markersRef.current.districts.forEach(m => m.remove());
                markersRef.current.districts = [];
                if (zoomed) {
                    const b = map.getBounds();
                    const min = districtAreaThreshold(z);
                    // The selected district is always named.
                    const sel = selectedRef.current?.source === 'districts' ? selectedRef.current.id : null;
                    const ordered = sel ? [...districtLabels.filter(l => l.code === sel), ...districtLabels.filter(l => l.code !== sel)] : districtLabels;
                    for (const l of ordered) {
                        if ((l.area < min && l.code !== sel) || !b.contains(l.lngLat)) continue;
                        const p = map.project(l.lngLat);
                        if (!fits(p.x, p.y, l.name.length * 6.6 + 8, 18)) continue;
                        const el = document.createElement('div');
                        el.className = 'atlas-label atlas-label-district';
                        el.textContent = l.name;
                        markersRef.current.districts.push(new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(l.lngLat).addTo(map));
                        if (markersRef.current.districts.length >= 150) break;
                    }
                }
                for (const s of stateOrder) {
                    // Tiny territories with long names wait until you zoom in, unless they have records.
                    if (!s.records && s.label.area < 5000 && z < DISTRICT_ZOOM) { s.el.style.display = 'none'; continue; }
                    const p = map.project(s.label.lngLat);
                    const w = s.label.name.length * statePx * 0.78 + 8;
                    const h = statePx * 1.5 + (s.records ? 20 : 0);
                    s.el.style.display = fits(p.x, p.y, w, h) ? '' : 'none';
                }
            };
            map.on('moveend', layoutLabels);
            layoutLabels();

            // Hover
            let hovered: { source: string; id: string | number } | null = null;
            const clearHover = () => {
                if (hovered) map.setFeatureState(hovered, { hover: false });
                hovered = null;
                map.getCanvas().style.cursor = '';
            };
            const hit = (p: maplibregl.PointLike): MapGeoJSONFeature | undefined =>
                map.queryRenderedFeatures(p, { layers: map.getZoom() >= DISTRICT_ZOOM ? ['districts-fill', 'hover-shade'] : ['hover-shade'] })[0];
            map.on('mousemove', e => {
                const f = hit(e.point);
                if (!f || f.id === undefined) return clearHover();
                const source = f.layer.id === 'districts-fill' ? 'districts' : 'states';
                if (!hovered || hovered.id !== f.id || hovered.source !== source) {
                    clearHover();
                    hovered = { source, id: f.id };
                    map.setFeatureState(hovered, { hover: true });
                }
                map.getCanvas().style.cursor = 'pointer';
            });
            map.on('mouseout', clearHover);
            map.on('click', e => {
                const f = hit(e.point);
                if (!f) return clearSelection();
                const p = f.properties as Record<string, string>;
                const geom = f.geometry as Geom;
                selectPlace(
                    f.layer.id === 'districts-fill'
                        ? { kind: 'district', name: p.name, state: p.state, stateSlug: p.stateSlug, code: p.census2011Code, bounds: bboxOf(geom) }
                        : { kind: 'state', name: p.name, stateSlug: p.slug, bounds: bboxOf(geom) },
                    false
                );
            });

            map.resize();
            map.fitBounds(INDIA_BOUNDS, { padding: { top: 70, bottom: 110, left: 20, right: 20 }, animate: false });
            container.current?.setAttribute('data-ready', 'true');
            setReady(true);
        });

        const markers = markersRef.current;
        return () => {
            markers.states.forEach(m => m.remove());
            markers.districts.forEach(m => m.remove());
            map.remove();
            mapRef.current = null;
        };
        // regions and countryCode are fixed for the page's lifetime
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const region = selected ? regions[selected.stateSlug] : undefined;
    const fmt = (n: number) => n.toLocaleString('en-IN');

    return (
        <div className="atlas relative h-[100dvh] w-full overflow-hidden" style={{ background: SEA }}>
            {/* h-full, not absolute: maplibre-gl.css sets .maplibregl-map { position: relative } */}
            <div ref={container} className="h-full w-full" />

            {/* Title cartouche */}
            <div className="pointer-events-none absolute left-3 top-3 z-10 sm:left-5 sm:top-5">
                <div className="pointer-events-auto rounded-md border-2 border-double border-[#6f5d49] bg-[#fbf6e9]/95 px-4 py-2 shadow-sm">
                    <p className="font-[family-name:var(--font-atlas)] text-2xl leading-none text-[#3b2f23] sm:text-3xl">{countryName}</p>
                    <p className="mt-1 font-[family-name:var(--font-atlas)] text-xs italic text-[#6f5d49]">
                        an open atlas of public money · <Link href="/" className="not-italic hover:underline">data.ftw</Link>
                    </p>
                </div>
            </div>

            {/* Corner menu */}
            <nav className="absolute left-3 top-[5.5rem] z-10 flex gap-1.5 sm:left-auto sm:right-16 sm:top-5" aria-label="Sections">
                {[
                    { href: `/${countryCode}/infrastructure/toll-roads`, label: 'Toll roads', icon: Route },
                    { href: `/${countryCode}/info-requests`, label: 'RTI', icon: FileText },
                    { href: '/contribute', label: 'Contribute', icon: HandHeart },
                    { href: '/connect', label: 'Use with AI', icon: Bot },
                ].map(({ href, label, icon: Icon }) => (
                    <Link key={href} href={href} title={label}
                        className="flex items-center gap-1.5 rounded-md border border-[#6f5d49]/40 bg-[#fbf6e9]/95 px-2.5 py-2 text-xs font-medium text-[#3b2f23] shadow-sm hover:bg-white">
                        <Icon className="h-4 w-4" /><span className="hidden lg:inline">{label}</span>
                    </Link>
                ))}
            </nav>

            {/* Selection card */}
            {selected && (
                <aside className="absolute bottom-[5.5rem] left-3 right-3 z-20 max-h-[45dvh] overflow-y-auto rounded-lg border border-[#6f5d49]/50 bg-[#fbf6e9] p-4 text-[#3b2f23] shadow-xl sm:left-5 sm:right-auto sm:top-28 sm:bottom-auto sm:w-80 sm:max-h-[calc(100dvh-13rem)]">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h2 className="font-[family-name:var(--font-atlas)] text-2xl leading-tight">{selected.name}</h2>
                            <p className="text-xs text-[#6f5d49]">
                                {selected.kind === 'district'
                                    ? `District of ${selected.state} · Census 2011 code ${selected.code}`
                                    : region?.level === 'union_territory' ? 'Union territory' : 'State or union territory'}
                                {selected.kind === 'state' && region?.capital ? ` · capital ${region.capital}` : ''}
                            </p>
                        </div>
                        <button onClick={clearSelection} aria-label="Close" className="rounded p-1 text-[#6f5d49] hover:bg-black/5"><X className="h-4 w-4" /></button>
                    </div>

                    {selected.kind === 'district' && (
                        <p className="mt-3 text-sm text-[#6f5d49]">Nothing is published at district level yet. Showing {selected.state}:</p>
                    )}

                    {region ? (
                        <div className="mt-3 space-y-3 text-sm">
                            {region.population && (
                                <p>
                                    <span className="text-[#6f5d49]">Population </span>
                                    <strong>{fmt(region.population)}</strong>
                                    <span className="text-xs text-[#6f5d49]"> ({region.populationAsOf}{region.populationSource?.url && <>, <a href={region.populationSource.url} target="_blank" rel="noopener noreferrer" className="underline">source</a></>})</span>
                                </p>
                            )}
                            <div>
                                <p className="mb-1 text-xs uppercase tracking-wide text-[#6f5d49]">Toll roads</p>
                                {region.tollRoads.length ? region.tollRoads.map(t => (
                                    <Link key={t.slug} href={`/${countryCode}/infrastructure/toll-roads/${t.slug}`} className="flex items-center justify-between gap-2 py-0.5 hover:underline">
                                        <span>{t.name}</span>
                                        <span className={`shrink-0 text-xs ${t.tolling === 'toll_free' ? 'text-emerald-700' : 'text-[#6f5d49]'}`}>{t.tolling === 'toll_free' ? 'toll-free' : t.tolling ?? ''}</span>
                                    </Link>
                                )) : <p className="text-[#6f5d49]">None published yet.</p>}
                            </div>
                            <div>
                                <p className="mb-1 text-xs uppercase tracking-wide text-[#6f5d49]">People</p>
                                {region.people.length ? region.people.map(p => (
                                    <Link key={p.slug} href={`/${countryCode}/person/${p.slug}`} className="block py-0.5 hover:underline">
                                        {p.name} <span className="text-xs uppercase text-[#6f5d49]">{p.role}</span>
                                    </Link>
                                )) : <p className="text-[#6f5d49]">None published yet.</p>}
                            </div>
                            <Link href={`/${countryCode}/${region.slug}`} className="inline-flex items-center gap-1 font-medium text-[#1f3a4d] hover:underline">
                                Open {region.name} <ArrowUpRight className="h-3.5 w-3.5" />
                            </Link>
                        </div>
                    ) : (
                        <p className="mt-3 text-sm text-[#6f5d49]">
                            Nothing published for {selected.kind === 'district' ? selected.state : selected.name} yet.{' '}
                            <Link href="/contribute" className="underline">Help add it</Link>.
                        </p>
                    )}
                </aside>
            )}

            {/* Search, at the bottom */}
            <div className="absolute inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 mx-auto max-w-2xl">
                {searchOpen && query.length >= 2 && (
                    <div className="mb-2 max-h-[50dvh] overflow-y-auto rounded-lg border border-[#6f5d49]/50 bg-[#fbf6e9] text-sm text-[#3b2f23] shadow-xl">
                        {placeMatches.length > 0 && (
                            <div className="p-1">
                                <p className="px-3 pt-2 text-[11px] uppercase tracking-wide text-[#6f5d49]">Places</p>
                                {placeMatches.map(m => (
                                    <button key={`${m.kind}-${m.code ?? m.stateSlug}`} onClick={() => selectPlace(m)}
                                        className="flex w-full items-center justify-between gap-2 rounded px-3 py-2 text-left hover:bg-black/5">
                                        <span className="flex items-center gap-2"><MapPin className="h-4 w-4 text-[#6f5d49]" />{m.name}</span>
                                        <span className="text-xs text-[#6f5d49]">{m.kind === 'district' ? `district · ${m.state}` : 'state / UT'}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                        {records.length > 0 && (
                            <div className="border-t border-[#6f5d49]/20 p-1">
                                <p className="px-3 pt-2 text-[11px] uppercase tracking-wide text-[#6f5d49]">Records</p>
                                {records.map(r => (
                                    <button key={r.path} onClick={() => router.push(r.path)}
                                        className="flex w-full items-center justify-between gap-2 rounded px-3 py-2 text-left hover:bg-black/5">
                                        <span className="flex items-center gap-2">{r.type === 'person' ? <User className="h-4 w-4 text-[#6f5d49]" /> : <Route className="h-4 w-4 text-[#6f5d49]" />}{r.name}</span>
                                        <span className="truncate text-xs text-[#6f5d49]">{r.description}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                        {!searching && placeMatches.length === 0 && records.length === 0 && (
                            <p className="px-4 py-3 text-[#6f5d49]">Nothing found for “{query}”.</p>
                        )}
                    </div>
                )}
                <div className="relative">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#6f5d49]" />
                    <input
                        value={query}
                        onChange={e => { setQuery(e.target.value); setSearchOpen(true); }}
                        onFocus={() => setSearchOpen(true)}
                        onKeyDown={e => {
                            if (e.key === 'Escape') { setQuery(''); setSearchOpen(false); }
                            if (e.key === 'Enter') {
                                if (placeMatches[0]) selectPlace(placeMatches[0]);
                                else if (records[0]) router.push(records[0].path);
                            }
                        }}
                        placeholder="Search places, toll roads, people…"
                        aria-label="Search the atlas"
                        className="h-14 w-full rounded-full border-2 border-[#6f5d49]/60 bg-[#fbf6e9] pl-12 pr-12 text-base text-[#3b2f23] shadow-lg placeholder:text-[#8a7864] focus:border-[#1f3a4d] focus:outline-none"
                    />
                    {searching ? (
                        <Loader2 className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-[#6f5d49]" />
                    ) : query && (
                        <button onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6f5d49]"><X className="h-5 w-5" /></button>
                    )}
                </div>
                <p className="mt-1.5 text-center text-[10px] text-[#4a3b2c]/80">
                    Boundaries: <a href="https://github.com/datameet/maps" target="_blank" rel="noopener noreferrer" className="underline">DataMeet</a> (2011 districts, CC BY 2.5 IN) ·{' '}
                    <a href="/geo/in/ATTRIBUTION.md" className="underline">details</a> · every fact links to its source
                </p>
            </div>

            {!ready && !loadError && (
                <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center font-[family-name:var(--font-atlas)] text-lg italic text-[#4a3b2c]">
                    Unrolling the map…
                </div>
            )}
            {loadError && (
                <div className="absolute inset-0 z-20 flex items-center justify-center text-sm text-[#4a3b2c]">Map boundaries could not be loaded.</div>
            )}
        </div>
    );
}
