/**
 * Read-only access to the published record (data/<country>/ in the data.ftw
 * repo). DATA_DIR points at the repo's data/ folder; by default it is ../data
 * relative to the mcp-server folder.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = resolve(process.env.DATA_DIR ?? join(here, "..", "..", "data"));

// Loose shapes: the authoritative types live in the site (src/types/index.ts).
export type Doc = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface Corpus {
  tollRoads: Doc[];
  entities: Doc[]; // persons + infrastructure
  regions: Doc[];
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function jsonFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    if (name.startsWith("_")) return [];
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return jsonFiles(p);
    return name.endsWith(".json") ? [p] : [];
  });
}

/** Load a country's published record. Re-read on every call so edits show up without a restart. */
export function loadCorpus(country: string): Corpus {
  const root = join(DATA_DIR, country);
  if (!existsSync(join(root, "config.json"))) throw new Error(`No published data for country '${country}' in ${DATA_DIR}`);
  const corpus: Corpus = { tollRoads: [], entities: [], regions: [] };
  for (const f of jsonFiles(join(root, "toll-roads"))) corpus.tollRoads.push(readJson(f) as Doc);
  for (const f of jsonFiles(join(root, "entities"))) {
    const arr = readJson(f);
    if (Array.isArray(arr)) corpus.entities.push(...(arr as Doc[]));
  }
  for (const f of jsonFiles(join(root, "regions"))) {
    const arr = readJson(f);
    if (Array.isArray(arr)) corpus.regions.push(...(arr as Doc[]));
  }
  return corpus;
}

export function findBySlug(list: Doc[], slug: string): Doc | undefined {
  return list.find((d) => d.slug === slug || d.id === slug);
}
