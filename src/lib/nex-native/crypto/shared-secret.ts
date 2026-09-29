// src/lib/nex-native/crypto/shared-secret.ts
//
// Bridge 75 · Per-conversation shared secret cache.
// --------------------------------------------------
// A "shared secret" here is the 32-byte X25519 ECDH output of
// (my_private_key × peer_public_key). Cached in memory per
// (peerAccountId, peerDeviceId) so we don't re-derive on every
// message.
//
// tweetnacl's nacl.box.before() computes exactly this — it's the
// precomputed key you pass to nacl.box.after() for encrypt/decrypt.
// Ergonomics: our encrypted send path (Bridge 76) will call
// getSharedSecret(peer) then nacl.box.after(msg, nonce, secret).
//
// Cache lives in module state · lost on page reload (that's fine ·
// re-derivation is cheap: one X25519 scalar mult per pair per session).
// A larger IndexedDB-backed cache can layer on later if we ever have
// enough distinct pairs per session that re-derivation becomes hot.

"use client";

import nacl from "tweetnacl";
import { decodePublicKey } from "./device-key";

/** Cache key format: `${peerAccountId}::${peerDeviceId}`. */
type CacheKey = string;
const cache = new Map<CacheKey, Uint8Array>();

function cacheKey(peerAccountId: string, peerDeviceId: string): CacheKey {
  return `${peerAccountId}::${peerDeviceId}`;
}

/**
 * Derive (or read from cache) the shared secret between my device's
 * private key and one of the peer's device public keys.
 *
 * The peer may have multiple devices (phone, desktop, tablet). Callers
 * that want to encrypt a message for every device should look up the
 * peer's device list first and call this per device, encrypting the
 * same plaintext once per shared secret.
 */
export function getSharedSecret(
  mySecretKey: Uint8Array,
  peerAccountId: string,
  peerDeviceId: string,
  peerPublicKeyBase64: string,
): Uint8Array {
  const key = cacheKey(peerAccountId, peerDeviceId);
  const cached = cache.get(key);
  if (cached) return cached;
  const peerPub = decodePublicKey(peerPublicKeyBase64);
  const secret = nacl.box.before(peerPub, mySecretKey);
  cache.set(key, secret);
  return secret;
}

/** Drop cached secrets for a peer · used when a device is rotated
 *  server-side (new (account_id, device_id) row appears with a
 *  different public_key). Fresh derivation on next call. */
export function invalidateSharedSecret(
  peerAccountId: string,
  peerDeviceId?: string,
): void {
  if (peerDeviceId) {
    cache.delete(cacheKey(peerAccountId, peerDeviceId));
    return;
  }
  // Purge every device for the peer.
  for (const k of Array.from(cache.keys())) {
    if (k.startsWith(`${peerAccountId}::`)) cache.delete(k);
  }
}

/** Purge everything · call on sign-out. */
export function forgetAllSharedSecrets(): void {
  cache.clear();
}

/* ------------------------------------------------------------------ *
 * Convenience: authenticated encrypt / decrypt using a shared secret. *
 * These are thin wrappers over nacl.box.after / nacl.box.open.after   *
 * so callers don't need to import tweetnacl directly.                 *
 * ------------------------------------------------------------------ */

/** Random 24-byte nonce · required per message · MUST be unique per
 *  (shared secret, message). Reusing a nonce with the same secret
 *  breaks the confidentiality guarantee. */
export function generateNonce(): Uint8Array {
  return nacl.randomBytes(nacl.box.nonceLength);
}

/** Encrypt a plaintext buffer with a precomputed shared secret.
 *  Returns raw ciphertext bytes (includes the 16-byte Poly1305 tag). */
export function sealWithSharedSecret(
  plaintext: Uint8Array,
  nonce: Uint8Array,
  sharedSecret: Uint8Array,
): Uint8Array {
  return nacl.box.after(plaintext, nonce, sharedSecret);
}

/** Decrypt ciphertext + verify the Poly1305 tag with a precomputed
 *  shared secret. Returns null on tamper or wrong secret (rather than
 *  throwing) so callers can fail gracefully. */
export function openWithSharedSecret(
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  sharedSecret: Uint8Array,
): Uint8Array | null {
  return nacl.box.open.after(ciphertext, nonce, sharedSecret);
}
