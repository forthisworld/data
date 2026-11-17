#!/usr/bin/env node
/**
 * Assembly (Vidhan Sabha) seat boundaries for one state:  npm run geo:ac -- karnataka
 *
 * Source: DataMeet's assembly-constituencies/India_AC.shp (CC BY 2.5 India), pinned below. Its README
 * warns that some states are pre-delimitation and that there is "some shift in the data", so only
 * states checked here are built: each must have exactly the expected number of post-2008 seats.
 *
 * As with Lok Sabha seats (build-constituencies.mjs), every seat is clipped to the state on OUR state
 * boundaries and lines are drawn only between seats, so nothing here can disagree with the official
 * outline. Strips of the state that no seat covers (the two files' line-work differs) go to the
 * neighbouring seat, and an exclave that touches no seat to the nearest one (scripts/lib/fill-gaps.mjs).
 * An area the file draws without a seat number takes the seat named for it in STATES below, with the
 * reason; one with no entry is left empty, with its edge drawn. Each seat also records its Lok Sabha seat (from the file's PC number, which is fixed by the
 * 2008 delimitation order) and the 2011 districts it overlaps.
 *
 * Writes public/geo/<country>/ac/<state>.geojson and ac/<state>-lines.geojson.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import mapshaper from 'mapshaper';
import { fillGaps } from './lib/fill-gaps.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const COMMIT = 'b3fbbde595310b397a55d718e0958ce249a4fa1f';
const BASE = `https://raw.githubusercontent.com/datameet/maps/${COMMIT}/assembly-constituencies/India_AC`;
const CACHE = resolve(ROOT, 'temp/geo/ac/India_AC');
const GEO = resolve(ROOT, 'public/geo/in');

/** States we have checked: the file's state name, seat count, and Census 2011 state code (for Lok Sabha keys). */
const STATES = {
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

const state = process.argv[2];
const cfg = STATES[state];
if (!cfg) throw new Error(`Usage: npm run geo:ac -- <state>. Checked states: ${Object.keys(STATES).join(', ')}`);

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

/** Shapes the file draws with no seat number: kept while lines are drawn, never shown as a seat. */
const UNNAMED = '?';
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
const inRing = ([px, py], ring) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i], [xj, yj] = ring[j];
        if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
};
const contains = (g, pt) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).some(poly => inRing(pt, poly[0]) && !poly.slice(1).some(hole => inRing(pt, hole)));
for (const fix of cfg.unnamed ?? []) {
    const shape = source.features.find(f => f.properties.key.startsWith(UNNAMED) && contains(f.geometry, fix.at));
    const seat = source.features.find(f => f.properties.acNo === fix.acNo);
    if (!shape || !seat) throw new Error(`${state}: no unnamed area at ${fix.at}, or no seat ${fix.acNo}`);
    shape.properties = { ...seat.properties };
    console.log(`unnamed area at ${fix.at}: joined to ${seat.properties.name}`);
}
const filled = await fillGaps({ seats: source, states: own, hold: key => key.startsWith(UNNAMED) });
for (const a of filled.apart) console.log(`apart from every seat: ${a.km2.toFixed(1)} km2 at ${a.at.map(v => v.toFixed(3))} -> ${a.key} (${a.km.toFixed(1)} km away)`);
const unnamed = filled.seats.features.filter(f => f.properties.key.startsWith(UNNAMED));
const leftKm2 = filled.left.reduce((s, x) => s + x.km2, 0);
if (leftKm2 > 1) throw new Error(`${state}: ${leftKm2.toFixed(1)} km2 of the state is still in no seat`);

const out = await mapshaper.applyCommands(
    [
        '-i filled.json name=ac',
        '-innerlines target=ac + name=lines',
        `-filter target=ac "key.charAt(0) != '${UNNAMED}'"`,
        '-each target=lines "kind = \'ac\'"',
        '-o target=ac ac.json precision=0.0001',
        '-o target=lines lines.json precision=0.0001',
        // Which 2011 districts each seat overlaps (5% of either, as for Lok Sabha seats). Measured on the
        // seat as the source draws it, so a filled gap never adds a district to a seat.
        '-i source.json name=src',
        '-i districts.json name=districts',
        '-each target=src "seatKm2 = this.area / 1e6"',
        '-each target=districts "districtKm2 = this.area / 1e6"',
        '-union target=src,districts fields=key,seatKm2,census2011Code,districtKm2 name=overlap',
        '-each target=overlap "km2 = this.area / 1e6"',
        '-filter target=overlap "key != null && census2011Code != null"',
        '-o target=overlap overlap.json format=json',
    ].join(' '),
    { 'filled.json': JSON.stringify(filled.seats), 'source.json': JSON.stringify(source), 'districts.json': readFileSync(resolve(GEO, 'districts.geojson'), 'utf8') },
);

const seats = JSON.parse(out['ac.json']);
const lines = JSON.parse(out['lines.json']);
const nos = new Set(seats.features.map(f => f.properties.acNo));
if (seats.features.length !== cfg.seats || nos.size !== cfg.seats) {
    throw new Error(`${state}: expected ${cfg.seats} seats, got ${seats.features.length} (${nos.size} distinct numbers)`);
}
if (seats.features.some(f => !f.geometry)) throw new Error(`${state}: seats with no shape after clipping`);

const pcKeys = new Set(JSON.parse(readFileSync(resolve(GEO, 'pc.geojson'), 'utf8')).features.map(f => f.properties.key));
const covers = new Map();
for (const o of JSON.parse(out['overlap.json'])) {
    if (o.km2 < 0.05 * Math.min(o.seatKm2, o.districtKm2)) continue;
    if (!covers.has(o.key)) covers.set(o.key, new Set());
    covers.get(o.key).add(o.census2011Code);
}
for (const f of seats.features) {
    const p = f.properties;
    if (!pcKeys.has(p.pcKey)) throw new Error(`${p.name}: Lok Sabha seat ${p.pcKey} not in pc.geojson`);
    p.districts = [...(covers.get(p.key) ?? [])];
    // Names as the file has them, minus the reserved-seat suffix, which the member list gives separately.
    p.name = p.name.replace(/\s*\((SC|ST)\)\s*$/, '');
}

mkdirSync(resolve(GEO, 'ac'), { recursive: true });
writeFileSync(resolve(GEO, `ac/${state}.geojson`), JSON.stringify(seats));
writeFileSync(resolve(GEO, `ac/${state}-lines.geojson`), JSON.stringify(lines));
console.log(`ac/${state}.geojson: ${seats.features.length} seats; ${lines.features.length} lines; ${filled.filledKm2.toFixed(1)} km2 of gaps given to the neighbouring seat, ${leftKm2.toFixed(2)} km2 left empty`);
if (unnamed.length) console.log(`left empty: ${unnamed.length} area(s) the source draws with no seat number`);
