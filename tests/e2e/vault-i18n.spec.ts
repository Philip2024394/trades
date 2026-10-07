// tests/e2e/vault-i18n.spec.ts
//
// Phase B.7 · P4 Vault Universal String Migration · real-browser proof.
//
// Covers id + en across the migrated Vault surfaces:
//   · Vault setup   (welcome + choose + pin steps)
//   · Vault home    (brand, hero, chats section, contacts tile)
//   · Vault settings (header + first row + honest-limits paragraph)
//   · Vault Contacts (header, search, empty state)
//
// We rely on the sealed Phase B.7 P1-P3 pipe · setting the account
// locale changes the server-resolved initial lang · the universal
// pack renders either Indonesian or English based on that choice.
// Zero Vault SECURITY behaviour exercised here · this is purely a
// string-substitution proof.

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
  "vault-i18n",
);

interface Fixture {
  authId: string;
  accountId: string;
  jwt: string;
  refresh: string;
}

async function provisionAccount(): Promise<Fixture> {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anon = createClient(SUPABASE_URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = `vault-i18n-${Date.now()}-${randomUUID().slice(0, 8)}@test.local`;
  const password = `Vi18n!${Date.now()}`;
  const c = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (c.error || !c.data.user) throw new Error(`createUser: ${c.error?.message}`);
  const authId = c.data.user.id;
  const acc = await admin
    .from("nex_account")
    .insert({ supabase_user_id: authId, display_name: "Vault i18n probe" })
    .select("id")
    .single();
  if (acc.error || !acc.data) throw new Error(`account: ${acc.error?.message}`);
  const signIn = await anon.auth.signInWithPassword({ email, password });
  if (signIn.error || !signIn.data.session) throw new Error(`signIn`);
  return {
    authId,
    accountId: (acc.data as { id: string }).id,
    jwt: signIn.data.session.access_token,
    refresh: signIn.data.session.refresh_token,
  };
}

async function setLocale(accountId: string, locale: "id" | "en"): Promise<void> {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await admin.from("nex_account").update({ locale }).eq("id", accountId);
}

async function teardown(f: Fixture): Promise<void> {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const sw = async (p: Promise<unknown>) => { try { await p; } catch {} };
  for (const t of [
    "nex_vault_entry", "nex_vault_setup", "nex_vault_pin_attempt",
    "nex_vault_key_envelope", "nex_vault_conversation_envelope",
    "nex_vault_recovery_attempt", "nex_vault_file", "nex_account_device_key",
    "nex_session", "nex_sign_in_event",
  ]) {
    await sw(admin.from(t).delete().eq("account_id", f.accountId) as unknown as Promise<unknown>);
  }
  await sw(admin.from("nex_account").delete().eq("id", f.accountId) as unknown as Promise<unknown>);
  await sw(admin.auth.admin.deleteUser(f.authId) as unknown as Promise<unknown>);
}

function supabaseCookieName(): string {
  const projectRef = SUPABASE_URL.match(/https?:\/\/([^.]+)/)?.[1] ?? "unknown";
  return `sb-${projectRef}-auth-token`;
}
function supabaseCookieValue(jwt: string, refresh: string): string {
  const payload = {
    access_token: jwt, refresh_token: refresh,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600, token_type: "bearer", user: null,
  };
  return `base64-${Buffer.from(JSON.stringify(payload)).toString("base64")}`;
}
async function plantAuthCookies(ctx: BrowserContext, jwt: string, refresh: string): Promise<void> {
  const base = new URL(BASE_URL);
  await ctx.addCookies([
    { name: supabaseCookieName(), value: supabaseCookieValue(jwt, refresh),
      domain: base.hostname, path: "/", httpOnly: true, secure: false, sameSite: "Lax" },
    { name: "xrated_cookie_consent", value: "all",
      domain: base.hostname, path: "/", httpOnly: false, secure: false, sameSite: "Lax" },
  ]);
}

async function prereqsAvailable(): Promise<boolean> {
  if (!SUPABASE_URL || !SERVICE_ROLE || !ANON) return false;
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const r = await admin.from("nex_account").select("id").limit(1);
    return !r.error;
  } catch { return false; }
}

test.beforeAll(async () => {
  if (!(await prereqsAvailable())) test.skip(true, "vault i18n preflight failed");
  try { fs.mkdirSync(SCREENSHOT_DIR, { recursive: true }); } catch {}
});

