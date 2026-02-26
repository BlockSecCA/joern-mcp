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
      "Scan the active CPG for common vulnerability patterns. Returns categorized findings: dangerous function calls, SQL construction, hardcoded credentials, unsafe deserialization, path traversal indicators, and debug exposure. Use as a reconnaissance step, then investigate specific findings with taint_analysis.",
    inputSchema: {
      categories: z
        .array(z.enum(cpgql.VULN_CATEGORY_KEYS as [string, ...string[]]))
        .optional()
        .describe(
          `Vulnerability categories to check. Omit to run all. Options: ${cpgql.VULN_CATEGORY_KEYS.join(", ")}`,
        ),
    },
  }, async ({ categories }) => {
    const checks = cpgql.findVulnerabilities(categories);
    const sections: string[] = [];
    let totalFindings = 0;

    for (const check of checks) {
      try {
        const result = await client.query(check.query, config.queryTimeout);
        const output = result.parsed.trim();
        const isEmpty = !output || output === "List()" || output === "empty iterator";
        if (isEmpty) {
          sections.push(`## ${check.label}\nNo findings.`);
        } else {
          const count = (output.match(/\(/g) ?? []).length;
          totalFindings += count;
          sections.push(`## ${check.label} (${count} finding${count === 1 ? "" : "s"})\n${output}`);
        }
      } catch (err: unknown) {
        sections.push(`## ${check.label}\nError: ${String(err)}`);
      }
    }

    sections.push(
      `\n## Summary\n${totalFindings} potential issue${totalFindings === 1 ? "" : "s"} found across ${checks.length} categor${checks.length === 1 ? "y" : "ies"}.${
        totalFindings > 0
          ? "\nUse taint_analysis to trace data flow for specific findings."
          : ""
      }`,
    );

    return {
      content: [{ type: "text" as const, text: sections.join("\n\n") }],
    };
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
