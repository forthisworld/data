/**
 * Toll Road Analytics
 *
 * Fills gaps in curated toll-road data with transparent, clearly-labelled
 * estimates. Every estimate carries its method and assumptions so the UI can
 * distinguish reported facts from derived numbers, and every gap maps to a
 * ready-to-file RTI request for obtaining the real figure.
 *
 * All functions are pure - no I/O - so they can run on server or client.
 */

import { FactBasis, TollRoad } from '@/types';

export type DataConfidence = 'reported' | 'estimated' | 'unknown';

export interface YearEstimate {
    year: number;
    /** Annual toll revenue in INR */
    revenue: number | null;
    confidence: DataConfidence;
    trafficVehiclesPerDay?: number;
    note?: string;
}

export interface CumulativeEstimate {
    /** Central estimate */
    total: number;
    /** Conservative bound: estimated years discounted 50% (reported years unchanged) */
    totalLow: number;
    confidence: DataConfidence;
    fromYear: number;
    toYear: number;
}

export interface RecoveryProgress {
    recoveredPct: number | null;
    recoveredPctLow: number | null;
    cumulativeRevenue: CumulativeEstimate | null;
    projectCost: number | null;
    verdict: string;
}

export interface DataGap {
    id: string;
    label: string;
    whyItMatters: string;
    rtiSubject: string;
    rtiBody: string;
    departmentHint?: string;
}

/** Assumed annual growth of toll rates (used to discount historical years). */
export const RATE_GROWTH = 0.05;

/** How many years beyond the nearest traffic observation we still dare estimate. */
export const MAX_EXTRAPOLATION_YEARS = 5;

/** Assumptions used when deriving revenue from traffic x rates. */
export const REVENUE_ASSUMPTIONS = [
    'Traffic counted at toll-plaza averages; daily figures assumed representative of the whole year',
    'Effective rate = simple average of all non-zero vehicle-class rates (no vehicle-mix weighting)',
    'Collection efficiency assumed at 85% (exemptions, monthly passes, leakage)',
    `Toll rates assumed to grow ~${Math.round(RATE_GROWTH * 100)}%/year; historical years are discounted accordingly`,
    `Estimates are only produced within ${MAX_EXTRAPOLATION_YEARS} years of an actual traffic observation; beyond that the year is left unknown`,
    'The conservative bound of each range discounts all estimated years by 50% (reported figures are never discounted)',
];

const COLLECTION_EFFICIENCY = 0.85;

/** True for court/audit findings, official records and company filings. */
export function isEstablished(basis: FactBasis | undefined): boolean {
    return basis === 'court_finding' || basis === 'audit_finding' || basis === 'official_record' || basis === 'company_filing';
}

function toIntYear(year: number | string): number | null {
    const n = typeof year === 'number' ? year : parseInt(year, 10);
    return Number.isFinite(n) ? n : null;
}

/** Average of all non-zero current rates. */
export function effectiveRatePerTrip(road: TollRoad): number | null {
    const rates = (road.currentRates ?? []).map(r => r.amount.value).filter(v => v > 0);
    if (rates.length === 0) return null;
    return rates.reduce((s, v) => s + v, 0) / rates.length;
}

function openingYear(road: TollRoad): number {
    if (road.openedDate) {
        const y = toIntYear(road.openedDate.slice(0, 4));
        if (y) return y;
    }
    const firstTimeline = road.timeline?.[0]?.date;
    if (firstTimeline) {
        const y = toIntYear(firstTimeline.slice(0, 4));
        if (y) return y;
    }
    return new Date().getFullYear() - 10;
}

/**
 * Linear interpolation of a value series over years; flat outside the
 * known range (nearest-value carry-forward/backward).
 */
function interpolate(
    points: { year: number; value: number }[],
    year: number
): number | null {
    if (points.length === 0) return null;
    const sorted = [...points].sort((a, b) => a.year - b.year);
    if (year <= sorted[0].year) return sorted[0].value;
    if (year >= sorted[sorted.length - 1].year) return sorted[sorted.length - 1].value;
    for (let i = 0; i < sorted.length - 1; i++) {
        const a = sorted[i];
        const b = sorted[i + 1];
        if (year >= a.year && year <= b.year) {
            const t = b.year === a.year ? 0 : (year - a.year) / (b.year - a.year);
            return a.value + t * (b.value - a.value);
        }
    }
    return null;
}

/**
 * Build a complete year-by-year revenue series from opening to now,
 * marking each year as reported or estimated.
 *
 * Methodology:
 * - Reported revenue figures are used as-is.
 * - Otherwise, revenue = interpolated traffic x rate-adjusted average trip
 *   rate x 365 x collection efficiency.
 * - Historical rates are discounted at RATE_GROWTH/year relative to the
 *   reference year (the latest year with a traffic observation).
 * - Years further than MAX_EXTRAPOLATION_YEARS from any traffic observation
 *   are left unknown rather than guessed.
 */
