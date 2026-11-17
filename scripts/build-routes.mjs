#!/usr/bin/env node
/**
 * Draws toll roads on the map from OpenStreetMap (ODbL).
 *
 *   npm run geo:routes                 fetch the pinned ways in scripts/routes.json
 *   npm run geo:routes -- --discover   find the ways again by name (minus excludeWayIds), pin their IDs, then fetch
 *
 * Writes public/geo/<country>/routes.geojson: one feature per section of a road, with the
 * Census 2011 districts and the states it passes through (so selecting Bengaluru shows NICE Road
 * even though the record itself is filed under Karnataka).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const CONFIG = resolve(ROOT, 'scripts/routes.json');
const COUNTRY = 'in';
const OVERPASS = 'https://overpass-api.de/api/interpreter';
const discover = process.argv.includes('--discover');

async function overpass(query) {
    // The public server asks for exponential backoff when it is busy (429/502/504).
    for (let attempt = 0, wait = 5000; ; attempt++, wait *= 2) {
        const res = await fetch(OVERPASS, {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'data-ftw-build-routes' },
            body: 'data=' + encodeURIComponent(`[out:json][timeout:90];${query}`),
        });
        if (res.ok) return res.json();
        if (![429, 502, 503, 504].includes(res.status) || attempt >= 5) {
            throw new Error(`Overpass ${res.status}: ${(await res.text()).slice(0, 300)}`);
        }
        console.log(`Overpass busy (${res.status}); retrying in ${wait / 1000}s`);
        await new Promise(r => setTimeout(r, wait));
    }
}

// Point in polygon (ray casting), for the district join.
function inRing([x, y], ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i], [xj, yj] = ring[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
}
const inPolygon = (pt, rings) => inRing(pt, rings[0]) && !rings.slice(1).some(h => inRing(pt, h));
const inGeometry = (pt, g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).some(p => inPolygon(pt, p));

const config = JSON.parse(readFileSync(CONFIG, 'utf8'));

if (discover) {
    for (const route of config.routes) for (const s of route.sections) {
        const r = await overpass(`(${s.discover};);out ids;`);
        const skip = new Set(s.excludeWayIds ?? []);
        s.wayIds = r.elements.map(e => e.id).filter(id => !skip.has(id)).sort((a, b) => a - b);
        console.log(`${route.slug} / ${s.section}: ${s.wayIds.length} ways`);
    }
    writeFileSync(CONFIG, JSON.stringify(config, null, 2) + '\n');
}

const districts = JSON.parse(readFileSync(resolve(ROOT, `public/geo/${COUNTRY}/districts.geojson`), 'utf8')).features
    .filter(f => f.properties.census2011Code && f.properties.census2011Code !== '0');

const ids = config.routes.flatMap(r => r.sections.flatMap(s => s.wayIds));
if (!ids.length) throw new Error('No way IDs pinned; run with --discover first.');
const data = await overpass(`way(id:${ids.join(',')});out geom;`);
const byId = new Map(data.elements.map(e => [e.id, e]));
const round = n => Math.round(n * 1e5) / 1e5;

const features = [];
for (const route of config.routes) for (const s of route.sections) {
    const missing = s.wayIds.filter(id => !byId.has(id));
    if (missing.length) throw new Error(`${route.slug} / ${s.section}: ways not found in OSM: ${missing.join(', ')}`);
    const lines = s.wayIds.map(id => byId.get(id).geometry.map(p => [round(p.lon), round(p.lat)]));

    // Districts the road passes through, from every vertex.
    const hit = new Map();
    for (const line of lines) for (const pt of line) {
        const d = districts.find(f => inGeometry(pt, f.geometry));
        if (d) hit.set(d.properties.census2011Code, d.properties);
    }
    const ds = [...hit.values()];
    features.push({
        type: 'Feature',
        properties: {
            slug: route.slug,
            section: s.section,
            districts: ds.map(d => d.census2011Code),
            states: [...new Set(ds.map(d => d.stateSlug))],
            osmWays: s.wayIds.length,
        },
        geometry: { type: 'MultiLineString', coordinates: lines },
    });
    console.log(`${route.slug} / ${s.section}: ${lines.length} ways, districts ${ds.map(d => d.name).join(', ')}`);
}

writeFileSync(
    resolve(ROOT, `public/geo/${COUNTRY}/routes.geojson`),
    JSON.stringify({
        type: 'FeatureCollection',
        // Foreign members (RFC 7946 §6.1): where and when the lines came from.
        source: 'OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright)',
        osmBase: data.osm3s?.timestamp_osm_base,
        features,
    }) + '\n'
);
console.log(`routes.geojson: ${features.length} sections, OSM data as of ${data.osm3s?.timestamp_osm_base}`);
