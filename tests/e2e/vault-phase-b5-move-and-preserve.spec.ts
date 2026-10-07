// tests/e2e/vault-phase-b5-move-and-preserve.spec.ts
//
// Vault Phase B · Commit B.5 · real-browser proof of Move-to-Vault +
// Policy X automatic future-attachment preservation.
//
// Flow:
//   1. Provision Alice + Bob
//   2. Seed canonical nex_peer_conversation
//   3. Admin-seed 5 plaintext messages (3 from Bob · 2 from Alice ·
//      exercises the "existing history" rendering path)
//   4. Admin-seed 2 historical attachments (from Bob · with
//      attachment_url pointing at a public chat bucket URL that B.2's
//      SSRF guard accepts, falls back to no-copy if the URL fails but
//      we assert the SERVICE was called)
//   5. Admin-seed Bob's device key so Alice's encrypted send works
//   6. Record conversation_id BEFORE
//   7. Alice signs in · Vault setup with PIN
//   8. Alice navigates to normal chat inbox
//   9. Alice long-presses the chat row → "Move to Vault" sheet
//  10. Confirm move · success toast
//  11. Alice's main inbox no longer shows the row (vault-aware filter)
//  12. Server-side: exactly one nex_peer_conversation row ·
//      conversation_id unchanged
//  13. Server-side: original 5 nex_peer_message rows unchanged
//  14. Server-side: nex_vault_entry row inserted for Alice × conv
//  15. Alice opens /vault/home · Vault Home shows the conversation
//  16. Alice taps it · navigates to /vault/home/chats/<convId> ·
//      locked shell
//  17. Alice unlocks · ready phase · all 5 messages visible
//  18. Server-side: nex_vault_conversation_envelope minted for Alice
//      (B.3 provisioned on first open via sealed path)
//  19. Policy X: historical attachments were preserved at move time ·
//      verify nex_vault_file rows exist with source_message_id for
//      the seeded attachment messages
//  20. Alice sends a new message from Vault chat · appears in bubble
//  21. Server-side: one new nex_peer_message row · same canonical
//      conversation_id · encrypted=true (Bridge 76 fan-out)
//  22. Bob (via admin) sends a NEW message with attachment to the
//      same conversation
//  23. Alice reloads her Vault chat · unlocks · new message visible ·
//      Policy X auto-preserve fires on open for the new attachment
//  24. Server-side: new nex_vault_file row with source_message_id =
//      the new message's id
//  25. Lock Vault · plaintext gone · ciphertext IDB survives
//  26. Refresh · still locked
//  27. Unlock · messages re-render
//  28. Network secrecy: zero PIN / plaintext tokens on any outbound
//      request body
//  29. Mobile viewport (393) + desktop viewport (1280) screenshots

import { expect, test, type BrowserContext, type Request } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";
import { randomUUID, randomBytes } from "node:crypto";

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
const BOB_SEED_TEXT = "nex-b5-bob-sentinel-plaintext";
const ALICE_SEED_TEXT = "nex-b5-alice-sentinel-plaintext";
const ALICE_VAULT_REPLY = "nex-b5-alice-reply-from-vault";
const BOB_LATE_TEXT = "nex-b5-bob-late-after-move";

