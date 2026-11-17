/**
 * Shared HTTP utilities for scrapers.
 * Dependency-free (Node 18+ global fetch). Run with tsx.
 */

const DEFAULT_UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 data.ftw-research-bot/0.1';

export interface FetchOptions {
    timeoutMs?: number;
    retries?: number;
    retryDelayMs?: number;
    headers?: Record<string, string>;
}

export async function fetchText(url: string, opts: FetchOptions = {}): Promise<string> {
    const { timeoutMs = 30000, retries = 3, retryDelayMs = 2000, headers = {} } = opts;

    let lastError: unknown;
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const res = await fetch(url, {
                    signal: controller.signal,
                    headers: { 'User-Agent': DEFAULT_UA, Accept: 'text/html,application/json,*/*', ...headers },
                });
                if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
                return await res.text();
            } finally {
                clearTimeout(timer);
            }
        } catch (err) {
            lastError = err;
            console.warn(`  [http] attempt ${attempt}/${retries} failed for ${url}: ${(err as Error).message}`);
            if (attempt < retries) await sleep(retryDelayMs * attempt);
        }
    }
    throw lastError;
}

export async function fetchJson<T = unknown>(url: string, opts: FetchOptions = {}): Promise<T> {
    const text = await fetchText(url, opts);
    return JSON.parse(text) as T;
}

export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extract all HTML tables from a page as string matrices.
 * Good enough for the simple ASP.NET tables used by government portals.
 */
export function extractTables(html: string): string[][][] {
    const tables: string[][][] = [];
    const tableRe = /<table[\s\S]*?<\/table>/gi;
    const rowRe = /<tr[\s\S]*?<\/tr>/gi;
    const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;

    for (const table of html.match(tableRe) ?? []) {
        const rows: string[][] = [];
        for (const row of table.match(rowRe) ?? []) {
            const cells: string[] = [];
            for (const cellMatch of row.matchAll(cellRe)) {
                cells.push(stripHtml(cellMatch[1]));
            }
            if (cells.length > 0) rows.push(cells);
        }
        if (rows.length > 0) tables.push(rows);
    }
    return tables;
}

export function stripHtml(html: string): string {
    return html
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&#\d+;/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}
