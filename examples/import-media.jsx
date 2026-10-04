// Imports files into a "Claude Imports" bin. Edit the paths first (use forward slashes or escaped backslashes).
var files = ["C:/Videos/broll-01.mp4", "C:/Videos/music.wav"];
var root = app.project.rootItem;
var bin = null;
for (var i = 0; i < root.children.numItems; i++) {
    if (root.children[i].name === "Claude Imports" && root.children[i].type === 2) bin = root.children[i];
}
if (!bin) bin = root.createBin("Claude Imports");
app.project.importFiles(files, true, bin, false);
({ bin: bin.name, items: bin.children.numItems });
