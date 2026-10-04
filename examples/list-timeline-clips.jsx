// Lists every clip on the active sequence's video and audio tracks.
// Use with the bridge_eval tool; the value of the last expression is returned.
var seq = app.project.activeSequence;
var out = [];
function collect(tracks, prefix) {
    for (var t = 0; t < tracks.numTracks; t++) {
        var clips = tracks[t].clips;
        for (var i = 0; i < clips.numItems; i++) {
            var c = clips[i];
            out.push({ track: prefix + (t + 1), name: c.name, start: c.start.seconds, end: c.end.seconds });
        }
    }
}
if (seq) { collect(seq.videoTracks, "V"); collect(seq.audioTracks, "A"); }
seq ? out : "No active sequence";
