// playwright.config.ts
//
// R2 · Playwright test harness for NEX browser + mobile journeys · sealed 2026-09-25.
// Founder-sealed acceptance: journey must run at 375×812, 390×844, 393×852.
// WebKit is used for iOS-like mobile behaviour; Chromium for the desktop reference.
//
// Tests live under tests/e2e/**/*.spec.ts.

import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.NEX_E2E_BASE_URL ?? "http://localhost:3008";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // journey tests provision shared merchant state
  retries: 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Force headless in CI; headed locally if HEADED=1.
    headless: process.env.HEADED !== "1",
  },
  projects: [
    {
      name: "iPhone-13-375",
      use: { ...devices["iPhone 13"] }, // 390×844 · we override viewport in tests for 375
    },
    {
      name: "iPhone-14-Pro-393",
      use: { ...devices["iPhone 14 Pro"] }, // 393×852
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.NEX_E2E_SKIP_WEBSERVER
    ? undefined
    : {
        command: "npm run dev",
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 120_000,
        stdout: "pipe",
        stderr: "pipe",
      },
});
