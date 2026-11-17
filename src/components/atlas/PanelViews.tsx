'use client';

/**
 * What the atlas's side panel (phone: drawer) shows for a road, a place or a
 * person. Every figure carries its grade and a link to its source; what is not
 * known is shown as a gap, not left out.
 */

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, ChevronRight, CircleHelp, FileText, Plus, User, Route as RouteIcon, PenLine } from 'lucide-react';
import type { FactBasis, MoneyValue, Person, SourceCitation, TollRoad } from '@/types';
import type { AtlasRegion } from '@/services/country.service';
import { estimateRecoveryProgress, getDataGaps, isEstablished, REVENUE_ASSUMPTIONS } from '@/services/toll-road-analytics';

// ---------- formatting ----------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2016-10-26" → "26 Oct 2016", "2016-12" → "Dec 2016", "2001" → "2001". */
export function fmtDate(d?: string): string {
    if (!d) return '';
    const [y, m, day] = d.split('-');
    if (!m) return y;
    const mon = MONTHS[Number(m) - 1] ?? m;
    return day ? `${Number(day)} ${mon} ${y}` : `${mon} ${y}`;
}

/** Rupees as Indians read them: crore above ₹1 crore, lakh above ₹1 lakh. */
export function fmtInr(v: MoneyValue): string {
    if (v.currency !== 'INR') return `${v.value.toLocaleString('en-IN')} ${v.currency}`;
    const n = v.value;
    const trim = (x: number) => x.toLocaleString('en-IN', { maximumFractionDigits: 2 });
    if (n >= 1e7) return `₹${trim(n / 1e7)} crore`;
    if (n >= 1e5) return `₹${trim(n / 1e5)} lakh`;
    return `₹${trim(n)}`;
}

const period = (from?: string, to?: string) =>
    from && to ? `${fmtDate(from)} – ${fmtDate(to)}` : to ? `up to ${fmtDate(to)}` : from ? `since ${fmtDate(from)}` : '';

/** "NICE Road (Bengaluru Peripheral Road + Link Road)" → "NICE Road" */
export const shortName = (name: string) => name.replace(/\s*\(.*\)\s*$/, '');
/** "NICE Road (Bengaluru Peripheral Road + Link Road)" → "Bengaluru Peripheral Road + Link Road" */
const aside = (name: string) => name.match(/\((.*)\)\s*$/)?.[1];

export const ROLE: Record<string, string> = {
    pm: 'Prime Minister', cm: 'Chief Minister', minister: 'Union Minister', mp: 'Member of Parliament',
    mla: 'Member of the Legislative Assembly', governor: 'Governor', mayor: 'Mayor', councillor: 'Councillor', other: '',
};

// ---------- provenance ----------

const BASIS: Record<FactBasis, { label: string; title: string; tone: 'firm' | 'press' | 'claim' }> = {
    court_finding: { label: 'Court finding', title: 'Stated as a finding by a court', tone: 'firm' },
    audit_finding: { label: 'Audit finding', title: 'Found by the CAG or another statutory auditor', tone: 'firm' },
    official_record: { label: 'Official record', title: 'Gazette, census, legislature or other government record', tone: 'firm' },
    company_filing: { label: 'Company filing', title: "The company's own audited or legal disclosure", tone: 'firm' },
    reported: { label: 'Press report', title: 'Reported by the press; not yet confirmed by a primary source', tone: 'press' },
    claim: { label: 'Claim', title: 'Asserted by a named party; not confirmed', tone: 'claim' },
};
const TONE = {
    firm: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    press: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    claim: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
};

export function Basis({ basis }: { basis?: FactBasis }) {
    if (!basis) return null;
    const b = BASIS[basis];
    return (
        <span title={b.title} className={`inline-flex items-center rounded px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide ${TONE[b.tone]}`}>
            {b.label}
        </span>
    );
}

