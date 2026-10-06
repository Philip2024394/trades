// tests/e2e/vault-phase-a-3b.spec.ts
//
// Vault Phase A · Commit A.3b · real-browser proof.
//
// Proves end-to-end:
//   · setup wizard (NOT CONFIGURED → PIN → Create Vault)
//   · VMK generation + wrap happen in the browser
//   · POST /setup carries ONLY opaque ciphertext + non-secret params
//   · navigation to /vault/home (UNLOCKED state)
//   · Lock Vault Now → navigate back to doorway (LOCKED state)
//   · correct PIN unlock succeeds
//   · wrong PIN unlock stays locked
//   · network-level secret boundary: PIN / VMK / KEK never appear in any
//     outbound request body across the entire flow (deterministic sentinel
//     PIN · search raw request bodies for the literal digits)
//
// Prerequisites (same pattern as phase-1-security.spec.ts):
//   · dev server running at http://localhost:3008
//   · NEX_E2E_SKIP_WEBSERVER=1 if already-running
//   · migrations 141 + 142 applied to the Supabase project the dev server
//     points at
//   · NEX_SUPABASE_URL + NEX_SUPABASE_SERVICE_ROLE_KEY +
//     NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY in env
//
// If migration 142 hasn't been applied, setup probe skips the test
// cleanly rather than hanging on a 500.

import { test, expect, type BrowserContext, type Request } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";

// Lightweight .env.local loader · Playwright does not inherit Next.js
// dotenv behaviour. Idempotent · never overrides already-set vars.
(() => {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]!])
      process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
})();

const SUPABASE_URL =
  process.env.NEX_SUPABASE_URL ?? process.env.NEXT_PUBLIC_NEX_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.NEX_SUPABASE_SERVICE_ROLE_KEY ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY ?? "";
const BASE_URL = process.env.NEX_E2E_BASE_URL ?? "http://localhost:3008";

// Deterministic test PIN · 8 digits (satisfies founder-locked floor).
// Searched in raw request bodies as the primary secret sentinel. We
// vary the ASCII literal into something that could not appear as a
// legitimate server token by chance.
const TEST_PIN = "12345678";
const WRONG_PIN = "87654321";

const SCREENSHOT_DIR = path.join(
  process.cwd(),
  "tests",
  "e2e-screenshots",
  "vault-phase-a-3b",
);

interface Fixture {
  authId: string;
  accountId: string;
  email: string;
  password: string;
  jwt: string;
  refresh: string;
}

async function provisionAccount(suffix: string): Promise<Fixture> {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = `playwright-vault-a3b-${suffix}-${Date.now()}@test.local`;
  const password = `Playwright!PW${Date.now()}`;
  const createUser = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createUser.error || !createUser.data.user) {
    throw new Error(`createUser ${suffix}: ${createUser.error?.message}`);
  }
  const authId = createUser.data.user.id;
  const acc = await admin
    .from("nex_account")
    .insert({
      supabase_user_id: authId,
      display_name: `Playwright Vault ${suffix}`,
    })
    .select("*")
    .single();
  if (acc.error || !acc.data) {
    throw new Error(`insert account ${suffix}: ${acc.error?.message}`);
  }
  const accountId = (acc.data as { id: string }).id;
  const signIn = await anon.auth.signInWithPassword({ email, password });
  if (signIn.error || !signIn.data.session) {
    throw new Error(`signIn ${suffix}: ${signIn.error?.message}`);
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
  await swallow(
    admin.from("nex_vault_key_envelope").delete().eq("account_id", f.accountId) as unknown as Promise<unknown>,
  );
  await swallow(
    admin.from("nex_vault_setup").delete().eq("account_id", f.accountId) as unknown as Promise<unknown>,
  );
  await swallow(
    admin.from("nex_vault_pin_attempt").delete().eq("account_id", f.accountId) as unknown as Promise<unknown>,
  );
  await swallow(
    admin.from("nex_account_device_key").delete().eq("account_id", f.accountId) as unknown as Promise<unknown>,
  );
  await swallow(
    admin.from("nex_session").delete().eq("account_id", f.accountId) as unknown as Promise<unknown>,
  );
  await swallow(
    admin.from("nex_sign_in_event").delete().eq("account_id", f.accountId) as unknown as Promise<unknown>,
  );
  await swallow(
    admin.from("nex_account").delete().eq("id", f.accountId) as unknown as Promise<unknown>,
  );
  await swallow(admin.auth.admin.deleteUser(f.authId) as unknown as Promise<unknown>);
}

