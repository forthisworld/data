/**
 * Seats on the map: Lok Sabha seats (prefix "pc": public/geo/<country>/pc.geojson + pc-lines.geojson,
 * from scripts/build-constituencies.mjs) and assembly seats (prefix "ac": ac/<state>.geojson +
 * ac/<state>-lines.geojson, from scripts/build-assembly.mjs). Every seat is clipped to our state
 * boundaries and lines are drawn only between seats, so seats never draw a border of their own.
 * Loaded the first time they are needed.
 *
 * Seat lines appear, and seats can be hovered and selected, from SEAT_ZOOM: the same zoom for all
 * three, so a line on the map always means "this can be selected". Below it the state is the unit
 * (Atlas.tsx). Names come later (SEAT_NAME_ZOOM), when there is room for them.
 */
import type maplibregl from 'maplibre-gl';

type Bounds = [[number, number], [number, number]];
export type SeatPrefix = 'pc' | 'ac';

/**
 * The zoom from which each kind of seat is drawn and selectable. Lok Sabha seats: from the whole-country
 * view, on a phone too. Assembly seats: from the view that fits one state, on a phone too.
 */
export const SEAT_ZOOM: Record<SeatPrefix, number> = { pc: 2.5, ac: 5 };
/** The zoom from which seats are named. */
const SEAT_NAME_ZOOM: Record<SeatPrefix, number> = { pc: 5.6, ac: 7.6 };

export interface SeatGeo {
    bounds: Bounds;
    /** Census 2011 district codes the seat overlaps meaningfully. */
    districts: string[];
    /** Assembly seats: the Lok Sabha seat they lie in. */
    pcKey?: string;
}

export interface SeatPalette { line: string; select: string; selectOpacity: number; hover: string; hoverOpacity: number; label: string; halo: string }

export const SEAT_PALETTE: Record<'light' | 'dark', SeatPalette> = {
    light: { line: '#7d8999', select: '#2563eb', selectOpacity: 0.09, hover: '#0f172a', hoverOpacity: 0.05, label: '#475569', halo: '#ffffff' },
    dark: { line: '#5f6d82', select: '#60a5fa', selectOpacity: 0.14, hover: '#ffffff', hoverOpacity: 0.06, label: '#a5b0bf', halo: '#0b0f14' },
};

const layers = (x: SeatPrefix) => [`${x}-fill`, `${x}-selected-fill`, `${x}-selected-line`, `${x}-lines`, `${x}-labels`];

function bboxOf(g: GeoJSON.Polygon | GeoJSON.MultiPolygon): Bounds {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of g.type === 'Polygon' ? g.coordinates.flat() : g.coordinates.flat(2)) {
        if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y;
    }
    return [[x0, y0], [x1, y1]];
}

/**
 * Where to write a seat's name: a point well inside its largest part. (A name drawn from the
 * polygon itself is repeated in every map tile the seat crosses.)
 */
function labelPoint(g: GeoJSON.Polygon | GeoJSON.MultiPolygon): [number, number] {
    const size = (ring: GeoJSON.Position[]) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const [x, y] of ring) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; } return [x0, y0, x1, y1]; };
    const outer = (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).map(p => p[0])
        .reduce((a, b) => { const p = size(a), q = size(b); return (q[2] - q[0]) * (q[3] - q[1]) > (p[2] - p[0]) * (p[3] - p[1]) ? b : a; });
    const [x0, y0, x1, y1] = size(outer);
    // A thinned ring is enough to find a roomy spot.
    const step = Math.max(1, Math.floor(outer.length / 160));
    const ring = outer.filter((_, i) => i % step === 0);
    const inside = (px: number, py: number) => {
        let inRing = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const [xi, yi] = ring[i], [xj, yj] = ring[j];
            if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inRing = !inRing;
        }
        return inRing;
    };
    let best: [number, number] = [(x0 + x1) / 2, (y0 + y1) / 2], room = -1;
    const N = 12;
    for (let i = 1; i < N; i++) for (let j = 1; j < N; j++) {
        const px = x0 + ((x1 - x0) * i) / N, py = y0 + ((y1 - y0) * j) / N;
        if (!inside(px, py)) continue;
        let d = Infinity;
        for (const [x, y] of ring) { const q = (x - px) ** 2 + (y - py) ** 2; if (q < d) d = q; }
        if (d > room) { room = d; best = [px, py]; }
    }
    return best;
}

/**
 * Adds (or extends) a seat layer set, hidden, under `before`, and returns each seat's bounds and
 * districts. For assembly seats, call once per state: each state's file is added as its own source.
 * `names` gives each seat's name as the member list spells it, so the map and the panel agree.
 */
