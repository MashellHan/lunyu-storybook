import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { loadBook, ROOT } from "../scripts/chapter-data.mjs";
import { writeRuntimeFixture } from "./chapter-fixture.mjs";
import { fastAudio, watch, chapterConfig } from "./helpers.js";

const artifacts = path.join(ROOT, "tests/artifacts/xue-er-direct-release");
const preview = number => pathToFileURL(path.join(ROOT, "build/xue-er-preview", number === 1 ? "index-single.html" : `xue-er-${String(number).padStart(2, "0")}.html`)).href;
const rehearsalFile = number => path.join(ROOT, "build/xue-er-rehearsal", number === 1 ? "index-single.html" : `xue-er-${String(number).padStart(2, "0")}.html`);
const rehearsal = number => pathToFileURL(rehearsalFile(number)).href;
async function observeAudio(page) {
  await page.addInitScript(() => {
    window.__audioInstances = []; window.__endedKeys = [];
    window.Audio = new Proxy(window.Audio, { construct(target, args) {
      const audio = Reflect.construct(target, args); window.__audioInstances.push(audio);
      audio.addEventListener("ended", () => window.__endedKeys.push(window.__log.at(-1)?.key));
      return audio;
    } });
  });
}
const sounds = { bunny: "squeak", cat: "meow", dog: "woof" };
async function expectAnnotations(page, segments, scope = "#cards") {
  const meanings = await page.locator(`${scope} [data-annotation-segment]`).evaluateAll(nodes => nodes.map(node => ({ id: node.dataset.annotationSegment, meaning: node.textContent })));
  expect(meanings).toEqual(segments.map(segment => ({ id: segment.id, meaning: segment.annotation.meaning })));
  const terms = await page.locator(`${scope} [data-annotation-term-for]`).evaluateAll(nodes => nodes.map(node => ({ id: node.dataset.annotationTermFor, term: node.querySelector("dt").textContent, explanation: node.querySelector("dd").textContent })));
  expect(terms).toEqual(segments.flatMap(segment => segment.annotation.terms.map(term => ({ id: segment.id, ...term }))));
  await expect(page.locator(`${scope} .annotations button, ${scope} .annotations .k, ${scope} .annotations [data-source-index]`)).toHaveCount(0);
}
const automaticKeys = config => config.pages.flatMap(page => [
  ...page.groups.flatMap(group => ["elephant", "children"].flatMap(role => group.segments.map(segment => `${segment.id}:${role}`))),
  "again",
  ...page.groups.flatMap(group => [...group.segments.map(segment => `${segment.id}:${group.audio.soloRole}`), ...(sounds[group.audio.soloRole] ? [sounds[group.audio.soloRole]] : [])]),
]);
let book, fixture;
test.describe.configure({ mode: "serial" });
test.beforeAll(() => {
  test.setTimeout(360_000);
  test.skip(!!process.env.BASE_URL, "Unready chapter previews and the v5 harness are local-only");
  execFileSync(process.execPath, [path.join(ROOT, "scripts/build.mjs"), "--preview"], { cwd: ROOT, stdio: "pipe" });
  execFileSync(process.execPath, [path.join(ROOT, "scripts/build.mjs"), "--rehearsal"], { cwd: ROOT, stdio: "pipe" });
  book = loadBook(); fixture = pathToFileURL(writeRuntimeFixture(book)).href;
  fs.mkdirSync(artifacts, { recursive: true });
});

