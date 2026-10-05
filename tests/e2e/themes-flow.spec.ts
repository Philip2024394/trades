// tests/e2e/themes-flow.spec.ts
//
// Phase 2 end-to-end proof · founder-approved acceptance 2026-10-05.
//
// Walks the FULL user journey against a dev fixture that mounts the
// real ThemeBrowserClient with Phase 1 (phone tiles) and Phase 2
// (immersive preview) flags both on. If any of these tests regresses,
// the user-visible flow is broken.
//
// Flow:
//   land on gallery
//     → see mini-phone tiles (not legacy flat tiles)
//     → tap a tile
//     → immersive preview takes over (mobile edge-to-edge, no inner frame)
//     → URL updates to ?preview=<id>
//     → sample bubbles + composer visible, theme-styled
//     → send a sample message · appears as a theme bubble
//     → navigate to next theme via chevron
//     → local chat cleared on theme switch
//     → close with back button
//     → URL loses ?preview
//     → returns to gallery with tiles intact
//
// A separate "throttled performance" test uses CDP to emulate 4G
// network + 4× CPU slowdown (Pixel-6a-class) and measures the gallery
// first-interactive time. Numbers are REPORTED, not asserted, so this
// does not fail CI as devices get faster — the goal is honest telemetry.

import { test, expect } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

const FLOW_PATH = "/nex-native/dev/themes-flow-fixture";

const OUT_DIR = path.join(
  process.cwd(),
  "tests",
  "e2e-screenshots",
  "themes-flow",
);
try {
  fs.mkdirSync(OUT_DIR, { recursive: true });
} catch {
  // noop
}

async function isFlowOpen(
  page: import("@playwright/test").Page,
): Promise<boolean> {
  try {
    await page
      .locator("[data-nex-themes-flow-fixture]")
      .waitFor({ state: "visible", timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
}

test.describe("Phase 2 · end-to-end · gallery → tile → preview → back", () => {
  test.setTimeout(120_000);

  test("mobile · full journey · gallery to preview to close", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(FLOW_PATH);
    const open = await isFlowOpen(page);
    test.skip(!open, "fixture gated");

    // ─── 1. Gallery renders phone tiles (not legacy flat cards) ───
    const tiles = page.locator("[data-phone-tile]");
    const tileCount = await tiles.count();
    expect(tileCount, "4 themes should render as 4 tiles").toBe(4);
    // Grid resolves to 2 columns at 390 wide.
    const trackCount = await page
      .locator("[data-nex-themes-phone-grid]")
      .evaluate(
        (el) => getComputedStyle(el as HTMLElement).gridTemplateColumns.split(" ").length,
      );
    expect(trackCount).toBe(2);
    // No immersive shell visible yet.
    await expect(
      page.locator("[data-nex-immersive-preview]"),
    ).toHaveCount(0);

    // ─── 2. Tap the third tile (Bisnis · Sparkle) ───
    await tiles.nth(2).click();

    // ─── 3. Immersive preview mounts ───
    const shell = page.locator("[data-nex-immersive-preview]");
    await expect(shell).toBeVisible({ timeout: 5_000 });
    // Mobile edge-to-edge · shell fills the viewport.
    const shellBox = await shell.boundingBox();
    expect(shellBox?.width).toBeCloseTo(390, 1);
    expect(shellBox?.height).toBeCloseTo(844, 1);
    // No inner phone silhouette · border-radius on phone body is 0 at mobile breakpoint.
    const phoneRadius = await page
      .locator("[data-nex-preview-phone]")
      .evaluate((el) => getComputedStyle(el as HTMLElement).borderRadius);
    expect(phoneRadius).toBe("0px");

    // ─── 4. URL carries ?preview=<id> ───
    await page.waitForFunction(() =>
      new URLSearchParams(location.search).get("preview") === "flow-bisnis-sparkle",
    );

    // ─── 5. Topstrip shows the right theme ───
    await expect(page.locator("[data-nex-preview-topstrip]")).toContainText(
      "Bisnis · Sparkle",
    );

    // ─── 6. Send a local test message ───
    const input = page.locator("[data-nex-preview-composer-input]");
    await input.fill("premium feel");
    await page.locator('button[aria-label="Send sample message"]').click();
    // Bubble should appear inside the chat surface. We look for the
    // theme bubble containing our text.
    await expect(
      page.locator("[data-nex-theme-bubble]:has-text('premium feel')"),
    ).toBeVisible();

    // ─── 7. Capture mobile screenshot while preview is live ───
    await page.screenshot({
      path: path.join(OUT_DIR, "mobile-preview-live.png"),
      fullPage: false,
    });

    // ─── 8. Navigate to next theme via chevron ───
    await page.locator('[aria-label="Next theme"]').click();
    await expect(page.locator("[data-nex-preview-topstrip]")).toContainText(
      "Bisnis · Gradient",
    );
    // Local test message cleared on theme switch.
    await expect(
      page.locator("[data-nex-theme-bubble]:has-text('premium feel')"),
    ).toHaveCount(0);

    // ─── 9. Close via back button ───
    await page.goBack();
    // URL loses ?preview
    const search = new URL(page.url()).search;
    expect(search).not.toContain("preview=");
    // Immersive shell gone, gallery tiles intact.
    await expect(
      page.locator("[data-nex-immersive-preview]"),
    ).toHaveCount(0);
    await expect(page.locator("[data-phone-tile]")).toHaveCount(4);
  });

  test("desktop · full journey · gallery to preview to close", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(FLOW_PATH);
    const open = await isFlowOpen(page);
    test.skip(!open, "fixture gated");

    const tiles = page.locator("[data-phone-tile]");
    await expect(tiles.first()).toBeVisible();
    await tiles.nth(2).click();

    const shell = page.locator("[data-nex-immersive-preview]");
    await expect(shell).toBeVisible();
    const phone = page.locator("[data-nex-preview-phone]");
    const phoneBox = await phone.boundingBox();
    expect(phoneBox?.width).toBeCloseTo(390, 1);
    expect(phoneBox?.height).toBeGreaterThan(400);

    const rail = page.locator("[data-nex-preview-rail]");
    await expect(rail).toBeVisible();
    const railBox = await rail.boundingBox();
    expect(railBox?.width).toBeCloseTo(320, 2);

    // Capture desktop screenshot while preview is live.
    await page.screenshot({
      path: path.join(OUT_DIR, "desktop-preview-live.png"),
      fullPage: false,
    });

    // Close via Esc.
    await page.keyboard.press("Escape");
    await expect(
      page.locator("[data-nex-immersive-preview]"),
    ).toHaveCount(0);
  });

  test("gratis viewer · locked tile shows padlock · preview shows Upgrade CTA", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${FLOW_PATH}?mode=gratis`);
    const open = await isFlowOpen(page);
    test.skip(!open, "fixture gated");

    const bisnisTile = page.locator("[data-phone-tile]").nth(2);
    const tileText = await bisnisTile.textContent();
    expect(tileText).toContain("🔒");

    await bisnisTile.click();
    const footerText = await page
      .locator("[data-nex-preview-footer-mobile]")
      .textContent();
    expect(footerText).toContain("Upgrade to NEX Bisnis");
  });

  test("activation CTA from preview reaches server action with correct id", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(FLOW_PATH);
    const open = await isFlowOpen(page);
    test.skip(!open, "fixture gated");

    const tiles = page.locator("[data-phone-tile]");
    await tiles.nth(1).click(); // Free · Pill (not active)
    await page.locator("button:has-text('Use this theme')").first().click();
    const activated = await page.evaluate(
      () => document.body.dataset.nexFlowActivated ?? null,
    );
    expect(activated).toBe("flow-free-pill");
  });

  test("deep link · ?preview=<id> opens the correct preview on first paint", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${FLOW_PATH}?preview=flow-bisnis-gradient`);
    const open = await isFlowOpen(page);
    test.skip(!open, "fixture gated");

    await expect(
      page.locator("[data-nex-immersive-preview]"),
    ).toBeVisible();
    await expect(
      page.locator("[data-nex-preview-topstrip]"),
    ).toContainText("Bisnis · Gradient");
  });
});

