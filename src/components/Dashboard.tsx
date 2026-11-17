'use client';

import { CountryConfig, Overview, Metric, InfoRequest } from '@/types';
import GlobalSearch from './GlobalSearch';
import MetricCard from './MetricCard';
import RTITrackerWidget from './RTITrackerWidget';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import Link from 'next/link';
import { Building, Users, Wallet, MapPin, TrendingUp, Route } from 'lucide-react';

interface DashboardProps {
  config: CountryConfig;
  overview: Overview;
  infoRequests?: InfoRequest[];
}

const iconMap: Record<string, React.ElementType> = {
  map: MapPin,
  building: Building,
  users: Users,
  wallet: Wallet,
  road: Route,
};

export default function Dashboard({ config, overview, infoRequests }: DashboardProps) {
  // Split metrics into primary (first 4) and secondary
  const primaryMetrics = overview.metrics.slice(0, 4);
  const secondaryMetrics = overview.metrics.slice(4, 8);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Hero Section */}
      <div className="relative overflow-x-clip">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20"></div>
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>

        <div className="relative container mx-auto px-4 py-12">
          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
              {config.name}&apos;s Data
            </h1>
            <p className="text-slate-400 text-lg">
              Government spending, infrastructure & public data at your fingertips
            </p>
          </div>

          {/* Search Bar */}
          <div className="max-w-2xl mx-auto mb-12">
            <GlobalSearch countryCode={config.code} placeholder={`Search ${config.name}...`} />
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {overview.quickLinks.map((link) => {
              const Icon = iconMap[link.icon || 'building'] || Building;
              return (
                <Link key={link.label} href={link.href}>
                  <Card className="bg-slate-800/50 border-slate-700 hover:bg-slate-700/50 hover:border-slate-600 transition-all cursor-pointer group">
                    <CardContent className="p-6 flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 group-hover:from-blue-500/30 group-hover:to-purple-500/30 transition-all">
                        <Icon className="h-6 w-6 text-blue-400" />
                      </div>
                      <span className="font-medium text-white group-hover:text-blue-400 transition-colors">
                        {link.label}
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}

        {/* Secondary Metrics */}
        {secondaryMetrics.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-400" />
              Key Statistics
            </h2>
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
            <h2 className="text-xl font-semibold text-white mb-4">Recent Highlights</h2>
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
              countryCode={config.code}
              currencySymbol={config.currencySymbol}
              displayName="RTI"
              requests={infoRequests}
            />
          </div>
        )}
      </div>
    </div>
  );
}
