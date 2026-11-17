/**
 * The sourcing rules in data/SOURCING.md, as code. Pure functions (no fs), so
 * the site, the contribution endpoint and scripts/validate-data.ts share them.
 */

import type { AnalysisPoint, Entity, Legislature, MoneyValue, MpladsRecord, Overview, SourceCitation, TollRoad } from '@/types';

const ESTABLISHED = new Set(['court_finding', 'audit_finding', 'official_record', 'company_filing']);
const BASES = new Set([...ESTABLISHED, 'reported', 'claim']);

function checkSources(sources: SourceCitation[] | undefined, where: string, errors: string[]): Set<string> {
    const ids = new Set<string>();
    for (const s of sources ?? []) {
        if (!s.id || !s.title || !s.publisher || !s.type) errors.push(`${where}: source ${s.id || '?'} needs id, title, publisher and type`);
        if (!s.url && !s.note) errors.push(`${where}: source ${s.id} has neither a url nor a note saying where to find it`);
        // A source counts only once someone has actually read it (rule 5).
        if (!s.retrievedAt || !/^\d{4}-\d{2}-\d{2}$/.test(s.retrievedAt)) errors.push(`${where}: source ${s.id} has no retrievedAt (YYYY-MM-DD): read it before citing it`);
        if (ids.has(s.id)) errors.push(`${where}: duplicate source id ${s.id}`);
        ids.add(s.id);
    }
    return ids;
}

function checkMoney(m: MoneyValue | undefined, label: string, ids: Set<string>, errors: string[]): void {
    if (!m || !m.value) return; // zero / absent values are not claims
    if (!m.sourceId) errors.push(`${label}: ${m.value} ${m.currency} has no sourceId`);
    else if (!ids.has(m.sourceId)) errors.push(`${label}: sourceId '${m.sourceId}' is not in sources`);
    if (!m.basis) errors.push(`${label}: no basis (court_finding, audit_finding, official_record, company_filing, reported, claim)`);
    else if (!BASES.has(m.basis)) errors.push(`${label}: unknown basis '${m.basis}'`);
    if (m.basis === 'claim' && !m.claimedBy) errors.push(`${label}: a claim needs claimedBy`);
}

function checkRef(id: string | undefined, label: string, ids: Set<string>, errors: string[], required = true): void {
    if (!id) {
        if (required) errors.push(`${label}: no sourceId`);
        return;
    }
    if (!ids.has(id)) errors.push(`${label}: sourceId '${id}' is not in sources`);
}

export function validateRoad(road: TollRoad): string[] {
    const errors: string[] = [];
    const w = road.slug ?? road.id ?? '?';
    if (!road.id || !road.slug || !road.name) errors.push('missing id/slug/name');
    if (!Array.isArray(road.regionIds) || road.regionIds.length === 0) errors.push('regionIds required');
    if (!Array.isArray(road.sources) || road.sources.length === 0) errors.push('at least one source citation required');
    const ids = checkSources(road.sources, w, errors);

    checkMoney(road.projectCost, 'projectCost', ids, errors);
    road.funding?.forEach((f, i) => checkMoney(f.amount, `funding[${i}] ${f.label}`, ids, errors));
    road.collections?.forEach((c, i) => checkMoney(c.amount, `collections[${i}] ${c.label}`, ids, errors));
    road.currentRates?.forEach((r, i) => checkMoney(r.amount, `currentRates[${i}] ${r.vehicleClass}`, ids, errors));
    road.annualRevenue?.forEach((y, i) => {
        checkMoney(y.revenue, `annualRevenue[${i}] ${y.year}`, ids, errors);
        if (y.trafficVehiclesPerDay) checkRef(y.trafficSourceId, `annualRevenue[${i}] traffic`, ids, errors);
    });
    if (road.tolling) checkRef(road.tolling.sourceId, 'tolling', ids, errors, road.tolling.status === 'toll_free');
    road.timeline?.forEach((t, i) => checkRef(t.sourceId, `timeline[${i}] ${t.title}`, ids, errors));
    road.concession?.extensions?.forEach((e, i) => checkRef(e.sourceId, `concession.extensions[${i}]`, ids, errors));
    road.claims?.forEach((c, i) => {
        checkRef(c.sourceId, `claims[${i}]`, ids, errors);
        if (!c.claimedBy) errors.push(`claims[${i}]: needs claimedBy`);
        checkMoney(c.amount, `claims[${i}].amount`, ids, errors);
    });
    if (road.analysis) {
        (road.analysis.summarySourceIds ?? []).forEach(id => checkRef(id, 'analysis.summary', ids, errors));
        if (!road.analysis.summarySourceIds?.length) errors.push('analysis.summary: no summarySourceIds');
        road.analysis.reasonsStillTolled.forEach((p: AnalysisPoint | string, i) => {
            if (typeof p === 'string') errors.push(`analysis.reasonsStillTolled[${i}]: must be {text, sourceIds}`);
            else if (!p.sourceIds?.length) errors.push(`analysis.reasonsStillTolled[${i}]: no sourceIds`);
            else p.sourceIds.forEach(id => checkRef(id, `analysis.reasonsStillTolled[${i}]`, ids, errors));
        });
    }
    return errors;
}

