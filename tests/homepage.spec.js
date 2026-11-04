import { test, expect } from "@playwright/test";
import { watch } from "./helpers.js";
import { readJSON } from "../scripts/chapter-data.mjs";

const names = ["学而","为政","八佾","里仁","公冶长","雍也","述而","泰伯","子罕","乡党","先进","颜渊","子路","宪问","卫灵公","季氏","阳货","微子","子张","尧曰"];

test("twenty real volume states, one volume entry, no chapter shortcuts or home audio", async ({ page }) => {
  const w = watch(page);
  const response = await page.goto("/", { waitUntil: "networkidle" });
  expect(response.status()).toBe(200);
  await expect(page.locator(".volume-name")).toHaveText(names);
  await expect(page.locator('.volume[data-available="true"]')).toHaveCount(1);
  await expect(page.locator('.volume[data-available="false"]')).toHaveCount(19);
  await expect(page.locator(".catalog .chapter-link, .catalog .play-icon")).toHaveCount(0);
  await expect(page.locator(".catalog")).not.toContainText("学而时习之");
  await expect(page.getByRole("link")).toHaveCount(1);
  await expect(page.locator(".volume-index")).toHaveAttribute("href", "/learn/xue-er/");
  await expect(page.locator(".volume-index")).toHaveAccessibleName("学而，进入章目目录");
  await expect(page.locator("button, input, select, textarea, [tabindex]:not([tabindex='-1'])")).toHaveCount(0);
  await expect(page.locator(".catalog-decor")).toHaveAttribute("aria-hidden", "true");
  expect(await page.locator(".catalog-decor, .catalog-decor *").evaluateAll(nodes => nodes.every(node => getComputedStyle(node).pointerEvents === "none"))).toBe(true);
  await expect(page.locator(".catalog-decor img:not([alt='']), .catalog-decor svg:not([focusable='false'])")).toHaveCount(0);
  await expect(page.locator(".unavailable a, .unavailable button, .scene button")).toHaveCount(0);
  await expect(page.getByRole("img", { name: "尚未开放", exact: true })).toHaveCount(19);
  expect(await response.text()).not.toMatch(/data:audio|new Audio\(|<audio\b|rel=["'](?:preload|prefetch)/i);
  expect(w.ok.filter(url => /audio|\.mp3|\/learn\//.test(url))).toEqual([]);
  await page.keyboard.press("Tab");
  await expect(page.locator(".volume-index")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/learn\/xue-er\/$/);
  await expect(page.locator(".chapter-directory li")).toHaveCount(16);
  await page.locator("#chapter-1 a").click();
  await expect(page).toHaveURL(/\/learn\/xue-er\/1\/$/);
  await expect(page.locator("#startBtn")).toBeVisible();
  await page.locator("#homeBtn").click();
  await expect(page).toHaveURL(/\/#xue-er$/);
  await expect(page.locator(".volume-index")).toBeFocused();
  w.expectClean();
});

async function observeGreeting(page) {
  await page.addInitScript(() => {
    const animate = Element.prototype.animate;
    window.__homeGreetings = [];
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args);
      if (this.closest(".home")) window.__homeGreetings.push({ target: this.id, animation });
      return animation;
    };
  });
}

test("the cat is the only welcome, uses transform/opacity, and settles after one finite action", async ({ page }) => {
  const w = watch(page);
  await observeGreeting(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const motions = await page.evaluate(() => window.__homeGreetings.map(({ target, animation }) => ({
    target,
    duration: animation.effect.getTiming().duration,
    iterations: animation.effect.getTiming().iterations,
    properties: [...new Set(animation.effect.getKeyframes().flatMap(frame => Object.keys(frame)))]
      .filter(property => !["offset", "computedOffset", "easing", "composite"].includes(property)),
  })));
  expect(motions).toHaveLength(1);
  expect(motions[0]).toMatchObject({ target: "welcome-cat", duration: 640, iterations: 1 });
  expect(motions[0].properties.every(property => ["transform", "opacity"].includes(property))).toBe(true);
  await expect.poll(() => page.evaluate(() => document.getAnimations().length), { timeout: 1500 }).toBe(0);
  await page.waitForTimeout(750);
  expect(await page.evaluate(() => window.__homeGreetings.length)).toBe(1);
  expect(await page.locator("#welcome-cat").evaluate(node => getComputedStyle(node).transform)).toBe("none");
  w.expectClean();
});

for (const reason of ["visibilitychange", "pagehide", "reduced-motion"]) {
  test(`home welcome cancels on ${reason} and does not replay on return`, async ({ page }) => {
    const w = watch(page);
    await observeGreeting(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(await page.evaluate(() => window.__homeGreetings[0].animation.playState)).toBe("running");
    if (reason === "reduced-motion") {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect.poll(() => page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches), { timeout: 1500 }).toBe(true);
    }
    else await page.evaluate(reason => {
      // These exercise lifecycle handlers; they do not simulate actual device backgrounding.
      if (reason === "visibilitychange") {
        Object.defineProperty(document, "hidden", { configurable: true, value: true });
        document.dispatchEvent(new Event("visibilitychange"));
      } else dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
    }, reason);
    // Media emulation delivers change asynchronously; a naturally finished animation is never idle.
    await expect.poll(() => page.evaluate(() => window.__homeGreetings[0].animation.playState), { timeout: reason === "reduced-motion" ? 1500 : 350, intervals: [16, 32, 50] }).toBe("idle");
    expect(await page.locator("#welcome-cat").evaluate(node => getComputedStyle(node).transform)).toBe("none");
    if (reason === "reduced-motion") await page.emulateMedia({ reducedMotion: "no-preference" });
    else await page.evaluate(reason => {
      if (reason === "visibilitychange") {
        Object.defineProperty(document, "hidden", { configurable: true, value: false });
        document.dispatchEvent(new Event("visibilitychange"));
      } else dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    }, reason);
    await page.waitForTimeout(750);
    expect(await page.evaluate(() => ({ calls: window.__homeGreetings.length, animations: document.getAnimations().length }))).toEqual({ calls: 1, animations: 0 });
    w.expectClean();
  });
}

for (const mode of ["reduced-motion", "initially hidden", "short landscape"]) {
  test(`home starts static for ${mode}`, async ({ page }) => {
    await observeGreeting(page);
    if (mode === "reduced-motion") await page.emulateMedia({ reducedMotion: "reduce" });
    if (mode === "short landscape") await page.setViewportSize({ width: 844, height: 390 });
    if (mode === "initially hidden") await page.addInitScript(() => {
      Object.defineProperty(document, "hidden", { configurable: true, value: true });
    });
    await page.goto("/");
    expect(await page.evaluate(() => ({ calls: window.__homeGreetings.length, animations: document.getAnimations().length }))).toEqual({ calls: 0, animations: 0 });
    if (mode === "initially hidden") {
      await page.evaluate(() => {
        Object.defineProperty(document, "hidden", { configurable: true, value: false });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await page.waitForTimeout(750);
      expect(await page.evaluate(() => window.__homeGreetings.length)).toBe(0);
    }
  });
}

test("chapter direct entry and refresh have real assets; unready chapters have no production page", async ({ page, request }) => {
  const w = watch(page);
  const first = await page.goto("/learn/xue-er/1/", { waitUntil: "networkidle" });
  expect(first.status()).toBe(200);
  const refreshed = await page.reload({ waitUntil: "networkidle" });
  expect(refreshed.status()).toBe(200);
  await expect(page.locator("#ttMain")).toContainText("学而时习之");
  expect(await page.locator("#cast img").evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0))).toBe(true);
  const missing = await request.get("/learn/wei-zheng/1/");
  expect(missing.status()).toBe(404);
  for (const [index, chapter] of readJSON("build/xue-er-readiness-online.json").chapters.slice(1).entries()) {
    const response = await request.get(`/learn/xue-er/${index + 2}/`);
    expect(response.status(), chapter.id).toBe(chapter.ready ? 200 : 404);
  }
  w.expectClean();
});

test.describe("home without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("the complete directory and real entry remain usable", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".volume-name")).toHaveText(names);
    await expect(page.getByRole("link")).toHaveCount(1);
    await page.locator(".volume-index").click();
    await expect(page).toHaveURL(/\/learn\/xue-er\/$/);
    await expect(page.locator(".chapter-directory li")).toHaveCount(16);
    await page.locator("#chapter-1 a").click();
    await expect(page).toHaveURL(/\/learn\/xue-er\/1\/$/);
  });
});
