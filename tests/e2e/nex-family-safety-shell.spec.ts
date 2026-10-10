// tests/e2e/nex-family-safety-shell.spec.ts
//
// NEX Family Safety · SHELL + entry Playwright · authored 2026-10-10.
// -------------------------------------------------------------------
// Covers the FS-1 scope:
//   · Settings page mounts the Family SafeChat entry card
//   · Entry card tile loads (naturalWidth > 0)
//   · Tapping the card routes to /nex-native/family-safety
//   · The Family Safety shell renders the sealed chrome: title,
//     SIMULATED · PILOT badge, Settings back-link, nav chips
//   · Home page renders the five sealed sections (hero, status
//     panel, CTA grid, transparency, back-to-Settings)
//   · Desktop (1280×820) + mobile (393×852) parity
//   · No console errors fire on either viewport
//
// Scope: shell + entry only. Does NOT test FS-2 (setup / invite /
// accept / pressure-signal), FS-3 (dashboard / safechat / contact
// visibility), or FS-4 (subscription / end-to-end). Those have their
// own specs owned by their respective agents.

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
  "nex-family-safety-shell",
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
    const email = `fs-shell-${Date.now()}-${randomUUID().slice(0, 8)}@test.local`;
    const password = `FS!Pw${Date.now()}`;
    const c = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (c.error || !c.data.user) return null;
    const authId = c.data.user.id;
    const acc = await admin
      .from("nex_account")
      .insert({ supabase_user_id: authId, display_name: "Family Shell Verify" })
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

