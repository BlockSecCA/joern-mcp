import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { JoernClient } from "../joern-client.js";
import * as cpgql from "../cpgql.js";

export function registerQueryTools(
  server: McpServer,
  client: JoernClient,
): void {
  server.registerTool("query", {
    description:
      "Run an arbitrary CPGQL query against the active CPG. This is the escape hatch for any query not covered by other tools. See https://docs.joern.io/cpgql/ for syntax.",
    inputSchema: {
      cpgql: z.string().describe("CPGQL query string to execute"),
    },
  }, async ({ cpgql: queryStr }) => {
    try {
      const result = await client.query(queryStr);
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

  server.registerTool("get_methods", {
    description:
      "List methods in the codebase. Returns name, full name, filename, and line number.",
    inputSchema: {
      filter: z
        .string()
        .optional()
        .describe(
          "Filter by method name (exact match). Omit to list all methods.",
        ),
    },
  }, async ({ filter }) => {
    try {
      const result = await client.query(cpgql.getMethods(filter));
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

  server.registerTool("get_calls", {
    description:
      "Find call sites in the codebase. Returns call name, target method, code, and line number.",
    inputSchema: {
      methodName: z
        .string()
        .optional()
        .describe(
          "Filter by called method name. Omit to list all call sites.",
        ),
    },
  }, async ({ methodName }) => {
    try {
      const result = await client.query(cpgql.getCalls(methodName));
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

  server.registerTool("get_types", {
    description:
      "List types/classes in the codebase. Returns name, full name, and filename.",
    inputSchema: {
      filter: z
        .string()
        .optional()
        .describe("Filter by type name. Omit to list all types."),
    },
  }, async ({ filter }) => {
    try {
      const result = await client.query(cpgql.getTypes(filter));
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
}
