// Shared test helpers: temp home dirs (token location), free ports, and raw HTTP requests.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const net = require("node:net");

function tempHome(token) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "premiere-bridge-"));
  if (token) {
    fs.mkdirSync(path.join(dir, ".premiere-bridge"));
    fs.writeFileSync(path.join(dir, ".premiere-bridge", "token"), token);
  }
  // os.homedir() reads USERPROFILE on Windows and HOME elsewhere.
  return { dir, env: { HOME: dir, USERPROFILE: dir } };
}

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.on("error", reject);
    s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); });
  });
}

function request(port, { method = "GET", path: p = "/", headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, method, path: p, headers }, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null }));
    });
    req.on("error", reject);
    if (body !== undefined) req.write(typeof body === "string" ? body : JSON.stringify(body));
    req.end();
  });
}

module.exports = { tempHome, freePort, request };
