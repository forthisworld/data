/**
 * Contributions become pull requests against the `data` branch (or `main`
 * until `data` exists). Nothing is published until a reviewer merges the PR.
 *
 * Flow: read the current file from GitHub -> apply the patch -> validate the
 * result against data/SOURCING.md -> branch, commit, open a PR.
 *
 * Needs a GitHub token with contents + pull-request write access to the repo:
 *   GITHUB_CONTRIB_TOKEN   (required to open PRs)
 *   GITHUB_CONTRIB_REPO    default "forthisworld/data"
 *   GITHUB_CONTRIB_BASE    default "data" (falls back to "main" if it doesn't exist)
 * Without a token, contributions are validated and the caller is told how to
 * open the PR by hand.
 */

import type { Entity, SourceCitation, TollRoad } from '@/types';
import { z } from 'zod';
import { validateEntity, validateRoad } from '@/lib/data/validate';
import { getCountryData, findEntity } from '@/lib/data/store';

export type EntityKind = 'toll_road' | 'person' | 'infrastructure' | 'region';

export interface Contribution {
    country: string;
    entityType: EntityKind;
    entitySlug: string;
    /** Fields to add or replace on the record. */
    patch: Record<string, unknown>;
    /** Sources the change rests on; merged into the record's sources by id. */
    sources: SourceCitation[];
    submitter: string;
    note?: string;
}

export type ContributionResult =
    | { status: 'rejected'; errors: string[] }
    | { status: 'pr_opened'; url: string; branch: string; base: string }
    | { status: 'validated_only'; path: string; message: string };

const PROTECTED = new Set(['id', 'slug', 'type']);

function filePath(c: Contribution): string {
    switch (c.entityType) {
        case 'toll_road': return `data/${c.country}/toll-roads/${c.entitySlug}.json`;
        case 'person': return `data/${c.country}/entities/persons.json`;
        case 'infrastructure': return `data/${c.country}/entities/infrastructure.json`;
        case 'region': return `data/${c.country}/regions/states.json`;
    }
}

/** Apply the patch to the file's JSON. Returns the new JSON and the validation errors. */
export function applyContribution(fileJson: unknown, c: Contribution): { json: unknown; errors: string[] } {
    const errors: string[] = [];
    const bad = Object.keys(c.patch).filter(k => PROTECTED.has(k));
    if (bad.length) errors.push(`Cannot change ${bad.join(', ')}`);
    if (!c.sources.length) errors.push('At least one source is required');
    if (!c.submitter?.trim()) errors.push('submitter is required (name or handle, for attribution)');

    const merge = <T extends { sources?: SourceCitation[] }>(rec: T): T => {
        const sources = [...(rec.sources ?? [])];
        for (const s of c.sources) {
            const i = sources.findIndex(x => x.id === s.id);
            if (i >= 0) sources[i] = s; else sources.push(s);
        }
        return { ...rec, ...c.patch, sources, lastVerified: new Date().toISOString().slice(0, 10) };
    };

    if (c.entityType === 'toll_road') {
        const road = merge(fileJson as TollRoad);
        errors.push(...validateRoad(road as TollRoad));
        return { json: road, errors };
    }
    const list = fileJson as (Entity & Record<string, unknown>)[];
    const i = Array.isArray(list) ? list.findIndex(e => e.slug === c.entitySlug || e.id === c.entitySlug) : -1;
    if (i < 0) return { json: fileJson, errors: [...errors, `No ${c.entityType} '${c.entitySlug}' in ${filePath(c)}`] };
    const next = [...list];
    next[i] = merge(list[i]);
    errors.push(...validateEntity(next[i]).map(e => `${c.entitySlug}: ${e}`));
    return { json: next, errors };
}

// --- GitHub ---------------------------------------------------------------

const API = 'https://api.github.com';

