// src/lib/nex-native/vault/ciphertext-structural-validator.ts
//
// Vault Phase A · Commit A.6 · sealed structural validator (§P).
//
// The server is a PLAINTEXT-BLIND storage and authorization layer.
// It can inspect STRUCTURE (lengths, allowlist, size, state) but
// cannot verify CORRECTNESS of the encryption (which would require
// decryption with K_f). Correctness is proven by the client's
// pre-finalize self-check per §M.4.
//
// This file is server-only and is used by both the finalize/metadata
// write (§P.2) and the finalize/delete-legacy step (§P.3). Regression
// tests grep-verify that every migration route imports from here.

import "server-only";
import { getObjectStorage } from "@/lib/nex/storage/object-registry";
import { PHASE_A_ALGORITHM } from "./key-hierarchy";

/** AES-256-GCM output overhead for the auth tag (bytes). */
export const AES_GCM_TAG_LENGTH = 16;

/** Exact size of the wrapped Vault content key (K_f).
 *   12-byte nonce || 32-byte key-ciphertext || 16-byte GCM tag = 60.
 *  Separate from the per-file content_nonce column. */
export const WRAPPED_CONTENT_KEY_LENGTH = 60;

/** Content nonce (file-bytes IV) size. AES-GCM IV is 12 bytes. */
export const CONTENT_NONCE_LENGTH = 12;

/** Vault file-bytes bucket (same as legacy; encrypted objects live at
 *  a deterministic sub-path · see encryptedPathFor). */
export const VAULT_BUCKET = "nex-vault-files";

export interface MetadataShape {
  wrapped_content_key: Uint8Array;
  content_nonce: Uint8Array;
  encryption_algorithm: string;
}

export interface MetadataShapeFailure {
  ok: false;
  error:
    | "wrapped_content_key_length"
    | "content_nonce_length"
    | "algorithm_not_allowed";
}

/**
 * §P.2 · structural validation BEFORE the server writes
 * wrapped_content_key + content_nonce + encryption_algorithm on
 * nex_vault_file. Rejects any attempt that would violate the sealed
 * Phase A format.
 */
export function validateMetadataShape(input: {
  wrapped_content_key: Uint8Array;
  content_nonce: Uint8Array;
  encryption_algorithm: unknown;
}): { ok: true } | MetadataShapeFailure {
  if (
    input.wrapped_content_key.length !== WRAPPED_CONTENT_KEY_LENGTH
  ) {
    return { ok: false, error: "wrapped_content_key_length" };
  }
  if (input.content_nonce.length !== CONTENT_NONCE_LENGTH) {
    return { ok: false, error: "content_nonce_length" };
  }
  if (input.encryption_algorithm !== PHASE_A_ALGORITHM) {
    return { ok: false, error: "algorithm_not_allowed" };
  }
  return { ok: true };
}

export interface FinalizeStateFailure {
  ok: false;
  error:
    | "wrong_state"
    | "missing_metadata"
    | "encrypted_object_absent"
    | "encrypted_object_size_mismatch";
  detail?: string;
}

/**
 * §P.3 · state validation BEFORE deleting legacy and flipping to
 * migration_state='encrypted'. The caller must have already read the
 * file row and know the expected encrypted path.
 *
 *   expected object size = plaintext_byte_size + AES-GCM auth tag (16)
 *
 * We HEAD the encrypted object via the sealed object-storage
 * abstraction. If the object is absent or the recorded size does not
 * match, we refuse to finalize · the file remains in 'migrating'
 * and reconciliation (§M.3) handles it on retry.
 */
