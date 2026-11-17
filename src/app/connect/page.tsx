import { headers } from 'next/headers';
import Link from 'next/link';
import CopyBlock from '@/components/CopyBlock';

export const metadata = {
    title: 'Use with AI',
    description: 'Connect Claude, Cursor or any MCP client to the data.ftw record: search it, cite it, find the gaps, draft RTIs and propose sourced changes.',
};

const PROMPTS = [
    'Using data.ftw, explain why NICE Road in Bengaluru is still tolled. Cite every source and keep claims separate from findings.',
    'What does data.ftw know about the DND Flyway? Compare the project cost with the toll collected, and say where each number comes from.',
    'List the data gaps for nice-bmic on data.ftw and draft an RTI application for the most important one.',
    'I have an RTI reply about a toll road. Help me turn it into a sourced contribution to data.ftw.',
];

export default async function ConnectPage() {
    const h = await headers();
    const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
    const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
    const url = `${proto}://${host}/api/mcp`;

    return (
        <div className="min-h-screen bg-[#f6f1e4] text-[#2f261d]">
            <div className="container mx-auto max-w-3xl px-4 py-12">
                <p className="text-sm text-[#6f5d49]"><Link href="/in" className="hover:underline">← Back to the atlas</Link></p>
                <h1 className="mt-3 font-[family-name:var(--font-atlas)] text-4xl">Use data.ftw with your AI assistant</h1>
                <p className="mt-3 text-[#4a3b2c]">
                    data.ftw speaks the Model Context Protocol (MCP). Connect it once and your assistant can search the record,
                    read full entries with their sources, see what is still unknown, draft RTI applications, and propose sourced
                    changes, which become pull requests for a human to review. Nothing is published without review.
                </p>

                <h2 className="mt-10 font-[family-name:var(--font-atlas)] text-2xl">The link</h2>
                <CopyBlock text={url} />

                <h2 className="mt-10 font-[family-name:var(--font-atlas)] text-2xl">Set it up</h2>
                <div className="mt-3 space-y-6 text-sm">
                    <section>
                        <h3 className="font-semibold">Claude (claude.ai and the desktop app)</h3>
                        <p className="mt-1 text-[#4a3b2c]">Settings → Connectors → Add custom connector, then paste the link above.</p>
                    </section>
                    <section>
                        <h3 className="font-semibold">Claude Code</h3>
                        <CopyBlock text={`claude mcp add --transport http data-ftw ${url}`} />
                    </section>
                    <section>
                        <h3 className="font-semibold">Cursor and other clients with an <code>mcp.json</code></h3>
                        <CopyBlock text={JSON.stringify({ mcpServers: { 'data-ftw': { url } } }, null, 2)} />
                    </section>
                    <section>
                        <h3 className="font-semibold">Clients that only run local servers</h3>
                        <p className="mt-1 text-[#4a3b2c]">Bridge to the link with <code>mcp-remote</code>:</p>
                        <CopyBlock text={JSON.stringify({ mcpServers: { 'data-ftw': { command: 'npx', args: ['-y', 'mcp-remote', url] } } }, null, 2)} />
                    </section>
                </div>

                <h2 className="mt-10 font-[family-name:var(--font-atlas)] text-2xl">What it can do</h2>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[#4a3b2c]">
                    <li><b>search</b> states, people, toll roads and infrastructure</li>
                    <li><b>get_entity</b>: a full record, with every number&apos;s source and how firm it is (court finding, audit, official record, filing, press report, or claim)</li>
                    <li><b>list_toll_roads</b> and <b>get_data_gaps</b>: what is still unknown, with RTI drafts</li>
                    <li><b>draft_rti</b>: a Right to Information application ready to file</li>
                    <li><b>submit_contribution</b>: a sourced change, opened as a pull request for review</li>
                </ul>

                <h2 className="mt-10 font-[family-name:var(--font-atlas)] text-2xl">Try asking</h2>
                <div className="mt-3 space-y-2">
                    {PROMPTS.map(p => <CopyBlock key={p} text={p} wrap />)}
                </div>

                <p className="mt-10 text-sm text-[#6f5d49]">
                    Prefer to run it locally? The repository has a stdio server in <code>mcp-server/</code>; see{' '}
                    <a href="https://github.com/forthisworld/data/blob/main/CONTRIBUTING.md" className="underline">CONTRIBUTING.md</a>.
                </p>
            </div>
        </div>
    );
}
