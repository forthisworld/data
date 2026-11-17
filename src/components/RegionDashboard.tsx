'use client';

import { CountryConfig, Entity, Overview, InfoRequest } from '@/types';
import GlobalSearch from './GlobalSearch';
import MetricCard from './MetricCard';
import BreadcrumbNav from './BreadcrumbNav';
import RTITrackerWidget from './RTITrackerWidget';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import Link from 'next/link';
import { Building, Users, MapPin, ChevronRight } from 'lucide-react';

interface RegionDashboardProps {
    config: CountryConfig;
    region: Entity;
    overview: Overview;
    countryCode: string;
    infoRequests?: InfoRequest[];
}

export default function RegionDashboard({ config, region, overview, countryCode, infoRequests }: RegionDashboardProps) {
    const primaryMetrics = overview.metrics.slice(0, 4);
    const secondaryMetrics = overview.metrics.slice(4);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            {/* Header */}
            <div className="border-b border-slate-700 bg-slate-900/50">
                <div className="container mx-auto px-4 py-4">
                    <BreadcrumbNav
                        items={[
                            { label: config.name, href: `/${countryCode}` },
                            { label: region.name },
                        ]}
                    />
                </div>
            </div>

            {/* Hero Section */}
            <div className="relative overflow-x-clip">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/20 to-blue-600/20"></div>

                <div className="relative container mx-auto px-4 py-12">
                    <div className="text-center mb-8">
                        <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
                            {region.name}
                        </h1>
                        <p className="text-slate-400 text-lg">
                            {region.description || `Data and statistics for ${region.name}`}
                        </p>
                    </div>

                    {/* Search Bar */}
                    <div className="max-w-2xl mx-auto mb-12">
                        <GlobalSearch
                            countryCode={countryCode}
                            placeholder={`Search in ${region.name}...`}
                            regionSlug={region.slug}
                        />
                    </div>

                    {/* Primary Metrics */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        {primaryMetrics.map((metric) => (
                            <MetricCard key={metric.key} metric={metric} config={config} variant="hero" />
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="container mx-auto px-4 py-8">
                {/* Quick Links */}
                {overview.quickLinks && overview.quickLinks.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                        {overview.quickLinks.map((link) => (
                            <Link key={link.label} href={link.href}>
                                <Card className="bg-slate-800/50 border-slate-700 hover:bg-slate-700/50 hover:border-slate-600 transition-all cursor-pointer group">
                                    <CardContent className="p-6 flex items-center justify-between">
                                        <span className="font-medium text-white group-hover:text-blue-400 transition-colors">
                                            {link.label}
                                        </span>
                                        <ChevronRight className="h-5 w-5 text-slate-500 group-hover:text-blue-400 transition-colors" />
                                    </CardContent>
                                </Card>
                            </Link>
                        ))}
                    </div>
                )}

                {/* Secondary Metrics */}
                {secondaryMetrics.length > 0 && (
                    <div className="mb-8">
                        <h2 className="text-xl font-semibold text-white mb-4">Statistics</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {secondaryMetrics.map((metric) => (
                                <MetricCard key={metric.key} metric={metric} config={config} variant="secondary" />
                            ))}
                        </div>
                    </div>
                )}


                {/* Highlights */}
                {overview.highlights && overview.highlights.length > 0 && (
                    <div className="mb-8">
                        <h2 className="text-xl font-semibold text-white mb-4">Highlights</h2>
                        <div className="grid md:grid-cols-2 gap-4">
                            {overview.highlights.map((highlight, index) => (
                                <Card key={index} className="bg-slate-800/50 border-slate-700">
                                    <CardHeader>
                                        <CardTitle className="text-white">{highlight.title}</CardTitle>
                                        <CardDescription className="text-slate-400">
                                            {highlight.description}
                                        </CardDescription>
                                    </CardHeader>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}

                {/* RTI Tracker Widget */}
                {infoRequests && infoRequests.length > 0 && (
                    <div className="mb-8">
                        <RTITrackerWidget
                            countryCode={countryCode}
                            currencySymbol={config.currencySymbol}
                            displayName="RTI"
                            requests={infoRequests}
                            filterTag={region.slug}
                            filterLabel={region.name}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
