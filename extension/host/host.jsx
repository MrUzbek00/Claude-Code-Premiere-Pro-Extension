// ExtendScript side of the bridge. Loaded by Premiere via the manifest ScriptPath.
// ExtendScript has no JSON object, so a tiny serializer lives here.

function __ser(v, depth) {
    depth = depth || 0;
    if (v === null || v === undefined) return "null";
    var t = typeof v;
    if (t === "number") return isFinite(v) ? String(v) : "null";
    if (t === "boolean") return v ? "true" : "false";
    if (t === "string") return __quote(v);
    if (depth > 6) return __quote("[max depth]");
    var i, parts = [];
    if (v instanceof Array) {
        for (i = 0; i < v.length; i++) parts.push(__ser(v[i], depth + 1));
        return "[" + parts.join(",") + "]";
    }
    for (var k in v) {
        try {
            if (typeof v[k] === "function") continue;
            parts.push(__quote(k) + ":" + __ser(v[k], depth + 1));
        } catch (e) {}
    }
    return "{" + parts.join(",") + "}";
}

function __quote(s) {
    var out = '"';
    for (var i = 0; i < s.length; i++) {
        var c = s.charAt(i), n = s.charCodeAt(i);
        if (c === '"') out += '\\"';
        else if (c === "\\") out += "\\\\";
        else if (c === "\n") out += "\\n";
        else if (c === "\r") out += "\\r";
        else if (c === "\t") out += "\\t";
        else if (n < 32 || n === 0x2028 || n === 0x2029) {
            var h = n.toString(16);
            out += "\\u" + "0000".substr(h.length) + h;
        } else out += c;
    }
    return out + '"';
}

var COMMANDS = {
    ping: function () {
        return {
            version: app.version,
            project: app.project ? app.project.name : null,
            activeSequence: app.project && app.project.activeSequence ? app.project.activeSequence.name : null
        };
    },
    projectInfo: function () {
        var p = app.project;
        return { name: p.name, path: p.path, sequences: p.sequences.numSequences, rootItems: p.rootItem.children.numItems };
    },
    listSequences: function () {
        var out = [], s = app.project.sequences;
        for (var i = 0; i < s.numSequences; i++) out.push({ name: s[i].name, id: s[i].sequenceID });
        return out;
    },
    listRootItems: function () {
        var out = [], c = app.project.rootItem.children;
        for (var i = 0; i < c.numItems; i++) out.push({ name: c[i].name, type: c[i].type, nodeId: c[i].nodeId });
        return out;
    },
    activeSequenceInfo: function () {
        var s = app.project.activeSequence;
        if (!s) return null;
        return {
            name: s.name,
            videoTracks: s.videoTracks.numTracks,
            audioTracks: s.audioTracks.numTracks,
            end: s.end,
            playerPosition: s.getPlayerPosition().seconds
        };
    }
};

// Entry point called from the panel. reqStr is a JSON string produced by the panel itself.
function __bridgeExec(reqStr) {
    try {
        var req = eval("(" + reqStr + ")");
        var result;
        if (req.cmd === "eval") {
            result = eval(req.code);
        } else if (COMMANDS.hasOwnProperty(req.cmd)) {
            result = COMMANDS[req.cmd](req.args || {});
        } else {
            throw new Error("Unknown command: " + req.cmd);
        }
        return __ser({ ok: true, result: result });
    } catch (e) {
        return __ser({ ok: false, error: String(e) });
    }
}
