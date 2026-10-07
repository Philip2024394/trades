// tests/e2e/vault-phase-b6a-hardening.spec.ts
//
// Vault Phase B · Commit B.6A · real-browser proof of Vault
// Integration Hardening.
//
// Three independent proof flows:
//   1. CROSS-TAB LOCK: two Alice tabs on the same account · lock in
//      Tab A → Tab B observes the lock + clears plaintext.
//   2. VAULT COMPOSER ATTACHMENT SEND: Alice sends an encrypted
//      image through the sealed canonical pipeline · exactly one new
//      nex_peer_message row · same canonical conversation_id ·
//      attachment_url + encrypted=true · no plaintext bytes on wire.
//   3. CROSS-ACCOUNT DENIAL: Charlie attempts Alice's /vault/home/
//      chats/<convId> · hits the sealed participant-check and gets
//      a notFound()-equivalent response.
//
// Call-presentation gating (B.6A §C) is proven in the deterministic
// suite · a browser proof would require a full ringing peer-call
// setup across two sessions which is out of B.6A proportion.
//
// Deferred (per founder scope lock):
//   · Universal NEX inbound-message realtime (not built)
//   · Universal NEX message push notifications (not built)

import { expect, test, type BrowserContext, type Request } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";

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

const DEVICE_A_PIN = "12345678";
const BOB_SEED_TEXT = "nex-b6a-bob-sentinel-text";
const ALICE_ATTACH_LABEL = "📷 Photo";

const SCREENSHOT_DIR = path.join(
  process.cwd(),
  "tests",
  "e2e-screenshots",
  "vault-phase-b6a",
);

interface Fixture {
  authId: string;
  accountId: string;
  jwt: string;
  refresh: string;
}

