// Adds a named sequence marker at the playhead.
var seq = app.project.activeSequence;
var at = seq.getPlayerPosition().seconds;
var m = seq.markers.createMarker(at);
m.name = "Claude marker";
m.comments = "Added via Claude Bridge";
({ name: m.name, seconds: at });