test.describe("Phase B.7 P4 · Vault surfaces render through the universal i18n pipe", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(300_000);

  test("Vault setup + home + settings + Contacts render Indonesian for locale=id and English for locale=en", async ({ browser }) => {
    const user = await provisionAccount();
    try {
      const ctx = await browser.newContext({ viewport: { width: 393, height: 852 } });
      await plantAuthCookies(ctx, user.jwt, user.refresh);
      const page = await ctx.newPage();

      // ─── id locale · Vault setup welcome ─────────────────────
      await setLocale(user.accountId, "id");
      await page.goto(`${BASE_URL}/nex-native/vault/setup`, { waitUntil: "networkidle" });
      // Indonesian welcome strings from the universal pack.
      await expect(page.getByText("Lindungi Vault kamu")).toBeVisible({ timeout: 60_000 });
      await expect(
        page.getByText(
          "Kunci Vault kamu dibuat di perangkat ini. NEX tidak dapat membaca konten Vault yang kamu lindungi.",
        ),
      ).toBeVisible();
      // Indonesian CTA when deviceId resolved.
      await expect(page.getByText(/Siapkan Vault|Menyiapkan…/)).toBeVisible();
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "01-setup-welcome-id-393.png"),
        fullPage: true,
      });

      // Enter choose step · Indonesian title.
      await page.locator("[data-nex-vault-setup-start]").click();
      await expect(page.getByText("Bagaimana kamu ingin membuka Vault?")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText("Gunakan PIN")).toBeVisible();
      await expect(page.getByText("Gunakan passphrase")).toBeVisible();
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "02-setup-choose-id-393.png"),
        fullPage: true,
      });

      // Enter pin step · title + hint + create cta all in Indonesian.
      await page.locator("[data-nex-vault-choose-pin]").click();
      await expect(page.getByText("Pilih PIN kamu")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/\d+–\d+ digit\. Pilih yang mudah diingat/)).toBeVisible();
      await expect(page.getByText("Buat Vault")).toBeVisible();
      await expect(page.getByText("Kembali")).toBeVisible();

      // Create the Vault to reach Home.
      await page.locator("[data-nex-vault-secret-input]").fill("12345678");
      await page.locator("[data-nex-vault-confirm-input]").fill("12345678");
      await page.locator("[data-nex-vault-create]").click();
      await page.waitForURL(/\/vault\/home/, { timeout: 60_000 });

      // ─── id locale · Vault Home ──────────────────────────────
      await expect(page.getByText("File penting kamu. Aman. Selalu bersama kamu.")).toBeVisible({ timeout: 15_000 });
      // Indonesian section titles.
      await expect(page.getByText(/^Obrolan$/).first()).toBeVisible();
      await expect(page.getByText(/^Kontak$/).first()).toBeVisible();
      await expect(page.getByText("Kontak kamu")).toBeVisible();
      // Hero body.
      await expect(page.getByText("Amankan dokumen, foto, dan file penting kamu.")).toBeVisible();
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "03-home-id-393.png"),
        fullPage: true,
      });

      // ─── id locale · Vault Settings ──────────────────────────
      await page.goto(`${BASE_URL}/nex-native/vault/settings`, { waitUntil: "networkidle" });
      await expect(page.getByText("Pengaturan Vault").first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText("Hanya kontrol yang sudah benar-benar siap.")).toBeVisible();
      await expect(page.getByText("Ubah tema pintu kamu")).toBeVisible();
      await expect(page.getByText("Vault seperti apa hari ini")).toBeVisible();
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "04-settings-id-393.png"),
        fullPage: true,
      });

      // ─── id locale · Vault Contacts ──────────────────────────
      await page.goto(`${BASE_URL}/nex-native/vault/home/contacts`, { waitUntil: "networkidle" });
      await expect(page.getByText("Kontak NEX kamu · ketuk untuk membuka atau memindahkan ke Vault.")).toBeVisible({ timeout: 45_000 });
      await expect(page.locator('input[placeholder="Cari kontak…"]')).toBeVisible();
      await expect(page.getByText("Belum ada kontak")).toBeVisible();
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "05-contacts-id-393.png"),
        fullPage: true,
      });

      // ─── Switch to en and verify same surfaces render English ─
      await setLocale(user.accountId, "en");
      await page.goto(`${BASE_URL}/nex-native/vault/home`, { waitUntil: "networkidle" });
      await expect(page.getByText("Your important files. Secure. Always with you.")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/^Chats$/).first()).toBeVisible();
      await expect(page.getByText(/^Contacts$/).first()).toBeVisible();
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "06-home-en-393.png"),
        fullPage: true,
      });

      await page.goto(`${BASE_URL}/nex-native/vault/settings`, { waitUntil: "networkidle" });
      await expect(page.getByText("Vault settings").first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText("Only genuinely implemented controls.")).toBeVisible();
      await expect(page.getByText("Change your door theme")).toBeVisible();
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "07-settings-en-393.png"),
        fullPage: true,
      });

      await page.goto(`${BASE_URL}/nex-native/vault/home/contacts`, { waitUntil: "networkidle" });
      await expect(page.getByText("Your NEX contacts · tap to open or move into Vault.")).toBeVisible({ timeout: 45_000 });
      await expect(page.locator('input[placeholder="Search contacts…"]')).toBeVisible();
      await expect(page.getByText("No contacts yet")).toBeVisible();
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "08-contacts-en-393.png"),
        fullPage: true,
      });

      // Desktop + 375 responsive screenshots on the English home.
      await page.goto(`${BASE_URL}/nex-native/vault/home`, { waitUntil: "networkidle" });
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "09-home-en-1280.png"),
        fullPage: true,
      });
      await page.setViewportSize({ width: 375, height: 812 });
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "10-home-en-375.png"),
        fullPage: true,
      });

      // Language persistence across reload (both resolvers agree).
      await setLocale(user.accountId, "id");
      await page.reload({ waitUntil: "networkidle" });
      await expect(page.getByText("File penting kamu. Aman. Selalu bersama kamu.")).toBeVisible({ timeout: 15_000 });

      await ctx.close();
    } finally {
      await teardown(user);
    }
  });
});
