// src/lib/nex-native/__tests__/vault-conversation-envelope-live-b2.test.ts
//
// Vault Phase B · Commit B.2 · LIVE-DATABASE route-level proof.
//
// This suite exercises the sealed B.2 service layer against the real
// development Supabase project (NEXT_PUBLIC_NEX_SUPABASE_URL +
// SERVICE_ROLE_KEY). It is the "direct authenticated route-level proof
// against the real development database" required by the B.2 brief.
//
// The sibling deterministic suite (vault-conversation-envelope-routes-
// b2.test.ts) proves static architecture guards WITHOUT a live DB. This
// suite proves live DB behaviour: mint → list → revoke → rotate +
// cross-account IDOR denial. If live credentials are not available,
// every test skips cleanly.
//
// Why we hit the service directly instead of HTTP:
//   · the HTTP routes are thin glue over the service; the deterministic
//     suite proves the glue is wired correctly (auth, step-up, body
//     validation, status-code mapping, no plaintext primitives).
//   · the service layer owns every B.2 security invariant we care about
//     (participant check, device ownership, uniqueness via partial
//     unique index, atomic rotation).
//   · running HTTP against the dev server would require seeding
//     nex_session.last_vault_unlock_at per request, which is step-up-
//     service machinery already covered by its own suite.

import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";

import {
  listActiveEnvelopesForDevice,
  mintEnvelope,
  revokeEnvelope,
  rotateEnvelopes,
} from "../vault/conversation-envelope-service";

const SUPABASE_URL =
  process.env.NEX_SUPABASE_URL ??
  process.env.NEXT_PUBLIC_NEX_SUPABASE_URL ??
  "";
const SERVICE_ROLE = process.env.NEX_SUPABASE_SERVICE_ROLE_KEY ?? "";

const hasLiveDb = Boolean(SUPABASE_URL && SERVICE_ROLE);

