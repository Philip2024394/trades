// src/lib/nex-native/vault/client/legacy-migration.ts
//
// Vault Phase A · Commit A.6 · client-side legacy-file migration
// orchestrator.
//
// All crypto happens in the browser (reuses sealed A.2 primitives).
// Server receives ONLY opaque ciphertext + non-secret structural
// metadata + attempt row identifiers. Server NEVER sees plaintext
// bytes, K_f, VMK, or the plaintext SHA-256 (which is a client-only
// self-check).
//
// Per-file flow (§M.1 revised):
//    1. POST /migration/start → attempt row + signed URL for legacy
//    2. fetch legacy bytes
//    3. sha256(plaintext) locally
//    4. K_f = randomBytes(32)
//    5. nonce = randomBytes(12)
//    6. ciphertext = AES-256-GCM(plaintext, K_f, nonce)
//    7. POST ciphertext bytes to /migration/upload (server PUTs to
//       deterministic encrypted path · no decrypt)
//    8. GET the ciphertext back from encrypted path
//    9. AES-256-GCM-decrypt locally
//   10. sha256(decrypted) · compare to original · abort on mismatch
//   11. wrappedKf = wrapKey(K_f, VMK)
//   12. POST /migration/finalize-metadata (shape + encrypted-exists)
//   13. POST /migration/finalize (delete legacy + flip to encrypted)
//
// Zeroises K_f + plaintext + VMK reference on every exit path.

"use client";

import {
  aesGcmDecrypt,
  aesGcmEncrypt,
  generateContentKey,
  generateNonce12,
  PHASE_A_ALGORITHM,
  wrapKey,
  zeroiseBuffer,
} from "../key-hierarchy";
import { withVmk } from "./vault-session";
import { ensureDeviceKey } from "../../crypto/device-key";

function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i]!.toString(16).padStart(2, "0");
  }
  return hex;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const hashBuf = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return bytesToHex(new Uint8Array(hashBuf));
}

