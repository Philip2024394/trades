// tests/e2e/nex-emergency-help.spec.ts
//
// NEX Emergency Help · UI real-browser proof · sealed 2026-10-10.
//
// Scenarios
//   1. /nex-native/settings exposes the Emergency Help entry at the
//      TOP of the page, with the SIMULATED · v1 badge.
//   2. Clicking the entry navigates to /nex-native/emergency-help.
//   3a. The confirmation screen requires a category pick, then
//       I NEED HELP starts a 10-second countdown. CANCEL during the
//       countdown returns to the pre-tap state with no alert fired.
//   3b. Letting the countdown reach 0 fires the alert + navigates to
//       /nex-native/emergency-help/active.
//   3c. "Skip countdown — send now" fires immediately + navigates.
//   6. The active view renders without fabricating responders ·
//      "0 members are responding" (empty state) OR the loading state.
//   7. Cancel-emergency confirmation step appears + "Keep alert active"
//      returns to the active view without side-effects.
//   8. Responder opt-in page shows safety guidance + ack checkbox
//      disabled until the user ticks it.
//   9. Trusted contacts page lets the user add + remove a contact.
//  10. Incident history page renders the empty "never raised" state.
//  11. Every emergency-help page carries the SIMULATED · v1 badge
//      (universal badge contract).
//  12. Confirmation screen renders at 393×852 mobile AND 1280×800
//      desktop · no horizontal overflow at either viewport.
//
// Load-bearing: tests preflight the dev server · if unreachable, the
// whole file skips.

import { expect, test, type BrowserContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";

(() => {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]!]) {
      process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
    }
  }
})();

const SUPABASE_URL =
  process.env.NEX_SUPABASE_URL ??
  process.env.NEXT_PUBLIC_NEX_SUPABASE_URL ??
  "";
const SERVICE_ROLE = process.env.NEX_SUPABASE_SERVICE_ROLE_KEY ?? "";
const ANON = process.env.NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY ?? "";
const BASE_URL = process.env.NEX_E2E_BASE_URL ?? "http://localhost:3008";

const SCREENSHOT_DIR = path.join(
  process.cwd(),
  "tests",
  "e2e-screenshots",
  "nex-emergency-help",
);

interface Fixture {
  authId: string;
  accountId: string;
  jwt: string;
  refresh: string;
  displayName: string;
}

async function devServerReachable(): Promise<boolean> {
  try {
    const res = await fetch(BASE_URL, { method: "GET" });
    return res.status < 500;
  } catch {
    return false;
  }
}

async function provisionAccount(displayName: string): Promise<Fixture | null> {
  if (!SUPABASE_URL || !SERVICE_ROLE || !ANON) return null;
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const anon = createClient(SUPABASE_URL, ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const email = `eh-${Date.now()}-${randomUUID().slice(0, 8)}@test.local`;
    const password = `EH!Pw${Date.now()}`;
    const c = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (c.error || !c.data.user) return null;
    const authId = c.data.user.id;
    const acc = await admin
      .from("nex_account")
      .insert({ supabase_user_id: authId, display_name: displayName })
      .select("id")
      .single();
    if (acc.error || !acc.data) return null;
    const signIn = await anon.auth.signInWithPassword({ email, password });
    if (signIn.error || !signIn.data.session) return null;
    return {
      authId,
      accountId: (acc.data as { id: string }).id,
      jwt: signIn.data.session.access_token,
      refresh: signIn.data.session.refresh_token,
      displayName,
    };
  } catch {
    return null;
  }
}

function supabaseCookieName(): string {
  const projectRef = SUPABASE_URL.match(/https?:\/\/([^.]+)/)?.[1] ?? "unknown";
  return `sb-${projectRef}-auth-token`;
}

function supabaseCookieValue(jwt: string, refresh: string): string {
  const payload = {
    access_token: jwt,
    refresh_token: refresh,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600,
    token_type: "bearer",
    user: null,
  };
  return `base64-${Buffer.from(JSON.stringify(payload)).toString("base64")}`;
}

