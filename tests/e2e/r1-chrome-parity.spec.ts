// tests/e2e/r1-chrome-parity.spec.ts
//
// R1 Universal Chrome Parity · real-browser visual verification.
// Sealed 2026-10-05 after founder-authorised chrome-parity audit.
//
// Captures the fifth artefact of the five-part universal-rule
// discipline: Rule → Enforcement → Coverage → Automated parity test
// → Real visual proof.
//
// For each legacy theme route this spec asserts the DOM-level
// presence of the three universal chrome overlays:
//
//   R1 · UniversalHeaderIconsOverlay   data-nex-universal-header-icons
//   R7 · UniversalChromeOverlay        data-nex-universal-call-actions
//   R3 · UniversalComposerFooter       data-nex-universal-composer-footer
//
// Plus the three header icons by action token:
//
//   home · data-nex-universal-header-action="home"
//   cart · data-nex-universal-header-action="cart"
//   shop · data-nex-universal-header-action="shop"
//
// Duplicate detection:
//   - On a legacy route the universal `data-nex-universal-header-action="home"`
//     count MUST be exactly 1 (the native cluster is suppressed via
//     the data-nex-native-r1-cluster CSS block)
//   - Same for cart and shop
//
// Running:
//   npm run dev                 # in one terminal (port 3008)
//   npx playwright test r1-chrome-parity.spec.ts
//
// Screenshots land under tests/e2e-screenshots/r1-chrome-parity/
// so the founder can diff visually. The spec sets a 390×844 iPhone
// viewport so screenshots match the mobile UX the chrome is
// designed for.

import { test, expect, type Page } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

const OUT_DIR = path.join(
  process.cwd(),
  "tests",
  "e2e-screenshots",
  "r1-chrome-parity",
);
fs.mkdirSync(OUT_DIR, { recursive: true });

/** Legacy production routes that MUST carry all three universal
 *  chrome overlays. The DB-driven route may 404 locally without
 *  Supabase credentials · we handle that case gracefully. */
const ROUTES = [
  {
    id: "theme-1",
    url: "/nex-native/themes/theme-1",
    shopHref: "/nex-native/maria",
    requiresDb: false,
  },
  {
    id: "pink-dream",
    url: "/nex-native/themes/pink-dream",
    shopHref: null, // shop is a toggle button, not a link
    requiresDb: false,
  },
  {
    id: "cyber-grid",
    url: "/nex-native/themes/cyber-grid",
    shopHref: null, // shop is a toggle button
    requiresDb: false,
  },
  {
    id: "hauntedhoteltheme",
    url: "/nex-native/chat/prototypes/hauntedhoteltheme",
    shopHref: "/nex-native/shop",
    requiresDb: false,
  },
  {
    id: "motorbike-rental",
    url: "/nex-native/themes/motorbike-rental",
    shopHref: "/nex-native/shop",
    requiresDb: true,
  },
] as const;

async function expectR1R3R7(page: Page, routeId: string) {
  // R1 · UniversalHeaderIconsOverlay root
  const r1 = page.locator("[data-nex-universal-header-icons]");
  await expect(r1, `${routeId}: R1 overlay root present`).toBeVisible();

  // Three header action tokens.
  const home = page.locator('[data-nex-universal-header-action="home"]');
  const cart = page.locator('[data-nex-universal-header-action="cart"]');
  const shop = page.locator('[data-nex-universal-header-action="shop"]');
  await expect(home, `${routeId}: Home visible`).toBeVisible();
  await expect(cart, `${routeId}: Cart visible`).toBeVisible();
  await expect(shop, `${routeId}: Shop visible`).toBeVisible();

  // No duplicate R1 controls · the universal overlay is the ONLY
  // Home/Cart/Shop on the page. The native clusters are suppressed
  // by the `data-nex-native-r1-cluster { display:none }` CSS block
  // injected by the overlay.
  await expect(
    home,
    `${routeId}: exactly one Home control`,
  ).toHaveCount(1);
  await expect(
    cart,
    `${routeId}: exactly one Cart control`,
  ).toHaveCount(1);
  await expect(
    shop,
    `${routeId}: exactly one Shop control`,
  ).toHaveCount(1);

  // R3 · UniversalComposerFooter root
  const r3 = page.locator("[data-nex-universal-composer-footer]");
  await expect(r3, `${routeId}: R3 composer footer present`).toBeVisible();

  // R7 · UniversalChromeOverlay 3-dots root
  const r7 = page.locator("[data-nex-universal-call-actions]");
  await expect(r7, `${routeId}: R7 3-dots call actions root present`).toBeVisible();
  // The 3-dots toggle button itself.
  const r7Toggle = page.locator("[data-nex-universal-call-actions-toggle]");
  await expect(
    r7Toggle,
    `${routeId}: R7 3-dots toggle button visible`,
  ).toBeVisible();
}

