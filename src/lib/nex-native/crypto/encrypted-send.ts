// src/lib/nex-native/crypto/encrypted-send.ts
//
// Bridge 76 · Client-side encrypt + POST helper for peer messages.
// ----------------------------------------------------------------
// The composer form's Server Action path stays for the plaintext
// fallback. When both parties have device keys, this helper drives
// the E2E flow instead:
//   1. Fetch peer devices + self devices (via listAccountDeviceKeysAction)
//   2. Ensure our own device keypair (via ensureDeviceKey)
//   3. Generate one message_group_id + one plaintext buffer
//   4. Encrypt once per (peer device + own device) using the pair's
//      X25519 shared secret + a fresh 24-byte nonce
//   5. POST every row in a single JSON body to
//      /api/nex-native/peer-message/encrypted
//
// UI wiring (form intercept + optimistic bubble + revalidate) lives
// separately in Bridge 76b · this module is the pure crypto/transport
// layer that a hook can call.

"use client";

import naclUtil from "tweetnacl-util";
import {
  ensureDeviceKey,
  publicKeyBase64,
} from "./device-key";
import {
  generateNonce,
  getSharedSecret,
  sealWithSharedSecret,
} from "./shared-secret";
import {
  buildEnvelope,
  wrapContentKey,
  type AttachmentEnvelope,
} from "./attachment-envelope";
import type { UploadedEncryptedAttachment } from "./encrypted-attachment-upload";
import { cachedListDeviceKeys } from "./device-key-cache";

export interface EncryptedSendOptions {
  conversationId: string;
  peerAccountId: string;
  selfAccountId: string;
  plaintext: string;
  replyToId?: string | null;
  attachmentUrl?: string | null;
  attachmentType?:
    | "image" | "video" | "audio"
    | "product" | "menu_item" | "cart_order" | "product_share"
    | null;
  attachmentMeta?: unknown;
  /** Bridge 81 · when set, the caller has pre-uploaded an encrypted
   *  attachment via uploadEncryptedAttachment. This function wraps
   *  the content key for every recipient device, builds the envelope,
   *  and includes it in attachment_meta.envelope. Sets attachment_url
   *  to the storage URL + attachment_type to the media kind. */
  encryptedAttachment?: UploadedEncryptedAttachment | null;
}

export interface EncryptedSendResult {
  ok: true;
  messageGroupId: string;
  insertedIds: string[];
}

export interface EncryptedSendFailure {
  ok: false;
  /** Reason the fallback (plaintext) path should run instead:
   *   · no_peer_devices  → peer hasn't set up E2E · use plaintext
   *   · no_self_devices  → this device isn't registered · use plaintext
   *   · encrypt_failed   → hard error · surface to UI  */
  error:
    | "no_peer_devices"
    | "no_self_devices"
    | "encrypt_failed"
    | "http_failed"
    | "unknown";
  message?: string;
}

export type EncryptedSendOutcome = EncryptedSendResult | EncryptedSendFailure;

/**
 * The main entrypoint. Returns { ok:false, error:"no_peer_devices" }
 * when the peer hasn't opened NEX from any device since B74 landed —
 * the caller should transparently fall back to the plaintext send
 * path in that case.
 */
