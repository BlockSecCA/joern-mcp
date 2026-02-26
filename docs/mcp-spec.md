# Joern MCP Server — Design Spec

## Purpose

STDIO MCP server that wraps a local Joern instance, giving Claude Code
the ability to perform formal code security analysis: taint tracking,
data flow tracing, vulnerability detection, and CPG querying.

## Architecture

```
Claude Code  <--stdio-->  joern-mcp (TypeScript)  <--HTTP-->  Joern server (JVM)
```

- **joern-mcp** is the MCP server. It speaks STDIO to Claude Code and HTTP to Joern.
- **Joern** runs as a local server (`joern --server`, default port 8080).
- joern-mcp does NOT embed or manage the Joern JVM process — Joern must be running separately.

## Joern Server API

Joern's HTTP server is implemented by the `scala-repl-pp` library (not Joern itself),
built on the Cask web framework over Undertow.

### Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/query` | POST | Submit async CPGQL query, returns `{ success: true, uuid: "..." }` |
| `/query-sync` | POST | Submit synchronous query, blocks until complete |
| `/result/{uuid}` | GET | Retrieve result of async query |
| `ws://host:port/connect` | WS | Subscribe to result notifications (sends UUID on completion) |

There is **no health check or version endpoint**.

### `/query-sync` (primary — used by joern-mcp)

Request:
```json
POST /query-sync
Content-Type: application/json

{"query": "cpg.method.name.l"}
```

Success response (200):
```json
{
  "success": true,
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "stdout": "val res0: List[String] = List(\"main\", \"foo\", \"bar\")"
}
```

All responses return HTTP 200 — errors are signaled in the JSON body. A query with
bad CPGQL syntax still returns `success: true` with the compiler error in `stdout`.
Only Scala `Future` runtime failures produce `success: false`.

### `/query` + `/result/{uuid}` (async — not used, documented for reference)

POST to `/query` returns a UUID immediately. Poll `/result/{uuid}` until the result
appears. **Results are consumed on read** — a second GET for the same UUID returns
"No result (yet?) found". This creates race conditions and lost-data risks, which is
why we use `/query-sync` instead.

Result not ready:
```json
{ "success": false, "err": "No result (yet?) found for specified UUID" }
```

Result ready:
```json
{ "success": true, "uuid": "...", "stdout": "..." }
```

### Connection failure behavior

When Joern is not running, there is no HTTP response — `fetch` rejects with a
`TypeError` and `cause.code: 'ECONNREFUSED'`. This is a TCP-level failure, not an
HTTP error. joern-mcp must catch this and return an actionable MCP error.

### Authentication

Optional via `--server-auth-username` and `--server-auth-password` flags on the Joern
server. Returns 401 with `WWW-Authenticate: Basic` header on auth failure. joern-mcp
does not currently support auth — add if needed later.

## Query Execution Pattern

All tools use the synchronous `/query-sync` endpoint:

1. POST CPGQL string to `/query-sync` with configurable timeout
2. Parse response JSON
3. Classify result:
   - Connection refused → MCP error: "Joern server not reachable at {host}:{port}"
   - `success: true` + clean stdout → return formatted result
   - `success: true` + error text in stdout → parse and return as tool error
   - `success: false` → return exception details as tool error
   - Timeout → MCP error with timeout duration

### Error classification

Joern does not distinguish syntax errors from successful results at the protocol level.
Both return `success: true`. The client must inspect `stdout` for error patterns:

- Lines starting with `-- Error:` (Scala 3 compiler errors)
- `Exception` / `Error` stack traces
- Empty stdout when a result was expected

## MCP Tools

### Workspace Management

| Tool | Description |
|------|-------------|
| `import_code` | Import a codebase into Joern (`importCode(path, projectName)`) |
| `list_projects` | List all projects in the Joern workspace |
| `switch_project` | Set the active project (`workspace.setActiveProject(name)`) |
| `close_project` | Unload a CPG from memory (keeps on disk) |

### Querying

| Tool | Description |
|------|-------------|
| `query` | Run an arbitrary CPGQL query against the active CPG |
| `get_methods` | List methods in the codebase (with optional filter) |
| `get_calls` | Find call sites (who calls what) |
| `get_types` | List types/classes |

### Security Analysis

| Tool | Description |
|------|-------------|
| `find_vulnerabilities` | Scan for common vulnerability patterns (dangerous calls, SQL construction, hardcoded credentials, etc.) |
| `taint_analysis` | Trace data flow from source to sink |
| `reachable_by` | Check if a sink is reachable from a source |
| `get_data_flows` | Get all data flow paths between two points |

### Navigation

| Tool | Description |
|------|-------------|
| `get_source` | Read the source code of a specific method/function |
| `get_callers` | Find all callers of a method |
| `get_callees` | Find all methods called by a method |
| `get_parameters` | Get parameter types and names for a method |

### Tool categories and CPGQL risk

The `query` tool is a **passthrough** — it sends whatever CPGQL the caller provides.
It is immune to Joern API changes.

All other tools **construct CPGQL internally**. These are the fragile surface when
Joern upgrades change traversal step names or behavior. Keep all CPGQL templates
centralized (not scattered across handlers) for easy audit on Joern upgrades.

