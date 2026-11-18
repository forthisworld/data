'use client';

/**
 * What the atlas's side panel (phone: drawer) shows for a road, a place, a seat or a
 * person. Every figure carries its grade and a link to its source; what is not
 * known is shown as a gap, not left out.
 *
 * Places and seats lead with one ladder, "Who governs here": the Union tier (the MP), the
 * State tier (the MLA) and the City tier (the local body), with what each is responsible for.
 * Sources and the list of what is not on record sit behind a fold, so the answer comes first.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Building2, ChevronDown, ChevronRight, CircleHelp, FileText, Plus, User, Route as RouteIcon, PenLine } from 'lucide-react';
import type { ElectionContest, ElectionSummary, FactBasis, LegislatureSeat, LocalBody, MoneyValue, MpladsSeat, Person, SourceCitation, TollRoad } from '@/types';
import { partyColour } from '@/lib/parties';
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
                            el?.closest('details')?.setAttribute('open', '');
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

function Sources({ sources, lastVerified, fold, note }: { sources: SourceCitation[]; lastVerified?: string; fold?: boolean; note?: string }) {
    const list = (
        <>
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
            {note && <p className="mt-3 text-xs leading-snug text-ftw-faint">{note}</p>}
            {lastVerified && <p className="mt-3 text-xs text-ftw-faint">Last checked {fmtDate(lastVerified)}</p>}
        </>
    );
    if (!fold) return <Section title="Sources">{list}</Section>;
    return <Fold title={`Sources (${sources.length})`} aside={lastVerified ? `checked ${fmtDate(lastVerified)}` : undefined}>{list}</Fold>;
}

/** A section that starts closed: its title is the button. */
function Fold({ title, aside, children }: { title: string; aside?: string; children: React.ReactNode }) {
    return (
        <details className="group border-t border-ftw-line">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5 hover:bg-ftw-raised [&::-webkit-details-marker]:hidden">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ftw-muted">{title}</span>
                <span className="flex items-center gap-2 text-xs text-ftw-faint">{aside}<ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" /></span>
            </summary>
            <div className="px-5 pb-4">{children}</div>
        </details>
    );
}

/** A smaller fold inside a section. */
function More({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <details className="group mt-2">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-ftw-accent hover:underline [&::-webkit-details-marker]:hidden">
                {label}<ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-2">{children}</div>
        </details>
    );
}

