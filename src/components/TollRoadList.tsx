import { CountryConfig, TollRoad } from '@/types';
import { formatMoney } from '@/services/toll-road.service';
import { estimateRecoveryProgress } from '@/services/toll-road-analytics';
import BreadcrumbNav from './BreadcrumbNav';
import { Route, ArrowRight } from 'lucide-react';

interface TollRoadListProps {
    config: CountryConfig;
    tollRoads: TollRoad[];
    countryCode: string;
}

const statusStyles: Record<string, string> = {
    cost_recovered: 'bg-red-500/15 text-red-300 border-red-500/30',
    disputed: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    recovering: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    unknown: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
};

const statusLabels: Record<string, string> = {
    cost_recovered: 'Cost recovered - tolls should end',
    disputed: 'Recovery disputed',
    recovering: 'Still recovering cost',
    unknown: 'Recovery status unknown',
};

export default function TollRoadList({ config, tollRoads, countryCode }: TollRoadListProps) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            <div className="border-b border-slate-700 bg-slate-900/50">
                <div className="container mx-auto px-4 py-4">
                    <BreadcrumbNav
                        items={[
                            { label: config.name, href: `/${countryCode}` },
                            { label: 'Infrastructure', href: `/${countryCode}/infrastructure` },
                            { label: 'Toll Roads' },
                        ]}
                    />
                </div>
            </div>

            <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/10 to-teal-600/10" />
                <div className="relative container mx-auto px-4 py-12">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-4 rounded-2xl bg-slate-700/50">
                            <Route className="h-8 w-8 text-emerald-400" />
                        </div>
                        <div>
                            <h1 className="text-3xl md:text-4xl font-bold text-white">Toll Roads</h1>
                            <p className="text-slate-400">
                                Who paid for them, who profits from them, and why the tolls never seem to end
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 pb-16">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {tollRoads.map(road => {
                        const recovery = estimateRecoveryProgress(road);
                        return (
                        <a
                            key={road.id}
                            href={`/${countryCode}/infrastructure/toll-roads/${road.slug}`}
                            className="group block rounded-xl border border-slate-700 bg-slate-800/50 p-6 hover:border-emerald-500/40 hover:bg-slate-800 transition-colors"
                        >
                            <div className="flex items-start justify-between gap-4 mb-3">
                                <h2 className="text-xl font-semibold text-white group-hover:text-emerald-300">
                                    {road.name}
                                </h2>
                                <ArrowRight className="h-5 w-5 text-slate-500 group-hover:text-emerald-400 shrink-0 mt-1" />
                            </div>

                            {road.analysis && (
                                <span className={`inline-block mb-3 rounded-full border px-3 py-1 text-xs font-medium ${statusStyles[road.analysis.status]}`}>
                                    {statusLabels[road.analysis.status]}
                                </span>
                            )}

                            <p className="text-sm text-slate-400 line-clamp-2 mb-4">{road.analysis?.summary}</p>

                            <dl className="grid grid-cols-4 gap-2 text-sm">
                                <div>
                                    <dt className="text-xs text-slate-500">Length</dt>
                                    <dd className="text-white">{road.lengthKm ? `${road.lengthKm} km` : '—'}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-slate-500">Project cost</dt>
                                    <dd className="text-white">
                                        {road.projectCost ? formatMoney(road.projectCost.value) : '—'}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-slate-500">Model</dt>
                                    <dd className="text-white">{road.concession?.model ?? '—'}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-slate-500">Est. recovered</dt>
                                    <dd className={recovery.recoveredPct !== null && recovery.recoveredPct >= 100 ? 'text-red-300' : 'text-white'}>
                                        {recovery.recoveredPct !== null
                                            ? `~${recovery.recoveredPctLow !== recovery.recoveredPct ? `${recovery.recoveredPctLow}–` : ''}${recovery.recoveredPct}%`
                                            : '—'}
                                    </dd>
                                </div>
                            </dl>

                            <p className="mt-4 text-xs text-slate-500">
                                Operator: {road.concession?.operator ?? road.operatorCompany ?? '—'} ·{' '}
                                {road.sources.length} cited source{road.sources.length === 1 ? '' : 's'}
                            </p>
                        </a>
                        );
                    })}
                </div>

                {tollRoads.length === 0 && (
                    <div className="text-center py-12">
                        <p className="text-slate-400">No toll road data yet</p>
                    </div>
                )}
            </div>
        </div>
    );
}

