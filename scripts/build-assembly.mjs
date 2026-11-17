#!/usr/bin/env node
/**
 * Assembly (Vidhan Sabha) seat boundaries for one state:  npm run geo:ac -- karnataka
 *
 * Source: DataMeet's assembly-constituencies/India_AC.shp (CC BY 2.5 India), pinned in lib/assembly-seats.mjs. Its README
 * warns that some states are pre-delimitation and that there is "some shift in the data", so only
 * states checked here are built: each must have exactly the expected number of post-2008 seats.
 *
 * As with Lok Sabha seats (build-constituencies.mjs), every seat is clipped to the state on OUR state
 * boundaries and lines are drawn only between seats, so nothing here can disagree with the official
 * outline. Strips of the state that no seat covers (the two files' line-work differs) go to the
 * neighbouring seat, and an exclave that touches no seat to the nearest one (scripts/lib/fill-gaps.mjs).
 * An area the file draws without a seat number takes the seat named for it in lib/assembly-seats.mjs, with the
 * reason; one with no entry is left empty, with its edge drawn. Each seat also records its Lok Sabha seat (from the file's PC number, which is fixed by the
 * 2008 delimitation order) and the 2011 districts it overlaps.
 *
 * Writes public/geo/<country>/ac/<state>.geojson and ac/<state>-lines.geojson.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import mapshaper from 'mapshaper';
import { assemblySeats, ASSEMBLY_STATES, UNNAMED } from './lib/assembly-seats.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const GEO = resolve(ROOT, 'public/geo/in');

const state = process.argv[2];
const cfg = ASSEMBLY_STATES[state];
if (!cfg) throw new Error(`Usage: npm run geo:ac -- <state>. Checked states: ${Object.keys(ASSEMBLY_STATES).join(', ')}`);

// The seats as the source draws them, and the same seats with every gap closed (lib/assembly-seats.mjs).
const { source, seats: filledSeats } = await assemblySeats(state);
const unnamed = filledSeats.features.filter(f => f.properties.key.startsWith(UNNAMED));

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
    { 'filled.json': JSON.stringify(filledSeats), 'source.json': JSON.stringify(source), 'districts.json': readFileSync(resolve(GEO, 'districts.geojson'), 'utf8') },
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
console.log('Now run geo:pc, so the Lok Sabha seats of this state are drawn from these assembly seats.');
if (unnamed.length) console.log(`left empty: ${unnamed.length} area(s) the source draws with no seat number`);
