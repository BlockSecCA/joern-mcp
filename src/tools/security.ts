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
      `Trace data flow from source to sink. Returns the full flow path including intermediate steps.

Source and sink are CPGQL expressions relative to \`cpg.\`. Use BROAD expressions — let Joern's dataflow engine do the precision work. Overly specific expressions are the #1 cause of empty results.

Examples:
- SQL injection (JS): source='call.code(".*req\\\\.(query|params|body).*")', sink='call.name("query").where(_.code(".*sequelize.*"))'
- Command injection (Python): source='call.name("input")', sink='call.name("exec|system|popen")'
- Buffer overflow (C): source='method.name("gets").parameter', sink='method.name("strcpy").parameter'
- XSS (Java): source='call.name("getParameter")', sink='call.name("println|write|print")'

Key rules:
- .name() matches function/method names with Java regex. Use .code() to match full code text.
- Always test source and sink independently with the query tool first (e.g. query "cpg.call.code(\\".*req.query.*\\").l.size") to verify they match nodes before combining.
- Template literals and string interpolation are NOT separate arguments in the CPG — use .code(".*pattern.*") to match them, not .argument.order(N).code().
- Prefer broad source expressions (all req.query accesses) over narrow ones (specific variable names).`,
    inputSchema: {
      source: z
        .string()
        .describe(
          'CPGQL expression for taint source (relative to cpg.). Examples: call.code(".*req\\.query.*"), method.name("getParameter").parameter, call.name("input|gets|read")',
        ),
      sink: z
        .string()
        .describe(
          'CPGQL expression for taint sink (relative to cpg.). Examples: call.name("query").where(_.code(".*sequelize.*")), call.name("exec|system|eval"), call.name("strcpy").parameter',
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
      "Check if a sink is reachable from a source. Returns the reachable methods (name and fullName). Lighter than taint_analysis — use this to quickly check connectivity before requesting full flow paths. Same source/sink expression syntax as taint_analysis.",
    inputSchema: {
      source: z
        .string()
        .describe(
          'CPGQL expression for taint source (relative to cpg.). Examples: call.code(".*req\\.query.*"), method.name("main").parameter',
        ),
      sink: z
        .string()
        .describe(
          'CPGQL expression for taint sink (relative to cpg.). Examples: call.name("query|exec|eval"), call.name("strcpy").parameter',
        ),
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
      "Get all data flow paths between a source and a sink. Returns detailed flow information with intermediate steps. Functionally identical to taint_analysis — same source/sink expression syntax.",
    inputSchema: {
      source: z
        .string()
        .describe(
          'CPGQL expression for taint source (relative to cpg.). Examples: call.code(".*req\\.query.*"), method.name("main").parameter',
        ),
      sink: z
        .string()
        .describe(
          'CPGQL expression for taint sink (relative to cpg.). Examples: call.name("query|exec|eval"), call.name("strcpy").parameter',
        ),
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
