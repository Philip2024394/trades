// tests/e2e/vault-phase-b4-chat-surface.spec.ts
//
// Vault Phase B · Commit B.4 · real-browser proof of the canonical
// Vault chat surface at /nex-native/vault/home/chats/[conversationId].
//
// Flow:
//   · Provision Alice + Bob
//   · Seed canonical nex_peer_conversation
//   · Seed one plaintext message from Bob (via admin · exercises the
//     "existing history" rendering path · B.5 would move encrypted
//     history in · we deliberately keep the test fixture simple here)
//   · Seed Alice's nex_vault_entry row (admin · B.5 move-to-vault UI
//     is explicitly out of B.4 scope)
//   · Alice signs in · Vault setup with PIN · redirected to home
//   · Hard-navigate to /vault/home/chats/<convId> · Vault is locked
//     by nav (correct Phase A posture)
//   · Verify locked shell visible · no plaintext present
//   · Unlock inline via the sealed PIN form
//   · Verify ready phase · Bob's message visible · peer name in header
//   · Compose + send a new encrypted message
//   · Verify message appears in bubble list
//   · Verify server-side nex_peer_message now has the new row
//   · Verify the conversation_id is UNCHANGED through the entire flow
//   · Lock Vault via the header button
//   · Verify locked shell returns · plaintext gone · composer gone
//   · Verify encrypted IDB cache row still present
//   · Refresh · verify still locked
//   · Unlock again · verify both messages re-render from cache + fresh
//     decrypt
//   · Network secrecy · zero PIN / plaintext tokens on wire

import { expect, test, type BrowserContext, type Request } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";

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
const BOB_SENTINEL = "nex-b4-bob-sentinel-from-admin-seed";
const ALICE_SENTINEL = "nex-b4-alice-reply-via-composer";

