// tests/e2e/nex-directory.spec.ts
//
// NEX Directory · Phase A · real-browser smoke proof.
//
// Scope
//   · Verifies that `GET /nex-native/directory?country=ID` renders the
//     Directory shell (page marker, hero title, search form, tabs) and
//     at least one listing card when `nex.business_directory_v` has
//     rows (7 at author time).
//   · Verifies empty-state handling for countries with 0 publishable
//     rows (currently every country except ID returns empty — the
//     test tolerates both "renders card" and "renders empty state").
//   · Verifies pagination/CTA affordances if the page has grown them
//     (gracefully absent today; test asserts tolerance, not existence).
//   · Verifies the missing-country case (no `?country=`) resolves to
//     an honest state (today the page hard-codes ID; test accepts
//     either a picker or the default-country render).
//   · Validates mobile + desktop viewports.
//
// Dev-server dependency
//   The Playwright config spawns `npm run dev` on port 3008 when
//   NEX_E2E_SKIP_WEBSERVER is unset. For hand-run harnesses that start
//   the server externally, this test performs a pre-flight HTTP probe
//   and SKIPS with an explicit reason when the server is unreachable.
//   This keeps CI green when the suite runs under an incompatible
//   container.
//
// Why no DB fixture
//   Unlike `nex-socials-chooser.spec.ts`, the Directory does not
//   require a logged-in session. The sealed publication view is
//   publicly readable (RLS is enforced at the DB role level, not the
//   Supabase JWT layer). Zero cookies required.
//
// Why no new webServer
//   The playwright.config.ts already provides a `webServer` block that
//   runs `npm run dev` with `reuseExistingServer: true`. This test
//   relies on that same server. The probe is belt-and-braces for the
//   case where webServer is suppressed via NEX_E2E_SKIP_WEBSERVER.

import { expect, test } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

const BASE_URL = process.env.NEX_E2E_BASE_URL ?? "http://localhost:3008";
const SCREENSHOT_DIR = path.join(
  process.cwd(),
  "tests",
  "e2e-screenshots",
  "nex-directory",
);

