// tests/e2e/vault-phase-b3-conversation-key.spec.ts
//
// Vault Phase B · Commit B.3 · real-browser proof for the client
// conversation-key module (K_c generation, VMK-wrapped mint, IDB
// encrypted cache, lock behaviour, refresh behaviour, network secrecy).
//
// Lifecycle:
//   · Alice provisioned via Supabase admin
//   · Alice signs in · Vault setup with PIN · Vault unlocked
//   · Alice ensures a canonical nex_peer_conversation exists with Bob
//     (seeded via admin · Bob is also provisioned)
//   · Enroll Alice's device key
//   · Navigate to /nex-native/vault/dev/b3-proof (minimal harness)
//   · From page.evaluate:
//       - provisionConversationKey(conv, device) → mints envelope via
//         B.2 · stores K_c in memory
//       - cacheEncryptedMessage(conv, msg, plaintext) → IDB write
//       - readCachedMessage(conv, msg) → plaintext restored
//   · Verify DB: envelope row exists · wrapped_k_c = 60 bytes · nonce = 12
//   · Verify IDB: ciphertext present · plaintext NOT present in record
//   · LOCK: window.__nexB3.vaultSession.clearVmk() ·
//           window.__nexB3.convKey.clearInMemoryConversationKeys()
//   · Verify: readCachedMessage returns vault_locked · no_key_for_generation
//   · Verify: IDB ciphertext survives
//   · REFRESH: page.reload() · Vault remains locked
//   · Playwright should NOT see plaintext in any outbound request body
//
// If live credentials are unavailable the suite skips cleanly.

import { expect, test, type BrowserContext, type Request } from "@playwright/test";
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

const DEVICE_A_PIN = "12345678";
const SENTINEL_PLAINTEXT = "nex-b3-sentinel-plaintext-01234567";

