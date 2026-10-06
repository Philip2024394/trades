// src/lib/nex-native/vault/key-hierarchy.ts
//
// Vault Phase A · Commit A.2 · key-hierarchy primitives.
//
// Isomorphic cryptographic primitives for NEX Vault. Runs on both the
// authenticated client (where KEKs are derived from PIN/passphrase/PRF
// and VMK is unwrapped into memory) and in deterministic server-side
// tests. Carries NO `server-only` import — the client is the primary
// consumer. The server never calls these functions in production; the
// server stores opaque ciphertext envelopes and never derives a KEK or
// unwraps VMK (see Phase A design §A key hierarchy and §L WebAuthn PRF
// trust boundary).
//
// Zero commercial code · no `bisnis` · no `tier` · no `plan` · no
// `subscription` · no `entitlement` · no `quota` · no `allowance`.
// This file is pure cryptography.
//
// Hard rules (sealed 2026-10-06 by founder authorisation):
//
//   1. The server never sees VMK plaintext, K_f plaintext, KEK, PIN,
//      recovery passphrase, WebAuthn PRF output, or device private key.
//   2. All KEK derivation happens on the authenticated client only.
//   3. Nonces are freshly random for every encryption · no reuse ever.
//   4. Argon2id parameters are versioned in-row (nex_vault_setup
//      .pin_argon_params) so future tuning does not break existing
//      wraps. This file defines ONE default profile at Phase A birth.
//   5. The sole supported file-bytes algorithm at Phase A is
//      'aes-256-gcm/v1' (enforced by migration 141 CHECK).
//
// Primitives:
//   · generateVmk · generateContentKey · generateNonce12
//   · aesGcmEncrypt / aesGcmDecrypt    (file bytes AND wrap/unwrap keys)
//   · deriveKekFromPin                 (Argon2id)
//   · deriveKekFromPassphrase          (Argon2id · heavier cost)
//   · deriveKekFromPrf                 (HKDF-SHA256 over WebAuthn PRF)
//   · wrapKey / unwrapKey              (AES-GCM key wrap convenience)
//
// Bytes format for a wrapped envelope on-wire / at-rest:
//   `wrapped_vmk`   = nonce (12B) || ciphertext || GCM auth tag (16B)
//   `content_nonce` is stored separately as the IV used to encrypt the
//     file bytes (not the key wrap).
//
// Phase A algorithm identifier string lives in a single place:
//   PHASE_A_ALGORITHM = 'aes-256-gcm/v1'
//
// Phase A design cross-reference:
//   §A key hierarchy · §L.1 PRF flow · §P ciphertext structural format

import { argon2idAsync } from "@noble/hashes/argon2.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";

// ---------------------------------------------------------------------------
// Constants locked at Phase A birth
// ---------------------------------------------------------------------------

/** Sole supported algorithm identifier at Phase A. Matches migration
 *  141 CHECK on nex_vault_file.encryption_algorithm and
 *  migration 142 CHECK on nex_vault_key_envelope.algorithm. */
export const PHASE_A_ALGORITHM = "aes-256-gcm/v1" as const;
export type PhaseAAlgorithm = typeof PHASE_A_ALGORITHM;

/** AES-GCM uses a 12-byte IV (nonce) by spec. */
export const AES_GCM_NONCE_LENGTH = 12;

/** AES-GCM authentication tag is 16 bytes appended to the ciphertext. */
export const AES_GCM_TAG_LENGTH = 16;

/** VMK and K_f are both 256-bit symmetric keys (32 bytes). */
export const SYMMETRIC_KEY_LENGTH = 32;

/** Default Argon2id params for PIN KEK derivation.
 *  Tuned so a single derivation costs ~500ms on commodity CPU, which
 *  gives serious offline-resistance for the 10^8–10^12 PIN space (the
 *  founder-locked 8–12 digit range). Passphrase mode uses heavier
 *  params below. These values are also persisted in
 *  nex_vault_setup.pin_argon_params so future tuning is additive. */