export async function validateFinalizeState(input: {
  file: {
    migration_state: string;
    legacy_bytes_path: string | null;
    wrapped_content_key: Uint8Array | null;
    content_nonce: Uint8Array | null;
    encryption_algorithm: string | null;
    byte_size: number;
  };
  encryptedPath: string;
}): Promise<{ ok: true } | FinalizeStateFailure> {
  const { file, encryptedPath } = input;
  if (file.migration_state !== "migrating") {
    return {
      ok: false,
      error: "wrong_state",
      detail: `migration_state is '${file.migration_state}', expected 'migrating'`,
    };
  }
  if (
    !file.wrapped_content_key ||
    !file.content_nonce ||
    !file.encryption_algorithm ||
    !file.legacy_bytes_path
  ) {
    return { ok: false, error: "missing_metadata" };
  }
  const storage = getObjectStorage();
  const meta = await storage.head(VAULT_BUCKET, encryptedPath);
  if (!meta) {
    return {
      ok: false,
      error: "encrypted_object_absent",
      detail: `HEAD ${encryptedPath} returned null`,
    };
  }
  const expected = file.byte_size + AES_GCM_TAG_LENGTH;
  if (meta.size_bytes !== expected) {
    return {
      ok: false,
      error: "encrypted_object_size_mismatch",
      detail: `expected=${expected} got=${meta.size_bytes}`,
    };
  }
  return { ok: true };
}

/** Deterministic path for the encrypted replacement bytes.
 *  Keyed on account_id, file_id, and current rotation_generation so
 *  future A.5 rotations re-wrap into a new generation-scoped path
 *  without clobbering the previous. */
export function encryptedPathFor(
  accountId: string,
  fileId: string,
  rotationGeneration: number,
): string {
  if (!Number.isInteger(rotationGeneration) || rotationGeneration < 1) {
    throw new Error(
      `vault/ciphertext-structural-validator: rotation_generation must be >= 1`,
    );
  }
  return `${accountId}/encrypted/g${rotationGeneration}/${fileId}`;
}

/** Thin wrapper around the sealed object-storage head · null when the
 *  object is absent (fast path for reconciliation (§M.3)). */
export async function headEncryptedObject(input: {
  accountId: string;
  fileId: string;
  rotationGeneration: number;
}): Promise<{ exists: false } | { exists: true; sizeBytes: number }> {
  const storage = getObjectStorage();
  const meta = await storage.head(
    VAULT_BUCKET,
    encryptedPathFor(input.accountId, input.fileId, input.rotationGeneration),
  );
  if (!meta) return { exists: false };
  return { exists: true, sizeBytes: meta.size_bytes };
}

/** HEAD the legacy object (sits at the sealed legacy path from
 *  migration 129 · nex_vault_file.bucket_path). */
export async function headLegacyObject(input: {
  legacyBytesPath: string;
}): Promise<{ exists: false } | { exists: true; sizeBytes: number }> {
  const storage = getObjectStorage();
  const meta = await storage.head(VAULT_BUCKET, input.legacyBytesPath);
  if (!meta) return { exists: false };
  return { exists: true, sizeBytes: meta.size_bytes };
}

/** Delete the legacy object · hard delete so the plaintext bytes are
 *  truly gone after a successful finalize. */
export async function deleteLegacyObject(input: {
  legacyBytesPath: string;
}): Promise<void> {
  const storage = getObjectStorage();
  await storage.delete(VAULT_BUCKET, input.legacyBytesPath, { hard: true });
}

/** Delete an orphan encrypted object (used during reconciliation when
 *  the file is still 'legacy' or 'failed' and an orphan encrypted
 *  object was found at the deterministic path). */
export async function deleteOrphanEncryptedObject(input: {
  accountId: string;
  fileId: string;
  rotationGeneration: number;
}): Promise<void> {
  const storage = getObjectStorage();
  await storage.delete(
    VAULT_BUCKET,
    encryptedPathFor(input.accountId, input.fileId, input.rotationGeneration),
    { hard: true },
  );
}

/** Upload the encrypted bytes from the browser. The server receives
 *  OPAQUE CIPHERTEXT only · never decrypts, never inspects. */
export async function uploadEncryptedObject(input: {
  accountId: string;
  fileId: string;
  rotationGeneration: number;
  ciphertext: Uint8Array;
}): Promise<void> {
  const storage = getObjectStorage();
  const path = encryptedPathFor(
    input.accountId,
    input.fileId,
    input.rotationGeneration,
  );
  await storage.put(VAULT_BUCKET, path, {
    body: Buffer.from(input.ciphertext),
    mime_type: "application/x-nex-vault-ciphertext",
    uploaded_by: input.accountId,
    source_ref: "vault/migration",
  });
}
