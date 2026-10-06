// src/lib/nex-native/vault/envelope-service.ts
//
// Vault Phase A · Commit A.2 · envelope CRUD (server-only).
//
// Thin, owner-scoped persistence layer over nex_vault_key_envelope and
// nex_vault_setup (tables sealed in migration 142). This service stores
// and retrieves OPAQUE CIPHERTEXT ONLY. It never derives a KEK, never
// unwraps VMK, never sees any plaintext key material. All crypto lives
// client-side in key-hierarchy.ts.
//
// Owner scope discipline:
//
//   · Every function requires session-resolved accountId from the caller.
//   · Every query is scoped by account_id.
//   · The underlying tables carry owner-scoped RLS; service-role bypass
//     is intentional (we authorise upstream via session resolver) but
//     the service-level filter is the canonical ownership check.
//   · Client-supplied account_id is NEVER trusted · callers MUST pass
//     session.account.id.
//
// Zero commercial code · no `bisnis`, `tier`, `plan`, `subscription`,
// `entitlement`, `quota`, or `allowance` references anywhere.
//
// Phase A design cross-reference:
//   §A key hierarchy · §B.1 device envelope · §D recovery · §F revocation

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";
import type { NexTimestamp, NexUuid } from "../types";
import { PHASE_A_ALGORITHM, type PhaseAAlgorithm } from "./key-hierarchy";

// ---------------------------------------------------------------------------
// Row types (mirror migrations 141/142 columns)
// ---------------------------------------------------------------------------

export type VaultEnvelopeKind = "pin" | "webauthn" | "device" | "recovery";
export type VaultPinMode = "pin" | "passphrase";

export interface VaultSetupRow {
  account_id: NexUuid;
  vmk_generation: number;
  pin_mode: VaultPinMode;
  pin_salt: Uint8Array;
  pin_argon_params: Record<string, unknown>;
  prf_salt: Uint8Array;
  recovery_configured_at: NexTimestamp | null;
  recovery_salt: Uint8Array | null;
  recovery_argon_params: Record<string, unknown> | null;
  created_at: NexTimestamp;
  updated_at: NexTimestamp;
}

export interface VaultKeyEnvelopeRow {
  id: NexUuid;
  account_id: NexUuid;
  kind: VaultEnvelopeKind;
  target_device_id: string | null;
  credential_id: string | null;
  wrapped_vmk: Uint8Array;
  nonce: Uint8Array;
  algorithm: PhaseAAlgorithm;
  generation: number;
  consumed_at: NexTimestamp | null;
  expires_at: NexTimestamp | null;
  created_at: NexTimestamp;
}

// ---------------------------------------------------------------------------
// Byte helpers
// ---------------------------------------------------------------------------

/** Supabase returns bytea as `\\x` hex strings OR Buffer depending on
 *  transport. Normalise to Uint8Array for the service surface. */
function toBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (typeof Buffer !== "undefined" && value instanceof Buffer) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (typeof value === "string") {
    const s = value.startsWith("\\x") ? value.slice(2) : value;
    const out = new Uint8Array(s.length / 2);
    for (let i = 0; i < out.length; i++) {
      out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
  }
  throw new Error("vault/envelope-service: cannot coerce value to bytes");
}

function toBytesOrNull(value: unknown): Uint8Array | null {
  if (value === null || value === undefined) return null;
  return toBytes(value);
}

function serialiseBytea(bytes: Uint8Array): string {
  let hex = "\\x";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i]!.toString(16).padStart(2, "0");
  }
  return hex;
}

function normaliseSetupRow(raw: Record<string, unknown>): VaultSetupRow {
  return {
    account_id: raw.account_id as NexUuid,
    vmk_generation: Number(raw.vmk_generation),
    pin_mode: raw.pin_mode as VaultPinMode,
    pin_salt: toBytes(raw.pin_salt),
    pin_argon_params: (raw.pin_argon_params as Record<string, unknown>) ?? {},
    prf_salt: toBytes(raw.prf_salt),
    recovery_configured_at: raw.recovery_configured_at as NexTimestamp | null,
    recovery_salt: toBytesOrNull(raw.recovery_salt),
    recovery_argon_params:
      (raw.recovery_argon_params as Record<string, unknown> | null) ?? null,
    created_at: raw.created_at as NexTimestamp,
    updated_at: raw.updated_at as NexTimestamp,
  };
}

