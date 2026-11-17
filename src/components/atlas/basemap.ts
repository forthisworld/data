/**
 * Streets, water, parks and local place names for city zoom, from OpenFreeMap's OpenStreetMap
 * vector tiles (https://openfreemap.org; data © OpenStreetMap contributors, schema OpenMapTiles).
 *
 * Only these layers are drawn. Nothing from the tiles' `boundary` layer, and no country or
 * state names, so the official outline drawn from our own boundary files stays the only border
 * on the map. The layers fade in from BASEMAP_ZOOM.
 *
 * Tiles come from OpenFreeMap's servers, which see the visitor's IP address (privacy page).
 * Later: host our own PMTiles extract on R2.
 */
import type maplibregl from 'maplibre-gl';

export const BASEMAP_ZOOM = 7.5;
export const BASEMAP_SOURCE = { type: 'vector' as const, url: 'https://tiles.openfreemap.org/planet' };
export const BASEMAP_GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';

export interface BasemapPalette {
    water: string;
    park: string;
    built: string;
    roadMinor: string;
    roadMajor: string;
    roadMotorway: string;
    label: string;
    halo: string;
}

export const BASEMAP_PALETTE: Record<'light' | 'dark', BasemapPalette> = {
    light: { water: '#cfdbe6', park: '#e4efe0', built: '#f1f2f4', roadMinor: '#e3e6ea', roadMajor: '#d3d8de', roadMotorway: '#c4cbd3', label: '#4b5563', halo: '#ffffff' },
    dark: { water: '#0d1a26', park: '#16241d', built: '#1a2029', roadMinor: '#232b36', roadMajor: '#2c3643', roadMotorway: '#364252', label: '#aab4c2', halo: '#0b0f14' },
};

const fade = (to: number) => ['interpolate', ['linear'], ['zoom'], BASEMAP_ZOOM, 0, BASEMAP_ZOOM + 1, to];
const src = { source: 'osm', minzoom: BASEMAP_ZOOM };
const FONT = ['Noto Sans Regular'];

/** Fills go just above the land; roads above district lines; labels on top. */
export function addBasemap(map: maplibregl.Map, p: BasemapPalette, slots: { fills: string; roads: string }) {
    map.addSource('osm', BASEMAP_SOURCE);
    const add = (layer: maplibregl.AddLayerObject, before: string | undefined) => map.addLayer(layer, before);

    add({ id: 'bm-built', type: 'fill', ...src, 'source-layer': 'landuse', filter: ['in', ['get', 'class'], ['literal', ['residential', 'commercial', 'industrial', 'retail']]], paint: { 'fill-color': p.built, 'fill-opacity': fade(1) as unknown as number } }, slots.fills);
    add({ id: 'bm-park', type: 'fill', ...src, 'source-layer': 'park', paint: { 'fill-color': p.park, 'fill-opacity': fade(1) as unknown as number } }, slots.fills);
    add({ id: 'bm-water', type: 'fill', ...src, 'source-layer': 'water', paint: { 'fill-color': p.water, 'fill-opacity': fade(1) as unknown as number } }, slots.fills);
    add({ id: 'bm-waterway', type: 'line', ...src, 'source-layer': 'waterway', paint: { 'line-color': p.water, 'line-width': 1.2, 'line-opacity': fade(1) as unknown as number } }, slots.fills);

    const roads: [string, string[], string, number][] = [
        ['bm-road-minor', ['minor', 'service', 'tertiary'], p.roadMinor, 0.6],
        ['bm-road-major', ['primary', 'secondary', 'trunk'], p.roadMajor, 1.1],
        ['bm-road-motorway', ['motorway'], p.roadMotorway, 1.5],
    ];
    for (const [id, classes, color, w] of roads) {
        add({
            id, type: 'line', ...src, 'source-layer': 'transportation',
            minzoom: id === 'bm-road-minor' ? 11 : BASEMAP_ZOOM,
            filter: ['in', ['get', 'class'], ['literal', classes]],
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': color, 'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 8, w * 0.6, 14, w * 4] as unknown as number, 'line-opacity': fade(1) as unknown as number },
        }, slots.roads);
    }
    add({
        id: 'bm-road-names', type: 'symbol', ...src, minzoom: 12, 'source-layer': 'transportation_name',
        filter: ['in', ['get', 'class'], ['literal', ['primary', 'secondary', 'trunk', 'motorway', 'tertiary']]],
        layout: { 'symbol-placement': 'line', 'text-field': ['coalesce', ['get', 'name_en'], ['get', 'name']], 'text-font': FONT, 'text-size': 11 },
        paint: { 'text-color': p.label, 'text-halo-color': p.halo, 'text-halo-width': 1.2 },
    }, undefined);
    add({
        id: 'bm-places', type: 'symbol', ...src, minzoom: 9, 'source-layer': 'place',
        filter: ['in', ['get', 'class'], ['literal', ['town', 'village', 'suburb', 'neighbourhood', 'quarter']]],
        layout: {
            'text-field': ['coalesce', ['get', 'name_en'], ['get', 'name']], 'text-font': FONT,
            'text-size': ['interpolate', ['linear'], ['zoom'], 9, 10, 13, 13], 'text-max-width': 8, 'text-padding': 4,
        },
        paint: { 'text-color': p.label, 'text-halo-color': p.halo, 'text-halo-width': 1.4, 'text-opacity': fade(1) as unknown as number },
    }, undefined);
}

export function paintBasemap(map: maplibregl.Map, p: BasemapPalette) {
    const set = (layer: string, prop: string, value: unknown) => { if (map.getLayer(layer)) map.setPaintProperty(layer, prop, value); };
    set('bm-built', 'fill-color', p.built);
    set('bm-park', 'fill-color', p.park);
    set('bm-water', 'fill-color', p.water);
    set('bm-waterway', 'line-color', p.water);
    set('bm-road-minor', 'line-color', p.roadMinor);
    set('bm-road-major', 'line-color', p.roadMajor);
    set('bm-road-motorway', 'line-color', p.roadMotorway);
    for (const id of ['bm-road-names', 'bm-places']) {
        set(id, 'text-color', p.label);
        set(id, 'text-halo-color', p.halo);
    }
}
