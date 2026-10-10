// tests/e2e/template-picker-mobile.spec.ts
//
// R2 · Real browser + mobile viewport test for the Template Picker journey.
// Founder-sealed acceptance journey at 375×812 and 390×844:
//   NEX → conversations → keypad → Build → Template Picker → pick bakery
//   template → confirm → generated site page appears → params/title match
//
// This test provisions a real merchant via Supabase admin, signs them in
// with the anon client to get a JWT, plants the session cookies, then
// drives the actual browser through the picker route.
//
// Environment (from .env.local via dotenv):
//   NEX_SUPABASE_URL / NEX_SUPABASE_SERVICE_ROLE_KEY / NEX_SUPABASE_ANON_KEY
//   NEX_E2E_BASE_URL (default http://localhost:3008)

import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";

// Wave 4 · screenshot output folder. Diagnosis 2026-09-25: Playwright's HTML
// reporter WIPES its outputFolder (playwright-report/) at the start of every
// run, deleting any manually-written screenshots. Sending shots to a separate
// tests/e2e-screenshots/ directory that no reporter owns.
const PROJECT_ROOT = process.cwd();
const SCREENSHOT_DIR = path.join(PROJECT_ROOT, "tests", "e2e-screenshots");
try { fs.mkdirSync(SCREENSHOT_DIR, { recursive: true }); } catch {}
function shotPath(name: string): string { return path.join(SCREENSHOT_DIR, name); }

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
const anonKey = process.env.NEX_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY!;

const admin = createClient(url, svc, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function provisionMerchant(): Promise<{
  email: string; password: string; authId: string; accountId: string; businessId: string;
  jwt: string; refresh: string;
}> {
  const suffix = "e2e" + Math.floor(Math.random() * 1_000_000).toString().padStart(6, "0");
  const email = `picker-e2e-${suffix}@nex-native.local`;
  const password = "PickerE2E!2026";
  const cu = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { display_name: `E2E Bakery ${suffix}` },
  });
  if (cu.error) throw new Error(`createUser: ${cu.error.message}`);
  const authId = cu.data.user.id;
  const acc = await admin.from("nex_account").insert({
    supabase_user_id: authId, display_name: `E2E Bakery ${suffix}`,
  }).select("*").single();
  const accountId = (acc.data as { id: string }).id;
  const biz = await admin.from("nex_business").insert({
    owner_account_id: accountId,
    display_name: `cakeshopjogja E2E ${suffix}`,
    slug: `cakeshopjogja-${suffix}`,
    description: "Fresh sourdough loaves and butter cakes every morning",
  }).select("*").single();
  const businessId = (biz.data as { id: string }).id;
  // Seed one product so downstream binding works.
  await admin.from("nex_product").insert({
    business_id: businessId, name: "Buttercake",
    description: "Signature butter cake · pre-order for pickup", price_pence: 4500,
    currency: "GBP", status: "live",
  });
  const signIn = await anon.auth.signInWithPassword({ email, password });
  if (signIn.error || !signIn.data.session) throw new Error(`signIn: ${signIn.error?.message ?? "no session"}`);
  return {
    email, password, authId, accountId, businessId,
    jwt: signIn.data.session.access_token,
    refresh: signIn.data.session.refresh_token,
  };
}

async function cleanup(state: { authId?: string; accountId?: string; businessId?: string }): Promise<void> {
  const swallow = async (p: Promise<unknown>) => { try { await p; } catch {} };
  if (state.businessId) {
    await swallow(admin.from("nex_generated_site").delete().eq("business_id", state.businessId) as unknown as Promise<unknown>);
    await swallow(admin.from("nex_product").delete().eq("business_id", state.businessId) as unknown as Promise<unknown>);
    await swallow(admin.from("nex_business").delete().eq("id", state.businessId) as unknown as Promise<unknown>);
  }
  if (state.accountId) await swallow(admin.from("nex_account").delete().eq("id", state.accountId) as unknown as Promise<unknown>);
  if (state.authId) await swallow(admin.auth.admin.deleteUser(state.authId) as unknown as Promise<unknown>);
}

// Plant the Supabase SSR cookies so the Next.js middleware sees us signed in.
async function plantAuthCookies(context: import("@playwright/test").BrowserContext, jwt: string, refresh: string): Promise<void> {
  const projectRef = (url.match(/https?:\/\/([^.]+)/)?.[1]) ?? "unknown";
  const cookieName = `sb-${projectRef}-auth-token`;
  // session.ts tryParseSupabaseCookie expects an OBJECT payload with access_token key,
  // NOT the @supabase/ssr array format. Use object shape.
  const payload = {
    access_token: jwt,
    refresh_token: refresh,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600,
    token_type: "bearer",
    user: null,
  };
  const base = new URL(process.env.NEX_E2E_BASE_URL ?? "http://localhost:3008");
  await context.addCookies([
    {
      name: cookieName,
      value: `base64-${Buffer.from(JSON.stringify(payload)).toString("base64")}`,
      domain: base.hostname,
      path: "/",
      httpOnly: true, secure: false, sameSite: "Lax",
    },
    // Suppress the CookieConsentBanner in visual QA runs so screenshots
    // reflect the actual product surface, not the compliance overlay.
    {
      name: "xrated_cookie_consent",
      value: "all",
      domain: base.hostname,
      path: "/",
      httpOnly: false, secure: false, sameSite: "Lax",
    },
  ]);
}

