import { CountryConfig, TollRoad, InfoRequest } from '@/types';
import { formatMoney, quantifiedFunding } from '@/services/toll-road.service';
import {
    buildRevenueSeries,
    estimateRecoveryProgress,
    getDataGaps,
    REVENUE_ASSUMPTIONS,
} from '@/services/toll-road-analytics';
import BreadcrumbNav from './BreadcrumbNav';
import {
    Route,
    FileText,
    Landmark,
    IndianRupee,
    AlertTriangle,
    HelpCircle,
    ExternalLink,
    Scale,
    CalendarClock,
    BrainCircuit,
    TrendingUp,
} from 'lucide-react';

interface TollRoadDetailProps {
    config: CountryConfig;
    tollRoad: TollRoad;
    countryCode: string;
    infoRequests?: InfoRequest[];
}

const fundingColors: Record<string, string> = {
    equity: 'bg-emerald-500',
    debt: 'bg-sky-500',
    government_grant: 'bg-amber-500',
    vgf: 'bg-orange-500',
    annuity: 'bg-purple-500',
    land_contribution: 'bg-rose-500',
    other: 'bg-slate-500',
};

const sourceTypeIcons: Record<string, string> = {
    gazette: '📜',
    concession_agreement: '📑',
    court_order: '⚖️',
    rti_response: '📨',
    annual_report: '📊',
    company_filing: '🏢',
    audit_report: '🔎',
    legislative_record: '🏛️',
    statistics: '📈',
    government_portal: '🏛️',
    news: '📰',
};

