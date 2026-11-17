/**
 * FTW MCP Server
 *
 * Exposes the ForThisWorld public data corpus to any MCP client:
 * Claude Desktop, Cursor, GPT Researcher, the FTW Research Tool, etc.
 *
 * Read tools serve the published record (data/ in the data.ftw repo);
 * submit_contribution writes ONLY to the review queue (data/_contributions/).
 * Nothing reaches published data without machine validation + human review.
 *
 * Run: node dist/index.js   (stdio transport)
 *      DATA_DIR=/path/to/data.ftw/data node dist/index.js   (if run from elsewhere)
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { DATA_DIR, loadCorpus } from "./corpus.js";
import { registerTools } from "./tools.js";

// Fail fast if the data folder is missing or unreadable.
loadCorpus("in");

const server = new McpServer({
  name: "forthisworld",
  version: "0.2.0",
});

registerTools(server);

await server.connect(new StdioServerTransport());
console.error(`[ftw-mcp] serving the published record from ${DATA_DIR} over stdio`);
