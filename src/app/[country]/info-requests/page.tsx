import { promises as fs } from 'fs';
import path from 'path';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCountryConfig } from '@/services/country.service';
import { getInfoRequestData } from '@/services/info-request.service';
import InfoRequestList from '@/components/InfoRequestList';
import InfoRequestFilingForm from '@/components/InfoRequestFilingForm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    InfoRequestStatus
} from '@/types';
import {
    ArrowLeft,
    Target,
    TrendingUp,
    Wallet,
    Clock,
    AlertCircle
} from 'lucide-react';

interface InfoRequestsPageProps {
    params: Promise<{
        country: string;
    }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function InfoRequestsPage(props: InfoRequestsPageProps) {
    const { params } = props;

    const { country } = await params;
    const { tag, status, subject, body, dept } = await props.searchParams;

    let countryConfig;
    try {
        countryConfig = await getCountryConfig(country);
    } catch {
        notFound();
    }

    const infoData = await getInfoRequestData(country);

    if (!infoData || !infoData.config.enabled) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
                <div className="container mx-auto px-4 py-8">
                    <Card className="max-w-2xl mx-auto">
                        <CardContent className="p-8 text-center">
                            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                            <h2 className="text-xl font-semibold mb-2">Coming Soon</h2>
                            <p className="text-muted-foreground">
                                Information request tracking for {countryConfig.name} is not yet available.
                            </p>
                            <Button asChild className="mt-4">
                                <Link href={`/${country}`}>Go Back to Dashboard</Link>
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    const { config, requests, targets, stats } = infoData;

    return (
        <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
            <div className="container mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8">
                    <Link
                        href={`/${country}`}
                        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
                    >
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Back to {countryConfig.name} Dashboard
                    </Link>
                    <h1 className="text-3xl font-bold mb-2">
                        {config.fullName} ({config.displayName})
                    </h1>
                    <p className="text-muted-foreground">
                        Track filed {config.displayName}s, see what we&apos;re working on, and file your own requests.
                    </p>
                </div>

                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Filed Requests */}
                        <section>
                            <h2 className="text-xl font-semibold mb-4">Filed {config.displayName}s</h2>
                            <InfoRequestList
                                requests={requests}
                                displayName={config.displayName}
                                currencySymbol={countryConfig.currencySymbol}
                                initialTagFilter={tag as string}
                                initialStatusFilter={status as InfoRequestStatus}
                            />
                        </section>

                        {/* What We're Looking At */}
                        <section>
                            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                <Target className="h-5 w-5" />
                                Planned {config.displayName}s
                            </h2>
                            <div className="grid gap-4">
                                {targets.map(target => (
                                    <Card key={target.id} className="hover:shadow-md transition-shadow">
                                        <CardContent className="p-4">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="font-medium">{target.title}</h3>
                                                        <Badge
                                                            variant={target.priority === 'high' ? 'destructive' : target.priority === 'medium' ? 'default' : 'secondary'}
                                                        >
                                                            {target.priority}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-sm text-muted-foreground">{target.description}</p>
                                                    <p className="text-xs text-muted-foreground">{target.department}</p>
                                                </div>
                                                {target.estimatedCost && (
                                                    <div className="text-right">
                                                        <span className="text-sm font-medium">
                                                            ~{countryConfig.currencySymbol}{target.estimatedCost.value}
                                                        </span>
                                                        <p className="text-xs text-muted-foreground">est. cost</p>
                                                    </div>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </section>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Cost Tracker - Marked as Coming Soon */}
                        <Card className="border-dashed opacity-75">
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Wallet className="h-5 w-5" />
                                        Cost Tracker
                                    </CardTitle>
                                    <Badge variant="outline">Coming Soon</Badge>
                                </div>
                                <CardDescription>
                                    Track spending and contributions
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 opacity-50">
                                <div className="flex justify-between">
                                    <span className="text-sm text-muted-foreground">Total Spent</span>
                                    <span className="font-medium">{countryConfig.currencySymbol}{stats.totalSpent.value}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-muted-foreground">Still Needed</span>
                                    <span className="font-medium">{countryConfig.currencySymbol}{stats.totalNeeded.value}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-muted-foreground">Contributed</span>
                                    <span className="font-medium text-green-600">{countryConfig.currencySymbol}{stats.totalContributed.value}</span>
                                </div>
                                <Button className="w-full" disabled>
                                    Contribute (Coming Soon)
                                </Button>
                            </CardContent>
                        </Card>

                        {/* Quick Stats */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <TrendingUp className="h-5 w-5" />
                                    Quick Stats
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm">Total Filed</span>
                                    <Badge variant="secondary">{stats.totalFiled}</Badge>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm">Responses Received</span>
                                    <Badge variant="secondary" className="bg-green-500/10 text-green-700">
                                        {stats.totalResponded}
                                    </Badge>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm">Pending</span>
                                    <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-700">
                                        <Clock className="h-3 w-3 mr-1" />
                                        {stats.totalPending}
                                    </Badge>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Filing Form */}
                        <InfoRequestFilingForm
                            config={config}
                            countryCode={country}
                            initialSubject={typeof subject === 'string' ? subject : undefined}
                            initialBody={typeof body === 'string' ? body : undefined}
                            initialDepartmentHint={typeof dept === 'string' ? dept : undefined}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
