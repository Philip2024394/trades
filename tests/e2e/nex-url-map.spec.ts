// tests/e2e/nex-url-map.spec.ts
//
// Wave 4 · Founder UI-execution command · sealed 2026-09-25:
//   "I want to start seeing the real NEX product in a browser · give me
//   exact URLs · browser-verified · mobile-verified."
//
// This spec doesn't build new UI. It VISITS every existing URL the Founder
// listed, at 375×812 iPhone-13 viewport, screenshotting each. Two contexts:
//   · signed-in merchant (owner-side surfaces)
//   · unauthenticated visitor (public NEX destination)
//
// Deliverable: a table of URL → screenshot filename that the Founder can
// open in a real browser to see the current product.

import { test, expect, type BrowserContext } from "@playwright/test";
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
const anonKey = process.env.NEX_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY!;

const admin = createClient(url, svc, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

const SCREENSHOT_DIR = path.join(process.cwd(), "tests", "e2e-screenshots", "url-map");
try { fs.mkdirSync(SCREENSHOT_DIR, { recursive: true }); } catch {}
function shot(name: string): string { return path.join(SCREENSHOT_DIR, name); }

async function plantAuthCookies(ctx: BrowserContext, jwt: string, refresh: string): Promise<void> {
  const projectRef = (url.match(/https?:\/\/([^.]+)/)?.[1]) ?? "unknown";
  const cookieName = `sb-${projectRef}-auth-token`;
  const payload = {
    access_token: jwt, refresh_token: refresh,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600, token_type: "bearer", user: null,
  };
  const base = new URL(process.env.NEX_E2E_BASE_URL ?? "http://localhost:3008");
  await ctx.addCookies([
    {
      name: cookieName,
      value: `base64-${Buffer.from(JSON.stringify(payload)).toString("base64")}`,
      domain: base.hostname, path: "/",
      httpOnly: true, secure: false, sameSite: "Lax",
    },
    {
      name: "xrated_cookie_consent", value: "all",
      domain: base.hostname, path: "/",
      httpOnly: false, secure: false, sameSite: "Lax",
    },
  ]);
}

async function plantConsentOnly(ctx: BrowserContext): Promise<void> {
  const base = new URL(process.env.NEX_E2E_BASE_URL ?? "http://localhost:3008");
  await ctx.addCookies([{
    name: "xrated_cookie_consent", value: "all",
    domain: base.hostname, path: "/",
    httpOnly: false, secure: false, sameSite: "Lax",
  }]);
}

interface MerchantState {
  email: string; password: string; authId: string; accountId: string;
  businessId: string; slug: string; jwt: string; refresh: string;
  handle: string; conversationId?: string;
}

async function provisionMerchantAndConversation(): Promise<MerchantState> {
  const suffix = "url" + Math.floor(Math.random() * 1_000_000).toString().padStart(6, "0");
  const email = `nex-url-map-${suffix}@nex-native.local`;
  const password = "UrlMap!2026";
  const cu = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { display_name: `NEX URL Map ${suffix}` },
  });
  if (cu.error) throw new Error(`createUser: ${cu.error.message}`);
  const authId = cu.data.user.id;
  const acc = await admin.from("nex_account").insert({
    supabase_user_id: authId, display_name: `Cake Shop Owner ${suffix}`,
  }).select("*").single();
  const accountId = (acc.data as { id: string; nex_handle: string }).id;
  const handle = (acc.data as { id: string; nex_handle: string }).nex_handle;
  const slug = `cakeshopjogja-${suffix}`;
  const biz = await admin.from("nex_business").insert({
    owner_account_id: accountId,
    display_name: `Cake Shop Jogja ${suffix}`,
    slug,
    description: "Fresh sourdough loaves and butter cakes every morning · order in NEX chat.",
  }).select("*").single();
  const businessId = (biz.data as { id: string }).id;
  await admin.from("nex_product").insert({
    business_id: businessId, name: "Signature Buttercake",
    description: "Golden butter cake · pre-order for pickup ·  arranged in chat.",
    price_pence: 4500, currency: "GBP", status: "live",
  });
  // Seed a second account + one conversation so /conversations has content
  const cu2 = await admin.auth.admin.createUser({
    email: `nex-url-visitor-${suffix}@nex-native.local`, password, email_confirm: true,
    user_metadata: { display_name: `NEX Visitor ${suffix}` },
  });
  if (!cu2.error) {
    const acc2 = await admin.from("nex_account").insert({
      supabase_user_id: cu2.data.user.id, display_name: `Visitor ${suffix}`,
    }).select("id").single();
    const visitorAccountId = (acc2.data as { id: string }).id;
    // Create a conversation via nex_conversation + nex_conversation_participant tables
    const conv = await admin.from("nex_conversation").insert({
      business_id: businessId,
    }).select("id").single();
    if (!conv.error && conv.data) {
      const conversationId = (conv.data as { id: string }).id;
      const partInsert = await admin.from("nex_conversation_participant").insert([
        { conversation_id: conversationId, account_id: accountId, side: "business" },
        { conversation_id: conversationId, account_id: visitorAccountId, side: "customer" },
      ]);
      if (partInsert.error) {
        throw new Error(`seed nex_conversation_participant: ${partInsert.error.message}`);
      }
      await admin.from("nex_message").insert([
        { conversation_id: conversationId, sender_account_id: visitorAccountId,
          body: "Hi · do you deliver on weekends?" },
        { conversation_id: conversationId, sender_account_id: accountId,
          body: "Hello! Yes · Saturday delivery to Manchester postcodes." },
      ]);
      // Save conversation id for the URL map
      const signIn = await anon.auth.signInWithPassword({ email, password });
      if (signIn.error || !signIn.data.session) throw new Error(`signIn: ${signIn.error?.message}`);
      return {
        email, password, authId, accountId, businessId, slug,
        handle: handle ?? "",
        jwt: signIn.data.session.access_token,
        refresh: signIn.data.session.refresh_token,
        conversationId,
      };
    }
  }
  const signIn = await anon.auth.signInWithPassword({ email, password });
  if (signIn.error || !signIn.data.session) throw new Error(`signIn: ${signIn.error?.message}`);
  return {
    email, password, authId, accountId, businessId, slug,
    handle: handle ?? "",
    jwt: signIn.data.session.access_token,
    refresh: signIn.data.session.refresh_token,
  };
}

