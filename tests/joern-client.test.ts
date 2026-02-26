import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { JoernClient } from "../src/joern-client.js";
import {
  JoernConnectionError,
  JoernQueryError,
  JoernTimeoutError,
} from "../src/errors.js";
import type { Config } from "../src/config.js";

const testConfig: Config = {
  host: "localhost",
  port: 9999,
  queryTimeout: 5000,
  importTimeout: 10000,
};

function mockFetchResponse(body: object): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      json: () => Promise.resolve(body),
    }),
  );
}

describe("JoernClient.query", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns parsed result on success", async () => {
    mockFetchResponse({
      success: true,
      uuid: "test-uuid",
      stdout: 'val res0: List[String] = List("main", "foo")',
    });

    const client = new JoernClient(testConfig);
    const result = await client.query("cpg.method.name.l");

    expect(result.parsed).toBe('List("main", "foo")');
    expect(result.raw).toContain("val res0");
    expect(result.uuid).toBe("test-uuid");
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:9999/query-sync",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ query: "cpg.method.name.l" }),
      }),
    );
  });

  it("returns raw string when output is not REPL format", async () => {
    mockFetchResponse({
      success: true,
      stdout: "some plain output",
    });

    const client = new JoernClient(testConfig);
    const result = await client.query("help");
    expect(result.parsed).toBe("some plain output");
  });

  it("throws JoernConnectionError on ECONNREFUSED", async () => {
    const err = new TypeError("fetch failed");
    (err as any).cause = { code: "ECONNREFUSED" };
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(err));

    const client = new JoernClient(testConfig);
    await expect(client.query("1")).rejects.toThrow(JoernConnectionError);
    await expect(client.query("1")).rejects.toThrow("localhost:9999");
  });

  it("throws JoernTimeoutError when request times out", async () => {
    const config = { ...testConfig, queryTimeout: 50 };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => {
              reject(new DOMException("The operation was aborted.", "AbortError"));
            });
          }),
      ),
    );

    const client = new JoernClient(config);
    await expect(client.query("slow.query")).rejects.toThrow(JoernTimeoutError);
    await expect(client.query("slow.query")).rejects.toThrow("50ms");
  });

  it("throws JoernQueryError when success is false", async () => {
    mockFetchResponse({
      success: false,
      stdout: "RuntimeException: no active project",
    });

    const client = new JoernClient(testConfig);
    await expect(client.query("cpg.method.l")).rejects.toThrow(JoernQueryError);
    await expect(client.query("cpg.method.l")).rejects.toThrow("RuntimeException");
  });

  it("throws JoernQueryError when success is false and stdout is empty", async () => {
    mockFetchResponse({ success: false, stdout: "" });

    const client = new JoernClient(testConfig);
    await expect(client.query("bad")).rejects.toThrow("success: false");
  });

  it("throws JoernQueryError when stdout contains compiler error", async () => {
    mockFetchResponse({
      success: true,
      stdout: "-- Error: /file.sc:1:0\n|bad syntax\n|^",
    });

    const client = new JoernClient(testConfig);
    await expect(client.query("bad syntax")).rejects.toThrow(JoernQueryError);
    await expect(client.query("bad syntax")).rejects.toThrow("-- Error:");
  });

  it("handles empty stdout as value", async () => {
    mockFetchResponse({ success: true, stdout: "" });

    const client = new JoernClient(testConfig);
    const result = await client.query("cpg.method.name.l");
    expect(result.parsed).toBe("");
    expect(result.raw).toBe("");
  });

  it("uses custom timeout when provided", async () => {
    mockFetchResponse({ success: true, stdout: "val res0: Int = 1" });

    const client = new JoernClient(testConfig);
    await client.query("1", 60000);

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
});

describe("JoernClient.healthCheck", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns true when Joern is reachable", async () => {
    mockFetchResponse({ success: true, stdout: "val res0: Int = 1" });

    const client = new JoernClient(testConfig);
    expect(await client.healthCheck()).toBe(true);
  });

  it("returns false when Joern is not reachable", async () => {
    const err = new TypeError("fetch failed");
    (err as any).cause = { code: "ECONNREFUSED" };
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(err));

    const client = new JoernClient(testConfig);
    expect(await client.healthCheck()).toBe(false);
  });
});
