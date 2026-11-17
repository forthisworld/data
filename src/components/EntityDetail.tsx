'use client';

import { CountryConfig, Entity } from '@/types';
import BreadcrumbNav from './BreadcrumbNav';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Person, Infrastructure } from '@/types';
import { User, Building, MapPin, Calendar, Globe, Phone, Mail, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SourceList } from './Provenance';

interface EntityDetailProps {
    config: CountryConfig;
    entity: Entity;
    countryCode: string;
}

const roleColors: Record<string, string> = {
    pm: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    cm: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    mp: 'bg-green-500/20 text-green-300 border-green-500/30',
    mla: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    minister: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    billionaire: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
};

function formatCurrency(value: number, currency: string): string {
    const formatter = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: currency,
        maximumFractionDigits: 0,
        notation: value >= 1e9 ? 'compact' : 'standard',
    });
    return formatter.format(value);
}

export default function EntityDetail({ config, entity, countryCode }: EntityDetailProps) {
    if (entity.type === 'person') {
        const person = entity as Person;
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
                {/* Header */}
                <div className="border-b border-slate-700 bg-slate-900/50">
                    <div className="container mx-auto px-4 py-4">
                        <BreadcrumbNav
                            items={[
                                { label: config.name, href: `/${countryCode}` },
                                { label: 'People', href: `/${countryCode}/person` },
                                { label: person.name },
                            ]}
                        />
                    </div>
                </div>

                {/* Profile Header */}
                <div className="relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20"></div>
                    <div className="relative container mx-auto px-4 py-12">
                        <div className="flex flex-col md:flex-row gap-8 items-start">
                            {/* Avatar placeholder */}
                            <div className="w-32 h-32 rounded-2xl bg-slate-700/50 flex items-center justify-center">
                                <User className="h-16 w-16 text-slate-400" />
                            </div>

                            <div className="flex-1">
                                <div className="flex flex-wrap items-center gap-3 mb-2">
                                    <h1 className="text-3xl md:text-4xl font-bold text-white">
                                        {person.name}
                                    </h1>
                                    <Badge className={cn('uppercase', roleColors[person.role] || 'bg-slate-500/20 text-slate-300')}>
                                        {person.role}
                                    </Badge>
                                </div>

                                {person.party && (
                                    <p className="text-xl text-blue-400 mb-2">{person.party}</p>
                                )}

                                {person.constituency && (
                                    <p className="text-slate-400 flex items-center gap-2">
                                        <MapPin className="h-4 w-4" />
                                        {person.constituency}
                                    </p>
                                )}

                                {person.tenure && (
                                    <p className="text-slate-400 flex items-center gap-2 mt-2">
                                        <Calendar className="h-4 w-4" />
                                        In office since {person.tenure.start}
                                        {person.tenure.end ? `, until ${person.tenure.end}` : ''}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="container mx-auto px-4 py-8">
                    <div className="grid md:grid-cols-3 gap-8">
                        {/* Main content */}
                        <div className="md:col-span-2 space-y-6">
                            {person.description && (
                                <Card className="bg-slate-800/50 border-slate-700">
                                    <CardHeader>
                                        <CardTitle className="text-white">About</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-slate-300">{person.description}</p>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Additional roles */}
                            {person.roles && person.roles.length > 1 && (
                                <Card className="bg-slate-800/50 border-slate-700">
                                    <CardHeader>
                                        <CardTitle className="text-white">Roles</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex flex-wrap gap-2">
                                            {person.roles.map((role) => (
                                                <Badge key={role} className={cn('uppercase', roleColors[role] || 'bg-slate-500/20 text-slate-300')}>
                                                    {role}
                                                </Badge>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Regions */}
                            {person.regionIds && person.regionIds.length > 0 && (
                                <Card className="bg-slate-800/50 border-slate-700">
                                    <CardHeader>
                                        <CardTitle className="text-white">Associated Regions</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex flex-wrap gap-2">
                                            {person.regionIds.map((regionId) => (
                                                <Badge key={regionId} variant="outline" className="capitalize border-slate-600">
                                                    {regionId.replace(/-/g, ' ')}
                                                </Badge>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>

                        {/* Sidebar */}
                        <div className="space-y-6">
                            {/* Contact */}
                            {person.contact && (
                                <Card className="bg-slate-800/50 border-slate-700">
                                    <CardHeader>
                                        <CardTitle className="text-white text-lg">Contact</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        {person.contact.email && (
                                            <a href={`mailto:${person.contact.email}`} className="flex items-center gap-2 text-slate-400 hover:text-blue-400 transition-colors">
                                                <Mail className="h-4 w-4" />
                                                {person.contact.email}
                                            </a>
                                        )}
                                        {person.contact.phone && (
                                            <p className="flex items-center gap-2 text-slate-400">
                                                <Phone className="h-4 w-4" />
                                                {person.contact.phone}
                                            </p>
                                        )}
                                        {person.contact.website && (
                                            <a href={person.contact.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-slate-400 hover:text-blue-400 transition-colors">
                                                <Globe className="h-4 w-4" />
                                                Website
                                                <ExternalLink className="h-3 w-3" />
                                            </a>
                                        )}
                                    </CardContent>
                                </Card>
                            )}

                            <Card className="bg-slate-800/50 border-slate-700">
                                <CardHeader>
                                    <CardTitle className="text-white text-lg">Sources</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <SourceList sources={person.sources} lastVerified={person.lastVerified} />
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Infrastructure detail
    if (entity.type === 'infrastructure') {
        const infra = entity as Infrastructure;
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
                {/* Header */}
                <div className="border-b border-slate-700 bg-slate-900/50">
                    <div className="container mx-auto px-4 py-4">
                        <BreadcrumbNav
                            items={[
                                { label: config.name, href: `/${countryCode}` },
                                { label: 'Infrastructure', href: `/${countryCode}/infrastructure` },
                                { label: infra.category, href: `/${countryCode}/infrastructure/${infra.category}` },
                                { label: infra.name },
                            ]}
                        />
                    </div>
                </div>

                {/* Hero */}
                <div className="relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/20 to-blue-600/20"></div>
                    <div className="relative container mx-auto px-4 py-12">
                        <div className="flex items-start gap-6">
                            <div className="p-4 rounded-2xl bg-slate-700/50">
                                <Building className="h-12 w-12 text-slate-300" />
                            </div>
                            <div>
                                <div className="flex flex-wrap items-center gap-3 mb-2">
                                    <h1 className="text-3xl md:text-4xl font-bold text-white">
                                        {infra.name}
                                    </h1>
                                    <Badge className="uppercase bg-slate-500/20 text-slate-300">
                                        {infra.category}
                                    </Badge>
                                    {infra.status && (
                                        <Badge variant="outline" className={cn(
                                            infra.status === 'operational' && 'border-green-500/30 text-green-400',
                                            infra.status === 'under_construction' && 'border-yellow-500/30 text-yellow-400',
                                            infra.status === 'planned' && 'border-blue-500/30 text-blue-400',
                                        )}>
                                            {infra.status.replace('_', ' ')}
                                        </Badge>
                                    )}
                                </div>
                                {infra.description && (
                                    <p className="text-slate-400 max-w-2xl">{infra.description}</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="container mx-auto px-4 py-8">
                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="md:col-span-2">
                            <Card className="bg-slate-800/50 border-slate-700">
                                <CardHeader>
                                    <CardTitle className="text-white">Details</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {infra.length && (
                                        <div className="flex justify-between py-2 border-b border-slate-700">
                                            <span className="text-slate-400">Length</span>
                                            <span className="text-white font-medium">{infra.length} km</span>
                                        </div>
                                    )}
                                    {infra.cost && (
                                        <div className="flex justify-between py-2 border-b border-slate-700">
                                            <span className="text-slate-400">Cost</span>
                                            <span className="text-white font-medium">
                                                {formatCurrency(infra.cost.value, infra.cost.currency)}
                                            </span>
                                        </div>
                                    )}
                                    {infra.operator && (
                                        <div className="flex justify-between py-2 border-b border-slate-700">
                                            <span className="text-slate-400">Operator</span>
                                            <span className="text-white font-medium">{infra.operator}</span>
                                        </div>
                                    )}
                                    {infra.startDate && (
                                        <div className="flex justify-between py-2 border-b border-slate-700">
                                            <span className="text-slate-400">Start Date</span>
                                            <span className="text-white font-medium">{new Date(infra.startDate).toLocaleDateString()}</span>
                                        </div>
                                    )}
                                    {infra.completionDate && (
                                        <div className="flex justify-between py-2">
                                            <span className="text-slate-400">Completion Date</span>
                                            <span className="text-white font-medium">{new Date(infra.completionDate).toLocaleDateString()}</span>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        <div className="space-y-6">
                            <Card className="bg-slate-800/50 border-slate-700">
                                <CardHeader>
                                    <CardTitle className="text-white text-lg">Sources</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <SourceList sources={infra.sources} lastVerified={infra.lastVerified} />
                                </CardContent>
                            </Card>
                            {infra.regionIds && infra.regionIds.length > 0 && (
                                <Card className="bg-slate-800/50 border-slate-700">
                                    <CardHeader>
                                        <CardTitle className="text-white text-lg">Regions</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex flex-wrap gap-2">
                                            {infra.regionIds.map((regionId) => (
                                                <Badge key={regionId} variant="outline" className="capitalize border-slate-600">
                                                    {regionId.replace(/-/g, ' ')}
                                                </Badge>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Fallback
    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
            <p className="text-slate-400">Entity type not supported</p>
        </div>
    );
}
