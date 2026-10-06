// src/lib/nex-native/vault/client/device-portability.ts
//
// Vault Phase A · Commit A.4 · client-side device/key portability.
//
// Device A (unlocked):
//   authoriseDevice(targetDeviceId)
//     fetch target_pubkey → nacl.box.before(target_pub, my_sec)
//     → shared_secret (32B · suitable as AES-GCM key)
//     → AES-GCM wrap VMK under shared_secret
//     → prepend my own public key (format marker + pubkey + ciphertext)
//     → POST /device/authorise with opaque hex
//
// Device B (freshly signed in, holding its own X25519 keypair):
//   consumePendingDeviceEnvelope(deviceKey, pin)
//     POST /device/envelope/pending → opaque envelope
//     parse: version byte + source_pubkey + ciphertext
//     nacl.box.before(source_pub, my_sec) → shared_secret
//     AES-GCM decrypt ciphertext → VMK
//     cryptographicallyVerifyVmk(VMK) → local round-trip proof
//     prompt for new PIN · derive KEK · wrap VMK under PIN
//     POST /device/envelope/consume with both the consume signal AND
//     the new PIN envelope (atomic server-side insert + consume)
//     installVmk(VMK) locally
//
// Server never sees: VMK plaintext · shared_secret · either device's
// private key. Only opaque ciphertext + metadata.
//
// Zero commercial code.

"use client";

import nacl from "tweetnacl";
import {
  aesGcmDecrypt,
  aesGcmEncrypt,
  deriveKekFromPin,
  deriveKekFromPassphrase,
  generateArgon2Salt,
  generateNonce12,
  PASSPHRASE_ARGON_PARAMS,
  PHASE_A_ALGORITHM,
  PIN_ARGON_PARAMS,
  SYMMETRIC_KEY_LENGTH,
  validatePassphrase,
  validatePin,
  wrapKey,
  zeroiseBuffer,
} from "../key-hierarchy";
import {
  ensureDeviceKey,
  decodePublicKey,
  publicKeyBase64,
} from "../../crypto/device-key";
import { installVmk, withVmk } from "./vault-session";

// Device envelope `wrapped_vmk` byte layout:
//   [0]       : format version · 0x01
//   [1..33]   : sender X25519 public key (32 bytes)
//   [33..81]  : AES-GCM(VMK, shared_secret, nonce) · 48 bytes for 32B VMK
// Total: 81 bytes · fits migration 142's CHECK (32-128).
export const DEVICE_ENVELOPE_VERSION = 0x01;
export const DEVICE_ENVELOPE_SOURCE_PUBKEY_LENGTH = 32;

function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) hex += bytes[i]!.toString(16).padStart(2, "0");
  return hex;
}

