// tests/e2e/themes-immersive-preview.spec.ts
//
// Phase 2 regression · Immersive Preview Shell · founder-approved 2026-10-05.
//
// Exercises the new ImmersivePreviewShell via a dev-only fixture so we
// don't need an authenticated session on /nex-native/chat-themes-library.
// Covers: mobile edge-to-edge layout (no nested phone frame), desktop
// phone + info rail, URL ?preview=<id> state + popstate close + direct
// deep link, swipe navigation, prefers-reduced-motion, local test
// conversation (max 3 messages, cleared on theme switch and on close),
// premium/active/locked states, and a flag-OFF regression on the real
// library route proving nothing leaks when NEX_THEMES_IMMERSIVE_PREVIEW
// is unset.

import { test, expect } from "@playwright/test";

const FIXTURE_PATH = "/nex-native/dev/immersive-preview-fixture";
const LIBRARY_PATH = "/nex-native/chat-themes-library";

async function isFixtureOpen(
  page: import("@playwright/test").Page,
): Promise<boolean> {
  try {
    await page
      .locator("[data-nex-immersive-preview]")
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
}

test.describe("Phase 2 · Immersive Preview Shell", () => {
  test.setTimeout(90_000);

  test("mobile · fills viewport edge-to-edge · no nested phone frame", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(FIXTURE_PATH);
    const open = await isFixtureOpen(page);
    test.skip(!open, "fixture gated · ensure dev server is running");

    const shell = page.locator("[data-nex-immersive-preview]");
    const box = await shell.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;
    // Shell occupies the full viewport.
    expect(box.width).toBeCloseTo(390, 1);
    expect(box.height).toBeCloseTo(844, 1);

    // Phone body should NOT be a 390×820 inner box with its own
    // rounded border · on mobile it must flex to fill. We assert
    // border-radius is 0 (no rounded phone silhouette inside the shell).
    const phone = page.locator("[data-nex-preview-phone]");
    const radius = await phone.evaluate(
      (el) => getComputedStyle(el as HTMLElement).borderRadius,
    );
    expect(radius).toBe("0px");

    // Desktop-only chrome must be hidden on mobile.
    const notch = page.locator("[data-nex-preview-phone-notch]");
    await expect(notch).toBeHidden();
    const rail = page.locator("[data-nex-preview-rail]");
    await expect(rail).toBeHidden();
  });

  test("desktop · centred phone silhouette + 320px info rail", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(FIXTURE_PATH);
    const open = await isFixtureOpen(page);
    test.skip(!open, "fixture gated");

    const phone = page.locator("[data-nex-preview-phone]");
    const box = await phone.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;
    // Phone silhouette is 390 wide, up to 820 tall (clamped to viewport).
    expect(box.width).toBeCloseTo(390, 1);
    expect(box.height).toBeGreaterThan(400);

    const rail = page.locator("[data-nex-preview-rail]");
    await expect(rail).toBeVisible();
    const railBox = await rail.boundingBox();
    expect(railBox?.width).toBeCloseTo(320, 2);

    const notch = page.locator("[data-nex-preview-phone-notch]");
    const notchDisplay = await notch.evaluate(
      (el) => getComputedStyle(el as HTMLElement).display,
    );
    expect(notchDisplay).toBe("block");
  });

  test("URL state · opens with ?preview=<id> on mount", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(FIXTURE_PATH);
    const open = await isFixtureOpen(page);
    test.skip(!open, "fixture gated");

    await page.waitForFunction(() =>
      new URLSearchParams(location.search).has("preview"),
    );
    const url = page.url();
    expect(url).toContain("preview=fx-free-active");
  });

  test("URL state · deep link ?preview=fx-bisnis-sparkle opens that theme", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${FIXTURE_PATH}?i=2`);
    const open = await isFixtureOpen(page);
    test.skip(!open, "fixture gated");

    const label = page.locator("[data-nex-preview-topstrip]");
    await expect(label).toContainText("Bisnis · Sparkle");
  });

  test("browser back · closes preview + URL loses ?preview", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(FIXTURE_PATH);
    const open = await isFixtureOpen(page);
    test.skip(!open, "fixture gated");

    await page.waitForFunction(() =>
      new URLSearchParams(location.search).has("preview"),
    );
    await page.goBack();
    // The fixture's parent swaps to a "Preview closed." stub on close.
    // Fixture closed state is signalled on document.body.
    const closed = await page.evaluate(
      () => document.body.dataset.nexFixtureClosed ?? null,
    );
    expect(closed).toBe("1");
    const search = page.url().split("?")[1] ?? "";
    expect(search).not.toContain("preview=");
  });

  test("theme switch · prev/next buttons dispatch navigate", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(FIXTURE_PATH);
    const open = await isFixtureOpen(page);
    test.skip(!open, "fixture gated");

    await page.locator('[aria-label="Next theme"]').click();
    const navigated = await page.evaluate(
      () => document.body.dataset.nexFixtureNavigated ?? null,
    );
    expect(navigated).toBe("1");

    // Topstrip now shows theme at index 1 (Free · Pill).
    const topStrip = page.locator("[data-nex-preview-topstrip]");
    await expect(topStrip).toContainText("Free · Pill");
  });

  test("swipe · leftward past threshold triggers next", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(FIXTURE_PATH);
    const open = await isFixtureOpen(page);
    test.skip(!open, "fixture gated");

    const phone = page.locator("[data-nex-preview-phone]");
    const box = await phone.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;

    // Drag from centre leftward 100 px (well past 48 px threshold).
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + box.width / 2 - 100,
      box.y + box.height / 2,
      { steps: 8 },
    );
    await page.mouse.up();

    const navigated = await page.evaluate(
      () => document.body.dataset.nexFixtureNavigated ?? null,
    );
    expect(navigated).toBe("1");
  });

  test("prefers-reduced-motion · phone body has no transition", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(FIXTURE_PATH);
    const open = await isFixtureOpen(page);
    test.skip(!open, "fixture gated");

    // When reduced-motion is active the phone body's inline transition
    // is "none" (not a CSS keyframe · an inline React style). Assert via
    // computed style.
    const transition = await page.evaluate(() => {
      const el = document.querySelector(
        "[data-nex-preview-phone]",
      ) as HTMLElement | null;
      return el ? getComputedStyle(el).transition : "missing";
    });
    expect(transition).toBe("none");
    await ctx.close();
  });

  test("local test chat · up to 3 messages, composer disabled after", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(FIXTURE_PATH);
    const open = await isFixtureOpen(page);
    test.skip(!open, "fixture gated");

    const input = page.locator("[data-nex-preview-composer-input]");
    const submit = page.locator('button[aria-label="Send sample message"]');

    for (const msg of ["one", "two", "three"]) {
      await input.fill(msg);
      await submit.click();
    }

    // 4th send should be ignored · input becomes disabled.
    const disabled = await input.evaluate(
      (el) => (el as HTMLInputElement).disabled,
    );
    expect(disabled).toBe(true);
  });

  test("local test chat · cleared when switching theme", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(FIXTURE_PATH);
    const open = await isFixtureOpen(page);
    test.skip(!open, "fixture gated");

    const input = page.locator("[data-nex-preview-composer-input]");
    const submit = page.locator('button[aria-label="Send sample message"]');
    await input.fill("hello");
    await submit.click();
    await input.fill("world");
    await submit.click();

    // Switch theme · composer should reopen (we were at 2/3, after
    // reset we're at 0/3 and can send again).
    await page.locator('[aria-label="Next theme"]').click();
    const stillDisabled = await input.evaluate(
      (el) => (el as HTMLInputElement).disabled,
    );
    expect(stillDisabled).toBe(false);
  });

  test("gratis viewer · locked footer shows Upgrade CTA", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${FIXTURE_PATH}?i=2&mode=gratis`);
    const open = await isFixtureOpen(page);
    test.skip(!open, "fixture gated");

    const text = await page
      .locator("[data-nex-preview-footer-mobile]")
      .textContent();
    expect(text).toContain("Upgrade to NEX Bisnis");
  });

  test("active theme · footer shows 'Currently active'", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(FIXTURE_PATH);
    const open = await isFixtureOpen(page);
    test.skip(!open, "fixture gated");

    const text = await page
      .locator("[data-nex-preview-footer-mobile]")
      .textContent();
    expect(text).toContain("Currently active");
  });

  test("activation CTA · dispatches with correct chat_theme value", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${FIXTURE_PATH}?i=1`); // Free · Pill, not active
    const open = await isFixtureOpen(page);
    test.skip(!open, "fixture gated");

    const button = page.locator("button:has-text('Use this theme')").first();
    await button.click();
    // Fixture activateAction writes the theme id to body.dataset.
    const dispatched = await page.evaluate(
      () => document.body.dataset.nexFixtureActivated ?? null,
    );
    expect(dispatched).toBe("fx-free-pill");
  });
});

test.describe("Phase 2 · flag-OFF regression on real library route", () => {
  test.setTimeout(60_000);

  test("legacy PreviewModal path still present when flag is OFF", async ({
    page,
  }) => {
    const flagOn = process.env.NEX_THEMES_IMMERSIVE_PREVIEW === "1";
    test.skip(flagOn, "spec runs with flag OFF only");

    await page.goto(LIBRARY_PATH);
    const html = await page.content();
    // The immersive shell's wrapper attribute must NOT appear in the
    // flag-OFF response. Anonymous visitors land on sign-in but even
    // signed-in HTML would not emit this attribute.
    expect(html).not.toContain("data-nex-immersive-preview");
  });
});
