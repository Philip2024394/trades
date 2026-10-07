// src/lib/nex-native/vault/conversation-envelope-service.ts
//
// Vault Phase B · Commit B.2 · server-side business logic for the
// per-conversation key envelope table (migration 143).
//
// Scope boundary (do NOT expand):
//   · This file manages the per-device wrapped K_c envelope lifecycle:
//     mint, list, revoke, rotate.
//   · It performs an application-level participant check against the
//     canonical nex_peer_conversation (one authoritative conversation
//     per Alice↔Bob pair · see B.1 doctrine · migration 143).
//   · It never generates, decrypts, or holds plaintext key material.
//     wrapped_k_c + nonce are opaque bytes; the server only verifies
//     the sealed Phase A STRUCTURAL shape via
//     conversation-envelope-validator.ts and lets the row-level CHECK
//     constraints in migration 143 do the final defence.
//   · It never creates a nex_peer_conversation row and never writes to
//     nex_peer_message. Deleting an envelope cannot cascade into chat
//     history (there is no reverse FK · see migration 143 doctrine).

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";
import { PHASE_A_ALGORITHM } from "./key-hierarchy";
import {
  validateEnvelopeShape,
  hexToBytes,
  bytesToHex,
  WRAPPED_K_C_LENGTH,
  NONCE_LENGTH,
  type EnvelopeShapeFailure,
} from "./conversation-envelope-validator";

const ENVELOPE_TABLE = "nex_vault_conversation_envelope";
const CONV_TABLE = "nex_peer_conversation";

export interface ParticipantCheckOk {
  ok: true;
}
export interface ParticipantCheckErr {
  ok: false;
  error: "conversation_not_found" | "not_a_participant";
}

/**
 * Verify the authenticated account is one of the two canonical
 * participants of the conversation. We never trust a client-supplied
 * account_id for this · the caller must pass the session's own
 * account.id.
 */
export async function assertIsParticipant(input: {
  accountId: string;
  conversationId: string;
}): Promise<ParticipantCheckOk | ParticipantCheckErr> {
  const { data, error } = await nexSupabaseAdmin
    .from(CONV_TABLE)
    .select("participant_a_id, participant_b_id")
    .eq("id", input.conversationId)
    .maybeSingle();
  if (error) {
    throw new Error(`conversation-envelope-service.assertIsParticipant: ${error.message}`);
  }
  if (!data) return { ok: false, error: "conversation_not_found" };
  const row = data as { participant_a_id: string; participant_b_id: string };
  if (
    row.participant_a_id !== input.accountId &&
    row.participant_b_id !== input.accountId
  ) {
    return { ok: false, error: "not_a_participant" };
  }
  return { ok: true };
}

/**
 * Verify the target device_id belongs to the authenticated account
 * (and is not revoked). Prevents one account from minting an envelope
 * at another account's device_id.
 */
export async function assertOwnDevice(input: {
  accountId: string;
  deviceId: string;
}): Promise<{ ok: true } | { ok: false; error: "device_not_owned" }> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_account_device_key")
    .select("device_id, revoked_at")
    .eq("account_id", input.accountId)
    .eq("device_id", input.deviceId)
    .maybeSingle();
  if (error) {
    throw new Error(`conversation-envelope-service.assertOwnDevice: ${error.message}`);
  }
  if (!data) return { ok: false, error: "device_not_owned" };
  const row = data as { revoked_at: string | null };
  if (row.revoked_at !== null) return { ok: false, error: "device_not_owned" };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// MINT
// ---------------------------------------------------------------------------

export interface MintInput {
  accountId: string;
  conversationId: string;
  targetDeviceId: string;
  wrappedKCHex: string;
  nonceHex: string;
  algorithm: string;
  generation: number;
}

export type MintResult =
  | {
      ok: true;
      envelope_id: string;
      generation: number;
    }
  | {
      ok: false;
      error:
        | "invalid_hex_wrapped_k_c"
        | "invalid_hex_nonce"
        | EnvelopeShapeFailure
        | "duplicate_active_envelope"
        | "conversation_not_found"
        | "not_a_participant"
        | "device_not_owned";
    };