function normaliseEnvelopeRow(raw: Record<string, unknown>): VaultKeyEnvelopeRow {
  return {
    id: raw.id as NexUuid,
    account_id: raw.account_id as NexUuid,
    kind: raw.kind as VaultEnvelopeKind,
    target_device_id: (raw.target_device_id as string | null) ?? null,
    credential_id: (raw.credential_id as string | null) ?? null,
    wrapped_vmk: toBytes(raw.wrapped_vmk),
    nonce: toBytes(raw.nonce),
    algorithm: raw.algorithm as PhaseAAlgorithm,
    generation: Number(raw.generation),
    consumed_at: raw.consumed_at as NexTimestamp | null,
    expires_at: raw.expires_at as NexTimestamp | null,
    created_at: raw.created_at as NexTimestamp,
  };
}

// ---------------------------------------------------------------------------
// nex_vault_setup CRUD
// ---------------------------------------------------------------------------

export async function getVaultSetupForAccount(
  accountId: NexUuid,
): Promise<VaultSetupRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_vault_setup")
    .select("*")
    .eq("account_id", accountId)
    .maybeSingle();
  if (error) {
    throw new Error(`vault/envelope-service.getVaultSetupForAccount: ${error.message}`);
  }
  if (!data) return null;
  return normaliseSetupRow(data as Record<string, unknown>);
}

/** Insert the one-and-only vault setup row for an account. Fails if a
 *  row already exists · setup is one-shot per account (bump
 *  vmk_generation on rotation; do not re-insert). */
export async function createVaultSetup(input: {
  accountId: NexUuid;
  pinMode: VaultPinMode;
  pinSalt: Uint8Array;
  pinArgonParams: Record<string, unknown>;
  prfSalt: Uint8Array;
}): Promise<VaultSetupRow> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_vault_setup")
    .insert({
      account_id: input.accountId,
      vmk_generation: 1,
      pin_mode: input.pinMode,
      pin_salt: serialiseBytea(input.pinSalt),
      pin_argon_params: input.pinArgonParams,
      prf_salt: serialiseBytea(input.prfSalt),
    })
    .select("*")
    .single();
  if (error) {
    throw new Error(`vault/envelope-service.createVaultSetup: ${error.message}`);
  }
  return normaliseSetupRow(data as Record<string, unknown>);
}

/** Attach / replace recovery configuration (all three fields are
 *  all-or-nothing per the migration 142 CHECK constraint). */
export async function setVaultRecoveryConfig(input: {
  accountId: NexUuid;
  recoverySalt: Uint8Array;
  recoveryArgonParams: Record<string, unknown>;
}): Promise<VaultSetupRow> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_vault_setup")
    .update({
      recovery_configured_at: new Date().toISOString(),
      recovery_salt: serialiseBytea(input.recoverySalt),
      recovery_argon_params: input.recoveryArgonParams,
    })
    .eq("account_id", input.accountId)
    .select("*")
    .single();
  if (error) {
    throw new Error(`vault/envelope-service.setVaultRecoveryConfig: ${error.message}`);
  }
  return normaliseSetupRow(data as Record<string, unknown>);
}

/** Clear recovery · deletes the triple atomically (user removed their
 *  recovery passphrase). All three columns go NULL together. */
export async function clearVaultRecoveryConfig(accountId: NexUuid): Promise<void> {
  const { error } = await nexSupabaseAdmin
    .from("nex_vault_setup")
    .update({
      recovery_configured_at: null,
      recovery_salt: null,
      recovery_argon_params: null,
    })
    .eq("account_id", accountId);
  if (error) {
    throw new Error(`vault/envelope-service.clearVaultRecoveryConfig: ${error.message}`);
  }
}

/** Bump vmk_generation for key rotation (Phase F). Not called in A.2
 *  but included so later phases do not need another service module. */
export async function bumpVmkGeneration(accountId: NexUuid): Promise<number> {
  const current = await getVaultSetupForAccount(accountId);
  if (!current) {
    throw new Error("vault/envelope-service.bumpVmkGeneration: setup missing");
  }
  const next = current.vmk_generation + 1;
  const { error } = await nexSupabaseAdmin
    .from("nex_vault_setup")
    .update({ vmk_generation: next })
    .eq("account_id", accountId);
  if (error) {
    throw new Error(`vault/envelope-service.bumpVmkGeneration: ${error.message}`);
  }
  return next;
}

// ---------------------------------------------------------------------------
// nex_vault_key_envelope CRUD
// ---------------------------------------------------------------------------

