import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCountryConfig } from '@/services/country.service';
import { getInfoRequestData } from '@/services/info-request.service';
import InfoRequestList from '@/components/InfoRequestList';
import InfoRequestFilingForm from '@/components/InfoRequestFilingForm';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    InfoRequestStatus
} from '@/types';
import { AlertCircle } from 'lucide-react';

interface InfoRequestsPageProps {
    params: Promise<{
        country: string;
    }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export const metadata = { title: 'File an RTI', description: 'Questions about public money that the Right to Information Act can answer, ready-made applications, and how to share the reply.' };

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

    const { config, requests, targets } = infoData;
    const prefilled = typeof subject === 'string' && subject.length > 0;

    return (
        <div className="min-h-screen bg-ftw-bg text-ftw-text">
            <div className="container mx-auto max-w-5xl px-4 py-10">
                <p className="text-sm text-ftw-muted"><Link href={`/${country}`} className="hover:underline">← Back to the atlas</Link></p>
                <h1 className="mt-3 text-4xl font-semibold tracking-tight">File an RTI</h1>
                <p className="mt-3 max-w-2xl text-ftw-muted">
                    The {config.fullName} Act, 2005 lets anyone ask a public authority for its records. Most gaps in the atlas can be
                    answered this way. Pick a question, file it, and when the reply comes, share it so everyone can use it.
                </p>

                <div className="mt-10 grid gap-8 lg:grid-cols-5">
                    <div className="space-y-10 lg:col-span-3">
                        <section>
                            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ftw-muted">Questions we want answered</h2>
                            <ul className="mt-3 space-y-3">
                                {targets.map(target => (
                                    <li key={target.id} className="rounded-2xl border border-ftw-line bg-ftw-surface p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <h3 className="font-semibold">{target.title}</h3>
                                            {target.priority === 'high' && <span className="shrink-0 rounded-full bg-ftw-tolled/12 px-2 py-0.5 text-[11px] font-semibold text-ftw-tolled">Priority</span>}
                                        </div>
                                        <p className="mt-1 text-sm text-ftw-muted">{target.description}</p>
                                        <p className="mt-2 text-xs text-ftw-faint">{target.department}</p>
                                    </li>
                                ))}
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ftw-muted">Filed so far</h2>
                            <div className="mt-3">
                                <InfoRequestList
                                    requests={requests}
                                    displayName={config.displayName}
                                    currencySymbol={countryConfig.currencySymbol}
                                    initialTagFilter={tag as string}
                                    initialStatusFilter={status as InfoRequestStatus}
                                />
                            </div>
                        </section>
                    </div>

                    <div className={`lg:col-span-2 ${prefilled ? 'order-first lg:order-none' : ''}`}>
                        <div className="lg:sticky lg:top-20">
                            <InfoRequestFilingForm
                                config={config}
                                countryCode={country}
                                initialSubject={typeof subject === 'string' ? subject : undefined}
                                initialBody={typeof body === 'string' ? body : undefined}
                                initialDepartmentHint={typeof dept === 'string' ? dept : undefined}
                            />
                            <p className="mt-3 text-xs leading-relaxed text-ftw-muted">
                                Got a reply? Share it as a source (redact your address, phone and signature first):{' '}
                                <Link href="/contribute" className="font-medium text-ftw-accent hover:underline">how to contribute</Link>.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
