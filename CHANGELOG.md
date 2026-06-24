# Changelog

All notable changes to joern-mcp are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.2.0]

### Added
- `scripts/install.sh` — provisions a **pinned** Joern engine (default 4.0.489)
  into an owned location (`~/tools/joern-mcp/joern`, override via `JOERN_HOME` /
  `JOERN_VERSION`). Idempotent, with a JDK check and a post-install smoke test.
- `scripts/start-server.sh` — starts the provisioned Joern server from its owned
  location, so the bridge never depends on Joern being on ambient PATH.

### Changed
- Joern is now an **owned, reproducible dependency** of this server rather than a
  manual prerequisite. README prerequisites and CLAUDE.md updated accordingly;
  the new home is the runtime/artifact tree (`~/tools/...`), not the XDG state
  tree (`~/.local/share/...`).

### Why
Joern had been hand-installed into `~/.local/share/joern/joern-cli/` and used via
ambient PATH. Nothing owned its lifecycle: it was not in `agent-setup`, under any
`install.sh`, or in PATH config. At some point its 2 GB were removed/lost with no
retire tarball and no ledger entry — an untracked disappearance — while this MCP
stayed registered-but-dead. Pinning + an owning install script + moving the engine
out of the state tree closes that gap so a reboot or cleanup can't silently vaporize
it again. Bumping the Joern pin may require re-auditing the CPGQL templates in
`src/cpgql.ts`.

## [0.1.0]

- Initial release: STDIO MCP bridge wrapping a local Joern server (`/query-sync`),
  with workspace, query, security-analysis, and navigation tools.
