'use client';

/**
 * Zoomable, searchable map of India: states and UTs, and the 2011 districts
 * when zoomed in. Boundaries only, with no basemap tiles: a basemap would draw
 * its own international borders, which could contradict the official boundary
 * of India that DataMeet's outline follows (see public/geo/in/ATTRIBUTION.md).
 *
 * Boundary files come from scripts/build-geo.mjs (public/geo/in/).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import maplibregl, { type LngLatBoundsLike, type MapGeoJSONFeature } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import Fuse from 'fuse.js';
import { Search, X, MapPin } from 'lucide-react';

export interface MapRegionSummary {
    slug: string;
    name: string;
    tollRoads: number;
    people: number;
}

interface IndiaMapProps {
    countryCode: string;
    /** Regions that have a page, keyed by slug. */
    regions: Record<string, MapRegionSummary>;
}

type Feature = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon, Record<string, string>>;

interface Place {
    kind: 'state' | 'district';
    name: string;
    state?: string;
    stateSlug: string;
    code?: string;
    bounds: [[number, number], [number, number]];
}

const INDIA_BOUNDS: LngLatBoundsLike = [[67.5, 6.2], [98.0, 37.6]];
const DISTRICT_ZOOM = 5;
// Leave room at the top for the search box.
const FIT_PADDING = { top: 64, bottom: 16, left: 16, right: 16 };

const C = {
    background: '#0f172a',
    state: '#1e293b',
    statePublished: '#064e3b',
    hover: '#0369a1',
    selected: '#0ea5e9',
    stateLine: '#64748b',
    districtLine: '#334155',
    outline: '#cbd5e1',
};

function bbox(geom: GeoJSON.Polygon | GeoJSON.MultiPolygon): [[number, number], [number, number]] {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const rings = geom.type === 'Polygon' ? geom.coordinates : geom.coordinates.flat();
    for (const ring of rings) for (const [x, y] of ring) {
        if (x < minX) minX = x; if (y < minY) minY = y;
        if (x > maxX) maxX = x; if (y > maxY) maxY = y;
    }
    return [[minX, minY], [maxX, maxY]];
}

