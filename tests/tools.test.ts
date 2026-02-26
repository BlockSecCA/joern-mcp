import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/index.js";
import type { JoernClient, QueryResult } from "../src/joern-client.js";
import {
  JoernConnectionError,
  JoernQueryError,
  JoernTimeoutError,
} from "../src/errors.js";

function mockClient(
  queryFn?: (cpgql: string, timeout?: number) => Promise<QueryResult>,
): JoernClient {
  const defaultQuery = vi
    .fn<(cpgql: string, timeout?: number) => Promise<QueryResult>>()
    .mockResolvedValue({
      raw: 'val res0: String = "ok"',
      parsed: "ok",
      uuid: "mock-uuid",
    });

  return {
    query: queryFn ? vi.fn(queryFn) : defaultQuery,
    healthCheck: vi.fn().mockResolvedValue(true),
  } as unknown as JoernClient;
}

async function setup(client?: JoernClient) {
  const mock = client ?? mockClient();
  const server = createServer(mock);
  const mcpClient = new Client({ name: "test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await Promise.all([
    mcpClient.connect(clientTransport),
    server.server.connect(serverTransport),
  ]);
  return { mcpClient, mock, server };
}

describe("tool discovery", () => {
  it("lists all 19 tools", async () => {
    const { mcpClient } = await setup();
    const { tools } = await mcpClient.listTools();

    expect(tools).toHaveLength(19);

    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([
      "check_connection",
      "close_project",
      "find_vulnerabilities",
      "get_base_classes",
      "get_callees",
      "get_callers",
      "get_calls",
      "get_data_flows",
      "get_derived_classes",
      "get_methods",
      "get_parameters",
      "get_source",
      "get_types",
      "import_code",
      "list_projects",
      "query",
      "reachable_by",
      "switch_project",
      "taint_analysis",
    ]);
  });

  it("tools have descriptions", async () => {
    const { mcpClient } = await setup();
    const { tools } = await mcpClient.listTools();

    for (const tool of tools) {
      expect(tool.description).toBeTruthy();
    }
  });
});

describe("query tool", () => {
  it("passes CPGQL to client and returns result", async () => {
    const { mcpClient, mock } = await setup();
    const result = await mcpClient.callTool({
      name: "query",
      arguments: { cpgql: "cpg.method.name.l" },
    });

    expect(mock.query).toHaveBeenCalledWith("cpg.method.name.l");
    expect(result.content).toEqual([{ type: "text", text: "ok" }]);
  });
});

describe("workspace tools", () => {
  it("import_code sends importCode CPGQL with import timeout", async () => {
    const { mcpClient, mock } = await setup();
    await mcpClient.callTool({
      name: "import_code",
      arguments: { path: "/tmp/repo", projectName: "test" },
    });

    expect(mock.query).toHaveBeenCalledWith(
      'importCode("/tmp/repo", "test")',
      expect.any(Number),
    );
  });

  it("list_projects sends workspace query", async () => {
    const { mcpClient, mock } = await setup();
    await mcpClient.callTool({ name: "list_projects", arguments: {} });

    expect(mock.query).toHaveBeenCalledWith("workspace.getProjectNames");
  });

  it("switch_project sends setActiveProject", async () => {
    const { mcpClient, mock } = await setup();
    await mcpClient.callTool({
      name: "switch_project",
      arguments: { name: "myproj" },
    });

    expect(mock.query).toHaveBeenCalledWith(
      'workspace.setActiveProject("myproj")',
    );
  });

  it("close_project sends closeProject", async () => {
    const { mcpClient, mock } = await setup();
    await mcpClient.callTool({
      name: "close_project",
      arguments: { name: "myproj" },
    });

    expect(mock.query).toHaveBeenCalledWith(
      'workspace.closeProject("myproj")',
    );
  });
});