export default function TollRoadDetail({ config, tollRoad: road, countryCode, infoRequests = [] }: TollRoadDetailProps) {
    const funding = quantifiedFunding(road);
    const fundingTotal = funding.reduce((s, f) => s + f.amount.value, 0);
    const relatedRequests = infoRequests.filter(req =>
        req.tags?.some(t => road.name.toLowerCase().includes(t.toLowerCase()) || road.regionIds.includes(t))
    );
    const revenueSeries = buildRevenueSeries(road);
    const recovery = estimateRecoveryProgress(road);
    const dataGaps = getDataGaps(road);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            <div className="border-b border-slate-700 bg-slate-900/50">
                <div className="container mx-auto px-4 py-4">
                    <BreadcrumbNav
                        items={[
                            { label: config.name, href: `/${countryCode}` },
                            { label: 'Infrastructure', href: `/${countryCode}/infrastructure` },
                            { label: 'Toll Roads', href: `/${countryCode}/infrastructure/toll-roads` },
                            { label: road.name },
                        ]}
                    />
                </div>
            </div>

            {/* Hero */}
            <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/10 to-teal-600/10" />
                <div className="relative container mx-auto px-4 py-12">
                    <div className="flex items-center gap-3 text-emerald-400 mb-2">
                        <Route className="h-5 w-5" />
                        <span className="text-sm font-medium uppercase tracking-wide">
                            {road.concession?.modelName ?? road.concession?.model}
                        </span>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{road.name}</h1>
                    <p className="text-slate-400 max-w-3xl">{road.officialName}</p>

                    <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                        <StatCard icon={<Route className="h-4 w-4" />} label="Length" value={road.lengthKm ? `${road.lengthKm} km` : '—'} />
                        <StatCard icon={<Landmark className="h-4 w-4" />} label="Project cost" value={road.projectCost ? formatMoney(road.projectCost.value) : '—'} sub={road.projectCost?.asOf ? `as of ${road.projectCost.asOf}` : undefined} />
                        <StatCard icon={<CalendarClock className="h-4 w-4" />} label="Opened" value={road.openedDate ?? '—'} />
                        <StatCard icon={<Scale className="h-4 w-4" />} label="Recovery status" value={road.analysis?.status.replace('_', ' ') ?? 'unknown'} />
                    </dl>
                </div>
            </div>

            <div className="container mx-auto px-4 pb-16 space-y-8">
                {/* Why still tolled */}
                {road.analysis && (
                    <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6">
                        <h2 className="flex items-center gap-2 text-xl font-semibold text-amber-300 mb-3">
                            <AlertTriangle className="h-5 w-5" />
                            {road.tolling?.status === 'toll_free' ? 'Why did the tolls end?' : 'Why is this still a toll road?'}
                        </h2>
                        <p className="text-slate-300 mb-6 leading-relaxed">{road.analysis.summary}</p>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div>
                                <h3 className="text-sm font-semibold text-white uppercase tracking-wide mb-3">Reasons</h3>
                                <ul className="space-y-2">
                                    {road.analysis.reasonsStillTolled.map((reason, i) => (
                                        <li key={i} className="flex gap-2 text-sm text-slate-300">
                                            <span className="text-amber-400 mt-0.5">▸</span>
                                            <span>
                                                {reason.text}{' '}
                                                {reason.sourceIds.map(id => (
                                                    <a key={id} href={`#source-${id}`} className="text-xs text-sky-400 hover:underline mr-1">[{id}]</a>
                                                ))}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-white uppercase tracking-wide mb-3">
                                    Open questions → RTI targets
                                </h3>
                                <ul className="space-y-2">
                                    {road.analysis.openQuestions.map((q, i) => (
                                        <li key={i} className="flex gap-2 text-sm text-slate-300">
                                            <HelpCircle className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />{q}
                                        </li>
                                    ))}
                                </ul>
                                <a
                                    href={`/${countryCode}/info-requests`}
                                    className="inline-flex items-center gap-2 mt-4 rounded-lg bg-sky-600 hover:bg-sky-500 px-4 py-2 text-sm font-medium text-white transition-colors"
                                >
                                    <FileText className="h-4 w-4" />
                                    File an RTI to answer these
                                </a>
                            </div>
                        </div>
                    </section>
                )}

                {/* Estimated intelligence */}
                {(recovery.cumulativeRevenue || recovery.recoveredPct !== null) && (
                    <section className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-6">
                        <h2 className="flex items-center gap-2 text-xl font-semibold text-sky-300 mb-1">
                            <BrainCircuit className="h-5 w-5" />
                            Estimated intelligence
                        </h2>
                        <p className="text-xs text-slate-500 mb-6">
                            Derived by this platform from the cited data. These are estimates, not official figures.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            {recovery.cumulativeRevenue && (
                                <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                                    <p className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-wide">
                                        <TrendingUp className="h-4 w-4 text-sky-400" /> Est. cumulative tolls
                                    </p>
                                    <p className="text-lg font-semibold text-white mt-1">
                                        {formatMoney(recovery.cumulativeRevenue.totalLow)}
                                        {recovery.cumulativeRevenue.totalLow !== recovery.cumulativeRevenue.total &&
                                            ` – ${formatMoney(recovery.cumulativeRevenue.total)}`}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        {recovery.cumulativeRevenue.fromYear}–{recovery.cumulativeRevenue.toYear} ·{' '}
                                        {recovery.cumulativeRevenue.confidence}
                                    </p>
                                </div>
                            )}
                            {recovery.projectCost && (
                                <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                                    <p className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-wide">
                                        <Landmark className="h-4 w-4 text-sky-400" /> Stated project cost
                                    </p>
                                    <p className="text-lg font-semibold text-white mt-1">{formatMoney(recovery.projectCost)}</p>
                                    <p className="text-xs text-slate-500">{road.projectCost?.asOf ? `as of ${road.projectCost.asOf}` : ''}</p>
                                </div>
                            )}
                            {recovery.recoveredPct !== null && (
                                <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                                    <p className="text-xs text-slate-400 uppercase tracking-wide">Est. cost recovered</p>
                                    <p className={`text-lg font-semibold mt-1 ${recovery.recoveredPct >= 100 ? 'text-red-300' : 'text-white'}`}>
                                        ~{recovery.recoveredPctLow ?? recovery.recoveredPct}
                                        {recovery.recoveredPctLow !== null && recovery.recoveredPctLow !== recovery.recoveredPct && `–${recovery.recoveredPct}`}%
                                    </p>
                                    <div className="h-2 rounded-full bg-slate-700 overflow-hidden mt-2">
                                        <div
                                            className={`h-full ${recovery.recoveredPct >= 100 ? 'bg-red-400' : 'bg-sky-400'} opacity-60`}
                                            style={{ width: `${Math.min(100, recovery.recoveredPctLow ?? 0)}%` }}
                                        >
                                            <div
                                                className={`h-full ${recovery.recoveredPct >= 100 ? 'bg-red-400' : 'bg-sky-400'}`}
                                                style={{ width: `${Math.min(100, (recovery.recoveredPct / Math.max(1, recovery.recoveredPctLow ?? 1)) * 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <p className="text-sm text-slate-300 mb-4">{recovery.verdict}</p>

                        <details className="text-sm text-slate-400">
                            <summary className="cursor-pointer text-sky-300 hover:text-sky-200">Assumptions behind these estimates</summary>
                            <ul className="mt-2 space-y-1 list-disc list-inside">
                                {REVENUE_ASSUMPTIONS.map((a, i) => (
                                    <li key={i}>{a}</li>
                                ))}
                            </ul>
                        </details>
                    </section>
                )}

                {/* Funding structure */}
                {fundingTotal > 0 && (
                    <section className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
                        <h2 className="flex items-center gap-2 text-xl font-semibold text-white mb-1">
                            <IndianRupee className="h-5 w-5 text-emerald-400" />
                            Where the money came from
                        </h2>
                        <p className="text-sm text-slate-400 mb-6">Quantified funding components · total {formatMoney(fundingTotal)}</p>

                        {/* Stacked bar */}
                        <div className="flex h-4 rounded-full overflow-hidden mb-6">
                            {funding.map((f, i) => (
                                <div
                                    key={i}
                                    className={fundingColors[f.source] ?? 'bg-slate-500'}
                                    style={{ width: `${(f.amount.value / fundingTotal) * 100}%` }}
                                    title={`${f.label}: ${formatMoney(f.amount.value)}`}
                                />
                            ))}
                        </div>

                        <div className="space-y-3">
                            {(road.funding ?? []).map((f, i) => (
                                <div key={i} className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 py-2 border-b border-slate-700/50 last:border-0">
                                    <span className={`h-3 w-3 rounded-full shrink-0 ${fundingColors[f.source] ?? 'bg-slate-500'}`} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-white">{f.label}</p>
                                        {f.amount.note && <p className="text-xs text-slate-500">{f.amount.note}</p>}
                                    </div>
                                    <span className="text-sm font-medium text-emerald-300 whitespace-nowrap">
                                        {f.amount.value > 0 ? formatMoney(f.amount.value) : 'not quantified'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Revenue + rates side by side */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {revenueSeries.some(y => y.revenue !== null) && (
                        <section className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
                            <h2 className="text-xl font-semibold text-white mb-1">Revenue & traffic</h2>
                            <p className="text-xs text-slate-500 mb-6">
                                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 mr-1" />reported
                                <span className="inline-block w-2 h-2 rounded-full bg-slate-500 ml-3 mr-1" />estimated by us
                            </p>
                            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                                {revenueSeries.map(y => {
                                    const maxRevenue = Math.max(...revenueSeries.map(x => x.revenue ?? 0));
                                    return (
                                        <div key={y.year} title={y.note}>
                                            <div className="flex justify-between text-sm mb-0.5">
                                                <span className={y.confidence === 'reported' ? 'text-white' : 'text-slate-400'}>
                                                    {y.year}
                                                    {y.confidence === 'estimated' && (
                                                        <span className="ml-2 text-[10px] uppercase tracking-wide text-slate-500">est.</span>
                                                    )}
                                                </span>
                                                <span className={y.confidence === 'reported' ? 'text-emerald-300' : 'text-slate-400'}>
                                                    {y.revenue !== null ? formatMoney(y.revenue) : 'unknown'}
                                                    {y.trafficVehiclesPerDay ? ` · ${y.trafficVehiclesPerDay.toLocaleString('en-IN')}/day` : ''}
                                                </span>
                                            </div>
                                            {y.revenue !== null && maxRevenue > 0 && (
                                                <div className={`h-2 rounded-full overflow-hidden ${y.confidence === 'estimated' ? 'opacity-40' : ''}`}>
                                                    <div
                                                        className={
                                                            y.confidence === 'reported'
                                                                ? 'h-full bg-gradient-to-r from-emerald-500 to-teal-400'
                                                                : 'h-full bg-slate-500'
                                                        }
                                                        style={{ width: `${(y.revenue / maxRevenue) * 100}%` }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    {road.currentRates && road.currentRates.length > 0 && (
                        <section className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
                            <h2 className="text-xl font-semibold text-white mb-6">Current toll rates</h2>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-xs text-slate-500 uppercase tracking-wide">
                                        <th className="pb-2">Vehicle</th>
                                        <th className="pb-2 text-right">Rate</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {road.currentRates.map((rate, i) => (
                                        <tr key={i} className="border-t border-slate-700/50">
                                            <td className="py-2 text-white">
                                                {rate.vehicleClass}
                                                {rate.trip === 'monthly_pass' && <span className="ml-2 text-xs text-sky-300">monthly</span>}
                                            </td>
                                            <td className="py-2 text-right text-emerald-300">
                                                {rate.amount.value > 0 ? formatMoney(rate.amount.value) : 'Free'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {road.plazas && road.plazas.length > 0 && (
                                <p className="text-xs text-slate-500 mt-4">
                                    Plazas: {road.plazas.map(p => p.name).join(' · ')}
                                </p>
                            )}
                        </section>
                    )}
                </div>

                {/* Timeline */}
                {road.timeline && road.timeline.length > 0 && (
                    <section className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
                        <h2 className="text-xl font-semibold text-white mb-6">History</h2>
                        <ol className="relative border-l border-slate-700 ml-3 space-y-6">
                            {road.timeline.map((event, i) => (
                                <li key={i} className="ml-6">
                                    <span
                                        className={`absolute -left-[7px] mt-1.5 h-3.5 w-3.5 rounded-full border-2 border-slate-800 ${
                                            event.significance === 'negative'
                                                ? 'bg-red-500'
                                                : event.significance === 'positive'
                                                  ? 'bg-emerald-500'
                                                  : 'bg-slate-500'
                                        }`}
                                    />
                                    <p className="text-xs text-slate-500">{event.date}</p>
                                    <p className="text-sm font-medium text-white">{event.title}</p>
                                    {event.description && <p className="text-sm text-slate-400 mt-1">{event.description}</p>}
                                </li>
                            ))}
                        </ol>
                    </section>
                )}

                {/* Related RTI requests */}
                {relatedRequests.length > 0 && (
                    <section className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
                        <h2 className="text-xl font-semibold text-white mb-4">Related information requests</h2>
                        <ul className="space-y-2">
                            {relatedRequests.map(req => (
                                <li key={req.id} className="flex items-center justify-between gap-4 text-sm">
                                    <span className="text-slate-300">{req.title}</span>
                                    <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-300 whitespace-nowrap">
                                        {req.status}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {/* Data gaps -> RTI quick filing */}
                {dataGaps.length > 0 && (
                    <section className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
                        <h2 className="flex items-center gap-2 text-xl font-semibold text-white mb-1">
                            <HelpCircle className="h-5 w-5 text-amber-400" />
                            Missing data — file an RTI to close the gap
                        </h2>
                        <p className="text-xs text-slate-500 mb-6">
                            Each estimate above can be replaced with an official figure. One RTI costs ₹10.
                        </p>
                        <div className="space-y-4">
                            {dataGaps.map(gap => (
                                <div key={gap.id} className="rounded-lg border border-slate-700 bg-slate-900/40 p-4">
                                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-white">{gap.label}</p>
                                            <p className="text-xs text-slate-500 mt-0.5">{gap.whyItMatters}</p>
                                            {gap.departmentHint && (
                                                <p className="text-xs text-slate-600 mt-1">Suggested authority: {gap.departmentHint}</p>
                                            )}
                                        </div>
                                        <a
                                            href={`/${countryCode}/info-requests?subject=${encodeURIComponent(gap.rtiSubject)}&body=${encodeURIComponent(gap.rtiBody)}${gap.departmentHint ? `&dept=${encodeURIComponent(gap.departmentHint)}` : ''}`}
                                            className="inline-flex items-center gap-2 shrink-0 rounded-lg bg-sky-600 hover:bg-sky-500 px-4 py-2 text-sm font-medium text-white transition-colors"
                                        >
                                            <FileText className="h-4 w-4" />
                                            File this RTI
                                        </a>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Sources */}
                <section className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
                    <h2 className="text-xl font-semibold text-white mb-4">Sources</h2>
                    <p className="text-xs text-slate-500 mb-4">
                        Every claim on this page traces to one of these documents. Figures marked approximate are
                        estimates pending official verification.
                    </p>
                    <ul className="space-y-3">
                        {road.sources.map(source => (
                            <li key={source.id} id={`source-${source.id}`} className="flex gap-3 text-sm scroll-mt-24">
                                <span className="shrink-0">{sourceTypeIcons[source.type] ?? '📄'}</span>
                                <div>
                                    {source.url ? (
                                        <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-sky-300 hover:text-sky-200 inline-flex items-center gap-1">
                                            {source.title}<ExternalLink className="h-3 w-3" />
                                        </a>
                                    ) : (
                                        <span className="text-slate-200">{source.title}</span>
                                    )}
                                    <p className="text-xs text-slate-500">
                                        {source.publisher}
                                        {source.date ? ` · ${source.date}` : ''}
                                        {source.note ? ` · ${source.note}` : ''}
                                    </p>
                                </div>
                            </li>
                        ))}
                    </ul>
                    {road.lastVerified && (
                        <p className="mt-4 text-xs text-slate-600">Last verified: {road.lastVerified}</p>
                    )}
                </section>
            </div>
        </div>
    );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
    return (
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
            <dt className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-wide">
                <span className="text-emerald-400">{icon}</span>
                {label}
            </dt>
            <dd className="text-lg font-semibold text-white capitalize mt-1">
                {value}
                {sub && <span className="block text-xs font-normal text-slate-500 normal-case">{sub}</span>}
            </dd>
        </div>
    );
}

