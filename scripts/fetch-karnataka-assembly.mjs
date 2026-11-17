#!/usr/bin/env node
/**
 * Who holds each Karnataka assembly seat, from the Karnataka Legislative Assembly:
 *   npm run data:karnataka-assembly
 *
 * Reads the Assembly's member list (https://kla.kar.nic.in/assembly/member/16assemblymemberslist.htm,
 * linked from its Members page). The list keeps every member elected in this term: by-election winners
 * are added at the end ("By Ele: from <date>"), and members who left are marked ("Died on", "Resigned
 * on", "Disqualified from"). A seat's holder is its member with no such mark; a seat with none is vacant.
 *
 * Only the seat, member name, party and those remarks are kept. Writes
 * data/in/representatives/karnataka-assembly-16.json, joined to public/geo/in/ac/karnataka.geojson by seat number.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '..');
const URL = 'https://kla.kar.nic.in/assembly/member/16assemblymemberslist.htm';
const PAGE = 'https://kla.kar.nic.in/assembly/member/members.htm';
const STATE = 'karnataka';
const SEATS = 224;
const OUT = resolve(ROOT, `data/in/representatives/${STATE}-assembly-16.json`);
const today = new Date().toISOString().slice(0, 10);

/**
 * The Assembly's server sends an incomplete certificate chain, which Node rejects. curl (with the
 * operating system's certificate store) completes and verifies the chain, so fall back to it rather
 * than switching verification off.
 */
async function get(url) {
    try {
        const res = await fetch(url, { headers: { 'user-agent': 'data-ftw-fetch-assembly' } });
        if (!res.ok) throw new Error(`${url}: ${res.status}`);
        return await res.text();
    } catch (e) {
        if (!/certificate/i.test(String(e?.cause?.message ?? e))) throw e;
        return execFileSync('curl', ['-fsS', '--max-time', '60', '-A', 'data-ftw-fetch-assembly', url], { encoding: 'utf8', maxBuffer: 20e6 });
    }
}
// Only what the page displays: the Assembly comments rows out rather than deleting them.
const html = (await get(URL)).replace(/<!--[\s\S]*?-->/g, '');

const text = s => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/[​-‍]/g, '').replace(/\s+/g, ' ').trim();
/** The Latin part of a bilingual cell ("NAME ಹೆಸರು [remark]" → "NAME"). */
const latin = s => s.replace(/\[[^\]]*\]/g, '').split(/[ಀ-೿]/)[0].trim();
const remarks = s => [...s.matchAll(/\[([^\]]+)\]/g)].map(m => m[1].trim());
/** "S R VISHWANATH" → "S R Vishwanath", "PATIL(YATNAL)" → "Patil (Yatnal)" */
const title = s => s.replace(/\(/g, ' (').replace(/\s+/g, ' ').trim().split(' ')
    .map(w => w.replace(/[A-Za-z]+/g, p => (p.length === 1 ? p.toUpperCase() : p === 'Dr' ? p : p[0].toUpperCase() + p.slice(1).toLowerCase())))
    .join(' ');
const ddmmyyyy = s => { const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : undefined; };

const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map(m => [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c => text(c[1])))
    .filter(c => c.length === 4 && /^\d+$/.test(c[0]));

const bySeat = new Map();
for (const [, seatCell, memberCell, partyCell] of rows) {
    const m = seatCell.match(/^(.*?)\s*\((\d+)\)/);
    if (!m) throw new Error(`Cannot read seat "${seatCell}"`);
    const no = Number(m[2]);
    const marks = [...remarks(memberCell), ...remarks(partyCell)];
    const partyLatin = latin(partyCell);
    const pm = partyLatin.match(/^(.*?)\s*\(([^()]*(?:\([^()]*\))?)\)$/); // "JANATA DAL (Secular) (JD(S))" → name, short
    const entry = {
        seat: m[1].trim(),
        name: title(latin(memberCell)),
        party: title(pm ? pm[1] : partyLatin).replace(/\(secular\)/i, '(Secular)'),
        partyShort: pm ? pm[2] : undefined,
        left: marks.find(r => /died|resigned|disqualified|ceased/i.test(r)),
        since: ddmmyyyy(marks.find(r => /by ele/i.test(r)) ?? ''),
        unattached: marks.some(r => /un-?attached/i.test(r)),
    };
    if (!bySeat.has(no)) bySeat.set(no, []);
    bySeat.get(no).push(entry);
}
if (bySeat.size !== SEATS) throw new Error(`Expected ${SEATS} seats, found ${bySeat.size}`);

const geo = new Map(JSON.parse(readFileSync(resolve(ROOT, `public/geo/in/ac/${STATE}.geojson`), 'utf8')).features.map(f => [f.properties.acNo, f.properties]));

const seats = [];
for (const [no, entries] of [...bySeat].sort((a, b) => a[0] - b[0])) {
    const current = entries.filter(e => !e.left);
    if (current.length > 1) throw new Error(`Seat ${no}: ${current.length} members without a leaving date`);
    const holder = current[0];
    const gone = entries.filter(e => e.left).pop();
    if (!geo.has(no)) throw new Error(`Seat ${no} (${entries[0].seat}) has no boundary`);
    const reason = gone?.left.match(/^(?:Remarks:\s*)?(\w+)/i)?.[1].toLowerCase();
    seats.push({
        id: `${STATE}:${no}`,
        state: STATE,
        name: entries[0].seat,
        number: no,
        drawn: true,
        status: holder ? 'sitting' : 'vacant',
        ...(holder ? {
            member: {
                name: holder.name, party: holder.party, partyShort: holder.partyShort,
                ...(holder.since ? { since: holder.since } : {}),
                ...(holder.unattached ? { note: 'Un-attached member' } : {}),
            },
        } : {}),
        ...(!holder && gone ? { vacatedBy: { name: gone.name, reason: reason === 'disqualified' ? 'disqualified' : reason ?? 'left', date: ddmmyyyy(gone.left) } } : {}),
        lokSabhaSeat: geo.get(no).pcKey,
        sourceId: 'kla-members-16',
    });
}

mkdirSync(resolve(OUT, '..'), { recursive: true });
writeFileSync(OUT, JSON.stringify({
    id: `${STATE}-assembly-16`,
    house: 'Karnataka Legislative Assembly',
    state: STATE,
    term: 16,
    asOf: today,
    sources: [{
        id: 'kla-members-16',
        title: 'Sixteenth Karnataka Legislative Assembly: list of members',
        publisher: 'Karnataka Legislative Assembly Secretariat (kla.kar.nic.in)',
        type: 'government_portal',
        url: URL,
        retrievedAt: today,
        note: `Linked from ${PAGE}. By-election winners and members who left are marked in the list itself.`,
    }],
    seats,
    lastVerified: today,
}, null, 1) + '\n');
const vacant = seats.filter(s => s.status === 'vacant');
console.log(`${STATE}-assembly-16.json: ${seats.length} seats, ${seats.length - vacant.length} sitting; vacant: ${vacant.map(s => `${s.name} (${s.vacatedBy?.reason} ${s.vacatedBy?.date})`).join(', ') || 'none'}`);
