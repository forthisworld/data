'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
    InfoRequest,
    InfoRequestConfig,
    InfoRequestTemplate,
    InfoRequestDepartment,
} from '@/types';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Copy, Check, Send, Sparkles } from 'lucide-react';

interface InfoRequestFilingFormProps {
    config: InfoRequestConfig;
    countryCode: string;
    initialSubject?: string;
    initialBody?: string;
    initialDepartmentHint?: string;
}

export default function InfoRequestFilingForm({ config, countryCode, initialSubject, initialBody, initialDepartmentHint }: InfoRequestFilingFormProps) {
    const hasPrefill = Boolean(initialSubject || initialBody);
    const [selectedTemplate, setSelectedTemplate] = useState<InfoRequestTemplate | null>(null);
    const [selectedDepartment, setSelectedDepartment] = useState<InfoRequestDepartment | null>(
        () => (initialDepartmentHint ? config.departments.find(d => d.name === initialDepartmentHint) ?? null : null)
    );
    const [customSubject, setCustomSubject] = useState(initialSubject ?? '');
    const [customBody, setCustomBody] = useState(initialBody ?? '');
    const [copied, setCopied] = useState(false);
    const formRef = useRef<HTMLDivElement>(null);

    // When arriving from a data-gap deep link, scroll the form into view
    useEffect(() => {
        if (hasPrefill && formRef.current) {
            formRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleTemplateChange = (templateId: string) => {
        const template = config.templates.find(t => t.id === templateId);
        if (template) {
            setSelectedTemplate(template);
            setCustomSubject(template.subject);
            setCustomBody(template.body);
        }
    };

    const handleDepartmentChange = (deptId: string) => {
        const dept = config.departments.find(d => d.id === deptId);
        if (dept) {
            setSelectedDepartment(dept);
        }
    };

    const generateMailtoLink = () => {
        if (!selectedDepartment?.email) return '';

        const to = selectedDepartment.email;
        const cc = config.ccEmail;
        const subject = encodeURIComponent(customSubject);
        const body = encodeURIComponent(customBody);

        return `mailto:${to}?cc=${cc}&subject=${subject}&body=${body}`;
    };

    const handleCopyEmail = async () => {
        const emailContent = selectedDepartment?.email
            ? `To: ${selectedDepartment.email}\nCC: ${config.ccEmail}\nSubject: ${customSubject}\n\n${customBody}`
            : `${customSubject}\n\n${customBody}`;
        await navigator.clipboard.writeText(emailContent);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSendEmail = () => {
        if (selectedDepartment?.filingMethod === 'online_portal' && selectedDepartment.filingUrl) {
            window.open(selectedDepartment.filingUrl, '_blank', 'noopener,noreferrer');
            return;
        }
        const mailtoLink = generateMailtoLink();
        if (mailtoLink) {
            window.location.href = mailtoLink;
        }
    };

    const howToFile = (dept: InfoRequestDepartment): string => {
        if (dept.filingMethod === 'online_portal') return `Submit online at ${dept.filingUrl ?? 'the official RTI portal'}, then paste the text below.`;
        if (dept.filingMethod === 'post') return 'Send by post to the Public Information Officer with the prescribed fee. Copy the text below.';
        return `Email ${dept.email} (CC ${config.ccEmail}).`;
    };

    return (
        <div ref={formRef} id="file-rti" className="scroll-mt-24">
            {hasPrefill && (
                <div className="mb-3 flex items-start gap-2 rounded-lg border border-ftw-accent/30 bg-ftw-accent/10 p-3 text-sm text-ftw-text">
                    <Sparkles className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>
                        Draft auto-generated from a data gap on the toll road page.
                        Pick the department, review, and send — the subject and body are already filled in below.
                    </span>
                </div>
            )}
            <Card className={`border-2 border-dashed bg-gradient-to-br from-primary/5 to-transparent ${hasPrefill ? 'border-sky-500/50' : 'border-primary/30'}`}>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    File a {config.displayName}
                </CardTitle>
                <CardDescription>
                    Use our templates to quickly file a {config.fullName} request.
                    Your email client will open with pre-filled content.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Template Selection */}
                <div className="space-y-2">
                    <Label htmlFor="template">Choose a Template</Label>
                    <Select value={selectedTemplate?.id} onValueChange={handleTemplateChange}>
                        <SelectTrigger id="template">
                            <SelectValue placeholder="Select a template..." />
                        </SelectTrigger>
                        <SelectContent>
                            {config.templates.map(template => (
                                <SelectItem key={template.id} value={template.id}>
                                    {template.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Department Selection */}
                <div className="space-y-2">
                    <Label htmlFor="department">Select Department</Label>
                    <Select value={selectedDepartment?.id} onValueChange={handleDepartmentChange}>
                        <SelectTrigger id="department">
                            <SelectValue placeholder="Select a department..." />
                        </SelectTrigger>
                        <SelectContent>
                            {config.departments.map(dept => (
                                <SelectItem key={dept.id} value={dept.id}>
                                    {dept.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {!selectedDepartment && initialDepartmentHint && hasPrefill && (
                        <p className="text-xs text-muted-foreground">
                            Suggested authority: <span className="font-medium">{initialDepartmentHint}</span>.
                            Pick the closest department above, or add this authority to the department list.
                        </p>
                    )}
                </div>

                {(selectedTemplate || hasPrefill) && (
                    <>
                        {/* Subject */}
                        <div className="space-y-2">
                            <Label htmlFor="subject">Subject</Label>
                            <Input
                                id="subject"
                                value={customSubject}
                                onChange={(e) => setCustomSubject(e.target.value)}
                                placeholder="Email subject..."
                            />
                        </div>

                        {/* Body */}
                        <div className="space-y-2">
                            <Label htmlFor="body">Email Body</Label>
                            <Textarea
                                id="body"
                                value={customBody}
                                onChange={(e) => setCustomBody(e.target.value)}
                                placeholder="Email content..."
                                className="min-h-[200px] font-mono text-sm"
                            />
                            <p className="text-xs text-muted-foreground">
                                Replace placeholder text in [BRACKETS] with your specific information
                            </p>
                        </div>

                        {/* Email Preview */}
                        {selectedDepartment && (
                            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                                <h4 className="font-medium text-sm">How to file</h4>
                                <div className="text-sm space-y-1">
                                    <p>{howToFile(selectedDepartment)}</p>
                                    {selectedDepartment.note && <p className="text-muted-foreground">{selectedDepartment.note}</p>}
                                    <p><span className="text-muted-foreground">Subject:</span> {customSubject}</p>
                                </div>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-3 pt-2">
                            {selectedDepartment?.filingMethod !== 'post' && (
                                <Button
                                    onClick={handleSendEmail}
                                    disabled={!selectedDepartment}
                                    className="flex-1"
                                >
                                    <Send className="h-4 w-4 mr-2" />
                                    {selectedDepartment?.filingMethod === 'online_portal' ? 'Open RTI portal' : 'Open in Email Client'}
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                onClick={handleCopyEmail}
                                disabled={!selectedDepartment}
                            >
                                {copied ? (
                                    <Check className="h-4 w-4 mr-2" />
                                ) : (
                                    <Copy className="h-4 w-4 mr-2" />
                                )}
                                {copied ? 'Copied!' : 'Copy'}
                            </Button>
                        </div>
                    </>
                )}
            </CardContent>
            </Card>
        </div>
    );
}
