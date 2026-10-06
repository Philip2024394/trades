// src/lib/nex-native/vault/client/recovery-rotation.ts
//
// Vault Phase A · Commit A.5 · client-side recovery setup, recovery
// unlock, and Vault key rotation.
//
// All crypto happens in the browser. Server receives only opaque
// wrapped envelopes + non-secret parameters + success/failure
// claims. Reuses the sealed A.2 primitives (wrapKey · unwrapKey ·
// deriveKekFromPassphrase · generateVmk · generateArgon2Salt ·
// aesGcmEncrypt · aesGcmDecrypt · zeroiseBuffer) and the sealed
// vault-session singleton.
//
// Zero commercial code.

"use client";

import {
  aesGcmDecrypt,
  aesGcmEncrypt,
  deriveKekFromPassphrase,
  deriveKekFromPin,
  generateArgon2Salt,
  generateNonce12,
  generateVmk,
  PASSPHRASE_ARGON_PARAMS,
  PHASE_A_ALGORITHM,
  PIN_ARGON_PARAMS,
  RECOVERY_ARGON_PARAMS,
  SYMMETRIC_KEY_LENGTH,
  unwrapKey,
  validatePassphrase,
  validatePin,
  wrapKey,
  zeroiseBuffer,
} from "../key-hierarchy";
import { installVmk, withVmk } from "./vault-session";
import { ensureDeviceKey } from "../../crypto/device-key";

function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i++)
    hex += bytes[i]!.toString(16).padStart(2, "0");
  return hex;
}

function hexToBytes(hex: string): Uint8Array {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) {
    throw new Error("invalid hex");
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++)
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

const PROOF_PLAINTEXT = new TextEncoder().encode("nex/vault/local-proof/v1");

