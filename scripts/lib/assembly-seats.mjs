/**
 * The assembly seats of one state, at full precision, before anything is written.
 *
 * Used by build-assembly.mjs (which writes the assembly files) and by build-constituencies.mjs (which
 * draws a state's Lok Sabha seats as the union of its assembly seats). Both must work from the same
 * unrounded shapes: the published files are rounded, and rounded shapes overlap the next state's seats.
 *
 * Source: DataMeet's assembly-constituencies/India_AC.shp (CC BY 2.5 India), pinned below.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import mapshaper from 'mapshaper';
import { fillGaps } from './fill-gaps.mjs';

const ROOT = resolve(import.meta.dirname, '../..');
const COMMIT = 'b3fbbde595310b397a55d718e0958ce249a4fa1f';
const BASE = `https://raw.githubusercontent.com/datameet/maps/${COMMIT}/assembly-constituencies/India_AC`;
const CACHE = resolve(ROOT, 'temp/geo/ac/India_AC');
const GEO = resolve(ROOT, 'public/geo/in');

/** States we have checked: the file's state name, seat count, and Census 2011 state code (for Lok Sabha keys). */
export const ASSEMBLY_STATES = {
    karnataka: {
        file: 'KARNATAKA', seats: 224, stCode: 29,
        // Areas the file draws with no seat number: a point inside each, and the seat it belongs to.
        unnamed: [
            // Almost all of this shape is BBMP ward 114, Agaram (8.7 of its 9.7 km2; the rest is slivers
            // along its edge). Agaram is one of the wards of Shanti Nagar, seat 163: the BBMP 198-ward
            // list of 2009 records each ward's assembly constituency (DataMeet, Municipal_Spatial_Data,
            // Bangalore/BBMP_oldWards.geojson).
            { at: [77.641, 12.941], acNo: 163 },
        ],
    },
};

/** Shapes the file draws with no seat number and we have no seat for: kept while lines are drawn, never shown as a seat. */
export const UNNAMED = '?';

const inRing = ([px, py], ring) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i], [xj, yj] = ring[j];
        if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
};
const contains = (g, pt) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).some(poly => inRing(pt, poly[0]) && !poly.slice(1).some(hole => inRing(pt, hole)));

/**
 * @param {string} state  our state slug; must be in ASSEMBLY_STATES
 * @param {{ quiet?: boolean }} [options]
 * @returns {Promise<{ source: GeoJSON.FeatureCollection, seats: GeoJSON.FeatureCollection }>}
 *   source: each seat as the file draws it, clipped to the state (district overlap is measured on this).
 *   seats: the same seats with every gap closed, so together they cover the state exactly. May include
 *   UNNAMED shapes. Properties: key, acNo, name, pcKey, stateSlug.
 */
export async function assemblySeats(state, { quiet = false } = {}) {
    const cfg = ASSEMBLY_STATES[state];
    if (!cfg) throw new Error(`No checked assembly seats for ${state}. Checked states: ${Object.keys(ASSEMBLY_STATES).join(', ')}`);
    const say = quiet ? () => {} : console.log;

    mkdirSync(resolve(CACHE, '..'), { recursive: true });
    for (const ext of ['shp', 'dbf', 'shx', 'prj']) {
        if (existsSync(`${CACHE}.${ext}`)) continue;
        const res = await fetch(`${BASE}.${ext}`);
        if (!res.ok) throw new Error(`${BASE}.${ext}: ${res.status}`);
        writeFileSync(`${CACHE}.${ext}`, Buffer.from(await res.arrayBuffer()));
    }

    const states = JSON.parse(readFileSync(resolve(GEO, 'states.geojson'), 'utf8'));
    const own = { ...states, features: states.features.filter(f => f.properties.slug === state) };
    if (!own.features.length) throw new Error(`No state ${state} in states.geojson`);

    const clipped = await mapshaper.applyCommands(
        [
            `-i ${CACHE}.shp name=ac`,
            `-filter target=ac "ST_NAME == '${cfg.file}'"`,
            '-clean target=ac',
            '-i state.json name=state',
            '-clip target=ac state',
            `-each target=ac "key = AC_NO > 0 ? '${state}:' + AC_NO : '${UNNAMED}' + this.id, acNo = AC_NO, name = AC_NAME, pcKey = '${state}:${cfg.stCode}-' + PC_NO, stateSlug = '${state}'"`,
            '-filter-fields target=ac key,acNo,name,pcKey,stateSlug',
            '-filter target=ac "this.area > 0"',
            '-o target=ac ac.json',
        ].join(' '),
        { 'state.json': JSON.stringify(own) },
    );
    const source = JSON.parse(clipped['ac.json']);
    for (const fix of cfg.unnamed ?? []) {
        const shape = source.features.find(f => f.properties.key.startsWith(UNNAMED) && contains(f.geometry, fix.at));
        const seat = source.features.find(f => f.properties.acNo === fix.acNo);
        if (!shape || !seat) throw new Error(`${state}: no unnamed area at ${fix.at}, or no seat ${fix.acNo}`);
        shape.properties = { ...seat.properties };
        say(`unnamed area at ${fix.at}: joined to ${seat.properties.name}`);
    }

    const filled = await fillGaps({ seats: source, states: own, hold: key => key.startsWith(UNNAMED) });
    for (const a of filled.apart) say(`apart from every seat: ${a.km2.toFixed(1)} km2 at ${a.at.map(v => v.toFixed(3))} -> ${a.key} (${a.km.toFixed(1)} km away)`);
    const leftKm2 = filled.left.reduce((s, x) => s + x.km2, 0);
    if (leftKm2 > 1) throw new Error(`${state}: ${leftKm2.toFixed(1)} km2 of the state is still in no seat`);
    const named = filled.seats.features.filter(f => !f.properties.key.startsWith(UNNAMED));
    if (named.length !== cfg.seats || new Set(named.map(f => f.properties.acNo)).size !== cfg.seats) {
        throw new Error(`${state}: expected ${cfg.seats} seats, got ${named.length}`);
    }
    say(`${state}: ${filled.filledKm2.toFixed(1)} km2 of gaps given to the neighbouring seat, ${leftKm2.toFixed(2)} km2 left empty`);
    return { source, seats: filled.seats };
}
