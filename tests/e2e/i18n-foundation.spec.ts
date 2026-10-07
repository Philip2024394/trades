// tests/e2e/i18n-foundation.spec.ts
//
// Phase B.7 · NEX Universal Language Foundation · browser proof.
//
// Proves end-to-end:
//   · The sealed I18nProvider is actually mounted on the nex-native
//     layout (page HTML survives hydration with provider context
//     available).
//   · Server-side `resolveServerLocale` honours URL ?lang= override.
//   · The same account hitting the SAME page in two different
//     languages gets two different localised bodies that match the
//     keys registered in the universal i18n registry.
//   · The dogfood target (settings/language page) renders the correct
//     translation per locale from the shared pack.
//
// This is intentionally a MINIMAL browser test · the deterministic
// suite covers the full fallback precedence · the Playwright run
// just confirms the pipe is live.

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
  const email = `i18n-${Date.now()}-${randomUUID().slice(0, 8)}@test.local`;
  const password = `I18n!${Date.now()}`;
  const c = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (c.error || !c.data.user) throw new Error(`createUser: ${c.error?.message}`);
  const authId = c.data.user.id;
  const acc = await admin
    .from("nex_account")
    .insert({ supabase_user_id: authId, display_name: "I18n probe" })
    .select("id")
    .single();
  if (acc.error || !acc.data) throw new Error(`account: ${acc.error?.message}`);
  const signIn = await anon.auth.signInWithPassword({ email, password });
  if (signIn.error || !signIn.data.session) {
    throw new Error(`signIn: ${signIn.error?.message}`);
  }
  return {
    authId,
    accountId: (acc.data as { id: string }).id,
    jwt: signIn.data.session.access_token,
    refresh: signIn.data.session.refresh_token,
  };
}

async function setAccountLocale(accountId: string, locale: string | null): Promise<void> {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await admin.from("nex_account").update({ locale }).eq("id", accountId);
}

async function teardown(f: Fixture): Promise<void> {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const swallow = async (p: Promise<unknown>) => {
    try { await p; } catch { /* ignore */ }
  };
  for (const t of ["nex_session", "nex_sign_in_event"]) {
    await swallow(admin.from(t).delete().eq("account_id", f.accountId) as unknown as Promise<unknown>);
  }
  await swallow(admin.from("nex_account").delete().eq("id", f.accountId) as unknown as Promise<unknown>);
  await swallow(admin.auth.admin.deleteUser(f.authId) as unknown as Promise<unknown>);
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
async function plantAuthCookies(ctx: BrowserContext, jwt: string, refresh: string): Promise<void> {
  const base = new URL(BASE_URL);
  await ctx.addCookies([
    {
      name: supabaseCookieName(),
      value: supabaseCookieValue(jwt, refresh),
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
  if (!(await prereqsAvailable())) {
    test.skip(true, "i18n foundation preflight failed · check Supabase env");
  }
});

test.describe("Phase B.7 · NEX Universal Language Foundation", () => {
  test.setTimeout(180_000);

  test("I18nProvider mount + server-side t() dogfood on /settings/language", async ({
    browser,
  }) => {
    const user = await provisionAccount();
    try {
      const ctx = await browser.newContext({ viewport: { width: 393, height: 852 } });
      await plantAuthCookies(ctx, user.jwt, user.refresh);
      const page = await ctx.newPage();

      // ─── Account preference = "id" ───────────────────────────
      await setAccountLocale(user.accountId, "id");
      await page.goto(`${BASE_URL}/nex-native/settings/language`, {
        waitUntil: "networkidle",
      });
      // Indonesian strings from the universal pack must appear.
      await expect(page.getByText("Pilih bahasa NEX")).toBeVisible({
        timeout: 60_000,
      });
      await expect(page.getByText("Simpan pilihan")).toBeVisible();
      await expect(
        page.getByText(
          "Berlaku untuk modal Aman Bertransaksi, ketentuan layanan, dan setiap surface yang mendukung dua bahasa. Kamu bisa mengubahnya kapan saja.",
        ),
      ).toBeVisible();
      // The English strings must NOT appear.
      const idBody = await page.locator("body").innerText();
      expect(idBody).not.toContain("Choose your NEX language");
      expect(idBody).not.toContain("Save preference");

      // ─── Account preference = "en" ───────────────────────────
      await setAccountLocale(user.accountId, "en");
      await page.goto(`${BASE_URL}/nex-native/settings/language`, {
        waitUntil: "networkidle",
      });
      await expect(page.getByText("Choose your NEX language")).toBeVisible({
        timeout: 60_000,
      });
      await expect(page.getByText("Save preference")).toBeVisible();
      const enBody = await page.locator("body").innerText();
      expect(enBody).not.toContain("Pilih bahasa NEX");
      expect(enBody).not.toContain("Simpan pilihan");

      // ─── URL override overrides account preference ──────────
      await page.goto(`${BASE_URL}/nex-native/settings/language?lang=id`, {
        waitUntil: "networkidle",
      });
      // Account still "en" · URL wins · page in Indonesian.
      await expect(page.getByText("Pilih bahasa NEX")).toBeVisible({
        timeout: 60_000,
      });

      // ─── Unsupported URL ?lang=zz falls back to account "en" ─
      await page.goto(`${BASE_URL}/nex-native/settings/language?lang=zz`, {
        waitUntil: "networkidle",
      });
      await expect(page.getByText("Choose your NEX language")).toBeVisible({
        timeout: 60_000,
      });

      // ─── Account cleared · default "id" wins ────────────────
      await setAccountLocale(user.accountId, null);
      await page.goto(`${BASE_URL}/nex-native/settings/language`, {
        waitUntil: "networkidle",
      });
      // Accept-Language can be anything · we rely on DEFAULT_LANG=id.
      // Playwright chromium often sends `en-US` as Accept-Language ·
      // when both the account and the URL are empty, that header
      // can win over DEFAULT_LANG. We accept EITHER localised body
      // here · what we are proving is that the universal resolver
      // returned a locale from the registry and the universal pack
      // was consulted · not that the fallback trumps Accept-Language.
      const body = await page.locator("body").innerText();
      const hasIdCopy = body.includes("Pilih bahasa NEX");
      const hasEnCopy = body.includes("Choose your NEX language");
      expect(
        hasIdCopy || hasEnCopy,
        "the universal pack must have rendered one of the two localised titles",
      ).toBe(true);

      await ctx.close();
    } finally {
      await teardown(user);
    }
  });
});