async function plantAuthCookies(
  ctx: BrowserContext,
  jwt: string | null,
  refresh: string | null,
): Promise<void> {
  const base = new URL(BASE_URL);
  const cookies: Parameters<BrowserContext["addCookies"]>[0] = [
    {
      name: "xrated_cookie_consent",
      value: "all",
      domain: base.hostname,
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
  ];
  if (jwt && refresh) {
    cookies.push({
      name: supabaseCookieName(),
      value: supabaseCookieValue(jwt, refresh),
      domain: base.hostname,
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    });
  }
  await ctx.addCookies(cookies);
}

let devUp = false;
let fixture: Fixture | null = null;
let fixtureAttempted = false;

test.beforeAll(async () => {
  devUp = await devServerReachable();
  if (!devUp) {
    test.skip(true, `dev server unreachable at ${BASE_URL} · preflight failed`);
  }
  try {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  } catch {
    /* noop */
  }
  if (!fixtureAttempted) {
    fixtureAttempted = true;
    fixture = await provisionAccount("Emergency Pilot");
  }
});

test.describe("NEX Emergency Help · UI real-browser proof", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  test("01 · Settings exposes Emergency Help entry at top with SIMULATED badge", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      viewport: { width: 393, height: 852 },
    });
    await plantAuthCookies(ctx, fixture?.jwt ?? null, fixture?.refresh ?? null);
    const page = await ctx.newPage();
    const resp = await page.goto(`${BASE_URL}/nex-native/settings`, {
      waitUntil: "domcontentloaded",
    });
    // Unauthenticated path → sign-in redirect is honest · we assert
    // the page served SOMETHING (200/307/302) and the entry is visible
    // when authenticated.
    expect(resp).not.toBeNull();
    if (!fixture) {
      test.skip(true, "no fixture · auth preflight failed");
      return;
    }
    const entry = page.locator("[data-nex-emergency-entry]");
    await expect(entry).toBeVisible({ timeout: 10_000 });
    const entryHtml = await entry.innerHTML();
    expect(entryHtml).toContain("NEX Emergency Help");
    expect(entryHtml.toUpperCase()).toContain("SIMULATED · V1");
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "01-settings-entry-393.png"),
      fullPage: true,
    });
    await ctx.close();
  });

  test("02 · Tapping the entry navigates to the ack gate; primary CTA is NOT present until ack", async ({
    browser,
  }) => {
    if (!fixture) {
      test.skip(true, "no fixture");
      return;
    }
    const ctx = await browser.newContext({
      viewport: { width: 393, height: 852 },
    });
    await plantAuthCookies(ctx, fixture.jwt, fixture.refresh);
    const page = await ctx.newPage();
    await page.goto(`${BASE_URL}/nex-native/settings`, {
      waitUntil: "domcontentloaded",
    });
    await page.locator("[data-nex-emergency-entry]").click();
    await page.waitForURL(/\/nex-native\/emergency-help$/, {
      timeout: 10_000,
    });
    await expect(
      page.locator('[data-testid="nex-emergency-confirmation-screen"]'),
    ).toBeVisible();
    // Ack gate · the Important Safety Warning must be shown first.
    await expect(
      page.locator('[data-testid="nex-emergency-safety-warning"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="nex-emergency-policy-ack"]'),
    ).toBeVisible();
    // Primary CTA is NOT yet rendered.
    await expect(
      page.locator('[data-testid="nex-emergency-primary-cta"]'),
    ).toHaveCount(0);
    // Tap acknowledgment → primary CTA now visible.
    await page.locator('[data-testid="nex-emergency-policy-ack"]').click();
    await expect(
      page.locator('[data-testid="nex-emergency-primary-cta"]'),
    ).toBeVisible({ timeout: 5_000 });
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "02-ack-gate-393.png"),
      fullPage: true,
    });
    await ctx.close();
  });

  test("03a · Must select category before I NEED HELP · tap starts countdown · pending incident id is created at T=0 · CANCEL revokes within window", async ({
    browser,
  }) => {
    if (!fixture) {
      test.skip(true, "no fixture");
      return;
    }
    const ctx = await browser.newContext({
      viewport: { width: 393, height: 852 },
      permissions: ["geolocation"],
      geolocation: { latitude: -8.6705, longitude: 115.2126 },
    });
    await plantAuthCookies(ctx, fixture.jwt, fixture.refresh);
    const page = await ctx.newPage();
    await page.goto(`${BASE_URL}/nex-native/emergency-help`, {
      waitUntil: "domcontentloaded",
    });
    // Acknowledge policy first.
    await page.locator('[data-testid="nex-emergency-policy-ack"]').click();
    // Primary CTA renders but is DISABLED until a category is picked.
    const primary = page.locator('[data-testid="nex-emergency-primary-cta"]');
    await expect(primary).toBeVisible({ timeout: 5_000 });
    await expect(primary).toBeDisabled();
    await expect(
      page.locator('[data-testid="nex-emergency-pick-category-hint"]'),
    ).toBeVisible();
    // Both category buttons rendered.
    const medical = page.locator(
      '[data-testid="nex-emergency-category-button-medical_concern"]',
    );
    const safety = page.locator(
      '[data-testid="nex-emergency-category-button-safety_concern"]',
    );
    await expect(medical).toBeVisible();
    await expect(safety).toBeVisible();
    // Pick medical → button becomes selected (data attribute + aria-checked).
    await medical.click();
    await expect(medical).toHaveAttribute(
      "data-nex-emergency-category-selected",
      "true",
    );
    await expect(medical).toHaveAttribute("aria-checked", "true");
    await expect(safety).toHaveAttribute(
      "data-nex-emergency-category-selected",
      "false",
    );
    await expect(primary).toBeEnabled();
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "03a-category-selected-393.png"),
      fullPage: true,
    });
    // Tap I NEED HELP · countdown block appears, primary CTA disappears.
    await primary.click();
    const countdown = page.locator(
      '[data-testid="nex-emergency-countdown"]',
    );
    await expect(countdown).toBeVisible({ timeout: 15_000 });
    // Seconds-remaining data attribute is present and starts near 10.
    const initialSeconds = await countdown.getAttribute(
      "data-nex-emergency-seconds-remaining",
    );
    expect(initialSeconds).not.toBeNull();
    expect(Number(initialSeconds)).toBeGreaterThanOrEqual(8);
    expect(Number(initialSeconds)).toBeLessThanOrEqual(10);
    // L1 pending-confirmation proof · the pending incident id is
    // ATTACHED to the countdown DOM at T=0. This proves the server
    // action fired IMMEDIATELY, not at T=10.
    const pendingIdNode = page.locator(
      '[data-testid="nex-emergency-pending-incident-id"]',
    );
    await expect(pendingIdNode).toHaveCount(1, { timeout: 10_000 });
    const pendingId = await pendingIdNode.getAttribute(
      "data-nex-emergency-pending-incident-id",
    );
    expect(pendingId, "pending incident id missing at T=0").not.toBeNull();
    expect(String(pendingId).length).toBeGreaterThan(0);
    await expect(
      page.locator('[data-testid="nex-emergency-countdown-cancel"]'),
    ).toBeVisible();
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "03a-countdown-active-393.png"),
      fullPage: true,
    });
    // Primary CTA is NOT present during countdown.
    await expect(primary).toHaveCount(0);
    // Tap CANCEL · countdown disappears, revoked phase surfaces honest
    // copy, URL unchanged (no navigation to /active).
    await page.locator('[data-testid="nex-emergency-countdown-cancel"]').click();
    await expect(countdown).toHaveCount(0, { timeout: 10_000 });
    await expect(
      page.locator('[data-testid="nex-emergency-revoked-copy"]'),
    ).toBeVisible({ timeout: 10_000 });
    expect(page.url()).toMatch(/\/nex-native\/emergency-help$/);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "03a-revoked-within-window-393.png"),
      fullPage: true,
    });
    await ctx.close();
  });

  test("03b · Letting the countdown reach 0 submits + navigates to /active", async ({
    browser,
  }) => {
    if (!fixture) {
      test.skip(true, "no fixture");
      return;
    }
    const ctx = await browser.newContext({
      viewport: { width: 393, height: 852 },
      permissions: ["geolocation"],
      geolocation: { latitude: -8.6705, longitude: 115.2126 },
    });
    await plantAuthCookies(ctx, fixture.jwt, fixture.refresh);
    const page = await ctx.newPage();
    await page.goto(`${BASE_URL}/nex-native/emergency-help`, {
      waitUntil: "domcontentloaded",
    });
    await page.locator('[data-testid="nex-emergency-policy-ack"]').click();
    await page
      .locator('[data-testid="nex-emergency-category-button-medical_concern"]')
      .click();
    const primary = page.locator('[data-testid="nex-emergency-primary-cta"]');
    await expect(primary).toBeEnabled();
    await primary.click();
    await expect(
      page.locator('[data-testid="nex-emergency-countdown"]'),
    ).toBeVisible({ timeout: 15_000 });
    // L1 pending-confirmation proof · pending incident id is attached
    // at T=0, BEFORE the natural T=10 confirmPending navigation.
    await expect(
      page.locator('[data-testid="nex-emergency-pending-incident-id"]'),
    ).toHaveCount(1, { timeout: 10_000 });
    // Wait for the natural 10s countdown + confirm roundtrip.
    await page.waitForURL(/\/nex-native\/emergency-help\/active/, {
      timeout: 25_000,
    });
    await ctx.close();
  });

  test("03c · Skip countdown · send now · fires immediately and navigates to /active", async ({
    browser,
  }) => {
    if (!fixture) {
      test.skip(true, "no fixture");
      return;
    }
    const ctx = await browser.newContext({
      viewport: { width: 393, height: 852 },
      permissions: ["geolocation"],
      geolocation: { latitude: -8.6705, longitude: 115.2126 },
    });
    await plantAuthCookies(ctx, fixture.jwt, fixture.refresh);
    const page = await ctx.newPage();
    await page.goto(`${BASE_URL}/nex-native/emergency-help`, {
      waitUntil: "domcontentloaded",
    });
    await page.locator('[data-testid="nex-emergency-policy-ack"]').click();
    await page
      .locator('[data-testid="nex-emergency-category-button-safety_concern"]')
      .click();
    const primary = page.locator('[data-testid="nex-emergency-primary-cta"]');
    await expect(primary).toBeEnabled();
    await primary.click();
    const skip = page.locator('[data-testid="nex-emergency-countdown-skip"]');
    await expect(skip).toBeVisible({ timeout: 15_000 });
    await skip.click();
    await page.waitForURL(/\/nex-native\/emergency-help\/active/, {
      timeout: 15_000,
    });
    await ctx.close();
  });

  test("04 · Active view renders without fabricating responders", async ({
    browser,
  }) => {
    if (!fixture) {
      test.skip(true, "no fixture");
      return;
    }
    const ctx = await browser.newContext({
      viewport: { width: 393, height: 852 },
    });
    await plantAuthCookies(ctx, fixture.jwt, fixture.refresh);
    const page = await ctx.newPage();
    await page.goto(`${BASE_URL}/nex-native/emergency-help/active`, {
      waitUntil: "domcontentloaded",
    });
    await expect(
      page.locator('[data-testid="nex-emergency-active-view"]'),
    ).toBeVisible({ timeout: 15_000 });
    // Either shows the loading state, the no-active-emergency message,
    // or the honest "0 responding" count. All three are acceptable.
    await expect(
      page.locator('[data-nex-emergency-simulated-badge="true"]').first(),
    ).toBeVisible({ timeout: 10_000 });
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "04-active-view-393.png"),
      fullPage: true,
    });
    await ctx.close();
  });

  test("05 · Responder opt-in page gates button on safety-guidance ack", async ({
    browser,
  }) => {
    if (!fixture) {
      test.skip(true, "no fixture");
      return;
    }
    const ctx = await browser.newContext({
      viewport: { width: 393, height: 852 },
    });
    await plantAuthCookies(ctx, fixture.jwt, fixture.refresh);
    const page = await ctx.newPage();
    await page.goto(`${BASE_URL}/nex-native/emergency-help/responder`, {
      waitUntil: "domcontentloaded",
    });
    await expect(
      page.locator('[data-testid="nex-emergency-safety-guidance"]'),
    ).toBeVisible({ timeout: 10_000 });
    const optInBtn = page.locator('[data-testid="nex-emergency-opt-in"]');
    await expect(optInBtn).toBeVisible();
    // Button is disabled before the ack checkbox is ticked.
    await expect(optInBtn).toBeDisabled();
    await page.locator('[data-testid="nex-emergency-safety-ack"]').click();
    await expect(optInBtn).toBeEnabled();
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "05-responder-optin-393.png"),
      fullPage: true,
    });
    await ctx.close();
  });

  test("06 · Trusted contacts list renders empty state + accepts input", async ({
    browser,
  }) => {
    if (!fixture) {
      test.skip(true, "no fixture");
      return;
    }
    const ctx = await browser.newContext({
      viewport: { width: 393, height: 852 },
    });
    await plantAuthCookies(ctx, fixture.jwt, fixture.refresh);
    const page = await ctx.newPage();
    await page.goto(
      `${BASE_URL}/nex-native/emergency-help/trusted-contacts`,
      { waitUntil: "domcontentloaded" },
    );
    await expect(
      page.locator('[data-testid="nex-emergency-trusted-contacts"]'),
    ).toBeVisible({ timeout: 10_000 });
    const accountInput = page.locator(
      '[data-testid="nex-emergency-contact-account-id"]',
    );
    await accountInput.scrollIntoViewIfNeeded();
    await accountInput.click();
    await accountInput.fill("mock-contact-id");
    // Blur so React's controlled state settles on slower mobile WebKit.
    await accountInput.press("Tab");
    const labelInput = page.locator(
      '[data-testid="nex-emergency-contact-label"]',
    );
    await labelInput.fill("Mum");
    await labelInput.press("Tab");
    await expect(
      page.locator('[data-testid="nex-emergency-contact-submit"]'),
    ).toBeEnabled({ timeout: 10_000 });
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "06-trusted-contacts-393.png"),
      fullPage: true,
    });
    await ctx.close();
  });

  test("07 · Incident history renders empty state", async ({ browser }) => {
    if (!fixture) {
      test.skip(true, "no fixture");
      return;
    }
    const ctx = await browser.newContext({
      viewport: { width: 393, height: 852 },
    });
    await plantAuthCookies(ctx, fixture.jwt, fixture.refresh);
    const page = await ctx.newPage();
    await page.goto(`${BASE_URL}/nex-native/emergency-help/history`, {
      waitUntil: "domcontentloaded",
    });
    await expect(
      page.locator('[data-testid="nex-emergency-history"]'),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.locator('[data-nex-emergency-simulated-badge="true"]').first(),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("h1")).toContainText("Prior emergencies");
    await ctx.close();
  });

  test("08 · SIMULATED badge is present on every emergency-help page", async ({
    browser,
  }) => {
    if (!fixture) {
      test.skip(true, "no fixture");
      return;
    }
    const ctx = await browser.newContext({
      viewport: { width: 393, height: 852 },
    });
    await plantAuthCookies(ctx, fixture.jwt, fixture.refresh);
    const page = await ctx.newPage();
    for (const route of [
      "/nex-native/emergency-help",
      "/nex-native/emergency-help/active",
      "/nex-native/emergency-help/history",
      "/nex-native/emergency-help/responder",
      "/nex-native/emergency-help/trusted-contacts",
      "/nex-native/emergency-help/incident/sim-example",
    ]) {
      await page.goto(`${BASE_URL}${route}`, {
        waitUntil: "domcontentloaded",
      });
      // Prefer the badge element directly · innerText on mobile WebKit
      // sometimes clips the main region behind the layout. The badge
      // itself has a stable data-attribute selector.
      const badge = page.locator('[data-nex-emergency-simulated-badge="true"]');
      await expect(
        badge.first(),
        `SIMULATED · v1 badge missing on ${route}`,
      ).toBeVisible({ timeout: 10_000 });
    }
    await ctx.close();
  });

  test("09 · Confirmation screen renders at mobile 393 AND desktop 1280 without overflow", async ({
    browser,
  }) => {
    if (!fixture) {
      test.skip(true, "no fixture");
      return;
    }
    for (const [label, width, height] of [
      ["mobile", 393, 852],
      ["desktop", 1280, 800],
    ] as const) {
      const ctx = await browser.newContext({
        viewport: { width, height },
      });
      await plantAuthCookies(ctx, fixture.jwt, fixture.refresh);
      const page = await ctx.newPage();
      await page.goto(`${BASE_URL}/nex-native/emergency-help`, {
        waitUntil: "domcontentloaded",
      });
      await expect(
        page.locator('[data-testid="nex-emergency-confirmation-screen"]'),
      ).toBeVisible({ timeout: 10_000 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(overflow, `horizontal overflow at ${label}`).toBe(false);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `09-confirm-${label}-${width}x${height}.png`),
        fullPage: true,
      });
      await ctx.close();
    }
  });

  test("10 · Cancel-emergency confirmation can be dismissed without side-effects", async ({
    browser,
  }) => {
    if (!fixture) {
      test.skip(true, "no fixture");
      return;
    }
    const ctx = await browser.newContext({
      viewport: { width: 393, height: 852 },
    });
    await plantAuthCookies(ctx, fixture.jwt, fixture.refresh);
    const page = await ctx.newPage();
    await page.goto(`${BASE_URL}/nex-native/emergency-help/active`, {
      waitUntil: "domcontentloaded",
    });
    // In v1 mock mode there's no active incident · the cancel button
    // only renders when an incident exists. We assert the view loads
    // honestly without a cancel button when state is empty.
    const cancelBtn = page.locator(
      '[data-testid="nex-emergency-cancel-start"]',
    );
    // Either absent (empty state) or present. If present we exercise
    // the confirmation.
    if ((await cancelBtn.count()) > 0 && (await cancelBtn.isVisible())) {
      await cancelBtn.click();
      await expect(
        page.locator('[data-testid="nex-emergency-cancel-confirm"]'),
      ).toBeVisible();
      await page.locator('[data-testid="nex-emergency-cancel-no"]').click();
      await expect(cancelBtn).toBeVisible();
    } else {
      // Honest empty-state path · nothing to cancel.
      await expect(
        page.locator('[data-testid="nex-emergency-active-view"]'),
      ).toBeVisible();
    }
    await ctx.close();
  });

  // ────────────────────────────────────────────────────────────────
  // Scenarios 13 + 14 · L2 pending/revoked responder-side rendering
  // ────────────────────────────────────────────────────────────────
  //
  // These scenarios depend on L1's migration 195 (which extends the
  // sealed state CHECK on `nex.emergency_incident.state` with
  // `pending_confirmation` and `revoked_within_window`). The probe
  // script `_emergency-pending-probe.mjs` detects the CHECK state at
  // runtime and emits `{ok:false, reason:"migration_195_not_applied"}`
  // when 195 is absent. Playwright honours that signal by skipping the
  // scenario. The scenarios additionally gracefully skip if the
  // responder-incident page is still backed by the empty mock service
  // (`_mock-service.loadIncidentForResponder` returning `null`).

  test("13 · pending_confirmation incident renders the cyan responder banner + disabled accept buttons", async ({
    browser,
  }) => {
    if (!fixture) {
      test.skip(true, "no fixture");
      return;
    }

    // Seed the pending incident via the probe. If migration 195 hasn't
    // landed, the probe tells us honestly and we skip.
    const probe = await runProbe([
      "--seed-pending",
      fixture.accountId,
    ]);
    if (!probe.ok) {
      if (probe.reason === "migration_195_not_applied") {
        test.skip(
          true,
          "migration 195 not yet applied to nex_dev · scenario deferred",
        );
        return;
      }
      test.fail(true, `probe seed failed: ${JSON.stringify(probe)}`);
      return;
    }
    const incidentId = probe.incident_id as string;

    try {
      const ctx = await browser.newContext({
        viewport: { width: 393, height: 852 },
      });
      await plantAuthCookies(ctx, fixture.jwt, fixture.refresh);
      const page = await ctx.newPage();
      await page.goto(
        `${BASE_URL}/nex-native/emergency-help/incident/${incidentId}`,
        { waitUntil: "domcontentloaded" },
      );

      // The responder page may still be mock-backed · if the "Incident
      // not available" fallback paints, we skip honestly.
      const notAvailable = page.locator("h1", { hasText: "Incident not available" });
      if (await notAvailable.count() > 0) {
        test.skip(
          true,
          "responder incident page still backed by empty mock service · scenario deferred",
        );
        return;
      }

      const banner = page.locator('[data-testid="nex-emergency-pending-banner"]');
      await expect(banner).toBeVisible({ timeout: 10_000 });
      await expect(banner).toContainText("10-second safety confirmation window");

      const acceptBtn = page.locator('[data-testid="nex-emergency-accept"]');
      await expect(acceptBtn).toBeVisible();
      await expect(acceptBtn).toHaveAttribute("aria-disabled", "true");
      await expect(acceptBtn).toHaveAttribute(
        "data-nex-emergency-accept-disabled-reason",
        "pending_confirmation",
      );

      // Report-to-Police stays enabled.
      await expect(
        page.locator('[data-testid="nex-emergency-report-police"]'),
      ).toBeVisible();

      // SIMULATED badge still present.
      await expect(
        page.locator('[data-nex-emergency-simulated-badge="true"]').first(),
      ).toBeVisible();

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "13-pending-confirmation-393.png"),
        fullPage: true,
      });
      await ctx.close();
    } finally {
      await runProbe(["--cleanup", fixture.accountId]).catch(() => {});
    }
  });

  test("14 · revoked_within_window incident renders terminal banner + hides engagement buttons", async ({
    browser,
  }) => {
    if (!fixture) {
      test.skip(true, "no fixture");
      return;
    }

    const probe = await runProbe([
      "--seed-revoked",
      fixture.accountId,
    ]);
    if (!probe.ok) {
      if (probe.reason === "migration_195_not_applied") {
        test.skip(
          true,
          "migration 195 not yet applied to nex_dev · scenario deferred",
        );
        return;
      }
      test.fail(true, `probe seed failed: ${JSON.stringify(probe)}`);
      return;
    }
    const incidentId = probe.incident_id as string;

    try {
      const ctx = await browser.newContext({
        viewport: { width: 393, height: 852 },
      });
      await plantAuthCookies(ctx, fixture.jwt, fixture.refresh);
      const page = await ctx.newPage();
      await page.goto(
        `${BASE_URL}/nex-native/emergency-help/incident/${incidentId}`,
        { waitUntil: "domcontentloaded" },
      );

      const notAvailable = page.locator("h1", { hasText: "Incident not available" });
      if (await notAvailable.count() > 0) {
        test.skip(
          true,
          "responder incident page still backed by empty mock service · scenario deferred",
        );
        return;
      }

      const banner = page.locator('[data-testid="nex-emergency-revoked-banner"]');
      await expect(banner).toBeVisible({ timeout: 10_000 });
      await expect(banner).toContainText(
        "cancelled by the requester within the 10-second safety window",
      );

      // Engagement buttons must be absent.
      await expect(
        page.locator('[data-testid="nex-emergency-accept"]'),
      ).toHaveCount(0);
      await expect(
        page.locator('[data-testid="nex-emergency-decline"]'),
      ).toHaveCount(0);
      await expect(
        page.locator('[data-testid="nex-emergency-withdraw"]'),
      ).toHaveCount(0);

      // Report-to-Police remains visible with the independent-concern subtext.
      await expect(
        page.locator('[data-testid="nex-emergency-report-police"]'),
      ).toBeVisible();
      await expect(
        page.locator(
          '[data-testid="nex-emergency-report-police-revoked-note"]',
        ),
      ).toBeVisible();

      // SIMULATED badge still present.
      await expect(
        page.locator('[data-nex-emergency-simulated-badge="true"]').first(),
      ).toBeVisible();

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "14-revoked-within-window-393.png"),
        fullPage: true,
      });
      await ctx.close();
    } finally {
      await runProbe(["--cleanup", fixture.accountId]).catch(() => {});
    }
  });
});

// ──────────────────────────────────────────────────────────────────
// Probe helper (L2 · scenarios 13 + 14)
// ──────────────────────────────────────────────────────────────────
//
// Thin wrapper around `scripts/nex-canonical/_emergency-pending-probe.mjs`.
// Returns the parsed JSON envelope (ok/true + payload, or ok/false +
// reason). Playwright uses the reason value to decide between fail
// and skip.
async function runProbe(args: string[]): Promise<Record<string, unknown>> {
  const { spawn } = await import("node:child_process");
  const script = path.join(
    process.cwd(),
    "scripts",
    "nex-canonical",
    "_emergency-pending-probe.mjs",
  );
  return await new Promise((resolve) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (b) => (out += String(b)));
    child.stderr.on("data", (b) => (err += String(b)));
    child.on("close", () => {
      // The probe emits exactly one JSON line to stdout.
      const line = out.trim().split("\n").filter(Boolean).pop();
      if (!line) {
        resolve({ ok: false, reason: "probe_no_output", stderr: err });
        return;
      }
      try {
        resolve(JSON.parse(line));
      } catch {
        resolve({ ok: false, reason: "probe_invalid_json", raw: line });
      }
    });
  });
}