/** Input shape for creating an envelope. The caller has already derived
 *  the KEK, wrapped VMK, and extracted the nonce. The server stores
 *  nothing beyond the ciphertext. */
export interface CreateEnvelopeInput {
  accountId: NexUuid;
  kind: VaultEnvelopeKind;
  wrappedVmk: Uint8Array;
  nonce: Uint8Array;
  /** 'pin' + 'device' envelopes carry target_device_id; otherwise null. */
  targetDeviceId?: string | null;
  /** 'webauthn' envelopes carry credential_id; otherwise null. */
  credentialId?: string | null;
  /** Current generation from nex_vault_setup. Defaults to 1 for A.2. */
  generation?: number;
  /** 'device' envelopes expire after 24h per design §B.1 default. */
  expiresAt?: Date | null;
}

/**
 * Insert a new envelope row. The partial unique indexes defined in
 * migration 142 (one active per account per path) enforce
 * one-active-at-a-time semantics; attempting to insert a second
 * active envelope for the same (account, path) with the first still
 * unconsumed is rejected by Postgres with error 23505. Callers should
 * call `consumeEnvelope` or `deleteEnvelope` on the existing row
 * first.
 */
export async function createEnvelope(
  input: CreateEnvelopeInput,
): Promise<VaultKeyEnvelopeRow> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_vault_key_envelope")
    .insert({
      account_id: input.accountId,
      kind: input.kind,
      target_device_id: input.targetDeviceId ?? null,
      credential_id: input.credentialId ?? null,
      wrapped_vmk: serialiseBytea(input.wrappedVmk),
      nonce: serialiseBytea(input.nonce),
      algorithm: PHASE_A_ALGORITHM,
      generation: input.generation ?? 1,
      expires_at: input.expiresAt ? input.expiresAt.toISOString() : null,
    })
    .select("*")
    .single();
  if (error) {
    throw new Error(`vault/envelope-service.createEnvelope: ${error.message}`);
  }
  return normaliseEnvelopeRow(data as Record<string, unknown>);
}

/** Return the active (unconsumed, unexpired) PIN envelope for a given
 *  (account, device). Returns null if none exists. */
export async function getActivePinEnvelope(input: {
  accountId: NexUuid;
  deviceId: string;
}): Promise<VaultKeyEnvelopeRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_vault_key_envelope")
    .select("*")
    .eq("account_id", input.accountId)
    .eq("kind", "pin")
    .eq("target_device_id", input.deviceId)
    .is("consumed_at", null)
    .maybeSingle();
  if (error) {
    throw new Error(`vault/envelope-service.getActivePinEnvelope: ${error.message}`);
  }
  if (!data) return null;
  return normaliseEnvelopeRow(data as Record<string, unknown>);
}

/** Active WebAuthn envelope for a given (account, credential_id). */
export async function getActiveWebauthnEnvelope(input: {
  accountId: NexUuid;
  credentialId: string;
}): Promise<VaultKeyEnvelopeRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_vault_key_envelope")
    .select("*")
    .eq("account_id", input.accountId)
    .eq("kind", "webauthn")
    .eq("credential_id", input.credentialId)
    .is("consumed_at", null)
    .maybeSingle();
  if (error) {
    throw new Error(`vault/envelope-service.getActiveWebauthnEnvelope: ${error.message}`);
  }
  if (!data) return null;
  return normaliseEnvelopeRow(data as Record<string, unknown>);
}

/** Active device envelope targeting a given (account, target_device).
 *  Filters out expired rows per expires_at. */
export async function getActiveDeviceEnvelope(input: {
  accountId: NexUuid;
  targetDeviceId: string;
}): Promise<VaultKeyEnvelopeRow | null> {
  const nowIso = new Date().toISOString();
  const { data, error } = await nexSupabaseAdmin
    .from("nex_vault_key_envelope")
    .select("*")
    .eq("account_id", input.accountId)
    .eq("kind", "device")
    .eq("target_device_id", input.targetDeviceId)
    .is("consumed_at", null)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .maybeSingle();
  if (error) {
    throw new Error(`vault/envelope-service.getActiveDeviceEnvelope: ${error.message}`);
  }
  if (!data) return null;
  return normaliseEnvelopeRow(data as Record<string, unknown>);
}

