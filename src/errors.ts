export class JoernConnectionError extends Error {
  constructor(host: string, port: number) {
    super(
      `Joern server is not reachable at ${host}:${port}. Start Joern with: joern --server`,
    );
    this.name = "JoernConnectionError";
  }
}

export class JoernQueryError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = "JoernQueryError";
  }
}

export class JoernTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(
      `Query timed out after ${timeoutMs}ms. Increase JOERN_QUERY_TIMEOUT or JOERN_IMPORT_TIMEOUT.`,
    );
    this.name = "JoernTimeoutError";
  }
}
