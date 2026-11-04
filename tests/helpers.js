import { expect } from "@playwright/test";

export const legacyURL = new URL("../build/legacy-regression/index-single.html", import.meta.url).href;
export const chapterConfig = page => page.evaluate(() => {
  const script = [...document.scripts].find(node => /const CHAPTER = /.test(node.textContent));
  return JSON.parse(script.textContent.match(/const CHAPTER = ([^\n]+);/)[1]);
});
export const firstLead = async (page, index = 0) => {
  const config = await chapterConfig(page);
  const group = config?.pages[0].groups[index];
  const segment = group?.segments.find(s => [...s.text].filter(ch => /\p{Script=Han}/u.test(ch)).length >= 5) || group?.segments[0];
  return config ? { step: `lead-${segment.id}`, key: `${segment.id}:elephant` } : { step: `e${index + 1}`, key: `e${index + 1}` };
};

export const step = (page) => page.evaluate(() => document.querySelector("#book").dataset.step);
export const waitStep = (page, s, timeout = 20_000) =>
  page.waitForFunction((s) => document.querySelector("#book").dataset.step === s, s, { timeout });
export const played = (page) => page.evaluate(() => window.__log.map((x) => x.key));

/** Collects JS errors, console errors and failed / >=400 responses for the whole test. */
export function watch(page) {
  const errors = [], bad = [], ok = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("requestfailed", (r) => bad.push(`failed ${r.url()}`));
  page.on("response", (r) => (r.status() >= 400 ? bad.push(`${r.status()} ${r.url()}`) : ok.push(r.url())));
  return {
    ok,
    expectClean() {
      expect(errors, "JS / console errors").toEqual([]);
      expect(bad, "failed requests").toEqual([]);
    },
  };
}

export async function openAndStart(page) {
  await page.goto(legacyURL, { waitUntil: "networkidle" });
  await page.locator("#startBtn").click();
  await waitStep(page, "trumpet", 25_000);
}

// Speed up the existing MP3s for cancellation tests; waits, callbacks and media events stay real.
export async function fastAudio(page) {
  await page.addInitScript(() => {
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      const key = window.__log?.at(-1)?.key;
      this.playbackRate = key === "title" ? 4 : ["trumpet", "squeak", "meow", "woof"].includes(key) ? 2 : 8;
      return play.call(this);
    };
  });
}
