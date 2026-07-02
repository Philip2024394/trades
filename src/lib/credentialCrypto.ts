import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash
} from "node:crypto";

// AES-256-GCM wrapper for storing merchant payment credentials
// (Stripe/PayPal/Square secret keys) at rest in Supabase.
//
// Format on disk: base64(nonce[12] || ciphertext || authTag[16])
// Nonce is random per encryption — never reused with the same key.
// authTag prevents ciphertext tampering.
//
// Key source: PAYMENTS_ENCRYPTION_KEY env var. Must be 64 hex chars
// (32 bytes). Falls back to a SHA-256 of SUPABASE_SERVICE_ROLE_KEY in
// dev so local testing works without ceremony — production MUST set
// the explicit key.

const ALGO = "aes-256-gcm";
const NONCE_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer {
  const raw = process.env.PAYMENTS_ENCRYPTION_KEY;
  if (raw && /^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  const fallback = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!fallback) {
    throw new Error(
      "credential_crypto_no_key — set PAYMENTS_ENCRYPTION_KEY (64 hex chars)"
    );
  }
  return createHash("sha256").update(fallback).digest();
}

export function encryptCredential(plaintext: string): string {
  if (!plaintext) return "";
  const key = getKey();
  const nonce = randomBytes(NONCE_LEN);
  const cipher = createCipheriv(ALGO, key, nonce);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([nonce, encrypted, tag]).toString("base64");
}

export function decryptCredential(payload: string): string {
  if (!payload) return "";
  const key = getKey();
  const buf = Buffer.from(payload, "base64");
  if (buf.length < NONCE_LEN + TAG_LEN + 1) {
    throw new Error("credential_crypto_bad_payload");
  }
  const nonce = buf.subarray(0, NONCE_LEN);
  const tag = buf.subarray(buf.length - TAG_LEN);
  const encrypted = buf.subarray(NONCE_LEN, buf.length - TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, nonce);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]);
  return decrypted.toString("utf8");
}

/** Redact for display — show the last 4 characters, mask the rest. */
export function maskCredential(plaintext: string): string {
  if (!plaintext) return "";
  const last = plaintext.slice(-4);
  return `••••${last}`;
}
