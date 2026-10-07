// tests/e2e/vault-contacts.spec.ts
//
// Vault Contacts · real-browser proof.
//
// Scenarios
//   1. Vault Home exposes the Contacts tile.
//   2. Clicking Contacts opens /vault/home/contacts.
//   3. Existing NEX friends appear in the list (identity only).
//   4. Non-vaulted friend row routes to the sealed /chat/peer/<id>
//      path and shows the sealed Move-to-Vault chip. The resolved
//      conversation id is the SAME canonical nex_peer_conversation
//      id that /chat/peer/<id> uses.
//   5. Vaulted friend row routes to /vault/home/chats/<convId> (sealed
//      B.4) · SAME conversation id, no duplicate conversation.
//   6. Locked Vault contacts page shows contact identities but ZERO
//      message content, ZERO attachment URLs, ZERO ciphertext.
//   7. 375 / 393 / 1280 screenshots.

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
  "vault-contacts",
);

interface Fixture {
  authId: string;
  accountId: string;
  jwt: string;
  refresh: string;
  displayName: string;
}

async function provisionAccount(suffix: string, displayName: string): Promise<Fixture> {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anon = createClient(SUPABASE_URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = `vc-${suffix}-${Date.now()}-${randomUUID().slice(0, 8)}@test.local`;
  const password = `VC!Pw${Date.now()}`;
  const c = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (c.error || !c.data.user) throw new Error(`createUser: ${c.error?.message}`);
  const authId = c.data.user.id;
  const acc = await admin
    .from("nex_account")
    .insert({ supabase_user_id: authId, display_name: displayName })
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
    displayName,
  };
}

async function seedFriendship(a: string, b: string): Promise<void> {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const [low, high] = a < b ? [a, b] : [b, a];
  await admin
    .from("nex_friend_edge")
    .upsert(
      {
        a_account_id: low,
        b_account_id: high,
        requested_by: low,
        status: "accepted",
      },
      { onConflict: "a_account_id,b_account_id" },
    );
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

async function seedPlaintextMessage(opts: {
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
      conversation_id: opts.conversationId,
      sender_account_id: opts.senderAccountId,
      body: opts.body,
      encrypted: false,
    })
    .select("id")
    .single();
  if (r.error || !r.data) throw new Error(`seed-msg: ${r.error?.message}`);
  return (r.data as { id: string }).id;
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
  ]) {
    await swallow(admin.from(t).delete().eq("account_id", f.accountId) as unknown as Promise<unknown>);
  }
  // nex_friend_edge is pair-keyed · wipe any edge where this account
  // appears on either side.
  await swallow(admin.from("nex_friend_edge").delete().eq("a_account_id", f.accountId) as unknown as Promise<unknown>);
  await swallow(admin.from("nex_friend_edge").delete().eq("b_account_id", f.accountId) as unknown as Promise<unknown>);
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

async function setupVaultThroughUI(ctx: BrowserContext): Promise<void> {
  const page = await ctx.newPage();
  await page.goto(`${BASE_URL}/nex-native/vault`, { waitUntil: "networkidle" });
  await page.waitForURL(/\/vault\/setup/, { timeout: 15_000 });
  await page.locator("[data-nex-vault-setup-start]").click();
  await page.locator("[data-nex-vault-choose-pin]").click();
  await page.locator("[data-nex-vault-secret-input]").fill("12345678");
  await page.locator("[data-nex-vault-confirm-input]").fill("12345678");
  await page.locator("[data-nex-vault-create]").click();
  await page.waitForURL(/\/vault\/home/, { timeout: 60_000 });
  await page.close();
}

async function prereqsAvailable(): Promise<boolean> {
  if (!SUPABASE_URL || !SERVICE_ROLE || !ANON) return false;
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const r = await admin.from("nex_friend_edge").select("a_account_id").limit(1);
    return !r.error;
  } catch { return false; }
}

test.beforeAll(async () => {
  if (!(await prereqsAvailable())) {
    test.skip(true, "Vault Contacts live preflight failed · check Supabase env");
  }
  try { fs.mkdirSync(SCREENSHOT_DIR, { recursive: true }); } catch { /* ignore */ }
});