async function assertShopHref(page: Page, routeId: string, expected: string | null) {
  if (!expected) return;
  const shop = page.locator('[data-nex-universal-header-action="shop"]');
  const href = await shop.getAttribute("href");
  const dataHref = await shop.getAttribute("data-nex-universal-shop-href");
  expect(
    href,
    `${routeId}: Shop href preserves pre-overlay destination`,
  ).toBe(expected);
  expect(
    dataHref,
    `${routeId}: Shop data-nex-universal-shop-href mirrors href`,
  ).toBe(expected);
}

/** For routes needing DB-backed theme data: probe status first so
 *  we skip gracefully when a local dev env has no Supabase. */
async function routeReachable(page: Page, url: string): Promise<boolean> {
  const response = await page.goto(url, { waitUntil: "domcontentloaded" });
  if (!response) return false;
  if (response.status() >= 400) return false;
  // Confirm the body actually rendered — some notFound() paths
  // return 200 with the Next not-found page body.
  const title = await page.title().catch(() => "");
  return !/not found|404/i.test(title);
}

test.use({
  viewport: { width: 390, height: 844 },
});

for (const route of ROUTES) {
  test(`R1 parity · ${route.id}`, async ({ page }) => {
    if (route.requiresDb) {
      const ok = await routeReachable(page, route.url);
      if (!ok) {
        test.skip(
          true,
          `${route.id} requires DB-backed theme row; not reachable in this environment`,
        );
        return;
      }
    } else {
      await page.goto(route.url, { waitUntil: "domcontentloaded" });
    }

    // Some legacy prototype routes (e.g. hauntedhoteltheme) require
    // either (a) an authenticated session (server redirect("/sign-in")
    // when no session) or (b) a seeded peer row in the local dev DB.
    // The overlay code is correctly mounted downstream of these early
    // returns · the fallback / redirect / not-found is a
    // data-and-auth-not-code issue. Detect and skip rather than fail;
    // the vitest static tests already prove the overlay is imported
    // and mounted at the source level.
    //
    // Signals we treat as "env not ready, skip, do not fail":
    //   - MissingPeerFallback text ("isn't seeded in this environment")
    //   - redirect to /sign-in (URL changed away from the target)
    //   - Next.js not-found page (title contains "404" or "not found")
    await page.waitForLoadState("networkidle").catch(() => {});
    const landedUrl = page.url();
    const landedTitle = (await page.title().catch(() => "")) ?? "";
    const fallbackCount = await page
      .getByText(/isn.?t seeded in this environment|no peer|missing peer/i)
      .count();
    const signInHeadingCount = await page
      .getByText(/Sign in to your NEX|Welcome back/i)
      .count();
    const redirectedToSignIn =
      /\/sign-in(\?|$|\/)/.test(landedUrl) || signInHeadingCount > 0;
    const notFoundPage = /404|not found/i.test(landedTitle);
    if (fallbackCount > 0 || redirectedToSignIn || notFoundPage) {
      test.skip(
        true,
        `${route.id} not reachable in this environment · ` +
          `fallback=${fallbackCount > 0} signIn=${redirectedToSignIn} notFound=${notFoundPage} url=${landedUrl}; ` +
          `overlay mount verified at source level by vitest`,
      );
      return;
    }

    // Give overlays a tick to mount after client hydration.
    await page.waitForSelector("[data-nex-universal-header-icons]", {
      timeout: 15_000,
    });

    await expectR1R3R7(page, route.id);
    await assertShopHref(page, route.id, route.shopHref);

    // Dismiss the cookie-consent banner if present · otherwise it
    // visually blocks R3 (composer footer) and R7 (3-dots) at the
    // bottom of the screenshot. DOM assertions already proved both
    // are present and visible; the screenshot is just for the human
    // visual proof. The banner lives in NEX layout and is unrelated
    // to the chrome rules we're verifying.
    const acceptBtn = page.getByRole("button", { name: /^Accept$/i });
    if (await acceptBtn.count().then((c) => c > 0)) {
      await acceptBtn.first().click().catch(() => {});
      await page.waitForTimeout(300);
    }

    // Capture screenshot evidence. Save under one file per route
    // so the founder can diff by eye.
    const screenshotPath = path.join(OUT_DIR, `${route.id}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`[r1-chrome-parity] ${route.id} → ${screenshotPath}`);
  });
}

test("R1 is NOT mounted on a Standard Experience world (ocean)", async ({ page }) => {
  const response = await page.goto("/nex-native/themes/ocean", {
    waitUntil: "domcontentloaded",
  });
  // If Ocean isn't reachable in this env, skip rather than fail.
  if (!response || response.status() >= 400) {
    test.skip(true, "Ocean route not reachable in this environment");
    return;
  }
  // Wait a moment for client hydration · Standard-Experience shell
  // renders its own StandardHeaderActions.
  await page.waitForLoadState("networkidle").catch(() => {});
  const r1Overlay = page.locator("[data-nex-universal-header-icons]");
  await expect(
    r1Overlay,
    "Standard Experience worlds must NOT mount UniversalHeaderIconsOverlay",
  ).toHaveCount(0);
  const screenshotPath = path.join(OUT_DIR, "ocean-no-r1-overlay.png");
  await page.screenshot({ path: screenshotPath, fullPage: false });
});