## Health Check

No dedicated endpoint exists. Health check is implemented as a trivial query:

```json
POST /query-sync
{"query": "1"}
```

If this returns `{ "success": true, "stdout": "..." }`, Joern is alive.
If the connection is refused, it is not.

Health check runs on first tool invocation (lazy) — not at MCP server startup,
since the server must start regardless to report meaningful errors.

## Configuration

Environment variables:

| Var | Default | Purpose |
|-----|---------|---------|
| `JOERN_HOST` | `localhost` | Joern server hostname |
| `JOERN_PORT` | `8080` | Joern server port |
| `JOERN_QUERY_TIMEOUT` | `30000` | Default query timeout (ms) |
| `JOERN_IMPORT_TIMEOUT` | `300000` | Import timeout (ms) — CPG generation is slow |

## Error Handling Strategy

### Connection errors (Joern not running)

Every tool must handle `ECONNREFUSED` and return:
```
Joern server is not reachable at {host}:{port}. Start Joern with: joern --server
```

This is caught at the TCP level (fetch rejection), not the HTTP level.

### Query errors (bad CPGQL, runtime exceptions)

- Syntax errors appear as `success: true` with compiler error text in `stdout`
- Runtime exceptions appear as `success: false` with rendered exception
- Both are returned to the caller as MCP tool errors with the error text

### Timeout errors

Return the timeout duration and suggest increasing `JOERN_QUERY_TIMEOUT` or
`JOERN_IMPORT_TIMEOUT` as appropriate.

## Testing Strategy

### Layer 1: Joern HTTP client (`joern-client.ts`)

Unit test with mocked `fetch`. No Joern required.

Test cases:
- Successful query → parses response, returns stdout
- Connection refused → throws typed error with host:port
- Timeout → throws typed error with duration
- `success: true` with error text in stdout → classified as query error
- `success: false` → classified as runtime error
- Malformed JSON response → throws typed error

### Layer 2: Tool handler logic

Unit test pure functions directly. No Joern, no MCP required.

Test cases:
- CPGQL query construction from tool parameters
- Result formatting and truncation
- Parameter validation

### Layer 3: MCP integration (full round-trip)

Use `InMemoryTransport.createLinkedPair()` from `@modelcontextprotocol/sdk/inMemory.js`.
Creates an in-memory MCP Client + Server pair — no stdio, no processes, no Joern.

```typescript
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
await Promise.all([
  client.connect(clientTransport),
  server.connect(serverTransport),
]);
const result = await client.callTool({ name: 'list_projects', arguments: {} });
```

Test cases:
- Tool discovery (listTools returns all expected tools with correct schemas)
- Tool invocation with valid args → correct MCP response shape
- Tool invocation with invalid args → MCP error response
- Joern connection failure → actionable error message (not stack trace)

### Layer 4: Smoke tests (optional, requires running Joern)

Separate script, not part of the main test suite. Runs real queries against
a Joern instance with a known test CPG. Used to validate after Joern upgrades.

## Joern Compatibility

### Tested version

Document the tested Joern version in README. Currently targeting whatever is
installed at `~/.local/share/joern/joern-cli/`.

### Update risk

- **HTTP API (low risk):** Implemented by `scala-repl-pp`, stable since mid-2023
  with only 3 commits to the server code. The `/query-sync` endpoint is undocumented
  on docs.joern.io but present in source and used by other projects.
- **CPGQL (higher risk):** Joern releases nightly (~15-20/month) with no changelog.
  Query syntax and traversal steps can change silently. Structured tools that
  construct CPGQL are the fragile surface.

### Mitigation

- Pin tested Joern version in README
- Centralize all CPGQL templates in one module for easy audit
- The `query` tool (raw passthrough) is immune to CPGQL changes
- Smoke test script validates structured tools against a real Joern instance
- On Joern upgrade: run smoke tests, diff CPGQL templates against Joern's
  CPGQL reference at `https://docs.joern.io/cpgql/`

## Dependencies

- `@modelcontextprotocol/sdk` — MCP server framework (v1.x, SDK provides `InMemoryTransport` for testing)
- Node built-in `fetch` — HTTP client for Joern API (no external HTTP lib needed)
- `vitest` — test framework (dev dependency)
- `zod` — schema validation (peer dependency of MCP SDK)

## Usage Flow

1. Start Joern: `joern --server`
2. Register MCP: `claude mcp add joern-mcp -- node /path/to/dist/index.js`
3. In a Claude Code session:
   - `import_code("/path/to/repo", "my-project")` — one-time, builds CPG
   - `find_vulnerabilities()` — scan for known patterns
   - `taint_analysis({ source: "...", sink: "..." })` — trace specific flows
   - `query("cpg.method.name.l")` — raw CPGQL for anything custom

## Resolved Decisions

- **No auto-start of Joern.** Fail loudly with instructions.
- **No WebSocket.** `/query-sync` eliminates the need for async result notification.
- **No git URL support in `import_code`.** Accept local paths only. Caller clones.
- **No Joern auth support initially.** Add if needed later.
- **Lazy health check.** Check on first tool call, not at server startup.
