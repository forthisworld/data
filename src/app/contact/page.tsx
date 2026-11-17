import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Mail,
    MessageSquare,
    AlertCircle,
    Handshake,
    ExternalLink,
    Github
} from 'lucide-react';

export const metadata = {
    title: 'Contact Us - data.ftw',
    description: 'Get in touch with the data.ftw team',
};

const contactOptions = [
    {
        icon: MessageSquare,
        title: 'General Inquiries',
        description: 'Questions about the platform, data, or anything else',
        email: 'hello@forthis.world',
        subject: 'General Inquiry - data.ftw',
        body: 'Hello,\n\nI have a question about data.ftw:\n\n[Your question here]\n\nThank you!',
        color: 'blue',
    },
    {
        icon: AlertCircle,
        title: 'Data Corrections',
        description: 'Found incorrect or outdated information? Let us know',
        email: 'corrections@forthis.world',
        subject: 'Data Correction Request',
        body: 'Hello,\n\nI found an issue with the following data:\n\nPage/Entity: [URL or name]\nIssue: [Describe the problem]\nCorrect Information: [Provide correct data if available]\nSource: [Link to official source]\n\nThank you!',
        color: 'orange',
    },
    {
        icon: Mail,
        title: 'RTI/FOI Help',
        description: 'Need help filing an information request?',
        email: 'rti@forthis.world',
        subject: 'RTI Filing Help Request',
        body: 'Hello,\n\nI need help filing an RTI/information request:\n\nTopic: [What information do you need?]\nDepartment: [Which department should this go to?]\nDetails: [Any additional context]\n\nThank you!',
        color: 'green',
    },
    {
        icon: Handshake,
        title: 'Partnerships',
        description: 'Interested in collaborating or partnering with us?',
        email: 'partnerships@forthis.world',
        subject: 'Partnership Inquiry',
        body: 'Hello,\n\nI\'m interested in partnering with data.ftw:\n\nOrganization: [Your organization]\nProposal: [Brief description of partnership idea]\n\nLooking forward to hearing from you!',
        color: 'purple',
    },
];

function generateMailtoLink(email: string, subject: string, body: string) {
    return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default function ContactPage() {
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
                    <h1 className="text-3xl font-bold mb-2">Contact Us</h1>
                    <p className="text-muted-foreground">
                        Have questions, found an issue, or want to collaborate? We&apos;d love to hear from you.
                    </p>
                </div>

                {/* Contact Options */}
                <div className="grid md:grid-cols-2 gap-6 mb-12">
                    {contactOptions.map((option) => {
                        const Icon = option.icon;
                        const borderColor = {
                            blue: 'border-blue-500/30 hover:border-blue-500/50',
                            orange: 'border-orange-500/30 hover:border-orange-500/50',
                            green: 'border-green-500/30 hover:border-green-500/50',
                            purple: 'border-purple-500/30 hover:border-purple-500/50',
                        }[option.color];
                        const bgColor = {
                            blue: 'from-blue-500/5',
                            orange: 'from-orange-500/5',
                            green: 'from-green-500/5',
                            purple: 'from-purple-500/5',
                        }[option.color];
                        const iconColor = {
                            blue: 'text-blue-600',
                            orange: 'text-orange-600',
                            green: 'text-green-600',
                            purple: 'text-purple-600',
                        }[option.color];

                        return (
                            <Card
                                key={option.title}
                                className={`${borderColor} bg-gradient-to-br ${bgColor} to-transparent transition-all hover:shadow-md`}
                            >
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-lg">
                                        <Icon className={`h-5 w-5 ${iconColor}`} />
                                        {option.title}
                                    </CardTitle>
                                    <CardDescription>{option.description}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Button asChild className="w-full">
                                        <a href={generateMailtoLink(option.email, option.subject, option.body)}>
                                            <Mail className="h-4 w-4 mr-2" />
                                            {option.email}
                                        </a>
                                    </Button>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                {/* Other Ways to Connect */}
                <Card>
                    <CardHeader>
                        <CardTitle>Other Ways to Connect</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                            <Github className="h-8 w-8" />
                            <div className="flex-1">
                                <h4 className="font-medium">GitHub</h4>
                                <p className="text-sm text-muted-foreground">
                                    Report bugs, request features, or contribute code
                                </p>
                            </div>
                            <Button variant="outline" asChild>
                                <a
                                    href="https://github.com/forthisworld/data"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    Open Issues
                                    <ExternalLink className="h-3 w-3 ml-2" />
                                </a>
                            </Button>
                        </div>

                        <div className="text-center text-sm text-muted-foreground pt-4 border-t">
                            <p>
                                We typically respond within 2-3 business days. For urgent data corrections,
                                please use the Data Corrections option above.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
