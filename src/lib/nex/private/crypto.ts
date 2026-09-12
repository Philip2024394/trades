// src/lib/nex/private/crypto.ts
//
// NEX Y-P3 · Client-side crypto primitives · Philip 2026-09-07
//
// Web Crypto API only. Zero custom cryptography. Zero external deps.
// Every algorithm choice matches the Y-P3 architecture:
//
//   Content encryption   AES-GCM 256-bit
//   Key derivation       PBKDF2-HMAC-SHA256 · 600,000 iterations (OWASP 2023)
//   Salt                 32 bytes random per user
//   IV / nonce           12 bytes random per encryption operation
//   DEK wrap             AES-GCM using the KEK · 12-byte wrap IV
//
// Threat model this file addresses:
//   · server compromise of ciphertext store  → protected (no plaintext server-side)
//   · database read of wrapped_dek           → protected (needs KEK to unwrap)
//   · tampering with ciphertext / wrapped DEK → detected (GCM auth tag fails)
//   · wrong password on unwrap                → detected (GCM auth tag fails)
//
// Threat model this file does NOT address:
//   · client-side JS injection with an unlocked DEK in memory
//   · full device compromise
//   · brute-force of weak user passwords (mitigated only by KDF cost)
//
// Callers hold the DEK in memory ONLY. This module never writes to
// localStorage, sessionStorage, IndexedDB, or the network. Never logs
// secrets. Never accepts a password over stdout/URL/analytics.
//
// NEVER modify the algorithm choices without explicit founder authorisation
// and a migration strategy for the key_version column.

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** AES-GCM content key length in bits. */
export const NEX_DEK_BITS = 256;

/** Content-encryption IV / nonce length in bytes. AES-GCM standard. */
export const NEX_IV_BYTES = 12;

/** KEK-wrap IV length in bytes. AES-GCM standard. */
export const NEX_WRAP_IV_BYTES = 12;

/** PBKDF2 salt length in bytes. */
export const NEX_SALT_BYTES = 32;

/** PBKDF2 iterations. OWASP 2023 recommendation for PBKDF2-SHA256. */
export const NEX_KDF_ITERATIONS_DEFAULT = 600_000;

/** Minimum acceptable PBKDF2 iterations. Matches DB CHECK. */
export const NEX_KDF_ITERATIONS_MIN = 100_000;

/** KDF algorithm identifier persisted alongside the wrapped DEK. */
export const NEX_KDF_ALGO = "PBKDF2-SHA256" as const;

/** Key version persisted alongside every ciphertext + wrapped DEK. */
export const NEX_KEY_VERSION_CURRENT = 1;

// ---------------------------------------------------------------------------
// Environment probe (Node 20+ + all modern browsers expose crypto.subtle)
// ---------------------------------------------------------------------------

function subtle(): SubtleCrypto {
  const g = globalThis as unknown as { crypto?: { subtle?: SubtleCrypto } };
  if (!g.crypto?.subtle) {
    throw new Error("crypto.subtle unavailable · Web Crypto is required (Node 20+ or a modern browser)");
  }
  return g.crypto.subtle;
}
function randomBytes(len: number): Uint8Array {
  const g = globalThis as unknown as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } };
  if (!g.crypto?.getRandomValues) {
    throw new Error("crypto.getRandomValues unavailable · secure randomness is required");
  }
  const out = new Uint8Array(len);
  g.crypto.getRandomValues(out);
  return out;
}

// ---------------------------------------------------------------------------
// Random material
// ---------------------------------------------------------------------------

/** 32-byte random salt for PBKDF2. Store server-side. Not a secret. */
export function generateSalt(): Uint8Array {
  return randomBytes(NEX_SALT_BYTES);
}

/** 12-byte random IV for AES-GCM content encryption. Store next to ciphertext. */
export function generateIv(): Uint8Array {
  return randomBytes(NEX_IV_BYTES);
}

/** 12-byte random IV used specifically for wrapping the DEK. */
export function generateWrapIv(): Uint8Array {
  return randomBytes(NEX_WRAP_IV_BYTES);
}

// ---------------------------------------------------------------------------
// Key generation and derivation
// ---------------------------------------------------------------------------

/** Generate a fresh 256-bit AES-GCM DEK. Extractable so we can wrap it. */
export async function generateDek(): Promise<CryptoKey> {
  return subtle().generateKey(
    { name: "AES-GCM", length: NEX_DEK_BITS },
    /* extractable */ true,
    ["encrypt", "decrypt"],
  );
}

/**
 * Derive a KEK from a user password + per-user salt using PBKDF2-HMAC-SHA256.
 * The resulting key is an AES-GCM key used exclusively to wrap/unwrap the DEK.
 *
 * The KEK is NOT extractable — cannot be read out of the browser once derived.
 */
