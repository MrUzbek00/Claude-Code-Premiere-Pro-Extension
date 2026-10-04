// Runs extension/client/main.js outside Premiere with DOM and evalScript stubs.
// The fake host echoes each request back. Prints READY once the HTTP server is listening.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const els = {};
const document = {
  getElementById: (id) => els[id] || (els[id] = { textContent: "", className: "", scrollTop: 0, scrollHeight: 0 }),
};
const window = {
  __adobe_cep__: {
    evalScript(script, cb) {
      const req = JSON.parse(JSON.parse(script.slice("__bridgeExec(".length, -1)));
      setImmediate(() => cb(JSON.stringify({ ok: true, result: { echo: req } })));
    },
  },
};

const src = fs.readFileSync(path.join(__dirname, "..", "..", "extension", "client", "main.js"), "utf8");
vm.runInNewContext(src, { require, process, Buffer, document, window, setTimeout, console });

const timer = setInterval(() => {
  const status = els.status ? els.status.textContent : "";
  if (status === "Bridge running" || status.startsWith("Server error")) {
    clearInterval(timer);
    process.stdout.write(status === "Bridge running" ? "READY\n" : status + "\n");
  }
}, 20);
