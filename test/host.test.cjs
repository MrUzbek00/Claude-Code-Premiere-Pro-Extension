// ExtendScript host: commands, eval, and the hand-written JSON serializer, run against a fake `app`.
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SRC = fs.readFileSync(path.join(__dirname, "..", "extension", "host", "host.jsx"), "utf8");

function host() {
  const ctx = {
    app: {
      version: "26.0.0",
      project: {
        name: "Demo.prproj",
        path: "C:\\Videos\\Demo.prproj",
        sequences: { numSequences: 1, 0: { name: "Main", sequenceID: "seq-1" } },
        rootItem: { children: { numItems: 1, 0: { name: "clip.mp4", type: 1, nodeId: "n1" } } },
        activeSequence: {
          name: "Main",
          videoTracks: { numTracks: 3 },
          audioTracks: { numTracks: 2 },
          end: "2540160000000",
          getPlayerPosition: () => ({ seconds: 4.5 }),
        },
      },
    },
  };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  return (req) => JSON.parse(vm.runInContext(`__bridgeExec(${JSON.stringify(JSON.stringify(req))})`, ctx));
}

test("built-in commands", () => {
  const exec = host();
  assert.deepEqual(exec({ cmd: "ping" }), { ok: true, result: { version: "26.0.0", project: "Demo.prproj", activeSequence: "Main" } });
  assert.deepEqual(exec({ cmd: "listSequences" }).result, [{ name: "Main", id: "seq-1" }]);
  assert.deepEqual(exec({ cmd: "listRootItems" }).result, [{ name: "clip.mp4", type: 1, nodeId: "n1" }]);
  assert.equal(exec({ cmd: "activeSequenceInfo" }).result.playerPosition, 4.5);
  assert.equal(exec({ cmd: "projectInfo" }).result.sequences, 1);
});

test("eval returns the last expression and reports errors", () => {
  const exec = host();
  assert.deepEqual(exec({ cmd: "eval", code: "var a = 2; ({ sum: a + 3, list: [1, 'x', null] });" }).result, { sum: 5, list: [1, "x", null] });
  const bad = exec({ cmd: "eval", code: "notDefined.foo" });
  assert.equal(bad.ok, false);
  assert.match(bad.error, /notDefined/);
  assert.deepEqual(exec({ cmd: "nope" }), { ok: false, error: "Error: Unknown command: nope" });
});

test("serializer escapes strings into valid JSON", () => {
  const tricky = 'quote " slash \\ newline \n tab \t ctrl \u0001 sep \u2028 done';
  const exec = host();
  assert.equal(exec({ cmd: "eval", code: JSON.stringify(tricky) }).result, tricky);
  assert.equal(exec({ cmd: "eval", code: "1 / 0" }).result, null);
});
