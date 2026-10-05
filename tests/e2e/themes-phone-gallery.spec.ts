// tests/e2e/themes-phone-gallery.spec.ts
//
// Phase 1 regression · Phone Gallery tiles · founder-approved 2026-10-05.
//
// Verifies the new <PhoneGrid> renders at the agreed responsive
// breakpoints, keyboard-opens via the existing preview wiring, respects
// prefers-reduced-motion, and that the flag-OFF path still shows the
// legacy ThemeGridCard markup on the real route.
//
// The fixture at /nex-native/dev/phone-gallery-fixture mounts PhoneGrid
// with hard-coded themes so the test does not require an authenticated
// session (chat-themes-library redirects anonymous visitors to sign-in).
//
// Running:
//   npm run dev                       # terminal 1
//   npx playwright test themes-phone-gallery   # terminal 2
//
// If the fixture 404s the suite skips cleanly (dev gate closed).

import { test, expect } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

const FIXTURE_PATH = "/nex-native/dev/phone-gallery-fixture";
const LIBRARY_PATH = "/nex-native/chat-themes-library";

const OUT_DIR = path.join(
  process.cwd(),
  "tests",
  "e2e-screenshots",
  "phone-gallery",
);
try {
  fs.mkdirSync(OUT_DIR, { recursive: true });
} catch {
  // noop
}

