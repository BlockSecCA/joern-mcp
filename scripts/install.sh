#!/usr/bin/env bash
#
# install.sh — provision the Joern engine that joern-mcp depends on.
#
# joern-mcp is only a bridge: it speaks HTTP to a running `joern --server`.
# Without the Joern engine present, the MCP is registered-but-dead. This script
# makes Joern an OWNED, REPRODUCIBLE dependency instead of a hand-stood-up binary
# that vanishes on the next reboot or disk cleanup (which is exactly what happened
# once — see CHANGELOG 0.2.0).
#
# Pinned version: the CPGQL templates in src/cpgql.ts are tuned to a specific
# Joern release. Bumping JOERN_VERSION may require re-auditing src/cpgql.ts.
#
# Idempotent: re-running with the same version is a no-op.
#
# Overridable via env:
#   JOERN_VERSION  Joern release to install            (default: 4.0.489)
#   JOERN_HOME     install location (the engine root)  (default: ~/tools/joern-mcp/joern)
#
set -euo pipefail

JOERN_VERSION="${JOERN_VERSION:-4.0.489}"
JOERN_HOME="${JOERN_HOME:-$HOME/tools/joern-mcp/joern}"
ASSET_URL="https://github.com/joernio/joern/releases/download/v${JOERN_VERSION}/joern-cli.zip"

echo "joern-mcp :: provisioning Joern ${JOERN_VERSION} -> ${JOERN_HOME}"

# --- prerequisites -----------------------------------------------------------
if ! command -v java >/dev/null 2>&1; then
  echo "ERROR: java not found on PATH. Joern needs a JDK (21 LTS recommended)." >&2
  exit 1
fi
echo "  java: $(java -version 2>&1 | head -1)"
# Joern targets JDK 21; newer/EA JDKs usually work but are unverified.
case "$(java -version 2>&1 | head -1)" in
  *\"21*|*\"2[2-9]*|*\"[3-9][0-9]*) : ;;  # 21+ ok (incl. >21, possibly EA)
  *) echo "  WARN: JDK appears <21; Joern may misbehave." >&2 ;;
esac
for tool in curl unzip; do
  command -v "$tool" >/dev/null 2>&1 || { echo "ERROR: '$tool' required." >&2; exit 1; }
done

# --- idempotency -------------------------------------------------------------
if [ -x "$JOERN_HOME/joern-parse" ] \
   && [ "$(cat "$JOERN_HOME/.joern-version" 2>/dev/null)" = "$JOERN_VERSION" ]; then
  echo "  Joern ${JOERN_VERSION} already provisioned — nothing to do."
  exit 0
fi

# --- fetch + unpack ----------------------------------------------------------
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
echo "  downloading $ASSET_URL ..."
curl -fsSL "$ASSET_URL" -o "$TMP/joern-cli.zip"
echo "  unpacking ($(du -h "$TMP/joern-cli.zip" | cut -f1)) ..."
unzip -oq "$TMP/joern-cli.zip" -d "$TMP"

mkdir -p "$(dirname "$JOERN_HOME")"
rm -rf "$JOERN_HOME"
mv "$TMP/joern-cli" "$JOERN_HOME"
echo "$JOERN_VERSION" > "$JOERN_HOME/.joern-version"

# --- verify ------------------------------------------------------------------
if "$JOERN_HOME/joern-parse" --help >/dev/null 2>&1; then
  echo "  OK: joern-parse runs from $JOERN_HOME"
else
  echo "ERROR: smoke test failed — joern-parse did not run." >&2
  exit 1
fi

echo "Done. Joern ${JOERN_VERSION} provisioned at ${JOERN_HOME}"
echo "Start the engine:  scripts/start-server.sh   (then the MCP can reach it)"
