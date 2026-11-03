import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { watch, waitStep } from "./helpers.js";

// dist/index-single.html must work offline by double-click (file://, everything inlined).
const single = path.resolve("dist", "index-single.html");

test("single-file build opens from file:// and starts", async ({ page }) => {
  test.skip(!!process.env.BASE_URL || !fs.existsSync(single), "local only; run npm run build:single first");
  const w = watch(page);
  await page.goto(pathToFileURL(single).href, { waitUntil: "load" });
  await expect(page.locator("#startBtn")).toBeVisible();
  await page.locator("#startBtn").click();
  await waitStep(page, "trumpet", 25_000);
  const external = w.ok.filter((u) => !u.startsWith("file:") && !u.startsWith("data:"));
  expect(external, "no network requests").toEqual([]);
  w.expectClean();
});