function hexToBytes(hex: string): Uint8Array {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) {
    throw new Error("invalid hex");
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** Build the device-envelope bytes layout. */
export function buildDeviceEnvelope(
  sourcePublicKey: Uint8Array,
  ciphertext: Uint8Array,
): Uint8Array {
  if (sourcePublicKey.length !== DEVICE_ENVELOPE_SOURCE_PUBKEY_LENGTH) {
    throw new Error(
      `device-portability: sender pubkey must be ${DEVICE_ENVELOPE_SOURCE_PUBKEY_LENGTH} bytes`,
    );
  }
  const out = new Uint8Array(1 + sourcePublicKey.length + ciphertext.length);
  out[0] = DEVICE_ENVELOPE_VERSION;
  out.set(sourcePublicKey, 1);
  out.set(ciphertext, 1 + sourcePublicKey.length);
  return out;
}

/** Parse the device-envelope bytes layout. Throws on wrong version. */
export function parseDeviceEnvelope(bytes: Uint8Array): {
  sourcePublicKey: Uint8Array;
  ciphertext: Uint8Array;
} {
  if (bytes.length < 1 + DEVICE_ENVELOPE_SOURCE_PUBKEY_LENGTH + 16) {
    throw new Error("device-portability: envelope too short");
  }
  if (bytes[0] !== DEVICE_ENVELOPE_VERSION) {
    throw new Error(
      `device-portability: unsupported envelope version 0x${bytes[0]!.toString(16)}`,
    );
  }
  const sourcePublicKey = bytes.slice(1, 1 + DEVICE_ENVELOPE_SOURCE_PUBKEY_LENGTH);
  const ciphertext = bytes.slice(1 + DEVICE_ENVELOPE_SOURCE_PUBKEY_LENGTH);
  return { sourcePublicKey, ciphertext };
}

// ---------------------------------------------------------------------------
// Device A · authorise a target device
// ---------------------------------------------------------------------------

export type AuthoriseResult =
  | { ok: true; envelope_id: string }
  | { ok: false; error: string; stepUp?: string[] };

/**
 * Encrypt the currently-unlocked VMK to the target device's public key
 * and POST the opaque envelope. Caller must be on Device A with Vault
 * unlocked AND must have performed fresh step-up (password OR WebAuthn)
 * within the sealed freshness window.
 */
export async function authoriseDevice(input: {
  targetDeviceId: string;
  targetPublicKeyBase64: string;
}): Promise<AuthoriseResult> {
  const sourceKey = await ensureDeviceKey();
  const targetPub = decodePublicKey(input.targetPublicKeyBase64);
  if (targetPub.length !== DEVICE_ENVELOPE_SOURCE_PUBKEY_LENGTH) {
    return { ok: false, error: "invalid_target_pubkey_length" };
  }

  // ECDH + HSalsa20 (nacl.box.before) → uniform 32-byte shared secret
  // suitable as AES-GCM key.
  const sharedSecret = nacl.box.before(targetPub, sourceKey.secretKey);
  const nonce = generateNonce12();

  // Access VMK from the tab-scoped singleton. Fail if locked.
  const encryptPromise = withVmk(async (vmk) => {
    if (vmk.length !== SYMMETRIC_KEY_LENGTH) {
      throw new Error("vault_vmk_wrong_length");
    }
    return await aesGcmEncrypt({
      key: sharedSecret,
      nonce,
      plaintext: vmk,
    });
  });
  if (!encryptPromise) {
    zeroiseBuffer(sharedSecret);
    return { ok: false, error: "vault_locked" };
  }
  let ciphertext: Uint8Array;
  try {
    ciphertext = await encryptPromise;
  } catch (err) {
    zeroiseBuffer(sharedSecret);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "encrypt_failed",
    };
  } finally {
    zeroiseBuffer(sharedSecret);
  }

  const envelope = buildDeviceEnvelope(sourceKey.publicKey, ciphertext);
  const res = await fetch("/api/nex-native/vault/device/authorise", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      target_device_id: input.targetDeviceId,
      wrapped_vmk_hex: bytesToHex(envelope),
      nonce_hex: bytesToHex(nonce),
    }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    envelope_id?: string;
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
  return { ok: true, envelope_id: body.envelope_id! };
}

// ---------------------------------------------------------------------------
// Device B · consume pending envelope + create new PIN envelope
// ---------------------------------------------------------------------------

export type PendingResult =
  | { ok: true; pending: true; envelopeId: string; wrappedVmkHex: string; nonceHex: string; algorithm: string }
  | { ok: true; pending: false }
  | { ok: false; error: string };

/** Call-and-return opaque pending envelope for this device, or null. */
export async function fetchPendingDeviceEnvelope(input: {
  deviceId: string;
}): Promise<PendingResult> {
  const res = await fetch("/api/nex-native/vault/device/envelope/pending", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ device_id: input.deviceId }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    envelope?: {
      id: string;
      wrapped_vmk_hex: string;
      nonce_hex: string;
      algorithm: string;
    } | null;
  };
  if (!res.ok || !body.ok) {
    return { ok: false, error: body.error ?? `status_${res.status}` };
  }
  if (!body.envelope) {
    return { ok: true, pending: false };
  }
  return {
    ok: true,
    pending: true,
    envelopeId: body.envelope.id,
    wrappedVmkHex: body.envelope.wrapped_vmk_hex,
    nonceHex: body.envelope.nonce_hex,
    algorithm: body.envelope.algorithm,
  };
}

export type ConsumeResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Device B · consume the opaque pending envelope.
 *   1. Decrypt locally via ECDH + AES-GCM.
 *   2. Local cryptographic sanity check (round-trip against VMK).
 *   3. User-chosen PIN · derive KEK · wrap VMK · build new PIN envelope.
 *   4. POST /device/envelope/consume · server inserts PIN envelope +
 *      marks device envelope consumed atomically.
 *   5. installVmk() locally.
 */
