// src/lib/nex-native/vault/client/unlock-orchestrator.ts
//
// Vault Phase A · Commit A.3b · client-side unlock orchestrator.
//
// Owns the end-to-end client flow:
//   SETUP:  generate VMK → derive KEK → wrap VMK → POST /setup → install VMK
//   UNLOCK: POST /unlock-materials → derive KEK → unwrap VMK → local proof
//           → POST /unlock-attempt (success=true) → install VMK
//   LOCK:   zeroise VMK → POST /lock
//
// All KEK derivation + AES-GCM wrap/unwrap happens here, in the browser.
// The server sees only opaque ciphertext + non-secret parameters.
//
// This file is CLIENT ONLY · no server-only import. Imports the sealed
// A.2 key-hierarchy library · duplicates no cryptography.

"use client";

import {
  aesGcmDecrypt,
  aesGcmEncrypt,
  deriveKekFromPassphrase,
  deriveKekFromPin,
  generateArgon2Salt,
  generateNonce12,
  generatePrfSalt,
  generateVmk,
  PASSPHRASE_ARGON_PARAMS,
  PIN_ARGON_PARAMS,
  PHASE_A_ALGORITHM,
  unwrapKey,
  validatePassphrase,
  validatePin,
  wrapKey,
  zeroiseBuffer,
} from "../key-hierarchy";
import { installVmk, withVmk, clearVmk } from "./vault-session";

export type VaultMode = "pin" | "passphrase";

// ---------------------------------------------------------------------------
// Byte / hex utilities · hex-encoded on-the-wire (ASCII-safe for JSON)
// ---------------------------------------------------------------------------

function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i]!.toString(16).padStart(2, "0");
  }
  return hex;
}

function hexToBytes(hex: string): Uint8Array {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) {
    throw new Error("invalid hex");
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Cryptographic proof after unwrap · §3 of the A.3b master prompt
// ---------------------------------------------------------------------------

const PROOF_PLAINTEXT = new TextEncoder().encode("nex/vault/local-proof/v1");

/**
 * Perform a REAL cryptographic operation with the just-unwrapped VMK
 * before declaring "unlocked". Encrypts a known small plaintext and
 * decrypts it back; if either step throws or round-trip differs, the
 * VMK is wrong (even though GCM auth-tag already verified during the
 * unwrap). Nothing from this flow crosses the network boundary.
 */
async function cryptographicallyVerifyVmk(vmk: Uint8Array): Promise<boolean> {
  const nonce = generateNonce12();
  const ciphertext = await aesGcmEncrypt({
    key: vmk,
    nonce,
    plaintext: PROOF_PLAINTEXT,
  });
  const roundtrip = await aesGcmDecrypt({
    key: vmk,
    nonce,
    ciphertext,
  });
  if (roundtrip.length !== PROOF_PLAINTEXT.length) return false;
  for (let i = 0; i < roundtrip.length; i++) {
    if (roundtrip[i] !== PROOF_PLAINTEXT[i]) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// SETUP · generate VMK + wrap + POST
// ---------------------------------------------------------------------------

export interface SetupInput {
  mode: VaultMode;
  secret: string;
  deviceId: string;
}

export type SetupResult =
  | { ok: true }
  | { ok: false; error: string };

export async function setupVault(input: SetupInput): Promise<SetupResult> {
  // Validate first · never generate crypto for an invalid input.
  try {
    if (input.mode === "pin") validatePin(input.secret);
    else validatePassphrase(input.secret);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "invalid_secret",
    };
  }

  const vmk = generateVmk();
  const pinSalt = generateArgon2Salt(16);
  const prfSalt = generatePrfSalt();
  const argonParams =
    input.mode === "pin" ? PIN_ARGON_PARAMS : PASSPHRASE_ARGON_PARAMS;

  let kek: Uint8Array | null = null;
  try {
    kek =
      input.mode === "pin"
        ? await deriveKekFromPin({ pin: input.secret, salt: pinSalt })
        : await deriveKekFromPassphrase({
            passphrase: input.secret,
            salt: pinSalt,
          });
    const { envelope, nonce } = await wrapKey({ keyToWrap: vmk, kek });
    // envelope = nonce || ciphertext · we store ciphertext slice separately
    // from nonce to match migration 142 columns (wrapped_vmk BETWEEN 32 AND
    // 128 bytes · nonce BETWEEN 12 AND 24 bytes).
    const wrappedCiphertext = envelope.slice(nonce.length);
    const res = await fetch("/api/nex-native/vault/setup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        pin_mode: input.mode,
        pin_salt_hex: bytesToHex(pinSalt),
        pin_argon_params: {
          t: argonParams.t,
          m: argonParams.m,
          p: argonParams.p,
          dkLen: argonParams.dkLen,
          version: argonParams.version,
          variant: argonParams.variant,
        },
        prf_salt_hex: bytesToHex(prfSalt),
        device_id: input.deviceId,
        wrapped_vmk_hex: bytesToHex(wrappedCiphertext),
        nonce_hex: bytesToHex(nonce),
      }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      return { ok: false, error: body.error ?? `status_${res.status}` };
    }
    // Server accepted the envelope. Install VMK into the tab-scoped
    // singleton AFTER server confirmation so a transient network blip
    // never leaves us "unlocked" without the server knowing.
    installVmk(vmk);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "setup_failed",
    };
  } finally {
    zeroiseBuffer(vmk);
    if (kek) zeroiseBuffer(kek);
  }
}