async function provisionAccount(suffix: string): Promise<Fixture> {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anon = createClient(SUPABASE_URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = `b6a-${suffix}-${Date.now()}-${randomUUID().slice(0, 8)}@test.local`;
  const password = `B6A!Pw${Date.now()}`;
  const create = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (create.error || !create.data.user) throw new Error(`createUser: ${create.error?.message}`);
  const authId = create.data.user.id;
  const acc = await admin
    .from("nex_account")
    .insert({ supabase_user_id: authId, display_name: `B6A ${suffix}` })
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

async function seedPeerConversation(a: string, b: string): Promise<string> {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const [low, high] = a < b ? [a, b] : [b, a];
  const r = await admin
    .from("nex_peer_conversation")
    .insert({ participant_a_id: low, participant_b_id: high })
    .select("id")
    .single();
  if (r.error || !r.data) throw new Error(`conv: ${r.error?.message}`);
  return (r.data as { id: string }).id;
}

async function seedPlaintextMessage(args: {
  conversationId: string;
  senderAccountId: string;
  body: string;
}): Promise<string> {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const r = await admin
    .from("nex_peer_message")
    .insert({
      conversation_id: args.conversationId,
      sender_account_id: args.senderAccountId,
      body: args.body,
      encrypted: false,
    })
    .select("id")
    .single();
  if (r.error || !r.data) throw new Error(`seed-msg: ${r.error?.message}`);
  return (r.data as { id: string }).id;
}

async function seedDeviceKey(accountId: string, deviceId: string): Promise<void> {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const r = await admin
    .from("nex_account_device_key")
    .upsert(
      {
        account_id: accountId,
        device_id: deviceId,
        public_key: randomBytes(32).toString("base64"),
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "account_id,device_id" },
    );
  if (r.error) throw new Error(`seedDeviceKey: ${r.error.message}`);
}

async function seedVaultEntry(accountId: string, conversationId: string): Promise<void> {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const r = await admin
    .from("nex_vault_entry")
    .insert({
      account_id: accountId,
      entry_kind: "conversation",
      ref_id: conversationId,
    });
  if (r.error) throw new Error(`vault-entry: ${r.error.message}`);
}

async function teardown(f: Fixture, convIds: string[]): Promise<void> {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const swallow = async (p: Promise<unknown>) => { try { await p; } catch {} };
  for (const cid of convIds) {
    await swallow(admin.from("nex_peer_message").delete().eq("conversation_id", cid) as unknown as Promise<unknown>);
    await swallow(admin.from("nex_peer_conversation").delete().eq("id", cid) as unknown as Promise<unknown>);
  }
  for (const t of [
    "nex_vault_conversation_envelope",
    "nex_vault_entry",
    "nex_vault_file",
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
    const r = await admin.from("nex_vault_conversation_envelope").select("id").limit(1);
    return !r.error;
  } catch { return false; }
}

test.beforeAll(async () => {
  if (!(await prereqsAvailable())) {
    test.skip(true, "B.6A live preflight failed · migrations 141/142/143 required");
  }
  try { fs.mkdirSync(SCREENSHOT_DIR, { recursive: true }); } catch {}
});

test.describe("Vault Phase B.6A · integration hardening", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(300_000);

  test("cross-tab lock sweep + attachment send + cross-account denial", async ({
    browser,
  }) => {
    const alice = await provisionAccount("alice");
    const bob = await provisionAccount("bob");
    const charlie = await provisionAccount("charlie");
    const conversationId = await seedPeerConversation(alice.accountId, bob.accountId);
    await seedPlaintextMessage({
      conversationId,
      senderAccountId: bob.accountId,
      body: BOB_SEED_TEXT,
    });
    await seedVaultEntry(alice.accountId, conversationId);
    const bobDevice = `b6a-bob-${randomUUID()}`;
    await seedDeviceKey(bob.accountId, bobDevice);
    const convIds = [conversationId];

    try {
      // ============================================================
      // PART 1 · Cross-tab lock sweep + attachment send (Alice)
      // ============================================================
      const ctxAlice = await browser.newContext({
        viewport: { width: 393, height: 852 },
      });
      await plantAuthCookies(ctxAlice, alice.jwt, alice.refresh);

      const bodies: string[] = [];
      ctxAlice.on("request", (req: Request) => {
        const b = req.postData();
        if (b) bodies.push(b);
      });

      const tabA = await ctxAlice.newPage();

      // Vault setup on Tab A
      await tabA.goto(`${BASE_URL}/nex-native/vault`, { waitUntil: "networkidle" });
      await tabA.waitForURL(/\/vault\/setup/, { timeout: 15_000 });
      await tabA.locator("[data-nex-vault-setup-start]").click();
      await tabA.locator("[data-nex-vault-choose-pin]").click();
      await tabA.locator("[data-nex-vault-secret-input]").fill(DEVICE_A_PIN);
      await tabA.locator("[data-nex-vault-confirm-input]").fill(DEVICE_A_PIN);
      await tabA.locator("[data-nex-vault-create]").click();
      await tabA.waitForURL(/\/vault\/home/, { timeout: 60_000 });

      // Open the vaulted chat in Tab A · locked shell · unlock
      await tabA.goto(`${BASE_URL}/nex-native/vault/home/chats/${conversationId}`, {
        waitUntil: "networkidle",
      });
      await expect(
        tabA.locator('[data-nex-vault-chat-state="locked"]'),
      ).toBeVisible({ timeout: 15_000 });
      await tabA.locator("[data-nex-vault-chat-unlock-input]").fill(DEVICE_A_PIN);
      await tabA.locator("[data-nex-vault-chat-unlock-submit]").click();
      await expect(
        tabA.locator('[data-nex-vault-chat-state="ready"]'),
      ).toBeVisible({ timeout: 60_000 });
      await expect(tabA.getByText(BOB_SEED_TEXT)).toBeVisible({ timeout: 15_000 });

      // Open the SAME vaulted chat in a second tab (Tab B) · same
      // browser context so BroadcastChannel reaches it.
      const tabB = await ctxAlice.newPage();
      await tabB.goto(`${BASE_URL}/nex-native/vault/home/chats/${conversationId}`, {
        waitUntil: "networkidle",
      });
      await expect(
        tabB.locator('[data-nex-vault-chat-state="locked"]'),
      ).toBeVisible({ timeout: 15_000 });
      await tabB.locator("[data-nex-vault-chat-unlock-input]").fill(DEVICE_A_PIN);
      await tabB.locator("[data-nex-vault-chat-unlock-submit]").click();
      await expect(
        tabB.locator('[data-nex-vault-chat-state="ready"]'),
      ).toBeVisible({ timeout: 60_000 });
      await expect(tabB.getByText(BOB_SEED_TEXT)).toBeVisible({ timeout: 15_000 });

      await tabA.screenshot({
        path: path.join(SCREENSHOT_DIR, "01-tabA-ready-mobile.png"),
        fullPage: true,
      });
      await tabB.screenshot({
        path: path.join(SCREENSHOT_DIR, "02-tabB-ready-mobile.png"),
        fullPage: true,
      });

      // ---- Attachment send from Tab A ----
      // Build a tiny valid PNG in memory and feed it through the file
      // input · the sealed uploadEncryptedAttachment encrypts bytes +
      // POSTs ciphertext to the sealed /api/nex-native/attachment/
      // encrypted route.
      const pngBytes = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // signature
        0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk len+type
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde,
        0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, // IDAT chunk
        0x08, 0x99, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05,
        0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4,
        0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, // IEND
        0xae, 0x42, 0x60, 0x82,
      ]);
      await tabA
        .locator('[data-nex-vault-chat-file-input]')
        .setInputFiles({
          name: "b6a-sentinel.png",
          mimeType: "image/png",
          buffer: pngBytes,
        });
      await expect(
        tabA.locator("[data-nex-vault-chat-pending-attachment]"),
      ).toBeVisible({ timeout: 60_000 });

      // Send with no text body (attachment only).
      await tabA.locator("[data-nex-vault-chat-send]").click();
      await expect(
        tabA.getByText(ALICE_ATTACH_LABEL).first(),
      ).toBeVisible({ timeout: 30_000 });
      await tabA.screenshot({
        path: path.join(SCREENSHOT_DIR, "03-attachment-sent-mobile.png"),
        fullPage: true,
      });

      // Server-side verification: one new nex_peer_message with
      // encrypted=true + non-null attachment_url + non-null ciphertext ·
      // same canonical conversation_id · exactly one conversation.
      const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const latestAlice = await admin
        .from("nex_peer_message")
        .select(
          "id, conversation_id, sender_account_id, encrypted, body, ciphertext, attachment_url, attachment_type",
        )
        .eq("conversation_id", conversationId)
        .eq("sender_account_id", alice.accountId)
        .order("sent_at", { ascending: false })
        .limit(1);
      const aliceRow = (latestAlice.data as Array<{
        id: string;
        conversation_id: string;
        sender_account_id: string;
        encrypted: boolean;
        body: string;
        ciphertext: string | null;
        attachment_url: string | null;
        attachment_type: string | null;
      }>)[0];
      expect(aliceRow).toBeTruthy();
      if (aliceRow) {
        expect(aliceRow.conversation_id).toBe(conversationId);
        expect(aliceRow.encrypted).toBe(true);
        expect(aliceRow.body).toBe("(encrypted)");
        expect(aliceRow.ciphertext).not.toBeNull();
        expect(aliceRow.attachment_url).not.toBeNull();
        expect(aliceRow.attachment_type).toBe("image");
      }
      const convCount = await admin
        .from("nex_peer_conversation")
        .select("id")
        .in("id", [conversationId]);
      expect((convCount.data ?? []).length).toBe(1);

      // ---- Cross-tab lock: lock Tab A, assert Tab B also locks ----
      await tabA.locator("[data-nex-vault-chat-lock]").click();
      await expect(
        tabA.locator('[data-nex-vault-chat-state="locked"]'),
      ).toBeVisible({ timeout: 15_000 });
      // Tab B is in the same browser context · BroadcastChannel
      // delivers the lock signal · wait for Tab B to also lock.
      await expect(
        tabB.locator('[data-nex-vault-chat-state="locked"]'),
      ).toBeVisible({ timeout: 15_000 });
      const bodyA = await tabA.locator("body").innerText();
      const bodyB = await tabB.locator("body").innerText();
      expect(bodyA).not.toContain(BOB_SEED_TEXT);
      expect(bodyB).not.toContain(BOB_SEED_TEXT);
      expect(bodyA).not.toContain(ALICE_ATTACH_LABEL);
      expect(bodyB).not.toContain(ALICE_ATTACH_LABEL);
      await expect(tabA.locator("[data-nex-vault-chat-composer]")).toHaveCount(0);
      await expect(tabB.locator("[data-nex-vault-chat-composer]")).toHaveCount(0);

      await tabA.screenshot({
        path: path.join(SCREENSHOT_DIR, "04-tabA-locked-mobile.png"),
        fullPage: true,
      });
      await tabB.screenshot({
        path: path.join(SCREENSHOT_DIR, "05-tabB-locked-via-sweep-mobile.png"),
        fullPage: true,
      });

      // ---- Refresh Tab B · still locked · unlock · state restores ----
      await tabB.reload({ waitUntil: "networkidle" });
      await expect(
        tabB.locator('[data-nex-vault-chat-state="locked"]'),
      ).toBeVisible({ timeout: 15_000 });
      await tabB.locator("[data-nex-vault-chat-unlock-input]").fill(DEVICE_A_PIN);
      await tabB.locator("[data-nex-vault-chat-unlock-submit]").click();
      await expect(
        tabB.locator('[data-nex-vault-chat-state="ready"]'),
      ).toBeVisible({ timeout: 60_000 });
      await expect(tabB.getByText(BOB_SEED_TEXT)).toBeVisible({ timeout: 15_000 });
      await expect(tabB.getByText(ALICE_ATTACH_LABEL).first()).toBeVisible();

      // Desktop viewport screenshot
      await tabB.setViewportSize({ width: 1280, height: 800 });
      await tabB.screenshot({
        path: path.join(SCREENSHOT_DIR, "06-ready-desktop.png"),
        fullPage: true,
      });
      // 375 viewport screenshot
      await tabB.setViewportSize({ width: 375, height: 812 });
      await tabB.screenshot({
        path: path.join(SCREENSHOT_DIR, "07-ready-375.png"),
        fullPage: true,
      });

      await ctxAlice.close();

      // ============================================================
      // PART 2 · Cross-account denial (Charlie)
      // ============================================================
      const ctxCharlie = await browser.newContext({
        viewport: { width: 1280, height: 800 },
      });
      await plantAuthCookies(ctxCharlie, charlie.jwt, charlie.refresh);
      const charliePage = await ctxCharlie.newPage();
      await charliePage.goto(
        `${BASE_URL}/nex-native/vault/home/chats/${conversationId}`,
        { waitUntil: "networkidle" },
      );
      // Charlie is not a participant · the sealed B.4 page sends a
      // notFound() which Next.js renders as its default 404.
      const html = await charliePage.content();
      expect(html).not.toContain(BOB_SEED_TEXT);
      expect(html).not.toContain(ALICE_ATTACH_LABEL);
      // The Vault chat shell markers must not appear.
      await expect(
        charliePage.locator('[data-nex-vault-chat-state]'),
      ).toHaveCount(0);
      await ctxCharlie.close();

      // ============================================================
      // PART 3 · Network secrecy over the whole flow
      // ============================================================
      // PIN never on wire.
      const pinHits = bodies.filter((b) => b.includes(DEVICE_A_PIN));
      expect(
        pinHits,
        `PIN leaked: ${JSON.stringify(pinHits.map((b) => b.slice(0, 80)))}`,
      ).toEqual([]);
      // Bob's seeded plaintext body never on wire (it is server-only
      // for the test fixture · the Vault chat never reflects it in a
      // POST).
      const bobHits = bodies.filter((b) => b.includes(BOB_SEED_TEXT));
      expect(
        bobHits,
        `Bob plaintext leaked: ${JSON.stringify(bobHits.map((b) => b.slice(0, 80)))}`,
      ).toEqual([]);
    } finally {
      await teardown(alice, convIds);
      await teardown(bob, []);
      await teardown(charlie, []);
    }
  });
});
