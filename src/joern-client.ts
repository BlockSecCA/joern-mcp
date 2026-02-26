import { config, type Config } from "./config.js";
import {
  JoernConnectionError,
  JoernQueryError,
  JoernTimeoutError,
} from "./errors.js";
import { classifyOutput } from "./parsers.js";

export interface JoernResponse {
  success: boolean;
  uuid?: string;
  stdout: string;
}

export interface QueryResult {
  raw: string;
  parsed: string;
  uuid?: string;
}

export class JoernClient {
  private baseUrl: string;
  private conf: Config;

  constructor(conf?: Config) {
    this.conf = conf ?? config;
    this.baseUrl = `http://${this.conf.host}:${this.conf.port}`;
  }

  async query(cpgql: string, timeoutMs?: number): Promise<QueryResult> {
    const timeout = timeoutMs ?? this.conf.queryTimeout;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(`${this.baseUrl}/query-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: cpgql }),
        signal: controller.signal,
      });

      const body = (await res.json()) as JoernResponse;
      const stdout = body.stdout ?? "";

      if (!body.success) {
        throw new JoernQueryError(stdout || "Query failed (success: false)");
      }

      const classified = classifyOutput(stdout);
      if (classified.kind === "error") {
        throw new JoernQueryError(classified.content);
      }

      return {
        raw: stdout,
        parsed: classified.content,
        uuid: body.uuid,
      };
    } catch (err: unknown) {
      if (
        err instanceof JoernQueryError ||
        err instanceof JoernTimeoutError ||
        err instanceof JoernConnectionError
      ) {
        throw err;
      }

      if (err instanceof DOMException && err.name === "AbortError") {
        throw new JoernTimeoutError(timeout);
      }

      if (isConnectionRefused(err)) {
        throw new JoernConnectionError(this.conf.host, this.conf.port);
      }

      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.query("1");
      return true;
    } catch {
      return false;
    }
  }
}

function isConnectionRefused(err: unknown): boolean {
  if (err instanceof TypeError) {
    const cause = (err as TypeError & { cause?: { code?: string } }).cause;
    if (cause?.code === "ECONNREFUSED") return true;
    if (err.message?.includes("ECONNREFUSED")) return true;
    if (err.message?.includes("fetch failed")) return true;
  }
  return false;
}