/**
 * Insert an opaque envelope row. Fails on structural mismatch, on
 * participant check failure, on device-ownership failure, or on
 * uniqueness-collision with an existing active envelope at
 * (account, conversation, device, generation).
 */
export async function mintEnvelope(input: MintInput): Promise<MintResult> {
  const wrapped = hexToBytes(input.wrappedKCHex);
  if (!wrapped) return { ok: false, error: "invalid_hex_wrapped_k_c" };
  const nonce = hexToBytes(input.nonceHex);
  if (!nonce) return { ok: false, error: "invalid_hex_nonce" };

  const shape = validateEnvelopeShape({
    wrapped_k_c: wrapped,
    nonce,
    algorithm: input.algorithm,
    generation: input.generation,
    target_device_id: input.targetDeviceId,
  });
  if (!shape.ok) return { ok: false, error: shape.error };

  const participant = await assertIsParticipant({
    accountId: input.accountId,
    conversationId: input.conversationId,
  });
  if (!participant.ok) return { ok: false, error: participant.error };

  const device = await assertOwnDevice({
    accountId: input.accountId,
    deviceId: input.targetDeviceId,
  });
  if (!device.ok) return { ok: false, error: device.error };

  const { data, error } = await nexSupabaseAdmin
    .from(ENVELOPE_TABLE)
    .insert({
      account_id: input.accountId,
      conversation_id: input.conversationId,
      target_device_id: input.targetDeviceId,
      wrapped_k_c: `\\x${bytesToHex(wrapped)}`,
      nonce: `\\x${bytesToHex(nonce)}`,
      algorithm: input.algorithm,
      generation: input.generation,
    })
    .select("id, generation")
    .single();
  if (error) {
    // 23505 = unique_violation · the partial unique index enforces at
    // most one active envelope per (account, conv, device, generation).
    if (
      (error as { code?: string }).code === "23505" ||
      /duplicate key/i.test(error.message)
    ) {
      return { ok: false, error: "duplicate_active_envelope" };
    }
    throw new Error(`conversation-envelope-service.mintEnvelope: ${error.message}`);
  }
  const row = data as { id: string; generation: number };
  return { ok: true, envelope_id: row.id, generation: row.generation };
}

// ---------------------------------------------------------------------------
// LIST
// ---------------------------------------------------------------------------

export interface EnvelopeRow {
  envelope_id: string;
  conversation_id: string;
  target_device_id: string;
  wrapped_k_c_hex: string;
  nonce_hex: string;
  algorithm: string;
  generation: number;
  revoked_at: string | null;
  created_at: string;
}

/**
 * Return active envelopes for the authenticated account targeting the
 * given device. The client uses this on Vault unlock to batch-unwrap
 * every vaulted conversation's K_c.
 */
export async function listActiveEnvelopesForDevice(input: {
  accountId: string;
  deviceId: string;
}): Promise<EnvelopeRow[]> {
  const { data, error } = await nexSupabaseAdmin
    .from(ENVELOPE_TABLE)
    .select(
      "id, conversation_id, target_device_id, wrapped_k_c, nonce, algorithm, generation, revoked_at, created_at",
    )
    .eq("account_id", input.accountId)
    .eq("target_device_id", input.deviceId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(`conversation-envelope-service.listActiveEnvelopesForDevice: ${error.message}`);
  }
  const rows = (data as Array<{
    id: string;
    conversation_id: string;
    target_device_id: string;
    wrapped_k_c: string | Buffer | Uint8Array;
    nonce: string | Buffer | Uint8Array;
    algorithm: string;
    generation: number;
    revoked_at: string | null;
    created_at: string;
  }>) ?? [];
  return rows.map((r) => ({
    envelope_id: r.id,
    conversation_id: r.conversation_id,
    target_device_id: r.target_device_id,
    wrapped_k_c_hex: toHex(r.wrapped_k_c),
    nonce_hex: toHex(r.nonce),
    algorithm: r.algorithm,
    generation: r.generation,
    revoked_at: r.revoked_at,
    created_at: r.created_at,
  }));
}

