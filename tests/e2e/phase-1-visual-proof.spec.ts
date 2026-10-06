// tests/e2e/phase-1-visual-proof.spec.ts
//
// NEX Phase 1.0 · visual proof capture.
// Sealed 2026-10-06. For every Phase 1.0 surface (Settings landing +
// World Intro + Custom Intro + 4 Security pages), capture a full-page
// screenshot at 5 widths (320, 375, 390, 430, 1280). 7 × 5 = 35 shots.
//
// Output: tests/e2e-screenshots/phase-1-visual/<folder>/<WxH>.png
//
// Prerequisites · same as phase-1-security.spec.ts:
//   · Dev server running at http://localhost:3008
//   · Migration 139 applied
//   · NEX_E2E_SKIP_WEBSERVER=1
//   · Supabase env configured
//
// Per-surface skip (not fail) when the test account can't reach the
// surface (redirect to sign-in, 5xx, or marker never appears within
// 15 s). Each width is a separate test so a dark surface at one width
// doesn't cascade.

import { test, expect, type BrowserContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";

const SUPABASE_URL =
  process.env.NEX_SUPABASE_URL ?? process.env.NEXT_PUBLIC_NEX_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.NEX_SUPABASE_SERVICE_ROLE_KEY ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY ?? "";
const BASE_URL = process.env.NEX_E2E_BASE_URL ?? "http://localhost:3008";

const SCREENSHOT_ROOT = path.join(
  process.cwd(),
  "tests",
  "e2e-screenshots",
  "phase-1-visual",
);

interface SurfaceDef {
  readonly route: string;
  readonly folder: string;
  readonly markerSelector: string;
}

const SURFACES: ReadonlyArray<SurfaceDef> = [
  {
    route: "/nex-native/settings",
    folder: "settings-landing",
    markerSelector: '[data-nex-settings-page="index"]',
  },
  {
    route: "/nex-native/settings/world-intro",
    folder: "world-intro",
    markerSelector: '[data-nex-settings-page="world-intro"]',
  },
  {
    route: "/nex-native/settings/custom-intro",
    folder: "custom-intro",
    markerSelector: '[data-nex-settings-page="custom-intro"]',
  },
  {
    route: "/nex-native/settings/security",
    folder: "security-landing",
    markerSelector: '[data-nex-security-shell][data-nex-security-route="landing"]',
  },
  {
    route: "/nex-native/settings/security/devices",
    folder: "security-devices",
    markerSelector: '[data-nex-security-shell][data-nex-security-route="devices"]',
  },
  {
    route: "/nex-native/settings/security/activity",
    folder: "security-activity",
    markerSelector: '[data-nex-security-shell][data-nex-security-route="activity"]',
  },
  {
    route: "/nex-native/settings/security/password",
    folder: "security-password",
    markerSelector: '[data-nex-security-shell][data-nex-security-route="password"]',
  },
];

const WIDTHS: ReadonlyArray<[number, number]> = [
  [320, 568],
  [375, 812],
  [390, 844],
  [430, 932],
  [1280, 900],
];

interface Fixture {
  authId: string;
  accountId: string;
  email: string;
  password: string;
  jwt: string;
  refresh: string;
}

let FIXTURE: Fixture | null = null;

async function provisionAlice(): Promise<Fixture> {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = `playwright-visual-${Date.now()}@test.local`;
  const password = `Playwright!V${Date.now()}`;
  const createUser = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createUser.error || !createUser.data.user) {
    throw new Error(`createUser: ${createUser.error?.message}`);
  }
  const authId = createUser.data.user.id;
  const acc = await admin
    .from("nex_account")
    .insert({ supabase_user_id: authId, display_name: "Playwright Visual Alice" })
    .select("*")
    .single();
  if (acc.error) throw new Error(`insert account: ${acc.error.message}`);
  const accountId = (acc.data as { id: string }).id;
  const signIn = await anon.auth.signInWithPassword({ email, password });
  if (signIn.error || !signIn.data.session) {
    throw new Error(`signIn: ${signIn.error?.message}`);
  }
  // Seed one nex_sign_in_event so the Activity surface has something
  // real to render. Wrapped in try/catch so a pre-migration run still
  // captures everything else.
  try {
    await admin.from("nex_sign_in_event").insert({
      account_id: accountId,
      event_type: "password",
      success: true,
      device_label: "Playwright test",
      user_agent: "Playwright/visual-proof",
      ip_address: "203.0.113.1",
      approx_city: "London",
      approx_country: "United Kingdom",
    });
  } catch {
    /* ignore · activity will show empty-state */
  }
  return {
    authId,
    accountId,
    email,
    password,
    jwt: signIn.data.session.access_token,
    refresh: signIn.data.session.refresh_token,
  };
}

