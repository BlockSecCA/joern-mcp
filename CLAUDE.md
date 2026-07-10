# joern-mcp

## What This Is

STDIO MCP server that wraps a local Joern instance for AI-driven code security analysis.
Claude Code talks to this server, this server talks to Joern's HTTP API.

## Architecture

```
Claude Code <--stdio--> joern-mcp (TypeScript) <--HTTP--> Joern server (JVM, port 8080)
```

Joern is an **owned dependency**, provisioned by `scripts/install.sh` (pinned version)
into `~/tools/joern-mcp/joern/` — the runtime/artifact tree, not the XDG state tree.
Start it with `scripts/start-server.sh`. It is **not** assumed to be on ambient PATH:
that assumption, plus the engine living in `~/.local/share` (state), let it get wiped
with no trace once while this bridge stayed registered-but-dead (see CHANGELOG 0.2.0).
The MCP still does no process management — the scripts are operator helpers, the server
is started out-of-band.

## Stack

- TypeScript, ES modules
- `@modelcontextprotocol/sdk` for MCP
- Node built-in `fetch` for HTTP to Joern (no external HTTP lib needed)

## Commands

```bash
npm run build    # tsc
npm run dev      # tsc --watch
npm start        # node dist/index.js
```

## Project Structure

```
src/
  index.ts          # MCP server entry point (stdio transport)
  joern-client.ts   # HTTP client for Joern server API
  tools/            # MCP tool handlers (one file per tool group)
docs/
  mcp-spec.md       # Full design spec with tool definitions
```

## Design Spec

Read `docs/mcp-spec.md` before writing any code. It defines all tools, the query execution
pattern, and configuration.

## Conventions

- Fail loudly if Joern server is not reachable
- All queries go through the synchronous POST /query-sync endpoint
- Environment variables for config (JOERN_HOST, JOERN_PORT, timeouts)
- No process management — joern-mcp does NOT start/stop Joern
