// tests/e2e/vault-phase-a-5.spec.ts
//
// Vault Phase A · Commit A.5 · real-browser proof for recovery +
// rotation + hardening (critical happy paths).
//
// Covers (all via real browser crypto · no mocks):
//   · set up Vault (A.3b flow · known-good)
//   · set recovery passphrase (A.5 · Argon2id · server stores opaque
//     envelope · passphrase never crosses network)
//   · lock Vault
//   · unlock with correct recovery passphrase (A.5)
//   · rotate Vault keys (A.5 · current PIN + recovery passphrase +
//     fresh password step-up · server bumps vmk_generation · PIN
//     envelopes for other devices deleted · recovery envelope at new
//     generation)
//   · DB-level verification of all rotation side-effects
//   · Bob isolation (direct DB probe)
//   · network secrecy watcher (PIN · recovery passphrase · never on
//     the wire; password IS transmitted on step-up by design,
//     excluded from watcher)
//
// Wrong-passphrase + rate-limiting + Device B envelope deletion on
// rotation are EXTENSIVELY covered by the deterministic unit test
// suite (vault-recovery-rotation.test.ts · 28 tests · all passing).
// This E2E proves the end-to-end flow works in a real browser against
// the live Supabase project.
//
// Argon2id derivations in this flow: setup (PIN · m=64MiB · 1) · recovery
// setup (passphrase · m=128MiB · 1) · recovery unlock (passphrase · 1) ·
// rotate (PIN · 1 · passphrase · 2 for recovery re-wrap). Total ~5
// derivations · 15-30s each in Playwright mobile viewport · test timeout
// 900s is generous.

import {
  test,
  expect,
  type BrowserContext,
  type Request,
} from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";

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

const DEVICE_A_PIN = "12345678";
const RECOVERY_PASSPHRASE = "correct-horse-battery-staple-vault-xyz";

const SCREENSHOT_DIR = path.join(
  process.cwd(),
  "tests",
  "e2e-screenshots",
  "vault-phase-a-5",
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
  const email = `playwright-vault-a5-${suffix}-${Date.now()}@test.local`;
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
      display_name: `Playwright Vault A5 ${suffix}`,
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
    try { await p; } catch { /* ignore */ }
  };
  for (const t of [
    "nex_vault_key_envelope",
    "nex_vault_setup",
    "nex_vault_pin_attempt",
    "nex_vault_recovery_attempt",
    "nex_account_device_key",
    "nex_session",
    "nex_sign_in_event",
  ]) {
    await swallow(admin.from(t).delete().eq("account_id", f.accountId) as unknown as Promise<unknown>);
  }
  await swallow(admin.from("nex_account").delete().eq("id", f.accountId) as unknown as Promise<unknown>);
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
  try { fs.mkdirSync(SCREENSHOT_DIR, { recursive: true }); } catch {}
}

async function migrationsApplied(): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return false;
  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const a = await admin.from("nex_vault_setup").select("account_id").limit(1);
    return !a.error;
  } catch {
    return false;
  }
}

