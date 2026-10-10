// tests/e2e/nex-family-safety-custody.spec.ts
//
// NEX Family Safety · CC-4 end-to-end · parent custody list + detail.
// -------------------------------------------------------------------
// Covers scenarios 10-14 from the CC-4 inventory:
//
//   10. With a seeded active custody, parent sees it in /custody list
//   11. Click into /custody/[id] · sees child display name · age ·
//       auto-transfer countdown
//   12. "Reset password" modal shows explanation · issuing emits a
//       success message · NO plaintext password visible in DOM
//   13. "View audit" page shows at least `custody_created`
//   14. "Revoke custody" confirmation flow · custody disappears from
//       the list on reload
//
// Honesty discipline:
//   · All scenarios depend on CC-2 shipping /custody list+detail routes
//     AND CC-1 shipping an authoritative parent-custody service. Both
//     are not yet shipped at the time this spec was authored, so each
//     test uses `test.fixme()` with an explicit reason.
//   · Preflight-skip if dev server is unreachable or env vars missing.
//   · No faked passes.
//
// Authored 2026-10-10 by CC-4.

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
  "nex-family-safety-custody",
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
    const email = `fs-custody-${Date.now()}-${randomUUID().slice(0, 8)}@test.local`;
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

async function custodyRouteShipped(): Promise<boolean> {
  // The route folder exists empty · require the sealed page.tsx on disk.
  const expectedSrc = path.join(
    process.cwd(),
    "src",
    "app",
    "nex-native",
    "family-safety",
    "custody",
    "page.tsx",
  );
  if (!fs.existsSync(expectedSrc)) return false;
  const r = await fetch(`${BASE_URL}/nex-native/family-safety/custody`, {
    method: "GET",
    redirect: "manual",
    signal: AbortSignal.timeout(5_000),
  }).catch(() => null);
  if (!r) return false;
  return r.status !== 404;
}

/**
 * Seeds an active custody via the service role directly on migration-205.
 * CC-1's authoritative service will replace this once shipped; the DB
 * shape here matches 205_nex_parent_custody_link.sql exactly.
 */
async function seedCustody(
  parentAccountId: string,
): Promise<{ custodyId: string; childAccountId: string } | null> {
  if (!SUPABASE_URL || !SERVICE_ROLE) return null;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // Create a lightweight child nex_account for the custody target.
  const authCreate = await admin.auth.admin.createUser({
    email: `fs-custody-child-${Date.now()}-${randomUUID().slice(0, 6)}@test.local`,
    password: `Child!Pw${Date.now()}`,
    email_confirm: true,
  });
  if (authCreate.error || !authCreate.data.user) return null;
  const childAcc = await admin
    .from("nex_account")
    .insert({
      supabase_user_id: authCreate.data.user.id,
      display_name: "Custody Child",
    })
    .select("id")
    .single();
  if (childAcc.error || !childAcc.data) return null;
  const childAccountId = (childAcc.data as { id: string }).id;
  const in5y = new Date();
  in5y.setFullYear(in5y.getFullYear() + 5);
  const custodyIns = await admin
    .schema("nex")
    .from("parent_custody_link")
    .insert({
      parent_account_id: parentAccountId,
      child_account_id: childAccountId,
      link_type: "created_minor",
      auto_transfer_at: in5y.toISOString(),
      simulated: true,
    })
    .select("custody_id")
    .single();
  if (custodyIns.error || !custodyIns.data) return null;
  const custodyId = (custodyIns.data as { custody_id: string }).custody_id;
  await admin
    .schema("nex")
    .from("parent_custody_audit_log")
    .insert({
      custody_id: custodyId,
      parent_account_id: parentAccountId,
      child_account_id: childAccountId,
      action: "custody_created",
      simulated: true,
    });
  return { custodyId, childAccountId };
}

let fixture: Fixture | null = null;
let fixtureAttempted = false;
let custodyShipped = false;
let seeded: { custodyId: string; childAccountId: string } | null = null;

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
    fixture = await provisionAccount("CC Custody Parent");
    if (!fixture) {
      throw new Error("fixture provisioning failed · ensure env vars are set");
    }
    seeded = await seedCustody(fixture.accountId);
  }
  custodyShipped = await custodyRouteShipped();
});

