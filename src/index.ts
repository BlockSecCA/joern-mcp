#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { JoernClient } from "./joern-client.js";
import { registerWorkspaceTools } from "./tools/workspace.js";
import { registerQueryTools } from "./tools/query.js";
import { registerSecurityTools } from "./tools/security.js";
import { registerNavigationTools } from "./tools/navigation.js";

export function createServer(client?: JoernClient): McpServer {
  const joern = client ?? new JoernClient();
  const server = new McpServer({
    name: "joern-mcp",
    version: "0.1.0",
  });

  registerWorkspaceTools(server, joern);
  registerQueryTools(server, joern);
  registerSecurityTools(server, joern);
  registerNavigationTools(server, joern);

  return server;
}

async function main(): Promise<void> {
  const server = createServer();
  await server.connect(new StdioServerTransport());
  console.error("[joern-mcp] Server running on stdio");
}

main().catch((err) => {
  console.error("[joern-mcp] Fatal:", err);
  process.exit(1);
});