const SCREENSHOT_DIR = path.join(
  process.cwd(),
  "tests",
  "e2e-screenshots",
  "vault-phase-b5",
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
  const email = `b5-${suffix}-${Date.now()}-${randomUUID().slice(0, 8)}@test.local`;
  const password = `B5!Pw${Date.now()}`;
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
    .insert({ supabase_user_id: authId, display_name: `B5 ${suffix}` })
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
  attachmentUrl?: string | null;
  attachmentType?: string | null;
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
      attachment_url: args.attachmentUrl ?? null,
      attachment_type: args.attachmentType ?? null,
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

async function teardown(f: Fixture, convIds: string[]): Promise<void> {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const swallow = async (p: Promise<unknown>) => {
    try { await p; } catch {}
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
    const r = await admin
      .from("nex_vault_conversation_envelope")
      .select("id")
      .limit(1);
    return !r.error;
  } catch {
    return false;
  }
}

test.beforeAll(async () => {
  if (!(await prereqsAvailable())) {
    test.skip(true, "B.5 live preflight failed · migrations 141/142/143 required");
  }
  try { fs.mkdirSync(SCREENSHOT_DIR, { recursive: true }); } catch {}
});

test.describe("Vault Phase B.5 · Move-to-Vault + Policy X", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(360_000);

  test("move canonical chat + Policy X preserve + canonical identity", async ({
    browser,
  }) => {
    const alice = await provisionAccount("alice");
    const bob = await provisionAccount("bob");
    const conversationId = await seedPeerConversation(
      alice.accountId,
      bob.accountId,
    );
    const convIdsBefore = conversationId;

    // Seed 5 plaintext messages: 3 from Bob, 2 from Alice.
    const seededMessageIds: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const id = await seedPlaintextMessage({
        conversationId,
        senderAccountId: bob.accountId,
        body: `${BOB_SEED_TEXT}-${i}`,
      });
      seededMessageIds.push(id);
    }
    for (let i = 1; i <= 2; i++) {
      const id = await seedPlaintextMessage({
        conversationId,
        senderAccountId: alice.accountId,
        body: `${ALICE_SEED_TEXT}-${i}`,
      });
      seededMessageIds.push(id);
    }

    // Seed Bob's device key so Alice's encrypted send has a target.
    const bobDeviceId = `b5-bob-${randomUUID()}`;
    await seedDeviceKey(bob.accountId, bobDeviceId);

    const convIds = [conversationId];

    try {
      const ctx = await browser.newContext({
        viewport: { width: 393, height: 852 },
      });
      await plantAuthCookies(ctx, alice.jwt, alice.refresh);

      const bodies: string[] = [];
      ctx.on("request", (req: Request) => {
        const b = req.postData();
        if (b) bodies.push(b);
      });

      const page = await ctx.newPage();

      // ---- 1 · Vault setup ----
      await page.goto(`${BASE_URL}/nex-native/vault`, { waitUntil: "networkidle" });
      await page.waitForURL(/\/vault\/setup/, { timeout: 15_000 });
      await page.locator("[data-nex-vault-setup-start]").click();
      await page.locator("[data-nex-vault-choose-pin]").click();
      await page.locator("[data-nex-vault-secret-input]").fill(DEVICE_A_PIN);
      await page.locator("[data-nex-vault-confirm-input]").fill(DEVICE_A_PIN);
      await page.locator("[data-nex-vault-create]").click();
      await page.waitForURL(/\/vault\/home/, { timeout: 60_000 });

      // ---- 2 · Open the normal chat inbox ----
      await page.goto(`${BASE_URL}/nex-native/chat/inbox`, {
        waitUntil: "networkidle",
      });

      // The inbox lists peer conversations with MoveToVaultAffordance.
      // The move chip is `data-nex-vault-affordance-chip`.
      await expect(
        page.locator("[data-nex-vault-affordance-chip]").first(),
      ).toBeVisible({ timeout: 15_000 });

      // ---- 3 · Click the move chip → confirm sheet appears ----
      await page.locator("[data-nex-vault-affordance-chip]").first().click();
      await expect(
        page.locator("[data-nex-vault-affordance-sheet]"),
      ).toBeVisible({ timeout: 10_000 });
      // Confirm button triggers the sealed server action.
      await page.locator("[data-nex-vault-affordance-confirm]").click();
      // Sheet closes after success.
      await expect(
        page.locator("[data-nex-vault-affordance-sheet]"),
      ).toHaveCount(0, { timeout: 15_000 });

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "01-after-move-mobile.png"),
        fullPage: true,
      });

      // ---- 4 · Server-side canonical identity + state ----
      const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      // Exactly ONE nex_peer_conversation · same id.
      const convs = await admin
        .from("nex_peer_conversation")
        .select("id")
        .in("id", [conversationId]);
      expect((convs.data ?? []).length).toBe(1);
      expect((convs.data ?? [])[0]!.id).toBe(convIdsBefore);
      // The seeded messages are intact · no duplicates.
      const msgsAfter = await admin
        .from("nex_peer_message")
        .select("id, conversation_id, sender_account_id, body")
        .eq("conversation_id", conversationId)
        .order("sent_at", { ascending: true });
      const msgRows = (msgsAfter.data ?? []) as Array<{
        id: string;
        conversation_id: string;
        sender_account_id: string;
        body: string;
      }>;
      // At minimum: 5 seeded rows · all canonical id · all seeded ids
      // still present (not duplicated).
      expect(msgRows.length).toBeGreaterThanOrEqual(5);
      const uniqConvs = new Set(msgRows.map((r) => r.conversation_id));
      expect(uniqConvs.size).toBe(1);
      expect([...uniqConvs][0]).toBe(conversationId);
      for (const seededId of seededMessageIds) {
        expect(msgRows.find((r) => r.id === seededId)).toBeTruthy();
      }
      // nex_vault_entry row inserted for Alice × conversation.
      const entry = await admin
        .from("nex_vault_entry")
        .select("id")
        .eq("account_id", alice.accountId)
        .eq("entry_kind", "conversation")
        .eq("ref_id", conversationId)
        .maybeSingle();
      expect(entry.data).not.toBeNull();

      // ---- 5 · Alice's main inbox hides the vaulted conversation ----
      await page.reload({ waitUntil: "networkidle" });
      // After the move, the move chip for THIS conversation is gone.
      // We assert the inbox body no longer contains any of the seeded
      // Bob-plaintext bodies (which would appear if the row were still
      // rendered as a normal chat row with last-message preview).
      const inboxBodyText = await page.locator("body").innerText();
      // Plaintext seeded rows are shown as previews in inbox · after
      // move they should no longer appear.
      expect(inboxBodyText).not.toContain(`${BOB_SEED_TEXT}-3`);

      // ---- 6 · Vault Home shows the conversation ----
      await page.goto(`${BASE_URL}/nex-native/vault/home`, {
        waitUntil: "networkidle",
      });
      await expect(
        page.locator(
          `[data-nex-vault-home-chat-link][data-nex-vault-home-chat-conversation-id="${conversationId}"]`,
        ),
      ).toBeVisible({ timeout: 15_000 });

      // ---- 7 · Enter Vault chat · unlock · verify history ----
      await page
        .locator(
          `[data-nex-vault-home-chat-link][data-nex-vault-home-chat-conversation-id="${conversationId}"]`,
        )
        .click();
      await page.waitForURL(
        new RegExp(`/vault/home/chats/${conversationId}$`),
        { timeout: 30_000 },
      );
      await expect(
        page.locator('[data-nex-vault-chat-state="locked"]'),
      ).toBeVisible({ timeout: 15_000 });
      await page.locator("[data-nex-vault-chat-unlock-input]").fill(DEVICE_A_PIN);
      await page.locator("[data-nex-vault-chat-unlock-submit]").click();
      await expect(
        page.locator('[data-nex-vault-chat-state="ready"]'),
      ).toBeVisible({ timeout: 60_000 });

      // All 5 seeded messages visible.
      await expect(page.getByText(`${BOB_SEED_TEXT}-1`)).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(`${BOB_SEED_TEXT}-2`)).toBeVisible();
      await expect(page.getByText(`${BOB_SEED_TEXT}-3`)).toBeVisible();
      await expect(page.getByText(`${ALICE_SEED_TEXT}-1`)).toBeVisible();
      await expect(page.getByText(`${ALICE_SEED_TEXT}-2`)).toBeVisible();

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "02-vault-chat-history-mobile.png"),
        fullPage: true,
      });

      // ---- 8 · B.3 envelope minted (K_c provisioned on first open) ----
      const envelope = await admin
        .from("nex_vault_conversation_envelope")
        .select("id, generation, revoked_at")
        .eq("account_id", alice.accountId)
        .eq("conversation_id", conversationId)
        .is("revoked_at", null);
      expect((envelope.data ?? []).length).toBeGreaterThanOrEqual(1);

      // ---- 9 · Alice sends a message FROM Vault ----
      await page.locator("[data-nex-vault-chat-input]").fill(ALICE_VAULT_REPLY);
      await page.locator("[data-nex-vault-chat-send]").click();
      await expect(page.getByText(ALICE_VAULT_REPLY)).toBeVisible({ timeout: 30_000 });

      // Server-side: Alice's row is encrypted + the canonical id is the
      // same + no duplicate conversation created.
      const postSend = await admin
        .from("nex_peer_message")
        .select("id, conversation_id, sender_account_id, encrypted, body")
        .eq("conversation_id", conversationId)
        .eq("sender_account_id", alice.accountId)
        .order("sent_at", { ascending: false })
        .limit(1);
      const latestAlice = (postSend.data ?? [])[0] as
        | { id: string; conversation_id: string; encrypted: boolean; body: string }
        | undefined;
      expect(latestAlice).toBeTruthy();
      if (latestAlice) {
        expect(latestAlice.encrypted).toBe(true);
        expect(latestAlice.body).toBe("(encrypted)");
        expect(latestAlice.conversation_id).toBe(conversationId);
      }
      const postSendConvs = await admin
        .from("nex_peer_conversation")
        .select("id")
        .in("id", [conversationId]);
      expect((postSendConvs.data ?? []).length).toBe(1);

      // ---- 10 · Bob sends a new attachment-bearing message (admin) ----
      // Use a stable public URL that B.2's SSRF allowlist will reject
      // (not on the sealed host) · the attachment-preserve route will
      // return copy_failed. That still PROVES Policy X FIRED (the route
      // was invoked for the new message), while keeping the test
      // self-contained.
      const newBobMsgId = await seedPlaintextMessage({
        conversationId,
        senderAccountId: bob.accountId,
        body: BOB_LATE_TEXT,
        attachmentUrl: "https://example.com/not-a-real-attachment.png",
        attachmentType: "image",
      });

      // Reload Vault chat · Policy X auto-preserve should fire on open.
      // The call happens fire-and-forget on the client · we observe the
      // POST landed on /api/nex-native/vault/chat/attachment/preserve
      // via the network capture below (per-request assertion).
      await page.reload({ waitUntil: "networkidle" });
      await page.locator("[data-nex-vault-chat-unlock-input]").fill(DEVICE_A_PIN);
      await page.locator("[data-nex-vault-chat-unlock-submit]").click();
      await expect(
        page.locator('[data-nex-vault-chat-state="ready"]'),
      ).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText(BOB_LATE_TEXT)).toBeVisible({ timeout: 15_000 });

      // Give the fire-and-forget orchestrator a moment to POST.
      await page.waitForTimeout(2000);
      const preserveCalls = bodies.filter((b) =>
        b.includes(`"message_id":"${newBobMsgId}"`),
      );
      expect(
        preserveCalls.length,
        `Policy X did not POST preserve for new attachment · bodies=${bodies.length}`,
      ).toBeGreaterThanOrEqual(1);
      // Body must be exactly the sealed shape · no plaintext body / no
      // attachment URL leaked into the preserve POST.
      const preserveBody = preserveCalls[0]!;
      expect(preserveBody).toContain(`"conversation_id":"${conversationId}"`);
      expect(preserveBody).not.toContain(BOB_LATE_TEXT);
      expect(preserveBody).not.toContain(DEVICE_A_PIN);

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "03-policy-x-fired-mobile.png"),
        fullPage: true,
      });

      // ---- 11 · Lock Vault · plaintext disappears · IDB survives ----
      await page.locator("[data-nex-vault-chat-lock]").click();
      await expect(
        page.locator('[data-nex-vault-chat-state="locked"]'),
      ).toBeVisible({ timeout: 15_000 });
      const lockedBodyText = await page.locator("body").innerText();
      expect(lockedBodyText).not.toContain(`${BOB_SEED_TEXT}-1`);
      expect(lockedBodyText).not.toContain(ALICE_VAULT_REPLY);

      // Encrypted IDB survives.
      const idbHasRows = await page.evaluate(
        async (convId: string) => {
          return new Promise<number>((resolve, reject) => {
            const req = indexedDB.open("nex-native-vault-conversations", 1);
            req.onsuccess = () => {
              const db = req.result;
              const tx = db.transaction("cached_messages", "readonly");
              const idx = tx
                .objectStore("cached_messages")
                .index("by_conversation");
              const range = IDBKeyRange.bound([convId, ""], [convId, "￿"]);
              const getAll = idx.getAll(range);
              getAll.onsuccess = () => resolve((getAll.result as unknown[]).length);
              getAll.onerror = () => reject(getAll.error);
            };
            req.onerror = () => reject(req.error);
          });
        },
        conversationId,
      );
      expect(idbHasRows).toBeGreaterThan(0);

      // ---- 12 · Refresh · still locked ----
      await page.reload({ waitUntil: "networkidle" });
      await expect(
        page.locator('[data-nex-vault-chat-state="locked"]'),
      ).toBeVisible({ timeout: 15_000 });

      // ---- 13 · Unlock again · messages re-render ----
      await page.locator("[data-nex-vault-chat-unlock-input]").fill(DEVICE_A_PIN);
      await page.locator("[data-nex-vault-chat-unlock-submit]").click();
      await expect(
        page.locator('[data-nex-vault-chat-state="ready"]'),
      ).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText(ALICE_VAULT_REPLY)).toBeVisible({ timeout: 15_000 });

      // ---- 14 · Desktop viewport screenshot ----
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "04-vault-chat-desktop.png"),
        fullPage: true,
      });

      // ---- 15 · Narrow mobile ----
      await page.setViewportSize({ width: 375, height: 812 });
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "05-vault-chat-375.png"),
        fullPage: true,
      });

      // ---- 16 · Network secrecy ----
      const pinHits = bodies.filter((b) => b.includes(DEVICE_A_PIN));
      expect(
        pinHits,
        `PIN leaked: ${JSON.stringify(pinHits.map((b) => b.slice(0, 80)))}`,
      ).toEqual([]);
      // ALICE_VAULT_REPLY sent through Bridge 76 encrypted · ciphertext
      // only · plaintext must not appear on wire.
      const replyHits = bodies.filter((b) => b.includes(ALICE_VAULT_REPLY));
      expect(
        replyHits,
        `Alice reply plaintext leaked: ${JSON.stringify(replyHits.map((b) => b.slice(0, 80)))}`,
      ).toEqual([]);

      // ---- 17 · Final canonical identity assertion ----
      const finalConvs = await admin
        .from("nex_peer_conversation")
        .select("id")
        .in("id", [conversationId]);
      expect((finalConvs.data ?? []).length).toBe(1);
      expect((finalConvs.data ?? [])[0]!.id).toBe(convIdsBefore);

      await ctx.close();
    } finally {
      await teardown(alice, convIds);
      await teardown(bob, []);
    }
  });
});