async function cleanup(state: MerchantState): Promise<void> {
  const swallow = async (p: Promise<unknown>) => { try { await p; } catch {} };
  if (state.businessId) {
    await swallow(admin.from("nex_message").delete().eq("conversation_id", state.conversationId ?? "00000000-0000-0000-0000-000000000000") as unknown as Promise<unknown>);
    await swallow(admin.from("nex_conversation").delete().eq("business_id", state.businessId) as unknown as Promise<unknown>);
    await swallow(admin.from("nex_generated_site").delete().eq("business_id", state.businessId) as unknown as Promise<unknown>);
    await swallow(admin.from("nex_product").delete().eq("business_id", state.businessId) as unknown as Promise<unknown>);
    await swallow(admin.from("nex_business").delete().eq("id", state.businessId) as unknown as Promise<unknown>);
  }
  if (state.accountId) await swallow(admin.from("nex_account").delete().eq("id", state.accountId) as unknown as Promise<unknown>);
  if (state.authId) await swallow(admin.auth.admin.deleteUser(state.authId) as unknown as Promise<unknown>);
}

// ----------------------------------------------------------------------------
// The URL map test · one big test that hits every listed surface
// ----------------------------------------------------------------------------

test.describe("NEX URL map · Founder UI-execution command 2026-09-25", () => {
  test.setTimeout(180_000);

  test("375×812 · visit every experience URL · owner + visitor pass", async ({ browser }) => {
    const state = await provisionMerchantAndConversation();
    const captured: Record<string, string> = {};

    try {
      // === OWNER CONTEXT (authenticated) ===
      const ownerCtx = await browser.newContext({ viewport: { width: 375, height: 812 } });
      await plantAuthCookies(ownerCtx, state.jwt, state.refresh);
      const p = await ownerCtx.newPage();

      // 1 · First Entry / Root of nex-native
      await p.goto("/nex-native", { waitUntil: "networkidle" }).catch(() => {});
      await p.screenshot({ path: shot("01-first-entry-signed-in.png"), fullPage: true });
      captured["01-first-entry-signed-in"] = "/nex-native";

      // 2 · Conversations (Friends Chat = the inbox home post-auth)
      await p.goto("/nex-native/conversations", { waitUntil: "networkidle" });
      await p.screenshot({ path: shot("02-friends-chat-inbox.png"), fullPage: true });
      captured["02-friends-chat-inbox"] = "/nex-native/conversations";

      // 3 · Individual Conversation
      if (state.conversationId) {
        await p.goto(`/nex-native/conversations/${state.conversationId}`, { waitUntil: "networkidle" });
        await p.screenshot({ path: shot("03-conversation.png"), fullPage: true });
        captured["03-conversation"] = `/nex-native/conversations/${state.conversationId}`;
      }

      // 4 · Friends list
      await p.goto("/nex-native/friends", { waitUntil: "networkidle" });
      await p.screenshot({ path: shot("04-friends-list.png"), fullPage: true });
      captured["04-friends-list"] = "/nex-native/friends";

      // 5 · Your NEX (owner dashboard shows Your NEX card as first section)
      await p.goto("/nex-native/manage", { waitUntil: "networkidle" });
      await p.screenshot({ path: shot("05-your-nex-owner.png"), fullPage: true });
      captured["05-your-nex-owner"] = "/nex-native/manage";

      // 6 · Build my NEX
      await p.goto("/nex-native/manage/site", { waitUntil: "networkidle" });
      await p.screenshot({ path: shot("06-build-my-nex.png"), fullPage: true });
      captured["06-build-my-nex"] = "/nex-native/manage/site";

      // 7 · About NEX
      await p.goto("/nex-native/about", { waitUntil: "networkidle" });
      await p.screenshot({ path: shot("07-about-nex.png"), fullPage: true });
      captured["07-about-nex"] = "/nex-native/about";

      // 8 · Onboarding (create NEX business)
      await p.goto("/nex-native/onboarding", { waitUntil: "networkidle" });
      await p.screenshot({ path: shot("08-onboarding.png"), fullPage: true });
      captured["08-onboarding"] = "/nex-native/onboarding";

      await ownerCtx.close();

      // === VISITOR CONTEXT (unauthenticated) ===
      const visitorCtx = await browser.newContext({ viewport: { width: 375, height: 812 } });
      await plantConsentOnly(visitorCtx);
      const v = await visitorCtx.newPage();

      // 9 · Create Account / Re-entry (both live on /conversations when signed-out)
      await v.goto("/nex-native/conversations", { waitUntil: "networkidle" });
      await v.screenshot({ path: shot("09-create-account-or-reentry.png"), fullPage: true });
      captured["09-create-account-or-reentry"] = "/nex-native/conversations";

      // 10 · Public NEX (visitor landing = the acquisition endpoint)
      await v.goto(`/nex-native/${state.slug}`, { waitUntil: "networkidle" });
      await v.screenshot({ path: shot("10-public-nex-visitor.png"), fullPage: true });
      captured["10-public-nex-visitor"] = `/nex-native/${state.slug}`;

      // 11 · Public NEX by user handle
      if (state.handle) {
        await v.goto(`/nex-native/u/${state.handle}`, { waitUntil: "networkidle" });
        await v.screenshot({ path: shot("11-public-nex-handle.png"), fullPage: true });
        captured["11-public-nex-handle"] = `/nex-native/u/${state.handle}`;
      }

      await visitorCtx.close();

      // Persist the URL map alongside screenshots for the Founder to open.
      const mapPath = path.join(SCREENSHOT_DIR, "URL-MAP.md");
      const lines = [
        "# NEX URL Map · 375×812 mobile viewport",
        `Generated at ${new Date().toISOString()}`,
        "",
        "Base URL: http://localhost:3008",
        "",
        "| # | Experience | Relative URL | Screenshot |",
        "|---|---|---|---|",
      ];
      const rowLabels: Record<string, string> = {
        "01-first-entry-signed-in": "First Entry (signed-in redirect)",
        "02-friends-chat-inbox": "Friends Chat · Inbox",
        "03-conversation": "Individual Conversation",
        "04-friends-list": "Friends List",
        "05-your-nex-owner": "Your NEX (owner dashboard)",
        "06-build-my-nex": "Build my NEX",
        "07-about-nex": "About NEX",
        "08-onboarding": "Onboarding · Create NEX business",
        "09-create-account-or-reentry": "Create Account / Re-entry (sign-in gate)",
        "10-public-nex-visitor": "Public NEX (visitor / Linktree landing)",
        "11-public-nex-handle": "Public NEX by @handle",
      };
      let i = 1;
      for (const [key, url] of Object.entries(captured)) {
        lines.push(`| ${i++} | ${rowLabels[key] ?? key} | ${url} | url-map/${key}.png |`);
      }
      fs.writeFileSync(mapPath, lines.join("\n") + "\n");
    } finally {
      await cleanup(state);
    }
  });
});
