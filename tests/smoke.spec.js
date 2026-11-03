import { test, expect } from "@playwright/test";
import { watch, waitStep, played, step, openAndStart } from "./helpers.js";

const IMAGES = ["elephant-640.webp", "cat-640.webp", "bunny-ear.webp", "bunny-base.webp", "dog-tail.webp", "dog-body.webp", "dog-head.webp", "icon.png"];

test("loads with no JS errors, shows the title and ▶ only", async ({ page }) => {
  const w = watch(page);
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator("#title")).toBeVisible();
  await expect(page.locator("#startBtn")).toBeVisible();
  await expect(page.locator("#startBtn")).toHaveText("");          // ▶ icon only, no words
  await expect(page.locator("#ttMain")).toContainText("学而时习之");
  expect(await step(page)).toBe("title");
  await page.waitForTimeout(1500);
  w.expectClean();
});

test("every asset returns 200 with the right type", async ({ page, request }) => {
  const w = watch(page);
  await page.goto("/", { waitUntil: "networkidle" });
  for (const f of IMAGES) {
    const r = await request.get(`/assets/img/${f}`);
    expect(r.status(), f).toBe(200);
    expect(r.headers()["content-type"], f).toMatch(f.endsWith(".png") ? /image\/png/ : /image\/webp/);
  }
  const credits = await request.get("/CREDITS.md");
  expect(credits.status()).toBe(200);
  expect(await credits.text()).toContain("527845");
  // all 15 clips are inlined as data: URIs (no audio URLs to fetch; see docs/architecture.md)
  const clips = await page.evaluate(() => [...document.scripts].map((s) => s.textContent).join("").match(/data:audio\/mpeg;base64,/g)?.length);
  expect(clips).toBe(15);
  w.expectClean();
});

test("title → ▶ → trumpet → elephant reads line 1 → friends read together", async ({ page }) => {
  const w = watch(page);
  await openAndStart(page);
  await waitStep(page, "e1", 15_000);
  await expect(page.locator(".card.playing")).toHaveAttribute("aria-label", "学而时习之，不亦说乎？");
  await waitStep(page, "u1", 20_000);
  await expect.poll(() => played(page)).toContain("u1");
  const keys = await played(page);
  expect(keys).toEqual(expect.arrayContaining(["trumpet", "e1", "u1"]));
  expect(keys.indexOf("trumpet")).toBeLessThan(keys.indexOf("e1"));
  w.expectClean();
});

test("free play: each animal plays its line + sound, elephant trumpets", async ({ page }) => {
  const w = watch(page);
  await openAndStart(page);
  await page.evaluate(() => window.__demo.enterFree());
  for (const [id, line, sound] of [["bunny", "b1", "squeak"], ["cat", "c2", "meow"], ["dog", "d3", "woof"]]) {
    await page.locator(`#${id}`).click();
    await waitStep(page, `sound-${id}`, 15_000);
    const keys = await played(page);
    expect(keys.slice(-2)).toEqual([line, sound]);
  }
  await page.locator("#elephant").click();
  await waitStep(page, "e1", 10_000);
  expect((await played(page)).slice(-2)).toEqual(["trumpet", "e1"]);
  w.expectClean();
});

test("pause button freezes the reading and resumes it", async ({ page }) => {
  const w = watch(page);
  await openAndStart(page);
  await waitStep(page, "e1", 15_000);
  await page.locator("#pauseBtn").click();
  await expect(page.locator("#pauseBtn")).toHaveAttribute("aria-pressed", "true");
  const t0 = await page.evaluate(() => window.__demo.audio.currentTime);
  await page.waitForTimeout(1200);
  expect(await page.evaluate(() => window.__demo.audio.currentTime)).toBeCloseTo(t0, 1);
  expect(await step(page)).toBe("e1");
  await page.locator("#pauseBtn").click();
  await expect(page.locator("#pauseBtn")).toHaveAttribute("aria-pressed", "false");
  await waitStep(page, "u1", 20_000);
  w.expectClean();
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("flow still runs and no transform animations play", async ({ page }) => {
    const w = watch(page);
    await page.goto("/", { waitUntil: "networkidle" });
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
    const idle = await page.evaluate(() => getComputedStyle(document.querySelector("#elephant .idle")).animationName);
    expect(idle).toBe("none");
    await page.locator("#startBtn").click();
    await waitStep(page, "trumpet", 25_000);
    await waitStep(page, "e1", 15_000);
    const moving = await page.evaluate(() =>
      document.getAnimations()
        .filter((a) => a.playState === "running" && a.effect?.getKeyframes)
        .filter((a) => a.effect.getKeyframes().some((k) => k.transform && k.transform !== "none"))
        .map((a) => a.effect.target?.id || a.effect.target?.className || "?"));
    expect(moving).toEqual([]);
    w.expectClean();
  });
});
