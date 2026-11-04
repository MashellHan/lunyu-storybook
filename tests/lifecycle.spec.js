import { test, expect, chromium } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fastAudio, waitStep, played, watch, legacyURL, firstLead } from "./helpers.js";

const artifacts = fileURLToPath(new URL("./artifacts/xue-er-direct-release/", import.meta.url));
fs.mkdirSync(artifacts, { recursive: true });

async function openFirstLine(page, fallback = false) {
  test.skip(!!process.env.BASE_URL, "Original three-sentence regression fixture is local-only");
  if (fallback) await page.addInitScript(() => {
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (window.__log?.at(-1)?.key === "e1") return Promise.reject(new DOMException("Test unavailable audio", "NotAllowedError"));
      return play.call(this);
    };
  });
  await page.goto(legacyURL);
  await page.locator("#startBtn").click();
  await waitStep(page, "e1");
}

async function pausedClockGap(page, hidden = false) {
  return page.evaluate(hidden => {
    const realNow = performance.now.bind(performance);
    let gap = 0;
    Object.defineProperty(performance, "now", { configurable: true, value: () => realNow() + gap });
    const before = { activeTime: window.__demo.activeTime, audioTime: window.__demo.audio.currentTime };
    window.__clockAudio = window.__demo.audio;
    if (hidden) {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => window.__testHidden });
      window.__testHidden = true;
      document.dispatchEvent(new Event("visibilitychange"));
    } else document.getElementById("pauseBtn").click();
    const wasPaused = window.__demo.paused && window.__demo.audio.paused;
    gap = 12000;
    if (hidden) {
      window.__testHidden = false;
      document.dispatchEvent(new Event("visibilitychange"));
    } else document.getElementById("pauseBtn").click();
    return { before, wasPaused, resumed: !window.__demo.paused, activeTime: window.__demo.activeTime };
  }, hidden);
}

for (const mode of ["audio", "fallback", "visibility"]) {
  test(`a simulated 12-second paused clock gap does not finish ${mode} early`, async ({ page }) => {
    const w = watch(page);
    await openFirstLine(page, mode === "fallback");
    const trace = await pausedClockGap(page, mode === "visibility");
    expect(trace.wasPaused).toBe(true);
    expect(trace.resumed).toBe(true);
    expect(trace.activeTime - trace.before.activeTime).toBeLessThan(100);
    await page.waitForTimeout(700);
    await expect(page.locator("#book")).toHaveAttribute("data-step", "e1");
    expect((await played(page)).at(-1)).toBe("e1");
    const after = await page.evaluate(() => ({
      paused: window.__demo.paused, audioTime: window.__demo.audio.currentTime,
      sameAudio: window.__clockAudio === window.__demo.audio, step: document.getElementById("book").dataset.step,
    }));
    expect(after.sameAudio).toBe(true);
    expect(after.paused).toBe(false);
    if (mode !== "fallback") expect(after.audioTime).toBeGreaterThan(trace.before.audioTime + .2);
    fs.writeFileSync(`${artifacts}/paused-gap-${mode}.json`, JSON.stringify({ method: "Simulated monotonic clock gap; not real device backgrounding", mode, gapMilliseconds: 12000, trace, after }, null, 2));
    w.expectClean();
  });
}

test("the 900ms solo pre-reading wait excludes a suspended clock gap", async ({ page }) => {
  test.skip(!!process.env.BASE_URL, "Original three-sentence regression fixture is local-only");
  await page.goto(legacyURL);
  await page.locator("#stopBtn").click();
  await page.locator("#bunny").click();
  const trace = await pausedClockGap(page);
  await page.waitForTimeout(250);
  await expect(page.locator("#book")).toHaveAttribute("data-step", "solo-bunny");
  expect(await played(page)).not.toContain("b1");
  await expect.poll(() => played(page), { timeout: 2500 }).toContain("b1");
  fs.writeFileSync(`${artifacts}/paused-gap-solo-wait.json`, JSON.stringify({ method: "Simulated monotonic clock gap", gapMilliseconds: 12000, trace, preservedWaitMilliseconds: 900 }, null, 2));
});

