#!/usr/bin/env node
/**
 * Lok Sabha constituency boundaries for the atlas:  npm run geo:pc
 *
 * Source: DataMeet's india_pc_2019_simplified.geojson (CC0, by Arun Ganesh), pinned below.
 * Each seat is clipped to the state it falls in on OUR state boundaries (public/geo/in/states.geojson),
 * so a constituency's edge on a state border is exactly the state line already drawn, and the
 * lines drawn between constituencies are only those inside a state. Nothing here can draw a border
 * that disagrees with the official outline. Parts of a state that no seat covers (the two files'
 * line-work differs, and the source leaves out some water and marsh) go to the neighbouring seat of
 * the same state (scripts/lib/fill-gaps.mjs).
 *
 * Left out: Assam and Jammu & Kashmir (except Ladakh). Their seats were redrawn by the 2023 and 2022
 * delimitations, after this file was made.
 *
 * Writes public/geo/in/pc.geojson (one polygon per seat: key "<stateSlug>:<pcNo>", name, stateSlug)
 * and public/geo/in/pc-lines.geojson (lines between seats in the same state).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import mapshaper from 'mapshaper';
import { fillGaps } from './lib/fill-gaps.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const COMMIT = 'b3fbbde595310b397a55d718e0958ce249a4fa1f';
const URL = `https://raw.githubusercontent.com/datameet/maps/${COMMIT}/parliamentary-constituencies/india_pc_2019_simplified.geojson`;
const CACHE = resolve(ROOT, 'temp/geo/india_pc_2019_simplified.geojson');
const OUT = resolve(ROOT, 'public/geo/in');

/** Redrawn after 2019; not drawn until current boundaries are available. */
const REDRAWN = (p) => p.st_name === 'Assam' || (p.st_name === 'Jammu & Kashmir' && p.pc_name !== 'Ladakh');

if (!existsSync(CACHE)) {
    mkdirSync(resolve(CACHE, '..'), { recursive: true });
    const res = await fetch(URL);
    if (!res.ok) throw new Error(`${URL}: ${res.status}`);
    writeFileSync(CACHE, await res.text());
}
const pc = JSON.parse(readFileSync(CACHE, 'utf8'));
const states = readFileSync(resolve(OUT, 'states.geojson'), 'utf8');
const ourStates = new Set(JSON.parse(states).features.map(f => f.properties.slug));

// Each seat's state, from the file's own state name, as our slug (today's states and UTs).
const STATE = {
    'Orissa': 'odisha', 'Daman & Diu': 'dadra-and-nagar-haveli-and-daman-and-diu',
    'Dadra & Nagar Haveli': 'dadra-and-nagar-haveli-and-daman-and-diu', 'Andaman & Nicobar': 'andaman-and-nicobar',
    'Jammu & Kashmir': 'jammu-and-kashmir',
};
const slugOf = p => (p.pc_name === 'Ladakh' ? 'ladakh' : STATE[p.st_name] ?? p.st_name.toLowerCase().replace(/ /g, '-'));
const kept = { ...pc, features: pc.features.filter(f => !REDRAWN(f.properties)) };
for (const f of kept.features) {
    const p = f.properties;
    // Errata in the source file: Maharashtra seat 30 is Mumbai South Central (31 is Mumbai South).
    if (p.st_name === 'Maharashtra' && p.pc_no === 30) p.pc_name = 'Mumbai South Central';
    p.slug = slugOf(p);
    if (!ourStates.has(p.slug)) throw new Error(`No state "${p.slug}" for ${p.pc_name} (${p.st_name})`);
    // Unique even where two old territories merged (Daman & Diu and Dadra & Nagar Haveli are both seat 1).
    p.key = `${p.slug}:${p.st_code}-${p.pc_no}`;
}

