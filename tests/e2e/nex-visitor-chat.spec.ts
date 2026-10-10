// tests/e2e/nex-visitor-chat.spec.ts
//
// Wave 4N deep · #262 · Anonymous visitor chat browser journey.
// 375×812 WebKit iPhone-13. Founder-mandated: real browser · real
// network · no cookies planted · start truly unauth.
//
// Journey:
//   1 · Provision a real business + product server-side (Supabase admin)
//   2 · Fresh visitor context · NO planted cookies except consent
//   3 · goto /nex-native/[slug]
//   4 · Type "Do you have gluten-free options?" and press Send
//   5 · Assert the visitor sees the message rendered
//   6 · Assert `nex_message` in the authoritative DB has that row bound
//       to a nex_account whose supabase_user_id has metadata.is_nex_visitor
//   7 · Assert the visitor UI now shows "Save this conversation" nudge
//   8 · Screenshot at each key step for Founder review
//   9 · Clean up all rows

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

const SCREENSHOT_DIR = path.join(process.cwd(), "tests", "e2e-screenshots", "visitor-chat");
try { fs.mkdirSync(SCREENSHOT_DIR, { recursive: true }); } catch { /* noop */ }
const shot = (n: string) => path.join(SCREENSHOT_DIR, n);

interface OwnerState {
  authId: string;
  accountId: string;
  businessId: string;
  slug: string;
}

async function provisionOwner(): Promise<OwnerState> {
  const suffix = "v" + Math.floor(Math.random() * 1_000_000).toString().padStart(6, "0");
  const email = `owner-anonchat-${suffix}@nex-native.local`;
  const cu = await admin.auth.admin.createUser({
    email,
    password: "OwnerPass!2026",
    email_confirm: true,
    user_metadata: { display_name: `Cake Shop Owner ${suffix}` },
  });
  if (cu.error) throw new Error(`createUser: ${cu.error.message}`);
  const authId = cu.data.user.id;
  const acc = await admin
    .from("nex_account")
    .insert({ supabase_user_id: authId, display_name: `Cake Shop Owner ${suffix}` })
    .select("id")
    .single();
  if (acc.error) throw new Error(`nex_account insert: ${acc.error.message}`);
  const accountId = (acc.data as { id: string }).id;
  const slug = `anonshop-${suffix}`;
  const biz = await admin
    .from("nex_business")
    .insert({
      owner_account_id: accountId,
      display_name: `Anonymous Test Bakery ${suffix}`,
      slug,
      description: "For the anonymous visitor chat browser test.",
    })
    .select("id")
    .single();
  if (biz.error) throw new Error(`nex_business insert: ${biz.error.message}`);
  const businessId = (biz.data as { id: string }).id;
  await admin.from("nex_product").insert({
    business_id: businessId,
    name: "Sourdough loaf",
    description: "Overnight-proved · seeded top.",
    price_pence: 550,
    currency: "GBP",
    status: "live",
  });
  return { authId, accountId, businessId, slug };
}

async function cleanupOwner(s: OwnerState): Promise<void> {
  const swallow = async (p: Promise<unknown>) => { try { await p; } catch { /* noop */ } };
  // messages + participants + conversations first (FK)
  const convs = await admin.from("nex_conversation").select("id").eq("business_id", s.businessId);
  const convIds = ((convs.data ?? []) as Array<{ id: string }>).map((c) => c.id);
  if (convIds.length > 0) {
    await swallow(admin.from("nex_message").delete().in("conversation_id", convIds) as unknown as Promise<unknown>);
    await swallow(admin.from("nex_conversation_participant").delete().in("conversation_id", convIds) as unknown as Promise<unknown>);
    await swallow(admin.from("nex_conversation").delete().in("id", convIds) as unknown as Promise<unknown>);
  }
  await swallow(admin.from("nex_product").delete().eq("business_id", s.businessId) as unknown as Promise<unknown>);
  await swallow(admin.from("nex_business").delete().eq("id", s.businessId) as unknown as Promise<unknown>);
  // find visitor accounts we accumulated · delete before deleting owner account
  const visitors = await admin
    .from("nex_account")
    .select("id, supabase_user_id")
    .neq("id", s.accountId);
  const rows = (visitors.data ?? []) as Array<{ id: string; supabase_user_id: string | null }>;
  for (const r of rows) {
    // Only delete rows we touched via THIS conversation set (safer approach: leave others).
    // For the test, we lookup participants that used those conv ids to bound the delete.
  }
  await swallow(admin.from("nex_account").delete().eq("id", s.accountId) as unknown as Promise<unknown>);
  await swallow(admin.auth.admin.deleteUser(s.authId) as unknown as Promise<unknown>);
}

