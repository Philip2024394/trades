// src/lib/nex-native/crypto/attachment-envelope.ts
//
// Bridge 81 · Envelope encryption for personal peer-chat attachments.
// -------------------------------------------------------------------
// Scope (per doctrine split sealed 2026-09-29 · amended same day):
//   · Personal media (attachment_type IN 'image', 'video', 'audio') →
//     use this module · encrypt end-to-end.
//   · Commerce media (attachment_type IN 'product', 'menu_item',
//     'cart_order', 'product_share') → skip this module · stays
//     server-plaintext so /shop and /menu render for cold visitors.
//
// Model: envelope encryption.
//   1. Generate a random 32-byte content key K + 24-byte nonce N.
//   2. Encrypt the file bytes ONCE with nacl.secretbox(bytes, N, K).
//   3. For every recipient device (peer + own devices), WRAP K with
//      the per-pair shared secret: wrapped_i = nacl.box.after(K, wnonce_i, sharedSecret_i).
//   4. Upload the ciphertext to a bucket · store enc metadata +
//      wrapped[] on the message row.
//   5. Recipient device decrypts one wrapped_i → recovers K → fetches
//      ciphertext → decrypts bytes → creates a blob URL for render.
//
// The one-encryption-per-file property means a 25MB video is
// encrypted once, not once-per-device — critical for CPU on mobile.

"use client";

import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";
import type { NexDeviceKey } from "./device-key";
import { getSharedSecret } from "./shared-secret";
import { decodePublicKey } from "./device-key";

/** One wrapped copy of the content key, addressed to one device. */
export interface WrappedAttachmentKey {
  device_id: string;
  wrapped_b64: string;
  wrap_nonce_b64: string;
}

/** Full envelope shape stored in attachment_meta.envelope for
 *  encrypted attachments. */
export interface AttachmentEnvelope {
  version: 1;
  /** Bucket-relative path or public URL of the encrypted ciphertext. */
  storage_url: string;
  /** Nonce used with the content key to encrypt the file bytes. */
  content_nonce_b64: string;
  /** Sender's public key (base64) + device id at send time · needed
   *  by the recipient to re-derive the same shared secret when
   *  unwrapping their per-device wrapped key. */
  sender_public_key: string;
  sender_device_id: string;
  /** One wrapped copy of the content key per (peer + sender) device.
   *  The recipient finds the row matching its own device_id and
   *  unwraps to recover the content key. */
  wrapped_keys: WrappedAttachmentKey[];
  /** Original file's MIME type so the render layer knows which
   *  element to use (img / video / audio). Not sensitive · stored
   *  in the envelope alongside the URL. */
  content_type: string;
  /** Original file size · lets the receiver validate the fetch. */
  size_bytes: number;
}

export interface EncryptFileResult {
  ciphertext: Uint8Array;
  contentNonce: Uint8Array;
  contentKey: Uint8Array;
}

/** Encrypt a file's bytes once with a random content key. Callers
 *  then upload the ciphertext + call wrapContentKey per recipient
 *  device to build the envelope. */
export function encryptFileBytes(bytes: Uint8Array): EncryptFileResult {
  const contentKey = nacl.randomBytes(nacl.secretbox.keyLength);
  const contentNonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const ciphertext = nacl.secretbox(bytes, contentNonce, contentKey);
  return { ciphertext, contentNonce, contentKey };
}

/** Wrap a content key for one target device. Returns the wrapped
 *  bytes + the wrap nonce, both base64-encoded for JSON transport. */
export function wrapContentKey(
  contentKey: Uint8Array,
  self: NexDeviceKey,
  targetAccountId: string,
  targetDeviceId: string,
  targetPublicKeyBase64: string,
): WrappedAttachmentKey {
  const secret = getSharedSecret(
    self.secretKey,
    targetAccountId,
    targetDeviceId,
    targetPublicKeyBase64,
  );
  const wrapNonce = nacl.randomBytes(nacl.box.nonceLength);
  const wrapped = nacl.box.after(contentKey, wrapNonce, secret);
  return {
    device_id: targetDeviceId,
    wrapped_b64: naclUtil.encodeBase64(wrapped),
    wrap_nonce_b64: naclUtil.encodeBase64(wrapNonce),
  };
}