async function fetchArrayBuffer(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`fetch_failed_${res.status}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

async function readLegacyBytes(url: string): Promise<Uint8Array> {
  return await fetchArrayBuffer(url);
}

async function readEncryptedBytes(input: {
  accountId: string;
  fileId: string;
  rotationGeneration: number;
}): Promise<Uint8Array | null> {
  // Fetch via the sealed signed-URL path we already have for
  // encrypted content. We hit a Vault-scoped read endpoint on the
  // deterministic encrypted path. For A.6 self-check round-trip we
  // reuse the same signed-URL pattern via a dedicated read endpoint.
  // SIMPLE SOLUTION: use the /migration/read-encrypted endpoint
  // (TODO) OR temporarily issue a signed URL from the server for
  // the encrypted path too. For this commit we go a different way:
  // the browser just fetches via the sealed vault signed-url route
  // for encrypted path. If the route refuses, the self-check fails
  // and the client aborts rather than finalising unsafely.
  //
  // Simplest and safest: call a dedicated endpoint that returns the
  // encrypted bytes for the file (owner-scoped, read-only, no decrypt).
  const res = await fetch(
    `/api/nex-native/vault/migration/read-encrypted?file_id=${encodeURIComponent(
      input.fileId,
    )}&generation=${input.rotationGeneration}`,
    { method: "GET" },
  );
  if (!res.ok) return null;
  return new Uint8Array(await res.arrayBuffer());
}

export type MigrateFileResult =
  | { ok: true; outcome: "migrated" | "already_encrypted" | "reconciled" }
  | { ok: false; error: string; detail?: string };

export async function migrateFile(input: {
  fileId: string;
}): Promise<MigrateFileResult> {
  const key = await ensureDeviceKey();

  // 1. Start migration (reconciles first · may short-circuit if
  // reconciliation finalised the file).
  const startRes = await fetch("/api/nex-native/vault/migration/start", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ file_id: input.fileId, device_id: key.deviceId }),
  });
  const startBody = (await startRes.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    migration_state?: string;
    attempt_id?: string;
    download_url?: string;
    reconciliation?: string;
    file?: { id: string; byte_size: number; rotation_generation: number };
  };
  if (!startRes.ok || !startBody.ok) {
    return { ok: false, error: startBody.error ?? `start_status_${startRes.status}` };
  }
  if (startBody.migration_state === "encrypted") {
    return { ok: true, outcome: "already_encrypted" };
  }
  if (
    !startBody.attempt_id ||
    !startBody.download_url ||
    !startBody.file
  ) {
    return { ok: false, error: "incomplete_start_response" };
  }
  const attemptId = startBody.attempt_id;
  const file = startBody.file;

  // 2 · 3. Download legacy bytes + hash.
  let plaintext: Uint8Array;
  try {
    plaintext = await readLegacyBytes(startBody.download_url);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "legacy_download_failed",
    };
  }
  if (plaintext.length !== file.byte_size) {
    zeroiseBuffer(plaintext);
    return {
      ok: false,
      error: "legacy_size_mismatch",
      detail: `expected=${file.byte_size} got=${plaintext.length}`,
    };
  }
  const plaintextHash = await sha256Hex(plaintext);

  // 4 · 5 · 6. Encrypt locally.
  const kF = generateContentKey();
  const nonce = generateNonce12();
  let ciphertext: Uint8Array;
  try {
    ciphertext = await aesGcmEncrypt({ key: kF, nonce, plaintext });
  } catch (err) {
    zeroiseBuffer(kF);
    zeroiseBuffer(plaintext);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "encrypt_failed",
    };
  }
  if (ciphertext.length !== plaintext.length + 16) {
    zeroiseBuffer(kF);
    zeroiseBuffer(plaintext);
    return {
      ok: false,
      error: "ciphertext_size_mismatch",
      detail: `expected=${plaintext.length + 16} got=${ciphertext.length}`,
    };
  }

  // 7. Upload ciphertext.
  try {
    const form = new FormData();
    form.set("file_id", file.id);
    form.set("attempt_id", attemptId);
    form.set("generation", String(file.rotation_generation));
    form.set(
      "ciphertext_file",
      new Blob([ciphertext], { type: "application/x-nex-vault-ciphertext" }),
      `${file.id}.ciphertext`,
    );
    const uploadRes = await fetch("/api/nex-native/vault/migration/upload", {
      method: "POST",
      body: form,
    });
    if (!uploadRes.ok) {
      const b = await uploadRes.json().catch(() => ({}));
      zeroiseBuffer(kF);
      zeroiseBuffer(plaintext);
      return {
        ok: false,
        error: (b as { error?: string }).error ?? `upload_status_${uploadRes.status}`,
      };
    }
  } catch (err) {
    zeroiseBuffer(kF);
    zeroiseBuffer(plaintext);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "upload_failed",
    };
  }

  // 8 · 9 · 10. Self-check: download the ciphertext back · decrypt
  // locally with K_f · hash plaintext · compare. Any mismatch aborts
  // the migration without touching legacy.
  const roundTripBytes = await readEncryptedBytes({
    accountId: "unused_on_this_endpoint",
    fileId: file.id,
    rotationGeneration: file.rotation_generation,
  });
  if (!roundTripBytes) {
    zeroiseBuffer(kF);
    zeroiseBuffer(plaintext);
    return { ok: false, error: "roundtrip_download_failed" };
  }
  let roundTripPlaintext: Uint8Array;
  try {
    roundTripPlaintext = await aesGcmDecrypt({
      key: kF,
      nonce,
      ciphertext: roundTripBytes,
    });
  } catch (err) {
    zeroiseBuffer(kF);
    zeroiseBuffer(plaintext);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "roundtrip_decrypt_failed",
    };
  }
  const roundTripHash = await sha256Hex(roundTripPlaintext);
  zeroiseBuffer(roundTripPlaintext);
  if (roundTripHash !== plaintextHash) {
    zeroiseBuffer(kF);
    zeroiseBuffer(plaintext);
    return { ok: false, error: "self_check_hash_mismatch" };
  }

  // 11. Wrap K_f under VMK.
  const wrapPromise = withVmk(async (vmk) => wrapKey({ keyToWrap: kF, kek: vmk }));
  if (!wrapPromise) {
    zeroiseBuffer(kF);
    zeroiseBuffer(plaintext);
    return { ok: false, error: "vault_locked" };
  }
  let wrapResult: { envelope: Uint8Array; nonce: Uint8Array };
  try {
    wrapResult = await wrapPromise;
  } catch (err) {
    zeroiseBuffer(kF);
    zeroiseBuffer(plaintext);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "wrap_failed",
    };
  }
  // Full 60-byte envelope: 12-byte wrap-nonce || 32-byte key-ciphertext
  // || 16-byte GCM tag. Server validator (§P.2) requires this exact
  // layout so A.4 unwrapKey can later recover K_f. The per-file
  // content_nonce column (12 bytes) is for the FILE-BYTES encryption,
  // not the wrap.
  const wrappedContentKey = wrapResult.envelope;

  // 12. POST finalize-metadata (shape + exists check · flips to
  // 'migrating').
  const metaRes = await fetch(
    "/api/nex-native/vault/migration/finalize-metadata",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        file_id: file.id,
        attempt_id: attemptId,
        wrapped_content_key_hex: bytesToHex(wrappedContentKey),
        content_nonce_hex: bytesToHex(nonce),
        encryption_algorithm: PHASE_A_ALGORITHM,
      }),
    },
  );
  if (!metaRes.ok) {
    const b = await metaRes.json().catch(() => ({}));
    zeroiseBuffer(kF);
    zeroiseBuffer(plaintext);
    return {
      ok: false,
      error: (b as { error?: string }).error ?? `metadata_status_${metaRes.status}`,
    };
  }

  // 13. POST finalize · delete legacy + flip to 'encrypted'.
  const finalizeRes = await fetch(
    "/api/nex-native/vault/migration/finalize",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ file_id: file.id, attempt_id: attemptId }),
    },
  );
  zeroiseBuffer(kF);
  zeroiseBuffer(plaintext);
  if (!finalizeRes.ok) {
    const b = await finalizeRes.json().catch(() => ({}));
    return {
      ok: false,
      error: (b as { error?: string }).error ?? `finalize_status_${finalizeRes.status}`,
    };
  }
  return { ok: true, outcome: "migrated" };
}

// ---------------------------------------------------------------------------
// Queue runner · caller invokes when Vault unlocks
// ---------------------------------------------------------------------------

export interface QueueFile {
  id: string;
  byte_size: number;
  display_name: string;
  mime_type: string;
  migration_state: "legacy" | "failed";
  rotation_generation: number;
}

export async function fetchMigrationQueue(): Promise<QueueFile[]> {
  const res = await fetch("/api/nex-native/vault/migration/queue", {
    method: "POST",
  });
  if (!res.ok) return [];
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    files?: QueueFile[];
  };
  return body.files ?? [];
}

export async function runMigrationQueue(options: {
  onFileStart?: (fileId: string) => void;
  onFileEnd?: (fileId: string, result: MigrateFileResult) => void;
  signal?: AbortSignal;
}): Promise<{ migrated: number; failed: number; alreadyEncrypted: number }> {
  const stats = { migrated: 0, failed: 0, alreadyEncrypted: 0 };
  const files = await fetchMigrationQueue();
  for (const f of files) {
    if (options.signal?.aborted) break;
    options.onFileStart?.(f.id);
    const result = await migrateFile({ fileId: f.id });
    options.onFileEnd?.(f.id, result);
    if (result.ok) {
      if (result.outcome === "migrated") stats.migrated++;
      else stats.alreadyEncrypted++;
    } else {
      stats.failed++;
    }
  }
  return stats;
}
