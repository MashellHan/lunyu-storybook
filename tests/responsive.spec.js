import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { watch } from "./helpers.js";

const artifacts = fileURLToPath(new URL("./artifacts/xue-er-direct-release/", import.meta.url));
fs.mkdirSync(artifacts, { recursive: true });
const sizes = [[1440,900], [1024,768], [768,1024], [390,844], [320,568], [844,390]];

for (const [width, height] of sizes) {
  test(`home and chapter remain visible and readable at ${width}x${height}`, async ({ page }) => {
    const w = watch(page);
    await page.setViewportSize({ width, height });
    await page.addInitScript(() => {
      const animate = Element.prototype.animate;
      Element.prototype.animate = function (...args) {
        const animation = animate.apply(this, args);
        if (this.id === "welcome-cat") window.__homeGreeting = animation;
        return animation;
      };
    });
    await page.goto("/", { waitUntil: "networkidle" });
    await page.waitForTimeout(700);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const entry = await page.locator("#xue-er-entry").boundingBox();
    expect(entry.height).toBeGreaterThanOrEqual(88);
    if (width <= 390) expect(entry.y + entry.height).toBeLessThanOrEqual(Math.min(600, height));
    const entryIcon = await page.locator("#xue-er-entry .entry-icon").boundingBox();
    expect(entryIcon.width).toBeGreaterThanOrEqual(64);
    expect(entryIcon.height).toBeGreaterThanOrEqual(64);
    const entryHit = await page.evaluate(({ x, y, width, height }) =>
      document.elementFromPoint(x + width / 2, y + height / 2)?.closest("a")?.id, entryIcon);
    expect(entryHit).toBe("xue-er-entry");
    const images = await page.locator(".home-animal").evaluateAll(nodes => nodes.map(node => {
      const { x, y, width, height, right } = node.getBoundingClientRect();
      return { x, y, width, height, right };
    }));
    for (const image of images) {
      expect(image.x).toBeGreaterThanOrEqual(0);
      expect(image.right).toBeLessThanOrEqual(width);
      expect(image.width).toBeGreaterThanOrEqual(70);
    }
    const decorations = await page.locator(".catalog-decor > *").evaluateAll(nodes => nodes.map(node => {
      const { x, y, width, height, right, bottom } = node.getBoundingClientRect();
      return { decoration: node.getAttribute("class"), visible: !!node.getClientRects().length, x, y, width, height, right, bottom };
    }));
    for (const decoration of decorations.filter(item => item.visible)) {
      expect(decoration.x, String(decoration.decoration)).toBeGreaterThanOrEqual(0);
      expect(decoration.y, String(decoration.decoration)).toBeGreaterThanOrEqual(0);
      expect(decoration.right, String(decoration.decoration)).toBeLessThanOrEqual(width);
    }
    fs.writeFileSync(`${artifacts}/home-${width}x${height}-layout.json`, JSON.stringify({ viewport: { width, height }, entry, entryIcon, entryHit, characters: images, decorations }, null, 2));
    await page.screenshot({ path: `${artifacts}/home-${width}x${height}.png`, fullPage: true });
    const peak = await page.evaluate(() => {
      const animation = window.__homeGreeting;
      if (!animation) return false;
      // Capture the authored peak keyframe; only the test makes timing linear to seek it exactly.
      animation.pause(); animation.effect.updateTiming({ easing: "linear" });
      animation.currentTime = animation.effect.getTiming().duration * .45;
      return true;
    });
    if (peak) {
      await page.screenshot({ path: `${artifacts}/home-peak-${width}x${height}.png`, fullPage: true });
      await page.evaluate(() => window.__homeGreeting.cancel());
    }

    await page.goto("/learn/xue-er/1/", { waitUntil: "networkidle" });
    const startButton = page.locator("#startBtn");
    await expect(startButton).toHaveCSS("opacity", "1");
    // Tall reading content must not push the opening control below the first viewport.
    if (height >= 568) expect(await page.evaluate(() => scrollY)).toBe(0);
    else await startButton.scrollIntoViewIfNeeded();
    await expect(startButton).toBeInViewport({ ratio: 1 });
    const titleStart = await startButton.evaluate(button => {
      const { x, y, width, height, bottom } = button.getBoundingClientRect();
      return { x, y, width, height, bottom, scrollY, hit: document.elementFromPoint(x + width / 2, y + height / 2)?.closest("button")?.id };
    });
    expect(titleStart.hit).toBe("startBtn");
    await page.locator("#stopBtn").click();
    await expect(page.locator("#book")).toHaveAttribute("data-step", "free");
    const metrics = await page.evaluate(() => {
      const rect = element => {
        const { x, y, width, height, right, bottom } = element.getBoundingClientRect();
        return { id: element.id, x, y, width, height, right, bottom };
      };
      return {
        viewport: { width: innerWidth, height: innerHeight },
        book: rect(document.getElementById("book")),
        characters: [...document.querySelectorAll("#cast .char")].map(rect),
        controls: [...document.querySelectorAll("header .ctl")].map(rect),
        text: parseFloat(getComputedStyle(document.querySelector(".card .txt")).fontSize),
        pinyin: parseFloat(getComputedStyle(document.querySelector(".card rt")).fontSize),
        scrollWidth: document.documentElement.scrollWidth,
        cardOpacity: [...document.querySelectorAll(".card")].map(card => getComputedStyle(card).opacity),
      };
    });
    metrics.titleStart = titleStart;
    expect(metrics.book.x).toBeGreaterThanOrEqual(0);
    expect(metrics.book.right).toBeLessThanOrEqual(width);
    expect(metrics.scrollWidth).toBeLessThanOrEqual(width);
    expect(metrics.text).toBeGreaterThanOrEqual(24);
    expect(metrics.pinyin).toBeGreaterThanOrEqual(14);
    expect(metrics.cardOpacity).toEqual(["1", "1", "1"]);
    for (const rect of metrics.characters) {
      expect(rect.x, rect.id).toBeGreaterThanOrEqual(0);
      expect(rect.right, rect.id).toBeLessThanOrEqual(width);
      expect(rect.width, rect.id).toBeGreaterThanOrEqual(100);
    }
    for (let i = 0; i < metrics.characters.length; i++) {
      for (const b of metrics.characters.slice(i + 1)) {
        const a = metrics.characters[i];
        const overlap = Math.min(a.right, b.right) > Math.max(a.x, b.x) && Math.min(a.bottom, b.bottom) > Math.max(a.y, b.y);
        expect(overlap, `${a.id} / ${b.id} touch regions`).toBe(false);
      }
    }
    for (const control of metrics.controls) {
      expect(control.width, control.id).toBeGreaterThanOrEqual(64);
      expect(control.height, control.id).toBeGreaterThanOrEqual(64);
    }
    await page.screenshot({ path: `${artifacts}/chapter-stopped-${width}x${height}.png`, fullPage: true });
    await page.locator(".card").last().scrollIntoViewIfNeeded();
    await expect(page.locator("#stopBtn")).toBeInViewport({ ratio: 1 });
    await expect(page.locator("#pauseBtn")).toBeInViewport({ ratio: 1 });
    metrics.scrolled = await page.evaluate(() => ({
      scrollY,
      controls: [...document.querySelectorAll("header .ctl")].map(control => {
        const { x, y, width, height } = control.getBoundingClientRect();
        return { id: control.id, x, y, width, height, hit: document.elementFromPoint(x + width / 2, y + height / 2)?.closest(".ctl")?.id };
      }),
    }));
    for (const control of metrics.scrolled.controls) expect(control.hit).toBe(control.id);
    fs.writeFileSync(`${artifacts}/chapter-${width}x${height}-layout.json`, JSON.stringify(metrics, null, 2));
    if (width <= 640 || height <= 390) await page.screenshot({ path: `${artifacts}/chapter-scrolled-${width}x${height}.png` });
    await page.locator("#stopBtn").click();
    w.expectClean();
  });
}

test("reduced motion is static on home and can be switched on during chapter motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/learn/xue-er/1/");
  await page.locator("#stopBtn").click();
  await page.locator("#dog").click();
  expect(await page.evaluate(() => document.getAnimations().some(animation =>
    animation.playState === "running" && animation.effect?.target === document.querySelector("#dog .act")))).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => page.evaluate(() => document.getAnimations().filter(animation =>
    animation.playState === "running" && animation.effect?.getKeyframes().some(frame => frame.transform && frame.transform !== "none"))
    .map(animation => animation.effect.target?.id || animation.effect.target?.className)),
  { timeout: 350, intervals: [16, 32, 50] }).toEqual([]);
});
