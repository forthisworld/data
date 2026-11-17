/**
 * The data.ftw MCP server, served over HTTP at /api/mcp so any MCP client
 * (Claude, Cursor, ChatGPT connectors, ...) can use the published record by URL.
 *
 * Read tools serve the bundled published record. submit_contribution opens a
 * pull request against the `data` branch after the sourcing checks pass;
 * nothing is published until a reviewer merges it.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getCountryData, findEntity } from '@/lib/data/store';
import { searchAll } from '@/services/search.service';
import { getDataGaps } from '@/services/toll-road-analytics';
import { ContributionSchema, bundledFile, submitContribution } from '@/lib/contrib/contribute';

const text = (t: string) => ({ content: [{ type: 'text' as const, text: t }] });
const json = (v: unknown) => text(JSON.stringify(v, null, 2));

export const MCP_INSTRUCTIONS = `data.ftw is an open, cited record of Indian governance data, starting with toll roads (who built them, what they cost, who sanctioned them, what they earned, why they are still tolled).
Every number carries a sourceId and a basis: court_finding, audit_finding, official_record and company_filing are established; reported and claim are not. Always cite the sources you use and never present a claim as a fact.
Use search to find records, get_entity for full detail, get_data_gaps to see what is unknown, draft_rti to prepare a Right to Information request, and submit_contribution to propose a sourced change (it becomes a pull request for human review).`;

export function createMcpServer(): McpServer {
    const server = new McpServer({ name: 'data.ftw', version: '0.3.0' }, { instructions: MCP_INSTRUCTIONS });

    server.tool(
        'search',
        'Search the record: states, people, toll roads, infrastructure. Returns name, type, short description and the page path.',
        { query: z.string().min(2), country: z.string().default('in') },
        async ({ query, country }) => json(await searchAll(country, query))
    );

    server.tool(
        'get_entity',
        'Full record for one entity by slug (e.g. "nice-bmic", "dnd-flyway", "karnataka", "narendra-modi"), including every source. Each money value has sourceId and basis.',
        { slug: z.string(), country: z.string().default('in') },
        async ({ slug, country }) => {
            const d = getCountryData(country);
            if (!d) return text(`No data for country '${country}'`);
            const found = d.tollRoads.find(t => t.slug === slug) ?? findEntity(d.persons, slug) ?? findEntity(d.infrastructure, slug) ?? findEntity(d.regions, slug);
            return found ? json(found) : text(`Not found: ${slug}. Use search first.`);
        }
    );

    server.tool(
        'list_toll_roads',
        'All toll roads in the record with tolling status, project cost and number of sources.',
        { country: z.string().default('in') },
        async ({ country }) => json((getCountryData(country)?.tollRoads ?? []).map(t => ({
            slug: t.slug, name: t.name, regions: t.regionIds, tolling: t.tolling?.status ?? 'unknown',
            projectCost: t.projectCost ? { ...t.projectCost } : null, sources: t.sources.length,
        })))
    );

    server.tool(
        'get_data_gaps',
        'What is NOT yet known about a toll road, each with a ready-to-file RTI draft, plus claims that still need a primary source. This is where contributions help most.',
        { slug: z.string(), country: z.string().default('in') },
        async ({ slug, country }) => {
            const road = getCountryData(country)?.tollRoads.find(t => t.slug === slug);
            if (!road) return text(`Unknown toll road: ${slug}`);
            return json({
                openQuestions: road.analysis?.openQuestions ?? [],
                gaps: getDataGaps(road).map(g => ({ label: g.label, whyItMatters: g.whyItMatters, authority: g.departmentHint, rtiSubject: g.rtiSubject, rtiBody: g.rtiBody })),
                claimsToConfirm: (road.claims ?? []).map(c => ({ claimedBy: c.claimedBy, date: c.date, text: c.text })),
            });
        }
    );

    server.tool(
        'draft_rti',
        'Draft a Right to Information (RTI Act, 2005) application about an entity. Returns subject and body; file it at https://rtionline.gov.in for central authorities, or by post to the Public Information Officer for state ones.',
        { slug: z.string(), question: z.string().min(10), country: z.string().default('in') },
        async ({ slug, question, country }) => {
            const road = getCountryData(country)?.tollRoads.find(t => t.slug === slug);
            const name = road?.name ?? slug;
            const authority = road?.concession?.grantingAuthority ?? 'the relevant public authority';
            return json({
                authority,
                subject: `RTI Application - ${name}: ${question.slice(0, 80)}`,
                body: [
                    'To,', 'The Public Information Officer,', `[${authority}]`, '',
                    'Subject: Application under the Right to Information Act, 2005', '', 'Sir/Madam,', '',
                    `I request the following information regarding ${name}:`, '',
                    `1. ${question}`, '2. Copies of any documents, statements or audits containing this information', '',
                    'I am willing to pay the applicable fees as prescribed under the RTI Act.', '',
                    'Thanking you,', '[YOUR NAME]', '[YOUR ADDRESS]',
                ].join('\n'),
                afterwards: 'When you get a reply, contribute it with submit_contribution (source type "rti_response") so everyone can use it.',
            });
        }
    );

    server.tool(
        'submit_contribution',
        'Propose a sourced change to one record. It must pass the sourcing rules (every number needs sourceId + basis; every source needs a url and the date you read it as retrievedAt). If it passes, a pull request is opened against the data branch for human review; nothing is published until it is merged.',
        {
            entityType: z.enum(['toll_road', 'person', 'infrastructure', 'region']),
            entitySlug: z.string(),
            patch: z.record(z.unknown()).describe('Fields to add or replace, e.g. {"collections":[...]} or {"projectCost":{...}}'),
            sources: ContributionSchema.shape.sources,
            submitter: z.string().describe('Your name or handle, for attribution'),
            note: z.string().optional().describe('Context for the reviewer'),
            country: z.string().default('in'),
        },
        async args => {
            const c = ContributionSchema.parse(args);
            try {
                return json(await submitContribution(c, bundledFile(c.country, c.entityType, c.entitySlug)));
            } catch (e) {
                return text(`Could not open the pull request: ${(e as Error).message}`);
            }
        }
    );

    return server;
}
