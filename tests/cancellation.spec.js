import { test, expect } from "@playwright/test";
import { fastAudio, waitStep, played, watch, legacyURL } from "./helpers.js";

test.beforeEach(() => test.skip(!!process.env.BASE_URL, "Original three-sentence regression fixture is local-only"));

const phases = ["title", "title-voice", "intro", "trumpet", "e1", "u1", "again", "solo-bunny", "sound-dog", "celebrate"];
for (const phase of phases) {
  test(`stop cancels ${phase} without awarding stars or reviving callbacks`, async ({ page }) => {
    const w = watch(page);
    await fastAudio(page);
    await page.goto(legacyURL, { waitUntil: "networkidle" });
    if (phase !== "title") {
      await page.locator("#startBtn").click();
      await waitStep(page, phase, 35_000);
    }
    const stars = await page.locator(".star.on").count();
    await page.locator("#stopBtn").click();
    await expect(page.locator("#book")).toHaveAttribute("data-step", "free");
    await expect(page.locator("#title")).toBeHidden();
    expect(await page.evaluate(() => window.__demo.audio.paused)).toBe(true);
    await expect(page.locator(".card.playing, .card .cur, .card .done, .aBubble.show, .char.busy, .lid.shut")).toHaveCount(0);
    await expect(page.locator(".star.on")).toHaveCount(stars);
    const stoppedLog = await played(page);
    await page.waitForTimeout(3300);
    await expect(page.locator("#book")).toHaveAttribute("data-step", "free");
    expect(await played(page)).toEqual(stoppedLog);
    await expect(page.locator(".star.on")).toHaveCount(stars);
    await page.locator(".card").nth(1).click();
    await expect.poll(() => played(page)).toContain("e2");
    expect(await page.evaluate(() => window.__demo.audio.muted)).toBe(false);
    await page.locator("#stopBtn").click();
    w.expectClean();
  });
}

test("stop while paused releases the old pause and permits a fresh character reading", async ({ page }) => {
  const w = watch(page);
  await fastAudio(page);
  await page.goto(legacyURL);
  await page.locator("#startBtn").click();
  await waitStep(page, "e1");
  await page.locator("#pauseBtn").click();
  expect(await page.evaluate(() => window.__demo.paused)).toBe(true);
  await page.locator("#stopBtn").click();
  await expect(page.locator("#pauseBtn")).toHaveAttribute("aria-pressed", "false");
  expect(await page.evaluate(() => window.__demo.paused)).toBe(false);
  await page.locator("#bunny").click();
  await expect.poll(() => played(page)).toContain("b1");
  await expect.poll(() => page.evaluate(() => window.__demo.audio.currentTime)).toBeGreaterThan(0);
  await page.locator("#stopBtn").click();
  w.expectClean();
});

test("first free-play tap primes the same Audio synchronously without using the start button", async ({ page }) => {
  const w = watch(page);
  await page.addInitScript(() => {
    const play = HTMLMediaElement.prototype.play;
    window.__testPlayCalls = [];
    window.__tapEvent = null;
    document.addEventListener("click", event => { window.__tapEvent = event; }, true);
    document.addEventListener("click", () => { window.__tapEvent = null; });
    HTMLMediaElement.prototype.play = function () {
      const event = window.__tapEvent;
      window.__testPlayCalls.push({
        element: this, muted: this.muted,
        trusted: event?.isTrusted === true,
        active: navigator.userActivation.isActive,
        listener: event?.currentTarget,
      });
      return play.call(this);
    };
  });
  await page.goto(legacyURL);
  await page.locator("#stopBtn").click();
  await page.locator("#bunny").click();
  await expect.poll(() => played(page)).toContain("b1");
  const calls = await page.evaluate(() => ({
    primed: window.__testPlayCalls.some(call => call.trusted && call.active && call.listener === document.getElementById("bunny") && call.muted),
    sameElement: window.__testPlayCalls.every(call => call.element === window.__demo.audio),
    muted: window.__demo.audio.muted,
  }));
  expect(calls).toEqual({ primed: true, sameElement: true, muted: false });
  await expect.poll(() => page.evaluate(() => window.__demo.audio.currentTime)).toBeGreaterThan(0);
  w.expectClean();
});

test("rapid animal taps cancel old waits, old onended callbacks, and all previous focal actions", async ({ page }) => {
  const w = watch(page);
  // Keep the real d3 playback window so a later valid woof cannot race the sampling.
  await page.goto(legacyURL);
  await page.locator("#stopBtn").click();
  await page.locator("#elephant").click();
  await page.evaluate(() => { window.__oldEnded = window.__demo.audio.onended; });
  const oldLog = (await played(page)).length;
  await page.locator("#bunny").click();
  await page.locator("#cat").click();
  await page.locator("#dog").click();
  await page.evaluate(() => window.__oldEnded?.());
  await expect.poll(() => played(page)).toContain("d3");
  expect((await played(page)).slice(oldLog)).toEqual(["d3"]);
  const moving = await page.evaluate(() => [...new Set(document.getAnimations().filter(animation =>
    animation.playState === "running" && !(animation instanceof CSSAnimation) && animation.effect?.target?.closest(".char"))
    .map(animation => animation.effect.target.closest(".char").id))]);
  expect(moving).toEqual(["dog"]);
  await page.locator("#stopBtn").click();
  const stoppedLog = await played(page);
  await page.waitForTimeout(1500);
  expect(await played(page)).toEqual(stoppedLog);
  w.expectClean();
});