test("the volume directory exposes all sixteen states and links only ready chapters or the legacy demo", async ({ page, request }) => {
  const w = watch(page);
  await page.goto("/");
  await expect(page.getByRole("link")).toHaveCount(1);
  await page.keyboard.press("Tab"); await expect(page.locator(".volume-index")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/learn\/xue-er\/$/);
  await expect(page.locator(".chapter-directory li")).toHaveCount(16);
  const available = book.chapters.filter(chapter => chapter.readiness.ready || chapter.number === 1);
  await expect(page.locator(".chapter-directory a")).toHaveCount(available.length);
  await expect(page.locator('.chapter-entry[aria-disabled="true"]')).toHaveCount(book.chapters.length - available.length);
  await expect(page.locator('[data-publication-ready="true"]')).toHaveCount(book.chapters.filter(chapter => chapter.readiness.ready).length);
  for (const chapter of book.chapters) {
    const entry = page.locator(`#chapter-${chapter.number}`);
    await expect(entry).toHaveAttribute("data-edition", chapter.readiness.ready ? "complete" : chapter.number === 1 ? "legacy-demo" : "pending");
    if (chapter.readiness.ready || chapter.number === 1) await expect(entry.locator("a")).toHaveAttribute("href", `/learn/xue-er/${chapter.number}/`);
    else await expect(entry.locator("a")).toHaveCount(0);
  }
  expect(await page.content()).not.toMatch(/data:audio|new Audio\(|<audio\b|rel=["'](?:preload|prefetch)/i);
  await page.locator("#chapter-1 a").click();
  await page.locator("#stopBtn").click(); await page.locator("#tocBtn").click();
  await expect(page).toHaveURL(/\/learn\/xue-er\/#chapter-1$/);
  await page.reload(); await expect(page.locator("#chapter-1 a")).toBeVisible();
  for (const number of [2, 3, 7, 15, 16]) expect((await request.get(`/learn/xue-er/${number}/`)).status()).toBe(book.chapters[number - 1].readiness.ready ? 200 : 404);
  w.expectClean();
});

test("offline volume discovery and return work without loading other chapters or audio", async ({ page, context }) => {
  await context.setOffline(true);
  const index = pathToFileURL(path.join(ROOT, "dist/index.html")).href;
  const w = watch(page); await page.goto(index);
  await page.locator(".volume-index").click(); await expect(page.locator(".chapter-directory li")).toHaveCount(16);
  await page.locator("#chapter-1 a").click(); await page.locator("#stopBtn").click();
  await page.locator("#tocBtn").click(); await expect(page).toHaveURL(/xue-er\.html#chapter-1$/);
  await page.locator(".back").click(); await expect(page).toHaveURL(index + "#xue-er");
  await expect(page.locator(".volume-index")).toBeFocused();
  expect(w.ok.every(url => /^(file|data):/.test(url))).toBe(true); w.expectClean();
});

test("real-media rehearsal keeps its notice and production follows the separate release authorization", async ({ page, context }) => {
  const report = JSON.parse(fs.readFileSync(path.join(ROOT, "build/xue-er-readiness-rehearsal.json"), "utf8"));
  expect(report.chapters).toHaveLength(16);
  expect(report.chapters.every(c => c.technicalPlayable && !c.technicalBlockers.length)).toBe(true);
  expect(report.chapters.map(c => c.ready)).toEqual(book.chapters.map(c => c.readiness.ready));
  await context.setOffline(true);
  const index = pathToFileURL(path.join(ROOT, "build/xue-er-rehearsal/xue-er.html")).href;
  const w = watch(page); await page.goto(index);
  await expect(page.locator('.chapter-directory [data-edition="rehearsal"] a')).toHaveCount(16);
  expect(await page.content()).not.toMatch(/data:audio|new Audio\(|<audio\b/i);
  for (const chapter of book.chapters) {
    await page.goto(rehearsal(chapter.number));
    await expect(page.locator("#rehearsalNotice")).toHaveText("本地预演 · 播放不代表人工听检通过");
    await expect(page.locator("#ttMain")).toHaveText(chapter.title);
    await expect(page.locator("#book")).toHaveAttribute("data-playable", "true");
    await expect(page.locator("#book")).toHaveAttribute("data-publication-ready", String(chapter.readiness.ready));
    const config = await chapterConfig(page);
    expect(config.pages.flatMap(p => p.groups.flatMap(g => g.segments.map(s => s.text))).join("")).toBe(chapter.fullText);
    const timing = await page.evaluate(() => JSON.parse([...document.scripts].find(s => /const TIM = /.test(s.textContent)).textContent.match(/const TIM = ([^\n]+);/)[1]));
    expect(timing.title.text).toBe(config.titleReadingText);
    for (const p of config.pages) for (const g of p.groups) for (const s of g.segments) for (const role of chapter.number === 1 ? ["elephant", "children", g.audio.soloRole] : ["elephant", "children", "bunny", "cat", "dog"]) {
      const ref = book.media.segments[s.id][role];
      if (!ref.legacy) expect(timing[`${s.id}:${role}`]).toEqual(JSON.parse(fs.readFileSync(path.join(ROOT, ref.timingFile), "utf8")));
    }
    const published = chapter.readiness.ready || chapter.number === 1;
    expect(fs.existsSync(path.join(ROOT, `public/learn/xue-er/${chapter.number}/index.html`))).toBe(published);
    expect(fs.existsSync(path.join(ROOT, "dist", path.basename(rehearsalFile(chapter.number))))).toBe(published);
  }
  for (const file of ["public/index.html", "public/learn/xue-er/index.html", "public/learn/xue-er/1/index.html", "dist/index.html", "dist/xue-er.html", "dist/index-single.html"]) {
    expect(fs.readFileSync(path.join(ROOT, file), "utf8")).not.toMatch(/rehearsalNotice|"rehearsal":true|xue-er-preview|runtime-fixture/);
  }
  await page.locator("#stopBtn").click(); await page.locator("#tocBtn").click();
  await expect(page).toHaveURL(index + "#chapter-16");
  expect(w.ok.every(url => /^(file|data):/.test(url))).toBe(true); w.expectClean();
});

test("real short chapter reads its new title, lead, follow and solo to genuine media endings on one Audio", async ({ page }) => {
  await fastAudio(page); await observeAudio(page); const w = watch(page);
  await page.goto(rehearsal(3)); const config = await chapterConfig(page);
  await expect(page.locator("#ttMain")).toHaveText("巧言令色");
  await page.locator("#startBtn").click();
  await expect.poll(() => page.evaluate(() => window.__log.at(-1)?.key === "title" && window.__demo.audio.currentTime > .03)).toBe(true);
  await expect(page.locator("#book")).toHaveAttribute("data-step", "free", { timeout: 40_000 });
  const ended = await page.evaluate(() => window.__endedKeys);
  expect(ended).toEqual(["title", ...automaticKeys(config)]);
  await expect(page.locator(".star.on")).toHaveCount(config.pages[0].groups.length);
  expect(await page.evaluate(() => window.__audioInstances.length === 1 && window.__audioInstances[0] === window.__demo.audio)).toBe(true);
  fs.writeFileSync(path.join(artifacts, "rehearsal-short-flow.json"), JSON.stringify({ chapter: config.id, ended, playbackRates: { title: 4, speech: 8, animalCall: 2 }, realMediaEndEvents: true, oneAudio: true, humanListening: false }, null, 2));
  w.expectClean();
});

test("real long chapter continues through both pages with every lead, follow and solo segment in order", async ({ page }) => {
  await fastAudio(page); await observeAudio(page); const w = watch(page);
  await page.goto(rehearsal(2)); const config = await chapterConfig(page);
  await page.locator("#stopBtn").click(); await page.locator("#readBtn").click();
  await expect(page.locator("#book")).toHaveAttribute("data-page", config.pages.at(-1).pageId, { timeout: 40_000 });
  await expect(page.locator("#book")).toHaveAttribute("data-step", "free", { timeout: 20_000 });
  const ended = await page.evaluate(() => window.__endedKeys);
  expect(ended).toEqual(automaticKeys(config));
  for (let i = config.pages.length - 1; i >= 0; i--) {
    await expect(page.locator(".star.on")).toHaveCount(config.pages[i].groups.length);
    if (i) await page.locator("#prevPage").click();
  }
  expect(await page.evaluate(() => window.__audioInstances.length)).toBe(1);
  fs.writeFileSync(path.join(artifacts, "rehearsal-long-flow.json"), JSON.stringify({ chapter: config.id, pages: config.pages.map(p => p.pageId), ended, speechPlaybackRate: 8, realMediaEndEvents: true, humanListening: false }, null, 2));
  w.expectClean();
});

test("real rehearsal page changes cancel paused audio and rapid prop input cannot revive older waits or ended callbacks", async ({ page }) => {
  await observeAudio(page); const w = watch(page); await page.goto(rehearsal(2));
  await page.locator("#stopBtn").click(); await page.locator(".card").first().click();
  await expect.poll(() => page.evaluate(() => window.__log.at(-1)?.key === "xue-er-02-s02:elephant" && window.__demo.audio.currentTime > .05)).toBe(true);
  await page.evaluate(() => { window.__staleEnded = window.__demo.audio.onended; });
  await page.locator("#pauseBtn").click(); await page.locator("#nextPage").click();
  await expect(page.locator("#book")).toHaveAttribute("data-page", "xue-er-02-p02");
  await expect(page.locator("#book")).toHaveAttribute("data-step", "free");
  await expect(page.locator("#pauseBtn")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".star.on,.card .cur,.card .done,.aBubble.show")).toHaveCount(0);
  const count = await page.evaluate(() => { window.__staleEnded?.(); return window.__log.length; });
  await page.waitForTimeout(1000); expect(await page.evaluate(() => window.__log.length)).toBe(count);
  expect(await page.evaluate(() => window.__demo.audio.paused)).toBe(true);
  await page.locator("#dog").click(); await page.locator('button[data-prop="roots"]').focus(); await page.keyboard.press("Space");
  await expect.poll(() => page.evaluate(() => window.__demo.audio.currentTime)).toBeGreaterThan(.1);
  await page.waitForTimeout(1000); await page.locator("#pauseBtn").click();
  expect(await page.evaluate(n => window.__log.slice(n).map(x => x.key), count)).toEqual(["xue-er-02-s04:elephant"]);
  expect(await page.evaluate(() => window.__audioInstances.length === 1 && window.__audioInstances[0] === window.__demo.audio)).toBe(true);
  await page.locator("#stopBtn").click(); await expect(page.locator(".star.on,.card .cur,.card .done")).toHaveCount(0);
  w.expectClean();
});

test("all three real SDK word groups highlight both source characters together and cancel across pause, stop and page change", async ({ page }) => {
  await observeAudio(page); await page.setViewportSize({ width: 390, height: 844 });
  const w = watch(page), evidence = [];
  for (const [number, id] of [[4, "xue-er-04-s05"], [7, "xue-er-07-s03"], [15, "xue-er-15-s11"]]) {
    const chapter = book.chapters[number - 1], segment = chapter.segments.find(s => s.id === id);
    const ref = book.media.segments[id].dog, timing = JSON.parse(fs.readFileSync(path.join(ROOT, ref.timingFile), "utf8"));
    const group = timing.wordGroups[0];
    expect(group.sourceDurationSeconds).toBe(0);
    expect(group.sourceIndexes.map(i => timing.t[i])).toEqual(group.sourceIndexes.map(() => group.offsetSeconds));
    await page.goto(rehearsal(number)); await page.locator("#stopBtn").click();
    const config = await chapterConfig(page), pageIndex = config.pages.findIndex(p => p.segmentIds.includes(id));
    for (let i = 0; i < pageIndex; i++) await page.locator("#nextPage").click();
    await page.locator(`.card:has([data-segment="${id}"])`).click(); await page.locator("#dog").click();
    const held = await page.evaluate(({ id, indexes }) => new Promise((resolve, reject) => {
      const deadline = performance.now() + 20_000;
      function frame() {
        const nodes = [...document.querySelectorAll(`.k[data-segment="${id}"]`)];
        if (window.__log.at(-1)?.key === `${id}:dog` && indexes.every(i => nodes[i].classList.contains("cur"))) {
          window.__staleEnded = window.__demo.audio.onended;
          document.querySelector("#pauseBtn").click();
          resolve({ time: window.__demo.audio.currentTime, active: nodes.filter(n => n.classList.contains("cur")).map(n => Number(n.dataset.sourceIndex)), done: indexes.map(i => nodes[i].classList.contains("done")), text: indexes.map(i => nodes[i].querySelector("ruby").firstChild.textContent).join("") });
        } else if (performance.now() > deadline) reject(new Error(`Shared word did not highlight: ${id}`));
        else requestAnimationFrame(frame);
      }
      frame();
    }), { id, indexes: group.sourceIndexes });
    expect(held.active).toEqual(group.sourceIndexes.map(i => segment.start + i));
    expect(held.done).toEqual(group.sourceIndexes.map(() => false));
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.__demo.audio.currentTime)).toBeCloseTo(held.time, 2);
    await expect(page.locator(`.k[data-segment="${id}"].cur`)).toHaveCount(group.sourceIndexes.length);
    await page.screenshot({ path: path.join(artifacts, `rehearsal-word-${number}-390x844.png`), fullPage: true });
    await page.locator("#pauseBtn").click();
    await expect.poll(() => page.evaluate(() => window.__demo.audio.currentTime), { intervals: [16, 32] }).toBeGreaterThan(held.time + .04);
    if (number === 4) {
      // The final word stays current until media end; no inferred character duration is written.
      const late = await page.evaluate(({ id, threshold }) => new Promise((resolve, reject) => {
        const deadline = performance.now() + 2000;
        function frame() {
          const audio = window.__demo.audio;
          if (window.__log.at(-1)?.key !== `${id}:dog` || audio.ended) return reject(new Error("Missed final word interval"));
          if (audio.currentTime >= threshold) { document.querySelector("#pauseBtn").click(); return resolve(document.querySelectorAll(`.k[data-segment="${id}"].cur`).length); }
          if (performance.now() > deadline) return reject(new Error("Final word did not advance"));
          requestAnimationFrame(frame);
        }
        frame();
      }), { id, threshold: group.offsetSeconds + .38 });
      expect(late).toBe(2);
    }
    if (number === 7) await page.locator("#nextPage").click(); else await page.locator("#stopBtn").click();
    const count = await page.evaluate(() => { window.__staleEnded?.(); return window.__log.length; });
    await expect(page.locator("#book")).toHaveAttribute("data-step", "free");
    await expect(page.locator(".card .cur,.card .done,.star.on,.aBubble.show")).toHaveCount(0);
    await page.waitForTimeout(1000); expect(await page.evaluate(() => window.__log.length)).toBe(count);
    expect(await page.evaluate(() => window.__demo.audio.paused)).toBe(true);
    await page.locator(".card").first().click();
    await expect.poll(() => page.evaluate(n => window.__log.length > n && window.__demo.audio.currentTime > .03, count)).toBe(true);
    expect(await page.evaluate(() => window.__audioInstances.length === 1 && window.__audioInstances[0] === window.__demo.audio)).toBe(true);
    await page.locator("#stopBtn").click();
    evidence.push({ segment: id, audioSHA256: ref.sha256, wordGroups: timing.wordGroups, held, resumed: true, cancellation: number === 7 ? "page change" : "stop", oldEndedDidNotRevive: true, nextTapPlayed: true, humanListening: false });
  }
  fs.writeFileSync(path.join(artifacts, "real-word-groups.json"), JSON.stringify(evidence, null, 2));
  w.expectClean();
});

test("all preview pages preserve the text, pinyin and seventy-two segment annotations without leaking another page", async ({ page }) => {
  const w = watch(page);
  for (const chapter of book.chapters) {
    await page.goto(preview(chapter.number));
    await expect(page.locator("#ttMain")).toHaveText(chapter.title);
    let text = "", pinyin = [];
    for (let i = 0; i < chapter.scene.pages.length; i++) {
      const scenePage = chapter.scene.pages[i];
      await expectAnnotations(page, scenePage.segmentIds.map(id => chapter.segments.find(segment => segment.id === id)));
      await expect(page.locator("#cards > .reading-group")).toHaveCount(scenePage.readingGroups.length);
      await expect(page.locator("#cards .annotations")).toHaveCount(scenePage.readingGroups.length);
      const positions = await page.locator(".card .k").evaluateAll(nodes => nodes.map(node => ({ text: node.querySelector("ruby")?.firstChild.textContent || node.textContent, py: node.querySelector("rt")?.textContent || "", index: Number(node.dataset.sourceIndex) })));
      expect(positions.map(p => p.index)).toEqual(Array.from({ length: positions.length }, (_, k) => chapter.scene.pages[i].sourceRange[0] + k));
      text += positions.map(p => p.text).join(""); pinyin.push(...positions.map(p => p.py));
      await expect(page.locator("#readBtn")).toBeDisabled(); await expect(page.locator(".star.on")).toHaveCount(0);
      expect(await page.evaluate(() => window.__log)).toEqual([]);
      if (i < chapter.scene.pages.length - 1) await page.locator("#nextPage").click();
    }
    expect(text).toBe(chapter.fullText); expect(pinyin).toEqual(chapter.segments.flatMap(s => s.pinyin));
    expect(await page.content()).not.toMatch(/data:audio/);
  }
  w.expectClean();
});

test("annotation text can be selected without audio and the original reading button still plays and stops", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const w = watch(page); await page.goto(rehearsal(2)); await page.locator("#stopBtn").click();
  const config = await chapterConfig(page), before = await page.evaluate(() => window.__log);
  const note = page.locator("#cards .annotations").first();
  await expect(note).toBeVisible();
  expect(await note.evaluate(node => ({ button: !!node.closest("button"), fontSize: parseFloat(getComputedStyle(node).fontSize), select: getComputedStyle(node).userSelect }))).toEqual({ button: false, fontSize: 18, select: "text" });
  await note.locator("[data-annotation-segment]").last().dblclick();
  expect(await page.evaluate(() => getSelection().toString().length)).toBeGreaterThan(0);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__log)).toEqual(before);
  expect(await page.evaluate(() => window.__demo.audio.paused)).toBe(true);
  await page.locator(".card").first().click();
  const key = `${config.pages[0].groups[0].segments[0].id}:elephant`;
  await expect.poll(() => page.evaluate(key => window.__log.at(-1)?.key === key && window.__demo.audio.currentTime > .03, key)).toBe(true);
  await page.locator("#stopBtn").click();
  await expect(page.locator("#book")).toHaveAttribute("data-step", "free");
  await expect(page.locator(".card .cur,.card .done")).toHaveCount(0);
  await expectAnnotations(page, config.pages[0].groups.flatMap(group => group.segments));
  w.expectClean();
});

