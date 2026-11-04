import { test, expect } from "@playwright/test";
import { watch, waitStep, played, step, openAndStart, legacyURL, chapterConfig, firstLead } from "./helpers.js";

const IMAGES = ["elephant-640.webp", "cat-640.webp", "bunny-ear.webp", "bunny-base.webp", "dog-tail.webp", "dog-body.webp", "dog-head.webp", "icon.png"];

test("loads with no JS errors, shows the title and ▶ only", async ({ page }) => {
  const w = watch(page);
  await page.goto("/learn/xue-er/1/", { waitUntil: "networkidle" });
  await expect(page.locator("#title")).toBeVisible();
  await expect(page.locator("#startBtn")).toBeVisible();
  await expect(page.locator("#startBtn")).toHaveText("");          // ▶ icon only, no words
  await expect(page.locator("#ttMain")).toContainText("学而时习之");
  const config = await chapterConfig(page);
  const segments = config.pages[0].groups.flatMap(group => group.segments);
  expect(await page.locator("#cards [data-annotation-segment]").evaluateAll(nodes => nodes.map(node => ({ id: node.dataset.annotationSegment, meaning: node.textContent })))).toEqual(segments.map(segment => ({ id: segment.id, meaning: segment.annotation.meaning })));
  await expect(page.locator(".card .annotations")).toHaveCount(0);
  expect(await step(page)).toBe("title");
  await page.waitForTimeout(1500);
  w.expectClean();
});

test("every asset returns 200 with the right type", async ({ page, request }) => {
  const w = watch(page);
  await page.goto("/learn/xue-er/1/", { waitUntil: "networkidle" });
  for (const f of IMAGES) {
    const r = await request.get(`/assets/img/${f}`);
    expect(r.status(), f).toBe(200);
    expect(r.headers()["content-type"], f).toMatch(f.endsWith(".png") ? /image\/png/ : /image\/webp/);
  }
  const credits = await request.get("/CREDITS.md");
  expect(credits.status()).toBe(200);
  expect(await credits.text()).toContain("527845");
  const config = await chapterConfig(page);
  const clips = await page.evaluate(() => {
    const script = [...document.scripts].find(node => /const AUD = /.test(node.textContent));
    return JSON.parse(script.textContent.match(/const AUD = ([^\n]+);/)[1]);
  });
  const expected = config ? ["title", "again", "squeak", "meow", "woof", "trumpet", ...config.pages.flatMap(p => p.groups.flatMap(g => g.segments.flatMap(s =>
    (config.number === 1 ? ["elephant", "children", g.audio.soloRole] : ["elephant", "children", "bunny", "cat", "dog"]).map(role => `${s.id}:${role}`))))]
    : ["title", "again", "e1", "e2", "e3", "u1", "u2", "u3", "b1", "c2", "d3", "squeak", "meow", "woof", "trumpet"];
  expect(Object.keys(clips).sort()).toEqual([...new Set(expected)].sort());
  expect(Object.values(clips).every(src => src.startsWith("data:audio/mpeg;base64,") && src.length > 100)).toBe(true);
  w.expectClean();
});

test("the published edition cancels its actual title and reading, then replays on the same Audio", async ({ page }) => {
  const w = watch(page);
  await page.addInitScript(() => {
    window.__audioInstances = [];
    window.Audio = new Proxy(window.Audio, { construct(target, args) {
      const audio = Reflect.construct(target, args); window.__audioInstances.push(audio); return audio;
    } });
  });
  for (const phase of ["title", "title-voice", "lead", "paused"]) {
    await page.goto(`/learn/xue-er/1/?cancel=${phase}`);
    const lead = await firstLead(page);
    if (phase === "title-voice") {
      await page.locator("#startBtn").click();
      await expect.poll(() => page.evaluate(() => window.__log.at(-1)?.key === "title" && window.__demo.audio.currentTime > .03)).toBe(true);
    } else if (phase !== "title") {
      await page.locator("#stopBtn").click(); await page.locator(".card").first().click();
      await expect.poll(() => page.evaluate(key => window.__log.at(-1)?.key === key && window.__demo.audio.currentTime > .03, lead.key)).toBe(true);
      if (phase === "paused") await page.locator("#pauseBtn").click();
    }
    await page.evaluate(() => { window.__staleEnded = window.__demo.audio.onended; });
    await page.locator("#stopBtn").click();
    await expect(page.locator("#book")).toHaveAttribute("data-step", "free");
    await expect(page.locator(".star.on,.card .cur,.card .done,.aBubble.show")).toHaveCount(0);
    const count = await page.evaluate(() => { window.__staleEnded?.(); return window.__log.length; });
    await page.waitForTimeout(phase === "title" ? 2400 : 400);
    expect(await page.evaluate(() => window.__log.length)).toBe(count);
    expect(await page.evaluate(() => window.__demo.audio.paused)).toBe(true);
    await page.locator(".card").first().click();
    await expect.poll(() => page.evaluate(key => window.__log.at(-1)?.key === key && window.__demo.audio.currentTime > .03, lead.key)).toBe(true);
    expect(await page.evaluate(() => window.__audioInstances.length === 1 && window.__audioInstances[0] === window.__demo.audio)).toBe(true);
    await page.locator("#stopBtn").click();
  }
  w.expectClean();
});

test("title → ▶ → trumpet → elephant reads line 1 → friends read together", async ({ page }) => {
  test.skip(!!process.env.BASE_URL, "Original three-sentence regression fixture is local-only");
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
  test.skip(!!process.env.BASE_URL, "Original three-sentence regression fixture is local-only");
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
  test.skip(!!process.env.BASE_URL, "Original three-sentence regression fixture is local-only");
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
    test.skip(!!process.env.BASE_URL, "Original three-sentence regression fixture is local-only");
    const w = watch(page);
    await page.goto(legacyURL, { waitUntil: "networkidle" });
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
