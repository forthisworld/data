#!/usr/bin/env node
/**
 * Election history of sitting members:  npm run data:elections
 *
 * Source: the Trivedi Centre for Political Data's Lok Dhaba archive (github.com/tcpd/tcpd-ld-data-archive,
 * "LD data as on June 2023", pinned below): every candidate in every assembly (AE) and Lok Sabha (GE)
 * election, with a person id (`pid`) that follows a politician across elections and houses.
 *
 * How a sitting member is tied to a person in the archive:
 *   - MLA: the winner of the seat (by its number) at the last general assembly election in the archive,
 *     unless our member list says the member came in later (a by-election), or the two names do not
 *     resemble each other. Then the member is left unmatched.
 *   - MP: the archive ends before the 2024 Lok Sabha election, so an MP is matched only where the name
 *     is the same as the winner of the same seat in 2019. A name alone is not enough: tried on Karnataka,
 *     it tied one MP to a namesake, and one to an id that also holds another person's contests.
 * Nobody is matched on a guess: unmatched members are listed in the output and shown as "not matched".
 *
 * The archive does not always give a person one id: many 2023 winners have a new id, with their earlier
 * wins in the same seat filed under an older one. So a member's record also takes in any other id that
 * stood in the SAME seat (today's seat numbering, 2008 onward) under a name that matches closely, kept
 * its deposit there, and was not in an election this person is already in. A
 * person who moved from another seat under another id is still missed, so the counts are "on record",
 * not complete.
 *
 * Only what the archive takes from the Election Commission's results is used (votes, positions,
 * parties). Its education and profession columns are left out.
 *
 * Writes data/in/elections/<house>.json (one summary per seat, for the panel's first line) and
 * public/data/elections/<state>/<ac|pc>-<n>.json (every contest of the member, loaded on demand).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';

const ROOT = resolve(import.meta.dirname, '..');
const REPO = 'https://github.com/tcpd/tcpd-ld-data-archive.git';
const COMMIT = 'a194c0681699582e31f2760796ccf89278979660';
const CACHE = resolve(ROOT, 'temp/tcpd/ld');
const TODAY = new Date().toISOString().slice(0, 10);

/** States to build: our slug, the archive's folder, the assembly's record in data/in/representatives. */
const STATES = [
    { slug: 'karnataka', folder: 'Karnataka', assembly: 'karnataka-assembly-16' },
];

