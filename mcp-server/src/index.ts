/**
 * FTW MCP Server
 *
 * Exposes the ForThisWorld public data corpus to any MCP client:
 * Claude Desktop, Cursor, GPT Researcher, the FTW Research Tool, etc.
 *
 * Read tools serve the corpus; submit_contribution writes ONLY to the
 * contributions review queue - nothing reaches published data without
 * passing machine validation + community review.
 *
 * Run: MONGODB_URI=... node dist/index.js   (stdio transport)
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { MongoClient } from "mongodb";
import { z } from "zod";
import { registerTools } from "./tools.js";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is required");
  process.exit(1);
}
const dbName = process.env.MONGODB_DB_NAME ?? "forthisworld";

const client = new MongoClient(uri);
await client.connect();
const db = client.db(dbName);

const server = new McpServer({
  name: "forthisworld",
  version: "0.1.0",
});

registerTools(server, db);

await server.connect(new StdioServerTransport());
console.error(`[ftw-mcp] connected to db '${dbName}', serving tools over stdio`);