function toHex(input: string | Buffer | Uint8Array): string {
  if (typeof input === "string") {
    // Supabase returns bytea as "\xHEX" by default.
    const m = input.match(/^\\x([0-9a-f]*)$/i);
    if (m) return m[1]!.toLowerCase();
    // Fallback: assume hex.
    return input.toLowerCase();
  }
  if (input instanceof Uint8Array) return bytesToHex(input);
  if (Buffer.isBuffer(input)) return input.toString("hex");
  return "";
}

// ---------------------------------------------------------------------------
// REVOKE
// ---------------------------------------------------------------------------

export interface RevokeInput {
  accountId: string;
  envelopeId: string;
}

export type RevokeResult =
  | { ok: true; envelope_id: string; revoked_at: string }
  | { ok: false; error: "envelope_not_found" | "not_owned" | "already_revoked" };

export async function revokeEnvelope(input: RevokeInput): Promise<RevokeResult> {
  // Read first to classify not_found vs not_owned vs already_revoked
  // without leaking existence to a non-owner (we still return
  // envelope_not_found for both not_found and not_owned at the route
  // level · see route handler).
  const { data, error } = await nexSupabaseAdmin
    .from(ENVELOPE_TABLE)
    .select("id, account_id, revoked_at")
    .eq("id", input.envelopeId)
    .maybeSingle();
  if (error) {
    throw new Error(`conversation-envelope-service.revokeEnvelope read: ${error.message}`);
  }
  if (!data) return { ok: false, error: "envelope_not_found" };
  const row = data as { id: string; account_id: string; revoked_at: string | null };
  if (row.account_id !== input.accountId) return { ok: false, error: "not_owned" };
  if (row.revoked_at !== null) return { ok: false, error: "already_revoked" };

  const now = new Date().toISOString();
  const upd = await nexSupabaseAdmin
    .from(ENVELOPE_TABLE)
    .update({ revoked_at: now })
    .eq("id", input.envelopeId)
    .eq("account_id", input.accountId)
    .is("revoked_at", null)
    .select("id, revoked_at")
    .single();
  if (upd.error) {
    throw new Error(`conversation-envelope-service.revokeEnvelope update: ${upd.error.message}`);
  }
  const r = upd.data as { id: string; revoked_at: string };
  return { ok: true, envelope_id: r.id, revoked_at: r.revoked_at };
}

// ---------------------------------------------------------------------------
// ROTATE
// ---------------------------------------------------------------------------

export interface RotateInput {
  accountId: string;
  conversationId: string;
  envelopes: Array<{
    targetDeviceId: string;
    wrappedKCHex: string;
    nonceHex: string;
  }>;
}

export type RotateResult =
  | {
      ok: true;
      generation: number;
      revoked: number;
      minted: number;
    }
  | {
      ok: false;
      error:
        | "conversation_not_found"
        | "not_a_participant"
        | "no_envelopes_supplied"
        | "invalid_hex_wrapped_k_c"
        | "invalid_hex_nonce"
        | EnvelopeShapeFailure
        | "device_not_owned";
    };

/**
 * Atomic rotation: revoke every active envelope for (account,
 * conversation), compute the next generation (max(generation)+1), and
 * mint a fresh envelope for each supplied device at the new generation.
 *
 * Caller must supply envelopes for every device that should retain
 * access · devices omitted lose access on the next unlock attempt
 * (their now-revoked envelopes can no longer be used, and no new one
 * replaces them). This is the sealed B.6 revoke-sweep posture.
 */
