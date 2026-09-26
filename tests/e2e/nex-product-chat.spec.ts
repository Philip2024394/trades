// tests/e2e/nex-product-chat.spec.ts
//
// Bridge 1 · Directory Search → Product → Product-Context Chat.
// -------------------------------------------------------------------------
// Modelled on tests/e2e/nex-visitor-chat.spec.ts. Provisions a real
// business + product server-side, drives a truly unauthenticated visitor
// through:
//
//   /nex-native/search?q=<unique-tag>
//     → click product card
//     → arrive at /nex-native/product/[real-product-uuid]
//     → send a message via the SAME NexNativeChatClient
//     → assert nex_conversation.about_product_id === product.id  (DB proof)
//     → assert nex_message row exists                            (DB proof)
//     → reload → conversation + product context persist
//
// No new chat system. No new product system. No schema change.

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

const SCREENSHOT_DIR = path.join(process.cwd(), "tests", "e2e-screenshots", "product-chat");
try { fs.mkdirSync(SCREENSHOT_DIR, { recursive: true }); } catch { /* noop */ }
const shot = (n: string) => path.join(SCREENSHOT_DIR, n);

interface Fixture {
  authId: string;
  accountId: string;
  businessId: string;
  productId: string;
  slug: string;
  productTag: string;
  productName: string;
}

async function provisionFixture(): Promise<Fixture> {
  const suffix = "p" + Math.floor(Math.random() * 1_000_000).toString().padStart(6, "0");
  const email = `owner-productchat-${suffix}@nex-native.local`;
  const cu = await admin.auth.admin.createUser({
    email,
    password: "OwnerPass!2026",
    email_confirm: true,
    user_metadata: { display_name: `Product Chat Owner ${suffix}` },
  });
  if (cu.error) throw new Error(`createUser: ${cu.error.message}`);
  const authId = cu.data.user.id;
  const acc = await admin
    .from("nex_account")
    .insert({ supabase_user_id: authId, display_name: `Product Chat Owner ${suffix}` })
    .select("id")
    .single();
  if (acc.error) throw new Error(`nex_account insert: ${acc.error.message}`);
  const accountId = (acc.data as { id: string }).id;
  const slug = `pchat-${suffix}`;
  const biz = await admin
    .from("nex_business")
    .insert({
      owner_account_id: accountId,
      display_name: `Product Chat Bakery ${suffix}`,
      slug,
      description: "For the product-context chat browser test.",
    })
    .select("id")
    .single();
  if (biz.error) throw new Error(`nex_business insert: ${biz.error.message}`);
  const businessId = (biz.data as { id: string }).id;
  // Unique tag guarantees the search query returns exactly this fixture.
  const productTag = `runner-${suffix}`;
  const productName = `Runner X1 ${suffix}`;
  const prod = await admin
    .from("nex_product")
    .insert({
      business_id: businessId,
      name: productName,
      description: "Lightweight running shoe · limited run · pilot fixture for Bridge 1.",
      price_pence: 12_500,
      currency: "GBP",
      status: "live",
      tags: [productTag],
    })
    .select("id")
    .single();
  if (prod.error) throw new Error(`nex_product insert: ${prod.error.message}`);
  const productId = (prod.data as { id: string }).id;
  return { authId, accountId, businessId, productId, slug, productTag, productName };
}

async function cleanupFixture(f: Fixture, collectedVisitorAuthIds: string[]): Promise<void> {
  const swallow = async (p: Promise<unknown>) => { try { await p; } catch { /* noop */ } };
  const convs = await admin.from("nex_conversation").select("id").eq("business_id", f.businessId);
  const convIds = ((convs.data ?? []) as Array<{ id: string }>).map((c) => c.id);
  if (convIds.length > 0) {
    await swallow(admin.from("nex_message").delete().in("conversation_id", convIds) as unknown as Promise<unknown>);
    await swallow(admin.from("nex_conversation_participant").delete().in("conversation_id", convIds) as unknown as Promise<unknown>);
    await swallow(admin.from("nex_conversation").delete().in("id", convIds) as unknown as Promise<unknown>);
  }
  await swallow(admin.from("nex_product").delete().eq("business_id", f.businessId) as unknown as Promise<unknown>);
  await swallow(admin.from("nex_business").delete().eq("id", f.businessId) as unknown as Promise<unknown>);
  await swallow(admin.from("nex_account").delete().eq("id", f.accountId) as unknown as Promise<unknown>);
  await swallow(admin.auth.admin.deleteUser(f.authId) as unknown as Promise<unknown>);
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
}

