import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Shield,
    Lock,
    Code,
    ExternalLink,
    Cookie,
    Eye,
    Database,
    Scale
} from 'lucide-react';

export const metadata = {
    title: 'Privacy & Legal - data.ftw',
    description: 'Privacy policy, license information, and legal notices for data.ftw',
};

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
            <div className="container mx-auto px-4 py-8 max-w-4xl">
                {/* Header */}
                <div className="mb-8">
                    <Link
                        href="/"
                        className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block"
                    >
                        ← Back to Home
                    </Link>
                    <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                        <Shield className="h-8 w-8 text-primary" />
                        Privacy & Legal
                    </h1>
                    <p className="text-muted-foreground">
                        We believe in transparency. Here&apos;s everything you need to know about how we handle data.
                    </p>
                </div>

                <div className="space-y-8">
                    {/* No Cookies */}
                    <Card className="border-green-500/30 bg-gradient-to-br from-green-500/5 to-transparent">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Cookie className="h-5 w-5 text-green-600" />
                                No Cookies
                                <Badge variant="secondary" className="bg-green-500/10 text-green-700">
                                    Privacy First
                                </Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <p>
                                <strong>We don&apos;t use cookies.</strong> Period. No tracking cookies, no analytics cookies,
                                no third-party cookies. Your browsing experience on our platform is completely cookie-free.
                            </p>
                            <p className="text-sm text-muted-foreground">
                                This means we don&apos;t track your behavior, don&apos;t build profiles about you, and don&apos;t
                                share any data with advertisers. You get a clean, fast experience without the tracking baggage.
                            </p>
                        </CardContent>
                    </Card>

                    {/* No Tracking */}
                    <Card className="border-blue-500/30 bg-gradient-to-br from-blue-500/5 to-transparent">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Eye className="h-5 w-5 text-blue-600" />
                                No Tracking
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <p>
                                We don&apos;t use Google Analytics, Facebook Pixel, or any other tracking services.
                                We don&apos;t collect information about:
                            </p>
                            <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
                                <li>Pages you visit</li>
                                <li>How long you stay on pages</li>
                                <li>Clicks or interactions</li>
                                <li>Device fingerprints</li>
                                <li>Your IP address for tracking purposes</li>
                            </ul>
                        </CardContent>
                    </Card>

                    {/* Data We Collect */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Database className="h-5 w-5" />
                                Data We Collect
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p>
                                <strong>Minimal by design.</strong> We only collect what you explicitly provide:
                            </p>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="p-4 rounded-lg bg-muted/50">
                                    <h4 className="font-medium mb-2">When you contact us</h4>
                                    <p className="text-sm text-muted-foreground">
                                        Your email address and message content (only if you choose to contact us)
                                    </p>
                                </div>
                                <div className="p-4 rounded-lg bg-muted/50">
                                    <h4 className="font-medium mb-2">When you contribute data</h4>
                                    <p className="text-sm text-muted-foreground">
                                        Information you submit through our data contribution forms (with your consent)
                                    </p>
                                </div>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                We never sell, share, or monetize any personal information.
                            </p>
                        </CardContent>
                    </Card>

                    {/* Open Source License */}
                    <Card className="border-purple-500/30 bg-gradient-to-br from-purple-500/5 to-transparent">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Code className="h-5 w-5 text-purple-600" />
                                Open Source - MIT (code) and ODbL (data)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p>
                                The <strong>code</strong> is free and open source under the MIT License: use, copy,
                                modify and redistribute it for any purpose, keeping the copyright notice.
                            </p>
                            <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                                <h4 className="font-medium">The data is under the Open Database License (ODbL 1.0). You can:</h4>
                                <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
                                    <li>Use it for any purpose, including commercial use</li>
                                    <li>Copy, share and adapt it</li>
                                    <li>Build charts, articles and apps from it under any license</li>
                                </ul>
                            </div>
                            <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                                <h4 className="font-medium">Under the condition that:</h4>
                                <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
                                    <li>You credit data.ftw (ForThisWorld)</li>
                                    <li>If you publish a changed or extended copy of the database, it is also ODbL</li>
                                    <li>Source documents we cite keep their publishers&apos; own terms</li>
                                </ul>
                            </div>
                            <Button variant="outline" asChild>
                                <a
                                    href="https://github.com/forthisworld/data"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <Code className="h-4 w-4 mr-2" />
                                    View Source on GitHub
                                    <ExternalLink className="h-3 w-3 ml-2" />
                                </a>
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Legal Disclaimer */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Scale className="h-5 w-5" />
                                Disclaimer
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm text-muted-foreground">
                            <p>
                                The data provided on this website is for <strong>informational purposes only</strong>.
                                While we strive to ensure accuracy, we make no warranties about the completeness,
                                reliability, or accuracy of this information.
                            </p>
                            <p>
                                Every published fact links to its source: court judgments, audit reports, the Gazette, census
                                tables, government websites and RTI replies, and, where nothing better exists yet, named press
                                reports. Statements by politicians or companies that we cannot confirm are shown as claims.
                            </p>
                            <p>
                                Any action you take based on the information on this website is strictly at your own risk.
                                We will not be liable for any losses and/or damages in connection with the use of our website.
                            </p>
                        </CardContent>
                    </Card>

                    {/* Contact */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Lock className="h-5 w-5" />
                                Questions?
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="mb-4">
                                If you have any questions about our privacy practices or this policy, please contact us.
                            </p>
                            <Button asChild>
                                <Link href="/contact">Contact Us</Link>
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* Last Updated */}
                <p className="text-center text-sm text-muted-foreground mt-8">
                    Last updated: January 2026
                </p>
            </div>
        </div>
    );
}
