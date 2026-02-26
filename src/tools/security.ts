import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { JoernClient } from "../joern-client.js";
import * as cpgql from "../cpgql.js";
import { config } from "../config.js";

export function registerSecurityTools(
  server: McpServer,
  client: JoernClient,
): void {
  server.registerTool("find_vulnerabilities", {
    description:
      "Run default vulnerability detection queries against the active CPG. Executes OSS dataflow analysis and returns findings.",
  }, async () => {
    try {
      const result = await client.query(
        cpgql.findVulnerabilities(),
        config.importTimeout,
      );
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

  server.registerTool("taint_analysis", {
    description:
      'Trace data flow from source to sink. Source and sink are CPGQL expressions relative to `cpg.` — for example: source="method.name(\\"gets\\").parameter", sink="method.name(\\"strcpy\\").parameter". Returns the full flow path.',
    inputSchema: {
      source: z
        .string()
        .describe(
          'CPGQL expression for taint source (relative to cpg.), e.g. method.name("gets").parameter',
        ),
      sink: z
        .string()
        .describe(
          'CPGQL expression for taint sink (relative to cpg.), e.g. method.name("strcpy").parameter',
        ),
    },
  }, async ({ source, sink }) => {
    try {
      const result = await client.query(
        cpgql.taintAnalysis(source, sink),
        config.importTimeout,
      );
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

  server.registerTool("reachable_by", {
    description:
      "Check if a sink is reachable from a source. Returns the reachable methods. Source and sink are CPGQL expressions relative to `cpg.`.",
    inputSchema: {
      source: z
        .string()
        .describe("CPGQL expression for source (relative to cpg.)"),
      sink: z
        .string()
        .describe("CPGQL expression for sink (relative to cpg.)"),
    },
  }, async ({ source, sink }) => {
    try {
      const result = await client.query(
        cpgql.reachableBy(source, sink),
        config.importTimeout,
      );
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

  server.registerTool("get_data_flows", {
    description:
      "Get all data flow paths between a source and a sink. Returns detailed flow information. Source and sink are CPGQL expressions relative to `cpg.`.",
    inputSchema: {
      source: z
        .string()
        .describe("CPGQL expression for source (relative to cpg.)"),
      sink: z
        .string()
        .describe("CPGQL expression for sink (relative to cpg.)"),
    },
  }, async ({ source, sink }) => {
    try {
      const result = await client.query(
        cpgql.getDataFlows(source, sink),
        config.importTimeout,
      );
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
