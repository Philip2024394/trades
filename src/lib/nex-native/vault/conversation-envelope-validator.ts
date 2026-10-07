// src/lib/nex-native/vault/conversation-envelope-validator.ts
//
// Vault Phase B · Commit B.2 · sealed structural validator for the
// per-conversation key envelope. Mirrors the A.6 §P.2 pattern (see
// src/lib/nex-native/vault/ciphertext-structural-validator.ts): the
// server CANNOT verify cryptographic CORRECTNESS of the wrap (that
// would require VMK on the server · the sealed Phase A posture forbids
// it). What it CAN verify is STRUCTURAL shape · lengths, algorithm,
// nonce consistency, generation sanity · which is sufficient to reject
// any client that tries to post malformed envelope bytes.
//
// The row-level CHECK constraints on nex_vault_conversation_envelope
// (migration 143) will already reject malformed rows at INSERT. This
// validator fails fast with structured error codes BEFORE the service
// touches the admin client · it also doubles as a point of invariant
// documentation.

import "server-only";
import { PHASE_A_ALGORITHM } from "./key-hierarchy";

/** AES-GCM wrap: 12-byte nonce || 32-byte key ciphertext || 16-byte tag. */
export const WRAPPED_K_C_LENGTH = 60;
/** AES-GCM IV. */
export const NONCE_LENGTH = 12;
/** Device identifier · same range as nex_vault_key_envelope. */
export const DEVICE_ID_MIN = 8;
export const DEVICE_ID_MAX = 128;

export interface EnvelopePayload {
  wrapped_k_c: Uint8Array;
  nonce: Uint8Array;
  algorithm: string;
  generation: number;
  target_device_id: string;
}

export type EnvelopeShapeFailure =
  | "wrapped_k_c_length"
  | "nonce_length"
  | "nonce_mismatch"
  | "algorithm_not_allowed"
  | "generation_out_of_range"
  | "device_id_length";

export interface EnvelopeShapeOk {
  ok: true;
}

export interface EnvelopeShapeErr {
  ok: false;
  error: EnvelopeShapeFailure;
}

/**
 * §P.2-equivalent · structural validation BEFORE the server inserts a
 * row. Rejects anything that would violate the sealed Phase A envelope
 * shape.
 */
export function validateEnvelopeShape(
  input: EnvelopePayload,
): EnvelopeShapeOk | EnvelopeShapeErr {
  if (input.wrapped_k_c.length !== WRAPPED_K_C_LENGTH) {
    return { ok: false, error: "wrapped_k_c_length" };
  }
  if (input.nonce.length !== NONCE_LENGTH) {
    return { ok: false, error: "nonce_length" };
  }
  // Nonce must equal the first 12 bytes of wrapped_k_c · the sealed
  // Phase A envelope layout is [nonce || ciphertext || tag] so the
  // standalone nonce column is a redundancy check, not a second nonce.
  for (let i = 0; i < NONCE_LENGTH; i++) {
    if (input.nonce[i] !== input.wrapped_k_c[i]) {
      return { ok: false, error: "nonce_mismatch" };
    }
  }
  if (input.algorithm !== PHASE_A_ALGORITHM) {
    return { ok: false, error: "algorithm_not_allowed" };
  }
  if (!Number.isInteger(input.generation) || input.generation < 1) {
    return { ok: false, error: "generation_out_of_range" };
  }
  if (
    input.target_device_id.length < DEVICE_ID_MIN ||
    input.target_device_id.length > DEVICE_ID_MAX
  ) {
    return { ok: false, error: "device_id_length" };
  }
  return { ok: true };
}

/** Parse a lowercase even-length hex string into bytes. Returns null
 *  on any malformed input (odd length, non-hex chars). */
export function hexToBytes(hex: string): Uint8Array | null {
  if (typeof hex !== "string") return null;
  if (hex.length === 0 || hex.length % 2 !== 0) return null;
  if (!/^[0-9a-f]+$/i.test(hex)) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** Encode bytes to a lowercase hex string. Used only for list-route
 *  responses · the server never computes crypto on these values. */
export function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i]!.toString(16).padStart(2, "0");
  }
  return hex;
}