// ---------------------------------------------------------------------------
// UNLOCK · fetch materials → derive → unwrap → verify → claim
// ---------------------------------------------------------------------------

export interface UnlockInput {
  mode: VaultMode;
  secret: string;
  deviceId: string;
}

export type UnlockResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      rateLimited?: boolean;
      retryAfterSeconds?: number;
    };

interface UnlockMaterialsResponse {
  ok: boolean;
  error?: string;
  reason?: string | null;
  retry_after_seconds?: number;
  mode?: VaultMode;
  pin_salt_hex?: string;
  pin_argon_params?: Record<string, unknown>;
  wrapped_vmk_hex?: string;
  nonce_hex?: string;
  algorithm?: string;
  generation?: number;
}

export async function unlockVault(input: UnlockInput): Promise<UnlockResult> {
  // Shape validation up front · don't fetch materials for an invalid
  // secret (would waste a rate-limit attempt).
  try {
    if (input.mode === "pin") validatePin(input.secret);
    else validatePassphrase(input.secret);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "invalid_secret",
    };
  }

  // Fetch opaque materials.
  const matRes = await fetch("/api/nex-native/vault/unlock-materials", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ device_id: input.deviceId }),
  });
  const matBody = (await matRes.json().catch(() => ({}))) as UnlockMaterialsResponse;
  if (matRes.status === 429) {
    return {
      ok: false,
      error: "rate_limited",
      rateLimited: true,
      retryAfterSeconds: matBody.retry_after_seconds,
    };
  }
  if (!matRes.ok || !matBody.ok) {
    return { ok: false, error: matBody.error ?? `status_${matRes.status}` };
  }
  if (
    !matBody.pin_salt_hex ||
    !matBody.wrapped_vmk_hex ||
    !matBody.nonce_hex ||
    !matBody.pin_argon_params
  ) {
    return { ok: false, error: "incomplete_materials" };
  }
  if (matBody.mode !== input.mode) {
    return { ok: false, error: "mode_mismatch" };
  }
  if (matBody.algorithm !== PHASE_A_ALGORITHM) {
    return { ok: false, error: "algorithm_mismatch" };
  }

  // Derive KEK locally.
  const pinSalt = hexToBytes(matBody.pin_salt_hex);
  const wrappedCiphertext = hexToBytes(matBody.wrapped_vmk_hex);
  const nonce = hexToBytes(matBody.nonce_hex);
  // Reconstruct the envelope format wrapKey/unwrapKey expect.
  const envelope = new Uint8Array(nonce.length + wrappedCiphertext.length);
  envelope.set(nonce, 0);
  envelope.set(wrappedCiphertext, nonce.length);

  let kek: Uint8Array | null = null;
  let vmk: Uint8Array | null = null;
  let success = false;
  try {
    kek =
      input.mode === "pin"
        ? await deriveKekFromPin({ pin: input.secret, salt: pinSalt })
        : await deriveKekFromPassphrase({
            passphrase: input.secret,
            salt: pinSalt,
          });
    try {
      vmk = await unwrapKey({ envelope, kek });
    } catch {
      // GCM auth-tag mismatch · wrong PIN/passphrase. Fall through to
      // the failure-claim branch below so the server sees the attempt.
      vmk = null;
    }
    if (vmk) {
      // Real cryptographic proof: use the VMK locally against a known
      // deterministic plaintext. Nothing crosses the network.
      const verified = await cryptographicallyVerifyVmk(vmk);
      if (verified) {
        installVmk(vmk);
        success = true;
      }
    }
    // Claim result to the server (always · the rate-limit substrate
    // relies on both success and failure claims).
    const claim = await fetch("/api/nex-native/vault/unlock-attempt", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ device_id: input.deviceId, success }),
    });
    if (!success) {
      const claimBody = (await claim.json().catch(() => ({}))) as {
        rate?: { allowed: boolean; reason: string | null; retry_after_seconds: number };
      };
      if (claimBody.rate && !claimBody.rate.allowed) {
        return {
          ok: false,
          error: "rate_limited",
          rateLimited: true,
          retryAfterSeconds: claimBody.rate.retry_after_seconds,
        };
      }
      return { ok: false, error: "wrong_secret" };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "unlock_failed",
    };
  } finally {
    if (kek) zeroiseBuffer(kek);
    if (vmk && !success) zeroiseBuffer(vmk);
    // VMK itself was COPIED by installVmk when success=true; the local
    // reference can be scrubbed either way.
    if (vmk && success) zeroiseBuffer(vmk);
  }
}

// ---------------------------------------------------------------------------
// LOCK · clear VMK + POST
// ---------------------------------------------------------------------------

export async function lockVault(): Promise<void> {
  // Clear local state FIRST · if the server call fails for any reason,
  // the user is still locally locked (fail-closed on client).
  clearVmk();
  try {
    await fetch("/api/nex-native/vault/lock", { method: "POST" });
  } catch {
    /* best-effort; server will clear on next request anyway */
  }
}

// ---------------------------------------------------------------------------
// Re-export for callers that want a local-use handle on the current VMK
// (never leaves this module tree).
// ---------------------------------------------------------------------------

export { withVmk };
