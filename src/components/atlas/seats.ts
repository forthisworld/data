/**
 * Lok Sabha seats on the map: public/geo/<country>/pc.geojson (one polygon per seat, clipped to our
 * state boundaries) and pc-lines.geojson (lines between seats of the same state only), built by
 * scripts/build-constituencies.mjs. Loaded the first time they are needed.
 */
import type maplibregl from 'maplibre-gl';

type Bounds = [[number, number], [number, number]];

export interface SeatGeo {
    bounds: Bounds;
    /** Census 2011 district codes the seat overlaps meaningfully. */
    districts: string[];
}

export interface SeatPalette { line: string; select: string; selectOpacity: number; hover: string; hoverOpacity: number; label: string; halo: string }

export const SEAT_PALETTE: Record<'light' | 'dark', SeatPalette> = {
    light: { line: '#9aa5b4', select: '#2563eb', selectOpacity: 0.09, hover: '#0f172a', hoverOpacity: 0.05, label: '#475569', halo: '#ffffff' },
    dark: { line: '#4b5768', select: '#60a5fa', selectOpacity: 0.14, hover: '#ffffff', hoverOpacity: 0.06, label: '#a5b0bf', halo: '#0b0f14' },
};

const LAYERS = ['pc-fill', 'pc-selected-fill', 'pc-lines', 'pc-labels'];

function bboxOf(g: GeoJSON.Polygon | GeoJSON.MultiPolygon): Bounds {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of g.type === 'Polygon' ? g.coordinates.flat() : g.coordinates.flat(2)) {
        if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y;
    }
    return [[x0, y0], [x1, y1]];
}

/** Adds the seat layers (hidden) under `before`, and returns each seat's bounds and districts. */
export async function loadSeats(map: maplibregl.Map, country: string, p: SeatPalette, before: string): Promise<Map<string, SeatGeo>> {
    const [polys, lines] = await Promise.all(['pc', 'pc-lines'].map(f =>
        fetch(`/geo/${country}/${f}.geojson`).then(r => { if (!r.ok) throw new Error(`${f}: ${r.status}`); return r.json(); })));
    const geo = new Map<string, SeatGeo>();
    for (const f of (polys as GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon>).features) {
        if (!f.geometry) continue;
        geo.set(f.properties!.key, { bounds: bboxOf(f.geometry), districts: f.properties!.districts ?? [] });
    }
    if (map.getSource('pc')) return geo;
    map.addSource('pc', { type: 'geojson', data: polys, promoteId: 'key' });
    map.addSource('pc-lines', { type: 'geojson', data: lines });
    const hidden = { visibility: 'none' as const };
    map.addLayer({ id: 'pc-fill', type: 'fill', source: 'pc', layout: hidden, paint: {} }, before);
    map.addLayer({ id: 'pc-selected-fill', type: 'fill', source: 'pc', layout: hidden, paint: {} }, before);
    map.addLayer({ id: 'pc-lines', type: 'line', source: 'pc-lines', layout: hidden, paint: { 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.4, 9, 1.3] } }, before);
    map.addLayer({
        id: 'pc-labels', type: 'symbol', source: 'pc', minzoom: 5.6,
        layout: { ...hidden, 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 5.6, 10, 9, 13], 'text-max-width': 7, 'text-padding': 3 },
        paint: {},
    });
    paintSeats(map, p);
    return geo;
}

export function paintSeats(map: maplibregl.Map, p: SeatPalette) {
    const set = (layer: string, prop: string, value: unknown) => { if (map.getLayer(layer)) map.setPaintProperty(layer, prop, value); };
    set('pc-fill', 'fill-color', p.hover);
    set('pc-fill', 'fill-opacity', ['case', ['boolean', ['feature-state', 'hover'], false], p.hoverOpacity, 0]);
    set('pc-selected-fill', 'fill-color', p.select);
    set('pc-selected-fill', 'fill-opacity', ['case', ['boolean', ['feature-state', 'selected'], false], p.selectOpacity, 0]);
    set('pc-lines', 'line-color', p.line);
    set('pc-labels', 'text-color', p.label);
    set('pc-labels', 'text-halo-color', p.halo);
    set('pc-labels', 'text-halo-width', 1.3);
}

/** Seats mode shows seat lines and names instead of district lines. */
export function showSeats(map: maplibregl.Map, on: boolean) {
    for (const id of LAYERS) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
    for (const id of ['districts-line', 'districts-fill']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'none' : 'visible');
}
