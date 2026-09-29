// src/lib/nex-native/crypto/encrypted-receive.ts
//
// Bridge 76 · Client-side decrypt helper for peer messages.
// ---------------------------------------------------------
// Server-rendered rows carry the sentinel body '(encrypted)' when
// `encrypted=true`. The client mounts a small hook that iterates
// every encrypted row addressed to this device, uses the sender's
// public key + our private key to derive the shared secret, and
// decrypts the ciphertext back to plaintext. Then it updates the
// visible bubble (via DOM mutation on data-nex-msg-id, or via a
// React state store — the caller picks the presentation).
//
// Also fires a `markPeerMessageDeliveredAction` on success so Bridge 78
// can purge the ciphertext once every recipient device has ack'd.

"use client";

import naclUtil from "tweetnacl-util";
import {
  ensureDeviceKey,
} from "./device-key";
import {
  getSharedSecret,
  openWithSharedSecret,
} from "./shared-secret";

export interface EncryptedRowInput {
  id: string;
  senderAccountId: string;
  senderDeviceId: string;
  senderPublicKey: string;
  recipientDeviceId: string;
  ciphertextB64: string;
  nonceB64: string;
}

export type DecryptResult =
  | { id: string; ok: true; plaintext: string }
  | { id: string; ok: false; error: "wrong_device" | "tamper" | "encoding" };

/**
 * Decrypt every input row addressed to this device. Rows addressed to
 * a different recipientDeviceId are skipped (marked "wrong_device")
 * so the caller can drop them from the UI — this device can't read
 * them because the shared secret is different for each device.
 */
export async function decryptEncryptedRows(
  rows: EncryptedRowInput[],
): Promise<DecryptResult[]> {
  const self = await ensureDeviceKey();
  const out: DecryptResult[] = [];

  for (const r of rows) {
    if (r.recipientDeviceId !== self.deviceId) {
      out.push({ id: r.id, ok: false, error: "wrong_device" });
      continue;
    }
    try {
      const secret = getSharedSecret(
        self.secretKey,
        r.senderAccountId,
        r.senderDeviceId,
        r.senderPublicKey,
      );
      const ct = naclUtil.decodeBase64(r.ciphertextB64);
      const nonce = naclUtil.decodeBase64(r.nonceB64);
      const plain = openWithSharedSecret(ct, nonce, secret);
      if (!plain) {
        out.push({ id: r.id, ok: false, error: "tamper" });
        continue;
      }
      out.push({
        id: r.id,
        ok: true,
        plaintext: naclUtil.encodeUTF8(plain),
      });
    } catch {
      out.push({ id: r.id, ok: false, error: "encoding" });
    }
  }

  return out;
}
