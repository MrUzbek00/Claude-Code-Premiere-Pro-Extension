# Troubleshooting

Run `npm run doctor` first. It checks each step and prints the fix.

## "Claude Bridge" isn't in the Extensions menu

- Restart Premiere Pro **after** running the installer.
- Look under **Window → Extensions (Legacy)** (Premiere 2024+) as well as **Window → Extensions**.
- Check that `PlayerDebugMode` is `1`:
  - Windows: `reg query HKCU\Software\Adobe\CSXS.11 /v PlayerDebugMode` (also `CSXS.12`)
  - macOS: `defaults read com.adobe.CSXS.11 PlayerDebugMode`
  
  Newer Premiere versions may use a higher CSXS number. If so, add it by hand (`CSXS.13`, and so on) and restart.
- Check that the panel folder exists:
  - Windows: `%APPDATA%\Adobe\CEP\extensions\com.claude.premierebridge\CSXS\manifest.xml`
  - macOS: `~/Library/Application Support/Adobe/CEP/extensions/com.claude.premierebridge/CSXS/manifest.xml`
- If you moved or deleted the cloned repo, the link is broken. Re-run the installer from the new location.

## The panel shows "Server error: EADDRINUSE"

Another program, or a second Premiere window, is using port 8765. Close it, or choose another port: set `PREMIERE_BRIDGE_PORT` system-wide, restart Premiere, and re-register the MCP server with `-e PREMIERE_BRIDGE_PORT=<port>`.

## The panel shows "Loading... node=undefined" or stays blank

CEP didn't enable Node.js. Make sure `extension/CSXS/manifest.xml` still contains `--enable-nodejs` and `--mixed-context`. To debug, `extension/` has no `.debug` file by default. Add one with a `<Host Name="PPRO" Port="8088"/>` entry and open `http://localhost:8088` in Chrome.

## Claude says "Token not found"

The panel hasn't been opened yet on this account. Open it once in Premiere.

## Claude says "Cannot reach the bridge"

Premiere isn't running or the panel is closed. Open it (you can dock it so it stays open). `curl http://127.0.0.1:8765/health` should return `{"ok":true,...}`.

## Claude says "Unauthorized"

The token file changed after the panel loaded (for example, you deleted it to rotate the token). Close and reopen the panel.

## `premiere-bridge` doesn't show up in Claude Code

- Run `claude mcp list`. If it's missing, run `claude mcp add premiere-bridge --scope user -- node "<repo>/mcp/server.js"`.
- Restart Claude Code after adding it. In the CLI, `/mcp` shows connection status.
- `node` must be on the `PATH` that Claude Code sees. If it isn't, use the full path to `node.exe` in the `claude mcp add` command.

## ExtendScript errors from `bridge_eval`

- `SyntaxError` usually means modern JavaScript slipped in (`let`, `const`, arrow functions, template strings). ExtendScript is ES3.
- `undefined is not an object` usually means there's no active sequence or project. Check with `bridge_ping`.