export async function rotateEnvelopes(input: RotateInput): Promise<RotateResult> {
  if (input.envelopes.length === 0) {
    return { ok: false, error: "no_envelopes_supplied" };
  }

  const participant = await assertIsParticipant({
    accountId: input.accountId,
    conversationId: input.conversationId,
  });
  if (!participant.ok) return { ok: false, error: participant.error };

  // Validate every supplied envelope BEFORE touching the DB · fail
  // closed on any shape error so partial rotations do not leave the
  // conversation in a mixed-generation state.
  const parsed: Array<{
    targetDeviceId: string;
    wrapped: Uint8Array;
    nonce: Uint8Array;
    wrappedHex: string;
    nonceHex: string;
  }> = [];
  for (const env of input.envelopes) {
    const wrapped = hexToBytes(env.wrappedKCHex);
    if (!wrapped) return { ok: false, error: "invalid_hex_wrapped_k_c" };
    const nonce = hexToBytes(env.nonceHex);
    if (!nonce) return { ok: false, error: "invalid_hex_nonce" };
    const shape = validateEnvelopeShape({
      wrapped_k_c: wrapped,
      nonce,
      algorithm: PHASE_A_ALGORITHM,
      generation: 1, // placeholder · real generation computed below
      target_device_id: env.targetDeviceId,
    });
    if (!shape.ok) return { ok: false, error: shape.error };
    const device = await assertOwnDevice({
      accountId: input.accountId,
      deviceId: env.targetDeviceId,
    });
    if (!device.ok) return { ok: false, error: device.error };
    parsed.push({
      targetDeviceId: env.targetDeviceId,
      wrapped,
      nonce,
      wrappedHex: bytesToHex(wrapped),
      nonceHex: bytesToHex(nonce),
    });
  }

  // Compute next generation = max(existing.generation)+1 across all
  // envelopes (active + revoked) for this (account, conversation).
  const { data: maxData, error: maxErr } = await nexSupabaseAdmin
    .from(ENVELOPE_TABLE)
    .select("generation")
    .eq("account_id", input.accountId)
    .eq("conversation_id", input.conversationId)
    .order("generation", { ascending: false })
    .limit(1);
  if (maxErr) {
    throw new Error(`conversation-envelope-service.rotateEnvelopes maxGen: ${maxErr.message}`);
  }
  const currentMax =
    maxData && maxData.length > 0
      ? ((maxData[0] as { generation: number }).generation ?? 0)
      : 0;
  const nextGeneration = currentMax + 1;

  // Revoke all currently-active envelopes for this (account, conv).
  const now = new Date().toISOString();
  const revokeRes = await nexSupabaseAdmin
    .from(ENVELOPE_TABLE)
    .update({ revoked_at: now })
    .eq("account_id", input.accountId)
    .eq("conversation_id", input.conversationId)
    .is("revoked_at", null)
    .select("id");
  if (revokeRes.error) {
    throw new Error(`conversation-envelope-service.rotateEnvelopes revoke: ${revokeRes.error.message}`);
  }
  const revoked = (revokeRes.data as Array<unknown>).length;

  // Mint fresh envelopes at the next generation.
  const toInsert = parsed.map((p) => ({
    account_id: input.accountId,
    conversation_id: input.conversationId,
    target_device_id: p.targetDeviceId,
    wrapped_k_c: `\\x${p.wrappedHex}`,
    nonce: `\\x${p.nonceHex}`,
    algorithm: PHASE_A_ALGORITHM,
    generation: nextGeneration,
  }));
  const insertRes = await nexSupabaseAdmin
    .from(ENVELOPE_TABLE)
    .insert(toInsert)
    .select("id");
  if (insertRes.error) {
    throw new Error(`conversation-envelope-service.rotateEnvelopes insert: ${insertRes.error.message}`);
  }
  const minted = (insertRes.data as Array<unknown>).length;

  return { ok: true, generation: nextGeneration, revoked, minted };
}

// Re-exports for route handlers · all come from the validator so routes
// never import crypto primitives directly.
export { WRAPPED_K_C_LENGTH, NONCE_LENGTH };
