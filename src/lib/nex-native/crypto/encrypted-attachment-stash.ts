// src/lib/nex-native/crypto/encrypted-attachment-stash.ts
//
// Bridge 88 · sessionStorage stash for encrypted-attachment content keys.
// -----------------------------------------------------------------------
// The upload phase (client-side encryption + POST ciphertext) produces
// a content key that must survive between upload and send. The composer
// carries the storage URL in a URL query param; we key the stash by
// URL so the composer intercept can retrieve the key when the send
// form is submitted.
//
// sessionStorage scope: per-tab, survives navigation within nex-native,
// wiped on tab close. That matches the natural user flow (upload → type
// caption → send). Losing the key mid-flow just means the send falls
// back to plaintext for that attachment.
//
// Security note: any script running in the same origin can read
// sessionStorage. Acceptable given that a script with XSS in the tab
// can already exfiltrate plaintext from the composer. The content key
// is never persisted to disk.

"use client";

const PREFIX = "nex-attach-key:";

export interface StashedEncryptedAttachmentKey {
  contentKey: number[];      // Array.from(Uint8Array) so it's JSON-serialisable
  contentNonce: number[];
  contentType: string;
  sizeBytes: number;
  kind: "image" | "video" | "audio";
}

export function stashEncryptedAttachmentKey(
  storageUrl: string,
  value: StashedEncryptedAttachmentKey,
): void {
  try {
    sessionStorage.setItem(PREFIX + storageUrl, JSON.stringify(value));
  } catch {
    /* private-browsing / quota · caller falls back to plaintext */
  }
}

export function readEncryptedAttachmentKey(
  storageUrl: string,
): StashedEncryptedAttachmentKey | null {
  try {
    const raw = sessionStorage.getItem(PREFIX + storageUrl);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      !Array.isArray(parsed.contentKey) ||
      !Array.isArray(parsed.contentNonce) ||
      typeof parsed.contentType !== "string" ||
      typeof parsed.sizeBytes !== "number" ||
      !["image", "video", "audio"].includes(parsed.kind)
    ) {
      return null;
    }
    return parsed as StashedEncryptedAttachmentKey;
  } catch {
    return null;
  }
}

export function clearEncryptedAttachmentKey(storageUrl: string): void {
  try {
    sessionStorage.removeItem(PREFIX + storageUrl);
  } catch {
    /* ignore */
  }
}