export async function deriveKek(
  password: string,
  salt: Uint8Array,
  iterations: number = NEX_KDF_ITERATIONS_DEFAULT,
): Promise<CryptoKey> {
  if (typeof password !== "string" || password.length === 0) {
    throw new Error("deriveKek: password must be a non-empty string");
  }
  if (!(salt instanceof Uint8Array) || salt.length < 16) {
    throw new Error("deriveKek: salt must be a Uint8Array of at least 16 bytes");
  }
  if (!Number.isInteger(iterations) || iterations < NEX_KDF_ITERATIONS_MIN) {
    throw new Error(`deriveKek: iterations must be >= ${NEX_KDF_ITERATIONS_MIN}`);
  }

  const material = await subtle().importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    /* extractable */ false,
    ["deriveKey"],
  );

  return subtle().deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: NEX_DEK_BITS },
    /* extractable */ false,
    ["encrypt", "decrypt"],
  );
}

// ---------------------------------------------------------------------------
// DEK wrap / unwrap (server sees only wrapped bytes + IV + salt + params)
// ---------------------------------------------------------------------------

export interface WrappedDek {
  wrapped: Uint8Array;   // ciphertext of the exported raw DEK
  wrap_iv: Uint8Array;   // 12-byte IV used to wrap
}

/** Wrap a DEK with a KEK using AES-GCM. Returns opaque bytes safe to persist. */
export async function wrapDek(dek: CryptoKey, kek: CryptoKey): Promise<WrappedDek> {
  const rawDek = await subtle().exportKey("raw", dek);
  const wrap_iv = generateWrapIv();
  const wrapped = await subtle().encrypt(
    { name: "AES-GCM", iv: wrap_iv as BufferSource },
    kek,
    rawDek,
  );
  return { wrapped: new Uint8Array(wrapped), wrap_iv };
}

/**
 * Unwrap a wrapped DEK with a KEK using AES-GCM. Throws if:
 *   · the wrap_iv is wrong length
 *   · the wrapped ciphertext has been tampered with (GCM auth tag fails)
 *   · the KEK is wrong (wrong password → wrong KEK → auth tag fails)
 */
export async function unwrapDek(
  wrapped: Uint8Array,
  wrap_iv: Uint8Array,
  kek: CryptoKey,
): Promise<CryptoKey> {
  if (!(wrap_iv instanceof Uint8Array) || wrap_iv.length !== NEX_WRAP_IV_BYTES) {
    throw new Error(`unwrapDek: wrap_iv must be ${NEX_WRAP_IV_BYTES} bytes`);
  }
  if (!(wrapped instanceof Uint8Array) || wrapped.length < 16) {
    throw new Error("unwrapDek: wrapped bytes too short");
  }
  const raw = await subtle().decrypt(
    { name: "AES-GCM", iv: wrap_iv as BufferSource },
    kek,
    wrapped as BufferSource,
  );
  return subtle().importKey(
    "raw",
    raw,
    { name: "AES-GCM", length: NEX_DEK_BITS },
    /* extractable */ true,
    ["encrypt", "decrypt"],
  );
}

// ---------------------------------------------------------------------------
// Content encryption / decryption using the DEK
// ---------------------------------------------------------------------------

export interface EncryptedContent {
  ciphertext: Uint8Array;  // AES-GCM ciphertext (includes auth tag suffix per Web Crypto)
  iv: Uint8Array;          // 12-byte IV used for this ciphertext
}

/** Encrypt a plaintext string (UTF-8) with the DEK. Returns {ciphertext, iv}. */
export async function encryptContent(plaintext: string, dek: CryptoKey): Promise<EncryptedContent> {
  if (typeof plaintext !== "string") {
    throw new Error("encryptContent: plaintext must be a string");
  }
  const iv = generateIv();
  const bytes = new TextEncoder().encode(plaintext);
  const ct = await subtle().encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    dek,
    bytes,
  );
  return { ciphertext: new Uint8Array(ct), iv };
}

/**
 * Decrypt a ciphertext with the DEK. Returns the UTF-8 plaintext.
 * Throws if the auth tag fails (tampering, wrong key, wrong IV).
 */
export async function decryptContent(
  ciphertext: Uint8Array,
  iv: Uint8Array,
  dek: CryptoKey,
): Promise<string> {
  if (!(iv instanceof Uint8Array) || iv.length !== NEX_IV_BYTES) {
    throw new Error(`decryptContent: iv must be ${NEX_IV_BYTES} bytes`);
  }
  if (!(ciphertext instanceof Uint8Array) || ciphertext.length < 16) {
    throw new Error("decryptContent: ciphertext too short");
  }
  const bytes = await subtle().decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    dek,
    ciphertext as BufferSource,
  );
  return new TextDecoder().decode(bytes);
}

// ---------------------------------------------------------------------------
// Encoding helpers · used only at the transport boundary. Never for encryption.
// ---------------------------------------------------------------------------

/** Convert a Uint8Array to a base64 string. Safe for JSON transport. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const g = globalThis as unknown as { btoa?: (s: string) => string };
  if (g.btoa) return g.btoa(binary);
  // Node fallback
  return Buffer.from(bytes).toString("base64");
}

/** Convert a base64 string back to a Uint8Array. */
export function base64ToBytes(b64: string): Uint8Array {
  const g = globalThis as unknown as { atob?: (s: string) => string };
  if (g.atob) {
    const binary = g.atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(b64, "base64"));
}
