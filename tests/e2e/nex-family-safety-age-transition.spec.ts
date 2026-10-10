// tests/e2e/nex-family-safety-age-transition.spec.ts
//
// NEX Family Safety · CC-4 end-to-end · age-transition workflow.
// ---------------------------------------------------------------
// Covers scenarios 15-19 from the CC-4 inventory:
//
//   15. Seeded custody with auto_transfer_at = now+5 days: /age-
//       transition page shows a countdown chip
//   16. Parent "Notify child to confirm handover" → audit entry
//       written (age_transfer_notified)
//   17. Child confirms /age-transition/[childAccountId]/confirm-handover
//       → atomic transition fires · parent's /custody list no longer
//       shows the child
//   18. `_age-transition-sweep.mjs --dry-run` reports what would transfer
//   19. Live sweep: a past-deadline row is transferred · audit entry
//       logged (age_transfer_completed)
//
// Honesty discipline:
//   · Every scenario depends on CC-3's age-transition-service + routes +
//     sweep script. None of those are shipped at authoring time, so each
//     is `test.fixme()` with an explicit reason.
//   · Preflight-skip if dev server is unreachable or env vars missing.
//
// Authored 2026-10-10 by CC-4.

import { expect, test, type BrowserContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

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
  "nex-family-safety-age-transition",
);

const SWEEP_SCRIPT = path.join(
  process.cwd(),
  "scripts",
  "nex-canonical",
  "_age-transition-sweep.mjs",
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
    const email = `fs-age-${Date.now()}-${randomUUID().slice(0, 8)}@test.local`;
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

async function ageTransitionRouteShipped(): Promise<boolean> {
  const expectedSrc = path.join(
    process.cwd(),
    "src",
    "app",
    "nex-native",
    "family-safety",
    "age-transition",
    "page.tsx",
  );
  if (!fs.existsSync(expectedSrc)) return false;
  const r = await fetch(`${BASE_URL}/nex-native/family-safety/age-transition`, {
    method: "GET",
    redirect: "manual",
    signal: AbortSignal.timeout(5_000),
  }).catch(() => null);
  if (!r) return false;
  return r.status !== 404;
}

function sweepScriptShipped(): boolean {
  return fs.existsSync(SWEEP_SCRIPT);
}

async function seedCustodyWithTransfer(
  parentAccountId: string,
  daysFromNow: number,
): Promise<{ custodyId: string; childAccountId: string } | null> {
  if (!SUPABASE_URL || !SERVICE_ROLE) return null;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const authCreate = await admin.auth.admin.createUser({
    email: `fs-age-child-${Date.now()}-${randomUUID().slice(0, 6)}@test.local`,
    password: `Child!Pw${Date.now()}`,
    email_confirm: true,
  });
  if (authCreate.error || !authCreate.data.user) return null;
  const childAcc = await admin
    .from("nex_account")
    .insert({
      supabase_user_id: authCreate.data.user.id,
      display_name: "Age-Transition Child",
    })
    .select("id")
    .single();
  if (childAcc.error || !childAcc.data) return null;
  const childAccountId = (childAcc.data as { id: string }).id;
  const transferAt = new Date();
  transferAt.setDate(transferAt.getDate() + daysFromNow);
  const custodyIns = await admin
    .schema("nex")
    .from("parent_custody_link")
    .insert({
      parent_account_id: parentAccountId,
      child_account_id: childAccountId,
      link_type: "created_minor",
      auto_transfer_at: transferAt.toISOString(),
      simulated: true,
    })
    .select("custody_id")
    .single();
  if (custodyIns.error || !custodyIns.data) return null;
  const custodyId = (custodyIns.data as { custody_id: string }).custody_id;
  await admin
    .schema("nex")
    .from("account_minor_profile")
    .upsert({
      account_id: childAccountId,
      is_minor: true,
      parent_custody_id: custodyId,
      auto_transfer_at: transferAt.toISOString(),
      safechat_always_on: true,
      simulated: true,
    });
  return { custodyId, childAccountId };
}

let parent: Fixture | null = null;
let fixtureAttempted = false;
let ageTransitionShipped = false;
let futureSeed: { custodyId: string; childAccountId: string } | null = null;
let pastSeed: { custodyId: string; childAccountId: string } | null = null;

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
    parent = await provisionAccount("CC Age-Transition Parent");
    if (!parent) {
      throw new Error("fixture provisioning failed");
    }
    futureSeed = await seedCustodyWithTransfer(parent.accountId, 5);
    pastSeed = await seedCustodyWithTransfer(parent.accountId, -1);
  }
  ageTransitionShipped = await ageTransitionRouteShipped();
});

