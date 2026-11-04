#!/usr/bin/env node
// Static home + a real chapter directory; --single writes an offline index and self-contained chapter.
// Chapter audio stays embedded for the existing Workers/iOS Range-request constraint.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadBook, playerData, hash, assessReadiness, ANNOTATIONS_FILE } from "./chapter-data.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const p = (...parts) => path.join(ROOT, ...parts);
const PREVIEW = process.argv.includes("--preview");
const REHEARSAL = process.argv.includes("--rehearsal");
if (PREVIEW && REHEARSAL) throw new Error("Choose static preview or real-media rehearsal");
const SINGLE = PREVIEW || REHEARSAL || process.argv.includes("--single");
const bookData = loadBook();
if (REHEARSAL) for (const chapter of bookData.chapters) chapter.technicalReadiness = assessReadiness(chapter, chapter.scene, bookData.media, { requireListening: false });
const catalog = JSON.parse(fs.readFileSync(p("src", "catalog.json"), "utf8"));
if (catalog.length !== 20) throw new Error("Expected the twenty-volume catalog");
for (const entry of catalog[0].chapters) {
  const chapter = bookData.chapters.find(c => c.id === entry.id);
  if (!chapter || chapter.number !== entry.number || chapter.title !== entry.title) throw new Error("Catalog differs from the frozen edition");
  if (entry.legacyDemo && entry.number !== 1) throw new Error("Only the original first-chapter demo is a legacy release");
  if (entry.status === "ready" && !chapter.readiness.ready) throw new Error(`Not ready: ${entry.id}`);
  entry.publicationReady = chapter.readiness.ready;
  entry.playable = REHEARSAL ? chapter.technicalReadiness.ready : chapter.readiness.ready || entry.legacyDemo === true;
}
if (catalog[0].chapters.length !== 16) throw new Error("Expected all sixteen chapter entries");

export const CLIPS = ["title", "again", "e1", "e2", "e3", "u1", "u2", "u3", "b1", "c2", "d3", "squeak", "meow", "woof", "trumpet"];
export const IMAGES = {
  __ELEPHANT__: "elephant-640.webp", __CAT__: "cat-640.webp", __BUNNY_EAR__: "bunny-ear.webp", __BUNNY_BASE__: "bunny-base.webp",
  __DOG_TAIL__: "dog-tail.webp", __DOG_BODY__: "dog-body.webp", __DOG_HEAD__: "dog-head.webp",
};
const b64 = file => fs.readFileSync(file).toString("base64");
const shared = {};
const output = PREVIEW ? "build/xue-er-preview" : REHEARSAL ? "build/xue-er-rehearsal" : SINGLE ? "dist" : "public";
fs.rmSync(p(output), { recursive: true, force: true });
fs.mkdirSync(p(output), { recursive: true });
for (const [placeholder, file] of Object.entries(IMAGES)) {
  shared[placeholder] = SINGLE ? `data:image/webp;base64,${b64(p("assets", "img", file))}` : `/assets/img/${file}`;
  if (!SINGLE) {
    fs.mkdirSync(p(output, "assets", "img"), { recursive: true });
    fs.copyFileSync(p("assets", "img", file), p(output, "assets", "img", file));
  }
}
shared.__ICON__ = SINGLE ? "data:," : "/assets/img/icon.png";
if (!SINGLE) {
  fs.copyFileSync(p("assets", "img", "icon.png"), p(output, "assets", "img", "icon.png"));
  fs.copyFileSync(p("assets", "CREDITS.md"), p(output, "CREDITS.md"));
  fs.copyFileSync(p("src", "_headers"), p(output, "_headers"));
}

function render(template, cssFile, jsFile, replacements) {
  let html = fs.readFileSync(p("src", template), "utf8");
  html = html.replace(`<link rel="stylesheet" href="${cssFile}">`, () => `<style>\n${fs.readFileSync(p("src", cssFile), "utf8")}</style>`);
  if (jsFile) html = html.replace(`<script src="${jsFile}"></script>`, () => `<script>\n${fs.readFileSync(p("src", jsFile), "utf8")}</script>`);
  for (const [key, value] of Object.entries({ ...shared, ...replacements })) html = html.split(key).join(value);
  const left = html.match(/__[A-Z_]+__/g);
  if (left) throw new Error("unfilled placeholders: " + [...new Set(left)].join(", "));
  if (REHEARSAL) {
    html = html.replace("</head>", '<style>.rehearsal-notice{margin:0;padding:8px 12px;color:#473a28;background:#f3dfb7;text-align:center;font:14px/1.5 system-ui,sans-serif}</style></head>');
    html = html.replace(/(<body\b[^>]*>)/, '$1<aside class="rehearsal-notice" id="rehearsalNotice" role="note">本地预演 · 播放不代表人工听检通过</aside>');
  }
  return html;
}
function write(file, html) {
  const target = p(output, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, html);
  console.log(path.relative(ROOT, target), Math.round(Buffer.byteLength(html) / 1024), "KB");
}

