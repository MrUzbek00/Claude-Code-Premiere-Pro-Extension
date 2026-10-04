# Changelog

## 1.0.0 — 2026-10-04

- First public release of the Claude Premiere Bridge: CEP panel, localhost bridge, and a dependency-free MCP server with six tools.
- Install and uninstall scripts for Windows and macOS. The panel is linked so `git pull` updates it, and the MCP server is registered with Claude Code automatically.
- Fixed: reinstalling on Windows no longer risks deleting the source folder through the old junction (PowerShell 5.1 `Remove-Item -Recurse` follows junctions).
- The MCP server now reports a clear message when Premiere or the panel isn't running, instead of a raw `fetch failed`.
- Added `npm run doctor` setup diagnostics, an optional signed `.zxp` build script, tests, CI, docs, and `CLAUDE.md` guidance for Claude Code.