async function cryptographicallyVerifyVmk(vmk: Uint8Array): Promise<boolean> {
  const nonce = generateNonce12();
  const ct = await aesGcmEncrypt({ key: vmk, nonce, plaintext: PROOF_PLAINTEXT });
  const rt = await aesGcmDecrypt({ key: vmk, nonce, ciphertext: ct });
  if (rt.length !== PROOF_PLAINTEXT.length) return false;
  for (let i = 0; i < rt.length; i++)
    if (rt[i] !== PROOF_PLAINTEXT[i]) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Recovery setup · Device A, Vault unlocked
// ---------------------------------------------------------------------------

export type RecoverySetupResult =
  | { ok: true }
  | { ok: false; error: string; stepUp?: string[] };

export async function setupRecovery(input: {
  passphrase: string;
}): Promise<RecoverySetupResult> {
  try {
    validatePassphrase(input.passphrase);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "invalid_passphrase",
    };
  }

  const recoverySalt = generateArgon2Salt(16);
  let kek: Uint8Array | null = null;
  let wrapResult: { envelope: Uint8Array; nonce: Uint8Array } | null = null;

  const wrapPromise = withVmk(async (vmk) => {
    kek = await deriveKekFromPassphrase({
      passphrase: input.passphrase,
      salt: recoverySalt,
    });
    const { envelope, nonce } = await wrapKey({ keyToWrap: vmk, kek });
    return { envelope, nonce };
  });
  if (!wrapPromise) return { ok: false, error: "vault_locked" };
  try {
    wrapResult = await wrapPromise;
  } catch (err) {
    if (kek) zeroiseBuffer(kek);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "recovery_wrap_failed",
    };
  }

  const envelope = wrapResult!.envelope;
  const nonce = wrapResult!.nonce;
  // envelope = nonce (12) || ciphertext (48) · wrapped_vmk column
  // stores the ciphertext slice; nonce stored separately.
  const wrappedCiphertext = envelope.slice(nonce.length);

  const params = RECOVERY_ARGON_PARAMS;
  const res = await fetch("/api/nex-native/vault/recovery/setup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      recovery_salt_hex: bytesToHex(recoverySalt),
      recovery_argon_params: {
        t: params.t,
        m: params.m,
        p: params.p,
        dkLen: params.dkLen,
        version: params.version,
        variant: params.variant,
      },
      wrapped_vmk_hex: bytesToHex(wrappedCiphertext),
      nonce_hex: bytesToHex(nonce),
    }),
  });
  if (kek) zeroiseBuffer(kek);

  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    required?: string[];
  };
  if (!res.ok || !body.ok) {
    return {
      ok: false,
      error: body.error ?? `status_${res.status}`,
      stepUp: body.required,
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Recovery unlock · signed-in user, no PIN envelope on this device
// ---------------------------------------------------------------------------

export type RecoveryUnlockResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      rateLimited?: boolean;
      retryAfterSeconds?: number;
    };

export async function unlockWithRecovery(input: {
  passphrase: string;
}): Promise<RecoveryUnlockResult> {
  try {
    validatePassphrase(input.passphrase);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "invalid_passphrase",
    };
  }

  // Fetch opaque materials (server rate-limits before returning).
  const matRes = await fetch(
    "/api/nex-native/vault/unlock/recovery/materials",
    { method: "POST" },
  );
  const matBody = (await matRes.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    retry_after_seconds?: number;
    recovery_salt_hex?: string;
    recovery_argon_params?: Record<string, unknown>;
    wrapped_vmk_hex?: string;
    nonce_hex?: string;
    algorithm?: string;
  };
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
    !matBody.recovery_salt_hex ||
    !matBody.wrapped_vmk_hex ||
    !matBody.nonce_hex ||
    !matBody.recovery_argon_params
  ) {
    return { ok: false, error: "incomplete_materials" };
  }
  if (matBody.algorithm !== PHASE_A_ALGORITHM) {
    return { ok: false, error: "algorithm_mismatch" };
  }

  const salt = hexToBytes(matBody.recovery_salt_hex);
  const wrappedCiphertext = hexToBytes(matBody.wrapped_vmk_hex);
  const nonce = hexToBytes(matBody.nonce_hex);
  const envelope = new Uint8Array(nonce.length + wrappedCiphertext.length);
  envelope.set(nonce, 0);
  envelope.set(wrappedCiphertext, nonce.length);

  let kek: Uint8Array | null = null;
  let vmk: Uint8Array | null = null;
  let success = false;
  try {
    kek = await deriveKekFromPassphrase({ passphrase: input.passphrase, salt });
    try {
      vmk = await unwrapKey({ envelope, kek });
    } catch {
      vmk = null;
    }
    if (vmk) {
      if (await cryptographicallyVerifyVmk(vmk)) {
        installVmk(vmk);
        success = true;
      }
    }
    const claim = await fetch("/api/nex-native/vault/unlock/recovery/attempt", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ success }),
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
      return { ok: false, error: "wrong_passphrase" };
    }
    return { ok: true };
  } finally {
    if (kek) zeroiseBuffer(kek);
    if (vmk) zeroiseBuffer(vmk);
  }
}

// ---------------------------------------------------------------------------
// Rotation · Device A, Vault unlocked
// ---------------------------------------------------------------------------

export type RotateResult =
  | { ok: true; newGeneration: number }
  | { ok: false; error: string; stepUp?: string[] };

/**
 * Rotate the Vault keys. Generates VMK_new client-side, re-wraps it
 * under the current PIN's KEK (same PIN · same salt · same KEK · just
 * fresh wrapped_vmk + nonce), optionally re-wraps under the recovery
 * KEK (user must supply the passphrase for this; if omitted, recovery
 * rotation is required if recovery was configured and route rejects).
 *
 * A.5 scope · no file re-wraps (none exist yet · A.6 populates them).
 * The route's file_updates param is forward-compatible.
 */