export async function loadSeats(map: maplibregl.Map, prefix: SeatPrefix, files: { polys: string; lines: string }, p: SeatPalette, before: string, sourceId: string = prefix, names?: Map<string, string>): Promise<Map<string, SeatGeo>> {
    const [polys, lines] = await Promise.all([files.polys, files.lines].map(u =>
        fetch(u).then(r => { if (!r.ok) throw new Error(`${u}: ${r.status}`); return r.json(); })));
    const geo = new Map<string, SeatGeo>();
    const labels: GeoJSON.Feature<GeoJSON.Point>[] = [];
    for (const f of (polys as GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon>).features) {
        if (!f.geometry) continue;
        geo.set(f.properties!.key, { bounds: bboxOf(f.geometry), districts: f.properties!.districts ?? [], pcKey: f.properties!.pcKey });
        labels.push({ type: 'Feature', properties: { name: names?.get(f.properties!.key) ?? f.properties!.name }, geometry: { type: 'Point', coordinates: labelPoint(f.geometry) } });
    }
    if (map.getSource(sourceId)) return geo;
    map.addSource(sourceId, { type: 'geojson', data: polys, promoteId: 'key' });
    map.addSource(`${sourceId}-lines`, { type: 'geojson', data: lines });
    map.addSource(`${sourceId}-names`, { type: 'geojson', data: { type: 'FeatureCollection', features: labels } });
    const hidden = { visibility: 'none' as const };
    const id = (kind: string) => (sourceId === prefix ? `${prefix}-${kind}` : `${prefix}-${kind}--${sourceId}`);
    const from = SEAT_ZOOM[prefix];
    map.addLayer({ id: id('fill'), type: 'fill', source: sourceId, minzoom: from, layout: hidden, paint: {} }, before);
    map.addLayer({ id: id('selected-fill'), type: 'fill', source: sourceId, layout: hidden, paint: {} }, before);
    // Wider as you zoom in, so seat lines stay apart from the streets drawn at city zoom.
    map.addLayer({ id: id('lines'), type: 'line', source: `${sourceId}-lines`, minzoom: from, layout: hidden, paint: { 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.4, 9, 1.3, 13, 2.2] } }, before);
    // The selected seat's own edge, as states and districts have.
    map.addLayer({ id: id('selected-line'), type: 'line', source: sourceId, layout: { ...hidden, 'line-join': 'round' }, paint: { 'line-width': ['case', ['boolean', ['feature-state', 'selected'], false], 2.5, 0] } }, before);
    map.addLayer({
        id: id('labels'), type: 'symbol', source: `${sourceId}-names`, minzoom: SEAT_NAME_ZOOM[prefix],
        layout: { ...hidden, 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 5.6, 10, 10, 13], 'text-max-width': 7, 'text-padding': 3 },
        paint: {},
    });
    paintSeats(map, p);
    return geo;
}

/** Every seat layer on the map, of one kind or all. */
export function seatLayers(map: maplibregl.Map, prefix?: SeatPrefix): string[] {
    const ids = (map.getStyle()?.layers ?? []).map(l => l.id);
    return ids.filter(i => (prefix ? [prefix] : (['pc', 'ac'] as const)).some(x => layers(x).some(base => i === base || i.startsWith(`${base}--`))));
}

export function paintSeats(map: maplibregl.Map, p: SeatPalette) {
    for (const id of seatLayers(map)) {
        const set = (prop: string, value: unknown) => map.setPaintProperty(id, prop, value);
        if (/-selected-line/.test(id)) set('line-color', p.select);
        else if (/-selected-fill/.test(id)) { set('fill-color', p.select); set('fill-opacity', ['case', ['boolean', ['feature-state', 'selected'], false], p.selectOpacity, 0]); }
        else if (/-fill/.test(id)) { set('fill-color', p.hover); set('fill-opacity', ['case', ['boolean', ['feature-state', 'hover'], false], p.hoverOpacity, 0]); }
        else if (/-lines/.test(id)) set('line-color', p.line);
        else if (/-labels/.test(id)) { set('text-color', p.label); set('text-halo-color', p.halo); set('text-halo-width', 1.3); }
    }
}

/** Which lines show inside states: 2011 districts, Lok Sabha seats or assembly seats. */
export function showLines(map: maplibregl.Map, mode: 'districts' | SeatPrefix) {
    // The selected seat stays marked whichever lines show, so an open panel always has its place on the map.
    for (const id of seatLayers(map)) map.setLayoutProperty(id, 'visibility', id.startsWith(`${mode}-`) || id.includes('-selected-') ? 'visible' : 'none');
    for (const id of ['districts-line', 'districts-fill']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', mode === 'districts' ? 'visible' : 'none');
}

/** Fill layers to hit-test for a kind of seat (one per loaded source). */
export const seatFillLayers = (map: maplibregl.Map, prefix: SeatPrefix) => seatLayers(map, prefix).filter(i => /-fill(--|$)/.test(i) && !i.includes('selected'));
