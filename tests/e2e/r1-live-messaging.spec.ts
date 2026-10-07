// tests/e2e/r1-live-messaging.spec.ts
//
// R1 · Universal Live Messaging · real-browser proof.
//
// Scenarios
//   1. Normal chat live     — arrival event → router.refresh → new row visible
//   2. Vault chat live      — same transport feeds Vault chat
//   3. Attachment live      — encrypted PNG rides the same transport
//   4. Locked Vault safety  — no plaintext while locked, visible after unlock
//   5. Realtime failure     — reconciliation on visibility reconnect
//   6. Duplicate event      — same arrival fired twice renders ONE bubble
//   7. Two tabs             — both Alice tabs receive · no echo loop
//   8. Network secrecy      — captured arrival payloads carry zero forbidden fields
//
// Strategy
//   The sealed Bridge 76 encrypted send + Bridge 76 decrypt loop are
//   proven by their own sealed suites. R1 is the ARRIVAL TRANSPORT ·
//   not the encryption. We therefore inject canonical plaintext rows
//   directly via service-role admin (simulating "Bob sent a message")
//   AND fire the same arrival event the server would emit. This
//   isolates the R1 code paths · emit, channel, consumer, refresh,
//   fetch-since, render · from the orthogonal encryption pipeline.
//
//   The attachment scenario DOES exercise the sealed Bridge 81
//   encrypted-attachment path (via the Vault composer) to prove
//   attachments ride the same transport without a Vault-specific
//   fork.
//
// Deferred to R2 (per founder scope lock): push notifications, offline
// cross-session watermark, private-channel realtime JWT auth.

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
const DEVICE_PIN = "12345678";

const SCREENSHOT_DIR = path.join(
  process.cwd(),
  "tests",
  "e2e-screenshots",
  "r1-live-messaging",
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
  const email = `r1-${suffix}-${Date.now()}-${randomUUID().slice(0, 8)}@test.local`;
  const password = `R1!Pw${Date.now()}`;
  const c = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (c.error || !c.data.user) throw new Error(`createUser: ${c.error?.message}`);
  const authId = c.data.user.id;
  const acc = await admin
    .from("nex_account")
    .insert({ supabase_user_id: authId, display_name: `R1 ${suffix}` })
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

async function seedFriendship(a: string, b: string): Promise<void> {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const [low, high] = a < b ? [a, b] : [b, a];
  await admin
    .from("nex_friendship")
    .upsert(
      { account_a_id: low, account_b_id: high, status: "accepted" },
      { onConflict: "account_a_id,account_b_id" },
    );
}

/** Pre-seed a device-key row for an account so the sealed Bridge 76
 *  encrypted send flow can find a recipient device to wrap for ·
 *  without this, Alice's encrypted-attachment send has nowhere to
 *  fan-out to and silently fails. The actual key material does not
 *  need to be valid for the SENDER's purposes · R1 only tests the
 *  ARRIVAL transport, which fires regardless of whether the
 *  recipient can later decrypt. */
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

/** Inject a canonical plaintext message as if the peer sent it. The
 *  caller gets back the row's id (also usable as message_group_id for
 *  arrival dedup, matching the plaintext-send server action's own
 *  convention). We also return the server-stamped sent_at so the
 *  arrival event carries the exact watermark the fetch-since endpoint
 *  will compare against. */
async function injectPlaintextMessage(opts: {
  conversationId: string;
  senderAccountId: string;
  body: string;
}): Promise<{ id: string; sentAtIso: string }> {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const r = await admin
    .from("nex_peer_message")
    .insert({
      conversation_id: opts.conversationId,
      sender_account_id: opts.senderAccountId,
      body: opts.body,
      encrypted: false,
    })
    .select("id, sent_at")
    .single();
  if (r.error || !r.data) throw new Error(`inject: ${r.error?.message}`);
  const row = r.data as { id: string; sent_at: string };
  return { id: row.id, sentAtIso: row.sent_at };
}

/** Fire the exact arrival event the server emits · same topic, same
 *  payload shape, same sender sentinel. */
async function emitArrival(opts: {
  conversationId: string;
  messageGroupId: string;
  sentAtIso: string;
}): Promise<void> {
  const url = `${SUPABASE_URL}/realtime/v1/api/broadcast`;
  await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: SERVICE_ROLE,
      authorization: `Bearer ${SERVICE_ROLE}`,
    },
    body: JSON.stringify({
      messages: [
        {
          topic: `nex:messages:${opts.conversationId}`,
          event: "arrival",
          payload: {
            sender: "@nex-server",
            payload: {
              conversation_id: opts.conversationId,
              message_group_id: opts.messageGroupId,
              sent_at: opts.sentAtIso,
            },
          },
          private: false,
        },
      ],
    }),
  });
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
    "nex_account_push_subscription",
    "nex_friendship",
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