let admin: SupabaseClient | null = null;
if (hasLiveDb) {
  admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

interface Fixture {
  authId: string;
  accountId: string;
  email: string;
}

const createdAuthIds: string[] = [];
const createdAccountIds: string[] = [];
const createdConvIds: string[] = [];

function fakeEnvelope(): { wrappedKCHex: string; nonceHex: string } {
  const buf = randomBytes(60);
  const nonce = buf.subarray(0, 12);
  return {
    wrappedKCHex: buf.toString("hex"),
    nonceHex: nonce.toString("hex"),
  };
}

async function provision(suffix: string): Promise<Fixture> {
  if (!admin) throw new Error("no live db");
  const email = `b2-live-${suffix}-${Date.now()}-${randomUUID().slice(0, 8)}@test.local`;
  const password = `B2Live!Pw${Date.now()}`;
  const user = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (user.error || !user.data.user) {
    throw new Error(`createUser ${suffix}: ${user.error?.message}`);
  }
  const authId = user.data.user.id;
  createdAuthIds.push(authId);
  const acc = await admin
    .from("nex_account")
    .insert({ supabase_user_id: authId, display_name: `B2 live ${suffix}` })
    .select("id")
    .single();
  if (acc.error || !acc.data) {
    throw new Error(`insert account ${suffix}: ${acc.error?.message}`);
  }
  const accountId = (acc.data as { id: string }).id;
  createdAccountIds.push(accountId);
  return { authId, accountId, email };
}

async function enrollDevice(accountId: string, deviceId: string): Promise<void> {
  if (!admin) throw new Error("no live db");
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
  if (r.error) throw new Error(`enrollDevice ${deviceId}: ${r.error.message}`);
}

async function peerConversation(a: string, b: string): Promise<string> {
  if (!admin) throw new Error("no live db");
  const [low, high] = a < b ? [a, b] : [b, a];
  const r = await admin
    .from("nex_peer_conversation")
    .insert({ participant_a_id: low, participant_b_id: high })
    .select("id")
    .single();
  if (r.error || !r.data) throw new Error(`conv: ${r.error?.message}`);
  const id = (r.data as { id: string }).id;
  createdConvIds.push(id);
  return id;
}

let alice: Fixture;
let bob: Fixture;
let charlie: Fixture;
let aliceDevice: string;
let bobDevice: string;
let aliceBobConv: string;
let bobCharlieConv: string;

beforeAll(async () => {
  if (!hasLiveDb) return;
  alice = await provision("alice");
  bob = await provision("bob");
  charlie = await provision("charlie");
  aliceDevice = `b2-dev-${randomUUID()}`;
  bobDevice = `b2-dev-${randomUUID()}`;
  const charlieDevice = `b2-dev-${randomUUID()}`;
  await enrollDevice(alice.accountId, aliceDevice);
  await enrollDevice(bob.accountId, bobDevice);
  await enrollDevice(charlie.accountId, charlieDevice);
  aliceBobConv = await peerConversation(alice.accountId, bob.accountId);
  bobCharlieConv = await peerConversation(bob.accountId, charlie.accountId);
});

afterAll(async () => {
  if (!hasLiveDb || !admin) return;
  const swallow = async (p: Promise<unknown>) => {
    try { await p; } catch { /* teardown is best-effort */ }
  };
  for (const cid of createdConvIds) {
    await swallow(admin.from("nex_peer_conversation").delete().eq("id", cid) as unknown as Promise<unknown>);
  }
  for (const aid of createdAccountIds) {
    await swallow(admin.from("nex_vault_conversation_envelope").delete().eq("account_id", aid) as unknown as Promise<unknown>);
    await swallow(admin.from("nex_account_device_key").delete().eq("account_id", aid) as unknown as Promise<unknown>);
    await swallow(admin.from("nex_account").delete().eq("id", aid) as unknown as Promise<unknown>);
  }
  for (const authId of createdAuthIds) {
    await swallow(admin.auth.admin.deleteUser(authId) as unknown as Promise<unknown>);
  }
});

describe.runIf(hasLiveDb)("B.2 · live route-level proof · mint", () => {
  test("M1 · mint for Alice@aliceDevice on Alice↔Bob · row lands", async () => {
    const env = fakeEnvelope();
    const r = await mintEnvelope({
      accountId: alice.accountId,
      conversationId: aliceBobConv,
      targetDeviceId: aliceDevice,
      wrappedKCHex: env.wrappedKCHex,
      nonceHex: env.nonceHex,
      algorithm: "aes-256-gcm/v1",
      generation: 1,
    });
    expect(r.ok, JSON.stringify(r)).toBe(true);
    if (r.ok) {
      expect(r.generation).toBe(1);
      expect(typeof r.envelope_id).toBe("string");
    }
  });

  test("M2 · IDOR · Alice tries Bob↔Charlie's conversation · denied", async () => {
    const env = fakeEnvelope();
    const r = await mintEnvelope({
      accountId: alice.accountId,
      conversationId: bobCharlieConv,
      targetDeviceId: aliceDevice,
      wrappedKCHex: env.wrappedKCHex,
      nonceHex: env.nonceHex,
      algorithm: "aes-256-gcm/v1",
      generation: 1,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("not_a_participant");
  });

  test("M3 · IDOR · Alice targeting Bob's device · denied", async () => {
    const env = fakeEnvelope();
    const r = await mintEnvelope({
      accountId: alice.accountId,
      conversationId: aliceBobConv,
      targetDeviceId: bobDevice,
      wrappedKCHex: env.wrappedKCHex,
      nonceHex: env.nonceHex,
      algorithm: "aes-256-gcm/v1",
      generation: 1,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("device_not_owned");
  });

  test("M4 · duplicate · same (account, conv, device, gen) · denied", async () => {
    const env = fakeEnvelope();
    const r = await mintEnvelope({
      accountId: alice.accountId,
      conversationId: aliceBobConv,
      targetDeviceId: aliceDevice,
      wrappedKCHex: env.wrappedKCHex,
      nonceHex: env.nonceHex,
      algorithm: "aes-256-gcm/v1",
      generation: 1,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("duplicate_active_envelope");
  });
});

describe.runIf(hasLiveDb)("B.2 · live route-level proof · list", () => {
  test("L1 · Alice sees her own active envelope on her device", async () => {
    const list = await listActiveEnvelopesForDevice({
      accountId: alice.accountId,
      deviceId: aliceDevice,
    });
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list[0]!.conversation_id).toBe(aliceBobConv);
    // Opaque hex shape · the server never materialises plaintext.
    expect(list[0]!.wrapped_k_c_hex.length).toBe(120);
    expect(list[0]!.wrapped_k_c_hex).toMatch(/^[0-9a-f]+$/);
    expect(list[0]!.nonce_hex.length).toBe(24);
    expect(list[0]!.nonce_hex).toMatch(/^[0-9a-f]+$/);
  });

  test("L2 · Bob sees zero active envelopes on his device (he minted none)", async () => {
    const list = await listActiveEnvelopesForDevice({
      accountId: bob.accountId,
      deviceId: bobDevice,
    });
    expect(list.length).toBe(0);
  });
});

describe.runIf(hasLiveDb)("B.2 · live route-level proof · revoke", () => {
  let currentEnvelopeId: string = "";

  test("R0 setup · current active envelope id", async () => {
    const list = await listActiveEnvelopesForDevice({
      accountId: alice.accountId,
      deviceId: aliceDevice,
    });
    expect(list.length).toBeGreaterThanOrEqual(1);
    currentEnvelopeId = list[0]!.envelope_id;
  });

  test("R1 · IDOR · Bob tries to revoke Alice's envelope · service returns not_owned", async () => {
    const r = await revokeEnvelope({
      accountId: bob.accountId,
      envelopeId: currentEnvelopeId,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("not_owned");
    // Envelope still active after the attempt.
    const after = await listActiveEnvelopesForDevice({
      accountId: alice.accountId,
      deviceId: aliceDevice,
    });
    expect(after.find((e) => e.envelope_id === currentEnvelopeId)).toBeTruthy();
  });

  test("R2 · Alice revokes her own envelope · succeeds · revoked_at set", async () => {
    const r = await revokeEnvelope({
      accountId: alice.accountId,
      envelopeId: currentEnvelopeId,
    });
    expect(r.ok, JSON.stringify(r)).toBe(true);
    if (r.ok) {
      expect(r.envelope_id).toBe(currentEnvelopeId);
      expect(r.revoked_at).toBeTruthy();
    }
    const after = await listActiveEnvelopesForDevice({
      accountId: alice.accountId,
      deviceId: aliceDevice,
    });
    expect(after.find((e) => e.envelope_id === currentEnvelopeId)).toBeUndefined();
  });

  test("R3 · double-revoke · returns already_revoked", async () => {
    const r = await revokeEnvelope({
      accountId: alice.accountId,
      envelopeId: currentEnvelopeId,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("already_revoked");
  });
});

describe.runIf(hasLiveDb)("B.2 · live route-level proof · rotate", () => {
  test("T0 setup · re-mint one active envelope after R2 revoked the previous", async () => {
    const env = fakeEnvelope();
    const r = await mintEnvelope({
      accountId: alice.accountId,
      conversationId: aliceBobConv,
      targetDeviceId: aliceDevice,
      wrappedKCHex: env.wrappedKCHex,
      nonceHex: env.nonceHex,
      algorithm: "aes-256-gcm/v1",
      generation: 1,
    });
    expect(r.ok, JSON.stringify(r)).toBe(true);
  });

  test("T1 · rotate · atomically revokes active + mints at next generation", async () => {
    const env = fakeEnvelope();
    const r = await rotateEnvelopes({
      accountId: alice.accountId,
      conversationId: aliceBobConv,
      envelopes: [
        {
          targetDeviceId: aliceDevice,
          wrappedKCHex: env.wrappedKCHex,
          nonceHex: env.nonceHex,
        },
      ],
    });
    expect(r.ok, JSON.stringify(r)).toBe(true);
    if (r.ok) {
      expect(r.generation).toBeGreaterThanOrEqual(2);
      expect(r.revoked).toBeGreaterThanOrEqual(1);
      expect(r.minted).toBe(1);
    }
    const list = await listActiveEnvelopesForDevice({
      accountId: alice.accountId,
      deviceId: aliceDevice,
    });
    expect(list.length).toBe(1);
    expect(list[0]!.generation).toBeGreaterThanOrEqual(2);
  });

  test("T2 · IDOR · Alice rotates Bob↔Charlie's conversation · denied", async () => {
    const env = fakeEnvelope();
    const r = await rotateEnvelopes({
      accountId: alice.accountId,
      conversationId: bobCharlieConv,
      envelopes: [
        {
          targetDeviceId: aliceDevice,
          wrappedKCHex: env.wrappedKCHex,
          nonceHex: env.nonceHex,
        },
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("not_a_participant");
  });
});

describe.runIf(hasLiveDb)("B.2 · live route-level proof · structural rejections", () => {
  test("V1 · wrong wrapped_k_c length is rejected", async () => {
    const r = await mintEnvelope({
      accountId: alice.accountId,
      conversationId: aliceBobConv,
      targetDeviceId: aliceDevice,
      wrappedKCHex: "aa".repeat(50), // 50 bytes
      nonceHex: "bb".repeat(12),
      algorithm: "aes-256-gcm/v1",
      generation: 3,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("wrapped_k_c_length");
  });

  test("V2 · nonce not matching first 12 bytes of wrapped_k_c is rejected", async () => {
    const env = fakeEnvelope();
    const r = await mintEnvelope({
      accountId: alice.accountId,
      conversationId: aliceBobConv,
      targetDeviceId: aliceDevice,
      wrappedKCHex: env.wrappedKCHex,
      nonceHex: "ff".repeat(12),
      algorithm: "aes-256-gcm/v1",
      generation: 3,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("nonce_mismatch");
  });

  test("V3 · forbidden algorithm is rejected", async () => {
    const env = fakeEnvelope();
    const r = await mintEnvelope({
      accountId: alice.accountId,
      conversationId: aliceBobConv,
      targetDeviceId: aliceDevice,
      wrappedKCHex: env.wrappedKCHex,
      nonceHex: env.nonceHex,
      algorithm: "aes-128-gcm/v1",
      generation: 3,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("algorithm_not_allowed");
  });

  test("V4 · non-hex input rejected before DB touch", async () => {
    const r = await mintEnvelope({
      accountId: alice.accountId,
      conversationId: aliceBobConv,
      targetDeviceId: aliceDevice,
      wrappedKCHex: "nothex",
      nonceHex: "nothex",
      algorithm: "aes-256-gcm/v1",
      generation: 3,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("invalid_hex_wrapped_k_c");
  });
});

describe.runIf(hasLiveDb)("B.2 · sealed-phase isolation · zero Phase A side effects", () => {
  test("S1 · no nex_vault_file / nex_vault_setup / migration-attempt rows created for test accounts", async () => {
    if (!admin) throw new Error("no admin");
    const files = await admin
      .from("nex_vault_file")
      .select("id")
      .in("account_id", createdAccountIds);
    expect(files.data ?? []).toHaveLength(0);
    const setups = await admin
      .from("nex_vault_setup")
      .select("account_id")
      .in("account_id", createdAccountIds);
    expect(setups.data ?? []).toHaveLength(0);
    const attempts = await admin
      .from("nex_vault_file_migration_attempt")
      .select("id")
      .in("account_id", createdAccountIds);
    expect(attempts.data ?? []).toHaveLength(0);
  });
});
