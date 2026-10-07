// tests/e2e/nex-socials-chooser.spec.ts
//
// NEX Socials · chooser landing + per-intent discover · real-browser proof.
//
// Scenarios
//   1. /nex-native/nex-socials renders the four sealed tiles
//      (Business / New Friends / Dating / Night Life) + the headline
//      "Meet someone new." + sub "Choose what brings you here."
//   2. If the signed-in account has `nex_account.social_intents` =
//      ['dating', 'nightlife'], the dating + nightlife tiles carry
//      the "Your intent" chip (data-nex-socials-tile-declared=true)
//      and the business + new_friends tiles do NOT.
//   3. Clicking the Business tile navigates to
//      /nex-native/nex-socials/discover/business and the lens banner
//      names "Business lens".
//   4. The top-row chip switcher is present on the per-intent canvas
//      with all four chips + a "back to chooser" chip. Clicking the
//      Dating chip navigates to .../discover/dating.
//   5. The intent-less /nex-native/nex-socials/discover redirects to
//      the chooser landing.
//
// Load-bearing: no new DB migration · no RLS edits · no changes to the
// physics canvas. Only mock-pool filtering + chrome overlay are proven.

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
  "nex-socials-chooser",
);

interface Fixture {
  authId: string;
  accountId: string;
  jwt: string;
  refresh: string;
}

