#!/usr/bin/env node
// Tiny static server for public/ (used by the tests; no dependencies). PORT=4173 by default.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REHEARSAL = process.argv.includes("--rehearsal");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", REHEARSAL ? "build/xue-er-rehearsal" : "public");
const TYPES = { ".html": "text/html; charset=utf-8", ".webp": "image/webp", ".png": "image/png", ".md": "text/markdown; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
const port = Number(REHEARSAL ? 4175 : process.env.PORT || 4173);
http.createServer((req, res) => {
  let rel;
  try { rel = decodeURIComponent(new URL(req.url, "http://x").pathname); }
  catch { res.writeHead(400); return res.end("bad path"); }
  if (rel.endsWith("/")) rel += "index.html";
  const f = path.join(ROOT, rel);
  if (rel.split("/").some(part => part.startsWith(".") || part.startsWith("_")) || !f.startsWith(ROOT + path.sep) || !fs.existsSync(f) || !fs.statSync(f).isFile() || !fs.realpathSync(f).startsWith(fs.realpathSync(ROOT) + path.sep)) {
    res.writeHead(404, { "content-type": "text/plain" }); return res.end("not found");
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
}).listen(port, "127.0.0.1", () => console.log(`serving ${ROOT} on http://127.0.0.1:${port}`));
