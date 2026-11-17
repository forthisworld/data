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
 * outline. Each seat also records its Lok Sabha seat (from the file's PC number, which is fixed by the
 * 2008 delimitation order) and the 2011 districts it overlaps.
 *
 * Writes public/geo/<country>/ac/<state>.geojson and ac/<state>-lines.geojson.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import mapshaper from 'mapshaper';

const ROOT = resolve(import.meta.dirname, '..');
const COMMIT = 'b3fbbde595310b397a55d718e0958ce249a4fa1f';
const BASE = `https://raw.githubusercontent.com/datameet/maps/${COMMIT}/assembly-constituencies/India_AC`;
const CACHE = resolve(ROOT, 'temp/geo/ac/India_AC');
const GEO = resolve(ROOT, 'public/geo/in');

/** States we have checked: the file's state name, seat count, and Census 2011 state code (for Lok Sabha keys). */
const STATES = {
    karnataka: { file: 'KARNATAKA', seats: 224, stCode: 29 },
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

const out = await mapshaper.applyCommands(
    [
        `-i ${CACHE}.shp name=ac`,
        `-filter target=ac "ST_NAME == '${cfg.file}' && AC_NO > 0"`,
        '-clean target=ac',
        '-i state.json name=state',
        '-clip target=ac state',
        `-each target=ac "key = '${state}:' + AC_NO, acNo = AC_NO, name = AC_NAME, pcKey = '${state}:${cfg.stCode}-' + PC_NO, stateSlug = '${state}'"`,
        '-filter-fields target=ac key,acNo,name,pcKey,stateSlug',
        '-filter target=ac "this.area > 0"',
        '-innerlines target=ac + name=lines',
        '-each target=lines "kind = \'ac\'"',
        '-o target=ac ac.json precision=0.0001',
        '-o target=lines lines.json precision=0.0001',
        // Which 2011 districts each seat overlaps (5% of either, as for Lok Sabha seats).
        '-i districts.json name=districts',
        '-each target=ac "seatKm2 = this.area / 1e6"',
        '-each target=districts "districtKm2 = this.area / 1e6"',
        '-union target=ac,districts fields=key,seatKm2,census2011Code,districtKm2 name=overlap',
        '-each target=overlap "km2 = this.area / 1e6"',
        '-filter target=overlap "key != null && census2011Code != null"',
        '-o target=overlap overlap.json format=json',
    ].join(' '),
    { 'state.json': JSON.stringify(own), 'districts.json': readFileSync(resolve(GEO, 'districts.geojson'), 'utf8') },
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
console.log(`ac/${state}.geojson: ${seats.features.length} seats; ${lines.features.length} lines`);