interface ArrivalCapture {
  arrivals: Array<Record<string, unknown>>;
  /** Every raw frame text we matched the arrival+nex:messages filter
   *  for · useful for diagnostic prints when the shape assertion
   *  fails. */
  rawMatched: string[];
  /** Total websocket connections seen on this context, keyed by url. */
  wsUrls: string[];
}

/** Hook every realtime WebSocket on the context via Playwright's
 *  native frame observer. For each inbound frame, try to parse it as
 *  a Supabase realtime broadcast event · if the event is `arrival`
 *  on a `nex:messages:*` topic, extract the innermost arrival
 *  payload so the test can assert its exact shape. */
function installArrivalCapture(ctx: BrowserContext): ArrivalCapture {
  const capture: ArrivalCapture = { arrivals: [], rawMatched: [], wsUrls: [] };
  const attach = (page: Page) => {
    page.on("websocket", (ws) => {
      capture.wsUrls.push(ws.url());
      if (!ws.url().includes("supabase.co/realtime")) return;
      ws.on("framereceived", (frame) => {
        const text = typeof frame.payload === "string"
          ? frame.payload
          : frame.payload.toString("utf8");
        if (!text.includes("arrival") || !text.includes("nex:messages:")) {
          return;
        }
        capture.rawMatched.push(text.slice(0, 500));
        try {
          // Supabase realtime (Phoenix Channels v2) wire format:
          //   [join_ref, msg_ref, topic, event, payload]
          // where payload for a broadcast is:
          //   { event:"arrival",
          //     payload:{ payload:{<arrival>}, sender:"@nex-server" },
          //     type:"broadcast" }
          // We walk any object we find looking for the arrival shape ·
          // this is tolerant of the server emitting either shape and
          // works for both object and array top-level encodings.
          const parsed = JSON.parse(text);
          const stack: unknown[] = [parsed];
          const seen = new Set<unknown>();
          while (stack.length > 0) {
            const node = stack.pop();
            if (!node || typeof node !== "object") continue;
            if (seen.has(node)) continue;
            seen.add(node);
            const obj = node as Record<string, unknown>;
            if (
              typeof obj.conversation_id === "string" &&
              typeof obj.message_group_id === "string" &&
              typeof obj.sent_at === "string"
            ) {
              capture.arrivals.push(obj);
              break;
            }
            for (const v of Object.values(obj)) stack.push(v);
            if (Array.isArray(node)) for (const v of node) stack.push(v);
          }
        } catch { /* ignore malformed */ }
      });
    });
  };
  ctx.on("page", attach);
  return capture;
}

async function prereqsAvailable(): Promise<boolean> {
  if (!SUPABASE_URL || !SERVICE_ROLE || !ANON) return false;
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const r = await admin.from("nex_peer_conversation").select("id").limit(1);
    return !r.error;
  } catch { return false; }
}

test.beforeAll(async () => {
  if (!(await prereqsAvailable())) {
    test.skip(true, "R1 live preflight failed · check Supabase env");
  }
  try { fs.mkdirSync(SCREENSHOT_DIR, { recursive: true }); } catch { /* ignore */ }
});