export function buildRevenueSeries(road: TollRoad, currentYear = new Date().getFullYear()): YearEstimate[] {
    const start = openingYear(road);
    const known = road.annualRevenue ?? [];

    const trafficPoints = known
        .map(e => ({ year: toIntYear(e.year), value: e.trafficVehiclesPerDay }))
        .filter((p): p is { year: number; value: number } => p.year !== null && p.value !== undefined);

    const baseRate = effectiveRatePerTrip(road);
    const refYear = trafficPoints.length > 0
        ? Math.max(...trafficPoints.map(p => p.year))
        : currentYear;

    const series: YearEstimate[] = [];

    for (let year = start; year <= currentYear; year++) {
        const entry = known.find(e => toIntYear(e.year) === year);

        // Reported revenue wins outright
        if (entry?.revenue?.value) {
            series.push({
                year,
                revenue: entry.revenue.value,
                confidence: 'reported',
                trafficVehiclesPerDay: entry.trafficVehiclesPerDay,
                note: entry.note,
            });
            continue;
        }

        // Traffic: interpolate inside the observed range; flat-carry only
        // within MAX_EXTRAPOLATION_YEARS of the nearest observation.
        let traffic: number | undefined;
        if (trafficPoints.length > 0) {
            const years = trafficPoints.map(p => p.year);
            const nearest = Math.min(...years.map(y => Math.abs(y - year)));
            if (nearest <= MAX_EXTRAPOLATION_YEARS) {
                traffic = Math.round(interpolate(trafficPoints, year)!);
            }
        } else {
            traffic = entry?.trafficVehiclesPerDay;
        }

        // Rate: discount/escalate relative to the reference year.
        const rateForYear = baseRate
            ? baseRate / Math.pow(1 + RATE_GROWTH, refYear - year)
            : null;

        if (traffic && rateForYear) {
            const revenue = Math.round(traffic * rateForYear * 365 * COLLECTION_EFFICIENCY);
            series.push({
                year,
                revenue,
                confidence: 'estimated',
                trafficVehiclesPerDay: traffic,
                note: `Estimated: ${traffic.toLocaleString('en-IN')} veh/day x ~Rs ${Math.round(rateForYear)} avg rate (rate-adjusted to ${year}) x 365 x ${COLLECTION_EFFICIENCY}`,
            });
            continue;
        }

        series.push({
            year,
            revenue: null,
            confidence: 'unknown',
            trafficVehiclesPerDay: traffic,
            note: entry?.note ?? (trafficPoints.length === 0 ? 'No traffic observation near this year' : 'Too far from any traffic data to estimate'),
        });
    }

    return series;
}

/**
 * Cumulative collections since opening. Unknown years contribute 0 and are
 * reflected in the overall confidence level. `totalLow` discounts every
 * estimated year by 50% to give a conservative bound.
 */
export function estimateCumulativeRevenue(road: TollRoad): CumulativeEstimate | null {
    // An established total (court or audit finding, official record, filing) beats any estimate.
    const established = (road.collections ?? []).filter(
        c => /toll/i.test(c.label) && c.amount.value > 0 && isEstablished(c.amount.basis)
    );
    if (established.length > 0) {
        const total = established.reduce((s, c) => s + c.amount.value, 0);
        const years = established.flatMap(c => [c.from, c.to]).map(y => (y ? toIntYear(y.slice(0, 4)) : null)).filter((y): y is number => y !== null);
        return {
            total,
            totalLow: total,
            confidence: 'reported',
            fromYear: years.length ? Math.min(...years) : openingYear(road),
            toYear: years.length ? Math.max(...years) : new Date().getFullYear(),
        };
    }

    const series = buildRevenueSeries(road);
    const withRevenue = series.filter(y => y.revenue !== null);
    if (withRevenue.length === 0) return null;

    let total = 0;
    let totalLow = 0;
    for (const y of withRevenue) {
        total += y.revenue ?? 0;
        totalLow += y.confidence === 'reported' ? (y.revenue ?? 0) : (y.revenue ?? 0) * 0.5;
    }
    const anyUnknown = series.some(y => y.confidence !== 'reported');
    return {
        total,
        totalLow,
        confidence: anyUnknown ? 'estimated' : 'reported',
        fromYear: withRevenue[0].year,
        toYear: withRevenue[withRevenue.length - 1].year,
    };
}

/**
 * How much of the project cost has likely been recovered by tolls so far.
 */
