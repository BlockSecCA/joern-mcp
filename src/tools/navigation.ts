import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { JoernClient } from "../joern-client.js";
import * as cpgql from "../cpgql.js";

export function registerNavigationTools(
  server: McpServer,
  client: JoernClient,
): void {
  server.registerTool("get_source", {
    description:
      "Read the source code of a specific method/function by name.",
    inputSchema: {
      methodName: z.string().describe("Name of the method to get source for"),
    },
  }, async ({ methodName }) => {
    try {
      const result = await client.query(cpgql.getSource(methodName));
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

  server.registerTool("get_callers", {
    description:
      "Find all methods that call the specified method. Returns caller name, full name, and filename.",
    inputSchema: {
      methodName: z
        .string()
        .describe("Name of the method to find callers for"),
    },
  }, async ({ methodName }) => {
    try {
      const result = await client.query(cpgql.getCallers(methodName));
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

  server.registerTool("get_callees", {
    description:
      "Find all methods called by the specified method. Returns callee name, full name, and filename.",
    inputSchema: {
      methodName: z
        .string()
        .describe("Name of the method to find callees for"),
    },
  }, async ({ methodName }) => {
    try {
      const result = await client.query(cpgql.getCallees(methodName));
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

  server.registerTool("get_parameters", {
    description:
      "Get parameter types and names for a method. Returns parameter name, type, and index.",
    inputSchema: {
      methodName: z
        .string()
        .describe("Name of the method to get parameters for"),
    },
  }, async ({ methodName }) => {
    try {
      const result = await client.query(cpgql.getParameters(methodName));
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
