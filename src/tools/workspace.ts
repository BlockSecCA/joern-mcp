import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { JoernClient } from "../joern-client.js";
import * as cpgql from "../cpgql.js";
import { config } from "../config.js";

export function registerWorkspaceTools(
  server: McpServer,
  client: JoernClient,
): void {
  server.registerTool("check_connection", {
    description:
      "Check if Joern server is reachable. Returns server status. Use this before starting analysis.",
  }, async () => {
    const healthy = await client.healthCheck();
    if (healthy) {
      return {
        content: [{
          type: "text" as const,
          text: `Joern server is reachable at ${config.host}:${config.port}`,
        }],
      };
    }
    return {
      content: [{
        type: "text" as const,
        text: `Joern server is not reachable at ${config.host}:${config.port}. Make sure Joern is running: joern --server`,
      }],
      isError: true,
    };
  });

  server.registerTool("import_code", {
    description:
      "Import a codebase into Joern for analysis. Builds the Code Property Graph (CPG). This is slow (minutes for large projects).",
    inputSchema: {
      path: z.string().describe("Absolute path to the codebase directory"),
      projectName: z.string().describe("Name for the Joern project"),
    },
  }, async ({ path, projectName }) => {
    try {
      const result = await client.query(
        cpgql.importCode(path, projectName),
        config.importTimeout,
      );
      return {
        content: [
          {
            type: "text" as const,
            text: `Project "${projectName}" imported from ${path}.\n${result.parsed}`,
          },
        ],
      };
    } catch (err: unknown) {
      return {
        content: [{ type: "text" as const, text: String(err) }],
        isError: true,
      };
    }
  });

  server.registerTool("list_projects", {
    description: "List all projects in the Joern workspace.",
  }, async () => {
    try {
      const result = await client.query(cpgql.listProjects());
      return {
        content: [{ type: "text" as const, text: result.parsed }],
      };
    } catch (err: unknown) {
      return {
        content: [{ type: "text" as const, text: String(err) }],
        isError: true,
      };
    }
  });

  server.registerTool("switch_project", {
    description: "Set the active project in Joern workspace.",
    inputSchema: {
      name: z.string().describe("Name of the project to activate"),
    },
  }, async ({ name }) => {
    try {
      const result = await client.query(cpgql.switchProject(name));
      return {
        content: [
          {
            type: "text" as const,
            text: `Switched to project "${name}".\n${result.parsed}`,
          },
        ],
      };
    } catch (err: unknown) {
      return {
        content: [{ type: "text" as const, text: String(err) }],
        isError: true,
      };
    }
  });

  server.registerTool("close_project", {
    description:
      "Unload a CPG from memory (keeps on disk). Frees JVM memory.",
    inputSchema: {
      name: z.string().describe("Name of the project to close"),
    },
  }, async ({ name }) => {
    try {
      const result = await client.query(cpgql.closeProject(name));
      return {
        content: [
          {
            type: "text" as const,
            text: `Project "${name}" closed.\n${result.parsed}`,
          },
        ],
      };
    } catch (err: unknown) {
      return {
        content: [{ type: "text" as const, text: String(err) }],
        isError: true,
      };
    }
  });
}