/** A numbered link to the panel's source list. */
function Cite({ ids, sources }: { ids?: (string | undefined)[]; sources: SourceCitation[] }) {
    const list = (ids ?? []).filter((x): x is string => !!x);
    if (!list.length) return null;
    return (
        <span className="ml-1 inline-flex gap-0.5 align-super text-[10px]">
            {list.map(id => {
                const n = sources.findIndex(s => s.id === id) + 1;
                return (
                    <a key={id} href={`#src-${id}`} title={sources[n - 1]?.title ?? id}
                        onClick={e => {
                            e.preventDefault();
                            const el = document.getElementById(`src-${id}`);
                            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            el?.classList.add('bg-ftw-accent/10');
                            setTimeout(() => el?.classList.remove('bg-ftw-accent/10'), 1600);
                        }}
                        className="font-semibold text-ftw-accent hover:underline">
                        [{n || id}]
                    </a>
                );
            })}
        </span>
    );
}

function Sources({ sources, lastVerified }: { sources: SourceCitation[]; lastVerified?: string }) {
    return (
        <Section title="Sources">
            <ol className="space-y-2.5">
                {sources.map((s, i) => (
                    <li key={s.id} id={`src-${s.id}`} className="-mx-2 flex gap-2.5 rounded-md px-2 py-1 text-[13px] transition-colors">
                        <span className="w-5 shrink-0 pt-px text-right text-xs font-semibold tabular-nums text-ftw-faint">{i + 1}</span>
                        <div className="min-w-0">
                            {s.url ? (
                                <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-medium text-ftw-text hover:text-ftw-accent">
                                    {s.title} <ArrowUpRight className="inline h-3 w-3" />
                                </a>
                            ) : <span className="font-medium">{s.title}</span>}
                            <p className="text-xs text-ftw-muted">
                                {[s.publisher, s.date && fmtDate(s.date), s.retrievedAt && `read ${fmtDate(s.retrievedAt)}`].filter(Boolean).join(' · ')}
                            </p>
                        </div>
                    </li>
                ))}
            </ol>
            {lastVerified && <p className="mt-3 text-xs text-ftw-faint">Last checked {fmtDate(lastVerified)}</p>}
        </Section>
    );
}

// ---------- layout pieces ----------

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
    return (
        <section className="border-t border-ftw-line px-5 py-4">
            <div className="mb-2.5 flex items-baseline justify-between gap-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ftw-muted">{title}</h3>
                {aside}
            </div>
            {children}
        </section>
    );
}

function Header({ eyebrow, title, sub, children }: { eyebrow: string; title: string; sub?: string; children?: React.ReactNode }) {
    return (
        <header className="px-5 pb-4 pt-1">
            <p className="text-xs font-medium text-ftw-muted">{eyebrow}</p>
            <h2 className="mt-1 text-2xl font-semibold leading-tight tracking-tight text-ftw-text">{title}</h2>
            {sub && <p className="mt-1 text-[13px] leading-snug text-ftw-muted">{sub}</p>}
            {children}
        </header>
    );
}

function Pill({ tone, children }: { tone: 'tolled' | 'free' | 'neutral'; children: React.ReactNode }) {
    const cls = tone === 'tolled' ? 'bg-ftw-tolled/12 text-ftw-tolled' : tone === 'free' ? 'bg-ftw-free/12 text-ftw-free' : 'bg-ftw-raised text-ftw-muted';
    return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{children}</span>;
}

function Gap({ children }: { children: React.ReactNode }) {
    return (
        <li className="flex gap-2.5 text-[13px] leading-snug">
            <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-ftw-faint" />
            <span>{children}</span>
        </li>
    );
}

function Actions({ country }: { country: string }) {
    return (
        <div className="mt-3 flex flex-wrap gap-2">
            <Link href={`/${country}/info-requests`} className="inline-flex items-center gap-1.5 rounded-full bg-ftw-text px-3 py-1.5 text-xs font-semibold text-ftw-surface hover:opacity-90">
                <FileText className="h-3.5 w-3.5" /> File an RTI
            </Link>
            <Link href="/contribute" className="inline-flex items-center gap-1.5 rounded-full border border-ftw-line px-3 py-1.5 text-xs font-semibold text-ftw-text hover:bg-ftw-raised">
                <Plus className="h-3.5 w-3.5" /> Add a source
            </Link>
        </div>
    );
}