export const PIN_ARGON_PARAMS = Object.freeze({
  t: 3, // iterations
  m: 64 * 1024, // memory (KiB) · 64 MiB
  p: 1, // parallelism (browser-friendly)
  dkLen: SYMMETRIC_KEY_LENGTH,
  version: 0x13, // Argon2 v1.3
  variant: "argon2id" as const,
});
export type Argon2idParams = typeof PIN_ARGON_PARAMS;

/** Heavier Argon2id params for passphrase mode (user chose stronger
 *  factor at setup · we spend more CPU on them). Still bounded so UX
 *  stays acceptable on mobile authenticators. */
export const PASSPHRASE_ARGON_PARAMS = Object.freeze({
  t: 4,
  m: 128 * 1024, // 128 MiB
  p: 1,
  dkLen: SYMMETRIC_KEY_LENGTH,
  version: 0x13,
  variant: "argon2id" as const,
});

/** Recovery passphrase re-uses the passphrase profile. Named separately
 *  so Phase E can tune one without the other. */
export const RECOVERY_ARGON_PARAMS = PASSPHRASE_ARGON_PARAMS;

/** HKDF info string for WebAuthn-PRF-derived KEK · pinned at Phase A
 *  so future rotations can introduce a new info label without breaking
 *  existing wraps. Design §L.5. */
export const PRF_HKDF_INFO = "nex/vault/webauthn-prf/v1";

/** PIN length bounds (founder-locked 2026-10-06). 6-digit PINs are
 *  rejected everywhere · 8-12 digits is the permitted range. Passphrase
 *  mode uses the separate check in validatePassphrase. */
export const PIN_MIN_LENGTH = 8;
export const PIN_MAX_LENGTH = 12;

/** Passphrase minimum (BIP-39 12-word mnemonic is ~96 bits entropy).
 *  Free-form passphrase bound at 20 chars minimum per design §K. */
export const PASSPHRASE_MIN_LENGTH = 20;

// ---------------------------------------------------------------------------
// Random generation
// ---------------------------------------------------------------------------

function requireCryptoRandom(): Crypto {
  if (typeof globalThis.crypto === "undefined" || !globalThis.crypto.getRandomValues) {
    throw new Error(
      "vault/key-hierarchy: Web Crypto getRandomValues is unavailable in this environment",
    );
  }
  return globalThis.crypto;
}

function randomBytes(length: number): Uint8Array {
  const buf = new Uint8Array(length);
  requireCryptoRandom().getRandomValues(buf);
  return buf;
}

/** Fresh 32-byte VMK. Caller is responsible for lifecycle · VMK must
 *  never be persisted unwrapped, never transmitted, never logged. */
export function generateVmk(): Uint8Array {
  return randomBytes(SYMMETRIC_KEY_LENGTH);
}

/** Fresh 32-byte per-file content key K_f. Same rules as VMK. */
export function generateContentKey(): Uint8Array {
  return randomBytes(SYMMETRIC_KEY_LENGTH);
}

/** 12-byte AES-GCM nonce · fresh per call. Never reused with the same
 *  key. This is the only nonce source in Vault code paths. */
export function generateNonce12(): Uint8Array {
  return randomBytes(AES_GCM_NONCE_LENGTH);
}

/** Random bytes for Argon2id salt. 16 bytes is the published minimum
 *  for secure random salts; migration 142 CHECK accepts 16–64 bytes
 *  for pin/recovery salts and locks prf_salt at exactly 16 bytes. */
export function generateArgon2Salt(length = 16): Uint8Array {
  if (length < 16 || length > 64) {
    throw new Error("vault/key-hierarchy: Argon2 salt must be 16-64 bytes");
  }
  return randomBytes(length);
}

/** PRF salt is pinned at 16 bytes to match migration 142's
 *  nex_vault_setup.prf_salt CHECK (octet_length = 16). */
export function generatePrfSalt(): Uint8Array {
  return randomBytes(16);
}

