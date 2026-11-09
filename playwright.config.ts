import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

// Browser smoke tests for the site shell (header with "Sign in", footer, 404, mobile menu).
//
//   pnpm test:e2e                                   → starts `pnpm dev` on :3050 (or reuses one)
//   PLAYWRIGHT_BASE_URL=https://<deploy> pnpm test:smoke   → runs the @smoke tests against a deploy
//
// The dev server runs on src/lib/env.ts's development placeholders, so these tests need no
// secrets: they only visit pages that render without the database (home, a missing path,
// /signin, and the signed-out /dashboard redirect).
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3050";

/**
 * Local browser. Playwright's bundled Chromium refuses BAM's Intel Mac (macOS 13) and the installed
 * Google Chrome crashes headless there, so on macOS this uses the newest cached
 * chrome-headless-shell (the same one the witus library-PDF renderer uses). Override with
 * PLAYWRIGHT_CHROMIUM_EXECUTABLE. CI (Linux) uses Playwright's own browser.
 */
function localExecutable(): string | undefined {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  if (process.env.CI || process.platform !== "darwin") return undefined;
  const cache = join(homedir(), "Library", "Caches", "ms-playwright");
  if (!existsSync(cache)) return undefined;
  const shells = readdirSync(cache)
    .filter((d) => d.startsWith("chromium_headless_shell-"))
    .sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]));
  for (const dir of shells) {
    for (const arch of ["chrome-headless-shell-mac-x64", "chrome-headless-shell-mac-arm64"]) {
      const bin = join(cache, dir, arch, "chrome-headless-shell");
      if (existsSync(bin)) return bin;
    }
  }
  return undefined;
}

const executablePath = localExecutable();

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  // One dev server compiles routes on first hit; parallel workers just queue behind it.
  workers: 1,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "pnpm dev",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 180_000,
      },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1100, height: 800 } } },
    // The shared rule is no horizontal scroll at 320px; test there, not at a friendlier width.
    { name: "mobile-320", use: { ...devices["Desktop Chrome"], viewport: { width: 320, height: 640 }, hasTouch: true } },
  ],
});
