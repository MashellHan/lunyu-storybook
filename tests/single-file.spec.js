import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { watch, waitStep, firstLead, chapterConfig } from "./helpers.js";

// dist/index-single.html must work offline by double-click (file://, everything inlined).
const single = path.resolve("dist", "index-single.html");

test("single-file build opens from file:// and starts", async ({ page }) => {
  test.skip(!!process.env.BASE_URL || !fs.existsSync(single), "local only; run npm run build:single first");
  const w = watch(page);
  await page.goto(pathToFileURL(single).href, { waitUntil: "load" });
  const lead = await firstLead(page);
  await expect(page.locator("#startBtn")).toBeVisible();
  await page.locator("#startBtn").click();
  await waitStep(page, lead.step, 30_000);
  const config = await chapterConfig(page);
  const segments = config.pages[0].groups.flatMap(group => group.segments);
  expect(await page.locator("#cards [data-annotation-segment]").evaluateAll(nodes => nodes.map(node => ({ id: node.dataset.annotationSegment, meaning: node.textContent })))).toEqual(segments.map(segment => ({ id: segment.id, meaning: segment.annotation.meaning })));
  await expect(page.locator(".card .annotations")).toHaveCount(0);
  const external = w.ok.filter((u) => !u.startsWith("file:") && !u.startsWith("data:"));
  expect(external, "no network requests").toEqual([]);
  w.expectClean();
});

test("offline volume indexes have no audio and lead to the independent chapter and back", async ({ page, context }) => {
  test.skip(!!process.env.BASE_URL, "local offline package only");
  const index = path.resolve("dist", "index.html");
  const volume = path.resolve("dist", "xue-er.html");
  expect(fs.readFileSync(index, "utf8")).not.toMatch(/data:audio|new Audio\(|<audio\b/i);
  expect(fs.readFileSync(volume, "utf8")).not.toMatch(/data:audio|new Audio\(|<audio\b/i);
  await context.setOffline(true);
  const w = watch(page);
  await page.goto(pathToFileURL(index).href, { waitUntil: "load" });
  await expect(page.locator(".volume")).toHaveCount(20);
  await expect(page.getByRole("link")).toHaveCount(1);
  await expect(page.locator(".catalog")).not.toContainText("学而时习之");
  await expect(page.locator(".volume-index")).toHaveAttribute("href", "./xue-er.html");
  await page.locator(".volume-index").click();
  await expect(page).toHaveURL(pathToFileURL(volume).href);
  await expect(page.locator(".chapter-directory li")).toHaveCount(16);
  await page.locator("#chapter-1 a").click();
  await expect(page).toHaveURL(pathToFileURL(single).href);
  await page.locator("#stopBtn").click();
  await expect(page.locator("#book")).toHaveAttribute("data-step", "free");
  await page.locator("#homeBtn").click();
  await expect(page).toHaveURL(pathToFileURL(index).href + "#xue-er");
  await expect(page.locator(".volume-index")).toBeFocused();
  expect(w.ok.filter(url => !url.startsWith("file:") && !url.startsWith("data:"))).toEqual([]);
  w.expectClean();
});