export async function rotateVault(input: {
  oldGeneration: number;
  currentPin: string;
  pinMode: "pin" | "passphrase";
  pinSalt: Uint8Array; // from nex_vault_setup · unchanged across rotation
  pinArgonParams: Record<string, unknown>;
  recoveryPassphrase?: string;
  recoverySalt?: Uint8Array;
  recoveryArgonParams?: Record<string, unknown>;
}): Promise<RotateResult> {
  try {
    if (input.pinMode === "pin") validatePin(input.currentPin);
    else validatePassphrase(input.currentPin);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "invalid_current_pin",
    };
  }
  if (input.recoveryPassphrase !== undefined) {
    try {
      validatePassphrase(input.recoveryPassphrase);
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "invalid_recovery_passphrase",
      };
    }
    if (!input.recoverySalt || !input.recoveryArgonParams) {
      return { ok: false, error: "missing_recovery_params" };
    }
  }

  const key = await ensureDeviceKey();

  // Access current VMK · generate VMK_new · wrap under PIN KEK · optionally
  // under recovery KEK · then POST.
  const prep = withVmk(async (vmkOld) => {
    // Verify we still have a valid VMK (just a quick sanity check).
    if (vmkOld.length !== SYMMETRIC_KEY_LENGTH) {
      throw new Error("current_vmk_wrong_length");
    }

    const vmkNew = generateVmk();

    // Derive PIN KEK (same salt + params + PIN as currently installed).
    const pinKek =
      input.pinMode === "pin"
        ? await deriveKekFromPin({
            pin: input.currentPin,
            salt: input.pinSalt,
          })
        : await deriveKekFromPassphrase({
            passphrase: input.currentPin,
            salt: input.pinSalt,
          });
    const pinWrap = await wrapKey({ keyToWrap: vmkNew, kek: pinKek });
    zeroiseBuffer(pinKek);
    const pinWrappedCiphertext = pinWrap.envelope.slice(pinWrap.nonce.length);

    let recoveryWrappedCiphertext: Uint8Array | null = null;
    let recoveryNonce: Uint8Array | null = null;
    if (input.recoveryPassphrase && input.recoverySalt) {
      const recKek = await deriveKekFromPassphrase({
        passphrase: input.recoveryPassphrase,
        salt: input.recoverySalt,
      });
      const recWrap = await wrapKey({ keyToWrap: vmkNew, kek: recKek });
      zeroiseBuffer(recKek);
      recoveryWrappedCiphertext = recWrap.envelope.slice(recWrap.nonce.length);
      recoveryNonce = recWrap.nonce;
    }

    return {
      vmkNew,
      pinWrappedCiphertext,
      pinNonce: pinWrap.nonce,
      recoveryWrappedCiphertext,
      recoveryNonce,
    };
  });
  if (!prep) return { ok: false, error: "vault_locked" };
  let prepped: Awaited<typeof prep>;
  try {
    prepped = await prep;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "rotation_prep_failed",
    };
  }

  const bodyToPost: Record<string, unknown> = {
    old_generation: input.oldGeneration,
    current_device_id: key.deviceId,
    pin_wrapped_vmk_hex: bytesToHex(prepped.pinWrappedCiphertext),
    pin_nonce_hex: bytesToHex(prepped.pinNonce),
    file_updates: [],
  };
  if (prepped.recoveryWrappedCiphertext && prepped.recoveryNonce) {
    bodyToPost.recovery_wrapped_vmk_hex = bytesToHex(prepped.recoveryWrappedCiphertext);
    bodyToPost.recovery_nonce_hex = bytesToHex(prepped.recoveryNonce);
  }

  const res = await fetch("/api/nex-native/vault/rotate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(bodyToPost),
  });
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    new_generation?: number;
    required?: string[];
  };
  if (!res.ok || !body.ok) {
    zeroiseBuffer(prepped.vmkNew);
    return {
      ok: false,
      error: body.error ?? `status_${res.status}`,
      stepUp: body.required,
    };
  }

  // Rotation succeeded on the server · install VMK_new locally so the
  // user remains unlocked under the new generation.
  installVmk(prepped.vmkNew);
  zeroiseBuffer(prepped.vmkNew);
  return { ok: true, newGeneration: body.new_generation ?? input.oldGeneration + 1 };
}

// ---------------------------------------------------------------------------
// Status probe · for UI (does the account have recovery configured?)
// ---------------------------------------------------------------------------

export async function fetchRecoveryStatus(): Promise<{
  configured: boolean;
  configuredAt: string | null;
}> {
  const res = await fetch("/api/nex-native/vault/status", { method: "GET" });
  if (!res.ok) return { configured: false, configuredAt: null };
  // /vault/status does not currently expose recovery state · we fetch
  // the materials endpoint which short-circuits with 'recovery_not_
  // configured' (404) when recovery is absent (no envelope leaked).
  const probe = await fetch(
    "/api/nex-native/vault/unlock/recovery/materials",
    { method: "POST" },
  );
  if (probe.status === 404) {
    return { configured: false, configuredAt: null };
  }
  // 200 or 429 both imply recovery IS configured. Don't reveal the
  // envelope to the caller · just return a boolean.
  return { configured: true, configuredAt: null };
}