// ---------------------------------------------------------------------------
// AES-256-GCM primitives (Web Crypto · isomorphic Node 18+ / browser)
// ---------------------------------------------------------------------------

function requireSubtle(): SubtleCrypto {
  if (typeof globalThis.crypto === "undefined" || !globalThis.crypto.subtle) {
    throw new Error(
      "vault/key-hierarchy: Web Crypto subtle is unavailable in this environment",
    );
  }
  return globalThis.crypto.subtle;
}

async function importAesKey(raw: Uint8Array): Promise<CryptoKey> {
  if (raw.length !== SYMMETRIC_KEY_LENGTH) {
    throw new Error(
      `vault/key-hierarchy: AES key must be ${SYMMETRIC_KEY_LENGTH} bytes, got ${raw.length}`,
    );
  }
  return requireSubtle().importKey(
    "raw",
    raw as BufferSource,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Encrypt plaintext with a 256-bit key using AES-256-GCM. Returns
 * ciphertext which includes the appended 16-byte authentication tag
 * (Web Crypto's standard output format).
 *
 * The nonce is passed in and MUST be exactly 12 bytes AND MUST never
 * be reused with the same key. Callers should produce nonces via
 * generateNonce12() per operation.
 *
 * Additional authenticated data (AAD) is optional. When provided it
 * must match on decrypt or GCM verification fails.
 */
export async function aesGcmEncrypt(input: {
  key: Uint8Array;
  nonce: Uint8Array;
  plaintext: Uint8Array;
  aad?: Uint8Array;
}): Promise<Uint8Array> {
  const { key, nonce, plaintext, aad } = input;
  if (nonce.length !== AES_GCM_NONCE_LENGTH) {
    throw new Error(
      `vault/key-hierarchy: AES-GCM nonce must be ${AES_GCM_NONCE_LENGTH} bytes, got ${nonce.length}`,
    );
  }
  const cryptoKey = await importAesKey(key);
  const params: AesGcmParams = {
    name: "AES-GCM",
    iv: nonce as BufferSource,
    tagLength: AES_GCM_TAG_LENGTH * 8,
  };
  if (aad) params.additionalData = aad as BufferSource;
  const ct = await requireSubtle().encrypt(params, cryptoKey, plaintext as BufferSource);
  return new Uint8Array(ct);
}

/**
 * Decrypt AES-256-GCM ciphertext. Throws on tag/AAD mismatch
 * (tampering). Caller is responsible for providing the same nonce
 * and AAD that were used for encryption.
 */
export async function aesGcmDecrypt(input: {
  key: Uint8Array;
  nonce: Uint8Array;
  ciphertext: Uint8Array;
  aad?: Uint8Array;
}): Promise<Uint8Array> {
  const { key, nonce, ciphertext, aad } = input;
  if (nonce.length !== AES_GCM_NONCE_LENGTH) {
    throw new Error(
      `vault/key-hierarchy: AES-GCM nonce must be ${AES_GCM_NONCE_LENGTH} bytes, got ${nonce.length}`,
    );
  }
  const cryptoKey = await importAesKey(key);
  const params: AesGcmParams = {
    name: "AES-GCM",
    iv: nonce as BufferSource,
    tagLength: AES_GCM_TAG_LENGTH * 8,
  };
  if (aad) params.additionalData = aad as BufferSource;
  const pt = await requireSubtle().decrypt(params, cryptoKey, ciphertext as BufferSource);
  return new Uint8Array(pt);
}

// ---------------------------------------------------------------------------
// Key wrapping convenience · the common case is wrap(VMK) under a KEK,
// returning the on-wire envelope format (nonce || ciphertext || tag).
// ---------------------------------------------------------------------------

/**
 * Wrap a 32-byte symmetric key under a 32-byte KEK, producing a 60-byte
 * envelope laid out as:
 *     [ 12-byte nonce ][ 32-byte ciphertext ][ 16-byte GCM auth tag ]
 *
 * This is the exact byte layout the server stores in
 * nex_vault_key_envelope.wrapped_vmk (migration 142 CHECK accepts 32–128
 * bytes for forward compatibility; Phase A uses 60).
 *
 * Nonce is drawn fresh each call. The server never sees a KEK.
 */
export async function wrapKey(input: {
  keyToWrap: Uint8Array;
  kek: Uint8Array;
  aad?: Uint8Array;
}): Promise<{ envelope: Uint8Array; nonce: Uint8Array }> {
  const { keyToWrap, kek, aad } = input;
  if (keyToWrap.length !== SYMMETRIC_KEY_LENGTH) {
    throw new Error(
      `vault/key-hierarchy: wrapKey keyToWrap must be ${SYMMETRIC_KEY_LENGTH} bytes`,
    );
  }
  const nonce = generateNonce12();
  const ciphertext = await aesGcmEncrypt({ key: kek, nonce, plaintext: keyToWrap, aad });
  const envelope = new Uint8Array(nonce.length + ciphertext.length);
  envelope.set(nonce, 0);
  envelope.set(ciphertext, nonce.length);
  return { envelope, nonce };
}

/**
 * Unwrap a 60-byte envelope back to the 32-byte key, verifying the
 * GCM auth tag. Throws on tampering, wrong KEK, or AAD mismatch.
 */
export async function unwrapKey(input: {
  envelope: Uint8Array;
  kek: Uint8Array;
  aad?: Uint8Array;
}): Promise<Uint8Array> {
  const { envelope, kek, aad } = input;
  if (envelope.length < AES_GCM_NONCE_LENGTH + AES_GCM_TAG_LENGTH + 1) {
    throw new Error("vault/key-hierarchy: unwrapKey envelope is too short");
  }
  const nonce = envelope.subarray(0, AES_GCM_NONCE_LENGTH);
  const ciphertext = envelope.subarray(AES_GCM_NONCE_LENGTH);
  const plaintext = await aesGcmDecrypt({ key: kek, nonce, ciphertext, aad });
  if (plaintext.length !== SYMMETRIC_KEY_LENGTH) {
    throw new Error(
      `vault/key-hierarchy: unwrapKey produced ${plaintext.length} bytes, expected ${SYMMETRIC_KEY_LENGTH}`,
    );
  }
  return plaintext;
}

// ---------------------------------------------------------------------------
// Key derivation · Argon2id (PIN · passphrase · recovery)
// ---------------------------------------------------------------------------

/**
 * Derive a 32-byte KEK from a PIN using Argon2id. The caller is
 * responsible for passing an 8-12 digit PIN (validation lives in
 * validatePin). The salt comes from nex_vault_setup.pin_salt.
 *
 * This function runs on the authenticated CLIENT ONLY in production
 * code. The server stores pin_salt and pin_argon_params (both
 * non-secret) but never derives a KEK.
 */
export async function deriveKekFromPin(input: {
  pin: string;
  salt: Uint8Array;
  params?: Argon2idParams;
}): Promise<Uint8Array> {
  const { pin, salt } = input;
  const params = input.params ?? PIN_ARGON_PARAMS;
  validatePin(pin);
  if (salt.length < 16) {
    throw new Error("vault/key-hierarchy: PIN salt must be at least 16 bytes");
  }
  const pinBytes = new TextEncoder().encode(pin);
  const kek = await argon2idAsync(pinBytes, salt, {
    t: params.t,
    m: params.m,
    p: params.p,
    dkLen: params.dkLen,
    version: params.version,
  });
  return new Uint8Array(kek);
}

/**
 * Derive a 32-byte KEK from a passphrase using Argon2id with the
 * heavier passphrase profile. Rejects short passphrases.
 */
export async function deriveKekFromPassphrase(input: {
  passphrase: string;
  salt: Uint8Array;
  params?: Argon2idParams;
}): Promise<Uint8Array> {
  const { passphrase, salt } = input;
  const params = input.params ?? PASSPHRASE_ARGON_PARAMS;
  validatePassphrase(passphrase);
  if (salt.length < 16) {
    throw new Error("vault/key-hierarchy: passphrase salt must be at least 16 bytes");
  }
  const bytes = new TextEncoder().encode(passphrase.normalize("NFKC"));
  const kek = await argon2idAsync(bytes, salt, {
    t: params.t,
    m: params.m,
    p: params.p,
    dkLen: params.dkLen,
    version: params.version,
  });
  return new Uint8Array(kek);
}

/**
 * Derive a 32-byte KEK from a WebAuthn-PRF output using HKDF-SHA256.
 *
 * The PRF output is 32 bytes of uniform-random material produced
 * INSIDE the hardware authenticator. The browser receives it from
 * `getClientExtensionResults().prf.results.first` and passes it to
 * this function. The output is NEVER transmitted to the server
 * (Phase A design §L trust boundary).
 *
 * HKDF info is pinned to PRF_HKDF_INFO so a future rotation can
 * introduce a new info label without breaking existing wraps.
 */
export function deriveKekFromPrf(input: {
  prfOutput: Uint8Array;
  salt?: Uint8Array;
  info?: Uint8Array | string;
}): Uint8Array {
  const { prfOutput } = input;
  if (prfOutput.length !== SYMMETRIC_KEY_LENGTH) {
    throw new Error(
      `vault/key-hierarchy: PRF output must be ${SYMMETRIC_KEY_LENGTH} bytes, got ${prfOutput.length}`,
    );
  }
  const salt = input.salt ?? new Uint8Array(0);
  const infoBytes =
    typeof input.info === "string"
      ? new TextEncoder().encode(input.info)
      : (input.info ?? new TextEncoder().encode(PRF_HKDF_INFO));
  const kek = hkdf(sha256, prfOutput, salt, infoBytes, SYMMETRIC_KEY_LENGTH);
  return new Uint8Array(kek);
}

// ---------------------------------------------------------------------------
// Validators · founder-locked at Phase A birth
// ---------------------------------------------------------------------------

/**
 * Reject anything that is not an 8-12 character all-digit PIN.
 * Founder-locked 2026-10-06 · design §K.
 * 6-digit PINs are impossible at any surface by construction.
 */
export function validatePin(pin: string): void {
  if (typeof pin !== "string") {
    throw new Error("vault/key-hierarchy: PIN must be a string");
  }
  if (pin.length < PIN_MIN_LENGTH || pin.length > PIN_MAX_LENGTH) {
    throw new Error(
      `vault/key-hierarchy: PIN length must be ${PIN_MIN_LENGTH}-${PIN_MAX_LENGTH} digits`,
    );
  }
  if (!/^[0-9]+$/.test(pin)) {
    throw new Error("vault/key-hierarchy: PIN must contain only digits");
  }
}

/**
 * Reject short passphrases. Founder-locked 2026-10-06 · design §K.
 * Minimum 20 chars for free-form passphrase. BIP-39 mnemonic variant
 * (12 words) satisfies this via its character count.
 */
export function validatePassphrase(passphrase: string): void {
  if (typeof passphrase !== "string") {
    throw new Error("vault/key-hierarchy: passphrase must be a string");
  }
  const normalized = passphrase.normalize("NFKC");
  if (normalized.length < PASSPHRASE_MIN_LENGTH) {
    throw new Error(
      `vault/key-hierarchy: passphrase must be at least ${PASSPHRASE_MIN_LENGTH} characters`,
    );
  }
}

// ---------------------------------------------------------------------------
// Byte zeroisation
// ---------------------------------------------------------------------------

/**
 * Overwrite a buffer with zeros · best-effort scrubbing of key material
 * after use. JavaScript garbage collection makes true wipe impossible
 * (copies may linger), but zeroising reduces the window a snapshot can
 * see the key. Callers should zeroise VMK / K_f / KEK immediately after
 * the operation that needed them completes.
 */
export function zeroiseBuffer(buf: Uint8Array): void {
  if (!(buf instanceof Uint8Array)) return;
  buf.fill(0);
}