export async function consumePendingDeviceEnvelope(input: {
  envelopeId: string;
  wrappedVmkHex: string;
  nonceHex: string;
  algorithm: string;
  pinMode: "pin" | "passphrase";
  pinSecret: string;
}): Promise<ConsumeResult> {
  if (input.algorithm !== PHASE_A_ALGORITHM) {
    return { ok: false, error: "algorithm_mismatch" };
  }
  try {
    if (input.pinMode === "pin") validatePin(input.pinSecret);
    else validatePassphrase(input.pinSecret);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "invalid_pin",
    };
  }

  // 1 · Decrypt envelope locally via ECDH + AES-GCM.
  const myKey = await ensureDeviceKey();
  const envelopeBytes = hexToBytes(input.wrappedVmkHex);
  const nonceBytes = hexToBytes(input.nonceHex);
  let sourcePub: Uint8Array;
  let ciphertext: Uint8Array;
  try {
    const parsed = parseDeviceEnvelope(envelopeBytes);
    sourcePub = parsed.sourcePublicKey;
    ciphertext = parsed.ciphertext;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "envelope_parse_failed",
    };
  }
  const sharedSecret = nacl.box.before(sourcePub, myKey.secretKey);
  let vmk: Uint8Array;
  try {
    vmk = await aesGcmDecrypt({
      key: sharedSecret,
      nonce: nonceBytes,
      ciphertext,
    });
  } catch {
    zeroiseBuffer(sharedSecret);
    return { ok: false, error: "envelope_decrypt_failed" };
  } finally {
    zeroiseBuffer(sharedSecret);
  }
  if (vmk.length !== SYMMETRIC_KEY_LENGTH) {
    zeroiseBuffer(vmk);
    return { ok: false, error: "vmk_wrong_length" };
  }

  // 2 · Local cryptographic sanity check (same pattern as unlock).
  const proofPlaintext = new TextEncoder().encode("nex/vault/local-proof/v1");
  try {
    const nonce = generateNonce12();
    const ct = await aesGcmEncrypt({ key: vmk, nonce, plaintext: proofPlaintext });
    const rt = await aesGcmDecrypt({ key: vmk, nonce, ciphertext: ct });
    if (rt.length !== proofPlaintext.length) throw new Error("mismatch");
    for (let i = 0; i < rt.length; i++) {
      if (rt[i] !== proofPlaintext[i]) throw new Error("mismatch");
    }
  } catch {
    zeroiseBuffer(vmk);
    return { ok: false, error: "local_sanity_check_failed" };
  }

  // 3 · User-chosen PIN · derive KEK · wrap VMK.
  const pinSalt = generateArgon2Salt(16);
  const argonParams =
    input.pinMode === "pin" ? PIN_ARGON_PARAMS : PASSPHRASE_ARGON_PARAMS;
  let kek: Uint8Array;
  try {
    kek =
      input.pinMode === "pin"
        ? await deriveKekFromPin({ pin: input.pinSecret, salt: pinSalt })
        : await deriveKekFromPassphrase({
            passphrase: input.pinSecret,
            salt: pinSalt,
          });
  } catch (err) {
    zeroiseBuffer(vmk);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "derive_kek_failed",
    };
  }
  let pinEnvelope: Uint8Array;
  let pinNonce: Uint8Array;
  try {
    const { envelope, nonce } = await wrapKey({ keyToWrap: vmk, kek });
    pinEnvelope = envelope;
    pinNonce = nonce;
  } finally {
    zeroiseBuffer(kek);
  }
  const pinWrappedCiphertext = pinEnvelope.slice(pinNonce.length);

  // 4 · POST consume (server atomically inserts PIN envelope + marks
  // device envelope consumed).
  const res = await fetch("/api/nex-native/vault/device/envelope/consume", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      envelope_id: input.envelopeId,
      device_id: myKey.deviceId,
      pin_salt_hex: bytesToHex(pinSalt),
      pin_argon_params: {
        t: argonParams.t,
        m: argonParams.m,
        p: argonParams.p,
        dkLen: argonParams.dkLen,
        version: argonParams.version,
        variant: argonParams.variant,
      },
      pin_wrapped_vmk_hex: bytesToHex(pinWrappedCiphertext),
      pin_nonce_hex: bytesToHex(pinNonce),
    }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
  };
  if (!res.ok || !body.ok) {
    zeroiseBuffer(vmk);
    return { ok: false, error: body.error ?? `status_${res.status}` };
  }

  // 5 · Install VMK locally (copies into tab-scoped singleton, scrubs
  // the local reference).
  installVmk(vmk);
  zeroiseBuffer(vmk);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Alice · revoke another device
// ---------------------------------------------------------------------------

export async function revokeDevice(targetDeviceId: string): Promise<{
  ok: boolean;
  error?: string;
  stepUp?: string[];
}> {
  const res = await fetch("/api/nex-native/vault/device/revoke", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ target_device_id: targetDeviceId }),
  });
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
// Alice · list devices with Vault status (for UI)
// ---------------------------------------------------------------------------

export interface VaultDeviceSummary {
  device_id: string;
  public_key: string;
  created_at: string;
  last_seen_at: string;
  revoked_at: string | null;
  vault_status: "authorised" | "pending" | "not_authorised" | "revoked";
}

export async function listVaultDevices(): Promise<{
  ok: boolean;
  devices: VaultDeviceSummary[];
  error?: string;
}> {
  const res = await fetch("/api/nex-native/vault/device/list", {
    method: "GET",
  });
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    devices?: VaultDeviceSummary[];
  };
  if (!res.ok || !body.ok) {
    return { ok: false, devices: [], error: body.error ?? `status_${res.status}` };
  }
  return { ok: true, devices: body.devices ?? [] };
}

export { publicKeyBase64 };
