'use client';

/**
 * The app: a full-screen map of India with everything else on top of it.
 *   - Zooming in reveals more: states, then districts and their names, then roads up close.
 *   - Toll roads are drawn on the map (OpenStreetMap geometry, coloured tolled / toll-free).
 *   - Selecting a place, road or person opens the panel: a tall card on the left on wide
 *     screens, a drawer from the bottom on phones. The selection is kept in the URL (?v=...).
 *   - Search at the bottom covers places, roads and people, client-side, so it works offline.
 *
 * Boundaries come from one official-outline topology (public/geo/in/ATTRIBUTION.md). From city
 * zoom, streets, water and local names come from OpenStreetMap tiles with every border and
 * country/state name left out (./basemap.ts), so that outline stays the only border.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import maplibregl, { type LngLatBoundsLike, type MapGeoJSONFeature } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import Fuse from 'fuse.js';
import { Search, X, MapPin, User, Route as RouteIcon, Plus, Minus } from 'lucide-react';
import type { AtlasData } from '@/services/country.service';
import CompassMark from '@/components/CompassMark';
import { useTheme } from '@/lib/theme';
import Sheet, { PEEK_PX, useWide, type Snap } from './Sheet';
import QuickSettings from './QuickSettings';
import { addBasemap, paintBasemap, BASEMAP_GLYPHS, BASEMAP_PALETTE } from './basemap';
import { PlaceView, RoadView, PersonView, RoadsView, SeatView, ROLE, shortName } from './PanelViews';
import { loadSeats, paintSeats, showLines, seatFillLayers, SEAT_PALETTE, SEAT_ZOOM, type SeatGeo, type SeatPrefix } from './seats';
import { PLACE_ALIASES } from '@/lib/place-aliases';
import { atlasPath, parseAtlasPath, type AtlasRoute } from '@/lib/atlas-route';

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

type View =
    | { kind: 'roads' }
    | { kind: 'seat'; id: string }
    | { kind: 'place'; place: Place }
    | { kind: 'road'; slug: string }
    | { kind: 'person'; slug: string };

interface Label {
    name: string;
    kind: 'state' | 'district';
    stateSlug: string;
    code?: string;
    area: number;
    lngLat: [number, number];
}

interface RouteInfo {
    slug: string;
    bounds: Bounds;
    labelAt: [number, number];
    districts: Set<string>;
    states: Set<string>;
}

const INDIA_BOUNDS: LngLatBoundsLike = [[67.5, 6.2], [98.0, 37.6]];
const DISTRICT_ZOOM = 5.2;
const CITY_ZOOM = 8.5;
/**
 * The zoom from which the unit inside a state (district or seat) is drawn and selectable. Below it
 * the state is the unit. Lines, hover and tap all follow this one number per mode, so a line on the
 * map always means "this can be selected".
 */
const UNIT_ZOOM: Record<'districts' | SeatPrefix, number> = { districts: DISTRICT_ZOOM, ...SEAT_ZOOM };

const PALETTE = {
    light: {
        sea: '#e3e8ee', land: '#fbfbfa', landData: '#eef3fd', stateLine: '#c2c9d2', districtLine: '#d9dee5', outline: '#6b7584',
        hover: '#0f172a', hoverOpacity: 0.05, select: '#2563eb', selectOpacity: 0.07,
        tolled: '#ea580c', free: '#059669', casing: '#ffffff',
    },
    dark: {
        sea: '#0b0f14', land: '#161c24', landData: '#18233a', stateLine: '#344150', districtLine: '#232c37', outline: '#8b95a3',
        hover: '#ffffff', hoverOpacity: 0.06, select: '#60a5fa', selectOpacity: 0.12,
        tolled: '#fb923c', free: '#34d399', casing: '#0b0f14',
    },
};
type Palette = typeof PALETTE.light;

function bboxOf(geom: Geom | GeoJSON.MultiLineString): Bounds {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const pts = geom.type === 'Polygon' ? geom.coordinates.flat() : geom.type === 'MultiPolygon' ? geom.coordinates.flat(2) : geom.coordinates.flat();
    for (const [x, y] of pts) {
        if (x < minX) minX = x; if (y < minY) minY = y;
        if (x > maxX) maxX = x; if (y > maxY) maxY = y;
    }
    return [[minX, minY], [maxX, maxY]];
}
const union = (a: Bounds, b: Bounds): Bounds => [[Math.min(a[0][0], b[0][0]), Math.min(a[0][1], b[0][1])], [Math.max(a[1][0], b[1][0]), Math.max(a[1][1], b[1][1])]];

/** Districts big enough to name at this zoom (smaller ones appear as you zoom in). */
const districtAreaThreshold = (zoom: number) => 25000 / Math.pow(2.6, zoom - DISTRICT_ZOOM);

function applyPalette(map: maplibregl.Map, p: Palette) {
    const set = (layer: string, prop: string, value: unknown) => { if (map.getLayer(layer)) map.setPaintProperty(layer, prop, value); };
    set('sea', 'background-color', p.sea);
    set('states-fill', 'fill-color', ['case', ['boolean', ['feature-state', 'data'], false], p.landData, p.land]);
    set('hover-shade', 'fill-color', p.hover);
    set('hover-shade', 'fill-opacity', ['case', ['boolean', ['feature-state', 'hover'], false], p.hoverOpacity, 0]);
    set('districts-fill', 'fill-color', p.hover);
    set('districts-fill', 'fill-opacity', ['case', ['boolean', ['feature-state', 'hover'], false], p.hoverOpacity, 0]);
    for (const src of ['states', 'districts']) {
        set(`${src}-selected-fill`, 'fill-color', p.select);
        set(`${src}-selected-fill`, 'fill-opacity', ['case', ['boolean', ['feature-state', 'selected'], false], p.selectOpacity, 0]);
        set(`${src}-selected`, 'line-color', p.select);
    }
    set('districts-line', 'line-color', p.districtLine);
    set('states-line', 'line-color', p.stateLine);
    set('india-outline', 'line-color', p.outline);
    set('routes-casing', 'line-color', p.casing);
    const road = ['match', ['get', 'tolling'], 'toll_free', p.free, p.tolled];
    set('routes-line', 'line-color', road);
    set('routes-selected', 'line-color', road);
}

interface AtlasProps {
    countryCode: string;
    countryName: string;
    data: AtlasData;
    /** The view named by the URL the page was opened at. */
    initial?: AtlasRoute;
}