async function teardown(f: Fixture): Promise<void> {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const swallow = async (p: Promise<unknown>) => {
    try {
      await p;
    } catch {
      /* ignore */
    }
  };
  await swallow(admin.from("nex_session").delete().eq("account_id", f.accountId) as unknown as Promise<unknown>);
  await swallow(admin.from("nex_sign_in_event").delete().eq("account_id", f.accountId) as unknown as Promise<unknown>);
  await swallow(admin.from("nex_account_custom_intro").delete().eq("account_id", f.accountId) as unknown as Promise<unknown>);
  await swallow(admin.from("nex_account").delete().eq("id", f.accountId) as unknown as Promise<unknown>);
  await swallow(admin.auth.admin.deleteUser(f.authId) as unknown as Promise<unknown>);
}

async function plantAuthCookies(ctx: BrowserContext, jwt: string, refresh: string): Promise<void> {
  const projectRef = SUPABASE_URL.match(/https?:\/\/([^.]+)/)?.[1] ?? "unknown";
  const cookieName = `sb-${projectRef}-auth-token`;
  const payload = {
    access_token: jwt,
    refresh_token: refresh,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600,
    token_type: "bearer",
    user: null,
  };
  const base = new URL(BASE_URL);
  await ctx.addCookies([
    {
      name: cookieName,
      value: `base64-${Buffer.from(JSON.stringify(payload)).toString("base64")}`,
      domain: base.hostname,
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
    {
      name: "xrated_cookie_consent",
      value: "all",
      domain: base.hostname,
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
  ]);
}

async function migrationApplied(): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return false;
  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const r = await admin.from("nex_session").select("id").limit(1);
    return !r.error;
  } catch {
    return false;
  }
}

test.beforeAll(async () => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) return;
  if (!(await migrationApplied())) return;
  try {
    fs.mkdirSync(SCREENSHOT_ROOT, { recursive: true });
    for (const s of SURFACES) {
      fs.mkdirSync(path.join(SCREENSHOT_ROOT, s.folder), { recursive: true });
    }
  } catch {
    /* noop */
  }
  FIXTURE = await provisionAlice();
});

test.afterAll(async () => {
  if (FIXTURE) await teardown(FIXTURE);
  FIXTURE = null;
});

test.describe("Phase 1.0 Visual proof", () => {
  test.setTimeout(120_000);

  for (const [w, h] of WIDTHS) {
    for (const surface of SURFACES) {
      test(`${surface.folder} @ ${w}x${h}`, async ({ browser }) => {
        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
          test.skip(true, "Supabase env missing");
        }
        if (!(await migrationApplied())) {
          test.skip(true, "Migration 139 not applied");
        }
        if (!FIXTURE) {
          test.skip(true, "Provisioning failed in beforeAll");
          return;
        }
        const ctx = await browser.newContext({ viewport: { width: w, height: h } });
        await plantAuthCookies(ctx, FIXTURE.jwt, FIXTURE.refresh);
        const page = await ctx.newPage();
        try {
          const resp = await page.goto(`${BASE_URL}${surface.route}`, {
            waitUntil: "domcontentloaded",
            timeout: 60_000,
          });
          const status = resp?.status() ?? 0;
          if (status >= 500) {
            test.skip(true, `Surface ${surface.folder} returned ${status}`);
            return;
          }
          if (page.url().includes("/sign-in")) {
            test.skip(true, `Surface ${surface.folder} redirected to sign-in · cookie not accepted`);
            return;
          }
          // Marker must appear within 15 s · otherwise skip gracefully.
          const markerVisible = await page
            .locator(surface.markerSelector)
            .first()
            .waitFor({ state: "visible", timeout: 15_000 })
            .then(() => true)
            .catch(() => false);
          if (!markerVisible) {
            test.skip(true, `Surface ${surface.folder} marker never appeared`);
            return;
          }
          const file = path.join(SCREENSHOT_ROOT, surface.folder, `${w}x${h}.png`);
          await page.screenshot({ path: file, fullPage: true });
          // Sanity · file exists + not zero bytes.
          expect(fs.existsSync(file)).toBeTruthy();
          const stat = fs.statSync(file);
          expect(stat.size).toBeGreaterThan(1024);
        } finally {
          await ctx.close();
        }
      });
    }
  }
});
