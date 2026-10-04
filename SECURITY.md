# Security

The bridge lets the MCP client run **arbitrary ExtendScript inside Premiere Pro** (`bridge_eval`). ExtendScript can read and write files with your user's permissions. Only connect MCP clients you trust, review edits Claude proposes, and save or back up projects before large automated changes.

## What protects the bridge

- The HTTP server binds to `127.0.0.1` only. It is never reachable from the LAN or Internet unless you tunnel it, so don't.
- Every `/rpc` call needs the bearer token from `~/.premiere-bridge/token`: 24 random bytes, compared in constant time.
- Requests with an `Origin` header are rejected, which blocks web pages from calling the bridge (CSRF).
- Requests whose `Host` isn't `127.0.0.1` or `localhost` are rejected, which blocks DNS rebinding.
- Request bodies are capped at 1 MB.
- No CORS headers are sent. The bridge makes no outbound network requests.

## Limits

Any program running under your user account that can read the token file can use the bridge. This is not an isolation boundary against local malware. On Windows the token file inherits the ACLs of your profile folder. On macOS and Linux it is created with mode `0600`.

## Rotating the token

Delete `~/.premiere-bridge/token`, then close and reopen the Claude Bridge panel. A new token is created. The MCP server reads the file on every call, so Claude Code doesn't need a restart.

## Never commit

- `~/.premiere-bridge/token`
- `build/cert.p12` (the signing certificate from `scripts/package.ps1`) or any `*.p12`
- Built `.zxp` packages

All of these are git-ignored. Removing a secret in a later commit doesn't remove it from Git history. Rotate it instead.

## Reporting

Report vulnerabilities privately to the repository owner, or through GitHub private vulnerability reporting if it is enabled. Don't post tokens or private project data in public issues.