export async function sendEncryptedPeerMessage(
  opts: EncryptedSendOptions,
): Promise<EncryptedSendOutcome> {
  // 1. Peer + self device lists (Bridge 84 · 60s TTL client cache
  // so repeat sends in one conversation don't re-hit the DB).
  const [peerRes, selfRes] = await Promise.all([
    cachedListDeviceKeys(opts.peerAccountId),
    cachedListDeviceKeys(opts.selfAccountId),
  ]);
  if (!peerRes.ok) {
    return { ok: false, error: "unknown", message: peerRes.error };
  }
  if (!selfRes.ok) {
    return { ok: false, error: "unknown", message: selfRes.error };
  }
  if (peerRes.devices.length === 0) {
    return { ok: false, error: "no_peer_devices" };
  }
  if (selfRes.devices.length === 0) {
    return { ok: false, error: "no_self_devices" };
  }

  // 2. Our device keypair (private key in IDB).
  const self = await ensureDeviceKey();
  const selfPubB64 = publicKeyBase64(self.publicKey);

  // 3. Group id + plaintext.
  const messageGroupId = crypto.randomUUID();
  const plaintextBytes = naclUtil.decodeUTF8(opts.plaintext);

  // 4. Encrypt for every device on both sides. Include EVERY registered
  // device — the recipient's freshest device wins for actual reading,
  // but stale rows are harmless (they just won't decrypt with any
  // device the recipient still holds).
  type ApiRow = {
    conversation_id: string;
    ciphertext_b64: string;
    nonce_b64: string;
    sender_public_key: string;
    sender_device_id: string;
    recipient_device_id: string;
    reply_to_id: string | null;
    attachment_url: string | null;
    attachment_type: string | null;
    attachment_meta: unknown;
  };

  const rows: ApiRow[] = [];
  const targets = [
    ...peerRes.devices.map((d) => ({ ...d, accountId: opts.peerAccountId })),
    ...selfRes.devices.map((d) => ({ ...d, accountId: opts.selfAccountId })),
  ];

  // 4a. Build the attachment envelope once (if any) · wraps the
  // content key for every target device so each recipient can unwrap.
  let attachmentUrl: string | null = opts.attachmentUrl ?? null;
  let attachmentType = opts.attachmentType ?? null;
  let attachmentMeta: unknown = opts.attachmentMeta ?? null;
  let envelope: AttachmentEnvelope | null = null;
  if (opts.encryptedAttachment) {
    const enc = opts.encryptedAttachment;
    const wrappedKeys = targets.map((t) =>
      wrapContentKey(
        enc.contentKey,
        self,
        t.accountId,
        t.device_id,
        t.public_key,
      ),
    );
    envelope = buildEnvelope({
      storageUrl: enc.storageUrl,
      contentNonce: enc.contentNonce,
      senderPublicKey: selfPubB64,
      senderDeviceId: self.deviceId,
      wrappedKeys,
      contentType: enc.contentType,
      sizeBytes: enc.sizeBytes,
    });
    attachmentUrl = enc.storageUrl;
    attachmentType = enc.kind;
    // Merge the envelope into any pre-existing attachment_meta so
    // callers can still smuggle extra hints (e.g. dimensions) alongside.
    const base =
      opts.attachmentMeta && typeof opts.attachmentMeta === "object"
        ? { ...(opts.attachmentMeta as Record<string, unknown>) }
        : {};
    base.envelope = envelope;
    attachmentMeta = base;
  }

  try {
    for (const t of targets) {
      const secret = getSharedSecret(
        self.secretKey,
        t.accountId,
        t.device_id,
        t.public_key,
      );
      const nonce = generateNonce();
      const ct = sealWithSharedSecret(plaintextBytes, nonce, secret);
      rows.push({
        conversation_id: opts.conversationId,
        ciphertext_b64: naclUtil.encodeBase64(ct),
        nonce_b64: naclUtil.encodeBase64(nonce),
        sender_public_key: selfPubB64,
        sender_device_id: self.deviceId,
        recipient_device_id: t.device_id,
        reply_to_id: opts.replyToId ?? null,
        attachment_url: attachmentUrl,
        attachment_type: attachmentType,
        attachment_meta: attachmentMeta,
      });
    }
  } catch (e) {
    return {
      ok: false,
      error: "encrypt_failed",
      message: (e as Error).message,
    };
  }

  // 5. POST.
  try {
    const resp = await fetch("/api/nex-native/peer-message/encrypted", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message_group_id: messageGroupId, rows }),
    });
    if (!resp.ok) {
      return {
        ok: false,
        error: "http_failed",
        message: `${resp.status} ${resp.statusText}`,
      };
    }
    const json = (await resp.json()) as { ok: boolean; ids?: string[]; error?: string };
    if (!json.ok) {
      return { ok: false, error: "http_failed", message: json.error };
    }
    return {
      ok: true,
      messageGroupId,
      insertedIds: json.ids ?? [],
    };
  } catch (e) {
    return {
      ok: false,
      error: "http_failed",
      message: (e as Error).message,
    };
  }
}
