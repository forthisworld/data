#!/usr/bin/env node
/**
 * MPLADS (MP Local Area Development Scheme) for the current Lok Sabha:  npm run data:mplads
 *
 * Source: MoSPI's eSAKSHI portal (https://mplads.mospi.gov.in/digigov/dashboard.html). Its public
 * dashboard has no download; this script makes the same five requests the dashboard makes when a
 * visitor opens each of its tiles, one at a time, a few seconds apart.
 *
 * Writes:
 *  - data/in/mplads/lok-sabha-18.json: for each Lok Sabha seat, the allocation, works recommended,
 *    sanctioned and completed (count and amount), and payments made. Totals are checked against the
 *    portal's own list totals; the script stops if they disagree.
 *  - public/data/mplads/lok-sabha-18/<state>/<seat>.json for the states in WORK_STATES: every work, with
 *    what it is, the implementing agency, dates, amounts, stage, and who was paid how much (vendor names as
 *    the portal lists them).
 *
 * Raw responses (~280 MB) go to temp/mplads and are not committed.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const API = 'https://mplads.mospi.gov.in/rest/PreLoginDashboardData/getTilesReportData';
const DASHBOARD = 'https://mplads.mospi.gov.in/digigov/dashboard.html';
const CACHE = resolve(ROOT, 'temp/mplads');
const TERM = 18;
const WORK_STATES = ['karnataka'];
const reuse = process.argv.includes('--cached'); // re-run on the last download instead of fetching again
// The date the data was read: today, or when the cached download was made.
const cached = resolve(ROOT, 'temp/mplads/allocated.json');
const today = (reuse && existsSync(cached) ? statSync(cached).mtime : new Date()).toISOString().slice(0, 10);

const TILES = {
    allocated: "Allocated Limit for Hon'ble MPs",
    paid: 'Expenditure on Completed and On-going Works as on Date',
    recommended: 'Works Recommended',
    completed: 'Works Completed',
    sanctioned: 'Works Sanctioned',
};

mkdirSync(CACHE, { recursive: true });
const lists = {};
for (const [name, key] of Object.entries(TILES)) {
    const file = resolve(CACHE, `${name}.json`);
    if (!reuse || !existsSync(file)) {
        const res = await fetch(API, {
            method: 'POST',
            headers: { 'content-type': 'application/json', origin: 'https://mplads.mospi.gov.in', referer: DASHBOARD, 'user-agent': 'data-ftw-fetch-mplads' },
            body: JSON.stringify({ combo: '0,0,0,2', key }), // "0,0,0,2": all states, the Lok Sabha
        });
        if (!res.ok) throw new Error(`${key}: ${res.status}`);
        writeFileSync(file, await res.text());
        await new Promise(r => setTimeout(r, 3000));
    }
    const rows = JSON.parse(Object.values(JSON.parse(readFileSync(file, 'utf8')))[0]);
    const total = rows.find(r => r.Total_Amt !== undefined)?.Total_Amt;
    lists[name] = { rows: rows.filter(r => r.STATE_NAME), total };
    console.log(`${name}: ${lists[name].rows.length} rows`);
}

// ---- check the lists add up to their own totals
const sum = (rows, k) => rows.reduce((t, r) => t + (Number(r[k]) || 0), 0);
for (const [name, field] of [['paid', 'FUND_DISBURSED_AMT'], ['recommended', 'RECOMMENDED_AMOUNT'], ['completed', 'ACTUAL_AMOUNT'], ['sanctioned', 'SANCTION_AMOUNT']]) {
    const got = sum(lists[name].rows, field), want = lists[name].total;
    if (want !== undefined && Math.abs(got - want) > 1) throw new Error(`${name}: rows add up to ${got}, the list's total is ${want}`);
}

// ---- join to our Lok Sabha seats
const ls = JSON.parse(readFileSync(resolve(ROOT, `data/in/representatives/lok-sabha-${TERM}.json`), 'utf8'));
const norm = s => s.toLowerCase().replace(/\((sc|st)\)/g, '').replace(/_[a-z]{2}$/, '').replace(/[^a-z]/g, '');
const stateSlug = s => s.toLowerCase().replace(/ and /g, ' and ').replace(/\s+/g, '-').replace('andaman-and-nicobar-islands', 'andaman-and-nicobar').replace('nct-of-delhi', 'delhi').replace(/^the-/, '');
/** eSAKSHI spelling → the Lok Sabha Secretariat's (our seat names). Filled from the misses the join reports. */
const ALIAS = JSON.parse(readFileSync(resolve(import.meta.dirname, 'mplads-aliases.json'), 'utf8'));
const seatIndex = new Map(ls.seats.map(s => [`${s.state}|${norm(s.name)}`, s]));
const seatOf = r => {
    const st = stateSlug(r.STATE_NAME);
    const name = ALIAS[`${st}|${r.CONSTITUENCY}`] ?? r.CONSTITUENCY;
    return seatIndex.get(`${st}|${norm(name)}`);
};
const missing = new Set();
const bySeat = new Map();
const entry = seat => {
    if (!bySeat.has(seat.id)) bySeat.set(seat.id, { seat: seat.id, mps: new Set(), allocated: 0, recommended: { count: 0, amount: 0 }, sanctioned: { count: 0, amount: 0 }, completed: { count: 0, amount: 0 }, paid: 0 });
    return bySeat.get(seat.id);
};
const title = s => s.replace(/\s+/g, ' ').trim().split(' ').map(w => (w.length <= 1 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1).toLowerCase())).join(' ');
for (const [name, rows] of Object.entries(lists).map(([k, v]) => [k, v.rows])) {
    for (const r of rows) {
        const seat = seatOf(r);
        if (!seat) { missing.add(`${stateSlug(r.STATE_NAME)}|${r.CONSTITUENCY}`); continue; }
        const e = entry(seat);
        if (r.MP_NAME) e.mps.add(title(r.MP_NAME));
        if (name === 'allocated') e.allocated += Number(r.ALLOCATED_AMT) || 0;
        if (name === 'paid') e.paid += Number(r.FUND_DISBURSED_AMT) || 0;
        if (name === 'recommended') { e.recommended.count++; e.recommended.amount += Number(r.RECOMMENDED_AMOUNT) || 0; }
        if (name === 'sanctioned') { e.sanctioned.count++; e.sanctioned.amount += Number(r.SANCTION_AMOUNT) || 0; }
        if (name === 'completed') { e.completed.count++; e.completed.amount += Number(r.ACTUAL_AMOUNT) || 0; }
    }
}
if (missing.size) throw new Error(`eSAKSHI constituencies not matched to a seat (add to scripts/mplads-aliases.json):\n  ${[...missing].join('\n  ')}`);

