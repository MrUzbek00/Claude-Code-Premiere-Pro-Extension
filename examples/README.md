# Examples

ExtendScript snippets for the `bridge_eval` tool. You don't need to paste them yourself. Ask Claude in plain language ("list the clips on my timeline") and it writes similar code. They're here as references and for testing.

| File | What it does |
| --- | --- |
| `list-timeline-clips.jsx` | Returns track, name, start and end (seconds) of every clip in the active sequence |
| `add-marker-at-playhead.jsx` | Adds a named sequence marker at the playhead |
| `import-media.jsx` | Imports files into a `Claude Imports` bin (edit the paths first) |

Run one directly to test the bridge without Claude:

```bash
node -e "const fs=require('fs'),os=require('os');fetch('http://127.0.0.1:8765/rpc',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+fs.readFileSync(os.homedir()+'/.premiere-bridge/token','utf8').trim()},body:JSON.stringify({cmd:'eval',code:fs.readFileSync('examples/list-timeline-clips.jsx','utf8')})}).then(r=>r.json()).then(r=>console.log(JSON.stringify(r,null,2)))"
```