async function gh<T>(token: string, method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${API}${path}`, {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'data.ftw-contributions',
            ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`GitHub ${method} ${path}: ${res.status} ${(await res.text()).slice(0, 200)}`);
    return (await res.json()) as T;
}

const b64 = {
    encode: (s: string) => Buffer.from(s, 'utf-8').toString('base64'),
    decode: (s: string) => Buffer.from(s, 'base64').toString('utf-8'),
};

export async function submitContribution(c: Contribution, fallbackJson?: unknown): Promise<ContributionResult> {
    const path = filePath(c);
    const token = process.env.GITHUB_CONTRIB_TOKEN;
    const repo = process.env.GITHUB_CONTRIB_REPO ?? 'forthisworld/data';

    if (!token) {
        // No token: validate against the bundled record and explain how to open the PR by hand.
        if (fallbackJson === undefined) return { status: 'rejected', errors: [`Unknown ${c.entityType} '${c.entitySlug}'`] };
        const { errors } = applyContribution(fallbackJson, c);
        if (errors.length) return { status: 'rejected', errors };
        return {
            status: 'validated_only',
            path,
            message:
                `Your change passes the sourcing checks, but this server isn't set up to open pull requests. ` +
                `Edit ${path} on GitHub (https://github.com/${repo}/edit/data/${path}) with this change and open a PR against the "data" branch.`,
        };
    }

    // Base branch: "data", or "main" until "data" exists.
    let base = process.env.GITHUB_CONTRIB_BASE ?? 'data';
    let baseSha: string;
    try {
        baseSha = (await gh<{ object: { sha: string } }>(token, 'GET', `/repos/${repo}/git/ref/heads/${base}`)).object.sha;
    } catch {
        base = 'main';
        baseSha = (await gh<{ object: { sha: string } }>(token, 'GET', `/repos/${repo}/git/ref/heads/${base}`)).object.sha;
    }

    // Apply to the file as it is on the base branch now, not the bundled copy.
    const file = await gh<{ content: string; sha: string }>(token, 'GET', `/repos/${repo}/contents/${path}?ref=${base}`);
    const { json, errors } = applyContribution(JSON.parse(b64.decode(file.content)), c);
    if (errors.length) return { status: 'rejected', errors };

    const branch = `contrib/${c.entitySlug}-${Date.now().toString(36)}`;
    await gh(token, 'POST', `/repos/${repo}/git/refs`, { ref: `refs/heads/${branch}`, sha: baseSha });
    const fields = Object.keys(c.patch).join(', ') || 'sources';
    await gh(token, 'PUT', `/repos/${repo}/contents/${path}`, {
        message: `data(${c.entitySlug}): update ${fields}\n\nContributed by ${c.submitter} via data.ftw.`,
        content: b64.encode(JSON.stringify(json, null, 4) + '\n'),
        sha: file.sha,
        branch,
    });
    const pr = await gh<{ html_url: string }>(token, 'POST', `/repos/${repo}/pulls`, {
        title: `Data: ${c.entitySlug}: ${fields}`,
        head: branch,
        base,
        body: [
            `Contributed by **${c.submitter}** through data.ftw.`,
            c.note ? `\n> ${c.note}` : '',
            '\n**Sources**',
            ...c.sources.map(s => `- [${s.id}] ${s.title} (${s.publisher})${s.url ? ` ${s.url}` : ''}${s.retrievedAt ? `, read ${s.retrievedAt}` : ''}`),
            '\nPassed the automated sourcing checks (data/SOURCING.md). A reviewer must confirm each fact against its source before merging.',
        ].join('\n'),
    });
    return { status: 'pr_opened', url: pr.html_url, branch, base };
}

// --- Input schema and bundled lookup (shared by the REST and MCP endpoints) ---

export const ContributionSchema = z.object({
    country: z.string().default('in'),
    entityType: z.enum(['toll_road', 'person', 'infrastructure', 'region']),
    entitySlug: z.string().min(1),
    patch: z.record(z.unknown()),
    sources: z.array(z.object({
        id: z.string(), title: z.string(), publisher: z.string(),
        type: z.enum(['gazette', 'concession_agreement', 'court_order', 'audit_report', 'legislative_record', 'statistics', 'rti_response', 'annual_report', 'company_filing', 'government_portal', 'news']),
        url: z.string().url(), retrievedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        date: z.string().optional(), note: z.string().optional(), locator: z.string().optional(),
    }).passthrough()).min(1),
    submitter: z.string().min(1).max(100),
    note: z.string().max(2000).optional(),
});

/** The bundled record the contribution targets (used when no GitHub token is configured). */
export function bundledFile(country: string, entityType: string, slug: string): unknown {
    const d = getCountryData(country);
    if (!d) return undefined;
    switch (entityType) {
        case 'toll_road': return d.tollRoads.find(t => t.slug === slug);
        case 'person': return findEntity(d.persons, slug) ? d.persons : undefined;
        case 'infrastructure': return findEntity(d.infrastructure, slug) ? d.infrastructure : undefined;
        case 'region': return findEntity(d.regions, slug) ? d.regions : undefined;
    }
}