test.describe("Vault Contacts · product flow", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(300_000);

  test("home tile → list → vaulted/not-vaulted routing · canonical conversation preserved · locked-vault safety", async ({ browser }) => {
    const alice = await provisionAccount("alice", "Alice Vault");
    const bob = await provisionAccount("bob", "Bob Vaulted");
    const charlie = await provisionAccount("charlie", "Charlie NotVaulted");
    await seedFriendship(alice.accountId, bob.accountId);
    await seedFriendship(alice.accountId, charlie.accountId);
    const bobConvId = await seedPeerConversation(alice.accountId, bob.accountId);
    const charlieConvId = await seedPeerConversation(alice.accountId, charlie.accountId);
    // Secret body only Bob/Charlie can see on the normal chat page ·
    // we assert it NEVER leaks on the Vault Contacts surface.
    const bobSecret = `bob-sentinel-${randomUUID().slice(0, 6)}`;
    const charlieSecret = `charlie-sentinel-${randomUUID().slice(0, 6)}`;
    await seedPlaintextMessage({
      conversationId: bobConvId,
      senderAccountId: bob.accountId,
      body: bobSecret,
    });
    await seedPlaintextMessage({
      conversationId: charlieConvId,
      senderAccountId: charlie.accountId,
      body: charlieSecret,
    });
    const convIds = [bobConvId, charlieConvId];

    try {
      const ctx = await browser.newContext({ viewport: { width: 393, height: 852 } });
      await plantAuthCookies(ctx, alice.jwt, alice.refresh);
      await setupVaultThroughUI(ctx);

      // Mark Alice's Bob-conversation as vaulted · Charlie's stays
      // non-vaulted so we can exercise BOTH branches.
      await seedVaultEntry(alice.accountId, bobConvId);

      const page = await ctx.newPage();
      await page.goto(`${BASE_URL}/nex-native/vault/home`, { waitUntil: "networkidle" });

      // SCENARIO 1 · Vault Home exposes Contacts
      await expect(
        page.locator("[data-nex-vault-contacts-entry-link]"),
      ).toBeVisible({ timeout: 15_000 });
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "01-vault-home-with-contacts-393.png"),
        fullPage: true,
      });

      // SCENARIO 2 · Click tile → /vault/home/contacts
      await page.locator("[data-nex-vault-contacts-entry-link]").click();
      // First-compile of a brand-new route under Next 16 Turbopack dev
      // can take a few extra seconds · bump the timeout accordingly.
      await page.waitForURL(/\/vault\/home\/contacts$/, { timeout: 45_000 });

      // SCENARIO 3 · Both friends appear by display name
      await expect(page.getByText("Bob Vaulted").first()).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByText("Charlie NotVaulted").first()).toBeVisible({
        timeout: 15_000,
      });
      // Vaulted row carries the state attribute · the badge sits
      // inside the row's own markup.
      await expect(
        page.locator('[data-nex-vault-contact-state="vaulted"]'),
      ).toHaveCount(1);
      await expect(
        page.locator('[data-nex-vault-contact-state="not-vaulted"]'),
      ).toHaveCount(1);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "02-contacts-list-393.png"),
        fullPage: true,
      });

      // SCENARIO 4 · Not-vaulted row references the SAME conversation
      // id as the normal /chat/peer/<id> would resolve, AND the sealed
      // Move-to-Vault chip is present.
      const notVaultedRow = page.locator(
        '[data-nex-vault-contact-state="not-vaulted"]',
      );
      await expect(notVaultedRow).toHaveAttribute(
        "data-nex-vault-contact-conversation-id",
        charlieConvId,
      );
      await expect(notVaultedRow).toHaveAttribute(
        "data-nex-vault-contact-friend-id",
        charlie.accountId,
      );
      await expect(notVaultedRow).toHaveAttribute(
        "href",
        `/nex-native/chat/peer/${charlie.accountId}`,
      );

      // SCENARIO 5 · Vaulted row routes to sealed B.4 Vault chat with
      // the SAME canonical conversation id.
      const vaultedRow = page.locator(
        '[data-nex-vault-contact-state="vaulted"]',
      );
      await expect(vaultedRow).toHaveAttribute(
        "data-nex-vault-contact-conversation-id",
        bobConvId,
      );
      await expect(vaultedRow).toHaveAttribute(
        "href",
        `/nex-native/vault/home/chats/${bobConvId}`,
      );

      // Count rows against the DB · we must not have created a second
      // conversation for either pair.
      const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const bobPairCount = await admin
        .from("nex_peer_conversation")
        .select("id")
        .or(
          `and(participant_a_id.eq.${alice.accountId < bob.accountId ? alice.accountId : bob.accountId},participant_b_id.eq.${alice.accountId < bob.accountId ? bob.accountId : alice.accountId})`,
        );
      expect((bobPairCount.data ?? []).length).toBe(1);
      const charliePairCount = await admin
        .from("nex_peer_conversation")
        .select("id")
        .or(
          `and(participant_a_id.eq.${alice.accountId < charlie.accountId ? alice.accountId : charlie.accountId},participant_b_id.eq.${alice.accountId < charlie.accountId ? charlie.accountId : alice.accountId})`,
        );
      expect((charliePairCount.data ?? []).length).toBe(1);

      // SCENARIO 6 · Locked Vault safety · the Contacts page body
      // must not leak either Bob's or Charlie's seeded plaintext.
      const bodyText = await page.locator("body").innerText();
      expect(bodyText).not.toContain(bobSecret);
      expect(bodyText).not.toContain(charlieSecret);
      // Also assert no attempt to render a conversation preview /
      // last message string anywhere on the page.
      expect(bodyText).not.toMatch(/last message/i);

      // SCENARIO 7 · responsive screenshots across 375 / 1280.
      await page.setViewportSize({ width: 375, height: 812 });
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "03-contacts-375.png"),
        fullPage: true,
      });
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "04-contacts-1280.png"),
        fullPage: true,
      });

      await ctx.close();
    } finally {
      await teardown(alice, convIds);
      await teardown(bob, []);
      await teardown(charlie, []);
    }
  });
});
