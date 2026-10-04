# Working with Premiere Pro through the Claude Bridge

The `premiere-bridge` MCP server exposes Premiere Pro through six tools. Read-only tools: `bridge_ping`, `bridge_project_info`, `bridge_list_sequences`, `bridge_list_root_items`, `bridge_active_sequence`. Everything else goes through `bridge_eval`, which runs ExtendScript.

## Before acting

- Call `bridge_ping` first. If it fails, tell the user to open Premiere Pro and **Window → Extensions (Legacy) → Claude Bridge**, or to run `npm run doctor`.
- Ask before destructive or wide edits (deleting items, ripple edits, replacing media, saving over the project). Most edits can be undone with Ctrl/Cmd+Z in Premiere, but `app.project.save()` and file exports cannot be undone.
- Inspect before editing: read track and clip state, then change it.

## ExtendScript rules for `bridge_eval`

- **ES3 only.** Use `var` and `function`. Don't use `let`, `const`, arrow functions, template literals, destructuring, `Array.prototype.map/forEach/filter/indexOf`, or `JSON`.
- The **value of the last expression** is returned. Wrap an object literal in parentheses: `({ a: 1 });`.
- Return **plain data** (strings, numbers, arrays, simple objects). Premiere DOM objects are serialized recursively up to depth 6, which is slow and noisy. Pick the fields you need.
- Collections use `numItems` / `numTracks` / `numSequences` and index access (`clips[i]`), not `.length`.
- Time objects have `.seconds` and `.ticks` (254016000000 ticks per second). Most setters accept seconds or a `Time`.
- Track indices are 0-based: `seq.videoTracks[0]` is V1.
- Use forward slashes in file paths (`"C:/Videos/a.mp4"`), or escape backslashes.
- Errors come back as tool errors containing the ExtendScript message.
- For features missing from the standard DOM, `app.enableQE()` exposes the undocumented `qe` DOM. Use it sparingly.

## Common snippets

```javascript
// Active sequence clips
var s = app.project.activeSequence, out = [];
for (var t = 0; t < s.videoTracks.numTracks; t++)
  for (var i = 0; i < s.videoTracks[t].clips.numItems; i++) {
    var c = s.videoTracks[t].clips[i];
    out.push({ track: "V" + (t + 1), name: c.name, start: c.start.seconds, end: c.end.seconds });
  }
out;
```

```javascript
// Marker at playhead
var s = app.project.activeSequence;
var m = s.markers.createMarker(s.getPlayerPosition().seconds); m.name = "Note"; m.name;
```

See `examples/` for more. API reference: https://ppro-scripting.docsforadobe.dev/

## Repo development

- Zero dependencies. Keep it that way unless there's a strong reason.
- `npm run check` and `npm test` must pass. Tests don't need Premiere.
- `extension/host/host.jsx` and `extension/client/main.js` run inside Premiere (ExtendScript ES3 and CEP Node, respectively). Keep `host.jsx` ES3.
- New built-in commands go in `COMMANDS` in `host.jsx` and in `TOOLS` in `mcp/server.js`. Add a test to `test/host.test.cjs`.