describe("navigation tools", () => {
  it("get_source queries method code", async () => {
    const { mcpClient, mock } = await setup();
    await mcpClient.callTool({
      name: "get_source",
      arguments: { methodName: "main" },
    });

    expect(mock.query).toHaveBeenCalledWith('cpg.method.name("main").code.l');
  });

  it("get_callers queries caller chain", async () => {
    const { mcpClient, mock } = await setup();
    await mcpClient.callTool({
      name: "get_callers",
      arguments: { methodName: "validate" },
    });

    const query = (mock.query as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(query).toContain('.name("validate").caller');
  });

  it("get_callees queries callee chain", async () => {
    const { mcpClient, mock } = await setup();
    await mcpClient.callTool({
      name: "get_callees",
      arguments: { methodName: "main" },
    });

    const query = (mock.query as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(query).toContain('.name("main").callee');
  });

  it("get_parameters queries method parameters", async () => {
    const { mcpClient, mock } = await setup();
    await mcpClient.callTool({
      name: "get_parameters",
      arguments: { methodName: "process" },
    });

    const query = (mock.query as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(query).toContain('.name("process").parameter');
  });
});

describe("class hierarchy tools", () => {
  it("get_base_classes queries base type declarations", async () => {
    const { mcpClient, mock } = await setup();
    await mcpClient.callTool({
      name: "get_base_classes",
      arguments: { className: "HttpServlet" },
    });

    const query = (mock.query as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(query).toContain('.name("HttpServlet").baseTypeDecl');
  });

  it("get_derived_classes queries derived type declarations", async () => {
    const { mcpClient, mock } = await setup();
    await mcpClient.callTool({
      name: "get_derived_classes",
      arguments: { className: "Sanitizer" },
    });

    const query = (mock.query as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(query).toContain('.name("Sanitizer").derivedTypeDecl');
  });
});

describe("connection tools", () => {
  it("check_connection returns success when healthy", async () => {
    const { mcpClient } = await setup();
    const result = await mcpClient.callTool({
      name: "check_connection",
      arguments: {},
    });

    expect(result.isError).toBeFalsy();
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("reachable");
  });

  it("check_connection returns error when unhealthy", async () => {
    const client = mockClient();
    (client.healthCheck as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    const { mcpClient } = await setup(client);

    const result = await mcpClient.callTool({
      name: "check_connection",
      arguments: {},
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("not reachable");
    expect(text).toContain("joern --server");
  });
});

describe("security tools", () => {
  it("taint_analysis constructs source/sink flow", async () => {
    const { mcpClient, mock } = await setup();
    await mcpClient.callTool({
      name: "taint_analysis",
      arguments: {
        source: 'method.name("gets").parameter',
        sink: 'method.name("strcpy").parameter',
      },
    });

    const query = (mock.query as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(query).toContain("val source = cpg.method.name");
    expect(query).toContain("sink.reachableByFlows(source).p");
  });

  it("find_vulnerabilities runs with import timeout", async () => {
    const { mcpClient, mock } = await setup();
    await mcpClient.callTool({
      name: "find_vulnerabilities",
      arguments: {},
    });

    expect(mock.query).toHaveBeenCalledWith(
      expect.stringContaining("run.ossdataflow"),
      expect.any(Number),
    );
  });
});

describe("error handling", () => {
  it("connection error returns isError with actionable message", async () => {
    const client = mockClient(async () => {
      throw new JoernConnectionError("localhost", 8080);
    });
    const { mcpClient } = await setup(client);

    const result = await mcpClient.callTool({
      name: "list_projects",
      arguments: {},
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0]
      .text;
    expect(text).toContain("not reachable");
    expect(text).toContain("joern --server");
  });

  it("query error returns isError with error details", async () => {
    const client = mockClient(async () => {
      throw new JoernQueryError("-- Error: bad syntax");
    });
    const { mcpClient } = await setup(client);

    const result = await mcpClient.callTool({
      name: "query",
      arguments: { cpgql: "bad syntax" },
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0]
      .text;
    expect(text).toContain("bad syntax");
  });

  it("timeout error returns isError with timeout info", async () => {
    const client = mockClient(async () => {
      throw new JoernTimeoutError(30000);
    });
    const { mcpClient } = await setup(client);

    const result = await mcpClient.callTool({
      name: "get_methods",
      arguments: {},
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0]
      .text;
    expect(text).toContain("30000ms");
  });
});
