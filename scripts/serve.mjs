#!/usr/bin/env node
// Tiny static server for public/ (used by the tests; no dependencies). PORT=4173 by default.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
const TYPES = { ".html": "text/html; charset=utf-8", ".webp": "image/webp", ".png": "image/png", ".md": "text/markdown; charset=utf-8", ".js": "text/javascript", ".css": "text/css" };
const port = Number(process.env.PORT || 4173);
http.createServer((req, res) => {
  let rel = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (rel.endsWith("/")) rel += "index.html";
  const f = path.join(ROOT, rel);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || !fs.statSync(f).isFile() || path.basename(f).startsWith("_")) {
    res.writeHead(404, { "content-type": "text/plain" }); return res.end("not found");
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
}).listen(port, "127.0.0.1", () => console.log(`serving public/ on http://127.0.0.1:${port}`));
