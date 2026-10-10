// tests/e2e/nex-emergency-help-entry-asset.spec.ts
//
// NEX Emergency Help · pinned-top Settings entry · asset verification.
// --------------------------------------------------------------------
// Verifies the recently-swapped 3D beacon tile actually renders in the
// browser · not just that the asset URL returns 200. Covers:
//
//   · Image <img> is loaded (naturalWidth > 0, naturalHeight > 0)
//   · Hero container bounding box is 80×80 as intended
//   · Sealed `nex-emergency-pulse` keyframe animation is applied
//   · Parent anchor has an accessible name
//   · No console errors fire during card render
//   · Desktop (1280×820) and mobile (393×852) both render without
//     distortion/clipping
//   · Settings page remains reachable (auth-gated · uses sealed fixture)
//
// Scope: ASSET verification only. Does NOT redesign the feature, does
// NOT activate SafeChat, does NOT mount the Family SafeChat tile.

import { expect, test, type BrowserContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";

// Load .env.local so NEX_SUPABASE_* vars are available in CI + local runs.
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
  "nex-emergency-help-entry-asset",
);

interface Fixture {
  authId: string;
  accountId: string;
  jwt: string;
  refresh: string;
}

async function devServerReachable(): Promise<boolean> {
  try {
    const r = await fetch(BASE_URL, {
      method: "GET",
      signal: AbortSignal.timeout(5_000),
    });
    return r.status > 0 && r.status < 500;
  } catch {
    return false;
  }
}