const clipped = await mapshaper.applyCommands(
    [
        '-i pc.json name=pc -i states.json name=states',
        // The source has a few self-intersecting rings; without this, -union drops those seats.
        '-clean target=pc',
        // Cut every seat by every state, keep only the piece inside its own state, then re-merge.
        '-union target=pc,states fields=slug,key,pc_no,pc_name name=pieces',
        '-filter target=pieces "slug_1 == slug_2"',
        '-each target=pieces "stateSlug = slug_1, name = pc_name"',
        '-dissolve2 target=pieces key copy-fields=name,stateSlug,pc_no',
        '-rename-layers seats target=pieces',
        '-filter target=seats "key != null"',
        '-filter-slivers target=seats min-area=0.2km2',
        '-each target=seats "pcNo = pc_no, delete pc_no"',
        '-o target=seats clipped.json',
    ].join(' '),
    { 'pc.json': JSON.stringify(kept), 'states.json': states },
);
const filled = await fillGaps({ seats: JSON.parse(clipped['clipped.json']), states: JSON.parse(states) });
// What is left should be only the states whose seats are not drawn at all.
const drawn = new Set(filled.seats.features.map(f => f.properties.stateSlug));
const leftKm2 = filled.left.filter(x => drawn.has(x.slug)).reduce((s, x) => s + x.km2, 0);
// Islands and exclaves that touch no seat stay empty (we do not guess their seat); anything more is a fault.
if (leftKm2 > 200) throw new Error(`${leftKm2.toFixed(0)} km2 inside states with seats is still in no seat`);

const out = await mapshaper.applyCommands(
    [
        '-i filled.json name=seats',
        '-innerlines target=seats where="A.stateSlug == B.stateSlug" + name=lines',
        '-each target=lines "kind = \'pc\'"',
        '-o target=seats seats.json precision=0.0001',
        '-o target=lines lines.json precision=0.0001',
        // Which 2011 districts each seat overlaps, and by how much (for "who represents this district").
        // Measured on the seat as the source draws it, so a filled gap never adds a district to a seat.
        '-i source.json name=src',
        '-i districts.json name=districts',
        '-each target=src "seatKm2 = this.area / 1e6"',
        '-each target=districts "districtKm2 = this.area / 1e6"',
        '-union target=src,districts fields=key,seatKm2,census2011Code,districtKm2 name=overlap',
        '-each target=overlap "km2 = this.area / 1e6"',
        '-filter target=overlap "key != null && census2011Code != null && census2011Code != \'0\'"',
        '-o target=overlap overlap.json format=json',
    ].join(' '),
    { 'filled.json': JSON.stringify(filled.seats), 'source.json': clipped['clipped.json'], 'districts.json': readFileSync(resolve(OUT, 'districts.geojson'), 'utf8') },
);

const seats = JSON.parse(out['seats.json']);
const empty = seats.features.filter(f => !f.geometry).map(f => f.properties.name);
if (empty.length) throw new Error(`Seats with no shape after clipping: ${empty.join(', ')}`);
// A seat "covers" a district when the overlap is at least 5% of either: enough to matter to people
// on both sides, ignoring slivers from the two files' different line-work.
const covers = new Map();
for (const o of JSON.parse(out['overlap.json'])) {
    if (o.km2 < 0.05 * Math.min(o.seatKm2, o.districtKm2)) continue;
    if (!covers.has(o.key)) covers.set(o.key, []);
    covers.get(o.key).push(o.census2011Code);
}
for (const f of seats.features) {
    f.properties.districts = [...new Set(covers.get(f.properties.key) ?? [])];
    delete f.properties.seatKm2;
}
const lines = JSON.parse(out['lines.json']);
const missing = kept.features.filter(f => !seats.features.some(s => s.properties.name === f.properties.pc_name));
if (missing.length > 3) throw new Error(`Seats lost in clipping: ${missing.map(f => f.properties.pc_name).join(', ')}`);
writeFileSync(resolve(OUT, 'pc.geojson'), JSON.stringify(seats));
writeFileSync(resolve(OUT, 'pc-lines.geojson'), JSON.stringify(lines));
console.log(`gaps: ${filled.filledKm2.toFixed(0)} km2 given to the neighbouring seat, ${leftKm2.toFixed(1)} km2 left empty in states with seats (pieces that touch no seat)`);
console.log(`pc.geojson: ${seats.features.length} seats (${pc.features.length - kept.features.length} left out as redrawn); pc-lines.geojson: ${lines.features.length} lines`);
if (missing.length) console.log('not placed:', missing.map(f => f.properties.pc_name).join(', '));