test.describe("Family Safety SHELL · Settings entry → home navigation", () => {
  test.setTimeout(90_000);

  for (const [label, width, height] of [
    ["desktop", 1280, 820],
    ["mobile", 393, 852],
  ] as const) {
    test(`${label} ${width}×${height} · settings entry mounts, routes to home, chrome renders`, async ({
      browser,
    }) => {
      if (!fixture) throw new Error("no fixture");
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
        if (
          url.includes("nex-family-safety") ||
          url.includes("family-safety")
        ) {
          failedRequests.push(
            `${req.method()} ${url} · ${req.failure()?.errorText ?? "?"}`,
          );
        }
      });

      try {
        // ─── 1 · Settings mounts the entry card ─────────────────────
        await page.goto(`${BASE_URL}/nex-native/settings`, {
          waitUntil: "domcontentloaded",
        });

        const entry = page.locator(
          '[data-testid="nex-family-safe-chat-entry"]',
        );
        await expect(
          entry,
          "Family SafeChat entry card must mount on Settings",
        ).toBeVisible({ timeout: 15_000 });

        // Entry is below the sealed EmergencyHelpEntry.
        const emergency = page.locator('[data-testid="nex-emergency-entry"]');
        await expect(
          emergency,
          "sealed Emergency Help pinned-top card must still be visible",
        ).toBeVisible();

        // ─── 2 · Reserved tile loads (naturalWidth > 0) ─────────────
        const hero = page.locator(
          '[data-testid="nex-family-safe-chat-entry-hero"]',
        );
        await expect(hero).toBeVisible();
        const img = hero.locator("img").first();
        await expect(img).toHaveAttribute(
          "src",
          "/nex-family-safety/family-safe-chat-entry-icon.png",
        );
        const imgLoaded = await img.evaluate((el: HTMLImageElement) => ({
          complete: el.complete,
          naturalWidth: el.naturalWidth,
          naturalHeight: el.naturalHeight,
        }));
        expect(
          imgLoaded.complete,
          "reserved tile should be fully loaded",
        ).toBe(true);
        expect(
          imgLoaded.naturalWidth,
          "reserved tile naturalWidth > 0 proves it rendered",
        ).toBeGreaterThan(0);
        expect(imgLoaded.naturalHeight).toBeGreaterThan(0);

        // Hero bounding box · 96×96 at both viewports.
        const heroBox = await hero.boundingBox();
        expect(heroBox, "hero bounding box exists").not.toBeNull();
        if (heroBox) {
          expect(Math.round(heroBox.width)).toBe(96);
          expect(Math.round(heroBox.height)).toBe(96);
        }

        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `settings-${label}.png`),
          fullPage: false,
        });

        // ─── 3 · Tap routes to /nex-native/family-safety ────────────
        await entry.click();
        await page.waitForURL(/\/nex-native\/family-safety$/i, {
          timeout: 15_000,
        });

        // ─── 4 · Shell chrome renders ───────────────────────────────
        const shell = page.locator('[data-nex-family-safety-shell="true"]');
        await expect(shell).toBeVisible();

        // Title.
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(
          "Family Safety",
        );

        // SIMULATED · PILOT badge mounted.
        const pilot = page.locator(
          '[data-testid="nex-family-safety-pilot-badge"]',
        );
        await expect(pilot).toHaveCount(1);

        // Back-to-Settings link.
        const back = page.locator('[data-nex-family-safety-back="true"]');
        await expect(back).toBeVisible();
        await expect(back).toHaveAttribute("href", "/nex-native/settings");

        // Nav chips · home is active.
        const navHome = page.locator(
          '[data-nex-family-safety-nav-chip="home"]',
        );
        await expect(navHome).toBeVisible();
        await expect(navHome).toHaveAttribute(
          "data-nex-family-safety-nav-active-chip",
          "true",
        );
        // All five nav chips present.
        for (const key of ["home", "setup", "dashboard", "safechat", "subscription"]) {
          await expect(
            page.locator(`[data-nex-family-safety-nav-chip="${key}"]`),
            `nav chip ${key} must be present`,
          ).toHaveCount(1);
        }

        // ─── 5 · Home page sections ─────────────────────────────────
        await expect(
          page.locator('[data-nex-family-safety-home-hero="true"]'),
        ).toBeVisible();
        await expect(
          page.locator('[data-nex-family-safety-home-status="true"]'),
        ).toBeVisible();
        await expect(
          page.locator('[data-nex-family-safety-home-ctas="true"]'),
        ).toBeVisible();
        await expect(
          page.locator('[data-nex-family-safety-home-transparency="true"]'),
        ).toBeVisible();

        // Membership chip is present (tone depends on fixture state ·
        // for a fresh fixture it should be "neutral" with "No family yet").
        const membershipChip = page.locator(
          '[data-testid="nex-family-safety-home-membership-chip"]',
        );
        await expect(membershipChip).toBeVisible();

        // Transparency sections are honest (contain the sealed phrases).
        const promises = page.locator(
          '[data-nex-family-safety-promises="true"]',
        );
        await expect(promises).toContainText("Link a parent/guardian");
        const ceiling = page.locator(
          '[data-nex-family-safety-ceiling="true"]',
        );
        await expect(ceiling).toContainText(
          "No parent reads a child's messages",
        );

        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `home-${label}.png`),
          fullPage: true,
        });

        // ─── 6 · Honest navigation back ─────────────────────────────
        await back.click();
        await page.waitForURL(/\/nex-native\/settings$/i, {
          timeout: 15_000,
        });

        // Settings page is back · entry card still visible.
        await expect(entry).toBeVisible();

        // ─── 7 · No console / page errors from this flow ────────────
        expect(
          failedRequests,
          "no Family Safety asset request should fail",
        ).toHaveLength(0);
        const noisyErrors = consoleErrors.filter((e) =>
          /family-safety|family-safe-chat|SimulatedPilot/i.test(e),
        );
        expect(noisyErrors, "no FS-related console errors").toEqual([]);
        const noisyPageErrors = pageErrors.filter((e) =>
          /family-safety|family-safe-chat|SimulatedPilot/i.test(e),
        );
        expect(noisyPageErrors, "no FS-related page errors").toEqual([]);
      } finally {
        await ctx.close();
      }
    });
  }
});