test.describe("Phase 2 · performance telemetry", () => {
  test.setTimeout(120_000);

  // Pixel-6a-ish throttling: 4× CPU slowdown + 4G network. Numbers
  // reported, not asserted · see brief: "Do not claim a performance
  // target has been met unless it is actually measured."
  test("throttled first-interactive · reported for review", async ({
    page,
    browser: _browser,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });

    const client = await page.context().newCDPSession(page);
    // CPU throttling: 4× slower (Pixel-6a-class).
    await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    // Network: typical 4G.
    await client.send("Network.enable");
    await client.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 70,
      downloadThroughput: (4 * 1024 * 1024) / 8,
      uploadThroughput: (3 * 1024 * 1024) / 8,
    });

    const startNav = Date.now();
    await page.goto(FLOW_PATH);
    const open = await isFlowOpen(page);
    test.skip(!open, "fixture gated");

    const navMs = Date.now() - startNav;

    // Measure first-interactive on the grid · time from fixture mount
    // to all 4 tiles reporting data-visible="true" / "false".
    const startGrid = Date.now();
    await page.waitForFunction(() => {
      const tiles = Array.from(document.querySelectorAll("[data-phone-tile]"));
      return (
        tiles.length === 4 &&
        tiles.every((t) => (t as HTMLElement).dataset.visible !== undefined)
      );
    });
    const gridMs = Date.now() - startGrid;

    // Measure tile tap → preview visible under throttling.
    const startPreview = Date.now();
    await page.locator("[data-phone-tile]").nth(2).click();
    await page
      .locator("[data-nex-immersive-preview]")
      .waitFor({ state: "visible" });
    const previewMs = Date.now() - startPreview;

    const summary = {
      viewport: "390x844",
      cpuThrottling: "4x",
      network: "4G (latency 70ms · 4Mbps down · 3Mbps up)",
      navigationMs: navMs,
      gridInteractiveMs: gridMs,
      tileToPreviewMs: previewMs,
      budgets: {
        gridInteractiveTarget: 500,
        tileToPreviewTarget: 300,
      },
    };
    // eslint-disable-next-line no-console
    console.log("[perf]", JSON.stringify(summary));
    await testInfo.attach("throttled-perf.json", {
      body: Buffer.from(JSON.stringify(summary, null, 2)),
      contentType: "application/json",
    });
    // Reset throttling before context teardown.
    await client.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  });
});
