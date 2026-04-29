import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, IncomingMessage, ServerResponse } from "http";
import { registerFileTools } from "./tools/file-tools.js";
import { registerJarvisTools } from "./tools/jarvis-tools.js";
import { registerLabDataTools } from "./tools/lab-data-tools.js";
import { registerReversalTools } from "./tools/reversal-tools.js";
import { registerMetaTools } from "./tools/meta-tools.js";
import { registerAiFeedbackTools } from "./tools/ai-feedback-tools.js";

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "dev-assistant-mcp-server",
    version: "1.0.0",
  });
  registerFileTools(server);
  registerJarvisTools(server);
  registerLabDataTools(server);
  registerReversalTools(server);
  registerMetaTools(server);
  registerAiFeedbackTools(server);
  return server;
}

const mode = process.env.MCP_MODE ?? "stdio";

if (mode === "http") {
  const PORT = Number(process.env.MCP_PORT ?? 3001);
  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res);
  });
  httpServer.listen(PORT, () => {
    console.error(`✅ dev-assistant-mcp-server started (HTTP, port ${PORT})`);
  });
} else {
  // stdio — Claude Code / local
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  server.connect(transport).then(() => {
    console.error("✅ dev-assistant-mcp-server started (stdio)");
  }).catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