const git = (...args) => execFileSync('git', args, { cwd: CACHE, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
function fetchFiles(paths) {
    if (!existsSync(resolve(CACHE, '.git'))) {
        mkdirSync(resolve(CACHE, '..'), { recursive: true });
        execFileSync('git', ['clone', '--quiet', '--filter=blob:none', '--no-checkout', REPO, CACHE], { stdio: 'inherit' });
    }
    git('checkout', COMMIT, '--', ...paths); // downloads only these files
}

function parseCsv(text) {
    const rows = []; let row = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (quoted) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false; } else cell += c; }
        else if (c === '"') quoted = true;
        else if (c === ',') { row.push(cell); cell = ''; }
        else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
        else if (c !== '\r') cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    const head = rows.shift();
    return rows.filter(r => r.length === head.length).map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

// ---------- names ----------
const NOISE = new Set(['DR', 'SRI', 'SHRI', 'SMT', 'KUM', 'ALIAS', 'ALIYAS', 'URF', 'S/O', 'D/O', 'W/O', 'ADV', 'PROF', 'CAPTAIN', 'COL']);
const tokens = name => name.toUpperCase().replace(/\(.*?\)/g, ' ').replace(/[^A-Z/ ]/g, ' ').split(/\s+/).filter(t => t && !NOISE.has(t));
const editDistance = (a, b) => {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
};
// Two name parts agree if they are the same, nearly the same (spelling), or one is the other's initial.
const agree = (a, b) => a === b || (a.length === 1 && b[0] === a) || (b.length === 1 && a[0] === b)
    || (Math.min(a.length, b.length) >= 4 && editDistance(a, b) <= (Math.min(a.length, b.length) >= 7 ? 2 : 1));
/** 0..1: the share of the shorter name's parts found in the longer name. Joined parts ("SHARANPRAKASH") count too. */
function resemblance(x, y) {
    const [a, b] = [tokens(x), tokens(y)].sort((p, q) => p.length - q.length);
    if (!a.length) return 0;
    const joined = b.join('');
    const left = [...b];
    let hit = 0;
    for (const t of a) {
        const i = left.findIndex(u => agree(t, u));
        if (i >= 0) { left.splice(i, 1); hit++; } else if (t.length >= 5 && joined.includes(t)) hit++;
        else if (t.length >= 8 && b.some(u => u.length >= 4 && t.includes(u))) hit++;
    }
    return hit / a.length;
}

// ---------- a person's contests ----------
const num = v => (v === '' || v == null ? undefined : Number(v));
const title = s => s.toLowerCase().replace(/(^|[\s.(-])([a-z])/g, (m, p, c) => p + c.toUpperCase()).replace(/\s+/g, ' ').trim();
function contest(r, runnerUp) {
    const won = r.Position === '1';
    return {
        year: Number(r.Year),
        house: r.Election_Type.includes('(GE)') ? 'lok_sabha' : 'assembly',
        byElection: r.Poll_No !== '0' || undefined,
        seat: title(r.Constituency_Name),
        party: r.Party,
        position: Number(r.Position),
        candidates: num(r.N_Cand),
        votes: num(r.Votes),
        voteShare: num(r.Vote_Share_Percentage),
        // For a winner: the lead over the runner-up, as the archive gives it.
        margin: won ? num(r.Margin) : undefined,
        marginPct: won ? num(r.Margin_Percentage) : undefined,
        turnout: num(r.Turnout_Percentage),
        runnerUp: won && runnerUp ? { name: title(runnerUp.Candidate), party: runnerUp.Party } : undefined,
    };
}
const order = (a, b) => b.year - a.year || Number(!!b.byElection) - Number(!!a.byElection);

const SOURCE = {
    id: 'tcpd-lok-dhaba-2023-06',
    title: 'Lok Dhaba: Indian election results, data archive as on June 2023',
    publisher: 'Trivedi Centre for Political Data, Ashoka University',
    type: 'statistics',
    url: 'https://github.com/tcpd/tcpd-ld-data-archive',
    date: '2023-06-30',
    retrievedAt: TODAY,
    note: `Commit ${COMMIT.slice(0, 10)}. Compiled by the Centre from the Election Commission of India's statistical reports. Ends in June 2023, so the 2024 Lok Sabha election and later by-elections are not in it. Which contests belong to one person is the Centre's own linking, and can be wrong.`,
};

for (const st of STATES) {
    fetchFiles([`downloads/${st.folder}/${st.folder}_AE.csv.gz`, `downloads/${st.folder}/${st.folder}_GE.csv.gz`]);
    const load = kind => parseCsv(gunzipSync(readFileSync(resolve(CACHE, `downloads/${st.folder}/${st.folder}_${kind}.csv.gz`))).toString('utf8'));
    const ae = load('AE'), ge = load('GE');
    const all = [...ae, ...ge];
    const byPid = new Map();
    for (const r of all) if (r.pid) byPid.set(r.pid, [...(byPid.get(r.pid) ?? []), r]);
    const second = new Map(); // "<type>|<year>|<poll>|<constituency no>" -> the runner-up row
    const key = r => `${r.Election_Type}|${r.Year}|${r.Poll_No}|${r.Constituency_No}`;
    for (const r of all) if (r.Position === '2') second.set(key(r), r);
    // Other ids of the same person: same seat (today's numbering), a closely matching name.
    const CURRENT_SEATS = '4'; // the archive's DelimID for the 2008 delimitation
    // The other id must have been a serious candidate there (kept the deposit): namesakes put up to confuse
    // voters lose theirs. And it must not have stood in an election this person is already in.
    const sameSeat = (rows, pid, name, no) => {
        const mine = new Set(byPid.get(pid).map(key));
        const others = new Set(rows.filter(r => r.DelimID === CURRENT_SEATS && Number(r.Constituency_No) === no && r.pid && r.pid !== pid
            && r.Deposit_Lost === 'no' && tokens(r.Candidate).length >= 2 && resemblance(r.Candidate, name) >= 0.8).map(r => r.pid));
        const pids = [pid, ...[...others].filter(p => !byPid.get(p).some(r => mine.has(key(r))))];
        return clash(pids) ? [pid] : pids; // two of the other ids were in one election: join none
    };
    /** Does this set of ids put one person in the same election in the same seat twice? */
    const clash = pids => { const keys = pids.flatMap(p => byPid.get(p)).map(key); return new Set(keys).size !== keys.length; };
    const history = pids => pids.flatMap(p => byPid.get(p)).map(r => contest(r, second.get(key(r)))).sort(order);
    const summary = (seat, pids, basis) => {
        const pid = pids.join('+');
        const contests = history(pids);
        const last = contests.find(c => c.position === 1);
        return { seat, pid, basis, contests: contests.length, wins: contests.filter(c => c.position === 1).length, first: Math.min(...contests.map(c => c.year)), last };
    };
    const outDir = resolve(ROOT, `public/data/elections/${st.slug}`);
    rmSync(outDir, { recursive: true, force: true });
    mkdirSync(outDir, { recursive: true });
    mkdirSync(resolve(ROOT, 'data/in/elections'), { recursive: true });
    const write = (file, seat, pids) => writeFileSync(resolve(outDir, file), JSON.stringify({ seat, pid: pids.join('+'), contests: history(pids) }) + '\n');

    // ----- MLAs -----
    const house = JSON.parse(readFileSync(resolve(ROOT, `data/in/representatives/${st.assembly}.json`), 'utf8'));
    const lastYear = Math.max(...ae.filter(r => r.Poll_No === '0').map(r => Number(r.Year)));
    const winner = new Map(ae.filter(r => Number(r.Year) === lastYear && r.Poll_No === '0' && r.Position === '1').map(r => [Number(r.Constituency_No), r]));
    const seats = [], unmatched = [];
    for (const s of house.seats) {
        const w = winner.get(s.number);
        const why = !s.member ? 'vacant' : s.member.since ? 'came in at a by-election after the archive ends' : !w ? `no ${lastYear} result for seat ${s.number}` : !w.pid ? 'the winner has no person id in the archive'
            : resemblance(s.member.name, w.Candidate) < 0.5 ? `name does not resemble the ${lastYear} winner "${w.Candidate}"`
            : clash([w.pid]) ? 'the archive files two candidates of one election under this id' : null;
        if (why) { unmatched.push({ seat: s.id, name: s.member?.name, why }); continue; }
        const pids = sameSeat(ae, w.pid, w.Candidate, s.number);
        seats.push(summary(s.id, pids, `winner of seat ${s.number} in ${lastYear}${pids.length > 1 ? ', with earlier contests in the same seat joined by name' : ''}`));
        write(`ac-${s.number}.json`, s.id, pids);
    }
    writeFileSync(resolve(ROOT, `data/in/elections/${st.assembly}.json`), JSON.stringify({
        id: `elections-${st.assembly}`, house: house.house, state: st.slug, asOf: SOURCE.date, lastGeneralElection: lastYear, sources: [SOURCE],
        seats: seats.map(x => ({ ...x, sourceId: SOURCE.id })), unmatched,
    }, null, 1) + '\n');
    console.log(`${st.assembly}: ${seats.length} of ${house.seats.length} members matched to a person in the archive; ${seats.filter(x => x.pid.includes('+')).length} had earlier contests under another id`);
    const terms = n => seats.filter(x => x.wins === n).length;
    console.log(`   wins on record: one ${terms(1)}, two ${terms(2)}, three ${terms(3)}, four or more ${seats.filter(x => x.wins >= 4).length}`);
    for (const u of unmatched) console.log(`   not matched: ${u.seat} ${u.name ?? ''} (${u.why})`);
    const weak = seats.map(x => ({ x, s: house.seats.find(h => h.id === x.seat), w: winner.get(house.seats.find(h => h.id === x.seat).number) })).map(o => ({ ...o, r: resemblance(o.s.member.name, o.w.Candidate) })).filter(o => o.r < 0.75);
    if (weak.length) console.log(`   matched on the seat with a loosely matching name (${weak.length}); check these:\n` + weak.map(o => `     ${o.s.number} ${o.s.name}: "${o.s.member.name}" = "${o.w.Candidate}" (${o.r.toFixed(2)})`).join('\n'));

    // ----- MPs of the state -----
    const ls = JSON.parse(readFileSync(resolve(ROOT, 'data/in/representatives/lok-sabha-18.json'), 'utf8'));
    const geLast = Math.max(...ge.filter(r => r.Poll_No === '0').map(r => Number(r.Year)));
    const mpSeats = [], mpUnmatched = [];
    for (const s of ls.seats.filter(x => x.state === st.slug)) {
        if (!s.member) { mpUnmatched.push({ seat: s.id, why: 'vacant' }); continue; }
        const no = Number(s.id.slice(s.id.lastIndexOf('-') + 1));
        const prev = ge.find(r => Number(r.Year) === geLast && r.Poll_No === '0' && r.Position === '1' && Number(r.Constituency_No) === no);
        let pid, basis;
        if (prev?.pid && resemblance(s.member.name, prev.Candidate) >= 0.75) { pid = prev.pid; basis = `same name as the seat's ${geLast} winner`; }
        if (!pid) { mpUnmatched.push({ seat: s.id, name: s.member.name, why: `not the seat's ${geLast} winner; the archive ends before the 2024 election` }); continue; }
        if (clash([pid])) { mpUnmatched.push({ seat: s.id, name: s.member.name, why: 'the archive files two candidates of one election under this id' }); continue; }
        const pids = sameSeat(ge, pid, prev.Candidate, no);
        const sum = summary(s.id, pids, basis);
        delete sum.last; // the win that made them MP (2024) is not in the archive
        mpSeats.push(sum);
        write(`pc-${no}.json`, s.id, pids);
    }
    const lsFile = resolve(ROOT, 'data/in/elections/lok-sabha-18.json');
    const prior = existsSync(lsFile) ? JSON.parse(readFileSync(lsFile, 'utf8')) : { seats: [], unmatched: [] };
    const keep = x => !x.seat.startsWith(`${st.slug}:`);
    writeFileSync(lsFile, JSON.stringify({
        id: 'elections-lok-sabha-18', house: 'Lok Sabha', asOf: SOURCE.date, lastGeneralElection: geLast, sources: [SOURCE],
        seats: [...prior.seats.filter(keep), ...mpSeats.map(x => ({ ...x, sourceId: SOURCE.id }))], unmatched: [...prior.unmatched.filter(keep), ...mpUnmatched],
    }, null, 1) + '\n');
    console.log(`lok-sabha-18 / ${st.slug}: ${mpSeats.length} of ${mpSeats.length + mpUnmatched.length} MPs matched`);
    for (const m of mpSeats) console.log(`   ${m.seat} ${ls.seats.find(x => x.id === m.seat).member.name}: ${m.basis}; ${m.contests} contests since ${m.first}`);
    for (const u of mpUnmatched) console.log(`   not matched: ${u.seat} ${u.name ?? ''} (${u.why})`);
}
