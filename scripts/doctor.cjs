#!/usr/bin/env node
// Checks every link in the chain: Node -> panel install -> debug mode -> token -> bridge -> Premiere -> Claude Code.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const PORT = process.env.PREMIERE_BRIDGE_PORT || "8765";
const URL_BASE = `http://127.0.0.1:${PORT}`;
const TOKEN_FILE = path.join(os.homedir(), ".premiere-bridge", "token");
const EXT_DIR = process.platform === "win32"
  ? path.join(process.env.APPDATA || "", "Adobe", "CEP", "extensions", "com.claude.premierebridge")
  : path.join(os.homedir(), "Library", "Application Support", "Adobe", "CEP", "extensions", "com.claude.premierebridge");

let failed = 0;
function report(ok, label, hint) {
  console.log(`${ok ? "[ok]  " : "[FAIL]"} ${label}${!ok && hint ? `\n       -> ${hint}` : ""}`);
  if (!ok) failed++;
  return ok;
}

function run(cmd, args) {
  try {
    return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: process.platform === "win32" });
  } catch { return null; }
}

function debugModeOn() {
  if (process.platform === "win32") {
    const out = run("reg", ["query", "HKCU\\Software\\Adobe\\CSXS.11", "/v", "PlayerDebugMode"])
      || run("reg", ["query", "HKCU\\Software\\Adobe\\CSXS.12", "/v", "PlayerDebugMode"]);
    return !!out && /PlayerDebugMode\s+REG_SZ\s+1/.test(out);
  }
  if (process.platform === "darwin") return (run("defaults", ["read", "com.adobe.CSXS.11", "PlayerDebugMode"]) || "").trim() === "1";
  return null;
}

(async () => {
  const major = Number(process.versions.node.split(".")[0]);
  report(major >= 18, `Node.js ${process.version}`, "Install Node.js 18 or newer.");

  report(fs.existsSync(path.join(EXT_DIR, "CSXS", "manifest.xml")), `Panel installed at ${EXT_DIR}`,
    "Run scripts/install.ps1 (Windows) or scripts/install.sh (macOS).");

  const dbg = debugModeOn();
  if (dbg !== null) report(dbg, "PlayerDebugMode enabled", "Re-run the install script, then restart Premiere Pro.");

  let token = null;
  try { token = fs.readFileSync(TOKEN_FILE, "utf8").trim(); } catch {}
  report(!!token, `Token file ${TOKEN_FILE}`, "Open Window > Extensions (Legacy) > Claude Bridge in Premiere once; the panel creates it.");

  let healthy = false;
  try {
    const res = await fetch(`${URL_BASE}/health`);
    healthy = res.ok && (await res.json()).bridge === "premiere-bridge";
  } catch {}
  report(healthy, `Bridge answering at ${URL_BASE}`, "Start Premiere Pro and open the Claude Bridge panel. The panel must stay open (it can be docked).");

  if (healthy && token) {
    let info = null, error = null;
    try {
      const res = await fetch(`${URL_BASE}/rpc`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ cmd: "ping" }),
      });
      const data = await res.json();
      if (data.ok) info = data.result; else error = data.error;
    } catch (e) { error = e.message; }
    report(!!info, info
      ? `Premiere Pro ${info.version} | project: ${info.project || "none"} | sequence: ${info.activeSequence || "none"}`
      : `Premiere responds to ping (${error})`,
      error === "Unauthorized" ? "Token mismatch: close and reopen the Claude Bridge panel." : "Reload the panel or restart Premiere Pro.");
  }

  const mcp = run("claude", ["mcp", "get", "premiere-bridge"]);
  report(!!mcp, "Claude Code has MCP server 'premiere-bridge'",
    `claude mcp add premiere-bridge --scope user -- node "${path.resolve(__dirname, "..", "mcp", "server.js")}"`);

  console.log(failed ? `\n${failed} check(s) failed.` : "\nAll checks passed. Ask Claude Code: \"ping Premiere\".");
  process.exit(failed ? 1 : 0);
})();