test.describe("Family Safety · age-transition", () => {
  test.setTimeout(90_000);

  test("S15 · /age-transition shows countdown chip for seeded future-transfer custody", async ({
    browser,
  }) => {
    test.fixme(
      !ageTransitionShipped,
      "CC-3 /nex-native/family-safety/age-transition route not shipped",
    );
    test.fixme(!futureSeed, "seed failed · migrations may not be applied");
    if (!parent || !futureSeed) return;
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 } });
    await plantAuthCookies(ctx, parent.jwt, parent.refresh);
    const page = await ctx.newPage();
    try {
      await page.goto(`${BASE_URL}/nex-native/family-safety/age-transition`, {
        waitUntil: "domcontentloaded",
      });
      const chip = page.locator(
        `[data-testid="nex-age-transition-countdown-${futureSeed.custodyId}"]`,
      );
      await expect(chip).toBeVisible({ timeout: 15_000 });
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "s15-countdown.png"),
        fullPage: true,
      });
    } finally {
      await ctx.close();
    }
  });

  test("S16 · parent clicks 'Notify child to confirm handover' → audit entry written", async ({
    browser,
  }) => {
    test.fixme(!ageTransitionShipped, "age-transition route not shipped");
    test.fixme(!futureSeed, "seed failed");
    if (!parent || !futureSeed) return;
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 } });
    await plantAuthCookies(ctx, parent.jwt, parent.refresh);
    const page = await ctx.newPage();
    try {
      await page.goto(`${BASE_URL}/nex-native/family-safety/age-transition`, {
        waitUntil: "domcontentloaded",
      });
      await page
        .locator(
          `[data-testid="nex-age-transition-notify-${futureSeed.custodyId}"]`,
        )
        .click();
      // Verify audit row via service role.
      if (!SUPABASE_URL || !SERVICE_ROLE) return;
      const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      // Allow a short settle window.
      await page.waitForTimeout(1_000);
      const r = await admin
        .schema("nex")
        .from("parent_custody_audit_log")
        .select("action")
        .eq("custody_id", futureSeed.custodyId)
        .eq("action", "age_transfer_notified")
        .limit(1);
      expect(r.data?.length ?? 0).toBeGreaterThan(0);
    } finally {
      await ctx.close();
    }
  });

  test("S17 · child confirm-handover route atomically transitions custody", async ({
    browser,
  }) => {
    test.fixme(
      !ageTransitionShipped,
      "CC-3 confirm-handover route not shipped",
    );
    test.fixme(!futureSeed, "seed failed");
    if (!parent || !futureSeed || !SUPABASE_URL || !SERVICE_ROLE) return;
    // We don't have a real child Supabase session; CC-3's route must
    // accept a server-side session for the child account. Provision one.
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const anon = createClient(SUPABASE_URL, ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    // Build a child auth seat we can sign in with.
    const email = `fs-age-child-login-${Date.now()}@test.local`;
    const password = `Child!Pw${Date.now()}`;
    const u = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (u.error || !u.data.user) return;
    // Attach that user to the already-seeded child account by swapping
    // supabase_user_id.
    await admin
      .from("nex_account")
      .update({ supabase_user_id: u.data.user.id })
      .eq("id", futureSeed.childAccountId);
    const signIn = await anon.auth.signInWithPassword({ email, password });
    if (signIn.error || !signIn.data.session) return;

    const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 } });
    await plantAuthCookies(
      ctx,
      signIn.data.session.access_token,
      signIn.data.session.refresh_token,
    );
    const page = await ctx.newPage();
    try {
      await page.goto(
        `${BASE_URL}/nex-native/family-safety/age-transition/${futureSeed.childAccountId}/confirm-handover`,
        { waitUntil: "domcontentloaded" },
      );
      await page
        .locator('[data-testid="nex-age-transition-confirm-handover"]')
        .click();
      await page.waitForTimeout(1_000);
      // Verify DB side-effect: parent_custody_link.transferred_at NOT NULL.
      const r = await admin
        .schema("nex")
        .from("parent_custody_link")
        .select("transferred_at")
        .eq("custody_id", futureSeed.custodyId)
        .maybeSingle();
      expect(
        (r.data as { transferred_at: string | null } | null)?.transferred_at,
        "transferred_at should be populated after confirm-handover",
      ).toBeTruthy();
    } finally {
      await ctx.close();
    }
  });

  test("S18 · _age-transition-sweep.mjs --dry-run reports past-deadline row without transferring", async () => {
    test.fixme(
      !sweepScriptShipped(),
      "CC-3 scripts/nex-canonical/_age-transition-sweep.mjs not shipped",
    );
    test.fixme(!pastSeed, "seed failed");
    const r = spawnSync(
      process.execPath,
      [SWEEP_SCRIPT, "--dry-run"],
      { encoding: "utf8", shell: process.platform === "win32" },
    );
    const out = (r.stdout ?? "") + (r.stderr ?? "");
    expect(r.status, "sweep must exit 0 on dry-run").toBe(0);
    // Dry-run must mention 'would transfer' AND NOT 'transferred'.
    expect(out).toMatch(/would transfer|dry-run/i);
    expect(out).not.toMatch(/^transferred\s+\d+/m);
    if (!SUPABASE_URL || !SERVICE_ROLE || !pastSeed) return;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const row = await admin
      .schema("nex")
      .from("parent_custody_link")
      .select("transferred_at")
      .eq("custody_id", pastSeed.custodyId)
      .maybeSingle();
    expect(
      (row.data as { transferred_at: string | null } | null)?.transferred_at,
      "dry-run must NOT have transferred the past-deadline row",
    ).toBeNull();
  });

  test("S19 · live sweep transfers past-deadline row + writes audit", async () => {
    test.fixme(
      !sweepScriptShipped(),
      "CC-3 _age-transition-sweep.mjs not shipped",
    );
    test.fixme(!pastSeed, "seed failed");
    const r = spawnSync(
      process.execPath,
      [SWEEP_SCRIPT, "--live"],
      { encoding: "utf8", shell: process.platform === "win32" },
    );
    const out = (r.stdout ?? "") + (r.stderr ?? "");
    expect(r.status, "sweep must exit 0 on live run").toBe(0);
    expect(out).toMatch(/transferred|completed/i);
    if (!SUPABASE_URL || !SERVICE_ROLE || !pastSeed) return;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const row = await admin
      .schema("nex")
      .from("parent_custody_link")
      .select("transferred_at")
      .eq("custody_id", pastSeed.custodyId)
      .maybeSingle();
    expect(
      (row.data as { transferred_at: string | null } | null)?.transferred_at,
      "live sweep should populate transferred_at",
    ).toBeTruthy();
    const audit = await admin
      .schema("nex")
      .from("parent_custody_audit_log")
      .select("action")
      .eq("custody_id", pastSeed.custodyId)
      .eq("action", "age_transfer_completed")
      .limit(1);
    expect(audit.data?.length ?? 0).toBeGreaterThan(0);
  });
});