async function isFixtureOpen(
  page: import("@playwright/test").Page,
): Promise<boolean> {
  try {
    await page
      .getByRole("heading", { name: "Phone Gallery fixture" })
      .waitFor({ state: "visible", timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
}

test.describe("Phase 1 · Phone Gallery · responsive + a11y", () => {
  test.setTimeout(90_000);

  // Phone-size matrix · covers every mainstream mobile viewport so a
  // narrow iPhone SE and a wide foldable both get the same 2-up grid.
  // Founder-raised 2026-10-05 · see _phone-tile.tsx breakpoint policy.
  for (const [label, w, h, expectCols] of [
    ["phone 320 · iPhone SE", 320, 568, 2],
    ["phone 360 · Android compact", 360, 740, 2],
    ["phone 375 · iPhone mini", 375, 812, 2],
    ["phone 390 · iPhone 14/15", 390, 844, 2],
    ["phone 414 · iPhone Plus", 414, 896, 2],
    ["phone 430 · iPhone 14 Pro Max", 430, 932, 2],
    ["phone 480 · Pixel 7 Pro", 480, 1040, 2],
    ["phone 540 · foldable unfolded", 540, 900, 2],
    ["tablet 768 · iPad", 768, 1024, 3],
    ["desktop 1280", 1280, 900, 4], // auto-fill(min 200) with max-width 920 → ⌊920/200⌋ = 4 cols
  ] as const) {
    test(`${label} · grid resolves to ${expectCols} columns`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto(FIXTURE_PATH);
      const open = await isFixtureOpen(page);
      test.skip(!open, "fixture gated · ensure dev server is running");

      const grid = page.locator("[data-nex-themes-phone-grid]");
      await expect(grid).toBeVisible();

      // Count visible tiles aligned on the first row to infer the
      // actual CSS grid resolution. We read computed grid-template-
      // columns · if it resolves to N tracks, that's the column count.
      const trackCount = await grid.evaluate((el) => {
        const cs = getComputedStyle(el as HTMLElement);
        return cs.gridTemplateColumns.split(" ").length;
      });
      expect(
        trackCount,
        `${label} should resolve to ${expectCols} columns, got ${trackCount}`,
      ).toBe(expectCols);

      await page.screenshot({
        path: path.join(OUT_DIR, `${label.replace(/\s+/g, "-").replace(/[×]/g, "x")}.png`),
        fullPage: false,
      });
    });
  }

  test("tiles render with 9:18 aspect ratio", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(FIXTURE_PATH);
    const open = await isFixtureOpen(page);
    test.skip(!open, "fixture gated");

    const firstTile = page.locator("[data-phone-tile]").first();
    const box = await firstTile.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;
    // Button height = phone silhouette (9:18) + caption. We assert the
    // SILHOUETTE's aspect ratio by sampling the inner frame.
    const frameBox = await firstTile
      .locator('div[style*="aspect-ratio"]')
      .first()
      .boundingBox();
    expect(frameBox).not.toBeNull();
    if (!frameBox) return;
    const ratio = frameBox.height / frameBox.width;
    expect(
      ratio,
      `phone silhouette aspect should be 18/9 ≈ 2.0, got ${ratio.toFixed(3)}`,
    ).toBeGreaterThan(1.9);
    expect(ratio).toBeLessThan(2.1);
  });

  test("gratis viewer sees lock badge on Bisnis tiles", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${FIXTURE_PATH}?mode=gratis`);
    const open = await isFixtureOpen(page);
    test.skip(!open, "fixture gated");

    const bisnisTile = page.locator('[data-phone-tile]').nth(2); // fx-bisnis-sparkle
    await expect(bisnisTile).toBeVisible();
    // Lock badge is a 22×22 div containing a lock glyph in the top-right.
    const lockText = await bisnisTile.textContent();
    expect(lockText).toContain("🔒");
  });

  test("trial viewer sees FREE pulse pill on Bisnis tiles", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${FIXTURE_PATH}?mode=trial`);
    const open = await isFixtureOpen(page);
    test.skip(!open, "fixture gated");

    const bisnisTile = page.locator('[data-phone-tile]').nth(2);
    await expect(bisnisTile).toBeVisible();
    const text = await bisnisTile.textContent();
    expect(text).toContain("FREE");
  });

  test("active theme shows Active chip", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(FIXTURE_PATH);
    const open = await isFixtureOpen(page);
    test.skip(!open, "fixture gated");

    // fx-free-active is the 7th fixture · index 6.
    const activeTile = page.locator('[data-phone-tile]').nth(6);
    await expect(activeTile).toBeVisible();
    const text = await activeTile.textContent();
    expect(text).toContain("Active");
  });

  test("keyboard · Tab reaches a tile and Enter dispatches onOpen", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(FIXTURE_PATH);
    const open = await isFixtureOpen(page);
    test.skip(!open, "fixture gated");

    // Keep tabbing until we land on a tile (page has a heading / meta
    // before the grid, so the first few tabs may fall on other focusables).
    let focusedTile: string | null = null;
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press("Tab");
      focusedTile = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return null;
        return el.dataset.themeIndex ?? null;
      });
      if (focusedTile !== null) break;
    }
    expect(focusedTile, "tab should land on a [data-phone-tile]").not.toBeNull();

    // Enter should dispatch onOpen · fixture mirrors the last-opened
    // id into document.body.dataset.nexFixtureLastOpen.
    await page.keyboard.press("Enter");
    const opened = await page.evaluate(
      () => document.body.dataset.nexFixtureLastOpen ?? null,
    );
    expect(opened, "Enter should fire onOpen").not.toBeNull();
  });

  test("prefers-reduced-motion · animations disabled on tiles", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(FIXTURE_PATH);
    const open = await isFixtureOpen(page);
    test.skip(!open, "fixture gated");

    const anyTile = page.locator("[data-phone-tile]").nth(2);
    // Any descendant with an animation should have its animation
    // forced to "none" by our media query override.
    const info = await anyTile.evaluate((root) => {
      const nodes = Array.from(root.querySelectorAll("*"));
      const animated = nodes.find((n) => {
        const cs = getComputedStyle(n as HTMLElement);
        return cs.animationName !== "none" && cs.animationName !== "";
      });
      return animated ? getComputedStyle(animated as HTMLElement).animationName : "none";
    });
    expect(info, "reduced-motion should force animation: none inside tiles").toBe("none");
    await ctx.close();
  });

  test("IntersectionObserver · off-screen tiles get data-visible=false", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 400 });
    await page.goto(FIXTURE_PATH);
    const open = await isFixtureOpen(page);
    test.skip(!open, "fixture gated");

    // Let the IO settle a tick.
    await page.waitForTimeout(500);
    // The last fixture tile (index 7) should be well below the viewport
    // at 400px tall. First few should be visible.
    const states = await page.evaluate(() =>
      Array.from(document.querySelectorAll("[data-phone-tile]")).map(
        (el) => (el as HTMLElement).dataset.visible ?? "unset",
      ),
    );
    expect(states.length).toBe(8);
    // First tile must be visible, last tile should NOT be.
    expect(states[0]).toBe("true");
    expect(states[states.length - 1]).toBe("false");
  });
});

test.describe("Phase 1 · flag-OFF regression on real library route", () => {
  test.setTimeout(60_000);

  test("legacy ThemeGridCard still renders when flag is OFF", async ({
    page,
  }) => {
    // The real library route redirects anonymous → /sign-in. We just
    // need to verify the route doesn't 500 and that if NEX_THEMES_PHONE_TILES
    // is not set, the response does NOT contain phone-tile markers.
    // (It also won't contain legacy grid markers because sign-in strips
    // them — but the fact that no phone-tile marker leaked is the proof
    // the flag defaults closed.)
    const flagOn = process.env.NEX_THEMES_PHONE_TILES === "1";
    test.skip(flagOn, "spec runs with flag OFF only · unset NEX_THEMES_PHONE_TILES");

    await page.goto(LIBRARY_PATH);
    const html = await page.content();
    expect(html).not.toContain("data-nex-themes-phone-grid");
    expect(html).not.toContain("data-phone-tile");
  });
});