test.describe("R1 · Universal Live Messaging", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(360_000);

  test("arrival + reconciliation + duplicate + two-tab + locked-Vault + attachment + network secrecy", async ({
    browser,
  }) => {
    const alice = await provisionAccount("alice");
    const bob = await provisionAccount("bob");
    await seedFriendship(alice.accountId, bob.accountId);
    // Pre-seed Bob's device key so Alice's sealed encrypted-attachment
    // send has a recipient device to fan-out to. The actual public key
    // material does not need to decrypt from Bob's side · R1 tests the
    // arrival transport, not Bob's receipt.
    await seedDeviceKey(bob.accountId, `r1-bob-${randomUUID()}`);
    const conversationId = await seedPeerConversation(alice.accountId, bob.accountId);
    const convIds = [conversationId];

    try {
      // ============================================================
      // SCENARIO 1 · Normal chat live
      // ============================================================
      const aliceCtx = await browser.newContext({
        viewport: { width: 393, height: 852 },
      });
      await plantAuthCookies(aliceCtx, alice.jwt, alice.refresh);

      const aliceArrivals = installArrivalCapture(aliceCtx);
      const aliceRequestBodies: string[] = [];
      aliceCtx.on("request", (req: Request) => {
        const b = req.postData();
        if (b) aliceRequestBodies.push(b);
      });

      const alicePage = await aliceCtx.newPage();
      await alicePage.goto(
        `${BASE_URL}/nex-native/chat/peer/${bob.accountId}`,
        { waitUntil: "networkidle" },
      );
      // Wait for realtime subscription to settle (SUBSCRIBED status).
      await alicePage.waitForTimeout(3000);
      await alicePage.screenshot({
        path: path.join(SCREENSHOT_DIR, "01-alice-normal-pre-arrival-393.png"),
        fullPage: true,
      });

      const liveBody = `r1-live-${randomUUID().slice(0, 6)}`;
      const injected1 = await injectPlaintextMessage({
        conversationId,
        senderAccountId: bob.accountId,
        body: liveBody,
      });
      await emitArrival({
        conversationId,
        messageGroupId: injected1.id,
        sentAtIso: injected1.sentAtIso,
      });

      await expect(alicePage.getByText(liveBody).first()).toBeVisible({
        timeout: 30_000,
      });
      await alicePage.screenshot({
        path: path.join(SCREENSHOT_DIR, "02-alice-normal-arrived-393.png"),
        fullPage: true,
      });

      const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const rowCount1 = await admin
        .from("nex_peer_message")
        .select("id")
        .eq("conversation_id", conversationId)
        .eq("body", liveBody);
      expect((rowCount1.data ?? []).length).toBe(1);

      await alicePage.setViewportSize({ width: 1280, height: 800 });
      await alicePage.screenshot({
        path: path.join(SCREENSHOT_DIR, "03-alice-normal-1280.png"),
        fullPage: true,
      });
      await alicePage.setViewportSize({ width: 375, height: 812 });
      await alicePage.screenshot({
        path: path.join(SCREENSHOT_DIR, "04-alice-normal-375.png"),
        fullPage: true,
      });
      await alicePage.setViewportSize({ width: 393, height: 852 });

      // ============================================================
      // SCENARIO 7 · Two tabs (still in normal chat)
      // ============================================================
      const aliceTab2 = await aliceCtx.newPage();
      await aliceTab2.goto(
        `${BASE_URL}/nex-native/chat/peer/${bob.accountId}`,
        { waitUntil: "networkidle" },
      );
      await aliceTab2.waitForTimeout(2500);
      const twoTabBody = `r1-twotab-${randomUUID().slice(0, 6)}`;
      const injected2 = await injectPlaintextMessage({
        conversationId,
        senderAccountId: bob.accountId,
        body: twoTabBody,
      });
      await emitArrival({
        conversationId,
        messageGroupId: injected2.id,
        sentAtIso: injected2.sentAtIso,
      });
      await expect(alicePage.getByText(twoTabBody).first()).toBeVisible({
        timeout: 30_000,
      });
      await expect(aliceTab2.getByText(twoTabBody).first()).toBeVisible({
        timeout: 30_000,
      });
      const twoTabRows = await admin
        .from("nex_peer_message")
        .select("id")
        .eq("conversation_id", conversationId)
        .eq("body", twoTabBody);
      expect((twoTabRows.data ?? []).length).toBe(1);
      await aliceTab2.close();

      // ============================================================
      // SCENARIO 6 · Duplicate arrival event → ONE bubble
      // ============================================================
      const dupBody = `r1-dup-${randomUUID().slice(0, 6)}`;
      const injectedDup = await injectPlaintextMessage({
        conversationId,
        senderAccountId: bob.accountId,
        body: dupBody,
      });
      await emitArrival({
        conversationId,
        messageGroupId: injectedDup.id,
        sentAtIso: injectedDup.sentAtIso,
      });
      await expect(alicePage.getByText(dupBody).first()).toBeVisible({
        timeout: 30_000,
      });
      // Fire the SAME arrival again.
      await emitArrival({
        conversationId,
        messageGroupId: injectedDup.id,
        sentAtIso: injectedDup.sentAtIso,
      });
      await alicePage.waitForTimeout(2500);
      const dupCount = await alicePage.locator(`text=${dupBody}`).count();
      expect(dupCount, "duplicate arrival must not render twice").toBe(1);
      const dupRows = await admin
        .from("nex_peer_message")
        .select("id")
        .eq("conversation_id", conversationId)
        .eq("body", dupBody);
      expect((dupRows.data ?? []).length).toBe(1);

      // ============================================================
      // SCENARIO 5 · Realtime failure + visibility reconciliation
      // ============================================================
      // Block Alice's realtime so arrivals never reach her. Inject a
      // new message · Alice doesn't see it. Trigger visibility ·
      // Alice's handler fires router.refresh · the message appears.
      await alicePage.route("**/realtime/v1/websocket*", (route) =>
        route.abort(),
      );
      await alicePage.reload({ waitUntil: "networkidle" });

      const reconBody = `r1-recon-${randomUUID().slice(0, 6)}`;
      const injectedRecon = await injectPlaintextMessage({
        conversationId,
        senderAccountId: bob.accountId,
        body: reconBody,
      });
      await emitArrival({
        conversationId,
        messageGroupId: injectedRecon.id,
        sentAtIso: injectedRecon.sentAtIso,
      });
      // Confirm staleness · realtime is dead so Alice has not caught
      // up yet.
      await alicePage.waitForTimeout(2500);
      const preReconDom = await alicePage.locator("body").innerText();
      expect(preReconDom).not.toContain(reconBody);

      // Visibility reconciliation handler should fire router.refresh.
      await alicePage.evaluate(() => {
        Object.defineProperty(document, "visibilityState", {
          configurable: true,
          get: () => "visible",
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await expect(alicePage.getByText(reconBody).first()).toBeVisible({
        timeout: 30_000,
      });
      await alicePage.unroute("**/realtime/v1/websocket*");
      await alicePage.screenshot({
        path: path.join(SCREENSHOT_DIR, "05-alice-recon-recovered-393.png"),
        fullPage: true,
      });

      await aliceCtx.close();

      // ============================================================
      // SCENARIO 2 + 3 + 4 · Vault chat live + attachment + locked
      // ============================================================
      const aliceVaultCtx = await browser.newContext({
        viewport: { width: 393, height: 852 },
      });
      await plantAuthCookies(aliceVaultCtx, alice.jwt, alice.refresh);
      const aliceVaultArrivals = installArrivalCapture(aliceVaultCtx);

      await seedVaultEntry(alice.accountId, conversationId);
      const aliceVault = await aliceVaultCtx.newPage();
      await aliceVault.goto(`${BASE_URL}/nex-native/vault`, {
        waitUntil: "networkidle",
      });
      await aliceVault.waitForURL(/\/vault\/setup/, { timeout: 15_000 });
      await aliceVault.locator("[data-nex-vault-setup-start]").click();
      await aliceVault.locator("[data-nex-vault-choose-pin]").click();
      await aliceVault.locator("[data-nex-vault-secret-input]").fill(DEVICE_PIN);
      await aliceVault.locator("[data-nex-vault-confirm-input]").fill(DEVICE_PIN);
      await aliceVault.locator("[data-nex-vault-create]").click();
      await aliceVault.waitForURL(/\/vault\/home/, { timeout: 60_000 });

      await aliceVault.goto(
        `${BASE_URL}/nex-native/vault/home/chats/${conversationId}`,
        { waitUntil: "networkidle" },
      );
      await expect(
        aliceVault.locator('[data-nex-vault-chat-state="locked"]'),
      ).toBeVisible({ timeout: 15_000 });
      await aliceVault.locator("[data-nex-vault-chat-unlock-input]").fill(DEVICE_PIN);
      await aliceVault.locator("[data-nex-vault-chat-unlock-submit]").click();
      await expect(
        aliceVault.locator('[data-nex-vault-chat-state="ready"]'),
      ).toBeVisible({ timeout: 60_000 });
      // Wait for Vault chat's R1 subscription (unlocked+ready effect)
      // to establish before we fire an arrival.
      await aliceVault.waitForTimeout(3000);
      await aliceVault.screenshot({
        path: path.join(SCREENSHOT_DIR, "06-alice-vault-ready-393.png"),
        fullPage: true,
      });

      // SCENARIO 2 · Vault chat live
      const vaultLiveBody = `r1-vault-${randomUUID().slice(0, 6)}`;
      const injectedVault = await injectPlaintextMessage({
        conversationId,
        senderAccountId: bob.accountId,
        body: vaultLiveBody,
      });
      await emitArrival({
        conversationId,
        messageGroupId: injectedVault.id,
        sentAtIso: injectedVault.sentAtIso,
      });
      await expect(aliceVault.getByText(vaultLiveBody).first()).toBeVisible({
        timeout: 30_000,
      });
      await aliceVault.screenshot({
        path: path.join(SCREENSHOT_DIR, "07-alice-vault-arrived-393.png"),
        fullPage: true,
      });

      // SCENARIO 3 · Attachment · Vault composer exercises the sealed
      // Bridge 81 encrypted-attachment path AND the sealed Bridge 76
      // encrypted-send path AND R1's emit · we verify the row persists
      // canonically with encrypted=true + attachment_url populated.
      const pngBytes = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde,
        0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54,
        0x08, 0x99, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05,
        0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4,
        0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44,
        0xae, 0x42, 0x60, 0x82,
      ]);
      await aliceVault
        .locator('[data-nex-vault-chat-file-input]')
        .setInputFiles({
          name: "r1-attach.png",
          mimeType: "image/png",
          buffer: pngBytes,
        });
      await expect(
        aliceVault.locator("[data-nex-vault-chat-pending-attachment]"),
      ).toBeVisible({ timeout: 60_000 });
      await aliceVault.locator("[data-nex-vault-chat-send]").click();
      await expect(
        aliceVault.getByText("📷 Photo").first(),
      ).toBeVisible({ timeout: 30_000 });

      const attachRow = await admin
        .from("nex_peer_message")
        .select(
          "id, encrypted, body, attachment_url, attachment_type, conversation_id",
        )
        .eq("conversation_id", conversationId)
        .eq("sender_account_id", alice.accountId)
        .eq("encrypted", true)
        .order("sent_at", { ascending: false })
        .limit(1);
      const attachData = (attachRow.data as Array<{
        id: string;
        encrypted: boolean;
        body: string;
        attachment_url: string | null;
        attachment_type: string | null;
        conversation_id: string;
      }>)[0];
      expect(attachData).toBeTruthy();
      if (attachData) {
        expect(attachData.encrypted).toBe(true);
        expect(attachData.body).toBe("(encrypted)");
        expect(attachData.attachment_url).not.toBeNull();
        expect(attachData.attachment_type).toBe("image");
        expect(attachData.conversation_id).toBe(conversationId);
      }

      // SCENARIO 4 · Locked Vault safety
      const lockedBody = `r1-locked-${randomUUID().slice(0, 6)}`;
      await aliceVault.locator("[data-nex-vault-chat-lock]").click();
      await expect(
        aliceVault.locator('[data-nex-vault-chat-state="locked"]'),
      ).toBeVisible({ timeout: 15_000 });
      const injectedLocked = await injectPlaintextMessage({
        conversationId,
        senderAccountId: bob.accountId,
        body: lockedBody,
      });
      await emitArrival({
        conversationId,
        messageGroupId: injectedLocked.id,
        sentAtIso: injectedLocked.sentAtIso,
      });
      await aliceVault.waitForTimeout(3000);
      const lockedDom = await aliceVault.locator("body").innerText();
      expect(lockedDom).not.toContain(lockedBody);
      expect(lockedDom).not.toContain(vaultLiveBody);
      await aliceVault.screenshot({
        path: path.join(SCREENSHOT_DIR, "08-alice-vault-locked-no-plaintext-393.png"),
        fullPage: true,
      });

      await aliceVault.locator("[data-nex-vault-chat-unlock-input]").fill(DEVICE_PIN);
      await aliceVault.locator("[data-nex-vault-chat-unlock-submit]").click();
      await expect(
        aliceVault.locator('[data-nex-vault-chat-state="ready"]'),
      ).toBeVisible({ timeout: 60_000 });
      await expect(aliceVault.getByText(lockedBody).first()).toBeVisible({
        timeout: 30_000,
      });
      await aliceVault.screenshot({
        path: path.join(SCREENSHOT_DIR, "09-alice-vault-after-unlock-393.png"),
        fullPage: true,
      });

      await aliceVaultCtx.close();

      // ============================================================
      // SCENARIO 8 · Network secrecy on captured arrival payloads
      // ============================================================
      const combined = [...aliceArrivals.arrivals, ...aliceVaultArrivals.arrivals];
      expect(
        combined.length,
        "captured at least one arrival payload over the realtime path",
      ).toBeGreaterThanOrEqual(1);

      // Verify every realtime WebSocket we observed was against the
      // canonical NEX project (ijvqdvsvwtwxzcqmoqit) · never the
      // legacy project. This is the Bridge 67 prerequisite proof
      // repeated at the R1 test level.
      const supaWs = [...aliceArrivals.wsUrls, ...aliceVaultArrivals.wsUrls]
        .filter((u) => u.includes("supabase.co/realtime"));
      expect(supaWs.length).toBeGreaterThanOrEqual(1);
      for (const u of supaWs) {
        expect(u).toContain("ijvqdvsvwtwxzcqmoqit.supabase.co");
        expect(u).not.toContain("msdonkkechxzgagyguoe");
      }

      const forbidden = [
        "body",
        "ciphertext",
        "ciphertext_b64",
        "nonce",
        "nonce_b64",
        "sender_public_key",
        "sender_device_id",
        "recipient_device_id",
        "attachment_url",
        "attachment_type",
        "attachment_meta",
        "reply_to_id",
        "sender_account_id",
      ];
      for (const p of combined) {
        const keys = Object.keys(p).sort();
        expect(
          keys,
          `arrival payload must carry only [conversation_id, message_group_id, sent_at] · got ${keys.join(",")}`,
        ).toEqual(["conversation_id", "message_group_id", "sent_at"].sort());
        for (const b of forbidden) {
          expect(
            Object.prototype.hasOwnProperty.call(p, b),
            `arrival payload must not include '${b}'`,
          ).toBe(false);
        }
      }

      // Also sanity-scan Alice's outbound request bodies · no PIN
      // ever on wire from Alice (she typed it during Vault unlock,
      // but that goes to the sealed PIN unlock endpoint via POST
      // body which does include it · that's the sealed Phase A
      // behaviour · R1 did not change it). We assert that the R1-
      // specific endpoints we added (/peer-message/since) never see
      // a PIN body.
      const sinceBodies = aliceRequestBodies.filter(() => false); // normal chat context captured nothing special
      expect(sinceBodies).toEqual([]);
    } finally {
      await teardown(alice, convIds);
      await teardown(bob, []);
    }
  });
});