const play = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 10 7-10 7Z"/></svg>';
const enter = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>';
const unavailable = '<span class="volume-state" role="img" aria-label="尚未开放"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 3v18m4-9h4"/></svg></span>';
const escape = text => String(text).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
function annotationMarkup(segments) {
  const meanings = segments.map(segment => `<span data-annotation-segment="${escape(segment.id)}">${escape(segment.annotation.meaning)}</span>`).join(" ");
  const terms = segments.flatMap(segment => segment.annotation.terms.map(term => `<div data-annotation-term-for="${escape(segment.id)}"><dt>${escape(term.term)}</dt><dd>${escape(term.explanation)}</dd></div>`)).join("");
  return `<div class="annotations" role="note" aria-label="注解"><p class="annotation-meaning"><span class="annotation-label">释义：</span>${meanings}</p>${terms ? `<dl class="annotation-terms">${terms}</dl>` : ""}</div>`;
}
const tocIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16M4 12h16M4 19h16"/></svg>';
const urlFor = chapter => SINGLE ? `./${chapter.offline}` : chapter.route;
const volumeURL = SINGLE ? "./xue-er.html" : "/learn/xue-er/";
const homeURL = SINGLE ? "./index.html#xue-er" : "/#xue-er";
function volumeMarkup(volume) {
  const available = volume.chapters.some(chapter => chapter.playable);
  const content = `<span class="volume-number" aria-hidden="true">${String(volume.number).padStart(2, "0")}</span><h2 class="volume-name">${escape(volume.name)}</h2>`;
  const heading = available
    ? `<a${volume.number === 1 ? ' id="xue-er-entry"' : ""} class="volume-heading volume-index" href="${escape(urlFor(volume))}" aria-label="${escape(volume.name)}，进入章目目录">${content}<span class="entry-icon">${enter}</span></a>`
    : `<div class="volume-heading">${content}${unavailable}</div>`;
  return `<li class="volume ${available ? "available" : "unavailable"}" data-available="${available}"${volume.number === 1 ? ' id="xue-er"' : ""}>${heading}</li>`;
}
const shelf = [catalog.slice(0, 10), catalog.slice(10)].map((page, i) => `<ol class="catalog-page" start="${i * 10 + 1}">${page.map(volumeMarkup).join("\n")}</ol>`).join("\n");
const home = render("home.html", "home.css", "home.js", { __CATALOG__: shelf });
if (/data:audio|new Audio\(|<audio\b|rel=["'](?:preload|prefetch)/i.test(home)) throw new Error("Home must not embed or preload audio.");
write("index.html", home);

const entries = catalog[0].chapters.map(entry => {
  const playable = PREVIEW || entry.playable;
  const label = `${entry.number} ${entry.title}${PREVIEW ? "，开发预览，配音尚未就绪" : REHEARSAL ? "，本地预演，非正式发布" : !entry.publicationReady && entry.legacyDemo ? "，现有三句原文" : ""}`;
  const content = `<span class="chapter-number">${entry.number}</span><span class="chapter-name">${escape(entry.title)}</span>${playable ? `<span class="play-icon">${play}</span>` : '<span class="chapter-state" role="img" aria-label="尚未开放"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 3v18m4-9h4"/></svg></span>'}`;
  return `<li id="chapter-${entry.number}" data-publication-ready="${entry.publicationReady}"${REHEARSAL ? ` data-technical-playable="${entry.playable}"` : ""} data-edition="${REHEARSAL && entry.playable ? "rehearsal" : entry.publicationReady ? "complete" : entry.legacyDemo && !PREVIEW && !REHEARSAL ? "legacy-demo" : "pending"}">${playable ? `<a class="chapter-entry" href="${urlFor(entry)}" aria-label="${escape(label)}">${content}</a>` : `<div class="chapter-entry unavailable" aria-disabled="true">${content}</div>`}</li>`;
}).join("\n");
const volume = render("volume.html", "volume.css", null, { __HOME_URL__: homeURL, __CHAPTERS__: entries });
if (/data:audio|new Audio\(|<audio\b|rel=["'](?:preload|prefetch)/i.test(volume)) throw new Error("Volume index must not load audio");
write(SINGLE ? "xue-er.html" : "learn/xue-er/index.html", volume);

const timings = JSON.parse(fs.readFileSync(p("assets", "audio", "timings.json"), "utf8"));
function legacyAudio(keys) {
  const audio = {}, tim = {};
  for (const key of keys) {
    if (!timings[key]) throw new Error(`timings.json has no entry for ${key}`);
    audio[key] = "data:audio/mpeg;base64," + b64(p("assets", "audio", `${key}.mp3`));
    tim[key] = timings[key];
  }
  return { audio, tim };
}
function chapterHTML(chapter, legacy) {
  const data = legacy ? null : playerData(chapter, bookData.design, { preview: PREVIEW, rehearsal: REHEARSAL });
  const { audio, tim } = legacyAudio(legacy ? CLIPS : PREVIEW ? [] : ["again", "squeak", "meow", "woof", "trumpet", ...(chapter.number === 1 ? ["title"] : [])]);
  const playbackReadiness = REHEARSAL ? chapter.technicalReadiness : chapter.readiness;
  if (data && !PREVIEW) for (const [key, clip] of Object.entries(playbackReadiness.clips)) {
    audio[key] = "data:audio/mpeg;base64," + b64(p(clip.file)); tim[key] = clip.timing;
  }
  const toc = `<a class="ctl" id="tocBtn" href="${volumeURL}#chapter-${chapter.number}" aria-label="返回学而篇内章目">${tocIcon}</a>`;
  const fallback = data ? `<main id="chapterFallback" class="chapter-fallback"><a class="ctl" href="${volumeURL}#chapter-${chapter.number}" aria-label="返回学而篇内章目">${tocIcon}</a><h1>${chapter.number} ${escape(chapter.title)}</h1>${data.pages.map(page => `<section>${page.groups.map(group => `<div class="fallback-group"><p class="fallback-line">${[...group.text].map((ch,i) => group.py[i] ? `<ruby>${escape(ch)}<rt>${escape(group.py[i])}</rt></ruby>` : escape(ch)).join("")}</p>${annotationMarkup(group.segments)}</div>`).join("")}</section>`).join("")}</main>` : "";
  return render("index.html", "styles.css", "app.js", {
    __AUDIO__: JSON.stringify(audio), __TIMINGS__: JSON.stringify(tim), __HOME_URL__: homeURL,
    __CHAPTER__: JSON.stringify(data).replaceAll("<", "\\u003c"), __PAGE_TITLE__: escape(chapter.title),
    __BODY_ATTRS__: data ? 'class="chapter-document"' : "", __CHAPTER_FALLBACK__: fallback,
    __CHAPTER_STYLE__: data ? `<style>\n${fs.readFileSync(p("src", "chapter.css"), "utf8")}</style>` : "",
    __CHAPTER_SCRIPT__: data ? `<script>\n${fs.readFileSync(p("src", "chapter-player.js"), "utf8")}</script>` : "",
    __TOC_CONTROL__: data ? toc : "", __VOLUME_RETURN__: data ? "" : `<nav class="volume-return" aria-label="篇内章目">${toc}</nav>`,
    __CHAPTER_HEADING__: data ? `<h1 class="chapter-heading">${chapter.number} ${escape(chapter.title)}</h1>` : "",
    __PAGE_CONTROLS__: data ? '<nav class="page-controls" aria-label="绘本分页"><button type="button" class="page-arrow" id="prevPage" aria-label="上一页"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg></button><span id="pageNumber" aria-live="polite"></span><button type="button" class="ctl" id="readBtn" aria-label="从当前页开始朗读">' + play + '</button><button type="button" class="page-arrow" id="nextPage" aria-label="下一页"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button></nav>' : "",
  });
}
for (const entry of catalog[0].chapters) {
  if (!PREVIEW && !entry.playable) continue;
  const chapter = bookData.chapters.find(c => c.id === entry.id);
  const html = chapterHTML(chapter, !PREVIEW && !REHEARSAL && !entry.publicationReady);
  write(SINGLE ? entry.offline : path.join(entry.route.slice(1), "index.html"), html);
}
// Keep the original three-sentence flow available only to local regression tests.
if (SINGLE && !PREVIEW && !REHEARSAL) {
  fs.mkdirSync(p("build/legacy-regression"), { recursive: true });
  fs.writeFileSync(p("build/legacy-regression/index-single.html"), chapterHTML(bookData.chapters[0], true));
}
fs.mkdirSync(p("build"), { recursive: true });
fs.writeFileSync(p("build", `xue-er-readiness-${PREVIEW ? "preview" : REHEARSAL ? "rehearsal" : SINGLE ? "offline" : "online"}.json`), JSON.stringify({
  contentSHA256: bookData.media.contentSHA256,
  sceneSHA256: hash(fs.readFileSync(p("docs/design/xue-er-scene-config.json"))),
  annotationsSHA256: hash(fs.readFileSync(p(ANNOTATIONS_FILE))),
  counts: bookData.counts, output, preview: PREVIEW, rehearsal: REHEARSAL,
  releaseAuthorization: bookData.releaseAuthorization,
  chapters: bookData.chapters.map(c => ({ id: c.id, pages: c.scene.pages.length, ready: c.readiness.ready, blockers: c.readiness.blockers,
    ...(REHEARSAL ? { technicalPlayable: c.technicalReadiness.ready, technicalBlockers: c.technicalReadiness.blockers } : {}),
  })),
}, null, 2) + "\n");