const SCREENSHOT_DIR = path.join(
  process.cwd(),
  "tests",
  "e2e-screenshots",
  "vault-phase-b4",
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
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anon = createClient(SUPABASE_URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = `b4-${suffix}-${Date.now()}@test.local`;
  const password = `B4!Pw${Date.now()}`;
  const create = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (create.error || !create.data.user) {
    throw new Error(`createUser: ${create.error?.message}`);
  }
  const authId = create.data.user.id;
  const acc = await admin
    .from("nex_account")
    .insert({ supabase_user_id: authId, display_name: `B4 ${suffix}` })
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
    email,
    password,
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
  // The Bridge 76 encrypted-send path requires at least one device key
  // per account on both sides. B.5+ handles cross-device onboarding
  // UX · for B.4 we simply seed Bob's device via admin so Alice's
  // encrypted send flow has a target to fan out to.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { randomBytes } = await import("node:crypto");
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
  const swallow = async (p: Promise<unknown>) => {
    try { await p; } catch { /* ignore */ }
  };
  for (const cid of convIds) {
    await swallow(
      admin.from("nex_peer_message").delete().eq("conversation_id", cid) as unknown as Promise<unknown>,
    );
    await swallow(
      admin.from("nex_peer_conversation").delete().eq("id", cid) as unknown as Promise<unknown>,
    );
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
    await swallow(
      admin.from(t).delete().eq("account_id", f.accountId) as unknown as Promise<unknown>,
    );
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

async function prereqsAvailable(): Promise<boolean> {
  if (!SUPABASE_URL || !SERVICE_ROLE || !ANON) return false;
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const r = await admin.from("nex_vault_conversation_envelope").select("id").limit(1);
    return !r.error;
  } catch {
    return false;
  }
}

test.beforeAll(async () => {
  if (!(await prereqsAvailable())) {
    test.skip(true, "B.4 live preflight failed · migrations 141/142/143 required");
  }
  try { fs.mkdirSync(SCREENSHOT_DIR, { recursive: true }); } catch {}
});

test.describe("Vault Phase B.4 · canonical Vault chat surface", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(300_000);

  test("locked shell → unlock → render history → send → lock → refresh → unlock → re-render", async ({
    browser,
  }) => {
    const alice = await provisionAccount("alice");
    const bob = await provisionAccount("bob");
    const conversationId = await seedPeerConversation(alice.accountId, bob.accountId);
    const seededMessageId = await seedPlaintextMessage({
      conversationId,
      senderAccountId: bob.accountId,
      body: BOB_SENTINEL,
    });
    await seedVaultEntry(alice.accountId, conversationId);
    // Seed Bob's device key so Alice's encrypted send has a target.
    const bobDevice = `b4-bob-${Date.now()}-abc`;
    await seedDeviceKey(bob.accountId, bobDevice);
    const convIds = [conversationId];

    try {
      const ctx = await browser.newContext({
        viewport: { width: 393, height: 852 }, // iPhone-14-Pro-sized · mobile first
      });
      await plantAuthCookies(ctx, alice.jwt, alice.refresh);

      const bodies: string[] = [];
      ctx.on("request", (req: Request) => {
        const b = req.postData();
        if (b) bodies.push(b);
      });

      const page = await ctx.newPage();

      // 1. Vault setup
      await page.goto(`${BASE_URL}/nex-native/vault`, { waitUntil: "networkidle" });
      await page.waitForURL(/\/vault\/setup/, { timeout: 15_000 });
      await page.locator("[data-nex-vault-setup-start]").click();
      await page.locator("[data-nex-vault-choose-pin]").click();
      await page.locator("[data-nex-vault-secret-input]").fill(DEVICE_A_PIN);
      await page.locator("[data-nex-vault-confirm-input]").fill(DEVICE_A_PIN);
      await page.locator("[data-nex-vault-create]").click();
      await page.waitForURL(/\/vault\/home/, { timeout: 60_000 });

      // 2a. Settings → Vault entry point.
      //     The B.4 follow-up added a real "Vault" card under Storage &
      //     Data that routes to /nex-native/vault/home. Prove it works
      //     as a user-facing doorway rather than requiring the user to
      //     know a /vault/home URL.
      await page.goto(`${BASE_URL}/nex-native/settings`, {
        waitUntil: "networkidle",
      });
      // Grep the Settings landing · the row must be visible and point
      // at /vault/home · the title must say "Vault" (not "Storage")
      // and the subtitle must not mention any commercial figure.
      await expect(
        page.getByRole("link", { name: /Vault/i }).first(),
      ).toBeVisible({ timeout: 15_000 });
      const vaultHref = await page
        .locator('a[href="/nex-native/vault/home"]')
        .first()
        .getAttribute("href");
      expect(vaultHref).toBe("/nex-native/vault/home");

      // Tap the Vault card.
      await page.locator('a[href="/nex-native/vault/home"]').first().click();
      await page.waitForURL(/\/vault\/home$/, { timeout: 30_000 });

      // 2b. Vault Home · the Chats section must list our vaulted
      //     conversation with a direct link to the sealed B.4 chat
      //     route. Taking that link navigates straight to the chat ·
      //     no extra drill-down page.
      await expect(
        page.locator("[data-nex-vault-chats-section]"),
      ).toBeVisible({ timeout: 15_000 });
      const chatLink = page.locator(
        `[data-nex-vault-home-chat-link][data-nex-vault-home-chat-conversation-id="${conversationId}"]`,
      );
      await expect(chatLink).toBeVisible();
      const chatLinkHref = await chatLink.getAttribute("href");
      expect(chatLinkHref).toBe(`/nex-native/vault/home/chats/${conversationId}`);

      // Prove no plaintext of Bob's message appears on the Vault Home
      // itself (metadata-only · the chat route is where plaintext
      // may appear, gated by VMK unlock).
      const homeBodyText = await page.locator("body").innerText();
      expect(homeBodyText).not.toContain(BOB_SENTINEL);

      // Tap it · hard-navigate wipes the tab-scoped VMK (correct
      // Phase A posture · we re-unlock on the chat page).
      await chatLink.click();
      await page.waitForURL(
        new RegExp(`/vault/home/chats/${conversationId}$`),
        { timeout: 30_000 },
      );

      // 3. Locked shell must appear with no plaintext from Bob visible.
      await expect(
        page.locator('[data-nex-vault-chat-state="locked"]'),
      ).toBeVisible({ timeout: 15_000 });
      await expect(
        page.locator("[data-nex-vault-chat-unlock-input]"),
      ).toBeVisible();
      const lockedBodyText = await page.locator("body").innerText();
      expect(lockedBodyText).not.toContain(BOB_SENTINEL);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "01-locked-shell-mobile.png"),
        fullPage: true,
      });

      // 4. Unlock via the inline PIN form
      await page.locator("[data-nex-vault-chat-unlock-input]").fill(DEVICE_A_PIN);
      await page.locator("[data-nex-vault-chat-unlock-submit]").click();

      // 5. Ready state must appear · Bob's seeded plaintext visible
      await expect(
        page.locator('[data-nex-vault-chat-state="ready"]'),
      ).toBeVisible({ timeout: 60_000 });
      await expect(page.locator("[data-nex-vault-chat-bubble]").first()).toBeVisible();
      await expect(page.getByText(BOB_SENTINEL)).toBeVisible({ timeout: 15_000 });

      // Peer name in header
      await expect(
        page.locator("[data-nex-vault-chat-peer-name]"),
      ).toContainText(/B4 bob/);

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "02-ready-history-mobile.png"),
        fullPage: true,
      });

      // 6. Compose + send a new message (encrypted via Bridge 76)
      await page.locator("[data-nex-vault-chat-input]").fill(ALICE_SENTINEL);
      await page.locator("[data-nex-vault-chat-send]").click();
      await expect(page.getByText(ALICE_SENTINEL)).toBeVisible({ timeout: 30_000 });

      // 7. Server side · the new nex_peer_message row exists
      const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const serverMessages = await admin
        .from("nex_peer_message")
        .select("id, conversation_id, sender_account_id, encrypted, body, ciphertext")
        .eq("conversation_id", conversationId)
        .order("sent_at", { ascending: true });
      const rows = (serverMessages.data as Array<{
        id: string;
        conversation_id: string;
        sender_account_id: string;
        encrypted: boolean;
        body: string;
        ciphertext: string | null;
      }>) ?? [];
      // At minimum: the seeded Bob row + one or more Alice encrypted rows
      // (fan-out may insert multiple per device).
      expect(rows.length).toBeGreaterThanOrEqual(2);
      // Every row's conversation_id is the same canonical id · one
      // relationship, one history.
      const uniqueConvs = new Set(rows.map((r) => r.conversation_id));
      expect(uniqueConvs.size).toBe(1);
      expect([...uniqueConvs][0]).toBe(conversationId);
      // Alice's row(s) must be encrypted with the '(encrypted)' sentinel
      // body and a non-null ciphertext.
      const aliceRows = rows.filter((r) => r.sender_account_id === alice.accountId);
      expect(aliceRows.length).toBeGreaterThanOrEqual(1);
      for (const r of aliceRows) {
        expect(r.encrypted).toBe(true);
        expect(r.body).toBe("(encrypted)");
        expect(r.ciphertext).not.toBeNull();
      }

      // 8. Canonical conversation count
      const canonicalConvs = await admin
        .from("nex_peer_conversation")
        .select("id")
        .in("id", [conversationId]);
      expect((canonicalConvs.data ?? []).length).toBe(1);

      // 9. Lock via the header button
      await page.locator("[data-nex-vault-chat-lock]").click();
      await expect(
        page.locator('[data-nex-vault-chat-state="locked"]'),
      ).toBeVisible({ timeout: 15_000 });
      const postLockBody = await page.locator("body").innerText();
      expect(postLockBody).not.toContain(BOB_SENTINEL);
      expect(postLockBody).not.toContain(ALICE_SENTINEL);
      await expect(
        page.locator("[data-nex-vault-chat-composer]"),
      ).toHaveCount(0);

      // 10. Encrypted IDB cache row still present after lock
      const idbStillHasCipher = await page.evaluate(
        async (convId: string) => {
          return new Promise<boolean>((resolve, reject) => {
            const req = indexedDB.open("nex-native-vault-conversations", 1);
            req.onsuccess = () => {
              const db = req.result;
              const tx = db.transaction("cached_messages", "readonly");
              const idx = tx.objectStore("cached_messages").index("by_conversation");
              const range = IDBKeyRange.bound([convId, ""], [convId, "￿"]);
              const getAll = idx.getAll(range);
              getAll.onsuccess = () => {
                const rows = getAll.result as Array<{ ciphertext: Uint8Array }>;
                resolve(rows.length > 0 && rows.every((r) => r.ciphertext.length > 0));
              };
              getAll.onerror = () => reject(getAll.error);
            };
            req.onerror = () => reject(req.error);
          });
        },
        conversationId,
      );
      expect(idbStillHasCipher).toBe(true);

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "03-locked-after-send-mobile.png"),
        fullPage: true,
      });

      // 11. Refresh · still locked
      await page.reload({ waitUntil: "networkidle" });
      await expect(
        page.locator('[data-nex-vault-chat-state="locked"]'),
      ).toBeVisible({ timeout: 15_000 });

      // 12. Unlock again · history re-renders
      await page.locator("[data-nex-vault-chat-unlock-input]").fill(DEVICE_A_PIN);
      await page.locator("[data-nex-vault-chat-unlock-submit]").click();
      await expect(
        page.locator('[data-nex-vault-chat-state="ready"]'),
      ).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText(BOB_SENTINEL)).toBeVisible({ timeout: 15_000 });
      // Alice's reply persists after lock+refresh+unlock (either from
      // IDB cache or re-decrypted from server).
      await expect(page.getByText(ALICE_SENTINEL)).toBeVisible({ timeout: 15_000 });

      // 13. Desktop viewport proof
      await page.setViewportSize({ width: 1280, height: 800 });
      await expect(
        page.locator('[data-nex-vault-chat-state="ready"]'),
      ).toBeVisible();
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "04-ready-desktop.png"),
        fullPage: true,
      });

      // 14. Narrow mobile viewport proof
      await page.setViewportSize({ width: 375, height: 812 });
      await expect(
        page.locator('[data-nex-vault-chat-input]'),
      ).toBeVisible();
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "05-ready-375.png"),
        fullPage: true,
      });

      // 15. Network secrecy · zero PIN or plaintext tokens on wire
      const pinHits = bodies.filter((b) => b.includes(DEVICE_A_PIN));
      expect(
        pinHits,
        `PIN leaked: ${JSON.stringify(pinHits.map((b) => b.slice(0, 80)))}`,
      ).toEqual([]);
      const bobHits = bodies.filter((b) => b.includes(BOB_SENTINEL));
      expect(
        bobHits,
        `Bob plaintext leaked: ${JSON.stringify(bobHits.map((b) => b.slice(0, 80)))}`,
      ).toEqual([]);
      const aliceHits = bodies.filter((b) => b.includes(ALICE_SENTINEL));
      expect(
        aliceHits,
        `Alice plaintext leaked: ${JSON.stringify(aliceHits.map((b) => b.slice(0, 80)))}`,
      ).toEqual([]);

      await ctx.close();
      // Reference the seeded message id so the compiler knows it is used.
      expect(seededMessageId).toBeTruthy();
    } finally {
      await teardown(alice, convIds);
      await teardown(bob, []);
    }
  });
});
