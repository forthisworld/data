'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Upload,
    AlertTriangle,
    CheckCircle,
    FileText,
    Link as LinkIcon,
    Users,
    BookOpen
} from 'lucide-react';

const dataCategories = [
    { value: 'government-spending', label: 'Government Spending' },
    { value: 'infrastructure', label: 'Infrastructure' },
    { value: 'representatives', label: 'MPs/MLAs/Representatives' },
    { value: 'elections', label: 'Elections' },
    { value: 'education', label: 'Education' },
    { value: 'healthcare', label: 'Healthcare' },
    { value: 'other', label: 'Other' },
];

export default function ContributePage() {
    const [submitted, setSubmitted] = useState(false);
    const [formData, setFormData] = useState({
        category: '',
        title: '',
        description: '',
        source: '',
        sourceType: '',
        email: '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Generate mailto link with form data
        const subject = encodeURIComponent(`Data Contribution: ${formData.title}`);
        const body = encodeURIComponent(
            `Data Contribution Submission\n` +
            `========================\n\n` +
            `Category: ${formData.category}\n` +
            `Title: ${formData.title}\n` +
            `Source Type: ${formData.sourceType}\n` +
            `Source URL/Reference: ${formData.source}\n\n` +
            `Description:\n${formData.description}\n\n` +
            `Contributor Email: ${formData.email}`
        );
        window.location.href = `mailto:contribute@forthis.world?subject=${subject}&body=${body}`;
        setSubmitted(true);
    };

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
                        <Upload className="h-8 w-8 text-primary" />
                        Contribute Data
                    </h1>
                    <p className="text-muted-foreground">
                        Help us build a comprehensive public data platform. Your contributions make a difference.
                    </p>
                </div>

                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Main Form */}
                    <div className="lg:col-span-2">
                        {submitted ? (
                            <Card className="border-green-500/30 bg-gradient-to-br from-green-500/5 to-transparent">
                                <CardContent className="p-8 text-center">
                                    <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
                                    <h2 className="text-xl font-semibold mb-2">Thank You!</h2>
                                    <p className="text-muted-foreground mb-4">
                                        Your email client should have opened with the submission details.
                                        Please send the email to complete your contribution.
                                    </p>
                                    <Button onClick={() => setSubmitted(false)}>
                                        Submit Another
                                    </Button>
                                </CardContent>
                            </Card>
                        ) : (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Data Submission Form</CardTitle>
                                    <CardDescription>
                                        Fill out the form below and we&apos;ll review your contribution.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <form onSubmit={handleSubmit} className="space-y-6">
                                        {/* Category */}
                                        <div className="space-y-2">
                                            <Label htmlFor="category">Data Category *</Label>
                                            <Select
                                                value={formData.category}
                                                onValueChange={(v) => setFormData({ ...formData, category: v })}
                                                required
                                            >
                                                <SelectTrigger id="category">
                                                    <SelectValue placeholder="Select a category..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {dataCategories.map(cat => (
                                                        <SelectItem key={cat.value} value={cat.value}>
                                                            {cat.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Title */}
                                        <div className="space-y-2">
                                            <Label htmlFor="title">Title *</Label>
                                            <Input
                                                id="title"
                                                value={formData.title}
                                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                                placeholder="e.g., Maharashtra State Budget 2024-25"
                                                required
                                            />
                                        </div>

                                        {/* Description */}
                                        <div className="space-y-2">
                                            <Label htmlFor="description">Description *</Label>
                                            <Textarea
                                                id="description"
                                                value={formData.description}
                                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                                placeholder="Describe the data you're contributing..."
                                                className="min-h-[120px]"
                                                required
                                            />
                                        </div>

                                        {/* Source Type */}
                                        <div className="space-y-2">
                                            <Label htmlFor="sourceType">Source Type *</Label>
                                            <Select
                                                value={formData.sourceType}
                                                onValueChange={(v) => setFormData({ ...formData, sourceType: v })}
                                                required
                                            >
                                                <SelectTrigger id="sourceType">
                                                    <SelectValue placeholder="Where did you get this data?" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="gazette">Gazette of India / State Gazette</SelectItem>
                                                    <SelectItem value="government-portal">Government Website/Portal</SelectItem>
                                                    <SelectItem value="rti-response">RTI Response</SelectItem>
                                                    <SelectItem value="official-report">Official Report/Document</SelectItem>
                                                    <SelectItem value="other-official">Other Official Source</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Source URL */}
                                        <div className="space-y-2">
                                            <Label htmlFor="source">Source URL / Reference *</Label>
                                            <Input
                                                id="source"
                                                value={formData.source}
                                                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                                                placeholder="https://... or document reference"
                                                required
                                            />
                                        </div>

                                        {/* Email */}
                                        <div className="space-y-2">
                                            <Label htmlFor="email">Your Email (optional)</Label>
                                            <Input
                                                id="email"
                                                type="email"
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                placeholder="For attribution and follow-up"
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                We&apos;ll keep you updated on your contribution and attribute you if desired.
                                            </p>
                                        </div>

                                        <Button type="submit" className="w-full">
                                            Submit Contribution
                                        </Button>
                                    </form>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Source Requirements */}
                        <Card className="border-orange-500/30 bg-gradient-to-br from-orange-500/5 to-transparent">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                                    Source Requirements
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm">
                                <p>
                                    For government data (GOI, MPs, MLAs, etc.), sources <strong>must</strong> be from:
                                </p>
                                <ul className="space-y-2">
                                    <li className="flex items-start gap-2">
                                        <FileText className="h-4 w-4 mt-0.5 text-orange-600" />
                                        <span>Official Gazette of India / State Gazettes</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <LinkIcon className="h-4 w-4 mt-0.5 text-orange-600" />
                                        <span>Government websites & official portals</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <BookOpen className="h-4 w-4 mt-0.5 text-orange-600" />
                                        <span>RTI responses & official reports</span>
                                    </li>
                                </ul>
                                <p className="text-muted-foreground pt-2 border-t">
                                    This protects both you and us from potential legal issues.
                                    We cannot accept unverified or unofficial sources for government data.
                                </p>
                            </CardContent>
                        </Card>

                        {/* Contributor Dashboard Placeholder */}
                        <Card className="border-dashed opacity-75">
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Users className="h-5 w-5" />
                                        Contributor Dashboard
                                    </CardTitle>
                                    <Badge variant="outline">Coming Soon</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="text-sm text-muted-foreground">
                                <p>
                                    Soon, approved contributors will be able to:
                                </p>
                                <ul className="list-disc list-inside mt-2 space-y-1">
                                    <li>Directly upload and edit data</li>
                                    <li>Track contribution history</li>
                                    <li>Earn contributor badges</li>
                                    <li>Access advanced editing tools</li>
                                </ul>
                            </CardContent>
                        </Card>

                        {/* Guidelines */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg">Contribution Guidelines</CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm space-y-2 text-muted-foreground">
                                <p>✓ Ensure data is accurate and up-to-date</p>
                                <p>✓ Always provide a verifiable source</p>
                                <p>✓ Include relevant dates and context</p>
                                <p>✓ Be specific about what data you&apos;re providing</p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
