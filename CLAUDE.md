# joern-mcp

## What This Is

STDIO MCP server that wraps a local Joern instance for AI-driven code security analysis.
Claude Code talks to this server, this server talks to Joern's HTTP API.

## Architecture

```
Claude Code <--stdio--> joern-mcp (TypeScript) <--HTTP--> Joern server (JVM, port 8080)
```

Joern is installed at `~/.local/share/joern/joern-cli/` and available as `joern` on PATH.

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