/** Try to unwrap the content key from an envelope using this device's
 *  keypair. Returns null when no wrapped row is addressed to this
 *  device OR when the wrapped bytes fail the Poly1305 tag (tamper
 *  detection). */
export function unwrapContentKey(
  envelope: AttachmentEnvelope,
  self: NexDeviceKey,
  senderAccountId: string,
): Uint8Array | null {
  const target = envelope.wrapped_keys.find(
    (r) => r.device_id === self.deviceId,
  );
  if (!target) return null;
  const secret = getSharedSecret(
    self.secretKey,
    senderAccountId,
    envelope.sender_device_id,
    envelope.sender_public_key,
  );
  const wrapped = naclUtil.decodeBase64(target.wrapped_b64);
  const wrapNonce = naclUtil.decodeBase64(target.wrap_nonce_b64);
  return nacl.box.open.after(wrapped, wrapNonce, secret);
}

/** Decrypt the file bytes with the recovered content key. */
export function decryptFileBytes(
  ciphertext: Uint8Array,
  contentNonceB64: string,
  contentKey: Uint8Array,
): Uint8Array | null {
  const contentNonce = naclUtil.decodeBase64(contentNonceB64);
  return nacl.secretbox.open(ciphertext, contentNonce, contentKey);
}

/** Convenience: fetch ciphertext from storage_url, unwrap the
 *  key, decrypt the file, and return the decrypted bytes + the
 *  content_type so the render layer can build a blob URL. Returns
 *  null on any failure (tamper, wrong device, network). */
export async function fetchAndDecryptAttachment(
  envelope: AttachmentEnvelope,
  self: NexDeviceKey,
  senderAccountId: string,
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  const contentKey = unwrapContentKey(envelope, self, senderAccountId);
  if (!contentKey) return null;
  try {
    const resp = await fetch(envelope.storage_url);
    if (!resp.ok) return null;
    const buf = new Uint8Array(await resp.arrayBuffer());
    const plain = decryptFileBytes(buf, envelope.content_nonce_b64, contentKey);
    if (!plain) return null;
    return { bytes: plain, contentType: envelope.content_type };
  } catch {
    return null;
  }
}

/** Build the envelope object ready to store in attachment_meta.
 *  Callers assemble the wrapped_keys array by looping over every
 *  target device and calling wrapContentKey. */
export function buildEnvelope(opts: {
  storageUrl: string;
  contentNonce: Uint8Array;
  senderPublicKey: string;
  senderDeviceId: string;
  wrappedKeys: WrappedAttachmentKey[];
  contentType: string;
  sizeBytes: number;
}): AttachmentEnvelope {
  return {
    version: 1,
    storage_url: opts.storageUrl,
    content_nonce_b64: naclUtil.encodeBase64(opts.contentNonce),
    sender_public_key: opts.senderPublicKey,
    sender_device_id: opts.senderDeviceId,
    wrapped_keys: opts.wrappedKeys,
    content_type: opts.contentType,
    size_bytes: opts.sizeBytes,
  };
}

/** Type guard for arbitrary attachment_meta JSON. */
export function isAttachmentEnvelope(x: unknown): x is AttachmentEnvelope {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    o.version === 1 &&
    typeof o.storage_url === "string" &&
    typeof o.content_nonce_b64 === "string" &&
    typeof o.sender_public_key === "string" &&
    typeof o.sender_device_id === "string" &&
    Array.isArray(o.wrapped_keys) &&
    typeof o.content_type === "string" &&
    typeof o.size_bytes === "number"
  );
}