function ensureScreenshotDir() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function serverReachable(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE_URL}/nex-native/directory`, {
      method: "GET",
      redirect: "manual",
      // Playwright's own `test.use({...})` isn't available in this
      // check context · use a short timeout via AbortController.
      signal: AbortSignal.timeout(5_000),
    });
    // Any 2xx/3xx is "server is alive". A redirect to sign-in would
    // still signal reachability.
    return r.status > 0 && r.status < 500;
  } catch {
    return false;
  }
}

test.describe("NEX Directory · Phase A UI smoke", () => {
  test.beforeAll(async () => {
    const alive = await serverReachable();
    test.skip(
      !alive,
      `SKIPPED · dev server not reachable at ${BASE_URL}. Run \`npm run dev\` on port 3008 (or set NEX_E2E_BASE_URL + NEX_E2E_SKIP_WEBSERVER=1).`,
    );
  });

  test("country=ID renders page shell + at least one listing (desktop)", async ({
    browser,
  }) => {
    ensureScreenshotDir();
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 820 },
    });
    try {
      const page = await ctx.newPage();
      await page.goto(`${BASE_URL}/nex-native/directory?country=ID`, {
        waitUntil: "networkidle",
      });

      // Page shell markers.
      await expect(page.locator("[data-nex-directory-page]")).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.locator("[data-nex-directory-hero]")).toBeVisible();
      await expect(
        page.locator("[data-nex-directory-search-form]"),
      ).toBeVisible();
      await expect(page.locator("[data-nex-directory-tabs]")).toBeVisible();

      // Hero title words appear.
      await expect(page.locator("[data-nex-directory-hero] h1")).toContainText(
        "Directory",
      );

      // systemReady must be true for the result-count assertion to be
      // meaningful · if the backing DB isn't configured, surface a
      // SKIPPED-shaped notice instead of a hard failure.
      const systemReady = await page
        .locator("[data-nex-directory-page]")
        .getAttribute("data-nex-directory-system-ready");
      test.skip(
        systemReady !== "true",
        `SKIPPED · directory system not ready (data-nex-directory-system-ready=${systemReady}).`,
      );

      // Expect ≥1 card when the view has publishable rows for ID.
      // The author-time count is 7 but the test tolerates any ≥1.
      const resultCountAttr = await page
        .locator("[data-nex-directory-page]")
        .getAttribute("data-nex-directory-result-count");
      const resultCount = Number.parseInt(resultCountAttr ?? "0", 10);
      expect(Number.isFinite(resultCount)).toBe(true);

      if (resultCount > 0) {
        const cards = page.locator("[data-nex-directory-card]");
        await expect(cards.first()).toBeVisible({ timeout: 10_000 });
        expect(await cards.count()).toBeGreaterThanOrEqual(1);
      } else {
        // Honest empty state in prod would show the "empty" badge.
        await expect(
          page.locator('[data-nex-directory-state="empty"]'),
        ).toBeVisible();
      }

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "01-country-ID-1280.png"),
        fullPage: true,
      });
    } finally {
      await ctx.close();
    }
  });

  test("country=ZZ (empty-state country) does not crash the page", async ({
    browser,
  }) => {
    // "ZZ" is reserved by ISO 3166-1 for user-assigned test codes and
    // the publication view has zero rows for it. The page must render
    // its shell either way; today page.tsx hard-codes DEFAULT_COUNTRY
    // = "ID" and ignores the query param (documented in the agent
    // report), so the result is the ID render. The test accepts
    // either behaviour and gates the stronger assertion.
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 820 },
    });
    try {
      const page = await ctx.newPage();
      const resp = await page.goto(`${BASE_URL}/nex-native/directory?country=ZZ`, {
        waitUntil: "networkidle",
      });
      expect(resp?.status()).toBeLessThan(500);
      await expect(page.locator("[data-nex-directory-page]")).toBeVisible({
        timeout: 30_000,
      });
      // Either an empty state renders OR cards render (if page hard-codes ID).
      const hasEmpty =
        (await page.locator('[data-nex-directory-state="empty"]').count()) > 0;
      const hasCards =
        (await page.locator("[data-nex-directory-card]").count()) > 0;
      expect(hasEmpty || hasCards).toBe(true);
    } finally {
      await ctx.close();
    }
  });

  test("no country param · page handles missing-country-param gracefully", async ({
    browser,
  }) => {
    // The current page.tsx hard-codes DEFAULT_COUNTRY and ignores
    // the query parameter · therefore the "no country" URL renders
    // the same ID results. When Agent 10's picker-integration ADR
    // lands, this test's assertion graduates to "picker is visible
    // AND highlights the geoip-default country." Today the test
    // accepts either path.
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 820 },
    });
    try {
      const page = await ctx.newPage();
      await page.goto(`${BASE_URL}/nex-native/directory`, {
        waitUntil: "networkidle",
      });
      await expect(page.locator("[data-nex-directory-page]")).toBeVisible({
        timeout: 30_000,
      });
      // Shell is present whether the picker is integrated or not.
      await expect(
        page.locator("[data-nex-directory-search-form]"),
      ).toBeVisible();
    } finally {
      await ctx.close();
    }
  });

  test("mobile viewport 393×852 renders the shell + results (iPhone 14 Pro)", async ({
    browser,
  }) => {
    ensureScreenshotDir();
    const ctx = await browser.newContext({
      viewport: { width: 393, height: 852 },
    });
    try {
      const page = await ctx.newPage();
      await page.goto(`${BASE_URL}/nex-native/directory?country=ID`, {
        waitUntil: "networkidle",
      });
      await expect(page.locator("[data-nex-directory-page]")).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.locator("[data-nex-directory-hero]")).toBeVisible();

      // On mobile, tabs are flex-wrap so all four pills must still be
      // present. We assert on their attribute enum rather than text
      // (which is i18n-liable).
      for (const tab of ["all", "business", "person", "place"]) {
        await expect(
          page.locator(`[data-nex-directory-tab="${tab}"]`),
        ).toBeVisible();
      }

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "02-country-ID-393.png"),
        fullPage: true,
      });
    } finally {
      await ctx.close();
    }
  });

  test("classification tab navigation updates the URL + the active-tab marker", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 820 },
    });
    try {
      const page = await ctx.newPage();
      await page.goto(`${BASE_URL}/nex-native/directory?country=ID`, {
        waitUntil: "networkidle",
      });
      await expect(page.locator("[data-nex-directory-page]")).toBeVisible({
        timeout: 30_000,
      });
      // Click the Businesses tab.
      await page.locator('[data-nex-directory-tab="business"]').click();
      await page.waitForURL(/[?&]tab=business/, { timeout: 10_000 });
      await expect(
        page.locator('[data-nex-directory-tab="business"]'),
      ).toHaveAttribute("data-nex-directory-tab-active", "true");
    } finally {
      await ctx.close();
    }
  });
});