export function validateEntity(e: Entity & Record<string, unknown>): string[] {
    const errors: string[] = [];
    if (!e.id || !e.slug || !e.name || !e.type) errors.push('missing id/slug/name/type');
    const ids = checkSources(e.sources, e.id, errors);
    // Anything beyond identity (name, place in the hierarchy, map position) needs a source.
    const factual = ['population', 'area', 'description', 'party', 'constituency', 'tenure', 'cost', 'length', 'capacity', 'operator', 'metadata'];
    const present = factual.filter(k => e[k] !== undefined);
    if (present.length && ids.size === 0) errors.push(`has ${present.join(', ')} but no sources`);
    if (e.metadata && 'netWorth' in e.metadata) errors.push('metadata.netWorth is not allowed without a dated source');
    return errors;
}

export function validateOverview(o: Overview): string[] {
    return o.metrics.filter(m => !m.source).map(m => `metric ${m.key}: no source`);
}

/**
 * Who holds each seat. These are "current" facts, so the member list must have been read in the
 * last six months (rule 7), and every seat cites it.
 */
export function validateLegislature(l: Legislature, today = new Date()): string[] {
    const errors: string[] = [];
    const ids = checkSources(l.sources, l.id, errors);
    const read = l.sources.map(s => s.retrievedAt).filter(Boolean).sort().pop();
    if (read && (today.getTime() - new Date(read).getTime()) / 86_400_000 > 183) {
        errors.push(`${l.id}: member list last read ${read}; refresh it (npm run data:lok-sabha), current office-holders need a source from the last six months`);
    }
    const seen = new Set<string>();
    for (const seat of l.seats) {
        const where = `${l.id} / ${seat.name}`;
        if (seen.has(seat.id)) errors.push(`${where}: duplicate seat id ${seat.id}`);
        seen.add(seat.id);
        checkRef(seat.sourceId, where, ids, errors);
        if (seat.status === 'sitting' && (!seat.member?.name || !seat.member.party)) errors.push(`${where}: a sitting seat needs the member's name and party`);
        if (seat.status === 'vacant' && seat.member) errors.push(`${where}: a vacant seat has no member`);
    }
    return errors;
}

/** MPLADS figures: every seat cites the portal, amounts are whole rupees, and parts never exceed wholes. */
export function validateMplads(m: MpladsRecord): string[] {
    const errors: string[] = [];
    const ids = checkSources(m.sources, m.id, errors);
    const seen = new Set<string>();
    for (const s of m.seats) {
        const where = `${m.id} / ${s.seat}`;
        if (seen.has(s.seat)) errors.push(`${where}: duplicate seat`);
        seen.add(s.seat);
        checkRef(s.sourceId, where, ids, errors);
        for (const [k, v] of [['allocated', s.allocated], ['paid', s.paid], ['recommended', s.recommended.amount], ['sanctioned', s.sanctioned.amount], ['completed', s.completed.amount]] as const) {
            if (!Number.isFinite(v) || v < 0) errors.push(`${where}: ${k} is not a non-negative amount`);
        }
        if (s.sanctioned.count > s.recommended.count) errors.push(`${where}: more works sanctioned than recommended`);
        if (s.completed.count > s.recommended.count) errors.push(`${where}: more works completed than recommended`);
    }
    return errors;
}
