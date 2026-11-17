import Link from 'next/link';
import { Database, FileText, Code, HandCoins, Bot, Github, ArrowUpRight } from 'lucide-react';

export const metadata = {
    title: 'Contribute',
    description: 'Four ways to help: add sourced data, file an RTI and share the reply, improve the code, or fund the work.',
};

const REPO = 'https://github.com/forthisworld/data';

const WAYS = [
    {
        icon: Database,
        title: 'Add or correct data',
        body: 'Have a document that proves a fact (a judgment, an audit, a gazette notice, a company filing)? Send it as a sourced change. Every number needs its source and how firm it is; claims are kept apart from findings. Your change becomes a pull request that a person reviews before it is published.',
        links: [
            { href: '/connect', label: 'Through your AI assistant', icon: Bot },
            { href: `${REPO}/tree/main/data/in`, label: 'Edit the data on GitHub', icon: Github },
            { href: `${REPO}/blob/main/data/SOURCING.md`, label: 'Read the sourcing standard', icon: ArrowUpRight },
        ],
    },
    {
        icon: FileText,
        title: 'File an RTI and share the reply',
        body: 'Most gaps in the record (toll collected year by year, audited costs, concession agreements) can be answered under the Right to Information Act. Pick an open question, file it, and when the reply comes, share it as a source so everyone can use it. Redact your personal details first.',
        links: [
            { href: '/in/info-requests', label: 'RTI targets and drafts', icon: FileText },
            { href: 'https://rtionline.gov.in', label: 'File with central authorities (RTI Online)', icon: ArrowUpRight },
        ],
    },
    {
        icon: Code,
        title: 'Improve the code',
        body: 'The site is open source (MIT): Next.js, a MapLibre atlas, and JSON data bundled at build time. Pick an issue, keep pull requests small, and never add a number to the interface that is not in the data with a source.',
        links: [
            { href: `${REPO}/blob/main/CONTRIBUTING.md`, label: 'CONTRIBUTING.md', icon: Github },
            { href: `${REPO}/issues`, label: 'Open issues', icon: ArrowUpRight },
        ],
    },
    {
        icon: HandCoins,
        title: 'Fund the work',
        body: "RTI fees, company filings from the MCA portal and hosting cost a little money. We don't accept donations yet: we want a channel where every rupee in and out is public first. Until then, the most useful thing to fund is your own RTI on one of our open questions.",
        links: [],
    },
];

export default function ContributePage() {
    return (
        <div className="min-h-screen bg-[#f6f1e4] text-[#2f261d]">
            <div className="container mx-auto max-w-4xl px-4 py-12">
                <p className="text-sm text-[#6f5d49]"><Link href="/in" className="hover:underline">← Back to the atlas</Link></p>
                <h1 className="mt-3 font-[family-name:var(--font-atlas)] text-4xl">Help build the atlas</h1>
                <p className="mt-3 max-w-2xl text-[#4a3b2c]">
                    data.ftw is only as good as its sources. Four ways to help; you don&apos;t need to write code for three of them.
                    By contributing you agree that data is published under the ODbL and code under the MIT licence.
                </p>

                <div className="mt-10 grid gap-5 md:grid-cols-2">
                    {WAYS.map(({ icon: Icon, title, body, links }) => (
                        <section key={title} className="rounded-lg border border-[#6f5d49]/40 bg-[#fbf6e9] p-5">
                            <h2 className="flex items-center gap-2 font-[family-name:var(--font-atlas)] text-2xl">
                                <Icon className="h-5 w-5 text-[#1f3a4d]" /> {title}
                            </h2>
                            <p className="mt-2 text-sm leading-relaxed text-[#4a3b2c]">{body}</p>
                            {links.length > 0 && (
                                <ul className="mt-4 space-y-1.5 text-sm">
                                    {links.map(({ href, label, icon: L }) => (
                                        <li key={href}>
                                            <a href={href} className="inline-flex items-center gap-1.5 font-medium text-[#1f3a4d] hover:underline"
                                                {...(href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                                                <L className="h-4 w-4" /> {label}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    ))}
                </div>
            </div>
        </div>
    );
}