const round = n => Math.round(n);
const seats = [...bySeat.values()].map(e => ({
    seat: e.seat,
    mps: [...e.mps].sort(),
    allocated: round(e.allocated),
    recommended: { count: e.recommended.count, amount: round(e.recommended.amount) },
    sanctioned: { count: e.sanctioned.count, amount: round(e.sanctioned.amount) },
    completed: { count: e.completed.count, amount: round(e.completed.amount) },
    paid: round(e.paid),
    sourceId: 'esakshi-dashboard',
})).sort((a, b) => a.seat.localeCompare(b.seat));

const totals = Object.fromEntries(['allocated', 'paid'].map(k => [k, round(seats.reduce((t, s) => t + s[k], 0))]));
for (const k of ['recommended', 'sanctioned', 'completed']) totals[k] = { count: seats.reduce((t, s) => t + s[k].count, 0), amount: round(seats.reduce((t, s) => t + s[k].amount, 0)) };

mkdirSync(resolve(ROOT, 'data/in/mplads'), { recursive: true });
writeFileSync(resolve(ROOT, `data/in/mplads/lok-sabha-${TERM}.json`), JSON.stringify({
    id: `mplads-lok-sabha-${TERM}`,
    scheme: 'MPLADS',
    house: 'Lok Sabha',
    term: TERM,
    asOf: today,
    currency: 'INR',
    sources: [{
        id: 'esakshi-dashboard',
        title: 'MPLADS e-SAKSHI: public dashboard (works recommended, sanctioned, completed; expenditure; allocated limit)',
        publisher: 'Ministry of Statistics and Programme Implementation (mplads.mospi.gov.in)',
        type: 'government_portal',
        url: DASHBOARD,
        retrievedAt: today,
        note: 'Read from the lists behind the dashboard tiles. "Paid" is the portal\'s "Expenditure on Completed and On-going Works": vendor payments released. The dashboard\'s headline for completed works can differ slightly from the sum of its own list; these figures are the list sums.',
    }],
    totals,
    seats,
    lastVerified: today,
}, null, 1) + '\n');

