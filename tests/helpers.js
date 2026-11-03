import { expect } from "@playwright/test";

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
  await page.goto("/", { waitUntil: "networkidle" });
  await page.locator("#startBtn").click();
  await waitStep(page, "trumpet", 25_000);
}