const SCREENSHOT_DIR = path.join(
  process.cwd(),
  "tests",
  "e2e-screenshots",
  "vault-phase-b3",
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
  const email = `b3-${suffix}-${Date.now()}@test.local`;
  const password = `B3!Pw${Date.now()}`;
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
    .insert({ supabase_user_id: authId, display_name: `B3 ${suffix}` })
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

async function teardown(f: Fixture, convIds: string[]): Promise<void> {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const swallow = async (p: Promise<unknown>) => {
    try { await p; } catch { /* ignore */ }
  };
  for (const cid of convIds) {
    await swallow(admin.from("nex_peer_conversation").delete().eq("id", cid) as unknown as Promise<unknown>);
  }
  for (const t of [
    "nex_vault_conversation_envelope",
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
    test.skip(true, "B.3 live preflight failed · migrations 141/142/143 required");
  }
  try { fs.mkdirSync(SCREENSHOT_DIR, { recursive: true }); } catch {}
});

test.describe("Vault Phase B.3 · client conversation-key end-to-end", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(300_000);

  test("provision K_c → cache → decrypt → lock → refresh → relock", async ({ browser }) => {
    const alice = await provisionAccount("alice");
    const bob = await provisionAccount("bob");
    const conversationId = await seedPeerConversation(alice.accountId, bob.accountId);
    const convIds = [conversationId];
    try {
      const ctx = await browser.newContext();
      await plantAuthCookies(ctx, alice.jwt, alice.refresh);

      // Network capture · we want to prove no plaintext body ever
      // reaches the server.
      const bodies: string[] = [];
      ctx.on("request", (req: Request) => {
        const body = req.postData();
        if (body) bodies.push(body);
      });

      const page = await ctx.newPage();

      // 1. Vault setup (sealed A.3b flow)
      await page.goto(`${BASE_URL}/nex-native/vault`, { waitUntil: "networkidle" });
      await page.waitForURL(/\/vault\/setup/, { timeout: 15_000 });
      await page.locator("[data-nex-vault-setup-start]").click();
      await page.locator("[data-nex-vault-choose-pin]").click();
      await page.locator("[data-nex-vault-secret-input]").fill(DEVICE_A_PIN);
      await page.locator("[data-nex-vault-confirm-input]").fill(DEVICE_A_PIN);
      await page.locator("[data-nex-vault-create]").click();
      await page.waitForURL(/\/vault\/home/, { timeout: 60_000 });

      // 2. Navigate to the B.3 harness · hard navigation wipes the
      //    tab-scoped VMK (correct Phase A behaviour) · we re-unlock
      //    on the harness page via the sealed unlockVault orchestrator
      //    so the test proves BOTH setup+unlock AND the client crypto
      //    stack work together.
      await page.goto(`${BASE_URL}/nex-native/vault/dev/b3-proof`, {
        waitUntil: "networkidle",
      });
      await expect(
        page.locator('[data-nex-b3-ready="true"]'),
      ).toBeVisible({ timeout: 15_000 });

      // 3. Prime the device key so B.2 mint's assertOwnDevice passes.
      const deviceId = await page.evaluate(async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const h = (globalThis as any).__nexB3;
        const dk = await h.ensureDeviceKey();
        return dk.deviceId as string;
      });
      expect(deviceId.length).toBeGreaterThanOrEqual(8);

      // 3b. Re-unlock Vault on the harness page.
      const unlockRes = await page.evaluate(
        async (args: { pin: string; deviceId: string }) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const h = (globalThis as any).__nexB3;
          const r = await h.unlockVault({
            mode: "pin",
            secret: args.pin,
            deviceId: args.deviceId,
          });
          return r;
        },
        { pin: DEVICE_A_PIN, deviceId },
      );
      expect(unlockRes.ok, JSON.stringify(unlockRes)).toBe(true);
      const unlocked = await page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (globalThis as any).__nexB3.vaultSession.readVaultSessionSnapshot().unlocked;
      });
      expect(unlocked).toBe(true);

      // 4. Provision K_c + mint envelope
      const mintOutcome = await page.evaluate(
        async (args: { conversationId: string; deviceId: string }) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const h = (globalThis as any).__nexB3;
          return h.convKey.provisionConversationKey({
            conversationId: args.conversationId,
            targetDeviceId: args.deviceId,
          });
        },
        { conversationId, deviceId },
      );
      expect(mintOutcome.ok, JSON.stringify(mintOutcome)).toBe(true);
      if (mintOutcome.ok) {
        expect(mintOutcome.generation).toBe(1);
        expect(typeof mintOutcome.envelope_id).toBe("string");
      }

      // 5. Verify the envelope landed server-side as opaque bytes.
      const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const envRow = await admin
        .from("nex_vault_conversation_envelope")
        .select("wrapped_k_c, nonce, algorithm, generation, target_device_id, revoked_at")
        .eq("account_id", alice.accountId)
        .eq("conversation_id", conversationId)
        .single();
      expect(envRow.data).toBeTruthy();
      const row = envRow.data as {
        wrapped_k_c: string | Buffer;
        nonce: string | Buffer;
        algorithm: string;
        generation: number;
        target_device_id: string;
        revoked_at: string | null;
      };
      const wrappedHex =
        typeof row.wrapped_k_c === "string"
          ? row.wrapped_k_c.replace(/^\\x/, "")
          : row.wrapped_k_c.toString("hex");
      const nonceHex =
        typeof row.nonce === "string"
          ? row.nonce.replace(/^\\x/, "")
          : row.nonce.toString("hex");
      expect(wrappedHex).toHaveLength(120); // 60 bytes = 120 hex chars
      expect(nonceHex).toHaveLength(24); // 12 bytes = 24 hex chars
      expect(row.algorithm).toBe("aes-256-gcm/v1");
      expect(row.generation).toBe(1);
      expect(row.target_device_id).toBe(deviceId);
      expect(row.revoked_at).toBeNull();

      // 6. Cache an encrypted message · verify IDB write + decrypt round-trip
      const messageId = randomUUID();
      const cacheResult = await page.evaluate(
        async (args: { conversationId: string; messageId: string; plaintext: string }) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const h = (globalThis as any).__nexB3;
          const r = await h.convKey.cacheEncryptedMessage({
            conversationId: args.conversationId,
            messageId: args.messageId,
            plaintext: new TextEncoder().encode(args.plaintext),
          });
          return r;
        },
        { conversationId, messageId, plaintext: SENTINEL_PLAINTEXT },
      );
      expect(cacheResult.ok, JSON.stringify(cacheResult)).toBe(true);

      const readWhileUnlocked = await page.evaluate(
        async (args: { conversationId: string; messageId: string }) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const h = (globalThis as any).__nexB3;
          const r = await h.convKey.readCachedMessage({
            conversationId: args.conversationId,
            messageId: args.messageId,
          });
          if ("error" in r) return { ok: false, error: r.error };
          return {
            ok: true,
            plaintext: new TextDecoder().decode(r.plaintext),
            generation: r.generation,
          };
        },
        { conversationId, messageId },
      );
      expect(readWhileUnlocked.ok, JSON.stringify(readWhileUnlocked)).toBe(true);
      if (readWhileUnlocked.ok) {
        expect(readWhileUnlocked.plaintext).toBe(SENTINEL_PLAINTEXT);
        expect(readWhileUnlocked.generation).toBe(1);
      }

      // 7. Inspect IDB: plaintext substring must NOT appear in any stored
      //    bytes · ciphertext record exists.
      const idbInspection = await page.evaluate(
        async (args: { conversationId: string; messageId: string; plaintext: string }) => {
          return new Promise<{
            found: boolean;
            ciphertextLen: number;
            plaintextInBytes: boolean;
          }>((resolve, reject) => {
            const req = indexedDB.open("nex-native-vault-conversations", 1);
            req.onsuccess = () => {
              const db = req.result;
              const tx = db.transaction("cached_messages", "readonly");
              const getReq = tx
                .objectStore("cached_messages")
                .get([args.conversationId, args.messageId]);
              getReq.onsuccess = () => {
                const row = getReq.result as
                  | { ciphertext: Uint8Array; nonce: Uint8Array }
                  | undefined;
                if (!row) {
                  resolve({ found: false, ciphertextLen: 0, plaintextInBytes: false });
                  return;
                }
                const plainBytes = new TextEncoder().encode(args.plaintext);
                let plainIn = false;
                for (let i = 0; i + plainBytes.length <= row.ciphertext.length; i++) {
                  let match = true;
                  for (let j = 0; j < plainBytes.length; j++) {
                    if (row.ciphertext[i + j] !== plainBytes[j]) {
                      match = false;
                      break;
                    }
                  }
                  if (match) {
                    plainIn = true;
                    break;
                  }
                }
                resolve({
                  found: true,
                  ciphertextLen: row.ciphertext.length,
                  plaintextInBytes: plainIn,
                });
              };
              getReq.onerror = () => reject(getReq.error);
            };
            req.onerror = () => reject(req.error);
          });
        },
        { conversationId, messageId, plaintext: SENTINEL_PLAINTEXT },
      );
      expect(idbInspection.found).toBe(true);
      expect(idbInspection.ciphertextLen).toBe(SENTINEL_PLAINTEXT.length + 16); // GCM tag
      expect(idbInspection.plaintextInBytes).toBe(false);

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "01-cached-encrypted.png"),
        fullPage: true,
      });

      // 8. LOCK · clear VMK + explicitly clear K_c memory
      await page.evaluate(async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const h = (globalThis as any).__nexB3;
        h.vaultSession.clearVmk();
        h.convKey.clearInMemoryConversationKeys();
      });

      const readWhileLocked = await page.evaluate(
        async (args: { conversationId: string; messageId: string }) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const h = (globalThis as any).__nexB3;
          const r = await h.convKey.readCachedMessage({
            conversationId: args.conversationId,
            messageId: args.messageId,
          });
          if ("error" in r) return { ok: false as const, error: r.error };
          return { ok: true as const };
        },
        { conversationId, messageId },
      );
      expect(readWhileLocked.ok).toBe(false);
      if (!readWhileLocked.ok) {
        expect(["vault_locked", "no_key_for_generation"]).toContain(readWhileLocked.error);
      }

      // 9. The ciphertext row still exists post-lock.
      const idbPostLock = await page.evaluate(
        async (args: { conversationId: string; messageId: string }) => {
          return new Promise<{ found: boolean; ciphertextLen: number }>((resolve, reject) => {
            const req = indexedDB.open("nex-native-vault-conversations", 1);
            req.onsuccess = () => {
              const db = req.result;
              const tx = db.transaction("cached_messages", "readonly");
              const getReq = tx
                .objectStore("cached_messages")
                .get([args.conversationId, args.messageId]);
              getReq.onsuccess = () => {
                const row = getReq.result as { ciphertext: Uint8Array } | undefined;
                resolve({
                  found: !!row,
                  ciphertextLen: row ? row.ciphertext.length : 0,
                });
              };
              getReq.onerror = () => reject(getReq.error);
            };
            req.onerror = () => reject(req.error);
          });
        },
        { conversationId, messageId },
      );
      expect(idbPostLock.found).toBe(true);
      expect(idbPostLock.ciphertextLen).toBe(SENTINEL_PLAINTEXT.length + 16);

      // 10. REFRESH · Vault stays locked (VMK is tab-scoped memory ·
      //     reload wipes it).
      await page.reload({ waitUntil: "networkidle" });
      await expect(
        page.locator('[data-nex-b3-ready="true"]'),
      ).toBeVisible({ timeout: 15_000 });

      const readAfterRefresh = await page.evaluate(
        async (args: { conversationId: string; messageId: string }) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const h = (globalThis as any).__nexB3;
          const snap = h.vaultSession.readVaultSessionSnapshot();
          const read = await h.convKey.readCachedMessage({
            conversationId: args.conversationId,
            messageId: args.messageId,
          });
          return {
            unlocked: snap.unlocked,
            readError: "error" in read ? read.error : null,
          };
        },
        { conversationId, messageId },
      );
      expect(readAfterRefresh.unlocked).toBe(false);
      expect(readAfterRefresh.readError).toBe("vault_locked");

      // 11. Network secrecy · PIN plaintext + sentinel plaintext never
      //     appeared in any outbound body.
      const pinHits = bodies.filter((b) => b.includes(DEVICE_A_PIN));
      expect(pinHits, `PIN leaked: ${JSON.stringify(pinHits.map((b) => b.slice(0, 80)))}`).toEqual(
        [],
      );
      const plainHits = bodies.filter((b) => b.includes(SENTINEL_PLAINTEXT));
      expect(
        plainHits,
        `plaintext leaked: ${JSON.stringify(plainHits.map((b) => b.slice(0, 80)))}`,
      ).toEqual([]);

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "02-locked-post-refresh.png"),
        fullPage: true,
      });

      await ctx.close();
    } finally {
      await teardown(alice, convIds);
      await teardown(bob, []);
    }
  });
});
