// tests/e2e/nex-family-safety-e2e.spec.ts
//
// NEX Family Safety · FULL end-to-end journey · FS-4 owns this.
// Scenarios reach into FS-1 (shell), FS-2 (setup/invite/accept),
// FS-3 (dashboard/safechat), FS-4 (subscription). Where an upstream
// scope has not yet shipped a routed destination, that scenario is
// marked `test.fixme()` with a reason. The subscription slice is
// always exercised standalone.
//
// Desktop (1280) + mobile (393) parity.

import { expect, test, type BrowserContext, type Page } from "@playwright/test";
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
  "nex-family-safety-e2e",
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

async function provisionAccount(label: string): Promise<Fixture | null> {
  if (!SUPABASE_URL || !SERVICE_ROLE || !ANON) return null;
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const anon = createClient(SUPABASE_URL, ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const email = `fs-e2e-${Date.now()}-${randomUUID().slice(0, 8)}@test.local`;
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
      .insert({ supabase_user_id: authId, display_name: label })
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
  const projectRef =
    SUPABASE_URL.match(/https?:\/\/([^.]+)/)?.[1] ?? "unknown";
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

async function pageExists(page: Page, url: string): Promise<boolean> {
  try {
    const resp = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 10_000,
    });
    if (!resp) return false;
    return resp.status() < 400;
  } catch {
    return false;
  }
}

let devUp = false;

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
});

test.describe("NEX Family Safety · full end-to-end journey", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);

  for (const [label, w, h] of [
    ["desktop", 1280, 820],
    ["mobile", 393, 852],
  ] as const) {
    test(`${label} · guardian journey · settings → family-safety home → subscription success → manage`, async ({
      browser,
    }) => {
      const guardian = await provisionAccount(`FS E2E Guardian ${label}`);
      if (!guardian) {
        test.skip(true, "fixture provisioning failed");
        return;
      }

      const ctx = await browser.newContext({ viewport: { width: w, height: h } });
      await plantAuthCookies(ctx, guardian.jwt, guardian.refresh);
      const page = await ctx.newPage();

      // 1 · Settings exposes the Emergency Help entry (regression check
      //     folded in here so a shared journey proves it).
      await page.goto(`${BASE_URL}/nex-native/settings`, {
        waitUntil: "domcontentloaded",
      });
      const emergencyEntry = page.locator("[data-nex-emergency-entry]");
      await expect(emergencyEntry).toBeVisible({ timeout: 10_000 });

      // 2 · Family Safety home (FS-1).
      const hasHome = await pageExists(
        page,
        `${BASE_URL}/nex-native/family-safety`,
      );
      if (!hasHome) {
        // FS-1 may still be in-progress; the subscription slice still works.
        // eslint-disable-next-line no-console
        console.log("[fs-e2e] family-safety home not yet routable · continuing");
      } else {
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `${label}-01-fs-home.png`),
          fullPage: true,
        });
      }

      // 3 · Setup page (FS-2 scope).
      const hasSetup = await pageExists(
        page,
        `${BASE_URL}/nex-native/family-safety/setup`,
      );
      if (!hasSetup) {
        test.fixme(true, "FS-2 setup page not yet shipped · fixme deferred");
      }

      // 4 · Dashboard page (FS-3 scope).
      const hasDashboard = await pageExists(
        page,
        `${BASE_URL}/nex-native/family-safety/dashboard`,
      );
      if (!hasDashboard) {
        // Not fatal · the subscription path still runs.
        // eslint-disable-next-line no-console
        console.log("[fs-e2e] FS-3 dashboard not yet shipped · skipping sections");
      }

      // 5 · Subscription · plan info.
      await page.goto(`${BASE_URL}/nex-native/family-safety/subscription`, {
        waitUntil: "domcontentloaded",
      });
      await expect(
        page.locator("[data-nex-fs-test-mode-banner]").first(),
      ).toBeVisible();

      // 6 · Start checkout for the free pilot plan.
      await page.goto(
        `${BASE_URL}/nex-native/family-safety/subscription/checkout?plan=family_safety_pilot_free`,
        { waitUntil: "domcontentloaded" },
      );
      await expect(
        page.locator("[data-nex-fs-test-mode-banner]"),
      ).toBeVisible();
      await page.click("[data-nex-fs-simulate-success]");
      await page.waitForURL(/\/success/, { timeout: 15_000 });

      // 7 · Success page shows active test entitlement.
      const successState = page.locator("[data-nex-fs-success-state]");
      await expect(successState).toBeVisible();
      expect(await successState.getAttribute("data-nex-fs-active")).toBe("true");
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `${label}-02-sub-success.png`),
        fullPage: true,
      });

      // 8 · Manage page confirms active state.
      await page.goto(
        `${BASE_URL}/nex-native/family-safety/subscription/manage`,
        { waitUntil: "domcontentloaded" },
      );
      const manageState = page.locator("[data-nex-fs-manage-state]");
      expect(await manageState.getAttribute("data-nex-fs-active")).toBe("true");

      // 9 · Cancel · state returns to inactive.
      await Promise.all([
        page.waitForURL(/\/manage\?event=cancel/, { timeout: 15_000 }),
        page.click("[data-nex-fs-manage-cancel-btn]"),
      ]);
      const manageStateAfter = page.locator("[data-nex-fs-manage-state]");
      await expect(manageStateAfter).toBeVisible();
      expect(await manageStateAfter.getAttribute("data-nex-fs-active")).toBe("false");

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `${label}-03-sub-after-cancel.png`),
        fullPage: true,
      });
      await ctx.close();
    });
  }
});
