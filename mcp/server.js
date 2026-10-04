#!/usr/bin/env node
// Minimal dependency-free MCP stdio server that forwards tool calls to the Premiere panel bridge.
const fs = require("fs");
const os = require("os");
const path = require("path");

const PORT = process.env.PREMIERE_BRIDGE_PORT || "8765";
const URL_BASE = `http://127.0.0.1:${PORT}`;
const TOKEN_FILE = path.join(os.homedir(), ".premiere-bridge", "token");

async function rpc(cmd, args, code) {
  let token;
  try { token = fs.readFileSync(TOKEN_FILE, "utf8").trim(); }
  catch { throw new Error(`Token not found at ${TOKEN_FILE}. Open the Claude Bridge panel in Premiere first.`); }
  let res;
  try {
    res = await fetch(`${URL_BASE}/rpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ cmd, args, code }),
    });
  } catch {
    throw new Error(`Cannot reach the bridge at ${URL_BASE}. Open Premiere Pro and the Window > Extensions > Claude Bridge panel.`);
  }
  const data = await res.json().catch(() => ({ ok: false, error: `Bridge returned HTTP ${res.status}` }));
  if (!data.ok) throw new Error(data.error || "Bridge error");
  return data.result;
}

const noArgs = { type: "object", properties: {} };
const TOOLS = [
  { name: "bridge_ping", description: "Premiere version, open project, active sequence.", inputSchema: noArgs, run: () => rpc("ping") },
  { name: "bridge_project_info", description: "Active project name, path, counts.", inputSchema: noArgs, run: () => rpc("projectInfo") },
  { name: "bridge_list_sequences", description: "List sequences in the project.", inputSchema: noArgs, run: () => rpc("listSequences") },
  { name: "bridge_list_root_items", description: "List items in the project root bin.", inputSchema: noArgs, run: () => rpc("listRootItems") },
  { name: "bridge_active_sequence", description: "Info on the active sequence.", inputSchema: noArgs, run: () => rpc("activeSequenceInfo") },
  {
    name: "bridge_eval",
    description: "Run arbitrary ExtendScript in Premiere. The last expression's value is returned. Can modify the project.",
    inputSchema: { type: "object", properties: { code: { type: "string" } }, required: ["code"] },
    run: (a) => rpc("eval", {}, a.code),
  },
];

function reply(id, result, error) {
  const msg = error ? { jsonrpc: "2.0", id, error } : { jsonrpc: "2.0", id, result };
  process.stdout.write(JSON.stringify(msg) + "\n");
}

async function handle(msg) {
  const { id, method, params } = msg;
  if (id === undefined) return; // notification
  switch (method) {
    case "initialize":
      return reply(id, {
        protocolVersion: params?.protocolVersion || "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "premiere-bridge", version: "1.0.0" },
      });
    case "ping":
      return reply(id, {});
    case "tools/list":
      return reply(id, { tools: TOOLS.map(({ run, ...t }) => t) });
    case "tools/call": {
      const tool = TOOLS.find((t) => t.name === params?.name);
      if (!tool) return reply(id, null, { code: -32602, message: "Unknown tool" });
      try {
        const out = await tool.run(params.arguments || {});
        return reply(id, { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] });
      } catch (e) {
        return reply(id, { content: [{ type: "text", text: String(e.message) }], isError: true });
      }
    }
    default:
      return reply(id, null, { code: -32601, message: "Method not found" });
  }
}

let buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buf += chunk;
  let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    try { handle(JSON.parse(line)); } catch { /* ignore malformed */ }
  }
});