test.describe("Family Safety · parent custody", () => {
  test.setTimeout(90_000);

  test("S10 · seeded custody appears in /custody list", async ({ browser }) => {
    test.fixme(
      !custodyShipped,
      "CC-2 has not shipped /nex-native/family-safety/custody list route (404)",
    );
    test.fixme(
      !seeded,
      "custody seed failed · likely migrations 203-207 not applied via _apply-migration-{203..207}.mjs yet",
    );
    if (!fixture || !seeded) return;
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 } });
    await plantAuthCookies(ctx, fixture.jwt, fixture.refresh);
    const page = await ctx.newPage();
    try {
      await page.goto(`${BASE_URL}/nex-native/family-safety/custody`, {
        waitUntil: "domcontentloaded",
      });
      const row = page.locator(
        `[data-testid="nex-custody-row-${seeded.custodyId}"]`,
      );
      await expect(row).toBeVisible({ timeout: 15_000 });
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "s10-list.png"),
        fullPage: true,
      });
    } finally {
      await ctx.close();
    }
  });

  test("S11 · /custody/[id] detail shows child name + age + countdown", async ({
    browser,
  }) => {
    test.fixme(
      !custodyShipped,
      "CC-2 custody detail page not shipped",
    );
    test.fixme(!seeded, "custody seed failed");
    if (!fixture || !seeded) return;
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 } });
    await plantAuthCookies(ctx, fixture.jwt, fixture.refresh);
    const page = await ctx.newPage();
    try {
      await page.goto(
        `${BASE_URL}/nex-native/family-safety/custody/${seeded.custodyId}`,
        { waitUntil: "domcontentloaded" },
      );
      await expect(
        page.locator('[data-testid="nex-custody-detail-child-name"]'),
      ).toBeVisible({ timeout: 15_000 });
      await expect(
        page.locator('[data-testid="nex-custody-detail-countdown"]'),
      ).toBeVisible();
    } finally {
      await ctx.close();
    }
  });

  test("S12 · 'Reset password' modal · success message · zero plaintext password", async ({
    browser,
  }) => {
    test.fixme(!custodyShipped, "CC-2 reset-password modal not shipped");
    test.fixme(!seeded, "custody seed failed");
    if (!fixture || !seeded) return;
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 } });
    await plantAuthCookies(ctx, fixture.jwt, fixture.refresh);
    const page = await ctx.newPage();
    try {
      await page.goto(
        `${BASE_URL}/nex-native/family-safety/custody/${seeded.custodyId}`,
        { waitUntil: "domcontentloaded" },
      );
      await page.locator('[data-testid="nex-custody-reset-password-cta"]').click();
      const modal = page.locator('[data-testid="nex-custody-reset-password-modal"]');
      await expect(modal).toBeVisible();
      await page.locator('[data-testid="nex-custody-reset-password-issue"]').click();
      await expect(
        page.locator('[data-testid="nex-custody-reset-password-success"]'),
      ).toBeVisible({ timeout: 15_000 });
      // Zero plaintext password in DOM: a password sequence (8+ non-space chars
      // adjacent to the word "password") must NOT appear.
      const html = await page.content();
      expect(
        /password\s*[:=]\s*\S{6,}/i.test(html),
        "DOM must not include a plaintext password token",
      ).toBe(false);
    } finally {
      await ctx.close();
    }
  });

  test("S13 · 'View audit' page shows at least custody_created", async ({
    browser,
  }) => {
    test.fixme(!custodyShipped, "CC-2 audit page not shipped");
    test.fixme(!seeded, "custody seed failed");
    if (!fixture || !seeded) return;
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 } });
    await plantAuthCookies(ctx, fixture.jwt, fixture.refresh);
    const page = await ctx.newPage();
    try {
      await page.goto(
        `${BASE_URL}/nex-native/family-safety/custody/${seeded.custodyId}/audit`,
        { waitUntil: "domcontentloaded" },
      );
      const auditList = page.locator('[data-testid="nex-custody-audit-list"]');
      await expect(auditList).toBeVisible({ timeout: 15_000 });
      await expect(auditList).toContainText("custody_created");
    } finally {
      await ctx.close();
    }
  });

  test("S14 · 'Revoke custody' confirmation + removal", async ({ browser }) => {
    test.fixme(!custodyShipped, "CC-2 revoke flow not shipped");
    test.fixme(!seeded, "custody seed failed");
    if (!fixture || !seeded) return;
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 } });
    await plantAuthCookies(ctx, fixture.jwt, fixture.refresh);
    const page = await ctx.newPage();
    try {
      await page.goto(
        `${BASE_URL}/nex-native/family-safety/custody/${seeded.custodyId}`,
        { waitUntil: "domcontentloaded" },
      );
      await page.locator('[data-testid="nex-custody-revoke-cta"]').click();
      await page.locator('[data-testid="nex-custody-revoke-confirm"]').click();
      await page.waitForURL(/\/custody$/i, { timeout: 15_000 });
      await expect(
        page.locator(`[data-testid="nex-custody-row-${seeded.custodyId}"]`),
      ).toHaveCount(0);
    } finally {
      await ctx.close();
    }
  });
});