function startSecretWatcher(ctx: BrowserContext, secrets: string[]): {
  leaks: Array<{ url: string; which: string; body: string }>;
} {
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

test.beforeAll(async () => {
  if (!(await migrationsApplied())) {
    test.skip(true, "Vault Phase A migrations not applied · skipping");
  }
  await ensureScreenshotDir();
});

test.describe("Vault Phase A · A.5 · recovery + rotation (happy path)", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(900_000);

  test("setup → set recovery → lock → recovery-unlock → rotate → DB verify → Bob isolation → network secrecy", async ({
    browser,
  }) => {
    const alice = await provisionAccount("alice");
    const bob = await provisionAccount("bob");
    try {
      const ctx = await browser.newContext({
        viewport: { width: 390, height: 844 },
      });
      await plantAuthCookies(ctx, alice.jwt, alice.refresh);
      const watch = startSecretWatcher(ctx, [DEVICE_A_PIN, RECOVERY_PASSPHRASE]);
      const page = await ctx.newPage();

      // 1 · Setup Vault with PIN (A.3b flow).
      await page.goto(`${BASE_URL}/nex-native/vault`, { waitUntil: "networkidle" });
      await page.waitForURL(/\/vault\/setup/, { timeout: 15_000 });
      await page.locator("[data-nex-vault-setup-start]").click();
      await page.locator("[data-nex-vault-choose-pin]").click();
      await page.locator("[data-nex-vault-secret-input]").fill(DEVICE_A_PIN);
      await page.locator("[data-nex-vault-confirm-input]").fill(DEVICE_A_PIN);
      await page.locator("[data-nex-vault-create]").click();
      await page.waitForURL(/\/vault\/home/, { timeout: 60_000 });
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "01-vault-unlocked.png"),
        fullPage: true,
      });

      // 2 · Set recovery passphrase (step-up + Argon2id passphrase).
      await page.locator("[data-nex-vault-settings-link]").click();
      await page.getByRole("link", { name: /Recovery passphrase/i }).click();
      await expect(
        page.locator("[data-nex-vault-recovery-pass]"),
      ).toBeVisible({ timeout: 15_000 });
      await page
        .locator("[data-nex-vault-recovery-pass]")
        .fill(RECOVERY_PASSPHRASE);
      await page
        .locator("[data-nex-vault-recovery-confirm]")
        .fill(RECOVERY_PASSPHRASE);
      await page.locator("[data-nex-vault-recovery-save]").click();
      await expect(
        page.locator("[data-nex-vault-recovery-stepup]"),
      ).toBeVisible({ timeout: 10_000 });
      await page
        .locator("[data-nex-vault-recovery-stepup-password]")
        .fill(alice.password);
      await page.locator("[data-nex-vault-recovery-stepup-confirm]").click();
      await expect(
        page.locator("[data-nex-vault-recovery-notice]"),
      ).toBeVisible({ timeout: 180_000 });
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "02-recovery-saved.png"),
        fullPage: true,
      });

      // 3 · Server-side state check: recovery envelope exists at gen=1.
      const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      {
        const envs = await admin
          .from("nex_vault_key_envelope")
          .select("kind, generation, consumed_at")
          .eq("account_id", alice.accountId)
          .eq("kind", "recovery");
        const rec = (envs.data as Array<{ generation: number; consumed_at: string | null }>).find(
          (r) => r.consumed_at === null,
        );
        expect(rec).toBeTruthy();
        expect(rec!.generation).toBe(1);
        const events = await admin
          .from("nex_sign_in_event")
          .select("event_type")
          .eq("account_id", alice.accountId);
        expect(
          (events.data as Array<{ event_type: string }>).some(
            (e) => e.event_type === "recovery_configured",
          ),
        ).toBe(true);
      }

      // 4 · Lock Vault.
      await page.goto(`${BASE_URL}/nex-native/vault/home`, {
        waitUntil: "networkidle",
      });
      await page.locator("[data-nex-vault-lock-now]").click();
      await page.waitForURL(/\/vault(\/)?$/, { timeout: 10_000 });
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "03-locked-with-recover-link.png"),
        fullPage: true,
      });

      // 5 · Correct recovery passphrase unlock.
      await page.locator("[data-nex-vault-use-recovery]").click();
      await page.waitForURL(/\/vault\/recover$/, { timeout: 10_000 });
      await page
        .locator("[data-nex-vault-recover-pass]")
        .fill(RECOVERY_PASSPHRASE);
      await page.locator("[data-nex-vault-recover-submit]").click();
      await page.waitForURL(/\/vault\/home/, { timeout: 180_000 });
      await expect(page.locator("[data-nex-vault-lock-now]")).toBeVisible({
        timeout: 10_000,
      });
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "04-recovery-unlocked.png"),
        fullPage: true,
      });

      // 6 · Rotate Vault keys.
      await page.locator("[data-nex-vault-settings-link]").click();
      await page.getByRole("link", { name: /Rotate Vault keys/i }).click();
      await expect(
        page.locator("[data-nex-vault-rotate-current]"),
      ).toBeVisible({ timeout: 15_000 });
      await page.locator("[data-nex-vault-rotate-current]").fill(DEVICE_A_PIN);
      await page
        .locator("[data-nex-vault-rotate-recovery]")
        .fill(RECOVERY_PASSPHRASE);
      await page.locator("[data-nex-vault-rotate-confirm]").click();
      await expect(
        page.locator("[data-nex-vault-rotate-stepup]"),
      ).toBeVisible({ timeout: 10_000 });
      await page
        .locator("[data-nex-vault-rotate-stepup-password]")
        .fill(alice.password);
      await page.locator("[data-nex-vault-rotate-stepup-confirm]").click();
      await expect(
        page.locator("[data-nex-vault-rotate-done]"),
      ).toBeVisible({ timeout: 240_000 });
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "05-rotate-done.png"),
        fullPage: true,
      });

      // 7 · DB side-effects after rotation.
      {
        const setup = await admin
          .from("nex_vault_setup")
          .select("vmk_generation")
          .eq("account_id", alice.accountId)
          .single();
        expect((setup.data as { vmk_generation: number }).vmk_generation).toBe(2);

        const envs = await admin
          .from("nex_vault_key_envelope")
          .select("kind, generation, consumed_at, target_device_id")
          .eq("account_id", alice.accountId);
        const rows = envs.data as Array<{
          kind: string;
          generation: number;
          consumed_at: string | null;
          target_device_id: string | null;
        }>;
        const activePin = rows.find(
          (r) => r.kind === "pin" && r.consumed_at === null,
        );
        expect(activePin).toBeTruthy();
        expect(activePin!.generation).toBe(2);
        const activeRecovery = rows.find(
          (r) => r.kind === "recovery" && r.consumed_at === null,
        );
        expect(activeRecovery).toBeTruthy();
        expect(activeRecovery!.generation).toBe(2);

        const events = await admin
          .from("nex_sign_in_event")
          .select("event_type")
          .eq("account_id", alice.accountId);
        expect(
          (events.data as Array<{ event_type: string }>).some(
            (e) => e.event_type === "vault_rotated",
          ),
        ).toBe(true);
      }

      // 8 · Bob isolation (direct DB probe).
      {
        const bobEnvs = await admin
          .from("nex_vault_key_envelope")
          .select("account_id")
          .eq("account_id", bob.accountId);
        expect(bobEnvs.data).toEqual([]);
      }

      // 9 · Network boundary.
      expect(
        watch.leaks,
        `secret leak: ${JSON.stringify(watch.leaks, null, 2)}`,
      ).toEqual([]);

      await ctx.close();
    } finally {
      await teardown(alice);
      await teardown(bob);
    }
  });
});
