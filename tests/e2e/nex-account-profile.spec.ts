// tests/e2e/nex-account-profile.spec.ts
//
// Bridge 2 · kind step → profile edit → reload.
// -------------------------------------------------------------------------
// Provisions a real account via admin API (Supabase Auth signup validator
// blocks common test domains, so we provision server-side then sign in
// through the real UI form). Once signed in, drives the REAL Bridge 2
// routes:
//   /nex-native/create-account/kind        · setProfileKindAction
//   /nex-native/settings/profile           · updateProfileAction
// Asserts real nex_account_profile rows via admin client and verifies
// values survive page reload.

import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";

function loadEnv(): void {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    if (!process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
}
loadEnv();

const url = process.env.NEX_SUPABASE_URL ?? process.env.NEXT_PUBLIC_NEX_SUPABASE_URL!;
const svc = process.env.NEX_SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(url, svc, { auth: { persistSession: false, autoRefreshToken: false } });

const SCREENSHOT_DIR = path.join(process.cwd(), "tests", "e2e-screenshots", "account-profile");
try { fs.mkdirSync(SCREENSHOT_DIR, { recursive: true }); } catch { /* noop */ }
const shot = (n: string) => path.join(SCREENSHOT_DIR, n);

test.describe("NEX Bridge 2 · account profile foundation", () => {
  test.setTimeout(180_000);

  test("375×812 · sign in → kind step → profile edit → reload persists", async ({ browser }) => {
    const suffix = "b2" + Math.floor(Math.random() * 1_000_000).toString().padStart(6, "0");
    const email = `profile-e2e-${suffix}@nex-native.local`;
    const password = "ProfileE2E!2026";
    const displayName = `Profile E2E ${suffix}`;

    // Provision via admin API (accepts .local)
    const cu = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    });
    if (cu.error || !cu.data.user) throw new Error(`createUser: ${cu.error?.message}`);
    const authId = cu.data.user.id;
    const acc = await admin
      .from("nex_account")
      .insert({ supabase_user_id: authId, display_name: displayName })
      .select("id")
      .single();
    if (acc.error) throw new Error(`nex_account insert: ${acc.error.message}`);
    const accountId = (acc.data as { id: string }).id;

    try {
      const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
      const base = new URL(process.env.NEX_E2E_BASE_URL ?? "http://localhost:3008");
      await ctx.addCookies([{
        name: "xrated_cookie_consent",
        value: "all",
        domain: base.hostname,
        path: "/",
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
      }]);
      const p = await ctx.newPage();
      p.on("console", (msg) => console.log(`[BROWSER ${msg.type()}]`, msg.text()));
      p.on("pageerror", (err) => console.log(`[BROWSER pageerror]`, err.message));

      // 1 · Sign in via the real UI form on /nex-native/conversations.
      // The page also renders a sign-up form inside <details> — scope to the
      // first visible sign-in form only.
      await p.goto("/nex-native/conversations", { waitUntil: "networkidle" });
      const signInForm = p.locator("form").first();
      await expect(signInForm.locator('input[name="email"]')).toBeVisible();
      await signInForm.locator('input[name="email"]').fill(email);
      await signInForm.locator('input[name="password"]').fill(password);
      await p.screenshot({ path: shot("01-sign-in-form.png"), fullPage: true });
      await Promise.all([
        p.waitForURL("**/nex-native/conversations**", { timeout: 30_000 }),
        signInForm.locator('button[type="submit"]').click(),
      ]);
      // Confirm we're signed in (page shows the signed-in header)
      await expect(p.getByText(/Signed in as/i)).toBeVisible({ timeout: 10_000 });

      // 2 · Fresh account has no profile row yet
      const empty = await admin.from("nex_account_profile").select("*").eq("account_id", accountId).maybeSingle();
      expect(empty.data).toBeNull();

      // 3 · Navigate to the kind step directly
      await p.goto("/nex-native/create-account/kind", { waitUntil: "networkidle" });
      await p.screenshot({ path: shot("02-kind-step.png"), fullPage: true });
      await expect(p.getByRole("heading", { name: /What best describes what you do/i })).toBeVisible();

      const proOption = p.locator('[data-nex-kind-option="professional"]');
      const bizOption = p.locator('[data-nex-kind-option="business_owner"]');
      const otherOption = p.locator('[data-nex-kind-option="other"]');
      await expect(proOption).toBeVisible();
      await expect(bizOption).toBeVisible();
      await expect(otherOption).toBeVisible();

      // 4 · Pick "professional" and submit
      await proOption.locator('input[type="radio"]').check();
      await Promise.all([
        p.waitForURL("**/nex-native/conversations**", { timeout: 30_000 }),
        p.locator('[data-nex-kind-submit]').click(),
      ]);
      await p.screenshot({ path: shot("03-post-kind.png"), fullPage: true });

      // 5 · DB proof: profile row created with kind=professional
      const prof1 = await admin.from("nex_account_profile").select("*").eq("account_id", accountId).single();
      expect(prof1.error, `Profile row missing: ${prof1.error?.message}`).toBeNull();
      expect((prof1.data as { kind: string }).kind).toBe("professional");

      // 6 · Open the profile editor
      await p.goto("/nex-native/settings/profile", { waitUntil: "networkidle" });
      await p.screenshot({ path: shot("04-profile-editor-empty.png"), fullPage: true });
      await expect(p.getByRole("heading", { name: "Your NEX profile" })).toBeVisible();
      // Kind radio for "professional" pre-checked from the previous step
      const kindProRadio = p.locator('[data-nex-profile-kind-option="professional"] input[type="radio"]');
      await expect(kindProRadio).toBeChecked();

      // 7 · Fill fields
      const desiredHeadline = `Footwear designer · ${suffix} · Bandung`;
      const desiredProfession = "footwear designer";
      const desiredSkills = "sample-making, CAD, sourcing";
      const desiredLocation = "Bandung, Indonesia";
      const desiredBio = "12 years building running shoes for small brands.";
      const desiredLookingFor = "clients, collaborators";
      await p.locator('[data-nex-profile-input="profession"]').fill(desiredProfession);
      await p.locator('[data-nex-profile-input="headline"]').fill(desiredHeadline);
      await p.locator('[data-nex-profile-input="bio"]').fill(desiredBio);
      await p.locator('[data-nex-profile-input="skills"]').fill(desiredSkills);
      await p.locator('[data-nex-profile-input="location_label"]').fill(desiredLocation);
      await p.locator('[data-nex-profile-input="looking_for"]').fill(desiredLookingFor);
      await p.screenshot({ path: shot("05-profile-filled.png"), fullPage: true });

      // 8 · Save
      await Promise.all([
        p.waitForURL("**/nex-native/settings/profile**", { timeout: 15_000 }),
        p.locator('form[data-nex-profile-form] button[type="submit"]').click(),
      ]);
      const savedBanner = p.locator('[data-nex-profile-banner="profile_saved"]');
      await expect(savedBanner).toBeVisible({ timeout: 10_000 });
      await p.screenshot({ path: shot("06-profile-saved.png"), fullPage: true });

      // 9 · DB proof: values persisted
      const prof2 = await admin.from("nex_account_profile").select("*").eq("account_id", accountId).single();
      expect(prof2.error).toBeNull();
      const row = prof2.data as {
        kind: string;
        headline: string;
        bio: string;
        profession: string;
        skills: string[];
        location_label: string;
        looking_for: string[];
        is_public: boolean;
      };
      expect(row.kind).toBe("professional");
      expect(row.headline).toBe(desiredHeadline);
      expect(row.profession).toBe(desiredProfession);
      expect(row.bio).toBe(desiredBio);
      expect(row.location_label).toBe(desiredLocation);
      expect(row.skills).toEqual(["sample-making", "CAD", "sourcing"]);
      expect(row.looking_for).toEqual(["clients", "collaborators"]);
      expect(row.is_public).toBe(true);

      // 10 · Reload · values render from the DB
      await p.reload({ waitUntil: "networkidle" });
      await p.screenshot({ path: shot("07-profile-reload.png"), fullPage: true });
      await expect(p.locator('[data-nex-profile-input="headline"]')).toHaveValue(desiredHeadline);
      await expect(p.locator('[data-nex-profile-input="profession"]')).toHaveValue(desiredProfession);
      await expect(p.locator('[data-nex-profile-input="skills"]')).toHaveValue("sample-making, CAD, sourcing");
      await expect(p.locator('[data-nex-profile-input="location_label"]')).toHaveValue(desiredLocation);
      const kindProRadioReload = p.locator('[data-nex-profile-kind-option="professional"] input[type="radio"]');
      await expect(kindProRadioReload).toBeChecked();

      await ctx.close();
    } finally {
      await admin.from("nex_account_profile").delete().eq("account_id", accountId).then(() => {}, () => {});
      await admin.from("nex_account").delete().eq("id", accountId).then(() => {}, () => {});
      await admin.auth.admin.deleteUser(authId).then(() => {}, () => {});
    }
  });
});