test("a real renderer callback suspension cannot consume the fallback deadline", async ({ page }) => {
  await openFirstLine(page, true);
  await page.locator("#pauseBtn").click();
  const before = await page.evaluate(() => ({ step: document.getElementById("book").dataset.step, paused: window.__demo.paused, activeTime: window.__demo.activeTime }));
  // A test-only native dialog suspends callbacks; dismissing it resumes in the same JS task.
  page.once("dialog", async dialog => {
    await new Promise(resolve => setTimeout(resolve, 12000));
    await dialog.dismiss();
  });
  await page.evaluate(() => { alert("Test-only renderer suspension"); document.getElementById("pauseBtn").click(); });
  await page.waitForTimeout(600);
  const after = await page.evaluate(() => ({ step: document.getElementById("book").dataset.step, paused: window.__demo.paused, activeTime: window.__demo.activeTime }));
  expect(after.paused).toBe(false);
  expect(after.step).toBe("e1");
  expect(after.activeTime - before.activeTime).toBeLessThan(1500);
  fs.writeFileSync(`${artifacts}/pause-clock-after.json`, JSON.stringify({ method: "Test-only native dialog freezes renderer callbacks, not a real background/device test", suspendedMilliseconds: 12000, before, after }, null, 2));
});

test("browser back without BFCache restores cancelled reading as free interaction", async ({ page }) => {
  await fastAudio(page);
  await page.goto("/learn/xue-er/1/");
  const lead = await firstLead(page);
  await page.locator("#startBtn").click();
  await waitStep(page, lead.step);
  await page.locator("#homeBtn").click();
  await expect(page).toHaveURL(/\/#xue-er$/);
  await page.goBack();
  await expect(page.locator("#book")).toHaveAttribute("data-step", "free");
  expect(await page.evaluate(() => window.__demo.audio.paused)).toBe(true);
  const keys = await played(page);
  await page.waitForTimeout(1800);
  expect(await played(page)).toEqual(keys);
  await page.locator(".card").first().click();
  await expect.poll(() => played(page)).toContain(lead.key);
});

const fullChrome = [
  process.env.BFCACHE_CHROME_PATH,
  path.join(os.homedir(), "Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"),
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].find(file => file && fs.existsSync(file));

test("real BFCache returns from title and automatic reading are silent and interactive", async ({ baseURL }) => {
  test.skip(!fullChrome || !!process.env.BASE_URL, "Local full Chrome required; no browser downloads");
  const browser = await chromium.launch({
    executablePath: fullChrome, headless: true,
    ignoreDefaultArgs: ["--disable-back-forward-cache"], args: ["--autoplay-policy=user-gesture-required"],
  });
  const traces = [];
  try {
    for (const phase of ["title", "title-voice", "lead"]) {
      const page = await browser.newPage();
      const w = watch(page);
      await page.addInitScript(() => {
        window.__testDocId = crypto.randomUUID();
        window.__testPageShows = [];
        addEventListener("pageshow", event => window.__testPageShows.push({ persisted: event.persisted, trusted: event.isTrusted }));
      });
      await fastAudio(page);
      await page.goto(`${baseURL}/learn/xue-er/1/`);
      const lead = await firstLead(page), second = await firstLead(page, 1);
      if (phase !== "title") { await page.locator("#startBtn").click(); await waitStep(page, phase === "lead" ? lead.step : phase); }
      const docId = await page.evaluate(() => {
        window.__testReturnAudio = window.__demo.audio;
        return window.__testDocId;
      });
      await page.locator("#homeBtn").click();
      await expect(page).toHaveURL(/\/#xue-er$/);
      // BFCache restores the original document without a new load event.
      await page.evaluate(() => history.back());
      await expect(page).toHaveURL(/\/learn\/xue-er\/1\/$/);
      await expect(page.locator("#book")).toHaveAttribute("data-step", "free");
      await expect.poll(() => page.evaluate(() => window.__demo.lastPageShowPersisted)).toBe(true);
      const returned = await page.evaluate(() => ({
        docId: window.__testDocId, sameAudio: window.__testReturnAudio === window.__demo.audio,
        pageshow: window.__testPageShows.at(-1),
      }));
      expect(returned).toEqual({ docId, sameAudio: true, pageshow: { persisted: true, trusted: true } });
      const before = await played(page);
      await page.waitForTimeout(1400);
      expect(await played(page)).toEqual(before);
      expect(await page.evaluate(() => window.__demo.audio.paused)).toBe(true);
      traces.push({ phase, beforeDocId: docId, ...returned, step: "free", audioPaused: true, keys: before });
      await page.locator(".card").nth(1).click();
      await expect.poll(() => played(page)).toContain(second.key);
      w.expectClean();
      await page.close();
    }
  } finally { await browser.close(); }
  fs.writeFileSync(`${artifacts}/bfcache.json`, JSON.stringify({ browser: "Full Chrome for Testing", traces }, null, 2));
});
