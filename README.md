# joern-mcp

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933.svg)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/MCP-Model_Context_Protocol-7c3aed.svg)](https://modelcontextprotocol.io/)
[![Joern](https://img.shields.io/badge/Joern-CPG_Analysis-e34c26.svg)](https://joern.io/)

MCP server that wraps a local [Joern](https://joern.io) instance for AI-driven code security analysis. Gives Claude Code the ability to import codebases, query the Code Property Graph (CPG), trace data flows, and detect vulnerabilities.

## Architecture

```
Claude Code  <--stdio-->  joern-mcp (TypeScript)  <--HTTP-->  Joern server (JVM)
```

joern-mcp is the bridge. It translates MCP tool calls into CPGQL queries sent to Joern's `/query-sync` HTTP endpoint.

## Prerequisites

- **Node.js** 18+
- **Joern** installed and on PATH ([install guide](https://docs.joern.io/installation))

Tested with Joern v4.x. The HTTP API has been stable since mid-2023.

## Install

```bash
bun install
bun run build
```

## Register with Claude Code

```bash
claude mcp add joern-mcp -- node /path/to/joern-mcp/dist/index.js
```

## Usage

1. Start Joern server: `joern --server`
2. In a Claude Code session, use the tools:

```
# Import a codebase (one-time, builds the CPG)
import_code("/path/to/repo", "my-project")

# Scan for vulnerabilities
find_vulnerabilities()

# Trace data flow from source to sink
taint_analysis({ source: "method.name(\"gets\").parameter", sink: "method.name(\"strcpy\").parameter" })

# Run any CPGQL query
query("cpg.method.name.l")
```

## Configuration

| Environment Variable | Default | Purpose |
|---------------------|---------|---------|
| `JOERN_HOST` | `localhost` | Joern server hostname |
| `JOERN_PORT` | `8080` | Joern server port |
| `JOERN_QUERY_TIMEOUT` | `30000` | Query timeout in ms |
| `JOERN_IMPORT_TIMEOUT` | `300000` | Import/analysis timeout in ms |

## Tools

### Workspace Management
| Tool | Description |
|------|-------------|
| `import_code` | Import a codebase into Joern (builds CPG) |
| `list_projects` | List all projects in the workspace |
| `switch_project` | Set the active project |
| `close_project` | Unload a CPG from memory |

### Querying
| Tool | Description |
|------|-------------|
| `query` | Run arbitrary CPGQL against the active CPG |
| `get_methods` | List methods (optional name filter) |
| `get_calls` | Find call sites (optional method filter) |
| `get_types` | List types/classes (optional name filter) |

### Security Analysis
| Tool | Description |
|------|-------------|
| `find_vulnerabilities` | Run default vulnerability detection |
| `taint_analysis` | Trace data flow from source to sink |
| `reachable_by` | Check if sink is reachable from source |
| `get_data_flows` | Get all data flow paths between two points |

### Navigation
| Tool | Description |
|------|-------------|
| `get_source` | Read source code of a method |
| `get_callers` | Find all callers of a method |
| `get_callees` | Find all methods called by a method |
| `get_parameters` | Get parameter types and names |

## Development

```bash
bun run build          # Compile TypeScript
bun run dev            # Watch mode
bun run test           # Run unit + integration tests (no Joern needed)
bun run test:watch     # Watch mode for tests

# Smoke tests (requires running Joern server)
JOERN_SMOKE=1 bun run test tests/smoke.test.ts
```

### Testing strategy

- **Parsers** — Pure function tests for ANSI stripping and Scala REPL output parsing
- **CPGQL templates** — String construction tests
- **HTTP client** — Mocked `fetch`, covers all error paths
- **MCP integration** — Full round-trip via `InMemoryTransport` (no Joern, no stdio)
- **Smoke tests** — Real Joern, skipped unless `JOERN_SMOKE=1`

## Joern Compatibility

The HTTP API (`/query-sync`) is implemented by `scala-repl-pp` and has been stable since mid-2023. CPGQL query syntax can change in any Joern nightly release — all query templates are centralized in `src/cpgql.ts` for easy audit on upgrades.

## License

MIT
