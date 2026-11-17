import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createMcpServer } from '@/lib/mcp/server';

/**
 * MCP over Streamable HTTP, stateless: each request gets a fresh server and
 * transport. Connect any MCP client to https://<site>/api/mcp
 */
async function handle(req: Request): Promise<Response> {
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    const server = createMcpServer();
    await server.connect(transport);
    return transport.handleRequest(req);
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