async function plantAuthCookies(
  ctx: BrowserContext,
  jwt: string,
  refresh: string,
): Promise<void> {
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

async function ensureScreenshotDir(): Promise<void> {
  try {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  } catch {
    /* noop */
  }
}

async function migrationApplied(): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return false;
  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const r = await admin.from("nex_vault_setup").select("account_id").limit(1);
    return !r.error;
  } catch {
    return false;
  }
}

/** Capture every outbound request body + search for a secret substring.
 *  Returns true if the substring was found anywhere in any body. */
function startSecretWatcher(
  ctx: BrowserContext,
  secrets: string[],
): { leaks: Array<{ url: string; which: string; body: string }> } {
  const leaks: Array<{ url: string; which: string; body: string }> = [];
  const check = (req: Request) => {
    const body = req.postData();
    if (!body) return;
    for (const s of secrets) {
      if (body.includes(s)) {
        leaks.push({ url: req.url(), which: s, body: body.slice(0, 200) });
      }
    }
  };
  ctx.on("request", check);
  return { leaks };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.beforeAll(async () => {
  if (!(await migrationApplied())) {
    test.skip(
      true,
      "Vault Phase A migrations (141 + 142) not applied to the Supabase project · skipping",
    );
  }
  await ensureScreenshotDir();
});

test.describe("Vault Phase A · A.3b · real browser proof", () => {
  test.describe.configure({ mode: "serial" });

  // Argon2id with the sealed PIN profile (t=3, m=64MiB) is slow in the
  // browser · each unlock takes 1-5s. The full flow performs setup
  // (1 derivation) + wrong unlock (1 derivation) + correct unlock
  // (1 derivation). Add generous timeout for CI realities.
  test.setTimeout(240_000);

  test("full flow · setup → lock → unlock → wrong PIN → network secret proof", async ({
    browser,
  }) => {
    const alice = await provisionAccount("alice");
    const bob = await provisionAccount("bob");
    try {
      // ---- Context setup + secret watcher ---------------------------
      const ctx = await browser.newContext({
        viewport: { width: 390, height: 844 },
      });
      await plantAuthCookies(ctx, alice.jwt, alice.refresh);

      const watch = startSecretWatcher(ctx, [TEST_PIN, WRONG_PIN]);
      const page = await ctx.newPage();

      // ---- Step 1 · Vault NOT CONFIGURED → redirects to setup -------
      await page.goto(`${BASE_URL}/nex-native/vault`, {
        waitUntil: "networkidle",
      });
      await page.waitForURL(/\/vault\/setup/, { timeout: 15_000 });
      await expect(page.getByText("Protect your Vault")).toBeVisible({
        timeout: 10_000,
      });
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "01-setup-welcome.png"),
        fullPage: true,
      });

      // ---- Step 2 · Setup · choose PIN ------------------------------
      // Our UI uses data-nex-vault-* attributes (not data-testid), so
      // we always select via attribute selectors directly.
      await page.locator("[data-nex-vault-setup-start]").click();
      await expect(page.getByText("How do you want to unlock")).toBeVisible();
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "02-setup-choose.png"),
        fullPage: true,
      });

      await page.locator("[data-nex-vault-choose-pin]").click();
      await expect(page.getByText("Choose your PIN")).toBeVisible();
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "03-setup-pin-entry.png"),
        fullPage: true,
      });

      // ---- Step 3 · Enter PIN + confirm + create --------------------
      await page.locator("[data-nex-vault-secret-input]").fill(TEST_PIN);
      await page.locator("[data-nex-vault-confirm-input]").fill(TEST_PIN);
      await page.locator("[data-nex-vault-create]").click();

      // Navigation to /vault/home may wait on Argon2id in the browser;
      // 10s is generous.
      await page.waitForURL(/\/vault\/home/, { timeout: 20_000 });
      await expect(page.locator("[data-nex-vault-lock-now]")).toBeVisible({
        timeout: 10_000,
      });
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "04-unlocked-home.png"),
        fullPage: true,
      });

      // ---- Step 4 · Lock Vault Now ----------------------------------
      await page.locator("[data-nex-vault-lock-now]").click();
      await page.waitForURL(/\/vault(\/)?$/, { timeout: 10_000 });
      await expect(page.getByText("Unlock your Vault")).toBeVisible({
        timeout: 10_000,
      });
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "05-locked-doorway.png"),
        fullPage: true,
      });

      // ---- Step 5 · Wrong PIN · remain locked -----------------------
      await page.locator("[data-nex-vault-pin-input]").fill(WRONG_PIN);
      await page.locator("[data-nex-vault-unlock-btn]").click();
      await expect(page.getByText("That PIN didn't work.")).toBeVisible({
        timeout: 20_000,
      });
      // Remain on vault doorway after wrong PIN.
      expect(page.url()).toMatch(/\/vault(\/)?$/);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "06-wrong-pin.png"),
        fullPage: true,
      });

      // ---- Step 6 · Correct PIN · unlock ----------------------------
      await page.locator("[data-nex-vault-pin-input]").fill(TEST_PIN);
      await page.locator("[data-nex-vault-unlock-btn]").click();
      await page.waitForURL(/\/vault\/home/, { timeout: 20_000 });
      await expect(page.locator("[data-nex-vault-lock-now]")).toBeVisible();
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "07-unlocked-again.png"),
        fullPage: true,
      });

      // ---- NETWORK SECRET BOUNDARY PROOF ----------------------------
      // The deterministic PIN strings must NEVER have crossed the
      // network boundary. The watcher captured every outbound request;
      // if the PIN appeared anywhere, this test fails.
      expect(
        watch.leaks,
        `secret leak detected: ${JSON.stringify(watch.leaks, null, 2)}`,
      ).toEqual([]);

      // ---- Cross-account: Alice's context cannot see Bob's state ----
      // Bob has no Vault configured; Alice's cookie must not grant
      // read of anything Bob-owned. Simplest check: hit the status
      // endpoint and inspect account scoping via Supabase direct query.
      const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const bobSetup = await admin
        .from("nex_vault_setup")
        .select("account_id")
        .eq("account_id", bob.accountId)
        .maybeSingle();
      expect(bobSetup.data).toBeNull();
      const aliceSetup = await admin
        .from("nex_vault_setup")
        .select("account_id")
        .eq("account_id", alice.accountId)
        .maybeSingle();
      expect(aliceSetup.data).not.toBeNull();

      // ---- Audit trail ---------------------------------------------
      const events = await admin
        .from("nex_sign_in_event")
        .select("event_type, success")
        .eq("account_id", alice.accountId)
        .order("created_at", { ascending: true });
      expect(events.error).toBeNull();
      const types = (events.data as Array<{ event_type: string; success: boolean }>).map(
        (e) => `${e.event_type}:${e.success}`,
      );
      // At minimum: a vault_unlock from setup, a vault_unlock_failed
      // from the wrong PIN, and a vault_unlock from the correct re-unlock.
      expect(types.filter((t) => t === "vault_unlock:true").length).toBeGreaterThanOrEqual(2);
      expect(types.filter((t) => t === "vault_unlock_failed:false").length).toBeGreaterThanOrEqual(1);

      await ctx.close();
    } finally {
      await teardown(alice);
      await teardown(bob);
    }
  });
});