async function provisionAccount(
  intents: readonly ("business" | "new_friends" | "dating" | "nightlife")[],
): Promise<Fixture & { migration145Applied: boolean }> {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anon = createClient(SUPABASE_URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = `nxs-${Date.now()}-${randomUUID().slice(0, 8)}@test.local`;
  const password = `NxS!Pw${Date.now()}`;
  const c = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (c.error || !c.data.user) throw new Error(`createUser: ${c.error?.message}`);
  const authId = c.data.user.id;
  // Attempt with social_intents · fall back without it if migration 145
  // hasn't been applied to this environment yet. The chooser UI still
  // proves correctness · the "Your intent" highlight path only lights
  // up once the DB column exists.
  let accountId: string | null = null;
  let migration145Applied = true;
  const insertWithIntents = await admin
    .from("nex_account")
    .insert({
      supabase_user_id: authId,
      display_name: "Chooser Probe",
      social_intents: intents,
    })
    .select("id")
    .single();
  if (insertWithIntents.error) {
    migration145Applied = false;
    const insertPlain = await admin
      .from("nex_account")
      .insert({
        supabase_user_id: authId,
        display_name: "Chooser Probe",
      })
      .select("id")
      .single();
    if (insertPlain.error || !insertPlain.data) {
      throw new Error(`account: ${insertPlain.error?.message}`);
    }
    accountId = (insertPlain.data as { id: string }).id;
  } else if (insertWithIntents.data) {
    accountId = (insertWithIntents.data as { id: string }).id;
  }
  if (!accountId) throw new Error("account: no id returned");
  const signIn = await anon.auth.signInWithPassword({ email, password });
  if (signIn.error || !signIn.data.session) {
    throw new Error(`signIn: ${signIn.error?.message}`);
  }
  return {
    authId,
    accountId,
    jwt: signIn.data.session.access_token,
    refresh: signIn.data.session.refresh_token,
    migration145Applied,
  };
}

async function cleanup(f: Fixture): Promise<void> {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const swallow = async (p: Promise<unknown>) => {
    try { await p; } catch { /* ignore */ }
  };
  for (const t of ["nex_session", "nex_account_device_key", "nex_sign_in_event"]) {
    await swallow(
      admin.from(t).delete().eq("account_id", f.accountId) as unknown as Promise<unknown>,
    );
  }
  await swallow(
    admin.from("nex_account").delete().eq("id", f.accountId) as unknown as Promise<unknown>,
  );
  await swallow(
    admin.auth.admin.deleteUser(f.authId) as unknown as Promise<unknown>,
  );
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
  jwt: string,
  refresh: string,
): Promise<void> {
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

function ensureScreenshotDir() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

test.describe("NEX Socials chooser + per-intent discover", () => {
  test.skip(
    !SUPABASE_URL || !SERVICE_ROLE || !ANON,
    "Supabase env missing (NEX_SUPABASE_URL / SERVICE_ROLE / ANON).",
  );

  test("chooser landing + per-intent + chip switcher + redirect", async ({
    browser,
  }) => {
    ensureScreenshotDir();
    const fixture = await provisionAccount(["dating", "nightlife"]);
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 820 },
    });
    try {
      await plantAuthCookies(ctx, fixture.jwt, fixture.refresh);
      const page = await ctx.newPage();

      // 1. Chooser landing renders the 4 sealed tiles + headline.
      await page.goto(`${BASE_URL}/nex-native/nex-socials`, {
        waitUntil: "networkidle",
      });
      await expect(page.locator("[data-nex-socials-landing]")).toBeVisible({
        timeout: 60_000,
      });
      await expect(page.locator("[data-nex-socials-headline]")).toContainText(
        "Meet someone new.",
      );
      await expect(page.locator("[data-nex-socials-subhead]")).toContainText(
        "Choose what brings you here.",
      );
      for (const token of ["business", "new_friends", "dating", "nightlife"]) {
        await expect(
          page.locator(`[data-nex-socials-tile="${token}"]`),
        ).toBeVisible();
      }

      // 2. Signup intents highlight the right tiles only. This part
      // only runs when migration 145 has been applied to the live DB ·
      // if the column doesn't exist, the preselect feature can't be
      // exercised and we skip the assertion rather than lying.
      if (fixture.migration145Applied) {
        await expect(
          page.locator('[data-nex-socials-tile="dating"]'),
        ).toHaveAttribute("data-nex-socials-tile-declared", "true");
        await expect(
          page.locator('[data-nex-socials-tile="nightlife"]'),
        ).toHaveAttribute("data-nex-socials-tile-declared", "true");
        await expect(
          page.locator('[data-nex-socials-tile="business"]'),
        ).toHaveAttribute("data-nex-socials-tile-declared", "false");
        await expect(
          page.locator('[data-nex-socials-tile="new_friends"]'),
        ).toHaveAttribute("data-nex-socials-tile-declared", "false");
      } else {
        // Column not present · every tile reads as not-declared. We
        // still prove the attribute pipeline is wired by checking a
        // single tile has the attribute present with value "false".
        await expect(
          page.locator('[data-nex-socials-tile="dating"]'),
        ).toHaveAttribute("data-nex-socials-tile-declared", "false");
      }

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "01-landing-1280.png"),
        fullPage: true,
      });

      // 3. Clicking Business → routes to the per-intent canvas + banner names the lens.
      await page.locator('[data-nex-socials-tile="business"]').click();
      await page.waitForURL(/\/nex-native\/nex-socials\/discover\/business$/, {
        timeout: 60_000,
      });
      await expect(page.locator("[data-nex-socials-lens]")).toHaveAttribute(
        "data-nex-socials-lens-intent",
        "business",
      );
      await expect(
        page.locator("[data-nex-socials-lens-banner]"),
      ).toContainText("Business lens", { timeout: 10_000 });
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "02-business-lens-1280.png"),
        fullPage: true,
      });

      // 4. Top-row chip switcher · dating chip is NOT active, business chip IS.
      await expect(
        page.locator('[data-nex-socials-lens-chip="business"]'),
      ).toHaveAttribute("data-nex-socials-lens-chip-active", "true");
      await expect(
        page.locator('[data-nex-socials-lens-chip="dating"]'),
      ).toHaveAttribute("data-nex-socials-lens-chip-active", "false");

      // Click Dating chip · URL + banner change.
      await page.locator('[data-nex-socials-lens-chip="dating"]').click();
      await page.waitForURL(/\/nex-native\/nex-socials\/discover\/dating$/, {
        timeout: 60_000,
      });
      await expect(
        page.locator("[data-nex-socials-lens-banner]"),
      ).toContainText("Dating lens");
      await expect(
        page.locator('[data-nex-socials-lens-chip="dating"]'),
      ).toHaveAttribute("data-nex-socials-lens-chip-active", "true");
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "03-dating-lens-1280.png"),
        fullPage: true,
      });

      // Back chip returns to the chooser.
      await page.locator('[data-nex-socials-lens-back]').click();
      await page.waitForURL(/\/nex-native\/nex-socials$/, {
        timeout: 60_000,
      });
      await expect(page.locator("[data-nex-socials-landing]")).toBeVisible();

      // 5. The intent-less /discover redirects to the chooser.
      await page.goto(`${BASE_URL}/nex-native/nex-socials/discover`, {
        waitUntil: "networkidle",
      });
      await expect(page).toHaveURL(/\/nex-native\/nex-socials$/, {
        timeout: 60_000,
      });

      // Mobile viewport screenshot
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(
        `${BASE_URL}/nex-native/nex-socials/discover/nightlife`,
        { waitUntil: "networkidle" },
      );
      await expect(
        page.locator("[data-nex-socials-lens-banner]"),
      ).toContainText("Night Life lens");
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "04-nightlife-lens-375.png"),
        fullPage: true,
      });
    } finally {
      await ctx.close();
      await cleanup(fixture);
    }
  });
});