export default function Atlas({ countryCode, countryName, data, initial }: AtlasProps) {
    const { regions, roads, people, lokSabha, assemblies, mplads } = data;
    const { choice, dark, setTheme } = useTheme();
    const wide = useWide();

    const container = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const markersRef = useRef<{ states: maplibregl.Marker[]; districts: maplibregl.Marker[]; roads: maplibregl.Marker[] }>({ states: [], districts: [], roads: [] });
    const selectedRef = useRef<{ source: string; id: string } | null>(null);
    const routesRef = useRef(new Map<string, RouteInfo>());
    const wideRef = useRef(wide);
    const darkRef = useRef(dark);
    wideRef.current = wide;
    darkRef.current = dark;

    const [ready, setReady] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const [places, setPlaces] = useState<Place[]>([]);
    const [view, setView] = useState<View | null>(null);
    const [snap, setSnap] = useState<Snap>('half');
    const [query, setQuery] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);
    const [bearing, setBearing] = useState(0);
    // What the lines inside states show: 2011 districts, Lok Sabha seats (pc) or assembly seats (ac).
    const [mode, setMode] = useState<'districts' | SeatPrefix>('districts');
    const modeRef = useRef(mode);
    modeRef.current = mode;
    // Bounds, districts and Lok Sabha seat of every seat loaded so far (both houses; ids do not clash).
    const [seatGeo, setSeatGeo] = useState<Map<string, SeatGeo> | null>(null);
    const [acLoaded, setAcLoaded] = useState(false);
    const seatLoad = useRef<Partial<Record<SeatPrefix, Promise<Map<string, SeatGeo>>>>>({});
    const relayout = useRef<() => void>(() => {});
    // Per kind of seat, once loaded: the fill layers to hit-test and the states that have seat shapes.
    const seatHit = useRef<Partial<Record<SeatPrefix, { layers: string[]; states: Set<string> }>>>({});

    const roadBySlug = useMemo(() => new Map(roads.map(r => [r.slug, r])), [roads]);
    const personBySlug = useMemo(() => new Map(people.map(p => [p.slug, p])), [people]);
    const seats = useMemo(() => lokSabha?.seats ?? [], [lokSabha]);
    const acSeats = useMemo(() => Object.values(assemblies).flatMap(h => h.seats), [assemblies]);
    const seatById = useMemo(() => new Map([...seats, ...acSeats].map(x => [x.id, x])), [seats, acSeats]);
    const acIds = useMemo(() => new Set(acSeats.map(x => x.id)), [acSeats]);
    const isAc = useCallback((id: string) => acIds.has(id), [acIds]);
    const placeName = useCallback((slug: string) => regions[slug]?.name ?? places.find(p => p.kind === 'state' && p.stateSlug === slug)?.name ?? slug, [regions, places]);

    // ---------- search (all client-side) ----------
    type Item = { type: 'place' | 'road' | 'person' | 'seat'; label: string; sub: string; extra: string[]; place?: Place; slug?: string };

    const items = useMemo<Item[]>(() => [
        ...seats.map(x => ({
            type: 'seat' as const, label: x.member?.name ?? `${x.name} (vacant)`, slug: x.id,
            sub: `MP for ${x.name}, ${placeName(x.state)}${x.member ? ` · ${x.member.partyShort ?? x.member.party}` : ''}`,
            extra: [x.name, x.member?.party ?? '', x.member?.partyShort ?? ''],
        })),
        ...acSeats.map(x => ({
            type: 'seat' as const, label: x.member?.name ?? `${x.name} (vacant)`, slug: x.id,
            sub: `MLA for ${x.name}, ${placeName(x.state)}${x.member ? ` · ${x.member.partyShort ?? x.member.party}` : ''}`,
            extra: [x.name, x.member?.party ?? '', x.member?.partyShort ?? ''],
        })),
        ...roads.map(r => ({ type: 'road' as const, label: shortName(r.name), sub: `Toll road · ${r.regionIds.map(placeName).join(', ')}`, extra: [r.name, r.officialName ?? '', r.operatorCompany ?? ''], slug: r.slug })),
        ...people.map(p => ({ type: 'person' as const, label: p.name, sub: [ROLE[p.role] || p.role, p.party].filter(Boolean).join(' · '), extra: [p.party ?? '', p.role], slug: p.slug })),
        ...places.map(p => {
            const aka = p.kind === 'district' ? PLACE_ALIASES[`${p.stateSlug}/${p.name}`] ?? [] : [];
            return {
                type: 'place' as const, label: p.name, extra: aka, place: p,
                sub: p.kind === 'district'
                    ? `District · ${p.state}${aka.length ? ` · also ${aka.join(', ')}` : ''}`
                    : regions[p.stateSlug]?.level === 'union_territory' ? 'Union territory' : 'State',
            };
        }),
    ], [roads, people, places, regions, placeName, seats, acSeats]);
    const fuse = useMemo(() => new Fuse(items, { keys: [{ name: 'label', weight: 3 }, { name: 'extra', weight: 1 }], threshold: 0.25, ignoreLocation: true }), [items]);
    const matches = query.trim().length >= 2 ? fuse.search(query.trim(), { limit: 8 }).map(r => r.item) : [];

    // ---------- selection ----------
    const padding = useCallback(() => {
        const h = window.innerHeight;
        return wideRef.current
            ? { top: 96, bottom: 110, left: 440 + 56, right: 80 }
            : { top: 80, bottom: Math.round(h * 0.52) + 24, left: 28, right: 28 };
    }, []);

    const clearHighlights = useCallback(() => {
        const map = mapRef.current;
        if (!map) return;
        if (selectedRef.current) map.setFeatureState(selectedRef.current, { selected: false });
        selectedRef.current = null;
        if (map.getLayer('routes-selected')) map.setFilter('routes-selected', ['==', ['get', 'slug'], '']);
    }, []);

    const openPlace = useCallback((place: Place, fly = true) => {
        const map = mapRef.current;
        if (!map) return;
        clearHighlights();
        selectedRef.current = place.kind === 'state' ? { source: 'states', id: place.stateSlug } : { source: 'districts', id: place.code! };
        map.setFeatureState(selectedRef.current, { selected: true });
        setView({ kind: 'place', place });
        // A district is drawn only with district lines; show them, so its edge and name are on the map.
        if (place.kind === 'district') setMode('districts');
        setSnap('half');
        setQuery('');
        setSearchOpen(false);
        if (fly) map.fitBounds(place.bounds, { padding: padding(), maxZoom: place.kind === 'district' ? 9 : 7, duration: 900 });
    }, [clearHighlights, padding]);

    const openRoad = useCallback((slug: string, fly = true) => {
        const map = mapRef.current;
        if (!map || !roadBySlug.has(slug)) return;
        clearHighlights();
        if (map.getLayer('routes-selected')) map.setFilter('routes-selected', ['==', ['get', 'slug'], slug]);
        setView({ kind: 'road', slug });
        setSnap('half');
        setQuery('');
        setSearchOpen(false);
        const r = routesRef.current.get(slug);
        if (fly && r) map.fitBounds(r.bounds, { padding: padding(), maxZoom: 12, duration: 1100 });
    }, [clearHighlights, padding, roadBySlug]);

    const openPerson = useCallback((slug: string, fly = true) => {
        const map = mapRef.current;
        const person = personBySlug.get(slug);
        if (!map || !person) return;
        clearHighlights();
        setView({ kind: 'person', slug });
        setSnap('half');
        setQuery('');
        setSearchOpen(false);
        const home = person.regionId ? places.find(p => p.kind === 'state' && p.stateSlug === person.regionId) : undefined;
        if (home) {
            selectedRef.current = { source: 'states', id: home.stateSlug };
            map.setFeatureState(selectedRef.current, { selected: true });
            if (fly) map.fitBounds(home.bounds, { padding: padding(), maxZoom: 7, duration: 900 });
        }
    }, [clearHighlights, padding, personBySlug, places]);

    /**
     * Loads one kind of seat layer once, when first needed: Lok Sabha seats (~2 MB, the whole country) or
     * the assembly seats of every state whose assembly we have (one file per state).
     */
    const ensureSeats = useCallback((prefix: SeatPrefix) => {
        const map = mapRef.current;
        if (!map) return Promise.reject(new Error('no map'));
        const pal = SEAT_PALETTE[darkRef.current ? 'dark' : 'light'];
        const merge = (geo: Map<string, SeatGeo>) => { setSeatGeo(prev => new Map([...(prev ?? []), ...geo])); return geo; };
        seatLoad.current[prefix] ??= (prefix === 'pc'
            ? loadSeats(map, 'pc', { polys: `/geo/${countryCode}/pc.geojson`, lines: `/geo/${countryCode}/pc-lines.geojson` }, pal, 'states-line')
            : Promise.all(Object.keys(assemblies).map(st => loadSeats(map, 'ac', { polys: `/geo/${countryCode}/ac/${st}.geojson`, lines: `/geo/${countryCode}/ac/${st}-lines.geojson` }, pal, 'states-line', `ac-${st}`)))
                .then(all => { setAcLoaded(true); return new Map(all.flatMap(g => [...g])); })
        ).then(geo => {
            seatHit.current[prefix] = { layers: seatFillLayers(map, prefix), states: new Set([...geo.keys()].map(k => k.slice(0, k.indexOf(':')))) };
            return merge(geo);
        });
        return seatLoad.current[prefix]!;
    }, [countryCode, assemblies]);

    const openSeat = useCallback((id: string, fly = true) => {
        const map = mapRef.current;
        const seat = seatById.get(id);
        if (!map || !seat) return;
        const prefix: SeatPrefix = isAc(id) ? 'ac' : 'pc';
        clearHighlights();
        setView({ kind: 'seat', id });
        setMode(prefix);
        setSnap('half');
        setQuery('');
        setSearchOpen(false);
        ensureSeats(prefix).then(geo => {
            const g = geo.get(id);
            if (g) {
                selectedRef.current = { source: prefix === 'pc' ? 'pc' : `ac-${seat.state}`, id };
                map.setFeatureState(selectedRef.current, { selected: true });
                if (fly) map.fitBounds(g.bounds, { padding: padding(), maxZoom: prefix === 'ac' ? 12 : 10.5, duration: 900 });
            } else if (fly) {
                const st = places.find(p => p.kind === 'state' && p.stateSlug === seat.state);
                if (st) map.fitBounds(st.bounds, { padding: padding(), maxZoom: 7, duration: 900 });
            }
        }).catch(() => {});
    }, [clearHighlights, ensureSeats, isAc, padding, places, seatById]);

    const openRoads = useCallback(() => {
        clearHighlights();
        setView({ kind: 'roads' });
        setSnap('half');
        setSearchOpen(false);
    }, [clearHighlights]);

    const closeView = useCallback(() => {
        clearHighlights();
        setView(null);
    }, [clearHighlights]);

    // Map callbacks are bound once; route them to the latest handlers.
    const handlers = useRef({ openPlace, openRoad, openSeat, closeView });
    handlers.current = { openPlace, openRoad, openSeat, closeView };

    // ---------- the map ----------
    useEffect(() => {
        if (!container.current) return;
        const pal = PALETTE[darkRef.current ? 'dark' : 'light'];
        const map = new maplibregl.Map({
            container: container.current,
            style: { version: 8, glyphs: BASEMAP_GLYPHS, sources: {}, layers: [{ id: 'sea', type: 'background', paint: { 'background-color': pal.sea } }] },
            bounds: INDIA_BOUNDS,
            maxBounds: [[40, -10], [125, 50]],
            minZoom: 2.5,
            maxZoom: 15,
            maxPitch: 0,
            attributionControl: false,
        });
        map.addControl(new maplibregl.ScaleControl({ maxWidth: 96, unit: 'metric' }), 'bottom-right');
        map.on('rotate', () => setBearing(map.getBearing()));
        mapRef.current = map;
        // Handle for automated checks in development only.
        if (process.env.NODE_ENV !== 'production') (window as unknown as { __atlasMap?: maplibregl.Map }).__atlasMap = map;

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
            const [labelJson, routeJson] = await Promise.all(['labels', 'routes'].map(f =>
                fetch(`/geo/${countryCode}/${f}.geojson`).then(r => (r.ok ? r.json() : null)).catch(() => null)
            ));
            const labels: Label[] = (labelJson?.features ?? []).map((f: GeoJSON.Feature<GeoJSON.Point, Record<string, string | number>>) => ({
                name: String(f.properties.name), kind: f.properties.kind as 'state' | 'district', stateSlug: String(f.properties.stateSlug),
                code: f.properties.census2011Code ? String(f.properties.census2011Code) : undefined,
                area: Number(f.properties.areaKm2 ?? 0), lngLat: f.geometry.coordinates as [number, number],
            }));

            // Roads: tag each section with whether it is tolled, and work out where to label it.
            const routes: GeoJSON.FeatureCollection<GeoJSON.MultiLineString> = routeJson ?? { type: 'FeatureCollection', features: [] };
            routes.features = routes.features.filter(f => roadBySlug.has(f.properties?.slug));
            for (const f of routes.features) {
                const slug = f.properties!.slug as string;
                f.properties!.tolling = roadBySlug.get(slug)!.tolling?.status ?? 'tolled';
                const b = bboxOf(f.geometry);
                const prev = routesRef.current.get(slug);
                const longest = f.geometry.coordinates.reduce((a, l) => (l.length > a.length ? l : a), [] as GeoJSON.Position[]);
                routesRef.current.set(slug, {
                    slug,
                    bounds: prev ? union(prev.bounds, b) : b,
                    labelAt: prev?.labelAt ?? (longest[Math.floor(longest.length / 2)] as [number, number]),
                    districts: new Set([...(prev?.districts ?? []), ...(f.properties!.districts as string[])]),
                    states: new Set([...(prev?.states ?? []), ...(f.properties!.states as string[])]),
                });
            }

            map.addSource('states', { type: 'geojson', data: states, promoteId: 'slug' });
            map.addSource('districts', { type: 'geojson', data: districts, promoteId: 'census2011Code' });
            map.addSource('india', { type: 'geojson', data: india });
            map.addSource('routes', { type: 'geojson', data: routes });

            // States with something on record get a light tint.
            const withData = new Set(Object.values(regions).filter(r => r.tollRoads.length || r.people.length).map(r => r.slug));
            for (const r of routesRef.current.values()) r.states.forEach(s => withData.add(s));
            for (const slug of withData) map.setFeatureState({ source: 'states', id: slug }, { data: true });

            map.addLayer({ id: 'states-fill', type: 'fill', source: 'states', paint: {} });
            map.addLayer({ id: 'hover-shade', type: 'fill', source: 'states', paint: {} });
            map.addLayer({ id: 'states-selected-fill', type: 'fill', source: 'states', paint: {} });
            map.addLayer({ id: 'districts-fill', type: 'fill', source: 'districts', minzoom: DISTRICT_ZOOM, paint: {} });
            map.addLayer({ id: 'districts-selected-fill', type: 'fill', source: 'districts', paint: {} });
            map.addLayer({ id: 'districts-line', type: 'line', source: 'districts', minzoom: DISTRICT_ZOOM, paint: { 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.5, 10, 1.2] } });
            map.addLayer({ id: 'states-line', type: 'line', source: 'states', paint: { 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.6, 8, 1.6] } });
            map.addLayer({ id: 'india-outline', type: 'line', source: 'india', paint: { 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1.2, 8, 2.2] } });
            for (const src of ['states', 'districts'] as const) {
                map.addLayer({ id: `${src}-selected`, type: 'line', source: src, paint: { 'line-width': ['case', ['boolean', ['feature-state', 'selected'], false], 2, 0] } });
            }
            const roadWidth = (base: number) => ['interpolate', ['exponential', 1.6], ['zoom'], 4, base, 9, base * 2.2, 13, base * 4.5];
            map.addLayer({ id: 'routes-casing', type: 'line', source: 'routes', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-width': roadWidth(3.4) as unknown as number } });
            map.addLayer({ id: 'routes-line', type: 'line', source: 'routes', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-width': roadWidth(1.6) as unknown as number } });
            map.addLayer({
                id: 'routes-selected', type: 'line', source: 'routes', filter: ['==', ['get', 'slug'], ''],
                layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-width': roadWidth(3) as unknown as number, 'line-opacity': 0.9 },
            });
            // A wide invisible line so roads are easy to tap.
            map.addLayer({ id: 'routes-hit', type: 'line', source: 'routes', paint: { 'line-width': 22, 'line-opacity': 0 } });
            applyPalette(map, pal);
            // Streets, water and local names from city zoom (src/components/atlas/basemap.ts).
            addBasemap(map, BASEMAP_PALETTE[darkRef.current ? 'dark' : 'light'], { fills: 'hover-shade', roads: 'states-line' });

            setPlaces([
                ...(states.features as GeoJSON.Feature<Geom, Record<string, string>>[]).map(f => ({
                    kind: 'state' as const, name: f.properties.name, stateSlug: f.properties.slug, bounds: bboxOf(f.geometry),
                })),
                ...(districts.features as GeoJSON.Feature<Geom, Record<string, string>>[])
                    .filter(f => f.properties.census2011Code && f.properties.census2011Code !== '0')
                    .map(f => ({
                        kind: 'district' as const, name: f.properties.name, state: f.properties.state, stateSlug: f.properties.stateSlug,
                        code: f.properties.census2011Code, bounds: bboxOf(f.geometry),
                    })),
            ]);

            // ---- labels: roads first, then districts (once zoomed in), then states ----
            const roadLabels = [...routesRef.current.values()].map(r => {
                const road = roadBySlug.get(r.slug)!;
                const el = document.createElement('button');
                el.type = 'button';
                el.className = 'atlas-label atlas-road';
                el.style.setProperty('--road', road.tolling?.status === 'toll_free' ? 'var(--ftw-free)' : 'var(--ftw-tolled)');
                el.innerHTML = '<i></i><span></span>';
                el.querySelector('span')!.textContent = shortName(road.name);
                el.setAttribute('aria-label', `${road.name}: open`);
                el.addEventListener('click', e => { e.stopPropagation(); handlers.current.openRoad(r.slug); });
                markersRef.current.roads.push(new maplibregl.Marker({ element: el, anchor: 'left', offset: [-5, 0] }).setLngLat(r.labelAt).addTo(map));
                return { el, at: r.labelAt, w: shortName(road.name).length * 7 + 24 };
            });
            const stateLabels = labels.filter(x => x.kind === 'state').map(l => {
                const el = document.createElement('div');
                el.className = 'atlas-label atlas-label-state';
                el.textContent = l.name;
                markersRef.current.states.push(new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(l.lngLat).addTo(map));
                return { label: l, el, data: withData.has(l.stateSlug) };
            });
            const districtLabels = labels.filter(x => x.kind === 'district').sort((a, b) => b.area - a.area);

            const layoutLabels = () => {
                const z = map.getZoom();
                const zoomed = z >= DISTRICT_ZOOM;
                container.current?.classList.toggle('atlas-zoomed', zoomed);
                container.current?.classList.toggle('atlas-zoomed-city', z >= CITY_ZOOM);
                const small = window.innerWidth < 640;
                const placed: [number, number, number, number][] = [];
                const fits = (x: number, y: number, w: number, h: number, ax: 'center' | 'left' = 'center') => {
                    const x0 = ax === 'left' ? x : x - w / 2;
                    const box: [number, number, number, number] = [x0, y - h / 2, x0 + w, y + h / 2];
                    if (placed.some(p => box[0] < p[2] && box[2] > p[0] && box[1] < p[3] && box[3] > p[1])) return false;
                    placed.push(box);
                    return true;
                };
                for (const r of roadLabels) {
                    const p = map.project(r.at);
                    r.el.style.display = fits(p.x - 6, p.y, r.w, 20, 'left') ? '' : 'none';
                }
                markersRef.current.districts.forEach(m => m.remove());
                markersRef.current.districts = [];
                if (zoomed && z < 10.5 && modeRef.current === 'districts') {
                    const b = map.getBounds();
                    const min = districtAreaThreshold(z);
                    const sel = selectedRef.current?.source === 'districts' ? selectedRef.current.id : null;
                    const ordered = sel ? [...districtLabels.filter(l => l.code === sel), ...districtLabels.filter(l => l.code !== sel)] : districtLabels;
                    for (const l of ordered) {
                        if ((l.area < min && l.code !== sel) || !b.contains(l.lngLat)) continue;
                        const p = map.project(l.lngLat);
                        if (!fits(p.x, p.y, l.name.length * 6.8 + 8, 18)) continue;
                        const el = document.createElement('div');
                        el.className = 'atlas-label atlas-label-district';
                        el.textContent = l.name;
                        markersRef.current.districts.push(new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(l.lngLat).addTo(map));
                        if (markersRef.current.districts.length >= 150) break;
                    }
                }
                const px = zoomed ? 13 : small ? 9 : 11;
                for (const s of [...stateLabels].sort((a, b) => Number(b.data) - Number(a.data) || b.label.area - a.label.area)) {
                    if (!s.data && s.label.area < 5000 && !zoomed) { s.el.style.display = 'none'; continue; }
                    const p = map.project(s.label.lngLat);
                    s.el.style.display = fits(p.x, p.y, s.label.name.length * px * 0.82 + 10, px * 1.6) ? '' : 'none';
                }
            };
            map.on('moveend', layoutLabels);
            // Also while the map moves (a few times a second), so names keep up instead of jumping in at the end.
            let lastLayout = 0;
            map.on('move', () => {
                const t = performance.now();
                if (t - lastLayout < 160) return;
                lastLayout = t;
                layoutLabels();
            });
            relayout.current = layoutLabels;
            layoutLabels();

            // ---- hover and click: roads win over the unit in view (district or seat), the unit over states ----
            // Seat and district shapes do not meet exactly everywhere. A point that falls in a crack takes
            // the unit a few pixels away, in the same state, and never the whole state by accident.
            const unitAt = (pt: maplibregl.Point, layers: string[], stateSlug?: string): MapGeoJSONFeature | undefined => {
                for (const r of [0, 4, 9]) {
                    const found = map.queryRenderedFeatures(r ? [[pt.x - r, pt.y - r], [pt.x + r, pt.y + r]] : pt, { layers });
                    const f = r && stateSlug ? found.find(x => x.properties?.stateSlug === stateSlug) : found[0];
                    if (f) return f;
                }
            };
            const hit = (pt: maplibregl.Point): MapGeoJSONFeature | undefined => {
                const road = map.queryRenderedFeatures(pt, { layers: ['routes-hit'] })[0];
                if (road) return road;
                const mode = modeRef.current;
                const state = map.queryRenderedFeatures(pt, { layers: ['hover-shade'] })[0];
                if (map.getZoom() < UNIT_ZOOM[mode]) return state;
                const seats = mode === 'districts' ? undefined : seatHit.current[mode];
                const layers = mode === 'districts' ? ['districts-fill'] : seats?.layers ?? [];
                const unit = layers.length ? unitAt(pt, layers, state?.properties?.slug) : undefined;
                if (unit) return unit;
                // No seat here although this state's seats are drawn (an area the seat map leaves empty):
                // that is nothing, not the state. States with no seat shapes still open as states.
                if (mode === 'districts' || (state && seats?.states.has(state.properties?.slug))) return undefined;
                return state;
            };
            let hovered: { source: string; id: string | number } | null = null;
            const clearHover = () => {
                if (hovered) map.setFeatureState(hovered, { hover: false });
                hovered = null;
                map.getCanvas().style.cursor = '';
            };
            map.on('mousemove', e => {
                const f = hit(e.point);
                if (!f) return clearHover();
                map.getCanvas().style.cursor = 'pointer';
                if (f.layer.id === 'routes-hit' || f.id === undefined) { if (hovered) { map.setFeatureState(hovered, { hover: false }); hovered = null; } return; }
                const source = f.source;
                if (!hovered || hovered.id !== f.id || hovered.source !== source) {
                    clearHover();
                    hovered = { source, id: f.id };
                    map.setFeatureState(hovered, { hover: true });
                    map.getCanvas().style.cursor = 'pointer';
                }
            });
            map.on('mouseout', clearHover);
            map.on('click', e => {
                const f = hit(e.point);
                if (!f) return handlers.current.closeView();
                const p = f.properties as Record<string, string>;
                if (f.layer.id === 'routes-hit') return handlers.current.openRoad(p.slug, false);
                if (/^(pc|ac)-fill/.test(f.layer.id)) return handlers.current.openSeat(p.key, false);
                const geom = f.geometry as Geom;
                handlers.current.openPlace(
                    f.layer.id === 'districts-fill'
                        ? { kind: 'district', name: p.name, state: p.state, stateSlug: p.stateSlug, code: p.census2011Code, bounds: bboxOf(geom) }
                        : { kind: 'state', name: p.name, stateSlug: p.slug, bounds: bboxOf(geom) },
                    false
                );
            });

            map.resize();
            map.fitBounds(INDIA_BOUNDS, { padding: { top: 80, bottom: 110, left: 20, right: 20 }, animate: false });
            container.current?.setAttribute('data-ready', 'true');
            setReady(true);
        });

        const markers = markersRef.current;
        return () => {
            [...markers.states, ...markers.districts, ...markers.roads].forEach(m => m.remove());
            map.remove();
            mapRef.current = null;
        };
        // The map is created once; data and country are fixed for the page's lifetime.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Districts or seats: load the seat layers the first time, then swap which lines show.
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !ready) return;
        if (mode !== 'districts') {
            ensureSeats(mode).then(() => { showLines(map, mode); relayout.current(); })
                .catch(e => { console.error('Seats could not be loaded', e); setMode('districts'); });
        } else { showLines(map, 'districts'); relayout.current(); }
    }, [mode, ready, ensureSeats]);

    // Place and seat panels list the representatives whose seats cover them, so they need the seat files.
    useEffect(() => {
        if (!ready || !view || (view.kind !== 'place' && view.kind !== 'seat')) return;
        ensureSeats('pc').catch(() => {});
        if (Object.keys(assemblies).length) ensureSeats('ac').catch(() => {});
    }, [view, ready, ensureSeats, assemblies]);

    // Theme: repaint, don't rebuild.
    useEffect(() => {
        const map = mapRef.current;
        if (map && ready) {
            applyPalette(map, PALETTE[dark ? 'dark' : 'light']);
            paintBasemap(map, BASEMAP_PALETTE[dark ? 'dark' : 'light']);
            paintSeats(map, SEAT_PALETTE[dark ? 'dark' : 'light']);
        }
    }, [dark, ready]);

    // ---------- URLs and the Back button ----------
    // Each view has a path (src/lib/atlas-route.ts). Opening something pushes a history entry,
    // so Back closes the panel (or returns to the previous view); views applied from the URL
    // itself (first load, Back/Forward) replace instead of pushing.
    const fromUrl = useRef(true);

    const routeOf = useCallback((v: View | null): AtlasRoute =>
        !v ? { kind: 'home' }
            : v.kind === 'roads' ? { kind: 'roads' }
            : v.kind === 'seat' ? (isAc(v.id)
                ? { kind: 'assembly', state: v.id.slice(0, v.id.indexOf(':')), number: v.id.slice(v.id.indexOf(':') + 1) }
                : { kind: 'seat', state: v.id.slice(0, v.id.indexOf(':')), seat: v.id.slice(v.id.indexOf(':') + 1) })
            : v.kind === 'road' ? { kind: 'road', slug: v.slug }
            : v.kind === 'person' ? { kind: 'person', slug: v.slug }
            : v.place.kind === 'state' ? { kind: 'state', slug: v.place.stateSlug }
            : { kind: 'district', state: v.place.stateSlug, code: v.place.code! }, [isAc]);

    const applyRoute = useCallback((r: AtlasRoute) => {
        fromUrl.current = true;
        // If the route changes nothing (already showing it), no effect consumes the flag.
        setTimeout(() => { fromUrl.current = false; }, 100);
        switch (r.kind) {
            case 'home': return closeView();
            case 'roads': return openRoads();
            case 'seat': return openSeat(`${r.state}:${r.seat}`);
            case 'assembly': return openSeat(`${r.state}:${r.number}`);
            case 'road': return openRoad(r.slug);
            case 'person': return openPerson(r.slug);
            case 'state':
            case 'district': {
                const p = places.find(x => r.kind === 'state'
                    ? x.kind === 'state' && x.stateSlug === r.slug
                    : x.kind === 'district' && x.code === r.code);
                return p ? openPlace(p) : closeView();
            }
        }
    }, [closeView, openPlace, openPerson, openRoad, openRoads, openSeat, places]);

    // First load: the route the server was asked for (or an old ?v= link).
    useEffect(() => {
        if (!ready || !places.length) return;
        const v = new URLSearchParams(window.location.search).get('v');
        if (v) {
            const [kind, id] = [v.slice(0, v.indexOf(':')), v.slice(v.indexOf(':') + 1)];
            const legacy: AtlasRoute | null = kind === 'road' ? { kind: 'road', slug: id } : kind === 'person' ? { kind: 'person', slug: id }
                : kind === 'state' ? { kind: 'state', slug: id }
                : kind === 'district' ? { kind: 'district', state: places.find(p => p.code === id)?.stateSlug ?? '', code: id } : null;
            if (legacy) return applyRoute(legacy);
        }
        const here = parseAtlasPath(window.location.pathname.split('/').filter(Boolean).slice(1));
        applyRoute(here ?? initial ?? { kind: 'home' });
        // Only on first load.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready, places.length]);

    useEffect(() => {
        const onPop = () => {
            const segs = window.location.pathname.split('/').filter(Boolean).slice(1);
            applyRoute(parseAtlasPath(segs) ?? { kind: 'home' });
        };
        window.addEventListener('popstate', onPop);
        return () => window.removeEventListener('popstate', onPop);
    }, [applyRoute]);

    useEffect(() => {
        if (!ready) return;
        const path = atlasPath(countryCode, routeOf(view));
        const replace = fromUrl.current;
        fromUrl.current = false;
        if (path === window.location.pathname && !window.location.search) return; // already there (first load, Back/Forward)
        if (replace) window.history.replaceState(null, '', path);
        else window.history.pushState(null, '', path);
    }, [view, ready, countryCode, routeOf]);

    // ---------- what the panel shows ----------
    const panel = (() => {
        if (!view) return null;
        if (view.kind === 'roads') {
            return { key: 'roads', body: <RoadsView roads={roads} placeName={placeName} onRoad={s => openRoad(s)} /> };
        }
        if (view.kind === 'seat') {
            const seat = seatById.get(view.id);
            const ac = isAc(view.id);
            const house = ac ? assemblies[seat?.state ?? ''] : lokSabha;
            if (!seat || !house) return null;
            const codes = seatGeo?.get(seat.id)?.districts ?? [];
            const districts = codes.map(c => places.find(p => p.kind === 'district' && p.code === c)).filter((p): p is Place => !!p);
            const parent = ac && seat.lokSabhaSeat ? seatById.get(seat.lokSabhaSeat) : undefined;
            const inside = ac ? undefined : (assemblies[seat.state]?.seats ?? []).filter(x => x.lokSabhaSeat === seat.id);
            return {
                key: `seat:${seat.id}`,
                body: <SeatView seat={seat} house={house} stateName={placeName(seat.state)} country={countryCode}
                    districts={districts.map(d => ({ code: d.code!, name: d.name }))}
                    parent={parent} parentHouse={lokSabha ?? undefined} inside={inside} insideHouse={assemblies[seat.state]}
                    mplads={!ac && mplads?.bySeat[seat.id] ? {
                        term: mplads.term, asOf: mplads.asOf, source: mplads.source, seat: mplads.bySeat[seat.id],
                        nationalPaidShare: Math.round((mplads.totals.paid / mplads.totals.allocated) * 100),
                        worksUrl: mplads.worksStates.includes(seat.state) ? `/data/mplads/lok-sabha-${mplads.term}/${seat.state}/${seat.id.slice(seat.id.indexOf(':') + 1)}.json` : undefined,
                    } : undefined}
                    onPlace={c => { const d = districts.find(x => x.code === c); if (d) openPlace(d); }} onSeat={id => openSeat(id)} />,
            };
        }
        if (view.kind === 'road') {
            const road = roadBySlug.get(view.slug);
            return road ? { key: `road:${road.slug}`, body: <RoadView road={road} country={countryCode} stateNames={road.regionIds.map(placeName)} /> } : null;
        }
        if (view.kind === 'person') {
            const person = personBySlug.get(view.slug);
            return person ? { key: `person:${person.slug}`, body: <PersonView person={person} country={countryCode} regionName={person.regionId ? placeName(person.regionId) : undefined} /> } : null;
        }
        const pl = view.place;
        const inPlace = roads.filter(r => {
            const route = routesRef.current.get(r.slug);
            return pl.kind === 'district' ? !!route?.districts.has(pl.code!) : r.regionIds.includes(pl.stateSlug) || !!route?.states.has(pl.stateSlug);
        });
        const here = people.filter(p => p.regionId === pl.stateSlug || (p.regionIds ?? []).includes(pl.stateSlug));
        const seatsHere = pl.kind === 'state'
            ? seats.filter(x => x.state === pl.stateSlug)
            : seats.filter(x => seatGeo?.get(x.id)?.districts.includes(pl.code!));
        const assembly = assemblies[pl.stateSlug] ?? null;
        const mlasHere = !assembly ? [] : pl.kind === 'state'
            ? assembly.seats
            : assembly.seats.filter(x => seatGeo?.get(x.id)?.districts.includes(pl.code!));
        return {
            key: `place:${pl.kind}:${pl.code ?? pl.stateSlug}`,
            body: <PlaceView place={pl} region={regions[pl.stateSlug]} roads={inPlace} people={here} seats={seatsHere} seatsLoading={pl.kind === 'district' && (!seatGeo || (!!assembly && !acLoaded))}
                lokSabha={lokSabha} mlas={mlasHere} assembly={assembly} country={countryCode} onRoad={s => openRoad(s)} onPerson={s => openPerson(s)} onSeat={id => openSeat(id)} />,
        };
    })();

    // Where the bottom-right controls sit: above the search bar, or above the drawer at peek.
    const drawerOpen = !wide && !!panel;
    const ctrlHidden = drawerOpen && snap !== 'peek';
    const ctrlBottom = wide ? 16 : drawerOpen ? PEEK_PX + 12 : 100;
    const north = Math.abs(bearing) > 0.5;

    return (
        <div className="atlas relative h-[100dvh] w-full overflow-hidden bg-ftw-bg text-ftw-text"
            style={{ ['--ctrl-bottom' as string]: `${ctrlBottom}px`, ['--ctrl-visible' as string]: ctrlHidden ? 'hidden' : 'visible' }}>
            {/* h-full, not absolute: maplibre-gl.css sets .maplibregl-map { position: relative } */}
            <div ref={container} className="h-full w-full" />

            {/* Brand */}
            <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex items-start justify-between sm:inset-x-4 sm:top-4">
                <a href={`/${countryCode}`} className="pointer-events-auto flex h-11 items-center gap-2.5 rounded-full border border-ftw-line bg-ftw-surface/95 pl-2 pr-4 shadow-sm backdrop-blur">
                    <CompassMark className="h-7 w-7 text-ftw-text" />
                    <span className="text-[15px] font-semibold tracking-tight">data.ftw</span>
                    <span className="hidden h-4 w-px bg-ftw-line sm:block" />
                    <span className="hidden text-sm text-ftw-muted sm:block">{countryName}</span>
                </a>
                <div className="pointer-events-auto flex items-start gap-2">
                    {lokSabha && (
                        <div role="radiogroup" aria-label="Lines inside states" className="flex h-11 items-center rounded-full border border-ftw-line bg-ftw-surface/95 p-1 shadow-sm backdrop-blur">
                            {([['districts', 'Districts'], ['pc', 'MPs'], ...(Object.keys(assemblies).length ? [['ac', 'MLAs']] : [])] as ['districts' | SeatPrefix, string][]).map(([v, label]) => (
                                <button key={v} role="radio" aria-checked={mode === v} onClick={() => setMode(v)}
                                    title={v === 'pc' ? 'Lok Sabha seats and their MPs' : v === 'ac' ? `Assembly seats and their MLAs (${Object.keys(assemblies).map(placeName).join(', ')} so far)` : '2011 districts'}
                                    className={`h-full rounded-full px-2.5 text-xs font-semibold sm:px-3.5 ${mode === v ? 'bg-ftw-text text-ftw-surface' : 'text-ftw-muted hover:text-ftw-text'}`}>
                                    {label}
                                </button>
                            ))}
                        </div>
                    )}
                    <QuickSettings country={countryCode} theme={choice} onTheme={setTheme} onRoads={openRoads} />
                </div>
            </div>

            {/* Legend, wide screens with nothing open (phones: in the menu) */}
            {wide && !panel && ready && (
                <div className="absolute bottom-4 left-4 z-10 space-y-1.5 rounded-xl border border-ftw-line bg-ftw-surface/95 px-3 py-2.5 text-xs text-ftw-muted shadow-sm backdrop-blur">
                    <p className="flex items-center gap-2"><span className="h-1 w-6 rounded-full bg-ftw-tolled" />Tolled road</p>
                    <p className="flex items-center gap-2"><span className="h-1 w-6 rounded-full bg-ftw-free" />Toll-free road</p>
                    <p className="flex items-center gap-2"><span className="h-3 w-6 rounded-sm border border-ftw-accent/40 bg-ftw-accent/10" />State with records</p>
                </div>
            )}

            {/* Panel / drawer */}
            {panel && (
                <Sheet wide={wide} snap={snap} onSnap={setSnap} onClose={closeView} viewKey={panel.key}>
                    {panel.body}
                    <p className="border-t border-ftw-line px-5 py-3 text-[11px] text-ftw-faint"><MapCredit /></p>
                </Sheet>
            )}

            {/* Zoom, compass (north / home) */}
            <div className="absolute right-3 z-20 flex flex-col items-center gap-2 transition-[bottom] duration-200 sm:right-4"
                style={{ bottom: ctrlBottom, visibility: ctrlHidden ? 'hidden' : 'visible' }}>
                {wide && (
                    <div className="flex flex-col overflow-hidden rounded-full border border-ftw-line bg-ftw-surface/95 shadow-sm backdrop-blur">
                        <button onClick={() => mapRef.current?.zoomIn()} aria-label="Zoom in" className="flex h-10 w-11 items-center justify-center text-ftw-text hover:bg-ftw-raised"><Plus className="h-4 w-4" /></button>
                        <span className="mx-2.5 h-px bg-ftw-line" />
                        <button onClick={() => mapRef.current?.zoomOut()} aria-label="Zoom out" className="flex h-10 w-11 items-center justify-center text-ftw-text hover:bg-ftw-raised"><Minus className="h-4 w-4" /></button>
                    </div>
                )}
                <button
                    onClick={() => {
                        const map = mapRef.current;
                        if (!map) return;
                        if (north) map.easeTo({ bearing: 0, duration: 500 });
                        else map.fitBounds(INDIA_BOUNDS, { padding: { top: 80, bottom: 110, left: wide && panel ? 496 : 20, right: 20 }, duration: 900 });
                    }}
                    title={north ? 'Point north' : `Show all of ${countryName}`}
                    aria-label={north ? 'Point the map north' : `Show all of ${countryName}`}
                    className="flex h-12 w-12 items-center justify-center rounded-full border border-ftw-line bg-ftw-surface/95 shadow-md backdrop-blur hover:bg-ftw-raised">
                    {/* The mark turns with the map, so its red needle always points north. */}
                    <span className="block" style={{ transform: `rotate(${-bearing}deg)` }}>
                        <CompassMark className="h-9 w-9 text-ftw-text" />
                    </span>
                </button>
            </div>

            {/* Search, at the bottom (phones: hidden while the drawer is open) */}
            {!drawerOpen && (
                <div className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 flex justify-center px-3"
                    style={{ left: wide && panel ? 472 : 0, right: wide ? 76 : 0 }}>
                    <div className="w-full max-w-xl">
                        {searchOpen && query.trim().length >= 2 && (
                            <div className="mb-2 max-h-[50dvh] overflow-y-auto rounded-2xl border border-ftw-line bg-ftw-surface p-1.5 text-sm shadow-[0_8px_40px_rgba(0,0,0,0.15)]">
                                {matches.length ? matches.map(m => (
                                    <button key={`${m.type}-${m.slug ?? m.place?.code ?? m.place?.stateSlug}`}
                                        onClick={() => m.type === 'place' ? openPlace(m.place!) : m.type === 'road' ? openRoad(m.slug!) : m.type === 'seat' ? openSeat(m.slug!) : openPerson(m.slug!)}
                                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-ftw-raised">
                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ftw-raised">
                                            {m.type === 'road' ? <RouteIcon className="h-4 w-4 text-ftw-tolled" /> : m.type === 'person' || m.type === 'seat' ? <User className="h-4 w-4 text-ftw-muted" /> : <MapPin className="h-4 w-4 text-ftw-muted" />}
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block truncate font-medium">{m.label}</span>
                                            <span className="block truncate text-xs text-ftw-muted">{m.sub}</span>
                                        </span>
                                    </button>
                                )) : <p className="px-4 py-3 text-ftw-muted">Nothing found for “{query.trim()}”.</p>}
                            </div>
                        )}
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ftw-muted" />
                            <input
                                value={query}
                                onChange={e => { setQuery(e.target.value); setSearchOpen(true); }}
                                onFocus={() => setSearchOpen(true)}
                                onKeyDown={e => {
                                    if (e.key === 'Escape') { setQuery(''); setSearchOpen(false); }
                                    if (e.key === 'Enter' && matches[0]) {
                                        const m = matches[0];
                                        if (m.type === 'place') openPlace(m.place!); else if (m.type === 'road') openRoad(m.slug!); else if (m.type === 'seat') openSeat(m.slug!); else openPerson(m.slug!);
                                    }
                                }}
                                placeholder="Search a place, MP, MLA, road or person"
                                aria-label="Search the atlas"
                                className="h-14 w-full rounded-full border border-ftw-line bg-ftw-surface pl-12 pr-12 text-base text-ftw-text shadow-[0_4px_24px_rgba(0,0,0,0.10)] placeholder:text-ftw-faint focus:border-ftw-accent focus:outline-none"
                            />
                            {query && (
                                <button onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-4 top-1/2 -translate-y-1/2 text-ftw-muted"><X className="h-5 w-5" /></button>
                            )}
                        </div>
                        <p className="mt-1.5 text-center text-[10px] text-ftw-faint"><MapCredit /></p>
                    </div>
                </div>
            )}

            {!ready && !loadError && (
                <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center text-sm text-ftw-muted">Loading the map…</div>
            )}
            {loadError && (
                <div className="absolute inset-0 z-20 flex items-center justify-center text-sm text-ftw-muted">Map boundaries could not be loaded.</div>
            )}
        </div>
    );
}

/**
 * Map credits, shown wherever the map is. OpenFreeMap asks for exactly
 * "OpenFreeMap © OpenMapTiles Data from OpenStreetMap", with links.
 */
function MapCredit() {
    const a = (href: string, text: string) => <a href={href} target="_blank" rel="noopener noreferrer" className="underline">{text}</a>;
    return (
        <>
            {a('https://openfreemap.org', 'OpenFreeMap')} {a('https://www.openmaptiles.org/', '© OpenMapTiles')} Data from {a('https://www.openstreetmap.org/copyright', 'OpenStreetMap')}
            {' · '}boundaries {a('https://github.com/datameet/maps', 'DataMeet')}{' · '}<Link href="/licences" className="underline">licences</Link>
        </>
    );
}