async function provisionAccount(): Promise<Fixture | null> {
  if (!SUPABASE_URL || !SERVICE_ROLE || !ANON) return null;
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const anon = createClient(SUPABASE_URL, ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const email = `eh-asset-${Date.now()}-${randomUUID().slice(0, 8)}@test.local`;
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
      .insert({ supabase_user_id: authId, display_name: "Asset Verify" })
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

let fixture: Fixture | null = null;
let fixtureAttempted = false;

test.beforeAll(async () => {
  const alive = await devServerReachable();
  test.skip(!alive, `dev server not reachable at ${BASE_URL}`);
  try {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  } catch {
    /* noop */
  }
  if (!fixtureAttempted) {
    fixtureAttempted = true;
    fixture = await provisionAccount();
    if (!fixture) {
      throw new Error(
        "fixture provisioning failed · ensure NEX_SUPABASE_* env vars are set and Supabase is reachable",
      );
    }
  }
});

test.describe("Emergency Help entry asset verification", () => {
  test.setTimeout(60_000);

  for (const [label, width, height] of [
    ["desktop", 1280, 820],
    ["mobile", 393, 852],
  ] as const) {
    test(`${label} ${width}×${height} · hero image renders at 80×80 with pulse animation + no console errors`, async ({
      browser,
    }) => {
      if (!fixture) {
        throw new Error("no fixture");
      }
      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];
      const failedRequests: string[] = [];

      const ctx = await browser.newContext({
        viewport: { width, height },
      });
      await plantAuthCookies(ctx, fixture.jwt, fixture.refresh);
      const page = await ctx.newPage();
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });
      page.on("pageerror", (err) => {
        pageErrors.push(err.message);
      });
      page.on("requestfailed", (req) => {
        const url = req.url();
        // Only flag Emergency-related asset failures.
        if (
          url.includes("nex-emergency") ||
          url.includes("nex-family-safety")
        ) {
          failedRequests.push(`${req.method()} ${url} · ${req.failure()?.errorText ?? "?"}`);
        }
      });

      try {
        await page.goto(`${BASE_URL}/nex-native/settings`, {
          waitUntil: "domcontentloaded",
        });

        // 1 · Entry card is visible with its sealed test id.
        const entry = page.locator('[data-testid="nex-emergency-entry"]');
        await expect(entry).toBeVisible({ timeout: 15_000 });

        // 2 · Accessible name (sealed anchor Link exposes the headline).
        const entryAccessibleHtml = await entry.innerHTML();
        expect(entryAccessibleHtml).toContain("NEX Emergency Help");

        // 3 · Hero container exists with the new test id.
        const hero = page.locator('[data-testid="nex-emergency-entry-hero"]');
        await expect(hero).toBeVisible();

        // 4 · Hero bounding box is 80×80 (the sealed replacement size).
        const heroBox = await hero.boundingBox();
        expect(heroBox, "hero bounding box should exist").not.toBeNull();
        if (heroBox) {
          expect(
            Math.round(heroBox.width),
            `hero width at ${label} should be 80px`,
          ).toBe(80);
          expect(
            Math.round(heroBox.height),
            `hero height at ${label} should be 80px`,
          ).toBe(80);
        }

        // 5 · The <img> inside the hero has loaded (naturalWidth > 0).
        const img = hero.locator("img").first();
        await expect(img).toBeVisible();
        await expect(img).toHaveAttribute(
          "src",
          "/nex-emergency/emergency-help-entry-icon.png",
        );
        const imgLoaded = await img.evaluate((el: HTMLImageElement) => ({
          complete: el.complete,
          naturalWidth: el.naturalWidth,
          naturalHeight: el.naturalHeight,
        }));
        expect(imgLoaded.complete, "image should be fully loaded").toBe(true);
        expect(
          imgLoaded.naturalWidth,
          "image naturalWidth > 0 proves the asset actually loaded",
        ).toBeGreaterThan(0);
        expect(imgLoaded.naturalHeight).toBeGreaterThan(0);

        // 6 · Pulse animation applied (sealed `nex-emergency-pulse`).
        const animationName = await hero.evaluate((el: HTMLElement) => {
          const s = window.getComputedStyle(el);
          return {
            animationName: s.animationName,
            animationDuration: s.animationDuration,
            animationIterationCount: s.animationIterationCount,
          };
        });
        expect(
          animationName.animationName,
          "pulse keyframe must still be applied to the hero",
        ).toContain("nex-emergency-pulse");
        expect(animationName.animationIterationCount).toBe("infinite");

        // 7 · Settle a moment so any post-mount scripts can log errors.
        await page.waitForTimeout(500);

        // 8 · No Emergency-related image fetches failed.
        expect(
          failedRequests,
          "no Emergency / Family-Safety asset request should fail",
        ).toHaveLength(0);

        // 9 · No console errors introduced by the entry card.
        // Filter out pre-existing noisy warnings not caused by this card.
        const entryCardConsoleErrors = consoleErrors.filter((e) =>
          /emergency|entry-icon|image/i.test(e),
        );
        expect(
          entryCardConsoleErrors,
          "no card-related console errors",
        ).toEqual([]);
        const entryCardPageErrors = pageErrors.filter((e) =>
          /emergency|entry|image/i.test(e),
        );
        expect(entryCardPageErrors, "no card-related page errors").toEqual([]);

        // 10 · Screenshot the card for human review.
        await entry.screenshot({
          path: path.join(SCREENSHOT_DIR, `card-${label}.png`),
        });
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `page-${label}.png`),
          fullPage: false,
        });
      } finally {
        await ctx.close();
      }
    });
  }

  test("Family SafeChat tile is served and now mounted on Settings (Family Safety authorised 2026-10-10)", async ({
    browser,
  }) => {
    // Authorisation state change · 2026-10-10 · the founder authorised
    // the Family Safety build. The reserved tile at
    // /nex-family-safety/family-safe-chat-entry-icon.png is now
    // mounted on Settings via the FS-1 FamilySafeChatEntry section.
    // This test's prior reservation-only invariant no longer holds ·
    // the subtest now asserts the ACTIVE mounting instead.
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 820 },
    });
    try {
      const page = await ctx.newPage();
      // 1 · asset is served
      const assetResp = await page.goto(
        `${BASE_URL}/nex-family-safety/family-safe-chat-entry-icon.png`,
      );
      expect(assetResp?.status(), "family-safe-chat asset served").toBe(200);

      // 2 · asset IS rendered on the Settings page (Family Safety
      // authorised). The entry card lives in a dedicated "Family
      // Safety" section between the Emergency Help pinned-top card
      // and the sealed 7-group SETTINGS_GROUPS list. The sealed
      // Emergency Help pinned-top card is unaffected (asserted
      // above).
      if (!fixture) throw new Error("no fixture");
      await plantAuthCookies(ctx, fixture.jwt, fixture.refresh);
      await page.goto(`${BASE_URL}/nex-native/settings`, {
        waitUntil: "domcontentloaded",
      });
      const familyTileImgs = page.locator(
        'img[src*="family-safe-chat-entry-icon"]',
      );
      await expect(
        familyTileImgs,
        "Family SafeChat tile MUST be mounted in Settings (Family Safety authorised)",
      ).toHaveCount(1);
    } finally {
      await ctx.close();
    }
  });
});