test("all twenty-six scene pages keep each character and bound prop visible and readable in six viewports", async ({ page }) => {
  test.setTimeout(120_000);
  const metrics = [];
  for (const [width, height] of [[320, 844], [390, 844], [768, 1024], [844, 390], [1024, 768], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    for (const chapter of book.chapters) {
      await page.goto(preview(chapter.number));
      for (let i = 0; i < chapter.scene.pages.length; i++) {
        const boundIds = chapter.scene.pages[i].propBindings.map(b => b.propId);
        const result = await page.evaluate(boundIds => {
          const box = el => { const r = el.getBoundingClientRect(); return { id: el.id || el.dataset.prop, x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
          return { characters: [...document.querySelectorAll("#cast .char")].map(box), props: [...document.querySelectorAll(".scene-prop")].filter(el => boundIds.includes(el.dataset.prop)).map(box), text: parseFloat(getComputedStyle(document.querySelector(".card .txt")).fontSize), pinyin: parseFloat(getComputedStyle(document.querySelector(".card rt")).fontSize), scrollWidth: document.documentElement.scrollWidth };
        }, boundIds);
        expect(result.characters).toHaveLength(4);
        for (const target of [...result.characters, ...result.props]) {
          expect(target.x, `${chapter.id} ${i} ${width} ${target.id} left`).toBeGreaterThanOrEqual(0);
          expect(target.right, `${chapter.id} ${i} ${width} ${target.id} right`).toBeLessThanOrEqual(width);
          expect(target.width).toBeGreaterThanOrEqual(48); expect(target.height).toBeGreaterThanOrEqual(48);
        }
        const targets = [...result.characters, ...result.props];
        for (let a = 0; a < targets.length; a++) for (let b = a + 1; b < targets.length; b++) {
          const l = targets[a], r = targets[b];
          expect(l.right + 7.9 <= r.x || r.right + 7.9 <= l.x || l.bottom + 7.9 <= r.y || r.bottom + 7.9 <= l.y, `${chapter.id} ${i} ${width}: ${l.id}/${r.id} touch gap`).toBe(true);
        }
        expect(result.text).toBeGreaterThanOrEqual(24); expect(result.pinyin).toBeGreaterThanOrEqual(14); expect(result.scrollWidth).toBeLessThanOrEqual(width);
        const punctuationAtLineStart = await page.locator(".card .txt").evaluateAll(nodes => nodes.flatMap(node => {
          const firstOnLine = new Map();
          for (const glyph of node.querySelectorAll(".k")) {
            const box = glyph.getBoundingClientRect(), key = Math.round(box.bottom);
            if (!firstOnLine.has(key) || box.left < firstOnLine.get(key).x) firstOnLine.set(key, { x: box.left, text: glyph.querySelector("ruby")?.firstChild.textContent || glyph.textContent });
          }
          return [...firstOnLine.values()].filter(glyph => /^[，。！？；：、”’》〉」』）】]$/.test(glyph.text)).map(glyph => glyph.text);
        }));
        expect(punctuationAtLineStart, `${chapter.id} ${i} ${width}: closing punctuation at line start`).toEqual([]);
        metrics.push({ chapter: chapter.id, page: i + 1, width, height, ...result });
        if (chapter.number === 3 || chapter.number === 15 && i === 2 || width === 390 && i === 0 && chapter.number !== 15 || [5, 10, 11, 13].includes(chapter.number) && width === 1024 && i === 0) {
          await page.evaluate(() => scrollTo(0, 0));
          await page.screenshot({ path: path.join(artifacts, `xue-er-${String(chapter.number).padStart(2, "0")}-${width}x${height}.png`), fullPage: true });
        }
        if (i < chapter.scene.pages.length - 1) await page.locator("#nextPage").click();
      }
    }
  }
  fs.writeFileSync(path.join(artifacts, "scene-layouts.json"), JSON.stringify(metrics, null, 2));
});

test("manual page change cancels a paused real clip, preserves earned progress and permits the next tap", async ({ page }) => {
  const w = watch(page); await page.goto(fixture);
  await page.locator(".card").click();
  await expect.poll(() => page.evaluate(() => window.__demo.audio.currentTime)).toBeGreaterThan(.03);
  await page.locator("#pauseBtn").click(); await page.locator("#nextPage").click();
  await expect(page.locator("#book")).toHaveAttribute("data-page", "legacy-test-page-2");
  await expect(page.locator("#book")).toHaveAttribute("data-step", "free");
  const count = await page.evaluate(() => window.__log.length);
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => window.__log.length)).toBe(count);
  expect(await page.evaluate(() => window.__demo.audio.paused)).toBe(true);
  await expect(page.locator(".star.on,.card .cur,.card .done,.aBubble.show")).toHaveCount(0);
  await page.locator(".card").click();
  await expect.poll(() => page.evaluate(() => window.__log.at(-1)?.key)).toBe("xue-er-01-s03:elephant");
  await expect.poll(() => page.evaluate(() => window.__demo.audio.currentTime)).toBeGreaterThan(.03);
  await page.locator("#stopBtn").click(); w.expectClean();
});

test("continuous reading visits every page only after real lead, follow and solo finish", async ({ page }) => {
  await fastAudio(page); const w = watch(page); await page.goto(fixture); await page.locator("#readBtn").click();
  await expect(page.locator("#book")).toHaveAttribute("data-page", "legacy-test-page-3", { timeout: 40_000 });
  await expect(page.locator("#book")).toHaveAttribute("data-step", "free", { timeout: 20_000 });
  const keys = await page.evaluate(() => window.__log.map(row => row.key));
  expect(keys).toEqual(["xue-er-01-s02:elephant", "xue-er-01-s02:children", "again", "xue-er-01-s02:bunny", "squeak", "xue-er-01-s03:elephant", "xue-er-01-s03:children", "again", "xue-er-01-s03:cat", "meow", "xue-er-01-s04:elephant", "xue-er-01-s04:children", "again", "xue-er-01-s04:dog", "woof"]);
  for (let i = 2; i >= 0; i--) { await expect(page.locator(".star.on")).toHaveCount(1); if (i) await page.locator("#prevPage").click(); }
  w.expectClean();
});

test("new player uses the common active clock for a 12-second paused gap and the 900ms solo wait", async ({ page }) => {
  await page.goto(fixture); await page.locator(".card").click();
  await expect.poll(() => page.evaluate(() => window.__demo.audio.currentTime)).toBeGreaterThan(.03);
  await page.evaluate(() => {
    const realNow = performance.now.bind(performance); let gap = 0;
    Object.defineProperty(performance, "now", { configurable: true, value: () => realNow() + gap });
    document.querySelector("#pauseBtn").click(); gap = 12000; document.querySelector("#pauseBtn").click();
  });
  await page.waitForTimeout(700);
  expect(await page.evaluate(() => window.__log.at(-1).key)).toBe("xue-er-01-s02:elephant");
  expect(await page.evaluate(() => window.__demo.audio.currentTime)).toBeGreaterThan(.4);
  await page.locator("#stopBtn").click();
  await page.evaluate(() => {
    document.querySelector("#bunny").click();
    const realNow = performance.now.bind(performance); let gap = 0;
    Object.defineProperty(performance, "now", { configurable: true, value: () => realNow() + gap });
    document.querySelector("#pauseBtn").click(); gap = 12000; document.querySelector("#pauseBtn").click();
  });
  const count = await page.evaluate(() => window.__log.length); await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__log.length)).toBe(count);
  await expect.poll(() => page.evaluate(() => window.__log.at(-1).key), { timeout: 1500 }).toBe("xue-er-01-s02:bunny");
});