// ---- per-work lists for chosen states
const paidByWork = new Map();
const vendorsByWork = new Map(); // work id -> Map(vendor name -> amount paid)
for (const r of lists.paid.rows) {
    const amt = Number(r.FUND_DISBURSED_AMT) || 0;
    paidByWork.set(r.WORK_RECOMMENDATION_DTL_ID, (paidByWork.get(r.WORK_RECOMMENDATION_DTL_ID) ?? 0) + amt);
    const name = (r.VENDOR_NAME ?? '').replace(/\s+/g, ' ').trim();
    if (!name) continue;
    if (!vendorsByWork.has(r.WORK_RECOMMENDATION_DTL_ID)) vendorsByWork.set(r.WORK_RECOMMENDATION_DTL_ID, new Map());
    const v = vendorsByWork.get(r.WORK_RECOMMENDATION_DTL_ID);
    v.set(name, (v.get(name) ?? 0) + amt);
}
const completedByWork = new Map(lists.completed.rows.map(r => [r.WORK_RECOMMENDATION_DTL_ID, r]));
const activity = s => (s ?? '').replace(/^.*?-(?=\d+(\.\d+)?\s)/, '').replace(/\s+/g, ' ').trim();
const ddmon = s => { const m = (s ?? '').match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/); if (!m) return undefined; const mon = 'JanFebMarAprMayJunJulAugSepOctNovDec'.indexOf(m[2]) / 3 + 1; return `${m[3]}-${String(mon).padStart(2, '0')}-${m[1]}`; };
let written = 0;
for (const st of WORK_STATES) {
    const groups = new Map();
    for (const r of lists.recommended.rows) {
        const seat = seatOf(r);
        if (!seat || seat.state !== st) continue;
        const c = completedByWork.get(r.WORK_RECOMMENDATION_DTL_ID);
        const w = {
            id: r.WORK_RECOMMENDATION_DTL_ID,
            activity: activity(r.ACTIVITY_NAME),
            description: (r.WORK_DESCRIPTION ?? '').replace(/\s+/g, ' ').trim(),
            agency: r.IDA_NAME,
            recommended: { date: ddmon(r.RECOMMENDATION_DATE), amount: round(Number(r.RECOMMENDED_AMOUNT) || 0) },
            ...(r.SANCTION_DATE ? { sanctioned: { date: ddmon(r.SANCTION_DATE), amount: round(Number(r.SANCTION_AMOUNT) || 0) } } : {}),
            stage: r.WORK_STAGE && r.WORK_STAGE !== 'NA' ? r.WORK_STAGE : undefined,
            ...(c ? { completed: { date: ddmon(c.ACTUAL_END_DATE), amount: round(Number(c.ACTUAL_AMOUNT) || 0) } } : {}),
            paid: round(paidByWork.get(r.WORK_RECOMMENDATION_DTL_ID) ?? 0),
            ...(vendorsByWork.has(r.WORK_RECOMMENDATION_DTL_ID) ? { vendors: [...vendorsByWork.get(r.WORK_RECOMMENDATION_DTL_ID)].map(([name, paid]) => ({ name, paid: round(paid) })).sort((a, b) => b.paid - a.paid) } : {}),
        };
        if (!groups.has(seat.id)) groups.set(seat.id, []);
        groups.get(seat.id).push(w);
    }
    for (const [seatId, works] of groups) {
        const dir = resolve(ROOT, `public/data/mplads/lok-sabha-${TERM}/${st}`);
        mkdirSync(dir, { recursive: true });
        works.sort((a, b) => b.recommended.amount - a.recommended.amount);
        writeFileSync(resolve(dir, `${seatId.slice(seatId.indexOf(':') + 1)}.json`), JSON.stringify({ seat: seatId, asOf: today, source: DASHBOARD, works }));
        written += works.length;
    }
}
console.log(`mplads/lok-sabha-${TERM}.json: ${seats.length} seats; allocated ₹${(totals.allocated / 1e7).toFixed(2)} crore, paid ₹${(totals.paid / 1e7).toFixed(2)} crore; ${written} works written for ${WORK_STATES.join(', ')}`);