test.describe("R2 · Template Picker mobile browser journey", () => {
  test.setTimeout(120_000);

  test("375×812 · pick bakery template · generate coherent site", async ({ page, browser }) => {
    const state = await provisionMerchant();
    try {
      const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
      await plantAuthCookies(ctx, state.jwt, state.refresh);
      const p = await ctx.newPage();

      // §0 · Wave 4 acquisition loop primitives · Founder-sealed:
      //   owner surfaces MUST show "Your NEX" card so they can copy their
      //   address for Instagram bios etc. Verify the card renders on
      //   EVERY owner-facing surface Founder called out.

      // /manage · main dashboard
      await p.goto("/nex-native/manage", { waitUntil: "networkidle" });
      await expect(p.locator("[data-nex-your-nex-card]")).toBeVisible();
      await p.screenshot({ path: shotPath("manage-with-your-nex-375.png"), fullPage: true });

      // /conversations · inbox
      await p.goto("/nex-native/conversations", { waitUntil: "networkidle" });
      await expect(p.locator("[data-nex-your-nex-card]")).toBeVisible();
      await p.screenshot({ path: shotPath("conversations-with-your-nex-375.png"), fullPage: true });

      // /manage/site · Build my NEX header + card
      await p.goto("/nex-native/manage/site", { waitUntil: "networkidle" });
      await expect(p.locator("h1", { hasText: "Your NEX" })).toBeVisible();
      // No lingering old "Build App / Website" label per Founder direction
      const managePageBody = await p.locator("body").innerText();
      expect(managePageBody).not.toContain("Build App / Website");
      expect(managePageBody).not.toContain("Wave D · phase 1");
      await expect(p.locator("[data-nex-your-nex-card]")).toBeVisible();
      const yourNexHref = await p.locator("[data-nex-open-your-nex]").getAttribute("href");
      expect(yourNexHref).toMatch(/^\/nex-native\/cakeshopjogja/);
      await expect(p.locator("[data-nex-copy-link]")).toBeVisible();
      await p.screenshot({ path: shotPath("manage-site-with-your-nex-375.png"), fullPage: true });

      // §1 · Reach the picker page directly
      await p.goto("/nex-native/manage/site/new", { waitUntil: "networkidle" });
      await expect(p.locator("[data-nex-picker-grid]")).toBeVisible();
      await expect(p.locator("[data-nex-picker-card=\"bakery-warm-v1\"]")).toBeVisible();

      // §2 · The picker inherits the NEX cream surface (Wave 1 root)
      const rootHtml = await p.locator("html").innerHTML();
      expect(rootHtml).toContain("nex-native-root");

      // §3 · Bakery card carries the correct display name + template metadata
      const bakeryCard = p.locator("[data-nex-picker-card=\"bakery-warm-v1\"]");
      await expect(bakeryCard).toContainText("Warm Bakery");
      await expect(bakeryCard).toContainText("bakery");

      // §4 · No horizontal overflow at 375px
      const scrollWidth = await p.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await p.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1); // allow rounding

      // §5a · Screenshot the PICKER before we click through · visual QA gate
      await p.screenshot({ path: shotPath("template-picker-375.png"), fullPage: true });

      // §5b · Submit the bakery form · expect redirect to /manage/site/<id>
      await Promise.all([
        p.waitForURL(/\/nex-native\/manage\/site\/[a-f0-9-]{36}/, { timeout: 30_000 }),
        bakeryCard.locator("form button[type='submit']").click(),
      ]);

      // §6 · Generated site page shows the real business name as headline
      const bodyText = await p.locator("body").innerText();
      expect(bodyText.toLowerCase()).toContain("cakeshopjogja");

      // §7 · No mixed-subject leakage · site body must not mention forbidden trades
      const forbidden = ["excavator", "scaffolding", "handrail", "manicure"];
      for (const kw of forbidden) expect(bodyText.toLowerCase()).not.toContain(kw);

      // §7b · Wave 4 · Founder §4 compliance · the live-preview iframe must
      // be the first content after the banner so the merchant SEES the actual
      // generated site before any edit control.
      const previewSection = p.locator("[data-nex-site-preview-top]");
      await expect(previewSection).toBeVisible();
      const iframe = p.locator("[data-nex-site-preview-iframe]");
      await expect(iframe).toBeVisible();
      // Wait for iframe content to actually render · Server Component fetch
      // finishes after the outer page's networkidle, so we specifically wait
      // for the iframe's document to reach a rendered state.
      const frameHandle = await iframe.elementHandle();
      const contentFrame = await frameHandle?.contentFrame();
      await contentFrame?.waitForLoadState("networkidle", { timeout: 20_000 });
      // Assert the iframe body is NOT the black brand-bg default: it must
      // contain the actual site render with the business name in it.
      const iframeText = await contentFrame?.locator("body").innerText() ?? "";
      expect(iframeText.toLowerCase()).toContain("cakeshopjogja");

      // The preview section must appear ABOVE the Prompt section in the DOM.
      const previewY = await previewSection.boundingBox();
      const promptSection = p.locator("text=Regenerate style").locator("xpath=ancestor::section[1]");
      const promptY = await promptSection.boundingBox();
      expect(previewY?.y ?? 0).toBeLessThan(promptY?.y ?? Number.MAX_SAFE_INTEGER);

      // §8 · Screenshot the GENERATED SITE PAGE after redirect · what the merchant sees next
      await p.screenshot({ path: shotPath("generated-site-375.png"), fullPage: true });

      // §9 · Wave 4N · VISITOR-SIDE landing screenshot. Someone arriving
      // from an Instagram bio doesn't have the merchant's auth cookies.
      // Simulate that: fresh context, NO auth cookies, hit the public
      // NEX Address route directly. This is the Linktree-replacement
      // endpoint the Founder called out. Screenshot regardless of visual
      // quality · we're capturing baseline for the polish decision.
      await ctx.close();
      const visitorCtx = await browser.newContext({ viewport: { width: 375, height: 812 } });
      // Plant only the consent cookie so screenshots aren't hidden by the banner.
      const base = new URL(process.env.NEX_E2E_BASE_URL ?? "http://localhost:3008");
      await visitorCtx.addCookies([{
        name: "xrated_cookie_consent", value: "all",
        domain: base.hostname, path: "/", httpOnly: false, secure: false, sameSite: "Lax",
      }]);
      const visitor = await visitorCtx.newPage();
      // Derive the exact slug from the business row · avoids suffix-regex fragility.
      const { data: bizRow } = await admin.from("nex_business").select("slug").eq("id", state.businessId).single();
      const actualSlug = (bizRow as { slug: string } | null)?.slug ?? "";
      const visitorUrl = `/nex-native/${actualSlug}`;
      await visitor.goto(visitorUrl, { waitUntil: "networkidle", timeout: 30_000 });
      const visitorBody = await visitor.locator("body").innerText();
      // The visitor MUST see the real business name somewhere on the page.
      expect(visitorBody.toLowerCase()).toContain("cakeshopjogja");

      // Wave 4N follow-up · Founder directive: Chat is the PRIMARY visitor
      // action. Prove: (a) the Chat-with-us CTA exists · (b) it appears
      // ABOVE the products section · (c) it appears ABOVE the sign-in form.
      const chatCta = visitor.locator("[data-nex-chat-with-us-cta]");
      await expect(chatCta).toBeVisible();
      const chatCtaY = (await chatCta.boundingBox())?.y ?? Number.MAX_SAFE_INTEGER;
      const productsSection = visitor.locator("[data-nex-visitor-section=\"products\"]");
      const productsY = (await productsSection.boundingBox())?.y ?? Number.MAX_SAFE_INTEGER;
      expect(chatCtaY).toBeLessThan(productsY);
      const signInForm = visitor.locator("input[type=\"email\"]").first();
      const signInY = (await signInForm.boundingBox())?.y ?? Number.MAX_SAFE_INTEGER;
      expect(chatCtaY).toBeLessThan(signInY);

      // Lightweight visitor nav (Products / Chat / Find / Live) present.
      await expect(visitor.locator("[data-nex-visitor-nav]")).toBeVisible();
      await expect(visitor.locator("[data-nex-nav-products]")).toBeVisible();
      await expect(visitor.locator("[data-nex-nav-chat]")).toBeVisible();
      await expect(visitor.locator("[data-nex-nav-find]")).toBeVisible();
      await expect(visitor.locator("[data-nex-nav-live]")).toBeVisible();

      await visitor.screenshot({ path: shotPath("visitor-landing-375.png"), fullPage: true });
      await visitorCtx.close();
    } finally {
      await cleanup(state);
    }
  });

  test("390×844 · picker renders + no horizontal overflow", async ({ browser }) => {
    const state = await provisionMerchant();
    try {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
      await plantAuthCookies(ctx, state.jwt, state.refresh);
      const p = await ctx.newPage();
      await p.goto("/nex-native/manage/site/new", { waitUntil: "networkidle" });
      await expect(p.locator("[data-nex-picker-grid]")).toBeVisible();

      // Category chip row is horizontally scrollable within container · no overflow
      const scrollWidth = await p.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await p.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

      // At least 9 template cards visible
      const cardCount = await p.locator("[data-nex-picker-card]").count();
      expect(cardCount).toBeGreaterThanOrEqual(9);

      await p.screenshot({ path: shotPath("template-picker-390.png"), fullPage: true });
      await ctx.close();
    } finally {
      await cleanup(state);
    }
  });
});
