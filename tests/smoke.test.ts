import { describe, it, expect } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/index.js";
import { JoernClient } from "../src/joern-client.js";

const SKIP = !process.env.JOERN_SMOKE;

describe.skipIf(SKIP)("Smoke tests (requires running Joern)", () => {
  const client = new JoernClient();

  it("health check succeeds", async () => {
    expect(await client.healthCheck()).toBe(true);
  });

  it("check_connection tool returns success", async () => {
    const server = createServer(client);
    const mcpClient = new Client({ name: "smoke-client", version: "1.0.0" });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      mcpClient.connect(clientTransport),
      server.server.connect(serverTransport),
    ]);

    const result = await mcpClient.callTool({
      name: "check_connection",
      arguments: {},
    });

    expect(result.isError).toBeFalsy();
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("reachable");
  });

  it("trivial query returns result", async () => {
    const result = await client.query("1 + 1");
    expect(result.parsed).toContain("2");
  });

  it("list projects works", async () => {
    const result = await client.query("workspace.getProjectNames");
    expect(result.raw).toBeDefined();
  });

  it("get methods on active project (if any)", async () => {
    const result = await client.query("cpg.method.name.l.take(5)");
    expect(result.raw).toBeDefined();
  });
});
