'use client';

import React from 'react';
import Link from 'next/link';
import { InfoRequest, InfoRequestStatus } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, FileText, Clock, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';

interface RTITrackerWidgetProps {
    countryCode: string;
    currencySymbol?: string;
    displayName: string;
    requests: InfoRequest[];
    filterTag?: string; // region slug or similar for filtering
    filterLabel?: string; // Human readable label like "Maharashtra"
    maxItems?: number;
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

export default function RTITrackerWidget({
    countryCode,
    currencySymbol = '₹',
    displayName,
    requests,
    filterTag,
    filterLabel,
    maxItems = 3
}: RTITrackerWidgetProps) {
    // Calculate stats
    const total = requests.length;
    const pending = requests.filter(r => r.status === 'pending' || r.status === 'filed').length;
    const responded = requests.filter(r => r.status === 'responded').length;

    // Get recent items
    const recentRequests = requests.slice(0, maxItems);

    // Build link to full tracker
    const trackerLink = filterTag
        ? `/${countryCode}/info-requests?tag=${filterTag}`
        : `/${countryCode}/info-requests`;

    if (requests.length === 0) {
        return null;
    }

    return (
        <Card className="bg-slate-800/50 border-slate-700 overflow-hidden">
            <CardHeader className="pb-3 border-b border-slate-700/50">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-white flex items-center gap-2">
                        <FileText className="h-5 w-5 text-blue-400" />
                        {filterLabel ? `${filterLabel} ${displayName} Requests` : `${displayName} Tracker`}
                    </CardTitle>
                    <Badge variant="outline" className="border-slate-600 text-slate-300">
                        {total} Total
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {/* Stats Row */}
                <div className="grid grid-cols-2 divide-x divide-slate-700/50 border-b border-slate-700/50 bg-slate-900/30">
                    <div className="p-3 text-center">
                        <div className="text-2xl font-bold text-yellow-500">{pending}</div>
                        <div className="text-xs text-slate-400 uppercase tracking-wider">Pending</div>
                    </div>
                    <div className="p-3 text-center">
                        <div className="text-2xl font-bold text-green-500">{responded}</div>
                        <div className="text-xs text-slate-400 uppercase tracking-wider">Responded</div>
                    </div>
                </div>

                {/* List */}
                <div className="divide-y divide-slate-700/50">
                    {recentRequests.map(request => (
                        <div key={request.id} className="p-4 hover:bg-slate-700/30 transition-colors">
                            <div className="flex items-start justify-between gap-3 mb-1">
                                <h4 className="text-sm font-medium text-slate-200 line-clamp-1">
                                    {request.title}
                                </h4>
                                <Badge
                                    className={`${statusConfig[request.status].color} text-white hover:opacity-90 px-1.5 py-0 text-[10px] h-5 whitespace-nowrap`}
                                >
                                    {statusConfig[request.status].label}
                                </Badge>
                            </div>
                            <p className="text-xs text-slate-400 line-clamp-2 mb-2">
                                {request.description}
                            </p>
                            <div className="flex items-center justify-between text-xs text-slate-500">
                                <span>{request.department}</span>
                                {request.responseUrl && (
                                    <span className="flex items-center text-blue-400">
                                        Response <ExternalLink className="h-3 w-3 ml-1" />
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer Action */}
                <div className="p-3 bg-slate-900/30 border-t border-slate-700/50">
                    <Link href={trackerLink}>
                        <Button variant="ghost" className="w-full text-blue-400 hover:text-blue-300 hover:bg-slate-800 h-9">
                            View All in {displayName} Tracker
                            <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                    </Link>
                </div>
            </CardContent>
        </Card>
    );
}
