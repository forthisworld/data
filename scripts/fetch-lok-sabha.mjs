#!/usr/bin/env node
/**
 * Who holds each Lok Sabha seat, from the Lok Sabha Secretariat:  npm run data:lok-sabha
 *
 * Reads the member list behind https://sansad.in/ls/members (its JSON API) and writes
 * data/in/representatives/lok-sabha-18.json: one entry per seat with the sitting member's name and
 * party, or the seat marked vacant with who vacated it and why. Only these public-role facts are
 * kept. The API also returns phone numbers, addresses, family details and photos; none of that is
 * stored or committed.
 *
 * Each seat is joined to its boundary in public/geo/in/pc.geojson (npm run geo:pc) by state and
 * name; the join fails loudly on any seat it cannot place, except seats whose boundaries were
 * redrawn after 2019 (Assam, Jammu & Kashmir), which are listed without a boundary.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const TERM = 18;
const API = `https://sansad.in/api_ls/member?loksabha=${TERM}&locale=en&page=1&size=600`;
const OUT = resolve(ROOT, `data/in/representatives/lok-sabha-${TERM}.json`);
const today = new Date().toISOString().slice(0, 10);

const STATE = { 'NCT of Delhi': 'delhi', 'Andaman and Nicobar Islands': 'andaman-and-nicobar' };
const stateSlug = name => STATE[name] ?? name.toLowerCase().replace(/ /g, '-');
const UNDRAWN = new Set(['assam', 'jammu-and-kashmir']);

/** The Secretariat's spelling → the boundary file's spelling. */
const ALIAS = {
    'Mahbubnagar': 'Mahabubnagar', 'Barrackpur': 'Barrackpore', 'Peddapalle': 'Peddapalli', 'Firozpur': 'Firozepur',
    'Mandsour': 'Mandsaur', 'Janjgir-Champa': 'Janjgir', 'Chikkodi': 'Chikodi', 'Anantapur': 'Anantapuramu',
    'Davanagere': 'Davangere', 'Arambag': 'Arambagh', 'Hassan': 'Haasan', 'Mayiladuthurai': 'Mayiladuturai',
    'Thoothukkudi': 'Thoothukudi', 'Anakapalle': 'Anakapalli', 'Hardwar': 'Haridwar', 'Bhongir': 'Bhuvanagiri',
    'Tiruvallur': 'Thiruvallur', 'Belgaum': 'Belagavi', 'Chikkballapur': 'Chikballapur', 'Mavelikkara': 'Mavelikara',
    'Kanniyakumari': 'Kanyakumari',
};
const norm = s => s.toLowerCase().replace(/[^a-z]/g, '');
const clean = s => (s ?? '').replace(/\s+/g, ' ').trim();

const res = await fetch(API, { headers: { 'user-agent': 'data-ftw-fetch-lok-sabha', accept: 'application/json' } });
if (!res.ok) throw new Error(`${API}: ${res.status}`);
const members = (await res.json()).membersDtoList;
if (!Array.isArray(members) || members.length < 540) throw new Error(`Unexpected member list (${members?.length} rows)`);

const geo = JSON.parse(readFileSync(resolve(ROOT, 'public/geo/in/pc.geojson'), 'utf8')).features.map(f => f.properties);
const geoKey = new Map(geo.map(p => [`${p.stateSlug}|${norm(p.name)}`, p.key]));

// One entry per seat; the sitting member if there is one, else the seat is vacant.
const seats = new Map();
for (const m of members) {
    const state = stateSlug(clean(m.stateName));
    const name = clean(m.constName);
    const id = `${state}|${norm(name)}`;
    const seat = seats.get(id) ?? { state, name, rows: [] };
    seat.rows.push(m);
    seats.set(id, seat);
}

const out = [];
const unplaced = [];
for (const { state, name, rows } of seats.values()) {
    const sitting = rows.filter(r => r.status === 'Sitting');
    if (sitting.length > 1) throw new Error(`${name}: ${sitting.length} sitting members`);
    const key = geoKey.get(`${state}|${norm(ALIAS[name] ?? name)}`) ??
        // Ladakh, and Dadra & Nagar Haveli / Daman & Diu, sit in a different state in the 2019 file.
        geo.find(p => norm(p.name) === norm(ALIAS[name] ?? name) && (state === 'ladakh' || state.startsWith('dadra')))?.key;
    if (!key && !UNDRAWN.has(state)) unplaced.push(`${name} (${state})`);
    const s = sitting[0];
    const gone = rows.find(r => r.status !== 'Sitting');
    out.push({
        id: key ?? `${state}:${norm(name)}`,
        state,
        name,
        drawn: !!key,
        status: s ? 'sitting' : 'vacant',
        ...(s ? {
            member: {
                name: clean(s.mpFirstLastName),
                party: clean(s.partyFname),
                partyShort: clean(s.partySname) || undefined,
                lokSabhaTerms: clean(s.lsExpr).split(',').map(Number).filter(Boolean),
            },
        } : {}),
        ...(!s && gone ? { vacatedBy: { name: clean(gone.mpFirstLastName), reason: gone.status.toLowerCase() } } : {}),
        sourceId: 'sansad-ls18-members',
    });
}
if (unplaced.length) throw new Error(`Seats with no boundary: ${unplaced.join('; ')}`);

out.sort((a, b) => a.state.localeCompare(b.state) || a.name.localeCompare(b.name));
mkdirSync(resolve(OUT, '..'), { recursive: true });
writeFileSync(OUT, JSON.stringify({
    id: `lok-sabha-${TERM}`,
    house: 'Lok Sabha',
    term: TERM,
    asOf: today,
    sources: [{
        id: 'sansad-ls18-members',
        title: `Members of the ${TERM}th Lok Sabha`,
        publisher: 'Lok Sabha Secretariat (sansad.in)',
        type: 'government_portal',
        url: 'https://sansad.in/ls/members',
        retrievedAt: today,
        note: `Read from the member list's JSON API (${API}). Only each seat's member, party, terms and status are kept.`,
    }],
    seats: out,
    lastVerified: today,
}, null, 1) + '\n');
const vacant = out.filter(s => s.status === 'vacant');
console.log(`lok-sabha-${TERM}.json: ${out.length} seats, ${out.length - vacant.length} sitting, vacant: ${vacant.map(s => s.name).join(', ') || 'none'}; ${out.filter(s => !s.drawn).length} without a boundary`);
