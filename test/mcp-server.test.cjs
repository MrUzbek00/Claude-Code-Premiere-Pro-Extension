// MCP stdio server: protocol handling and forwarding to a fake bridge.
const { test } = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { tempHome, freePort } = require("./helpers.cjs");

const SERVER = path.join(__dirname, "..", "mcp", "server.js");

function startMcp(env) {
  const child = spawn(process.execPath, [SERVER], { env: { ...process.env, ...env }, stdio: ["pipe", "pipe", "inherit"] });
  const pending = new Map();
  let buf = "", nextId = 1;
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    buf += chunk;
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const msg = JSON.parse(buf.slice(0, i));
      buf = buf.slice(i + 1);
      pending.get(msg.id)?.(msg);
      pending.delete(msg.id);
    }
  });
  return {
    call(method, params) {
      const id = nextId++;
      return new Promise((resolve) => {
        pending.set(id, resolve);
        child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
      });
    },
    stop: () => child.kill(),
  };
}

function fakeBridge(handler) {
  const seen = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const parsed = JSON.parse(body);
      seen.push({ auth: req.headers.authorization, body: parsed });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(handler(parsed)));
    });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, seen, port: server.address().port })));
}

test("initialize and tools/list", async () => {
  const mcp = startMcp(tempHome().env);
  try {
    const init = await mcp.call("initialize", { protocolVersion: "2025-06-18" });
    assert.equal(init.result.serverInfo.name, "premiere-bridge");
    assert.equal(init.result.protocolVersion, "2025-06-18");
    const list = await mcp.call("tools/list");
    const names = list.result.tools.map((t) => t.name);
    assert.deepEqual(names, ["bridge_ping", "bridge_project_info", "bridge_list_sequences", "bridge_list_root_items", "bridge_active_sequence", "bridge_eval"]);
    assert.ok(list.result.tools.every((t) => t.inputSchema && !("run" in t)));
    const unknown = await mcp.call("resources/list");
    assert.equal(unknown.error.code, -32601);
  } finally { mcp.stop(); }
});

test("tool calls are forwarded with the bearer token", async () => {
  const bridge = await fakeBridge((req) => ({ ok: true, result: { cmd: req.cmd, code: req.code ?? null } }));
  const mcp = startMcp({ ...tempHome("secret-token").env, PREMIERE_BRIDGE_PORT: String(bridge.port) });
  try {
    const ping = await mcp.call("tools/call", { name: "bridge_ping", arguments: {} });
    assert.deepEqual(JSON.parse(ping.result.content[0].text), { cmd: "ping", code: null });
    const ev = await mcp.call("tools/call", { name: "bridge_eval", arguments: { code: "app.version" } });
    assert.deepEqual(JSON.parse(ev.result.content[0].text), { cmd: "eval", code: "app.version" });
    assert.ok(bridge.seen.every((s) => s.auth === "Bearer secret-token"));
  } finally { mcp.stop(); bridge.server.close(); }
});

test("bridge errors are returned as tool errors", async () => {
  const bridge = await fakeBridge(() => ({ ok: false, error: "ReferenceError: foo is undefined" }));
  const mcp = startMcp({ ...tempHome("t").env, PREMIERE_BRIDGE_PORT: String(bridge.port) });
  try {
    const r = await mcp.call("tools/call", { name: "bridge_eval", arguments: { code: "foo" } });
    assert.equal(r.result.isError, true);
    assert.match(r.result.content[0].text, /foo is undefined/);
  } finally { mcp.stop(); bridge.server.close(); }
});

test("missing token and unreachable bridge give actionable errors", async () => {
  const noToken = startMcp(tempHome().env);
  try {
    const r = await noToken.call("tools/call", { name: "bridge_ping", arguments: {} });
    assert.equal(r.result.isError, true);
    assert.match(r.result.content[0].text, /Token not found/);
  } finally { noToken.stop(); }

  const port = await freePort();
  const down = startMcp({ ...tempHome("t").env, PREMIERE_BRIDGE_PORT: String(port) });
  try {
    const r = await down.call("tools/call", { name: "bridge_ping", arguments: {} });
    assert.equal(r.result.isError, true);
    assert.match(r.result.content[0].text, /Cannot reach the bridge/);
  } finally { down.stop(); }
});
