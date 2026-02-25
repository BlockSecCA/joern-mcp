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

Joern exposes three endpoints when started with `--server`:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/query` | POST | Submit a CPGQL query, returns a UUID |
| `/result/{uuid}` | GET | Poll for query result (stdout, stderr, success) |
| `ws://host:8080/connect` | WS | Subscribe to result notifications |

Queries are **asynchronous**: POST to `/query`, get a UUID, poll `/result/{uuid}` until done.

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
| `find_vulnerabilities` | Run `joern-scan` default queries against active CPG |
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

## Query Execution Pattern

Since Joern's HTTP API is async, every tool that runs a query follows this flow:

1. POST query string to `/query`
2. Receive UUID
3. Poll `/result/{uuid}` until `success` is not null
4. Return stdout (the result) or stderr (the error)

Timeout after a configurable duration (default 30s for simple queries, longer for import/analysis).

## Configuration

Environment variables:

| Var | Default | Purpose |
|-----|---------|---------|
| `JOERN_HOST` | `localhost` | Joern server hostname |
| `JOERN_PORT` | `8080` | Joern server port |
| `JOERN_QUERY_TIMEOUT` | `30000` | Default query timeout (ms) |
| `JOERN_IMPORT_TIMEOUT` | `300000` | Import timeout (ms) — CPG generation is slow |

## Usage Flow

1. Start Joern: `joern --server`
2. Start MCP: registered via `claude mcp add`
3. In a Claude Code session:
   - `import_code("/path/to/repo", "my-project")` — one-time, builds CPG
   - `find_vulnerabilities()` — scan for known patterns
   - `taint_analysis({ source: "...", sink: "..." })` — trace specific flows
   - `query("cpg.method.name.l")` — raw CPGQL for anything custom

## Dependencies

- `@modelcontextprotocol/sdk` — MCP server framework
- `node-fetch` or built-in `fetch` — HTTP client for Joern API

## Open Questions

- Should joern-mcp auto-start Joern if it's not running? (Probably not — keep it simple, fail loudly)
- Should we support WebSocket for result notifications, or is polling sufficient? (Start with polling)
- Should `import_code` accept git URLs and clone automatically? (Maybe later)
