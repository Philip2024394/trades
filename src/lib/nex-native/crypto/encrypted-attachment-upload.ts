// src/lib/nex-native/crypto/encrypted-attachment-upload.ts
//
// Bridge 81 · Client helper: encrypt a File + upload ciphertext.
// --------------------------------------------------------------
// Returns a "pending attachment" descriptor the caller stashes until
// send time. At send time, encrypted-send.ts loops over recipient
// device keys, wraps the content key for each, builds the envelope,
// and includes it in attachment_meta.
//
// The content key + nonce STAY IN MEMORY on the sender's device
// between upload and send · they never touch the server as plaintext.

"use client";

import {
  encryptFileBytes,
  type EncryptFileResult,
} from "./attachment-envelope";

export interface UploadedEncryptedAttachment {
  /** Public URL of the ciphertext object in the storage bucket. */
  storageUrl: string;
  /** Bucket-relative path · used by Bridge 78 purge to delete the
   *  object when its message row is purged. */
  storagePath: string;
  /** File MIME · used by the render layer to pick img/video/audio. */
  contentType: string;
  /** Original file size in bytes. */
  sizeBytes: number;
  /** In-memory content key that must be wrapped per recipient device
   *  at send time. Never persisted to disk. */
  contentKey: Uint8Array;
  /** Nonce used to encrypt the file bytes · included in the envelope
   *  so the recipient can decrypt. */
  contentNonce: Uint8Array;
  /** Kind classifier for the message row · matches the existing
   *  NexPeerAttachmentKind enum. */
  kind: "image" | "video" | "audio";
}

export interface UploadEncryptedAttachmentOptions {
  file: File;
  onProgress?: (fraction: number) => void;
}

/**
 * Encrypt the given file and upload the ciphertext to
 * /api/nex-native/attachment/encrypted. Resolves with a pending
 * attachment descriptor the caller stashes until the peer message
 * send. Rejects on network / storage / MIME failure.
 */
export async function uploadEncryptedAttachment(
  opts: UploadEncryptedAttachmentOptions,
): Promise<UploadedEncryptedAttachment> {
  const kind = classifyMime(opts.file.type);
  if (!kind) {
    throw new Error(`unsupported attachment MIME '${opts.file.type}'`);
  }

  // Read the file bytes into memory. For >50 MB files this can spike
  // memory · current cap is 25 MB per NEX_PEER_ATTACHMENT_MAX_BYTES.
  const rawBytes = new Uint8Array(await opts.file.arrayBuffer());
  opts.onProgress?.(0.15);

  // Encrypt · nacl.secretbox is streaming-ish but pure JS, so a 25MB
  // file runs O(seconds) on modern devices. Acceptable for MVP.
  const enc: EncryptFileResult = encryptFileBytes(rawBytes);
  opts.onProgress?.(0.4);

  // Upload the ciphertext as raw bytes.
  const ext = extForMime(opts.file.type);
  const resp = await fetch("/api/nex-native/attachment/encrypted", {
    method: "POST",
    headers: {
      "content-type": "application/octet-stream",
      "x-nex-enc-ext": ext,
    },
    body: enc.ciphertext,
  });
  opts.onProgress?.(0.95);
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`encrypted upload failed: ${resp.status} ${text}`);
  }
  const json = (await resp.json()) as {
    ok: boolean;
    storage_url?: string;
    storage_path?: string;
    error?: string;
  };
  if (!json.ok || !json.storage_url || !json.storage_path) {
    throw new Error(json.error ?? "unknown_upload_error");
  }

  opts.onProgress?.(1);
  return {
    storageUrl: json.storage_url,
    storagePath: json.storage_path,
    contentType: opts.file.type,
    sizeBytes: opts.file.size,
    contentKey: enc.contentKey,
    contentNonce: enc.contentNonce,
    kind,
  };
}

function classifyMime(mime: string): "image" | "video" | "audio" | null {
  const m = mime.toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  return null;
}

function extForMime(mime: string): string {
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/avif": "avif",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/ogg": "ogg",
    "audio/webm": "webm",
    "audio/wav": "wav",
    "audio/opus": "opus",
  };
  return map[mime.toLowerCase()] ?? "bin";
}
