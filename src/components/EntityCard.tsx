'use client';

import { Entity, Person, Infrastructure, Region } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import Link from 'next/link';
import { User, Building, MapPin, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EntityCardProps {
    entity: Entity;
    countryCode: string;
    variant?: 'default' | 'compact';
}

const typeIcons: Record<string, React.ElementType> = {
    person: User,
    infrastructure: Building,
    region: MapPin,
};

const roleColors: Record<string, string> = {
    pm: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    cm: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    mp: 'bg-green-500/20 text-green-300 border-green-500/30',
    mla: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    minister: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    billionaire: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
};

function getEntityPath(entity: Entity, countryCode: string): string {
    if (entity.type === 'person') {
        return `/${countryCode}/person/${entity.slug}`;
    }
    if (entity.type === 'infrastructure') {
        const infra = entity as Infrastructure;
        return `/${countryCode}/infrastructure/${infra.category}/${entity.slug}`;
    }
    if (entity.type === 'region') {
        return `/${countryCode}/${entity.slug}`;
    }
    return `/${countryCode}/${entity.slug}`;
}

export default function EntityCard({ entity, countryCode, variant = 'default' }: EntityCardProps) {
    const Icon = typeIcons[entity.type] || Building;
    const path = getEntityPath(entity, countryCode);

    if (entity.type === 'person') {
        const person = entity as Person;
        return (
            <Link href={path}>
                <Card className="bg-slate-800/50 border-slate-700 hover:bg-slate-700/50 hover:border-slate-600 transition-all cursor-pointer group h-full">
                    <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-slate-700/50">
                                    <Icon className="h-5 w-5 text-slate-400" />
                                </div>
                                <div>
                                    <CardTitle className="text-white group-hover:text-blue-400 transition-colors">
                                        {person.name}
                                    </CardTitle>
                                    {person.party && (
                                        <p className="text-sm text-slate-400">{person.party}</p>
                                    )}
                                </div>
                            </div>
                            <Badge className={cn('uppercase text-xs', roleColors[person.role] || 'bg-slate-500/20 text-slate-300')}>
                                {person.role}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {person.constituency && (
                            <p className="text-sm text-slate-400 mb-2">
                                <MapPin className="inline h-3 w-3 mr-1" />
                                {person.constituency}
                            </p>
                        )}
                        {person.description && (
                            <CardDescription className="text-slate-400 line-clamp-2">
                                {person.description}
                            </CardDescription>
                        )}
                    </CardContent>
                </Card>
            </Link>
        );
    }

    if (entity.type === 'infrastructure') {
        const infra = entity as Infrastructure;
        return (
            <Link href={path}>
                <Card className="bg-slate-800/50 border-slate-700 hover:bg-slate-700/50 hover:border-slate-600 transition-all cursor-pointer group h-full">
                    <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-slate-700/50">
                                    <Icon className="h-5 w-5 text-slate-400" />
                                </div>
                                <CardTitle className="text-white group-hover:text-blue-400 transition-colors">
                                    {infra.name}
                                </CardTitle>
                            </div>
                            <Badge className="bg-slate-500/20 text-slate-300 uppercase text-xs">
                                {infra.category}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {infra.status && (
                                <Badge variant="outline" className={cn(
                                    'text-xs',
                                    infra.status === 'operational' && 'border-green-500/30 text-green-400',
                                    infra.status === 'under_construction' && 'border-yellow-500/30 text-yellow-400',
                                    infra.status === 'planned' && 'border-blue-500/30 text-blue-400',
                                )}>
                                    {infra.status.replace('_', ' ')}
                                </Badge>
                            )}
                            {infra.length && (
                                <Badge variant="outline" className="text-xs border-slate-500/30 text-slate-400">
                                    {infra.length} km
                                </Badge>
                            )}
                        </div>
                        {infra.description && (
                            <CardDescription className="text-slate-400 line-clamp-2">
                                {infra.description}
                            </CardDescription>
                        )}
                    </CardContent>
                </Card>
            </Link>
        );
    }

    // Default region card
    const region = entity as Region;
    return (
        <Link href={path}>
            <Card className="bg-slate-800/50 border-slate-700 hover:bg-slate-700/50 hover:border-slate-600 transition-all cursor-pointer group h-full">
                <CardContent className="p-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20">
                            <MapPin className="h-6 w-6 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-white group-hover:text-blue-400 transition-colors">
                                {region.name}
                            </h3>
                            {region.capital && (
                                <p className="text-sm text-slate-400">Capital: {region.capital}</p>
                            )}
                        </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-500 group-hover:text-blue-400 transition-colors" />
                </CardContent>
            </Card>
        </Link>
    );
}
