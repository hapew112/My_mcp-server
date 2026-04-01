import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerFileTools } from "./tools/file-tools.js";
import { registerJarvisTools } from "./tools/jarvis-tools.js";
import { registerLabDataTools } from "./tools/lab-data-tools.js";
import { registerReversalTools } from "./tools/reversal-tools.js";
import { registerMetaTools } from "./tools/meta-tools.js";

const server = new McpServer({
  name: "dev-assistant-mcp-server",
  version: "1.0.0",
});

// 도구 등록
registerFileTools(server);
registerJarvisTools(server);
registerLabDataTools(server);
registerReversalTools(server);
registerMetaTools(server);

// stdio 전송 (Claude Desktop + Claude Code 둘 다 호환)
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("✅ dev-assistant-mcp-server started (stdio)");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