test.describe("NEX Bridge 1 · Directory Search → Product → Product-Context Chat", () => {
  test.setTimeout(180_000);

  test("375×812 · search → product page → send → about_product_id persisted", async ({ browser }) => {
    const fixture = await provisionFixture();
    const collectedVisitorAuthIds: string[] = [];

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
      p.on("response", (res) => {
        const u = res.url();
        if (u.includes("/api/nex-native/chat/")) console.log(`[NET ${res.status()}]`, u);
      });
      p.on("response", async (res) => {
        if (res.url().includes("/api/nex-native/chat/") && res.status() >= 400) {
          try { console.log(`[NET body ${res.status()}]`, (await res.text()).slice(0, 500)); } catch { /* noop */ }
        }
      });

      // 1 · Search directory for the unique tag → find our real product row.
      await p.goto(`/nex-native/search?q=${encodeURIComponent(fixture.productTag)}`, {
        waitUntil: "networkidle",
      });
      await p.screenshot({ path: shot("01-search-results.png"), fullPage: true });
      const resultLink = p.locator(`a[href="/nex-native/product/${fixture.productId}"]`).first();
      await expect(resultLink, "Search should link the product to its canonical destination").toBeVisible({ timeout: 15_000 });

      // 2 · Click through to the canonical product URL.
      await Promise.all([
        p.waitForURL(`**/nex-native/product/${fixture.productId}`, { timeout: 15_000 }),
        resultLink.click(),
      ]);
      await p.screenshot({ path: shot("02-product-page.png"), fullPage: true });

      // 3 · Real product + real business rendered on the canonical page.
      // Product name appears in both the h1 and the "Chat about X" h2 — bind
      // the assertion to the exact h1 so it can't false-positive on the h2.
      await expect(p.getByRole("heading", { name: fixture.productName, exact: true })).toBeVisible();
      // Business name appears in multiple places (seller chip, chat subtitle,
      // chat placeholder). Assert the seller-chip link specifically since that
      // is the one that proves the product → business resolution worked.
      await expect(
        p.locator(`a[href="/nex-native/${fixture.slug}"]`).first(),
      ).toBeVisible();

      // 4 · Chat panel present with product pre-selected.
      const composeInput = p.locator("[data-nex-chat-input]");
      await expect(composeInput).toBeVisible({ timeout: 15_000 });
      const sendBtn = p.locator("[data-nex-chat-send]");
      await expect(sendBtn).toBeVisible();

      // 5 · Send an anonymous first message about this specific product.
      const messageBody = `Is the ${fixture.productName} available in size 42 EU?`;
      await composeInput.fill(messageBody);
      await sendBtn.click();

      const anonBadge = p.locator("[data-nex-anonymous-badge]");
      const errorBox = p.locator("[data-nex-chat-error]");
      await Promise.race([
        anonBadge.waitFor({ state: "visible", timeout: 20_000 }),
        errorBox.waitFor({ state: "visible", timeout: 20_000 }),
      ]);
      const errorText = (await errorBox.count()) > 0 ? await errorBox.textContent() : null;
      expect(errorText, `Chat error surfaced: ${errorText}`).toBeNull();
      await expect(anonBadge).toBeVisible();
      await p.screenshot({ path: shot("03-message-sent.png"), fullPage: true });

      // Message rendered locally.
      await expect(p.getByText(messageBody, { exact: false })).toBeVisible({ timeout: 15_000 });

      // 6 · DB proof — conversation is scoped to the exact product.
      const convs = await admin
        .from("nex_conversation")
        .select("id, business_id, about_product_id")
        .eq("business_id", fixture.businessId);
      expect(convs.error).toBeNull();
      const convRows = (convs.data ?? []) as Array<{ id: string; business_id: string; about_product_id: string | null }>;
      const productConv = convRows.find((c) => c.about_product_id === fixture.productId);
      expect(productConv, "A conversation with about_product_id=product.id must exist").toBeTruthy();

      // 7 · DB proof — nex_message row exists and belongs to this conversation.
      const msgs = await admin
        .from("nex_message")
        .select("id, sender_account_id, body, conversation_id")
        .eq("conversation_id", productConv!.id)
        .eq("body", messageBody);
      expect(msgs.error).toBeNull();
      const msgRows = (msgs.data ?? []) as Array<{ sender_account_id: string; body: string }>;
      expect(msgRows.length).toBeGreaterThanOrEqual(1);
      const senderAccountId = msgRows[0]!.sender_account_id;
      expect(senderAccountId).not.toBe(fixture.accountId);

      // 8 · Participant proof — customer + business seats populated correctly.
      const parts = await admin
        .from("nex_conversation_participant")
        .select("account_id, side")
        .eq("conversation_id", productConv!.id);
      const partRows = (parts.data ?? []) as Array<{ account_id: string; side: string }>;
      expect(partRows.some((r) => r.account_id === fixture.accountId && r.side === "business")).toBe(true);
      expect(partRows.some((r) => r.account_id === senderAccountId && r.side === "customer")).toBe(true);

      // Collect visitor auth id for cleanup.
      const senderAccount = await admin
        .from("nex_account")
        .select("supabase_user_id")
        .eq("id", senderAccountId)
        .single();
      const supabaseUserId = (senderAccount.data as { supabase_user_id: string | null }).supabase_user_id;
      if (supabaseUserId) collectedVisitorAuthIds.push(supabaseUserId);

      // 9 · Reload proof — the canonical URL survives refresh; conversation
      // context is server-side, not a client artifact.
      await p.reload({ waitUntil: "networkidle" });
      await expect(p.getByRole("heading", { name: fixture.productName, exact: true })).toBeVisible();
      await expect(p.getByText(messageBody, { exact: false })).toBeVisible({ timeout: 15_000 });
      await p.screenshot({ path: shot("04-reload-context-preserved.png"), fullPage: true });

      await ctx.close();
    } finally {
      await cleanupFixture(fixture, collectedVisitorAuthIds);
    }
  });
});