export default function IndiaMap({ countryCode, regions }: IndiaMapProps) {
    const router = useRouter();
    const container = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const [places, setPlaces] = useState<Place[]>([]);
    const [hover, setHover] = useState<{ x: number; y: number; title: string; sub: string } | null>(null);
    const [selected, setSelected] = useState<Place | null>(null);
    const [query, setQuery] = useState('');
    const [loadError, setLoadError] = useState(false);

    const fuse = useMemo(() => new Fuse(places, { keys: ['name', 'state'], threshold: 0.3 }), [places]);
    const matches = query.length >= 2 ? fuse.search(query, { limit: 8 }).map(r => r.item) : [];

    useEffect(() => {
        if (!container.current) return;
        const map = new maplibregl.Map({
            container: container.current,
            style: {
                version: 8,
                sources: {},
                layers: [{ id: 'background', type: 'background', paint: { 'background-color': C.background } }],
            },
            bounds: INDIA_BOUNDS,
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
                [india, states, districts] = await Promise.all(
                    ['india', 'states', 'districts'].map(f => fetch(`/geo/${countryCode}/${f}.geojson`).then(r => {
                        if (!r.ok) throw new Error(`${r.status}`);
                        return r.json();
                    }))
                );
            } catch {
                setLoadError(true);
                return;
            }

            const published = Object.keys(regions);
            map.addSource('states', { type: 'geojson', data: states, promoteId: 'slug' });
            map.addSource('districts', { type: 'geojson', data: districts, promoteId: 'census2011Code' });
            map.addSource('india', { type: 'geojson', data: india });

            map.addLayer({
                id: 'states-fill', type: 'fill', source: 'states',
                paint: {
                    'fill-color': [
                        'case',
                        ['boolean', ['feature-state', 'selected'], false], C.selected,
                        ['boolean', ['feature-state', 'hover'], false], C.hover,
                        ['in', ['get', 'slug'], ['literal', published]], C.statePublished,
                        C.state,
                    ],
                    'fill-opacity': ['interpolate', ['linear'], ['zoom'], DISTRICT_ZOOM - 0.5, 0.9, DISTRICT_ZOOM + 0.5, 0.35],
                },
            });
            map.addLayer({
                id: 'districts-fill', type: 'fill', source: 'districts', minzoom: DISTRICT_ZOOM,
                paint: {
                    'fill-color': [
                        'case',
                        ['boolean', ['feature-state', 'selected'], false], C.selected,
                        ['boolean', ['feature-state', 'hover'], false], C.hover,
                        'rgba(0,0,0,0)',
                    ],
                    'fill-opacity': 0.6,
                },
            });
            map.addLayer({
                id: 'districts-line', type: 'line', source: 'districts', minzoom: DISTRICT_ZOOM - 0.5,
                paint: { 'line-color': C.districtLine, 'line-width': 0.6 },
            });
            map.addLayer({
                id: 'states-line', type: 'line', source: 'states',
                paint: { 'line-color': C.stateLine, 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.5, 7, 1.5] },
            });
            map.addLayer({
                id: 'india-outline', type: 'line', source: 'india',
                paint: { 'line-color': C.outline, 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1, 7, 2.5] },
            });

            // The container can change size while the page settles; refit once data is in.
            map.resize();
            map.fitBounds(INDIA_BOUNDS, { padding: FIT_PADDING, animate: false });
            container.current?.setAttribute('data-ready', 'true');

            // Search index
            setPlaces([
                ...(states.features as Feature[]).map(f => ({
                    kind: 'state' as const, name: f.properties.name, stateSlug: f.properties.slug, bounds: bbox(f.geometry),
                })),
                ...(districts.features as Feature[]).map(f => ({
                    kind: 'district' as const, name: f.properties.name, state: f.properties.state,
                    stateSlug: f.properties.stateSlug, code: f.properties.census2011Code, bounds: bbox(f.geometry),
                })),
            ]);

            // Hover
            let hovered: { source: string; id: string | number } | null = null;
            const clearHover = () => {
                if (hovered) map.setFeatureState(hovered, { hover: false });
                hovered = null;
                map.getCanvas().style.cursor = '';
                setHover(null);
            };
            map.on('mousemove', e => {
                const layers = map.getZoom() >= DISTRICT_ZOOM ? ['districts-fill', 'states-fill'] : ['states-fill'];
                const f: MapGeoJSONFeature | undefined = map.queryRenderedFeatures(e.point, { layers })[0];
                if (!f || f.id === undefined) return clearHover();
                const src = f.layer.id === 'districts-fill' ? 'districts' : 'states';
                if (!hovered || hovered.id !== f.id || hovered.source !== src) {
                    if (hovered) map.setFeatureState(hovered, { hover: false });
                    hovered = { source: src, id: f.id };
                    map.setFeatureState(hovered, { hover: true });
                }
                map.getCanvas().style.cursor = 'pointer';
                const p = f.properties as Record<string, string>;
                const r = regions[src === 'states' ? p.slug : p.stateSlug];
                setHover({
                    x: e.point.x, y: e.point.y,
                    title: p.name,
                    sub: src === 'districts'
                        ? `${p.state} · district (2011 boundary)`
                        : r ? `${r.tollRoads} toll road${r.tollRoads === 1 ? '' : 's'} · ${r.people} ${r.people === 1 ? 'person' : 'people'}` : 'No page yet',
                });
            });
            map.on('mouseout', clearHover);

            // Click: select the state or district under the pointer
            map.on('click', e => {
                const layers = map.getZoom() >= DISTRICT_ZOOM ? ['districts-fill', 'states-fill'] : ['states-fill'];
                const f = map.queryRenderedFeatures(e.point, { layers })[0];
                if (!f) return;
                const p = f.properties as Record<string, string>;
                const geom = (f.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon);
                selectPlace(
                    f.layer.id === 'districts-fill'
                        ? { kind: 'district', name: p.name, state: p.state, stateSlug: p.stateSlug, code: p.census2011Code, bounds: bbox(geom) }
                        : { kind: 'state', name: p.name, stateSlug: p.slug, bounds: bbox(geom) },
                    false
                );
            });
        });

        return () => {
            map.remove();
            mapRef.current = null;
        };
        // regions and countryCode are fixed for the page's lifetime
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const selectedRef = useRef<{ source: string; id: string } | null>(null);
    function selectPlace(place: Place, fly = true) {
        const map = mapRef.current;
        if (!map) return;
        if (selectedRef.current) map.setFeatureState(selectedRef.current, { selected: false });
        selectedRef.current = place.kind === 'state'
            ? { source: 'states', id: place.stateSlug }
            : { source: 'districts', id: place.code! };
        map.setFeatureState(selectedRef.current, { selected: true });
        setSelected(place);
        setQuery('');
        if (fly) {
            map.fitBounds(place.bounds, { padding: 60, maxZoom: place.kind === 'district' ? 7 : 6.5, duration: 900 });
        }
    }

    function clearSelection() {
        const map = mapRef.current;
        if (map && selectedRef.current) map.setFeatureState(selectedRef.current, { selected: false });
        selectedRef.current = null;
        setSelected(null);
        map?.fitBounds(INDIA_BOUNDS, { padding: FIT_PADDING, duration: 900 });
    }

    const selectedRegion = selected ? regions[selected.stateSlug] : undefined;

    return (
        <figure>
        <div className="relative h-[70vh] min-h-[420px] w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-900">
            {/* h-full, not absolute: maplibre-gl.css sets .maplibregl-map { position: relative } */}
            <div ref={container} className="h-full w-full" />

            {/* Search */}
            <div className="absolute left-3 top-3 z-10 w-[min(22rem,calc(100%-4.5rem))]">
                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && matches[0]) selectPlace(matches[0]);
                            if (e.key === 'Escape') setQuery('');
                        }}
                        placeholder="Find a state or district…"
                        aria-label="Find a state or district"
                        className="w-full rounded-lg border border-slate-600 bg-slate-900/90 py-2 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
                    />
                </div>
                {matches.length > 0 && (
                    <ul className="mt-1 overflow-hidden rounded-lg border border-slate-700 bg-slate-900/95 text-sm shadow-xl">
                        {matches.map(m => (
                            <li key={`${m.kind}-${m.code ?? m.stateSlug}`}>
                                <button
                                    onClick={() => selectPlace(m)}
                                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-slate-200 hover:bg-slate-800"
                                >
                                    <span>{m.name}</span>
                                    <span className="text-xs text-slate-500">{m.kind === 'district' ? `district · ${m.state}` : 'state / UT'}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Hover tooltip */}
            {hover && (
                <div
                    className="pointer-events-none absolute z-10 rounded-md border border-slate-600 bg-slate-900/95 px-2.5 py-1.5 text-xs shadow-lg"
                    style={{ left: hover.x + 14, top: hover.y + 14 }}
                >
                    <p className="font-medium text-white">{hover.title}</p>
                    <p className="text-slate-400">{hover.sub}</p>
                </div>
            )}

            {/* Selection panel */}
            {selected && (
                <div className="absolute bottom-3 left-3 z-10 w-[min(22rem,calc(100%-1.5rem))] rounded-lg border border-slate-600 bg-slate-900/95 p-4 text-sm shadow-xl">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="flex items-center gap-1.5 font-semibold text-white">
                                <MapPin className="h-4 w-4 text-sky-400" /> {selected.name}
                            </p>
                            <p className="text-xs text-slate-400">
                                {selected.kind === 'district'
                                    ? `District in ${selected.state} · Census 2011 code ${selected.code}`
                                    : 'State / union territory'}
                            </p>
                        </div>
                        <button onClick={clearSelection} aria-label="Clear selection" className="text-slate-500 hover:text-white">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                    {selected.kind === 'district' && (
                        <p className="mt-2 text-xs text-slate-500">No district-level data published yet.</p>
                    )}
                    {selectedRegion ? (
                        <button
                            onClick={() => router.push(`/${countryCode}/${selectedRegion.slug}`)}
                            className="mt-3 w-full rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500"
                        >
                            Open {selectedRegion.name}: {selectedRegion.tollRoads} toll road{selectedRegion.tollRoads === 1 ? '' : 's'}, {selectedRegion.people} {selectedRegion.people === 1 ? 'person' : 'people'}
                        </button>
                    ) : (
                        <p className="mt-2 text-xs text-slate-500">
                            Nothing published for {selected.kind === 'district' ? selected.state : selected.name} yet.
                        </p>
                    )}
                </div>
            )}

            {/* Legend */}
            <div className="pointer-events-none absolute right-3 top-24 z-10 hidden rounded-md border border-slate-700 bg-slate-900/90 px-2.5 py-2 text-[11px] text-slate-400 sm:block">
                <p className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: C.statePublished }} /> Has a page</p>
                <p className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: C.state }} /> Not yet</p>
                <p className="mt-1">Zoom in for districts (2011 boundaries)</p>
            </div>

            {loadError && (
                <div className="absolute inset-0 z-20 flex items-center justify-center text-sm text-slate-400">
                    Map boundaries could not be loaded.
                </div>
            )}
        </div>
        <figcaption className="mt-2 text-[11px] text-slate-500">
            Boundaries: <a href="https://github.com/datameet/maps" target="_blank" rel="noopener noreferrer" className="underline decoration-dotted hover:text-slate-300">DataMeet</a>{' '}
            (states CC BY 4.0; 2011 districts CC BY 2.5 IN; outline per Survey of India).{' '}
            <a href="/geo/in/ATTRIBUTION.md" className="underline decoration-dotted hover:text-slate-300">Details</a>
        </figcaption>
        </figure>
    );
}
