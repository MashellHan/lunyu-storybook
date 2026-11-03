#!/usr/bin/env node
// Build the static site. Node only, no dependencies.
//   node scripts/build.mjs            -> public/  (deployed to Cloudflare Workers static assets)
//   node scripts/build.mjs --single   -> dist/index-single.html (one self-contained file, double-click to open)
// src/index.html + styles.css + app.js are inlined into one HTML file; placeholders (__AUDIO__ etc.) are filled.
// Audio is always inlined as data: URIs -- Workers static assets don't answer Range requests,
// which iOS Safari wants for <audio> URLs (see docs/architecture.md).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const p = (...a) => path.join(ROOT, ...a);
const SINGLE = process.argv.includes("--single");

export const CLIPS = ["title", "again", "e1", "e2", "e3", "u1", "u2", "u3", "b1", "c2", "d3", "squeak", "meow", "woof", "trumpet"];
export const IMAGES = {
  __ELEPHANT__: "elephant-640.webp", __CAT__: "cat-640.webp", __BUNNY_EAR__: "bunny-ear.webp", __BUNNY_BASE__: "bunny-base.webp",
  __DOG_TAIL__: "dog-tail.webp", __DOG_BODY__: "dog-body.webp", __DOG_HEAD__: "dog-head.webp",
};
const b64 = (f) => fs.readFileSync(f).toString("base64");

let html = fs.readFileSync(p("src", "index.html"), "utf8");
const css = fs.readFileSync(p("src", "styles.css"), "utf8");
const js = fs.readFileSync(p("src", "app.js"), "utf8");
html = html.replace('<link rel="stylesheet" href="styles.css">', () => `<style>\n${css}</style>`);
html = html.replace('<script src="app.js"></script>', () => `<script>\n${js}</script>`);

const timings = JSON.parse(fs.readFileSync(p("assets", "audio", "timings.json"), "utf8"));
const audio = {}, tim = {};
for (const k of CLIPS) {
  if (!timings[k]) throw new Error(`timings.json has no entry for ${k}`);
  audio[k] = "data:audio/mpeg;base64," + b64(p("assets", "audio", `${k}.mp3`));
  tim[k] = timings[k];
}
const M = { __AUDIO__: JSON.stringify(audio), __TIMINGS__: JSON.stringify(tim) };

let out;
if (SINGLE) {
  for (const [ph, f] of Object.entries(IMAGES)) M[ph] = "data:image/webp;base64," + b64(p("assets", "img", f));
  M.__ICON__ = "data:,";
  fs.mkdirSync(p("dist"), { recursive: true });
  out = p("dist", "index-single.html");
} else {
  fs.rmSync(p("public"), { recursive: true, force: true });
  fs.mkdirSync(p("public", "assets", "img"), { recursive: true });
  for (const [ph, f] of Object.entries(IMAGES)) {
    fs.copyFileSync(p("assets", "img", f), p("public", "assets", "img", f));
    M[ph] = `assets/img/${f}`;
  }
  fs.copyFileSync(p("assets", "img", "icon.png"), p("public", "assets", "img", "icon.png"));
  M.__ICON__ = "assets/img/icon.png";
  fs.copyFileSync(p("assets", "CREDITS.md"), p("public", "CREDITS.md"));
  fs.copyFileSync(p("src", "_headers"), p("public", "_headers"));
  out = p("public", "index.html");
}
for (const [k, v] of Object.entries(M)) html = html.split(k).join(v);
const left = html.match(/__[A-Z_]+__/g);
if (left) throw new Error("unfilled placeholders: " + [...new Set(left)].join(", "));
fs.writeFileSync(out, html);
console.log(path.relative(ROOT, out), Math.round(Buffer.byteLength(html) / 1024), "KB");