test("real history return and reload restore the selected page in silent free state", async ({ page }) => {
  await page.goto(fixture); await page.locator("#nextPage").click(); await page.locator(".card").click();
  await page.locator("#tocBtn").click(); await page.goBack({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#book")).toHaveAttribute("data-page", "legacy-test-page-2");
  await expect(page.locator("#book")).toHaveAttribute("data-step", "free");
  expect(await page.evaluate(() => window.__demo.audio.paused)).toBe(true);
  fs.writeFileSync(path.join(artifacts, "history-return.json"), JSON.stringify(await page.evaluate(() => ({ method: "actual file history navigation; default browser flags", persisted: window.__demo.lastPageShowPersisted, page: document.querySelector("#book").dataset.page, step: document.querySelector("#book").dataset.step, paused: window.__demo.audio.paused })), null, 2));
  await page.reload(); await expect(page.locator("#book")).toHaveAttribute("data-page", "legacy-test-page-2");
  expect(await page.evaluate(() => window.__demo.audio.paused)).toBe(true);
  await page.locator(".card").click(); await expect.poll(() => page.evaluate(() => window.__demo.audio.currentTime)).toBeGreaterThan(.03);
});

test("rapid character, card and keyboard prop taps share one Audio and cancel the older solo delay", async ({ page }) => {
  await page.addInitScript(() => {
    window.__audioInstances = [];
    window.Audio = new Proxy(window.Audio, { construct(target, args) { const audio = Reflect.construct(target, args); window.__audioInstances.push(audio); return audio; } });
  });
  await page.goto(fixture); await page.locator("#bunny").click();
  await page.locator(".card").click();
  await page.locator("button.scene-prop").focus(); await page.keyboard.press("Space");
  await page.waitForTimeout(1100);
  expect(await page.evaluate(() => window.__audioInstances.length)).toBe(1);
  expect(await page.evaluate(() => window.__audioInstances[0] === window.__demo.audio)).toBe(true);
  expect(await page.evaluate(() => window.__log.map(row => row.key))).toEqual(["xue-er-01-s02:elephant", "xue-er-01-s02:elephant"]);
  expect(await page.evaluate(() => window.__demo.audio.currentTime)).toBeGreaterThan(.8);
  await page.locator("#stopBtn").click(); await expect(page.locator(".star.on")).toHaveCount(0);
  expect(await page.evaluate(() => window.__demo.audio.paused)).toBe(true);
});

test("failed playback never advances a new chapter or earns a star and the same page can be retried", async ({ page }) => {
  await fastAudio(page);
  await page.addInitScript(() => {
    const play = HTMLMediaElement.prototype.play;
    window.__rejectFollow = true;
    HTMLMediaElement.prototype.play = function () {
      if (window.__rejectFollow && window.__log?.at(-1)?.key?.endsWith(":children")) return Promise.reject(new Error("test playback failure"));
      return play.call(this);
    };
  });
  await page.goto(fixture); await page.locator("#readBtn").click();
  await expect.poll(() => page.evaluate(() => window.__log.at(-1)?.key)).toBe("xue-er-01-s02:children");
  await expect(page.locator("#book")).toHaveAttribute("data-step", "free");
  await expect(page.locator("#book")).toHaveAttribute("data-page", "legacy-test-page-1");
  await expect(page.locator(".star.on")).toHaveCount(0);
  expect(await page.evaluate(() => window.__demo.chapter.sceneAnimations)).toBe(0);
  await page.evaluate(() => { window.__rejectFollow = false; }); await page.locator(".card").click();
  await expect(page.locator(".star.on")).toHaveCount(1, { timeout: 5000 });
});

test("the full long chapter remains readable without JavaScript and if the page adapter fails", async ({ browser, page }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  await context.setOffline(true);
  const plain = await context.newPage(); await plain.goto(preview(15));
  await expect(plain.locator("#chapterFallback")).toBeVisible();
  const original = p => p.locator(".fallback-line").evaluateAll(nodes => nodes.map(node => { const copy = node.cloneNode(true); copy.querySelectorAll("rt").forEach(rt => rt.remove()); return copy.textContent; }).join(""));
  expect(await original(plain)).toBe(book.chapters[14].fullText);
  await expectAnnotations(plain, book.chapters[14].segments, "#chapterFallback"); await context.close();
  await page.context().setOffline(true);
  await page.addInitScript(() => Object.defineProperty(window, "createChapterPlayer", { configurable: true, get: () => () => { throw new Error("test adapter failure"); }, set: () => {} }));
  await page.goto(preview(15)); await expect(page.locator("#chapterFallback")).toBeVisible();
  expect(await original(page)).toBe(book.chapters[14].fullText);
  await expectAnnotations(page, book.chapters[14].segments, "#chapterFallback");
});

test("scene cue has one focus, pauses, and cancels on stop, reduced-motion, hidden and pagehide", async ({ page }) => {
  await fastAudio(page); await page.goto(fixture);
  for (const reason of ["stop", "reduced-motion", "hidden", "pagehide"]) {
    await page.locator(".card").click();
    await expect.poll(() => page.evaluate(() => window.__demo.chapter.sceneAnimations), { timeout: 5000, intervals: [25] }).toBeGreaterThan(0);
    expect(await page.evaluate(() => new Set(document.getAnimations().filter(a => a.effect?.target?.closest(".scene-prop")).map(a => a.effect.target.closest(".scene-prop").dataset.prop)).size)).toBe(1);
    if (reason === "stop") {
      await page.locator("#pauseBtn").click();
      expect(await page.evaluate(() => document.getAnimations().every(a => a.playState === "paused" && !a.pending))).toBe(true);
      const times = await page.evaluate(() => document.getAnimations().map(a => a.currentTime)); await page.waitForTimeout(180);
      expect(await page.evaluate(() => document.getAnimations().map(a => a.currentTime))).toEqual(times);
      await page.locator("#pauseBtn").click();
      await expect.poll(() => page.evaluate(() => document.getAnimations().map(a => a.currentTime))).not.toEqual(times);
      await page.locator("#stopBtn").click();
    } else if (reason === "reduced-motion") await page.emulateMedia({ reducedMotion: "reduce" });
    else if (reason === "pagehide") await page.evaluate(() => dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })));
    else await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: true }); document.dispatchEvent(new Event("visibilitychange")); });
    await expect.poll(() => page.evaluate(() => window.__demo.chapter.sceneAnimations), { timeout: 500, intervals: [16, 32] }).toBe(0);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.__demo.chapter.sceneAnimations)).toBe(0);
    if (reason === "reduced-motion") { await page.emulateMedia({ reducedMotion: "no-preference" }); await page.waitForTimeout(50); }
    if (reason === "hidden") await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: false }); document.dispatchEvent(new Event("visibilitychange")); });
  }
});
