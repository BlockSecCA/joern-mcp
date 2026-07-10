#!/usr/bin/env bash
#
# start-server.sh — start the Joern server that joern-mcp connects to.
#
# The MCP (src/joern-client.ts) speaks HTTP to JOERN_HOST:JOERN_PORT; it does not
# launch Joern itself. This script starts the engine provisioned by install.sh
# from its OWNED location, so you never depend on Joern being on ambient PATH.
#
# Overridable via env (defaults match src/config.ts):
#   JOERN_HOME   engine location   (default: ~/tools/joern-mcp/joern)
#   JOERN_HOST   bind host         (default: localhost)
#   JOERN_PORT   bind port         (default: 8080)
#
set -euo pipefail

JOERN_HOME="${JOERN_HOME:-$HOME/tools/joern-mcp/joern}"
JOERN_HOST="${JOERN_HOST:-localhost}"
JOERN_PORT="${JOERN_PORT:-8080}"

if [ ! -x "$JOERN_HOME/joern" ]; then
  echo "ERROR: Joern not provisioned at $JOERN_HOME. Run scripts/install.sh first." >&2
  exit 1
fi

echo "Starting Joern server at ${JOERN_HOST}:${JOERN_PORT} (from ${JOERN_HOME})"
exec "$JOERN_HOME/joern" --server --server-host "$JOERN_HOST" --server-port "$JOERN_PORT"
