'use client';

import { CountryConfig, Entity, PaginatedResponse } from '@/types';
import BreadcrumbNav from './BreadcrumbNav';
import EntityCard from './EntityCard';
import { Input } from './ui/input';
import { useState } from 'react';
import { Search, Building } from 'lucide-react';

interface CategoryViewProps {
    config: CountryConfig;
    category: string;
    entities: PaginatedResponse<Entity>;
    countryCode: string;
}

const categoryLabels: Record<string, string> = {
    roads: 'Roads',
    highways: 'Highways',
    toll_roads: 'Toll Roads',
    rail: 'Railways',
    metro: 'Metro Systems',
    ports: 'Ports',
    airports: 'Airports',
    bridges: 'Bridges',
    power: 'Power',
};

export default function CategoryView({ config, category, entities, countryCode }: CategoryViewProps) {
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
                            { label: 'Infrastructure', href: `/${countryCode}/infrastructure` },
                            { label: categoryLabels[category] || category },
                        ]}
                    />
                </div>
            </div>

            {/* Hero */}
            <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/10 to-teal-600/10"></div>
                <div className="relative container mx-auto px-4 py-12">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-4 rounded-2xl bg-slate-700/50">
                            <Building className="h-8 w-8 text-emerald-400" />
                        </div>
                        <div>
                            <h1 className="text-3xl md:text-4xl font-bold text-white">
                                {categoryLabels[category] || category}
                            </h1>
                            <p className="text-slate-400">
                                {entities.total} projects in {config.name}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="container mx-auto px-4 py-8">
                <div className="flex justify-end mb-6">
                    <div className="relative w-full md:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            type="search"
                            placeholder="Filter projects..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-400"
                        />
                    </div>
                </div>

                {/* Grid */}
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
                        <p className="text-slate-400">No {categoryLabels[category] || category} found</p>
                    </div>
                )}
            </div>
        </div>
    );
}
