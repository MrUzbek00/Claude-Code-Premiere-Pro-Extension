# Architecture

```
┌────────────┐  stdio JSON-RPC   ┌───────────────┐  HTTP POST /rpc       ┌──────────────────────┐ evalScript ┌──────────┐
│ Claude Code│ ────────────────▶ │ mcp/server.js │ ────────────────────▶ │ CEP panel            │ ─────────▶ │ host.jsx │
│ (MCP client)│ ◀──────────────── │ (Node 18+)    │ ◀──────────────────── │ client/main.js       │ ◀───────── │ (ES3)    │
└────────────┘                   └───────────────┘  127.0.0.1:8765        │ (Node inside Premiere)│   JSON str └──────────┘
                                         │           Bearer token          └──────────────────────┘
                                         └─ reads ~/.premiere-bridge/token ◀── created by the panel
```

## Components

**`mcp/server.js`** is a dependency-free MCP stdio server that Claude Code starts. It implements `initialize`, `ping`, `tools/list` and `tools/call`. Each tool call reads the token file and POSTs `{ cmd, args, code }` to the panel.

**`extension/client/main.js`** runs inside Premiere's CEP browser with Node.js enabled (`--enable-nodejs --mixed-context`). On load it:

1. Reads or creates `~/.premiere-bridge/token`: 24 random bytes as hex, with file mode `0600` where supported.
2. Starts an HTTP server on `127.0.0.1:${PREMIERE_BRIDGE_PORT || 8765}`.
3. For each request, rejects it if any `Origin` header is present (browser/CSRF), if `Host` isn't `127.0.0.1` or `localhost` (DNS rebinding), if the bearer token doesn't match (timing-safe compare), or if the body is over 1 MB or isn't valid JSON.
4. Forwards valid requests to ExtendScript via `__adobe_cep__.evalScript("__bridgeExec(...)")`.

`GET /health` needs no token and only reports that the bridge is alive.

**`extension/host/host.jsx`** is the ExtendScript (ES3) side. `__bridgeExec(reqStr)` dispatches to a built-in command in `COMMANDS` or, for `cmd: "eval"`, runs the given code with `eval`. It returns `{ ok, result | error }`, serialized with a hand-written JSON encoder because ExtendScript has no `JSON` object. Functions are skipped and nesting is capped at depth 6.

**`extension/CSXS/manifest.xml`** declares the extension `com.claude.premierebridge` for host `PPRO` [14.0, 99.9] with CSXS runtime 11.

## Request lifecycle

1. Claude calls `bridge_eval { code }`.
2. `server.js` sends `POST /rpc {"cmd":"eval","code":"..."}` with `Authorization: Bearer <token>`.
3. The panel validates the request and calls `evalScript('__bridgeExec("<json>")')`.
4. `host.jsx` runs the code in Premiere and returns a JSON string.
5. The panel parses it and sends it back as the HTTP response. `server.js` turns it into MCP tool content, or into `isError` when `ok` is false.

## Design choices

- **The HTTP server lives in the panel, not in ExtendScript.** Only CEP's Node runtime can open sockets, and only CEP can call ExtendScript.
- **The token file, not the environment, is the handshake.** The panel and Claude Code are started independently, so a shared file in the user's home folder is the simplest secret exchange.
- **Requests are serialized by Premiere.** ExtendScript is single-threaded, so concurrent tool calls queue up rather than racing.
