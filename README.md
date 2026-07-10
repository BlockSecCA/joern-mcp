# joern-mcp

[![Version](https://img.shields.io/badge/version-0.2.0-blue)](https://github.com/BlockSecCA/joern-mcp/releases) [![License](https://img.shields.io/github/license/BlockSecCA/joern-mcp)](LICENSE) [![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/) [![MCP](https://img.shields.io/badge/MCP-Model_Context_Protocol-7c3aed?logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJ3aGl0ZSI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiLz48L3N2Zz4=)](https://modelcontextprotocol.io/) [![Joern](https://img.shields.io/badge/Joern-CPG_Analysis-e34c26)](https://joern.io/)

MCP server that wraps a local [Joern](https://joern.io) instance for AI-driven code security analysis. Gives Claude Code the ability to import codebases, query the Code Property Graph (CPG), trace data flows, and detect vulnerabilities.

## Architecture

```
Claude Code  <--stdio-->  joern-mcp (TypeScript)  <--HTTP-->  Joern server (JVM)
```

joern-mcp is the bridge. It translates MCP tool calls into CPGQL queries sent to Joern's `/query-sync` HTTP endpoint.

## Prerequisites

- **Node.js** 18+
- **JDK 21** (Joern targets 21 LTS; newer JDKs usually work but are unverified)

The Joern engine itself is **provisioned by this repo** (see Install). You do not
install Joern separately or rely on it being on PATH — that ambient-PATH
assumption caused a silent outage once (see [CHANGELOG](CHANGELOG.md) 0.2.0).

## Install

```bash
bun install
bun run build

# Provision the pinned Joern engine into ~/tools/joern-mcp/joern (idempotent).
# Joern is an OWNED dependency of this server, not an ambient prerequisite.
scripts/install.sh
```

Joern is pinned (currently **4.0.489**) because the CPGQL templates in
`src/cpgql.ts` are tuned to a specific release. Override the version or location
with the `JOERN_VERSION` / `JOERN_HOME` env vars.

## Register with Claude Code

```bash
claude mcp add joern-mcp -- node /path/to/joern-mcp/dist/index.js
```

## Usage

1. Start the Joern server: `scripts/start-server.sh`
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
| `JOERN_HOME` | `~/tools/joern-mcp/joern` | Provisioned Joern engine location (used by `scripts/`) |
| `JOERN_VERSION` | `4.0.489` | Pinned Joern release `scripts/install.sh` provisions |
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

## Claude Code Skill

The repo includes a Claude Code skill at `.claude/skills/joern-analysis/SKILL.md` that guides the full security analysis workflow — from importing code through vulnerability scanning to data flow tracing.

To make it available globally, symlink it:

```bash
ln -s /path/to/joern-mcp/.claude/skills/joern-analysis ~/.claude/skills/joern-analysis
```

Then invoke it in any Claude Code session with `/joern-analysis`. The skill walks through the standard workflow:

1. **Connect and import** — verify Joern is up, build the CPG
2. **Explore** — list methods, types, call sites
3. **Navigate** — trace callers/callees, class hierarchies
4. **Analyze** — run vulnerability scans, taint analysis, data flow tracing
5. **Raw queries** — arbitrary CPGQL for anything the structured tools don't cover

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