/** Active recovery envelope for an account. */
export async function getActiveRecoveryEnvelope(
  accountId: NexUuid,
): Promise<VaultKeyEnvelopeRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_vault_key_envelope")
    .select("*")
    .eq("account_id", accountId)
    .eq("kind", "recovery")
    .is("consumed_at", null)
    .maybeSingle();
  if (error) {
    throw new Error(`vault/envelope-service.getActiveRecoveryEnvelope: ${error.message}`);
  }
  if (!data) return null;
  return normaliseEnvelopeRow(data as Record<string, unknown>);
}

/** List all pending (unconsumed, unexpired) device envelopes targeting
 *  the given target_device_id across all accounts belonging to the
 *  caller. In A.2 we only query by (account_id, target_device_id).
 *  Returns an array for shape consistency with later phases. */
export async function listPendingDeviceEnvelopesForDevice(input: {
  accountId: NexUuid;
  targetDeviceId: string;
}): Promise<VaultKeyEnvelopeRow[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await nexSupabaseAdmin
    .from("nex_vault_key_envelope")
    .select("*")
    .eq("account_id", input.accountId)
    .eq("kind", "device")
    .eq("target_device_id", input.targetDeviceId)
    .is("consumed_at", null)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`);
  if (error) {
    throw new Error(
      `vault/envelope-service.listPendingDeviceEnvelopesForDevice: ${error.message}`,
    );
  }
  return (data as Array<Record<string, unknown>>).map(normaliseEnvelopeRow);
}

/**
 * Mark an envelope consumed. Used for one-shot device envelopes: the
 * target device unwraps VMK, immediately writes its own PIN envelope
 * (and optionally a WebAuthn-PRF envelope), then calls this to retire
 * the source envelope. Ownership is enforced in the WHERE clause.
 */
export async function consumeEnvelope(input: {
  accountId: NexUuid;
  envelopeId: NexUuid;
}): Promise<void> {
  const { error } = await nexSupabaseAdmin
    .from("nex_vault_key_envelope")
    .update({ consumed_at: new Date().toISOString() })
    .eq("account_id", input.accountId)
    .eq("id", input.envelopeId)
    .is("consumed_at", null);
  if (error) {
    throw new Error(`vault/envelope-service.consumeEnvelope: ${error.message}`);
  }
}

/**
 * Delete every active envelope matching (account, kind). Used when
 * replacing an envelope (PIN change, WebAuthn re-enrollment, etc.).
 * The partial unique index forbids leaving two active envelopes for
 * the same path · caller is expected to delete the old one before
 * inserting the new one in a single transaction (A.3 wires that).
 */
export async function deleteActiveEnvelopesForPath(input: {
  accountId: NexUuid;
  kind: VaultEnvelopeKind;
  targetDeviceId?: string | null;
  credentialId?: string | null;
}): Promise<number> {
  let q = nexSupabaseAdmin
    .from("nex_vault_key_envelope")
    .delete({ count: "exact" })
    .eq("account_id", input.accountId)
    .eq("kind", input.kind)
    .is("consumed_at", null);
  if (input.kind === "pin" || input.kind === "device") {
    if (!input.targetDeviceId) {
      throw new Error(
        `vault/envelope-service.deleteActiveEnvelopesForPath: kind '${input.kind}' requires targetDeviceId`,
      );
    }
    q = q.eq("target_device_id", input.targetDeviceId);
  } else if (input.kind === "webauthn") {
    if (!input.credentialId) {
      throw new Error(
        "vault/envelope-service.deleteActiveEnvelopesForPath: kind 'webauthn' requires credentialId",
      );
    }
    q = q.eq("credential_id", input.credentialId);
  }
  const { count, error } = await q;
  if (error) {
    throw new Error(
      `vault/envelope-service.deleteActiveEnvelopesForPath: ${error.message}`,
    );
  }
  return count ?? 0;
}

/**
 * Delete ALL envelopes for an account · used by key rotation (Phase F)
 * and on Vault deletion. In A.2 the implementation is here for later
 * phases to call; A.2 itself does not invoke it.
 */
export async function deleteAllEnvelopesForAccount(
  accountId: NexUuid,
): Promise<number> {
  const { count, error } = await nexSupabaseAdmin
    .from("nex_vault_key_envelope")
    .delete({ count: "exact" })
    .eq("account_id", accountId);
  if (error) {
    throw new Error(
      `vault/envelope-service.deleteAllEnvelopesForAccount: ${error.message}`,
    );
  }
  return count ?? 0;
}