test.describe("NEX visitor chat · #262 · anonymous first-message journey", () => {
  test.setTimeout(180_000);

  test("375×812 · unauth visitor sends first message · reaches owner", async ({ browser }) => {
    const owner = await provisionOwner();
    const collectedVisitorAuthIds: string[] = [];

    try {
      const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
      // Only plant cookie-consent · NO auth cookie · truly unauthenticated.
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
      p.on("response", (res) => {
        const u = res.url();
        if (u.includes("/api/nex-native/chat/")) console.log(`[NET ${res.status()}]`, u);
      });
      p.on("requestfailed", (req) => {
        const u = req.url();
        if (u.includes("/api/nex-native/chat/")) console.log(`[NET FAIL]`, u, req.failure()?.errorText);
      });
      p.on("response", async (res) => {
        if (res.url().includes("/api/nex-native/chat/message") && res.status() >= 400) {
          try {
            console.log(`[NET body ${res.status()}]`, (await res.text()).slice(0, 500));
          } catch { /* noop */ }
        }
      });

      // 1 · Arrive at public NEX
      await p.goto(`/nex-native/${owner.slug}`, { waitUntil: "networkidle" });
      await p.screenshot({ path: shot("01-visitor-landed.png"), fullPage: true });

      // 2 · The compose input is visible upfront (no sign-in wall)
      const composeInput = p.locator("[data-nex-chat-input]");
      await expect(composeInput).toBeVisible({ timeout: 15_000 });
      const sendBtn = p.locator("[data-nex-chat-send]");
      await expect(sendBtn).toBeVisible();

      // 3 · Type + submit the first anonymous message
      const messageBody = "Hi · do you have gluten-free options for pickup?";
      await composeInput.fill(messageBody);
      await p.screenshot({ path: shot("02-visitor-typed.png"), fullPage: true });
      await sendBtn.click();

      // 4 · Wait for either "Chatting as a visitor" badge OR error surface.
      // If the badge appears, the visitor session was provisioned.
      const anonBadge = p.locator("[data-nex-anonymous-badge]");
      const errorBox = p.locator("[data-nex-chat-error]");
      await Promise.race([
        anonBadge.waitFor({ state: "visible", timeout: 20_000 }),
        errorBox.waitFor({ state: "visible", timeout: 20_000 }),
      ]);
      const errorText = (await errorBox.count()) > 0 ? await errorBox.textContent() : null;
      expect(errorText, `Chat error surfaced: ${errorText}`).toBeNull();
      await expect(anonBadge).toBeVisible();
      await p.screenshot({ path: shot("03-visitor-sent-first-message.png"), fullPage: true });

      // 5 · The message appears in the message list
      const msgLocator = p.getByText(messageBody, { exact: false });
      await expect(msgLocator).toBeVisible({ timeout: 15_000 });

      // 6 · Save nudge appears once we have a persisted message
      const saveNudge = p.locator("[data-nex-save-nudge]");
      await expect(saveNudge).toBeVisible();
      await p.screenshot({ path: shot("04-visitor-save-nudge-visible.png"), fullPage: true });

      // 7 · Server-side proof: nex_message row exists with the exact body,
      // and its sender is a visitor account.
      const convs = await admin
        .from("nex_conversation")
        .select("id")
        .eq("business_id", owner.businessId);
      expect(convs.error).toBeNull();
      const convIds = ((convs.data ?? []) as Array<{ id: string }>).map((c) => c.id);
      expect(convIds.length).toBeGreaterThan(0);
      const msgs = await admin
        .from("nex_message")
        .select("id, sender_account_id, body")
        .in("conversation_id", convIds)
        .eq("body", messageBody);
      expect(msgs.error).toBeNull();
      const msgRows = (msgs.data ?? []) as Array<{ sender_account_id: string; body: string }>;
      expect(msgRows.length).toBeGreaterThanOrEqual(1);
      const senderAccountId = msgRows[0]!.sender_account_id;
      expect(senderAccountId).not.toBe(owner.accountId);

      // Look up the visitor auth user to confirm metadata.is_nex_visitor
      const senderAccount = await admin
        .from("nex_account")
        .select("supabase_user_id")
        .eq("id", senderAccountId)
        .single();
      expect(senderAccount.error).toBeNull();
      const supabaseUserId = (senderAccount.data as { supabase_user_id: string | null }).supabase_user_id;
      expect(supabaseUserId).not.toBeNull();
      collectedVisitorAuthIds.push(supabaseUserId!);

      const visitorAuth = await admin.auth.admin.getUserById(supabaseUserId!);
      expect(visitorAuth.error).toBeNull();
      const metadata = (visitorAuth.data.user?.user_metadata ?? {}) as { is_nex_visitor?: boolean };
      expect(metadata.is_nex_visitor).toBe(true);

      // 8 · Both participants exist (visitor + business owner)
      const parts = await admin
        .from("nex_conversation_participant")
        .select("account_id, side")
        .in("conversation_id", convIds);
      const partRows = (parts.data ?? []) as Array<{ account_id: string; side: string }>;
      expect(partRows.some((r) => r.account_id === owner.accountId && r.side === "business")).toBe(true);
      expect(partRows.some((r) => r.account_id === senderAccountId && r.side === "customer")).toBe(true);

      await ctx.close();
    } finally {
      // Best-effort cleanup of visitor accounts collected
      for (const uid of collectedVisitorAuthIds) {
        try {
          const accByUid = await admin.from("nex_account").select("id").eq("supabase_user_id", uid);
          const rows = (accByUid.data ?? []) as Array<{ id: string }>;
          for (const r of rows) {
            await admin.from("nex_account").delete().eq("id", r.id);
          }
          await admin.auth.admin.deleteUser(uid);
        } catch { /* swallow */ }
      }
      await cleanupOwner(owner);
    }
  });
});
