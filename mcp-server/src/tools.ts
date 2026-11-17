/**
 * FTW MCP tools.
 *
 * Design rules:
 * - Read tools hit published collections only (entities, regions, toll_roads, info_requests).
 * - submit_contribution is the ONLY write, and it lands in the `contributions`
 *   review queue with machine validation applied. Published data is untouchable.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Db } from "mongodb";
import { z } from "zod";

// Minimal TollRoad validation for contributions (subset of the platform schema -
// the authoritative zod schema lives in the research tool / platform).
const MoneyValue = z.object({
  value: z.number(),
  currency: z.string().default("INR"),
  note: z.string().optional(),
});

const SourceCitation = z.object({
  id: z.string(),
  title: z.string(),
  publisher: z.string(),
  url: z.string().optional(),
  date: z.string().optional(),
  type: z.string().optional(),
});

export function registerTools(server: McpServer, db: Db) {
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
      const results: unknown[] = [];

      if (type === "any" || type === "toll_road") {
        const roads = await db
          .collection("toll_roads")
          .find({ $or: [{ name: rx }, { officialName: rx }, { operatorCompany: rx }] })
          .limit(limit)
          .project({ _id: 0, slug: 1, name: 1, officialName: 1, operatorCompany: 1 })
          .toArray();
        roads.forEach((r) => results.push({ kind: "toll_road", ...r }));
      }
      if ((type === "any" || type !== "toll_road") && results.length < limit) {
        const filter: Record<string, unknown> = { $or: [{ name: rx }, { description: rx }] };
        if (type !== "any") filter.type = type;
        const docs = await db
          .collection("entities")
          .find(filter)
          .limit(limit - results.length)
          .project({ _id: 0, id: 1, slug: 1, name: 1, type: 1, description: 1 })
          .toArray();
        docs.forEach((d) => results.push(d));
      }

      return text(JSON.stringify({ count: results.length, results }, null, 2));
    }
  );

  // ---------------------------------------------------------
  server.tool(
    "get_entity",
    "Get full structured data for one entity by slug - e.g. a toll road with its concession terms, funding structure, revenue records, timeline, analysis and cited sources.",
    {
      country: z.enum(["in"]).default("in"),
      slug: z.string().describe("Entity slug, e.g. 'nice-bmic'"),
    },
    async ({ country, slug }) => {
      const road = await db.collection("toll_roads").findOne({ countryCode: country, slug });
      if (road) return text(JSON.stringify(road, null, 2));

      const entity =
        (await db.collection("entities").findOne({ countryCode: country, $or: [{ slug }, { id: slug }] })) ??
        (await db.collection("regions").findOne({ countryCode: country, slug }));
      if (!entity) return text(`Not found: ${slug}`);
      return text(JSON.stringify(entity, null, 2));
    }
  );

  // ---------------------------------------------------------
  server.tool(
    "get_data_gaps",
    "List what is NOT yet known about an entity - open questions that need research or RTI filings. This is where new contributions are most valuable.",
    {
      country: z.enum(["in"]).default("in"),
      slug: z.string(),
    },
    async ({ country, slug }) => {
      const road = await db.collection("toll_roads").findOne({ countryCode: country, slug });
      if (!road) return text(`Unknown toll road: ${slug}`);

      const gaps: string[] = [...(road.analysis?.openQuestions ?? [])];
      if (!road.projectCost?.value) gaps.push("Audited project cost not established");
      const hasReportedRevenue = (road.annualRevenue ?? []).some((r: { revenue?: { value?: number } }) => r.revenue?.value);
      if (!hasReportedRevenue) gaps.push("No official year-wise toll revenue figures");
      if (!road.concession?.scheduledEndDate && !road.concession?.tollEndCondition)
        gaps.push("Concession end condition not documented");
      const unquantified = ((road.funding ?? []) as { amount?: { value?: number }; label: string }[]).filter((f) => !f.amount?.value);
      if (unquantified.length) gaps.push(`Unquantified funding components: ${unquantified.map((f) => f.label).join("; ")}`);

      return text(JSON.stringify({ slug, gapCount: gaps.length, gaps }, null, 2));
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
      const road = await db.collection("toll_roads").findOne({ countryCode: country, slug });
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
    "Submit a proposed change to the corpus. Lands in the public review queue with automated validation - it does NOT modify published data directly. Every substantive claim must cite a source.",
    {
      country: z.enum(["in"]).default("in"),
      entity_slug: z.string().describe("Slug of the entity this contribution applies to"),
      entity_type: z.enum(["toll_road", "person", "infrastructure", "region"]),
      patch_json: z.string().describe("JSON object of fields to add/update, e.g. {\"annualRevenue\":[...]}"),
      sources_json: z.string().describe("JSON array of source citations supporting the change: [{id,title,publisher,url,date,type}]"),
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

      const issues: string[] = [];

      // Machine validation gate 1: shape
      if (entity_type === "toll_road") {
        const parsed = z.object({ annualRevenue: z.array(z.object({ year: z.union([z.number(), z.string()]), revenue: MoneyValue.optional(), trafficVehiclesPerDay: z.number().optional() })).optional() }).passthrough().safeParse(patch);
        if (!parsed.success) issues.push(...parsed.error.issues.map((i) => `patch.${i.path.join(".")}: ${i.message}`));
      }

      // Gate 2: sources required and resolvable-looking
      const srcArr = Array.isArray(sources) ? sources : [];
      if (srcArr.length === 0) issues.push("At least one source citation is required");
      for (const s of srcArr as { title?: string; url?: string }[]) {
        if (!s.title) issues.push("Each source needs a title");
        if (!s.url) issues.push(`Source '${s.title ?? "?"}' has no URL - claims without retrievable sources are rejected`);
      }

      // Gate 3: target entity must exist
      const target = await db.collection(entity_type === "toll_road" ? "toll_roads" : "entities").findOne({
        countryCode: country,
        $or: [{ slug: entity_slug }, { id: entity_slug }],
      });
      if (!target) issues.push(`Target entity '${entity_slug}' not found`);

      if (issues.length > 0) {
        return text(`REJECTED by automated validation:\n- ${issues.join("\n- ")}`);
      }

      const doc = {
        status: "pending",
        country,
        entityType: entity_type,
        entitySlug: entity_slug,
        patch,
        sources: srcArr,
        submitter,
        note: note ?? "",
        submittedAt: new Date(),
        checks: { schema: "pass", sourcesPresent: true, targetExists: true },
      };

      const res = await db.collection("contributions").insertOne(doc);
      return text(
        `Accepted into review queue: contribution ${res.insertedId}\n` +
          `Status: pending machine + community review.\n` +
          `Track it via get_contribution_status.`
      );
    }
  );

  // ---------------------------------------------------------
  server.tool(
    "get_contribution_status",
    "Check the review status of a submitted contribution.",
    {
      contribution_id: z.string(),
    },
    async ({ contribution_id }) => {
      const { ObjectId } = await import("mongodb");
      let id: InstanceType<typeof ObjectId>;
      try {
        id = new ObjectId(contribution_id);
      } catch {
        return text("Invalid contribution id");
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c = await db.collection("contributions").findOne({ _id: id } as any);
      if (!c) return text("Not found");
      return text(JSON.stringify(c, null, 2));
    }
  );
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function text(t: string) {
  return { content: [{ type: "text" as const, text: t }] };
}