export function estimateRecoveryProgress(road: TollRoad): RecoveryProgress {
    // Claims and press reports never feed a calculation (data/SOURCING.md).
    const projectCost = road.projectCost && isEstablished(road.projectCost.basis) ? road.projectCost.value : null;
    const cumulative = estimateCumulativeRevenue(road);

    if (!projectCost || !cumulative) {
        let verdict = 'Cannot be determined yet';
        if (!projectCost) verdict += ' - audited project cost unknown';
        if (!cumulative) verdict += ' - no revenue or traffic data available';
        return { recoveredPct: null, recoveredPctLow: null, cumulativeRevenue: cumulative, projectCost, verdict };
    }

    const recoveredPct = Math.round((cumulative.total / projectCost) * 100);
    const recoveredPctLow = Math.round((cumulative.totalLow / projectCost) * 100);
    if (cumulative.confidence === 'reported') {
        // Both numbers are established (court/audit/official/filing); this is arithmetic, not an estimate.
        const verdict =
            `Toll collected in ${cumulative.fromYear}–${cumulative.toYear} was ${recoveredPct}% of the original project cost. ` +
            `This compares the two cited figures only; the concession's own recovery formula also added returns, maintenance and other costs.`;
        return { recoveredPct, recoveredPctLow, cumulativeRevenue: cumulative, projectCost, verdict };
    }
    // Past this point the total includes estimated years.
    const rangeTxt = recoveredPctLow !== recoveredPct ? `${recoveredPctLow}-${recoveredPct}%` : `~${recoveredPct}%`;
    let verdict: string;
    if (recoveredPct >= 100) {
        verdict = `Tolls have likely recovered somewhere between ${rangeTxt} of the stated project cost - well past any reasonable recovery threshold, which is precisely why the official recovery accounting needs to be published`;
    } else if (recoveredPct >= 70) {
        verdict = `Close to full recovery (${rangeTxt}); continued tolling needs justification`;
    } else {
        verdict = `Approximately ${rangeTxt} of the stated project cost recovered through tolls`;
    }
    return { recoveredPct, recoveredPctLow, cumulativeRevenue: cumulative, projectCost, verdict };
}

/**
 * Detect the most important missing data points and generate ready-to-file
 * RTI requests for each.
 */
export function getDataGaps(road: TollRoad): DataGap[] {
    const gaps: DataGap[] = [];
    const operator = road.concession?.operator ?? road.operatorCompany ?? 'the concessionaire';
    const authority = road.concession?.grantingAuthority ?? 'the competent authority';

    const hasReportedRevenue =
        (road.annualRevenue ?? []).some(e => e.revenue?.value && isEstablished(e.revenue.basis)) ||
        (road.collections ?? []).some(c => /toll/i.test(c.label) && isEstablished(c.amount.basis));
    if (!hasReportedRevenue) {
        gaps.push({
            id: 'annual-revenue',
            label: 'Annual toll revenue',
            whyItMatters: 'Without official revenue figures, every collection estimate on this page remains an approximation.',
            departmentHint: authority,
            rtiSubject: `RTI Application - Toll Revenue Figures for ${road.name}`,
            rtiBody:
                `I request the following information under the Right to Information Act, 2005 regarding ${road.name} operated by ${operator}:\n\n` +
                `1. Year-wise gross toll revenue collected from ${openingYear(road)} to the latest completed financial year\n` +
                `2. Vehicle-count statistics per toll plaza for the last five financial years\n` +
                `3. Copies of any revenue statements/audits submitted by the concessionaire to the authority\n`,
        });
    }

    if (!road.projectCost || road.projectCost.value === 0) {
        gaps.push({
            id: 'project-cost',
            label: 'Audited project cost',
            whyItMatters: 'The recovery threshold depends entirely on what officially counts as "project cost".',
            departmentHint: authority,
            rtiSubject: `RTI Application - Audited Project Cost of ${road.name}`,
            rtiBody:
                `I request the following information under the Right to Information Act, 2005 regarding ${road.name}:\n\n` +
                `1. The total project cost claimed by the concessionaire under the concession agreement\n` +
                `2. Break-up of the claimed cost (construction, land, financing, overheads)\n` +
                `3. Details of any independent audit or government review of the claimed cost\n`,
        });
    }

    const hasFundingBreakdown = (road.funding ?? []).every(f => f.amount.value > 0);
    if ((road.funding ?? []).length === 0 || !hasFundingBreakdown) {
        gaps.push({
            id: 'funding-breakdown',
            label: 'Funding structure (equity/debt/grants)',
            whyItMatters: 'Public contributions (land, grants, annuities) should be netted against what tolls must recover.',
            departmentHint: authority,
            rtiSubject: `RTI Application - Funding Structure of ${road.name}`,
            rtiBody:
                `I request the following information under the Right to Information Act, 2005 regarding ${road.name}:\n\n` +
                `1. Equity infused by the concessionaire into the project SPV\n` +
                `2. Debt drawn from banks/institutions and its current outstanding\n` +
                `3. Any government grant, viability-gap funding, land contribution or annuity provided\n`,
        });
    }

    if (!road.concession?.scheduledEndDate && !road.concession?.tollEndCondition) {
        gaps.push({
            id: 'concession-end',
            label: 'Concession end date / toll exit condition',
            whyItMatters: 'A toll road without a defined end condition can collect indefinitely.',
            departmentHint: authority,
            rtiSubject: `RTI Application - Concession Term and Toll Exit Conditions for ${road.name}`,
            rtiBody:
                `I request the following information under the Right to Information Act, 2005 regarding ${road.name}:\n\n` +
                `1. The contractual end date or exit condition for toll collection under the concession agreement\n` +
                `2. All amendments/extensions to the concession agreement to date, with dates\n` +
                `3. The authority's computation of the amount yet to be recovered by the concessionaire\n`,
        });
    }

    return gaps;
}
