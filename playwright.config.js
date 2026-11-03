// npm test  -> builds, serves public/ locally, runs tests/*.spec.js in Chromium.
// BASE_URL=https://... npx playwright test   -> run the same tests against a deployed site.
// Browser: uses $CHROME_PATH or /usr/bin/google-chrome when present, else Playwright's own Chromium
// (one-time: npx playwright install chromium).
import { defineConfig } from "@playwright/test";
import fs from "node:fs";

const chrome = process.env.CHROME_PATH || ["/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((p) => fs.existsSync(p));
const remote = !!process.env.BASE_URL;

export default defineConfig({
  testDir: "tests",
  timeout: 60_000,
  fullyParallel: true,
  workers: 3,
  reporter: [["list"]],
  use: {
    baseURL: process.env.BASE_URL || "http://127.0.0.1:4173",
    viewport: { width: 1180, height: 820 },
    launchOptions: { executablePath: chrome, args: ["--autoplay-policy=user-gesture-required"] },
  },
  webServer: remote ? undefined : { command: "node scripts/serve.mjs", url: "http://127.0.0.1:4173", reuseExistingServer: true },
});
