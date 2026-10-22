#!/usr/bin/env node
// The agentcut MCP server: the tools the chat agent (Claude Code or Codex) uses to work with
// the studio page. The helper writes it into the workspace's .agentcut/mcp.json; agents start it.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ensureBridge } from "./bridge.js";
import { PACKAGE_VERSION } from "./config.js";
import { debugLog } from "./log.js";
import { registerStudioTools } from "./studio/tools.js";

async function main() {
  const server = new McpServer({
    name: "agentcut",
    version: PACKAGE_VERSION,
  });

  registerStudioTools(server);

  void ensureBridge().catch((error) => {
    debugLog(`background bridge startup failed ${error instanceof Error ? error.message : String(error)}`);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

process.on("SIGINT", () => {
  debugLog("mcp received SIGINT");
  process.exit(0);
});

process.on("SIGTERM", () => {
  debugLog("mcp received SIGTERM");
  process.exit(0);
});

main().catch((error) => {
  debugLog(`fatal startup error ${error instanceof Error ? error.message : String(error)}`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
