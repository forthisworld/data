/**
 * FTW MCP tools.
 *
 * Design rules:
 * - Read tools read the published record (data/<country>/, see data/SOURCING.md).
 * - submit_contribution is the ONLY write: it goes to the site's /api/contributions,
 *   which validates it and opens a pull request against the data branch.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { loadCorpus, findBySlug, Doc } from "./corpus.js";

// Every number says where it comes from and how firm it is (data/SOURCING.md).
const Basis = z.enum(["court_finding", "audit_finding", "official_record", "company_filing", "reported", "claim"]);
const MoneyValue = z.object({
  value: z.number(),
  currency: z.string().default("INR"),
  note: z.string().optional(),
  sourceId: z.string(),
  basis: Basis,
  claimedBy: z.string().optional(),
});

const ESTABLISHED = new Set(["court_finding", "audit_finding", "official_record", "company_filing"]);
const established = (basis?: string) => ESTABLISHED.has(basis ?? "");

export function registerTools(server: McpServer) {
  // ---------------------------------------------------------
  server.tool(
    "search_entities",
    "Search the ForThisWorld corpus: regions, people, infrastructure, toll roads. Returns name, slug, type and short description.",
    {
      query: z.string().describe("Free-text search query"),
      type: z.enum(["any", "region", "person", "infrastructure", "toll_road"]).default("any"),
      limit: z.number().min(1).max(50).default(10),
    },
    async ({ query, type, limit }) => {
      const rx = new RegExp(escapeRegex(query), "i");
      const hit = (...fields: unknown[]) => fields.some((f) => typeof f === "string" && rx.test(f));
      const corpus = loadCorpus("in");
      const results: unknown[] = [];

      if (type === "any" || type === "toll_road") {
        for (const r of corpus.tollRoads) {
          if (hit(r.name, r.officialName, r.operatorCompany)) {
            results.push({ kind: "toll_road", slug: r.slug, name: r.name, officialName: r.officialName, operatorCompany: r.operatorCompany, tolling: r.tolling?.status });
          }
        }
      }
      if (type !== "toll_road") {
        for (const d of [...corpus.entities, ...corpus.regions]) {
          if ((type === "any" || d.type === type) && hit(d.name, d.description)) {
            results.push({ kind: d.type, id: d.id, slug: d.slug, name: d.name, description: d.description });
          }
        }
      }
      results.splice(limit);
      return text(JSON.stringify({ count: results.length, results }, null, 2));
    }
  );

  // ---------------------------------------------------------
  server.tool(
    "get_entity",
    "Get full structured data for one entity by slug - e.g. a toll road with its concession terms, collections, timeline, analysis, claims and cited sources. Each number carries a sourceId and a basis (court_finding, audit_finding, official_record, company_filing, reported, claim).",
    {
      country: z.enum(["in"]).default("in"),
      slug: z.string().describe("Entity slug, e.g. 'nice-bmic'"),
    },
    async ({ country, slug }) => {
      const corpus = loadCorpus(country);
      const found = findBySlug(corpus.tollRoads, slug) ?? findBySlug(corpus.entities, slug) ?? findBySlug(corpus.regions, slug);
      if (!found) return text(`Not found: ${slug}`);
      return text(JSON.stringify(found, null, 2));
    }
  );

  // ---------------------------------------------------------
  server.tool(
    "get_data_gaps",
    "List what is NOT yet known about a toll road - open questions that need research or RTI filings. This is where new contributions are most valuable.",
    {
      country: z.enum(["in"]).default("in"),
      slug: z.string(),
    },
    async ({ country, slug }) => {
      const road = findBySlug(loadCorpus(country).tollRoads, slug);
      if (!road) return text(`Unknown toll road: ${slug}`);

      const gaps: string[] = [...(road.analysis?.openQuestions ?? [])];
      if (!road.projectCost?.value || !established(road.projectCost.basis)) gaps.push("Audited project cost not established");
      const hasRevenue =
        (road.annualRevenue ?? []).some((r: Doc) => r.revenue?.value && established(r.revenue.basis)) ||
        (road.collections ?? []).some((c: Doc) => /toll/i.test(c.label) && established(c.amount?.basis));
      if (!hasRevenue) gaps.push("No established figure for toll collected (court, audit, official record or filing)");
      if (!road.concession?.scheduledEndDate && !road.concession?.tollEndCondition) gaps.push("Concession end condition not documented");
      const unquantified = (road.funding ?? []).filter((f: Doc) => !f.amount?.value);
      if (unquantified.length) gaps.push(`Unquantified funding components: ${unquantified.map((f: Doc) => f.label).join("; ")}`);
      const claims = (road.claims ?? []).map((c: Doc) => `Unconfirmed claim by ${c.claimedBy}: ${c.text}`);

      return text(JSON.stringify({ slug, gapCount: gaps.length, gaps, claimsToConfirm: claims }, null, 2));
    }
  );

  // ---------------------------------------------------------
  server.tool(
    "draft_rti",
    "Draft a Right to Information application (India) targeting the information gap on an entity. Returns subject + body ready to file.",
    {
      country: z.enum(["in"]).default("in"),
      slug: z.string(),
      question: z.string().describe("What you want to find out, e.g. 'cumulative toll revenue collected since 2005'"),
    },
    async ({ country, slug, question }) => {
      const road = findBySlug(loadCorpus(country).tollRoads, slug);
      const name = road?.name ?? slug;
      const authority = road?.concession?.grantingAuthority ?? "the relevant public authority";

      const subject = `RTI Application - ${name}: ${question.slice(0, 80)}`;
      const body = [
        "To,",
        "The Public Information Officer,",
        `[${authority}]`,
        "",
        "Subject: Application under the Right to Information Act, 2005",
        "",
        "Sir/Madam,",
        "",
        `I request the following information regarding ${name} (${road?.operatorCompany ?? "the operator"}):`,
        "",
        `1. ${question}`,
        "2. Copies of any documents, statements or audits containing this information",
        "3. The designated officials responsible for maintaining these records",
        "",
        "I am willing to pay the applicable fees as prescribed under the RTI Act.",
        "",
        "Thanking you,",
        "[YOUR NAME]",
        "[YOUR ADDRESS]",
        "[YOUR PHONE NUMBER]",
      ].join("\n");

      return text(JSON.stringify({ authoritySuggestion: authority, subject, body }, null, 2));
    }
  );

  // ---------------------------------------------------------
  server.tool(
    "submit_contribution",
    "Propose a sourced change to one record. It is checked against the sourcing rules (data/SOURCING.md) and, if it passes, opened as a pull request against the data branch for human review. Nothing is published until it is merged. Every number needs a sourceId and a basis; every source needs a url and the date you read it (retrievedAt).",
    {
      country: z.enum(["in"]).default("in"),
      entity_slug: z.string().describe("Slug of the entity this contribution applies to"),
      entity_type: z.enum(["toll_road", "person", "infrastructure", "region"]),
      patch_json: z.string().describe("JSON object of fields to add/update, e.g. {\"collections\":[...]}"),
      sources_json: z.string().describe("JSON array of sources: [{id,title,publisher,type,url,retrievedAt,date?,locator?}]"),
      submitter: z.string().describe("Your name or handle for attribution"),
      note: z.string().optional().describe("Why this change - context for reviewers"),
    },
    async ({ country, entity_slug, entity_type, patch_json, sources_json, submitter, note }) => {
      let patch: unknown;
      let sources: unknown;
      try {
        patch = JSON.parse(patch_json);
        sources = JSON.parse(sources_json);
      } catch (e) {
        return text(`Invalid JSON: ${String(e)}`);
      }
      // Contributions go through the site, which validates them and opens the PR.
      const site = (process.env.FTW_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
      try {
        const res = await fetch(`${site}/api/contributions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ country, entityType: entity_type, entitySlug: entity_slug, patch, sources, submitter, note }),
        });
        return text(JSON.stringify(await res.json(), null, 2));
      } catch (e) {
        return text(`Could not reach ${site}/api/contributions (${String(e)}). Set FTW_SITE_URL to the data.ftw site.`);
      }
    }
  );
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function text(t: string) {
  return { content: [{ type: "text" as const, text: t }] };
}