const ANALYSIS: Record<string, string> = {
    cost_recovered: 'Cost recovered', recovering: 'Recovering cost', disputed: 'Disputed', unknown: 'Recovery unknown',
};

// ---------- road ----------

export function RoadView({ road, country, stateNames }: { road: TollRoad; country: string; stateNames: string[] }) {
    const [allEvents, setAllEvents] = useState(false);
    const s = road.sources;
    const a = road.analysis;
    const c = road.concession;
    const free = road.tolling?.status === 'toll_free';
    const figures: { label: string; when?: string; v: MoneyValue }[] = [
        ...(road.projectCost ? [{ label: 'Project cost', v: road.projectCost }] : []),
        ...(road.collections ?? []).map(x => ({ label: x.label, when: period(x.from, x.to), v: x.amount })),
    ].filter(f => f.v.basis !== 'claim');
    const events = road.timeline ?? [];
    const recovery = estimateRecoveryProgress(road);
    const gaps = getDataGaps(road);

    return (
        <article>
            <Header eyebrow={`Toll road · ${stateNames.join(', ')}`} title={shortName(road.name)}
                sub={[aside(road.name), road.officialName && `Officially: ${road.officialName}`].filter(Boolean).join('. ')}>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    {road.tolling && (
                        <Pill tone={free ? 'free' : 'tolled'}>
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            {free ? `Toll-free since ${fmtDate(road.tolling.since)}` : 'Tolled today'}
                            <Cite ids={[road.tolling.sourceId]} sources={s} />
                        </Pill>
                    )}
                    {a && <Pill tone="neutral">{ANALYSIS[a.status] ?? a.status}</Pill>}
                </div>
            </Header>

            <Section title="The money">
                {figures.length ? (
                    <div className="grid grid-cols-2 gap-2">
                        {figures.map(f => (
                            <div key={f.label} className="rounded-lg bg-ftw-raised p-3">
                                <p className="text-[11px] leading-tight text-ftw-muted">{f.label}{f.when ? `, ${f.when}` : ''}</p>
                                <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight">{fmtInr(f.v)}<Cite ids={[f.v.sourceId]} sources={s} /></p>
                                <div className="mt-1"><Basis basis={f.v.basis} /></div>
                                {f.v.note && <p className="mt-1.5 text-[11px] leading-snug text-ftw-faint">{f.v.note}</p>}
                            </div>
                        ))}
                    </div>
                ) : (
                    <ul className="space-y-2">
                        <Gap><b>Project cost:</b> no established figure on record here yet.</Gap>
                        <Gap><b>Toll collected:</b> no established figure on record here yet{road.claims?.length ? '; the figures below are claims, not findings' : ''}.</Gap>
                    </ul>
                )}
            </Section>

            {recovery.recoveredPct !== null && recovery.cumulativeRevenue && (
                <Section title={recovery.cumulativeRevenue.confidence === 'reported' ? 'Collected against cost' : 'Estimate: collected against cost'}>
                    <div className="flex items-baseline gap-2">
                        <span className={`text-3xl font-semibold tabular-nums tracking-tight ${recovery.recoveredPct >= 100 ? 'text-ftw-tolled' : ''}`}>
                            {recovery.recoveredPctLow !== null && recovery.recoveredPctLow !== recovery.recoveredPct ? `${recovery.recoveredPctLow}–` : ''}{recovery.recoveredPct}%
                        </span>
                        <span className="text-xs text-ftw-muted">of the project cost, {recovery.cumulativeRevenue.fromYear}–{recovery.cumulativeRevenue.toYear}</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ftw-raised">
                        <div className={`h-full rounded-full ${recovery.recoveredPct >= 100 ? 'bg-ftw-tolled' : 'bg-ftw-accent'}`} style={{ width: `${Math.min(100, recovery.recoveredPct)}%` }} />
                    </div>
                    <p className="mt-2 text-[13px] leading-snug text-ftw-muted">{recovery.verdict}</p>
                    {recovery.cumulativeRevenue.confidence !== 'reported' && (
                        <details className="mt-2 text-xs text-ftw-muted">
                            <summary className="cursor-pointer font-medium text-ftw-accent">How this is estimated</summary>
                            <ul className="mt-1.5 list-disc space-y-1 pl-4">{REVENUE_ASSUMPTIONS.map(x => <li key={x}>{x}</li>)}</ul>
                        </details>
                    )}
                </Section>
            )}

            {(road.funding?.length ?? 0) > 0 && (
                <Section title="Where the money came from">
                    <ul className="space-y-2 text-[13px]">
                        {road.funding!.map(f => (
                            <li key={f.label} className="flex items-start justify-between gap-3">
                                <span>{f.label}{f.note && <span className="block text-xs text-ftw-muted">{f.note}</span>}</span>
                                <span className="shrink-0 text-right">
                                    <span className="font-semibold tabular-nums">{f.amount.value > 0 ? fmtInr(f.amount) : 'unknown'}</span><Cite ids={[f.amount.sourceId]} sources={s} />
                                    <span className="block"><Basis basis={f.amount.basis} /></span>
                                </span>
                            </li>
                        ))}
                    </ul>
                </Section>
            )}

            {(road.annualRevenue?.length ?? 0) > 0 && (
                <Section title="Year by year">
                    <table className="w-full text-[13px] tabular-nums">
                        <thead><tr className="text-left text-xs text-ftw-muted"><th className="pb-1 font-medium">Year</th><th className="pb-1 font-medium">Toll revenue</th><th className="pb-1 font-medium">Vehicles a day</th></tr></thead>
                        <tbody>
                            {road.annualRevenue!.map(y => (
                                <tr key={String(y.year)} className="border-t border-ftw-line">
                                    <td className="py-1.5">{y.year}</td>
                                    <td className="py-1.5">{y.revenue ? <>{fmtInr(y.revenue)}<Cite ids={[y.revenue.sourceId]} sources={s} />{!isEstablished(y.revenue.basis) && <span className="ml-1"><Basis basis={y.revenue.basis} /></span>}</> : '–'}</td>
                                    <td className="py-1.5">{y.trafficVehiclesPerDay?.toLocaleString('en-IN') ?? '–'}<Cite ids={[y.trafficSourceId]} sources={s} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Section>
            )}

            {(road.currentRates?.length ?? 0) > 0 && (
                <Section title="Toll rates now">
                    <ul className="space-y-1.5 text-[13px]">
                        {road.currentRates!.map(r => (
                            <li key={r.vehicleClass + (r.section ?? '') + (r.trip ?? '')} className="flex justify-between gap-3">
                                <span>{r.vehicleClass}{r.section ? <span className="text-ftw-muted"> · {r.section}</span> : null}{r.trip && r.trip !== 'single' ? <span className="text-ftw-muted"> · {r.trip.replace('_', ' ')}</span> : null}</span>
                                <span className="font-semibold tabular-nums">{fmtInr(r.amount)}<Cite ids={[r.amount.sourceId]} sources={s} /></span>
                            </li>
                        ))}
                    </ul>
                </Section>
            )}

            {a && (
                <Section title={free ? 'Why tolls ended' : 'Why it is still tolled'}>
                    <p className="text-[13px] leading-relaxed text-ftw-text">{a.summary}<Cite ids={a.summarySourceIds} sources={s} /></p>
                    {a.reasonsStillTolled.length > 0 && (
                        <ul className="mt-3 space-y-2.5">
                            {a.reasonsStillTolled.map(r => (
                                <li key={r.text} className="flex gap-2.5 text-[13px] leading-snug">
                                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ftw-faint" />
                                    <span>{r.text}<Cite ids={r.sourceIds} sources={s} /></span>
                                </li>
                            ))}
                        </ul>
                    )}
                </Section>
            )}

            {(road.claims?.length ?? 0) > 0 && (
                <Section title="Claims, not yet confirmed">
                    <ul className="space-y-3">
                        {road.claims!.map(cl => (
                            <li key={cl.text} className="rounded-lg border border-dashed border-rose-500/30 p-3 text-[13px] leading-snug">
                                <div className="mb-1.5 flex items-center gap-2"><Basis basis="claim" />{cl.amount && <span className="font-semibold tabular-nums">{fmtInr(cl.amount)}</span>}</div>
                                <p>{cl.text}<Cite ids={[cl.sourceId]} sources={s} /></p>
                                <p className="mt-1 text-xs text-ftw-muted">{cl.claimedBy}{cl.date ? `, ${fmtDate(cl.date)}` : ''}</p>
                            </li>
                        ))}
                    </ul>
                </Section>
            )}

            {((a?.openQuestions.length ?? 0) > 0 || gaps.length > 0) && (
                <Section title="What we don't know yet">
                    {(a?.openQuestions.length ?? 0) > 0 && <ul className="space-y-2">{a!.openQuestions.map(q => <Gap key={q}>{q}</Gap>)}</ul>}
                    {gaps.length > 0 && (
                        <>
                            <p className="mb-2 mt-4 text-xs font-medium text-ftw-muted">Ready-made RTI applications</p>
                            <ul className="space-y-2">
                                {gaps.map(g => (
                                    <li key={g.id}>
                                        <Link href={`/${country}/info-requests?${new URLSearchParams({ subject: g.rtiSubject, body: g.rtiBody, ...(g.departmentHint ? { dept: g.departmentHint } : {}) })}`}
                                            className="group flex items-start gap-3 rounded-lg border border-ftw-line p-3 hover:bg-ftw-raised">
                                            <PenLine className="mt-0.5 h-4 w-4 shrink-0 text-ftw-accent" />
                                            <span className="min-w-0 flex-1 text-[13px] leading-snug">
                                                <span className="block font-semibold">{g.label}</span>
                                                <span className="block text-xs text-ftw-muted">{g.whyItMatters}</span>
                                            </span>
                                            <ChevronRight className="mt-0.5 h-4 w-4 text-ftw-faint group-hover:text-ftw-text" />
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                    <Actions country={country} />
                </Section>
            )}

            {c && (
                <Section title="The contract">
                    <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 text-[13px]">
                        <dt className="text-ftw-muted">Model</dt><dd>{c.model}{c.modelName ? <span className="text-ftw-muted">: {c.modelName}</span> : null}</dd>
                        {c.signingDate && <><dt className="text-ftw-muted">Signed</dt><dd>{fmtDate(c.signingDate)}</dd></>}
                        {c.termYears && <><dt className="text-ftw-muted">Term</dt><dd>{c.termYears} years</dd></>}
                        <dt className="text-ftw-muted">Operator</dt><dd>{c.operator}</dd>
                        <dt className="text-ftw-muted">Granted by</dt><dd>{c.grantingAuthority}</dd>
                        {c.tollEndCondition && <><dt className="text-ftw-muted">Tolls end</dt><dd className="leading-snug">{c.tollEndCondition}</dd></>}
                    </dl>
                </Section>
            )}

            {events.length > 0 && (
                <Section title="Timeline" aside={events.length > 4 && (
                    <button onClick={() => setAllEvents(v => !v)} className="text-xs font-medium text-ftw-accent hover:underline">{allEvents ? 'Show fewer' : `All ${events.length}`}</button>
                )}>
                    <ol className="relative ml-1.5 space-y-3 border-l border-ftw-line pl-4">
                        {(allEvents ? events : events.slice(-4)).map(e => (
                            <li key={e.date + e.title} className="relative text-[13px] leading-snug">
                                <span className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-ftw-surface ${e.significance === 'positive' ? 'bg-ftw-free' : e.significance === 'negative' ? 'bg-ftw-tolled' : 'bg-ftw-faint'}`} />
                                <p className="text-xs font-medium tabular-nums text-ftw-muted">{fmtDate(e.date)}</p>
                                <p className="font-medium">{e.title}<Cite ids={[e.sourceId]} sources={s} /></p>
                                {allEvents && e.description && <p className="mt-0.5 text-ftw-muted">{e.description}</p>}
                            </li>
                        ))}
                    </ol>
                </Section>
            )}

            <Sources sources={s} lastVerified={road.lastVerified} />
        </article>
    );
}

// ---------- place ----------

export interface PlaceInfo {
    kind: 'state' | 'district';
    name: string;
    state?: string;
    code?: string;
}

export function PlaceView({ place, region, roads, people, country, onRoad, onPerson }: {
    place: PlaceInfo;
    region?: AtlasRegion;
    roads: TollRoad[];
    people: Person[];
    country: string;
    onRoad: (slug: string) => void;
    onPerson: (slug: string) => void;
}) {
    const eyebrow = place.kind === 'district' ? `District · ${place.state}` : region?.level === 'union_territory' ? 'Union territory' : 'State';
    const questions = roads.flatMap(r => (r.analysis?.openQuestions ?? []).map(q => ({ q, road: shortName(r.name) }))).slice(0, 4);
    const known = roads.length + people.length;

    return (
        <article>
            <Header eyebrow={eyebrow} title={place.name}
                sub={known ? [roads.length && `${roads.length} road${roads.length === 1 ? '' : 's'}`, people.length && `${people.length} office-holder${people.length === 1 ? '' : 's'}`].filter(Boolean).join(' and ') + ' on record' : 'Nothing on record here yet'} />

            {roads.length > 0 && (
                <Section title="Roads on record">
                    <ul className="space-y-2">
                        {roads.map(r => {
                            const free = r.tolling?.status === 'toll_free';
                            return (
                                <li key={r.slug}>
                                    <button onClick={() => onRoad(r.slug)} className="group flex w-full items-center gap-3 rounded-lg bg-ftw-raised p-3 text-left hover:ring-1 hover:ring-ftw-line">
                                        <RouteIcon className={`h-5 w-5 shrink-0 ${free ? 'text-ftw-free' : 'text-ftw-tolled'}`} />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-semibold">{shortName(r.name)}</span>
                                            <span className="block text-xs text-ftw-muted">
                                                {free ? `Toll-free since ${fmtDate(r.tolling?.since)}` : 'Tolled'} · {r.analysis?.openQuestions.length ?? 0} open questions
                                            </span>
                                        </span>
                                        <ChevronRight className="h-4 w-4 text-ftw-faint group-hover:text-ftw-text" />
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </Section>
            )}

            <Section title="Who answers for it">
                {people.length > 0 && (
                    <ul className="mb-3 space-y-2">
                        {people.map(p => (
                            <li key={p.slug}>
                                <button onClick={() => onPerson(p.slug)} className="group flex w-full items-center gap-3 rounded-lg p-1.5 text-left hover:bg-ftw-raised">
                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ftw-raised"><User className="h-4 w-4 text-ftw-muted" /></span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-semibold">{p.name}</span>
                                        <span className="block text-xs text-ftw-muted">{[ROLE[p.role] || p.role, p.party, p.tenure?.start && `since ${fmtDate(p.tenure.start)}`].filter(Boolean).join(' · ')}</span>
                                    </span>
                                    <ChevronRight className="h-4 w-4 text-ftw-faint group-hover:text-ftw-text" />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
                <ul className="space-y-2">
                    {place.kind === 'district' ? (
                        <>
                            <Gap>The MPs and MLAs elected from {place.name}, with their declared assets and cases, are not on record yet.</Gap>
                            <Gap>Who runs the district administration and the local bodies here is not on record yet.</Gap>
                        </>
                    ) : (
                        <Gap>{place.name}&apos;s MPs, MLAs and ministers are not on record yet{people.length ? ', beyond the people above' : ''}.</Gap>
                    )}
                </ul>
                {people.length === 0 && place.kind === 'state' && <p className="mt-2 text-xs text-ftw-faint">Representatives are the next layer we are adding, constituency by constituency.</p>}
            </Section>

            {questions.length > 0 ? (
                <Section title="Open questions here">
                    <ul className="space-y-2">{questions.map(x => <Gap key={x.q}>{x.q} <span className="text-ftw-faint">({x.road})</span></Gap>)}</ul>
                    <Actions country={country} />
                </Section>
            ) : (
                <Section title="Still blank">
                    <ul className="space-y-2">
                        <Gap>What is being built in {place.name} with public money, by whom, and at what cost.</Gap>
                        <Gap>Tolls, contracts and budgets for {place.name}.</Gap>
                    </ul>
                    <Actions country={country} />
                </Section>
            )}

            <footer className="border-t border-ftw-line px-5 py-4 text-xs leading-relaxed text-ftw-faint">
                {place.kind === 'district' ? (
                    <>District as it stood in the 2011 Census (code {place.code}). Districts created since then are not drawn separately yet.</>
                ) : region?.population ? (
                    <>
                        Population {region.population.toLocaleString('en-IN')} ({region.populationAsOf}
                        {region.populationSource?.url && <>, <a href={region.populationSource.url} target="_blank" rel="noopener noreferrer" className="underline">source</a></>}).
                        {region.capital && <> Capital {region.capital}.</>}
                    </>
                ) : null}
            </footer>
        </article>
    );
}

// ---------- person ----------

export function PersonView({ person, country, regionName }: { person: Person; country: string; regionName?: string }) {
    return (
        <article>
            <Header eyebrow={[ROLE[person.role] || person.role, regionName].filter(Boolean).join(' · ')} title={person.name}
                sub={[person.party, person.tenure?.start && `In office since ${fmtDate(person.tenure.start)}`].filter(Boolean).join(' · ')} />
            {person.description && (
                <Section title="Summary">
                    <p className="text-[13px] leading-relaxed">{person.description}<Cite ids={person.sources?.map(x => x.id)} sources={person.sources ?? []} /></p>
                </Section>
            )}
            <Section title="Not on record yet">
                <ul className="space-y-2">
                    <Gap>Declared assets, liabilities and criminal cases, from election affidavits.</Gap>
                    <Gap>Projects and spending they sanctioned or oversee.</Gap>
                </ul>
                <Actions country={country} />
            </Section>
            {person.sources && person.sources.length > 0 && <Sources sources={person.sources} lastVerified={person.lastVerified} />}
        </article>
    );
}

// ---------- all roads ----------

export function RoadsView({ roads, placeName, onRoad }: { roads: TollRoad[]; placeName: (slug: string) => string; onRoad: (slug: string) => void }) {
    return (
        <article>
            <Header eyebrow="Toll roads" title="Every toll road on record"
                sub={`${roads.length} so far. A road is added only when its facts can be cited.`} />
            <Section title="On record">
                <ul className="space-y-2">
                    {roads.map(r => {
                        const free = r.tolling?.status === 'toll_free';
                        return (
                            <li key={r.slug}>
                                <button onClick={() => onRoad(r.slug)} className="group flex w-full items-center gap-3 rounded-lg bg-ftw-raised p-3 text-left hover:ring-1 hover:ring-ftw-line">
                                    <RouteIcon className={`h-5 w-5 shrink-0 ${free ? 'text-ftw-free' : 'text-ftw-tolled'}`} />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-semibold">{shortName(r.name)}</span>
                                        <span className="block text-xs text-ftw-muted">
                                            {r.regionIds.map(placeName).join(', ')} · {free ? `toll-free since ${fmtDate(r.tolling?.since)}` : 'tolled'} · {r.analysis?.openQuestions.length ?? 0} open questions
                                        </span>
                                    </span>
                                    <ChevronRight className="h-4 w-4 text-ftw-faint group-hover:text-ftw-text" />
                                </button>
                            </li>
                        );
                    })}
                </ul>
                <div className="mt-3"><Link href="/contribute" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ftw-accent hover:underline"><Plus className="h-3.5 w-3.5" /> Add a toll road</Link></div>
            </Section>
        </article>
    );
}
