'use client';

import React, { useState } from 'react';
import { InfoRequest, InfoRequestStatus } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    FileText,
    Clock,
    CheckCircle,
    AlertCircle,
    Users,
    Building,
    Calendar,
    ExternalLink
} from 'lucide-react';

interface InfoRequestListProps {
    requests: InfoRequest[];
    displayName: string;
    currencySymbol?: string;
    initialTagFilter?: string;
    initialStatusFilter?: InfoRequestStatus | 'all';
}

const statusConfig: Record<InfoRequestStatus, { label: string; color: string; icon: React.ReactNode }> = {
    draft: { label: 'Draft', color: 'bg-gray-500', icon: <FileText className="h-3 w-3" /> },
    filed: { label: 'Filed', color: 'bg-blue-500', icon: <FileText className="h-3 w-3" /> },
    pending: { label: 'Pending', color: 'bg-yellow-500', icon: <Clock className="h-3 w-3" /> },
    responded: { label: 'Responded', color: 'bg-green-500', icon: <CheckCircle className="h-3 w-3" /> },
    appealed: { label: 'Appealed', color: 'bg-orange-500', icon: <AlertCircle className="h-3 w-3" /> },
    rejected: { label: 'Rejected', color: 'bg-red-500', icon: <AlertCircle className="h-3 w-3" /> },
    closed: { label: 'Closed', color: 'bg-gray-400', icon: <CheckCircle className="h-3 w-3" /> },
};

export default function InfoRequestList({
    requests,
    displayName,
    currencySymbol = '₹',
    initialTagFilter,
    initialStatusFilter = 'all'
}: InfoRequestListProps) {
    const [filter, setFilter] = useState<'all' | 'platform' | 'community'>('all');
    const [statusFilter, setStatusFilter] = useState<InfoRequestStatus | 'all'>(initialStatusFilter);
    const [tagFilter, setTagFilter] = useState<string | undefined>(initialTagFilter);

    // Update state if props change (optional, but good for navigation)
    React.useEffect(() => {
        if (initialTagFilter) setTagFilter(initialTagFilter);
    }, [initialTagFilter]);

    const filteredRequests = requests.filter(req => {
        if (filter !== 'all' && req.filedBy !== filter) return false;
        if (statusFilter !== 'all' && req.status !== statusFilter) return false;

        if (tagFilter) {
            const hasTag = req.tags?.includes(tagFilter);
            const hasRegion = req.regionIds?.includes(tagFilter);
            if (!hasTag && !hasRegion) return false;
        }

        return true;
    });

    const platformCount = requests.filter(r => r.filedBy === 'platform').length;
    const communityCount = requests.filter(r => r.filedBy === 'community').length;

    return (
        <div className="space-y-6">
            {/* Filter Banner if Tag Active */}
            {tagFilter && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                            Filtered by: {tagFilter}
                        </Badge>
                        <span className="text-sm text-muted-foreground">Showing requests related to <span className="font-medium text-foreground capitalize">{tagFilter}</span></span>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setTagFilter(undefined)}
                        className="h-8 text-muted-foreground hover:text-foreground"
                    >
                        Clear Filter
                    </Button>
                </div>
            )}

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-blue-500/10 to-transparent">
                    <CardContent className="p-4">
                        <div className="text-2xl font-bold">{requests.length}</div>
                        <div className="text-sm text-muted-foreground">Total {displayName}s Filed</div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-green-500/10 to-transparent">
                    <CardContent className="p-4">
                        <div className="text-2xl font-bold">{requests.filter(r => r.status === 'responded').length}</div>
                        <div className="text-sm text-muted-foreground">Responses Received</div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-yellow-500/10 to-transparent">
                    <CardContent className="p-4">
                        <div className="text-2xl font-bold">{platformCount}</div>
                        <div className="text-sm text-muted-foreground">Filed by Platform</div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-purple-500/10 to-transparent">
                    <CardContent className="p-4">
                        <div className="text-2xl font-bold">{communityCount}</div>
                        <div className="text-sm text-muted-foreground">Filed by Community</div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
                <div className="flex gap-2">
                    <Button
                        variant={filter === 'all' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilter('all')}
                    >
                        All
                    </Button>
                    <Button
                        variant={filter === 'platform' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilter('platform')}
                    >
                        <Building className="h-3 w-3 mr-1" />
                        Platform
                    </Button>
                    <Button
                        variant={filter === 'community' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilter('community')}
                    >
                        <Users className="h-3 w-3 mr-1" />
                        Community
                    </Button>
                </div>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as InfoRequestStatus | 'all')}>
                    <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="responded">Responded</SelectItem>
                        <SelectItem value="filed">Filed</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Request List */}
            <div className="space-y-4">
                {filteredRequests.length === 0 ? (
                    <Card>
                        <CardContent className="p-8 text-center text-muted-foreground">
                            No {displayName}s found matching your filters.
                        </CardContent>
                    </Card>
                ) : (
                    filteredRequests.map(request => (
                        <Card key={request.id} className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                    <div className="flex-1 space-y-2">
                                        <div className="flex items-start gap-2">
                                            <h3 className="font-semibold">{request.title}</h3>
                                            <Badge
                                                variant="secondary"
                                                className={`${statusConfig[request.status].color} text-white`}
                                            >
                                                {statusConfig[request.status].icon}
                                                <span className="ml-1">{statusConfig[request.status].label}</span>
                                            </Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground">{request.description}</p>
                                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <Building className="h-3 w-3" />
                                                {request.department}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Calendar className="h-3 w-3" />
                                                Filed: {new Date(request.filedDate).toLocaleDateString()}
                                            </span>
                                            {request.filedBy === 'platform' ? (
                                                <Badge variant="outline" className="text-xs">Platform</Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-xs">Community</Badge>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        {request.cost && (
                                            <span className="text-sm font-medium">
                                                {currencySymbol}{request.cost.value}
                                            </span>
                                        )}
                                        {request.responseUrl && (
                                            <Button variant="outline" size="sm" asChild>
                                                <a href={request.responseUrl} target="_blank" rel="noopener noreferrer">
                                                    <ExternalLink className="h-3 w-3 mr-1" />
                                                    View Response
                                                </a>
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                {request.tags && request.tags.length > 0 && (
                                    <div className="flex gap-2 mt-3 pt-3 border-t">
                                        {request.tags.map(tag => (
                                            <Badge key={tag} variant="secondary" className="text-xs">
                                                {tag}
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}
