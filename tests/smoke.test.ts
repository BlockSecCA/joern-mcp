import { describe, it, expect } from "vitest";
import { JoernClient } from "../src/joern-client.js";

const SKIP = !process.env.JOERN_SMOKE;

describe.skipIf(SKIP)("Smoke tests (requires running Joern)", () => {
  const client = new JoernClient();

  it("health check succeeds", async () => {
    expect(await client.healthCheck()).toBe(true);
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
