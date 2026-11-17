/**
 * Validates the published record against data/SOURCING.md.
 *
 *   npm run data:validate
 *
 * Fails (exit 1) if any published fact lacks a source.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import type { AnalysisPoint, Entity, MoneyValue, Overview, SourceCitation, TollRoad } from '../src/types';

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

function walk(dir: string): string[] {
    return readdirSync(dir).flatMap(name => {
        const p = join(dir, name);
        if (name.startsWith('_')) return [];
        return statSync(p).isDirectory() ? walk(p) : name.endsWith('.json') ? [p] : [];
    });
}

function main(): void {
    const root = join(process.cwd(), 'data');
    let failed = 0;
    for (const country of readdirSync(root).filter(d => statSync(join(root, d)).isDirectory())) {
        for (const file of walk(join(root, country))) {
            const rel = relative(process.cwd(), file).replace(/\\/g, '/');
            const json = JSON.parse(readFileSync(file, 'utf-8'));
            let errors: string[] = [];
            if (rel.includes('/toll-roads/')) errors = validateRoad(json as TollRoad);
            else if (rel.endsWith('overview.json')) errors = validateOverview(json as Overview);
            else if (Array.isArray(json)) {
                json.forEach((e: Entity & Record<string, unknown>) =>
                    validateEntity(e).forEach(err => errors.push(`${e.id}: ${err}`)));
            } // config.json, info-requests.json: configuration and plans, not published facts
            if (errors.length) {
                failed++;
                console.error(`✗ ${rel}`);
                errors.forEach(e => console.error(`   - ${e}`));
            } else {
                console.log(`✓ ${rel}`);
            }
        }
    }
    if (failed) {
        console.error(`\n${failed} file(s) fail the sourcing standard (data/SOURCING.md).`);
        process.exit(1);
    }
}

if (process.argv[1] && /validate-data\.[tj]s$/.test(process.argv[1]) && existsSync('data')) main();
