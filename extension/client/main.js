// CEP panel: hosts a localhost-only HTTP server and forwards requests to ExtendScript.
// Requires the manifest flags --enable-nodejs --mixed-context.
(function () {
  var http = require("http");
  var fs = require("fs");
  var os = require("os");
  var path = require("path");
  var crypto = require("crypto");

  var PORT = parseInt(process.env.PREMIERE_BRIDGE_PORT || "8765", 10);
  var HOST = "127.0.0.1";
  var MAX_BODY = 1024 * 1024;
  var DIR = path.join(os.homedir(), ".premiere-bridge");
  var TOKEN_FILE = path.join(DIR, "token");

  var $ = function (id) { return document.getElementById(id); };
  function log(msg) {
    var el = $("log");
    el.textContent += new Date().toLocaleTimeString() + " " + msg + "\n";
    el.scrollTop = el.scrollHeight;
  }
  function setStatus(text, cls) {
    $("status").textContent = text;
    $("dot").className = "dot " + (cls || "");
  }

  function loadToken() {
    try { return fs.readFileSync(TOKEN_FILE, "utf8").trim(); } catch (e) {}
    fs.mkdirSync(DIR, { recursive: true });
    var t = crypto.randomBytes(24).toString("hex");
    fs.writeFileSync(TOKEN_FILE, t, { mode: 384 });
    return t;
  }
  var TOKEN = loadToken();

  function evalHost(req) {
    return new Promise(function (resolve) {
      var script = "__bridgeExec(" + JSON.stringify(JSON.stringify(req)) + ")";
      window.__adobe_cep__.evalScript(script, function (raw) {
        try { resolve(JSON.parse(raw)); }
        catch (e) { resolve({ ok: false, error: "Bad host response: " + raw }); }
      });
    });
  }

  function send(res, code, obj) {
    var body = JSON.stringify(obj);
    res.writeHead(code, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) });
    res.end(body);
  }

  function tokenOk(header) {
    var given = Buffer.from((header || "").replace(/^Bearer /, ""));
    var want = Buffer.from(TOKEN);
    return given.length === want.length && crypto.timingSafeEqual(given, want);
  }

  var server = http.createServer(function (req, res) {
    // Block browser-originated requests (CSRF) and DNS rebinding.
    if (req.headers.origin) return send(res, 403, { ok: false, error: "Browser origins not allowed" });
    var hostHeader = (req.headers.host || "").split(":")[0];
    if (hostHeader !== "127.0.0.1" && hostHeader !== "localhost") return send(res, 403, { ok: false, error: "Bad host" });

    if (req.method === "GET" && req.url === "/health") return send(res, 200, { ok: true, bridge: "premiere-bridge", port: PORT });

    if (req.method === "POST" && req.url === "/rpc") {
      if (!tokenOk(req.headers.authorization)) return send(res, 401, { ok: false, error: "Unauthorized" });
      var chunks = [], size = 0;
      req.on("data", function (c) {
        size += c.length;
        if (size > MAX_BODY) { send(res, 413, { ok: false, error: "Too large" }); req.destroy(); return; }
        chunks.push(c);
      });
      req.on("end", function () {
        var body;
        try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
        catch (e) { return send(res, 400, { ok: false, error: "Invalid JSON" }); }
        if (!body || typeof body.cmd !== "string") return send(res, 400, { ok: false, error: "Missing cmd" });
        log(body.cmd);
        evalHost(body).then(function (r) { send(res, 200, r); });
      });
      return;
    }
    send(res, 404, { ok: false, error: "Not found" });
  });

  server.on("error", function (e) {
    setStatus("Server error: " + e.code, "err");
    log(String(e));
  });
  server.listen(PORT, HOST, function () {
    setStatus("Bridge running", "on");
    $("endpoint").textContent = "http://" + HOST + ":" + PORT;
    $("tokenpath").textContent = TOKEN_FILE;
    log("listening");
  });
})();