/** What is not on record, folded, with the ways to help fill it. */
function Unknowns({ items, country }: { items: (React.ReactNode | false | undefined)[]; country: string }) {
    const list = items.filter(Boolean);
    if (!list.length) return null;
    return (
        <Fold title={`Not on record yet (${list.length})`}>
            <ul className="space-y-2">{list.map((x, i) => <Gap key={i}>{x}</Gap>)}</ul>
            <Actions country={country} />
        </Fold>
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

export function PlaceView({ place, region, roads, people, seats, seatsLoading, lokSabha, mlas, assembly, cities, country, onRoad, onPerson, onSeat }: {
    place: PlaceInfo;
    region?: AtlasRegion;
    roads: TollRoad[];
    people: Person[];
    /** Lok Sabha seats in (or overlapping) this place. */
    seats: Seat[];
    seatsLoading?: boolean;
    lokSabha: LokSabhaInfo | null;
    /** Assembly seats in (or overlapping) this place, if we have this state's assembly. */
    mlas: Seat[];
    assembly: HouseInfo | null;
    /** Cities on record with part of this place in them. */
    cities: LocalBody[];
    country: string;
    onRoad: (slug: string) => void;
    onPerson: (slug: string) => void;
    onSeat: (id: string) => void;
}) {
    const eyebrow = place.kind === 'district' ? `District · ${place.state}` : region?.level === 'union_territory' ? 'Union territory' : 'State';
    const questions = roads.flatMap(r => (r.analysis?.openQuestions ?? []).map(q => ({ q, road: shortName(r.name) }))).slice(0, 4);
    const part = place.kind === 'district';
    const sources = [...(lokSabha && seats.length ? [lokSabha.source] : []), ...(assembly && mlas.length ? [assembly.source] : []), ...cities.flatMap(c => c.sources)];
    const count = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

    return (
        <article>
            <Header eyebrow={eyebrow} title={place.name}
                sub={[seats.length && count(seats.length, 'MP'), mlas.length && count(mlas.length, 'MLA'), roads.length && count(roads.length, 'toll road')].filter(Boolean).join(' · ') || 'Nothing on record here yet'} />

            <Section title="Who governs here">
                <ol>
                    <Tier tag="Union" name="Lok Sabha" does="Union law and budget">
                        {seatsLoading && <p className="text-xs text-ftw-faint">Loading Lok Sabha seats…</p>}
                        <SeatGroup seats={seats} role="MP" onSeat={onSeat} part={part} />
                        {!seats.length && !seatsLoading && <Missing>The MPs for {place.name} are not on record yet (seat boundaries here were redrawn after the map we use).</Missing>}
                    </Tier>
                    <Tier tag="State" name={assembly?.house ?? 'State assembly'} does="State law and budget" last={!cities.length && !part}>
                        {people.length > 0 && (
                            <ul className="mb-1 space-y-0.5">
                                {people.map(p => (
                                    <li key={p.slug}>
                                        <button onClick={() => onPerson(p.slug)} className="group flex w-full items-center gap-3 rounded-lg p-1.5 text-left hover:bg-ftw-raised">
                                            <Avatar name={p.name} />
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-semibold">{p.name}</span>
                                                <span className="block truncate text-xs text-ftw-muted">{[ROLE[p.role] || p.role, p.party].filter(Boolean).join(' · ')}</span>
                                            </span>
                                            <ChevronRight className="h-4 w-4 shrink-0 text-ftw-faint group-hover:text-ftw-text" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <SeatGroup seats={mlas} role="MLA" onSeat={onSeat} part={part} />
                        {!mlas.length && <Missing>The MLAs elected from {place.name} are not on record yet.</Missing>}
                    </Tier>
                    {cities.map((c, i) => <CityTier key={c.id} city={c} sources={sources} last={i === cities.length - 1} among={mlas} />)}
                    {part && !cities.length && (
                        <Tier tag="Local" name="District and local bodies" last>
                            <Missing>Who runs the district administration and the local bodies here is not on record yet.</Missing>
                        </Tier>
                    )}
                </ol>
            </Section>

            {roads.length > 0 && (
                <Section title="Toll roads here">
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

            <Unknowns country={country} items={[
                ...questions.map(x => <>{x.q} <span className="text-ftw-faint">({x.road})</span></>),
                ...cities.flatMap(c => c.openQuestions),
                'Declared assets and criminal cases of every representative here.',
                `What is being built in ${place.name} with public money, by whom, and at what cost.`,
            ]} />
            {sources.length > 0 && <Sources fold sources={sources} lastVerified={[lokSabha?.asOf, assembly?.asOf].filter(Boolean).sort().pop()}
                note={part ? 'Seats listed are those that cover part of this district.' : undefined} />}

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

// ---------- seats: Lok Sabha and state assemblies ----------

export type Seat = Omit<LegislatureSeat, 'sourceId'>;
/** A house, as the panel needs it. */
export interface HouseInfo { house: string; term: number; asOf: string; source: SourceCitation }
export type LokSabhaInfo = HouseInfo;
const isAssembly = (h: HouseInfo) => h.house !== 'Lok Sabha';

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;

/** A person's initials on their party's colour. */
function Avatar({ name, party, large }: { name?: string; party?: string; large?: boolean }) {
    const words = (name ?? '').replace(/\(.*?\)/g, '').split(/\s+/).filter(w => /[A-Za-z]/.test(w));
    const initials = words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0] ?? '').slice(0, 2);
    const colour = party ? partyColour(party) : undefined;
    return (
        <span className={`flex shrink-0 items-center justify-center rounded-full bg-ftw-raised font-semibold uppercase text-ftw-text ${large ? 'h-12 w-12 text-sm' : 'h-9 w-9 text-[11px]'}`}
            style={colour ? { backgroundColor: `color-mix(in srgb, ${colour} 16%, var(--ftw-surface))`, boxShadow: `inset 0 0 0 1.5px ${colour}` } : undefined} aria-hidden>
            {initials || <User className="h-4 w-4 text-ftw-muted" />}
        </span>
    );
}

function PartyChip({ short, title }: { short?: string; title?: string }) {
    if (!short) return null;
    return (
        <span title={title} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-ftw-line px-1.5 py-px text-[10px] font-semibold text-ftw-muted">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: partyColour(short) }} />{short}
        </span>
    );
}

const partyOf = (seat: Seat) => seat.member?.partyShort ?? seat.member?.party;

function SeatRow({ seat, onSeat, role }: { seat: Seat; onSeat: (id: string) => void; role?: 'MP' | 'MLA' }) {
    return (
        <li>
            <button onClick={() => onSeat(seat.id)} className="group flex w-full items-center gap-3 rounded-lg p-1.5 text-left hover:bg-ftw-raised">
                <Avatar name={seat.member?.name} party={partyOf(seat)} />
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{seat.member?.name ?? 'Vacant'}</span>
                    <span className="block truncate text-xs text-ftw-muted">{role ? `${role} for ${seat.name}` : seat.name}</span>
                </span>
                <PartyChip short={partyOf(seat)} title={seat.member?.party} />
                <ChevronRight className="h-4 w-4 shrink-0 text-ftw-faint group-hover:text-ftw-text" />
            </button>
        </li>
    );
}

function PartySplit({ seats }: { seats: Seat[] }) {
    const counts = new Map<string, number>();
    for (const x of seats) {
        const k = x.member ? (partyOf(x) ?? 'Other') : 'Vacant';
        counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const rows = [...counts].sort((a, b) => b[1] - a[1]);
    return (
        <div>
            <div className="flex h-2 overflow-hidden rounded-full bg-ftw-raised">
                {rows.map(([k, n]) => (
                    <span key={k} title={`${k}: ${n}`} style={{ width: `${(n / seats.length) * 100}%`, backgroundColor: partyColour(k) }} className="h-full border-r border-ftw-surface last:border-0" />
                ))}
            </div>
            <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ftw-muted">
                {rows.map(([k, n]) => <span key={k} className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: partyColour(k) }} />{k} {n}</span>)}
            </p>
        </div>
    );
}

/** One or a few seats as rows; many seats as a party bar with the list behind a fold. */
function SeatGroup({ seats, role, onSeat, part }: { seats: Seat[]; role: 'MP' | 'MLA'; onSeat: (id: string) => void; part?: boolean }) {
    if (!seats.length) return null;
    const rows = <ul className="space-y-0.5">{seats.map(x => <SeatRow key={x.id} seat={x} onSeat={onSeat} role={role} />)}</ul>;
    if (seats.length <= 3) return rows;
    return (
        <>
            <p className="mb-1.5 text-sm font-semibold">{seats.length} {role}s{part ? <span className="font-normal text-ftw-muted"> with seats in part of it</span> : null}</p>
            <PartySplit seats={seats} />
            <More label={`All ${seats.length} ${role}s`}>{rows}</More>
        </>
    );
}

/** One rung of "Who governs here": a level of government, what it does, and who holds it here. */
function Tier({ tag, name, does, here, last, children }: { tag: string; name: string; does?: React.ReactNode; here?: boolean; last?: boolean; children: React.ReactNode }) {
    return (
        <li className={`relative pl-6 ${last ? '' : 'pb-5'}`}>
            {!last && <span className="absolute bottom-0 left-[5px] top-3 w-px bg-ftw-line" />}
            <span className={`absolute left-0 top-[3px] h-[11px] w-[11px] rounded-full border-2 ${here ? 'border-ftw-accent bg-ftw-accent' : 'border-ftw-faint bg-ftw-surface'}`} />
            <p className="flex flex-wrap items-baseline gap-x-2 text-[11px] leading-tight">
                <span className={`font-semibold uppercase tracking-[0.12em] ${here ? 'text-ftw-accent' : 'text-ftw-text'}`}>{tag}</span>
                <span className="text-ftw-muted">{name}</span>
            </p>
            {does && <p className="mt-0.5 text-xs text-ftw-faint">{does}</p>}
            <div className="mt-2">{children}</div>
        </li>
    );
}

function Missing({ children }: { children: React.ReactNode }) {
    return <p className="flex gap-2 text-[13px] leading-snug text-ftw-muted"><CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-ftw-faint" /><span>{children}</span></p>;
}

/** The city rung: the body, whether anyone was elected to it, what it does, and who runs the rest. */
function CityTier({ city, sources, last, among }: { city: LocalBody; sources: SourceCitation[]; last?: boolean; among?: Seat[] }) {
    // Of the assembly seats in view, how many have part of the city in them.
    const n = among?.filter(x => city.seats.ids.includes(x.id)).length ?? 0;
    const partly = among && n < among.length ? `${n} of the ${among.length} assembly seats here ${n === 1 ? 'is' : 'are'} in ${city.name}. The rest of this area has other local bodies, not on record yet.` : undefined;
    return (
        <Tier tag="City" name={city.name} does={<>{city.does.text}<Cite ids={city.does.sourceIds} sources={sources} /></>} last={last}>
            <div className="flex items-start gap-3 p-1.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ftw-raised"><Building2 className="h-4 w-4 text-ftw-muted" /></span>
                <div className="min-w-0">
                    <p className="text-sm font-semibold leading-snug">{city.body}</p>
                    <p className="mt-1">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${city.council.status === 'none' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'}`}>
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />{city.council.label}
                        </span>
                    </p>
                    <p className="mt-1 text-xs text-ftw-muted">
                        {city.council.runBy}{city.council.lastElection ? `${city.council.runBy ? ' · ' : ''}last election ${fmtDate(city.council.lastElection)}` : ''}
                    </p>
                    {partly && <p className="mt-1.5 text-xs leading-snug text-ftw-text">{partly}</p>}
                </div>
            </div>
            <More label="Elections, wards and who runs what">
                <dl className="space-y-2.5 text-[13px] leading-snug">
                    {city.facts.map(x => (
                        <div key={x.label}>
                            <dt className="text-xs font-semibold text-ftw-muted">{x.label}</dt>
                            <dd>{x.text}<Cite ids={x.sourceIds} sources={sources} /></dd>
                        </div>
                    ))}
                    <div>
                        <dt className="text-xs font-semibold text-ftw-muted">Run by other bodies, not the corporation</dt>
                        <dd>
                            <ul className="mt-1 space-y-1">
                                {city.services.map(x => (
                                    <li key={x.service} className="flex justify-between gap-3">
                                        <span className="text-ftw-muted">{x.service}</span>
                                        <span className="text-right font-medium" title={x.bodyName}>{x.body}<Cite ids={[x.sourceId]} sources={sources} /></span>
                                    </li>
                                ))}
                            </ul>
                        </dd>
                    </div>
                </dl>
                {city.seats.note && <p className="mt-2.5 text-[11px] leading-snug text-ftw-faint">{city.seats.note}<Cite ids={[city.seats.sourceId]} sources={sources} /></p>}
            </More>
        </Tier>
    );
}

const vacancy = (v?: Seat['vacatedBy']) => {
    if (!v) return '';
    const how = v.reason === 'died' ? 'died' : v.reason === 'resigned' ? 'resigned' : v.reason === 'disqualified' ? 'was disqualified' : `left (${v.reason})`;
    return `: ${v.name} ${how}${v.date ? ` on ${fmtDate(v.date)}` : ''}`;
};

export function SeatView({ seat, house, stateName, districts, parent, parentHouse, inside, insideHouse, cities, mplads, election, country, onPlace, onSeat }: {
    seat: Seat;
    house: HouseInfo;
    stateName: string;
    /** The 2011 districts the seat covers, by name. */
    districts: { code: string; name: string }[];
    /** For an assembly seat: the Lok Sabha seat it lies in. */
    parent?: Seat;
    parentHouse?: HouseInfo;
    /** For a Lok Sabha seat: the assembly seats inside it, if we have the state's assembly. */
    inside?: Seat[];
    insideHouse?: HouseInfo;
    /** Cities on record with part of this seat in them. */
    cities: LocalBody[];
    /** Lok Sabha seats: the seat's MPLADS figures, if the portal has them. */
    mplads?: MpladsInfo;
    /** The member's election record, if they are matched to a person in the results archive. */
    election?: ElectionInfo;
    country: string;
    onPlace: (code: string) => void;
    onSeat: (id: string) => void;
}) {
    const m = seat.member;
    const assembly = isAssembly(house);
    const terms = m?.lokSabhaTerms ?? [];
    const sources = [house.source, ...(parent && parentHouse ? [parentHouse.source] : []), ...(inside?.length && insideHouse ? [insideHouse.source] : []), ...(mplads ? [mplads.source] : []), ...(election ? [election.source] : []), ...cities.flatMap(c => c.sources)];
    const cite = <Cite ids={[house.source.id]} sources={sources} />;
    // The holder of this seat, on its own rung of the ladder.
    const holder = m ? (
        <div className="flex items-start gap-3 p-1.5">
            <Avatar name={m.name} party={partyOf(seat)} large />
            <div className="min-w-0">
                <p className="text-lg font-semibold leading-tight">{m.name}{cite}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ftw-muted">
                    <PartyChip short={m.partyShort} title={m.party} /><span>{m.party}{m.note ? ` · ${m.note}` : ''}</span>
                </p>
                <p className="mt-1 text-xs text-ftw-muted">
                    {assembly ? 'MLA' : 'MP'} for {seat.name}
                    {terms.length > 0 && <> · {terms.length === 1 ? 'first term' : `${terms.length} terms (${terms.map(ordinal).join(', ')} Lok Sabha)`}</>}
                    {m.since && <> · won a by-election, member since {fmtDate(m.since)}</>}
                </p>
            </div>
        </div>
    ) : <p className="p-1.5 text-[13px]">Vacant{vacancy(seat.vacatedBy)}, according to the member list.{cite}</p>;

    return (
        <article>
            <Header eyebrow={assembly ? `Assembly seat${seat.number ? ` ${seat.number}` : ''} · ${stateName}` : `Lok Sabha seat · ${stateName}`} title={seat.name}
                sub={m ? `${assembly ? 'MLA' : 'MP'}: ${m.name} · ${m.partyShort ?? m.party}` : 'No sitting member'} />

            {mplads && <MpladsSection info={mplads} sources={sources} country={country} seatName={seat.name} stateName={stateName} />}
            {election && <ElectionSection info={election} sources={sources} />}

            <Section title="Who governs here">
                <ol>
                    <Tier tag="Union" name="Lok Sabha" does="Union law and budget" here={!assembly}>
                        {!assembly ? holder
                            : parent ? <ul><SeatRow seat={parent} onSeat={onSeat} role="MP" /></ul>
                            : <Missing>The Lok Sabha seat this assembly seat lies in is not on record yet.</Missing>}
                    </Tier>
                    <Tier tag="State" name={assembly ? house.house : insideHouse?.house ?? 'State assembly'} does="State law and budget" here={assembly} last={!cities.length}>
                        {assembly ? holder
                            : inside?.length ? (
                                <>
                                    <p className="mb-1.5 text-sm font-semibold">{inside.length} assembly seats inside</p>
                                    <PartySplit seats={inside} />
                                    <More label={`All ${inside.length} MLAs`}><ul className="space-y-0.5">{inside.map(x => <SeatRow key={x.id} seat={x} onSeat={onSeat} role="MLA" />)}</ul></More>
                                </>
                            ) : <Missing>The assembly seats (and MLAs) inside {seat.name} are not on record yet.</Missing>}
                    </Tier>
                    {cities.map((c, i) => <CityTier key={c.id} city={c} sources={sources} last={i === cities.length - 1} among={assembly ? undefined : inside} />)}
                </ol>
            </Section>

            {districts.length > 0 && (
                <Section title="Districts it covers (2011)">
                    <div className="flex flex-wrap gap-1.5">
                        {districts.map(d => (
                            <button key={d.code} onClick={() => onPlace(d.code)} className="rounded-full border border-ftw-line px-2.5 py-1 text-xs font-medium hover:bg-ftw-raised">{d.name}</button>
                        ))}
                    </div>
                </Section>
            )}
            {!seat.drawn && (
                <Section title="Boundary">
                    <p className="text-[13px] text-ftw-muted">Not drawn: this seat was redrawn by the delimitation after 2019, and the map does not have the new boundaries yet.</p>
                </Section>
            )}

            <Unknowns country={country} items={[
                'Declared assets, liabilities, education and criminal cases, from the election affidavit.',
                !election && m && 'This member\'s election history: they are not matched to a person in the results archive yet.',
                ...(assembly ? [
                    `Local area development funds: the works this MLA recommended in ${seat.name}, what they cost and whether they were finished.`,
                    'Attendance and questions asked in the Assembly.',
                ] : [
                    !mplads && `MPLADS: the works this MP recommended in ${seat.name}, what they cost and whether they were finished.`,
                    mplads && !mplads.worksUrl && `The individual MPLADS works in ${seat.name}, and whether each one exists on the ground.`,
                    'Attendance, questions asked and debates taken part in.',
                ]),
                ...cities.flatMap(c => c.openQuestions),
            ]} />
            <Sources fold sources={sources} lastVerified={house.asOf}
                note={assembly ? 'The member list marks by-election winners and members who left.' : 'A by-election held since the member list was read may not be reflected yet.'} />
        </article>
    );
}

// ---------- this spot ----------

/** One level of government for a spot: who holds it, and the one thing on record to know about them. */
function SpotCard({ tier, avatar, name, chip, onClick, children }: { tier: string; avatar: React.ReactNode; name: React.ReactNode; chip?: React.ReactNode; onClick?: () => void; children: React.ReactNode }) {
    const body = (
        <>
            {avatar}
            <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-ftw-muted">{tier}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5"><span className="text-[15px] font-semibold leading-snug">{name}</span>{chip}</span>
                <span className="mt-1 block text-[13px] leading-snug text-ftw-muted">{children}</span>
            </span>
            {onClick && <ChevronRight className="mt-2.5 h-4 w-4 shrink-0 text-ftw-faint group-hover:text-ftw-text" />}
        </>
    );
    const cls = 'flex w-full items-start gap-3 rounded-xl border border-ftw-line p-3 text-left';
    return onClick ? <button onClick={onClick} className={`group ${cls} hover:bg-ftw-raised`}>{body}</button> : <div className={cls}>{body}</div>;
}

/** The one line about an MP's local fund: what the MP has proposed, against all seats. */
function FundLine({ info }: { info: MpladsInfo }) {
    const m = info.seat;
    return <><b className="font-semibold text-ftw-text">{pct(m.recommended.amount, m.allocated)}%</b> of this seat&apos;s local fund proposed as works so far. All seats together: {info.nationalProposedShare}%.</>;
}

export function SpotView({ stateName, districtName, mp, mpHouse, fund, mla, mlaHouse, mlaElection, loading, cities, country, onSeat, onDistrict, onState }: {
    stateName: string;
    districtName?: string;
    /** The Lok Sabha seat the spot lies in, if its boundary is drawn. */
    mp?: Seat;
    mpHouse?: HouseInfo;
    fund?: MpladsInfo;
    /** The assembly seat the spot lies in, if we have this state's assembly. */
    mla?: Seat;
    mlaHouse?: HouseInfo;
    mlaElection?: ElectionInfo;
    /** Seat shapes are still loading. */
    loading?: boolean;
    /** Cities with part of this spot's assembly seat in them. */
    cities: LocalBody[];
    country: string;
    onSeat: (id: string) => void;
    onDistrict?: () => void;
    onState: () => void;
}) {
    const sources = [...(mp && mpHouse ? [mpHouse.source] : []), ...(fund ? [fund.source] : []), ...(mla && mlaHouse ? [mlaHouse.source] : []), ...(mlaElection ? [mlaElection.source] : []), ...cities.flatMap(c => c.sources)];
    const blank = <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ftw-raised"><CircleHelp className="h-4 w-4 text-ftw-faint" /></span>;
    return (
        <article>
            <Header eyebrow="This spot" title={mla?.name ?? mp?.name ?? districtName ?? stateName}
                sub={[districtName && `${districtName} district`, stateName].filter(Boolean).join(' · ')} />
            <div className="space-y-2 px-5 pb-5">
                {mp ? (
                    <SpotCard tier="MP · Lok Sabha" avatar={<Avatar name={mp.member?.name} party={partyOf(mp)} />} name={mp.member?.name ?? 'Vacant'}
                        chip={<PartyChip short={partyOf(mp)} title={mp.member?.party} />} onClick={() => onSeat(mp.id)}>
                        {fund ? <FundLine info={fund} /> : <>For {mp.name}. Nothing measurable on record yet.</>}
                    </SpotCard>
                ) : (
                    <SpotCard tier="MP · Lok Sabha" avatar={blank} name={loading ? 'Finding the seat…' : 'Not on the map yet'}>
                        {loading ? 'Loading Lok Sabha seats.' : 'The Lok Sabha seats here were redrawn after the map we use, so we cannot say which seat this spot is in.'}
                    </SpotCard>
                )}
                {mla ? (
                    <SpotCard tier={`MLA · ${mlaHouse?.house ?? 'State assembly'}`} avatar={<Avatar name={mla.member?.name} party={partyOf(mla)} />} name={mla.member?.name ?? 'Vacant'}
                        chip={<PartyChip short={partyOf(mla)} title={mla.member?.party} />} onClick={() => onSeat(mla.id)}>
                        {mlaElection?.summary.last ? <WinLine e={mlaElection.summary} /> : <>For {mla.name}. Nothing measurable on record yet.</>}
                    </SpotCard>
                ) : (
                    <SpotCard tier="MLA · State assembly" avatar={blank} name={loading ? 'Finding the seat…' : 'Not on record yet'}>
                        {loading ? 'Loading assembly seats.' : `The assembly seats of ${stateName} are not on record here yet.`}
                    </SpotCard>
                )}
                {cities.map(c => (
                    <SpotCard key={c.id} tier="City" avatar={<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ftw-raised"><Building2 className="h-4 w-4 text-ftw-muted" /></span>}
                        name={c.name} onClick={mla ? () => onSeat(mla.id) : undefined}>
                        This seat includes part of {c.name}. <span className="font-semibold text-amber-700 dark:text-amber-300">{c.council.label}</span>
                        {c.council.lastElection && <>; last election {fmtDate(c.council.lastElection)}</>}.
                    </SpotCard>
                ))}
                {!cities.length && !loading && (
                    <SpotCard tier="Local body" avatar={blank} name="Not on record yet">The city, town or panchayat that governs this spot is not on record here yet.</SpotCard>
                )}
            </div>

            <Section title="The wider area">
                <div className="flex flex-wrap gap-1.5">
                    {onDistrict && districtName && <button onClick={onDistrict} className="rounded-full border border-ftw-line px-2.5 py-1 text-xs font-medium hover:bg-ftw-raised">{districtName} district</button>}
                    <button onClick={onState} className="rounded-full border border-ftw-line px-2.5 py-1 text-xs font-medium hover:bg-ftw-raised">{stateName}</button>
                </div>
            </Section>

            <Unknowns country={country} items={[
                'Declared assets and criminal cases of the MP and the MLA, from their election affidavits.',
                mla && 'What the MLA has done with the local area fund, and attendance in the Assembly.',
                'Attendance and questions asked by the MP in Parliament.',
                ...cities.flatMap(c => c.openQuestions),
            ]} />
            {sources.length > 0 && <Sources fold sources={sources} lastVerified={[mpHouse?.asOf, mlaHouse?.asOf].filter(Boolean).sort().pop()} />}
        </article>
    );
}

// ---------- elections ----------

export interface ElectionInfo {
    summary: Omit<ElectionSummary, 'seat' | 'sourceId'>;
    source: SourceCitation;
    /** Every contest of the member (public/data/elections/...). */
    url: string;
}

const votes = (n?: number) => (n == null ? '' : n.toLocaleString('en-IN'));

/** One line: the win that made them the sitting member, and how long they have been standing. */
function WinLine({ e }: { e: ElectionInfo['summary'] }) {
    const w = e.last!;
    return (
        <>
            Won in {w.year} by <b className="font-semibold text-ftw-text">{votes(w.margin)} votes</b>{w.marginPct != null ? ` (${w.marginPct}% of votes cast)` : ''}.
            {' '}On record: {e.wins} {e.wins === 1 ? 'win' : 'wins'} in {e.contests} {e.contests === 1 ? 'contest' : 'contests'}{e.contests > 1 ? `, since ${e.first}` : ''}.
        </>
    );
}

function ElectionSection({ info, sources }: { info: ElectionInfo; sources: SourceCitation[] }) {
    const e = info.summary;
    const w = e.last;
    const cite = <Cite ids={[info.source.id]} sources={sources} />;
    const [contests, setContests] = useState<ElectionContest[] | null>(null);
    useEffect(() => {
        setContests(null);
        let live = true;
        fetch(info.url).then(r => (r.ok ? r.json() : null)).then(j => { if (live && j) setContests(j.contests); }).catch(() => {});
        return () => { live = false; };
    }, [info.url]);

    return (
        <Section title={w ? `How they won, ${w.year}` : 'Elections before 2024'}>
            {w ? (
                <>
                    <div className="flex items-end gap-3">
                        <span className="text-4xl font-semibold tabular-nums leading-none tracking-tight">{w.marginPct ?? '–'}%</span>
                        <span className="pb-0.5 text-[13px] leading-snug text-ftw-muted">
                            lead over the runner-up{w.runnerUp ? <>,<br />{w.runnerUp.name} ({w.runnerUp.party})</> : null}{cite}
                        </span>
                    </div>
                    <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                        {([[votes(w.margin), 'votes ahead'], [w.voteShare != null ? `${w.voteShare}%` : '–', 'of votes cast'], [w.turnout != null ? `${w.turnout}%` : '–', 'turnout']] as const).map(([v, label]) => (
                            <div key={label} className="rounded-lg bg-ftw-raised p-2">
                                <dd className="text-lg font-semibold tabular-nums leading-tight">{v}</dd>
                                <dt className="text-[11px] text-ftw-muted">{label}</dt>
                            </div>
                        ))}
                    </dl>
                </>
            ) : (
                <p className="text-[13px] leading-snug text-ftw-muted">The results archive ends in June 2023, so the 2024 election that made them MP is not in it.{cite}</p>
            )}
            <p className="mt-3 text-[13px] leading-snug">
                On record: {e.wins} {e.wins === 1 ? 'win' : 'wins'} in {e.contests} {e.contests === 1 ? 'contest' : 'contests'}{e.contests > 1 ? `, the earliest in ${e.first}` : ''}. Earlier contests under another name or in another seat may be missing.
            </p>
            <More label="Every election they stood in">
                {!contests && <p className="text-xs text-ftw-faint">Loading…</p>}
                <ol className="space-y-1.5">
                    {(contests ?? []).map((c, i) => (
                        <li key={i} className="flex items-baseline gap-3 text-[13px] leading-snug">
                            <span className="w-10 shrink-0 tabular-nums text-ftw-muted">{c.year}</span>
                            <span className="min-w-0 flex-1">
                                <span className="font-medium">{c.seat}</span>
                                <span className="text-ftw-muted"> · {c.house === 'lok_sabha' ? 'Lok Sabha' : 'Assembly'}{c.byElection ? ' by-election' : ''} · {c.party}</span>
                                <span className="block text-xs text-ftw-muted">
                                    {votes(c.votes)} votes{c.voteShare != null ? ` (${c.voteShare}%)` : ''}{c.position === 1 && c.margin != null ? `, ahead by ${votes(c.margin)}` : ''}
                                </span>
                            </span>
                            <span className={`shrink-0 text-xs font-semibold ${c.position === 1 ? 'text-ftw-free' : 'text-ftw-muted'}`}>{c.position === 1 ? 'Won' : `Lost (${ordinal(c.position)})`}</span>
                        </li>
                    ))}
                </ol>
            </More>
            <p className="mt-3 text-[11px] leading-snug text-ftw-faint">
                From the Trivedi Centre&apos;s Lok Dhaba archive of Election Commission results, which ends in June 2023. This member is taken to be the {e.basis}.
                Which contests belong to one person is the Centre&apos;s linking, extended here to the same seat and a matching name. It can be wrong or incomplete.
            </p>
        </Section>
    );
}

// ---------- MPLADS ----------

export interface MpladsInfo {
    term: number;
    asOf: string;
    source: SourceCitation;
    seat: Omit<MpladsSeat, 'seat' | 'sourceId'>;
    /** Share of the allocation paid out, all seats together (for comparison). */
    nationalPaidShare: number;
    /** Share of the allocation proposed as works, all seats together. */
    nationalProposedShare: number;
    /** Where the seat stands in its state on the share proposed (1 is the highest). */
    rank?: { n: number; of: number };
    /** A per-work list for this seat (public/data/mplads/...), where we have one. */
    worksUrl?: string;
}

interface MpladsWork {
    id: number;
    activity: string;
    description: string;
    agency?: string;
    recommended: { date?: string; amount: number };
    sanctioned?: { date?: string; amount: number };
    stage?: string;
    completed?: { date?: string; amount: number };
    paid: number;
    /** Who was paid, as the portal lists them. */
    vendors?: { name: string; paid: number }[];
}

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
const rupees = (n: number) => fmtInr({ value: n, currency: 'INR' });

function MpladsSection({ info, sources, country, seatName, stateName }: { info: MpladsInfo; sources: SourceCitation[]; country: string; seatName: string; stateName: string }) {
    const m = info.seat;
    // The headline is the step the MP controls: what has been proposed. Sanction and payment come after, and are not the MP's.
    const proposed = pct(m.recommended.amount, m.allocated);
    const paid = pct(m.paid, m.allocated);
    const cite = <Cite ids={[info.source.id]} sources={sources} />;
    const [works, setWorks] = useState<MpladsWork[] | null>(null);
    useEffect(() => {
        setWorks(null);
        if (!info.worksUrl) return;
        let live = true;
        fetch(info.worksUrl).then(r => (r.ok ? r.json() : null)).then(j => { if (live && j) setWorks(j.works); }).catch(() => {});
        return () => { live = false; };
    }, [info.worksUrl]);
    const ask = `/${country}/info-requests?${new URLSearchParams({
        subject: `MPLADS works recommended for ${seatName} Lok Sabha constituency, ${ordinal(info.term)} Lok Sabha`,
        body: [
            `For the MPLADS funds of the ${seatName} Lok Sabha constituency (${stateName}) during the ${ordinal(info.term)} Lok Sabha, please provide:`,
            '1. The list of works recommended by the Member of Parliament, with the date and amount of each recommendation.',
            '2. For each work: whether it was sanctioned, the date and amount sanctioned, or the reason it is pending or was not sanctioned.',
            '3. For each work: the amount released and paid, and the name of the implementing agency.',
            '4. For each work: its present status, and the completion certificate where it is complete.',
        ].join('\n'),
    })}`;

    return (
        <Section title={`Local fund (MPLADS), ${ordinal(info.term)} Lok Sabha`}>
            <div className="flex items-end gap-3">
                <span className="text-4xl font-semibold tabular-nums leading-none tracking-tight">{proposed}%</span>
                <span className="pb-0.5 text-[13px] leading-snug text-ftw-muted">of the seat&apos;s {rupees(m.allocated)} fund<br />proposed as works so far{cite}</span>
            </div>
            <div className="relative mt-3 h-2 rounded-full bg-ftw-raised" role="img" aria-label={`${proposed}% proposed; all seats together ${info.nationalProposedShare}%`}>
                <div className="absolute inset-y-0 left-0 rounded-full bg-ftw-accent" style={{ width: `${Math.min(100, proposed)}%` }} />
                <div className="absolute -bottom-1 -top-1 w-0.5 rounded bg-ftw-text" style={{ left: `${Math.min(100, info.nationalProposedShare)}%` }} />
            </div>
            <p className="mt-2 text-xs leading-snug text-ftw-muted">
                The line marks all seats together ({info.nationalProposedShare}%).
                {info.rank && info.rank.of > 1 && <> In {stateName}: {ordinal(info.rank.n)} of {info.rank.of} seats, highest share first.</>}
            </p>

            <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                {([['Proposed', m.recommended], ['Sanctioned', m.sanctioned], ['Completed', m.completed]] as const).map(([label, v]) => (
                    <div key={label} className="rounded-lg bg-ftw-raised p-2">
                        <dd className="text-lg font-semibold tabular-nums leading-tight">{v.count.toLocaleString('en-IN')}</dd>
                        <dt className="text-[11px] text-ftw-muted">works {label.toLowerCase()}</dt>
                        <dd className="mt-0.5 text-[11px] tabular-nums text-ftw-faint">{rupees(v.amount)}</dd>
                    </div>
                ))}
            </dl>
            <p className="mt-3 text-[13px] leading-snug">
                Paid out so far: <b className="font-semibold">{rupees(m.paid)}</b>, {paid}% of the fund. All seats together: {info.nationalPaidShare}%.
            </p>
            <p className="mt-1.5 text-xs leading-snug text-ftw-muted">
                {m.mps.length > 1 ? `This seat has had more than one MP this term (${m.mps.join(', ')}); the figures cover all of them. ` : ''}
                The MP proposes the works. Sanction and payment are recorded by the portal for each work, and are not the MP&apos;s own steps.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
                <Link href={ask} className="inline-flex items-center gap-1.5 rounded-full bg-ftw-text px-3 py-1.5 text-xs font-semibold text-ftw-surface hover:opacity-90">
                    <FileText className="h-3.5 w-3.5" /> Ask about these works (RTI draft)
                </Link>
            </div>

            {info.worksUrl && (
                <More label={works ? `See the ${works.length} works, largest first` : 'See the works'}>
                    {!works && <p className="text-xs text-ftw-faint">Loading works…</p>}
                    <ul className="space-y-2">
                        {(works ?? []).map(w => (
                            <li key={w.id} className="rounded-lg border border-ftw-line p-2.5 text-[13px] leading-snug">
                                <p className="font-medium">{w.description || w.activity}</p>
                                <p className="mt-0.5 text-xs text-ftw-muted">{w.activity}{w.agency ? ` · ${w.agency}` : ''}</p>
                                {w.vendors && w.vendors.length > 0 && (
                                    <p className="mt-0.5 text-xs text-ftw-muted">Paid to {w.vendors.map(v => `${v.name} (${rupees(v.paid)})`).join(', ')}</p>
                                )}
                                <p className="mt-1 flex flex-wrap gap-x-3 text-xs tabular-nums">
                                    <span>{rupees(w.sanctioned?.amount ?? w.recommended.amount)} {w.sanctioned ? 'sanctioned' : 'proposed'}</span>
                                    <span className={w.paid ? '' : 'text-ftw-faint'}>{rupees(w.paid)} paid</span>
                                    <span className="text-ftw-muted">{w.completed ? `completed ${fmtDate(w.completed.date)}` : w.stage ?? ''}</span>
                                </p>
                            </li>
                        ))}
                    </ul>
                </More>
            )}
            <p className="mt-3 text-[11px] leading-snug text-ftw-faint">
                From MoSPI&apos;s e-SAKSHI portal, read {fmtDate(info.asOf)}. &quot;Paid&quot; is what the portal calls expenditure on
                completed and ongoing works: payments released to vendors. Whether each work exists on the ground is not checked here.
            </p>
        </Section>
    );
}
