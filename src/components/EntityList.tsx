'use client';

import { CountryConfig, Entity, PaginatedResponse } from '@/types';
import BreadcrumbNav from './BreadcrumbNav';
import EntityCard from './EntityCard';
import { Input } from './ui/input';
import { useState } from 'react';
import { Search, Route, ArrowRight } from 'lucide-react';

interface EntityListProps {
    config: CountryConfig;
    entities: PaginatedResponse<Entity>;
    category: string;
    countryCode: string;
}

const categoryTitles: Record<string, string> = {
    person: 'People',
    infrastructure: 'Infrastructure',
    region: 'Regions',
};

export default function EntityList({ config, entities, category, countryCode }: EntityListProps) {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredEntities = searchQuery
        ? entities.data.filter(e =>
            e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            e.description?.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : entities.data;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            {/* Header */}
            <div className="border-b border-slate-700 bg-slate-900/50">
                <div className="container mx-auto px-4 py-4">
                    <BreadcrumbNav
                        items={[
                            { label: config.name, href: `/${countryCode}` },
                            { label: categoryTitles[category] || category },
                        ]}
                    />
                </div>
            </div>

            {/* Content */}
            <div className="container mx-auto px-4 py-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white">
                            {categoryTitles[category] || category}
                        </h1>
                        <p className="text-slate-400">
                            {entities.total} {entities.total === 1 ? 'result' : 'results'} found
                        </p>
                    </div>

                    <div className="relative w-full md:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            type="search"
                            placeholder="Filter results..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-400"
                        />
                    </div>
                </div>

                {/* Toll roads section link */}
                {category === 'infrastructure' && (
                    <a
                        href={`/${countryCode}/infrastructure/toll-roads`}
                        className="group mb-8 flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 hover:border-emerald-500/60 hover:bg-emerald-500/10 transition-colors"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-slate-700/50">
                                <Route className="h-6 w-6 text-emerald-400" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-white group-hover:text-emerald-300">
                                    Toll Roads
                                </h2>
                                <p className="text-sm text-slate-400">
                                    Funding, revenue &amp; why the tolls never end — NICE Road, DND Flyway and more
                                </p>
                            </div>
                        </div>
                        <ArrowRight className="h-5 w-5 text-slate-500 group-hover:text-emerald-400" />
                    </a>
                )}

                {/* Grid of entity cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredEntities.map((entity) => (
                        <EntityCard
                            key={entity.id}
                            entity={entity}
                            countryCode={countryCode}
                        />
                    ))}
                </div>

                {filteredEntities.length === 0 && (
                    <div className="text-center py-12">
                        <p className="text-slate-400">No results found</p>
                    </div>
                )}
            </div>
        </div>
    );
}
