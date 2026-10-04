// CEP panel HTTP server: token creation and request filtering.
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { tempHome, freePort, request } = require("./helpers.cjs");

let child, port, token, home;

before(async () => {
  port = await freePort();
  home = tempHome();
  child = spawn(process.execPath, [path.join(__dirname, "fixtures", "panel-harness.cjs")], {
    env: { ...process.env, ...home.env, PREMIERE_BRIDGE_PORT: String(port) },
    stdio: ["ignore", "pipe", "inherit"],
  });
  const line = await new Promise((resolve) => child.stdout.once("data", (d) => resolve(String(d).trim())));
  assert.equal(line, "READY");
  token = fs.readFileSync(path.join(home.dir, ".premiere-bridge", "token"), "utf8").trim();
});

after(() => child && child.kill());

const auth = () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" });

test("creates a random 48-hex-char token", () => {
  assert.match(token, /^[0-9a-f]{48}$/);
});

test("health endpoint needs no token", async () => {
  const r = await request(port, { path: "/health" });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ok: true, bridge: "premiere-bridge", port });
});

test("rpc forwards valid requests to ExtendScript", async () => {
  const r = await request(port, { method: "POST", path: "/rpc", headers: auth(), body: { cmd: "ping" } });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ok: true, result: { echo: { cmd: "ping" } } });
});

test("rejects bad tokens, browser origins, foreign hosts and bad bodies", async () => {
  const post = (headers, body = { cmd: "ping" }) => request(port, { method: "POST", path: "/rpc", headers, body });
  assert.equal((await post({ Authorization: "Bearer wrong" })).status, 401);
  assert.equal((await post({})).status, 401);
  assert.equal((await post({ ...auth(), Origin: "https://evil.example" })).status, 403);
  assert.equal((await post({ ...auth(), Host: "evil.example" })).status, 403);
  assert.equal((await post(auth(), "{not json")).status, 400);
  assert.equal((await post(auth(), { nocmd: true })).status, 400);
  assert.equal((await request(port, { path: "/other" })).status, 404);
});
