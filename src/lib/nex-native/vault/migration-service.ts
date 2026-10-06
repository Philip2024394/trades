// src/lib/nex-native/vault/migration-service.ts
//
// Vault Phase A · Commit A.6 · legacy file encryption migration
// service · server-only · implements the sealed four-state machine +
// deterministic reconciliation algorithm from design §M.3.
//
// Terminology (all from migrations 141 + 142 · hard DB invariants
// enforced by nex_vault_file_migration_invariant CHECK constraint):
//   legacy    · legacy_bytes_path != NULL, wrapped_content_key = NULL
//   migrating · both NON-NULL · encrypted replacement uploaded, waiting
//               for finalize
//   encrypted · legacy_bytes_path = NULL, wrapped_content_key != NULL,
//               migrated_at != NULL
//   failed    · legacy_bytes_path != NULL, wrapped_content_key = NULL
//               (same shape as 'legacy' · failed is a soft-marker for
//               the UI; retry pushes it back to 'legacy' flow)
//
// Reconciliation runs on every POST /migration/start to pre-clean
// stale state before issuing a new attempt. It also runs on explicit
// retry of a 'failed' file. The algorithm handles each §M.3 branch
// deterministically with no silent data loss.

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";
import type { NexTimestamp, NexUuid } from "../types";
import { logSignInEvent } from "../security-service";
import {
  deleteLegacyObject,
  deleteOrphanEncryptedObject,
  encryptedPathFor,
  headEncryptedObject,
  headLegacyObject,
  validateFinalizeState,
  WRAPPED_CONTENT_KEY_LENGTH,
  CONTENT_NONCE_LENGTH,
} from "./ciphertext-structural-validator";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MigrationState = "legacy" | "migrating" | "encrypted" | "failed";
export type AttemptStatus =
  | "started"
  | "uploaded"
  | "verified"
  | "finalized"
  | "failed";

export interface VaultFileMigrationRow {
  id: NexUuid;
  account_id: NexUuid;
  byte_size: number;
  bucket_path: string;
  legacy_bytes_path: string | null;
  wrapped_content_key: Uint8Array | null;
  content_nonce: Uint8Array | null;
  encryption_algorithm: string | null;
  rotation_generation: number;
  migration_state: MigrationState;
  migrated_at: NexTimestamp | null;
}

export type ReconcileOutcome =
  | "noop"
  | "orphan_deleted_ready_for_retry"
  | "finalized"
  | "finalized_from_partial_deletion"
  | "rolled_back_ready_for_retry"
  | "data_loss"
  | "ready_for_retry_from_failed"
  | "critical_inconsistency";

export interface ReconcileResult {
  outcome: ReconcileOutcome;
  detail?: string;
}

// ---------------------------------------------------------------------------
// Row helpers
// ---------------------------------------------------------------------------

function toBytes(v: unknown): Uint8Array | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Uint8Array) return v;
  if (typeof Buffer !== "undefined" && v instanceof Buffer) {
    return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
  }
  if (typeof v === "string") {
    const s = v.startsWith("\\x") ? v.slice(2) : v;
    const out = new Uint8Array(s.length / 2);
    for (let i = 0; i < out.length; i++) {
      out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
  }
  return null;
}

function hexToBytea(hex: string): string {
  return "\\x" + hex;
}

function normaliseRow(raw: Record<string, unknown>): VaultFileMigrationRow {
  return {
    id: raw.id as NexUuid,
    account_id: raw.account_id as NexUuid,
    byte_size: Number(raw.byte_size),
    bucket_path: String(raw.bucket_path),
    legacy_bytes_path: (raw.legacy_bytes_path as string | null) ?? null,
    wrapped_content_key: toBytes(raw.wrapped_content_key),
    content_nonce: toBytes(raw.content_nonce),
    encryption_algorithm: (raw.encryption_algorithm as string | null) ?? null,
    rotation_generation: Number(raw.rotation_generation),
    migration_state: raw.migration_state as MigrationState,
    migrated_at: (raw.migrated_at as NexTimestamp | null) ?? null,
  };
}

export async function getFileForMigration(input: {
  accountId: NexUuid;
  fileId: NexUuid;
}): Promise<VaultFileMigrationRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_vault_file")
    .select(
      "id, account_id, byte_size, bucket_path, legacy_bytes_path, wrapped_content_key, content_nonce, encryption_algorithm, rotation_generation, migration_state, migrated_at",
    )
    .eq("account_id", input.accountId)
    .eq("id", input.fileId)
    .maybeSingle();
  if (error) {
    throw new Error(`vault/migration-service.getFileForMigration: ${error.message}`);
  }
  if (!data) return null;
  return normaliseRow(data as Record<string, unknown>);
}

/** List files that still need migration (legacy OR failed). Owner-
 *  scoped · ordered by created_at so UI shows oldest first. */
export async function listPendingMigrationFiles(
  accountId: NexUuid,
): Promise<VaultFileMigrationRow[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_vault_file")
    .select(
      "id, account_id, byte_size, bucket_path, legacy_bytes_path, wrapped_content_key, content_nonce, encryption_algorithm, rotation_generation, migration_state, migrated_at, created_at",
    )
    .eq("account_id", accountId)
    .in("migration_state", ["legacy", "failed"])
    .order("created_at", { ascending: true });
  if (error) {
    throw new Error(
      `vault/migration-service.listPendingMigrationFiles: ${error.message}`,
    );
  }
  return (data as Array<Record<string, unknown>>).map(normaliseRow);
}

// ---------------------------------------------------------------------------
// Attempt table CRUD (nex_vault_file_migration_attempt)
// ---------------------------------------------------------------------------

export interface AttemptRow {
  id: NexUuid;
  file_id: NexUuid;
  account_id: NexUuid;
  started_by_device_id: string;
  status: AttemptStatus;
  retry_count: number;
  last_error: string | null;
  started_at: NexTimestamp;
}

/** Return the account's current non-terminal attempt for a file, if
 *  any. Partial unique index guarantees at most one. */
export async function getActiveAttempt(input: {
  accountId: NexUuid;
  fileId: NexUuid;
}): Promise<AttemptRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_vault_file_migration_attempt")
    .select("*")
    .eq("account_id", input.accountId)
    .eq("file_id", input.fileId)
    .in("status", ["started", "uploaded", "verified"])
    .maybeSingle();
  if (error) {
    throw new Error(`vault/migration-service.getActiveAttempt: ${error.message}`);
  }
  return (data as AttemptRow | null) ?? null;
}

/** Insert a new attempt row with status='started'. Fails loudly if a
 *  non-terminal attempt already exists (partial unique index). */
export async function startAttempt(input: {
  accountId: NexUuid;
  fileId: NexUuid;
  startedByDeviceId: string;
}): Promise<AttemptRow> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_vault_file_migration_attempt")
    .insert({
      account_id: input.accountId,
      file_id: input.fileId,
      started_by_device_id: input.startedByDeviceId,
      status: "started",
      retry_count: 0,
    })
    .select("*")
    .single();
  if (error) {
    throw new Error(`vault/migration-service.startAttempt: ${error.message}`);
  }
  return data as AttemptRow;
}

export async function updateAttemptStatus(input: {
  accountId: NexUuid;
  attemptId: NexUuid;
  status: AttemptStatus;
  lastError?: string | null;
}): Promise<void> {
  const patch: Record<string, unknown> = { status: input.status };
  if (input.lastError !== undefined) patch.last_error = input.lastError;
  const { error } = await nexSupabaseAdmin
    .from("nex_vault_file_migration_attempt")
    .update(patch)
    .eq("account_id", input.accountId)
    .eq("id", input.attemptId);
  if (error) {
    throw new Error(
      `vault/migration-service.updateAttemptStatus: ${error.message}`,
    );
  }
}

// ---------------------------------------------------------------------------
// State transitions
// ---------------------------------------------------------------------------

/** Flip 'failed' → 'legacy' (same column shape; just removes the UX
 *  marker so retry starts clean). Idempotent. */
export async function markFileLegacy(input: {
  accountId: NexUuid;
  fileId: NexUuid;
}): Promise<void> {
  const { error } = await nexSupabaseAdmin
    .from("nex_vault_file")
    .update({ migration_state: "legacy" })
    .eq("account_id", input.accountId)
    .eq("id", input.fileId)
    .in("migration_state", ["legacy", "failed"]);
  if (error) {
    throw new Error(`vault/migration-service.markFileLegacy: ${error.message}`);
  }
}

/** Flip 'migrating' or 'legacy' → 'failed'. Preserves legacy bytes
 *  intact (same column shape as 'legacy'; wrapped_content_key cleared
 *  if we're rolling back from 'migrating'). */
export async function markFileFailed(input: {
  accountId: NexUuid;
  fileId: NexUuid;
}): Promise<void> {
  const { error } = await nexSupabaseAdmin
    .from("nex_vault_file")
    .update({
      migration_state: "failed",
      wrapped_content_key: null,
      content_nonce: null,
      encryption_algorithm: null,
    })
    .eq("account_id", input.accountId)
    .eq("id", input.fileId);
  if (error) {
    throw new Error(`vault/migration-service.markFileFailed: ${error.message}`);
  }
}

/**
 * §P.2 · write encryption metadata and flip state to 'migrating'.
 * Validates structure before writing. Returns rejected shape when
 * the structure is wrong (route returns 400).
 */
export async function writeEncryptionMetadata(input: {
  accountId: NexUuid;
  fileId: NexUuid;
  wrappedContentKey: Uint8Array;
  contentNonce: Uint8Array;
  encryptionAlgorithm: string;
}): Promise<void> {
  if (input.wrappedContentKey.length !== WRAPPED_CONTENT_KEY_LENGTH) {
    throw new Error("invalid_wrapped_content_key_length");
  }
  if (input.contentNonce.length !== CONTENT_NONCE_LENGTH) {
    throw new Error("invalid_content_nonce_length");
  }
  const wrappedHex = Buffer.from(input.wrappedContentKey).toString("hex");
  const nonceHex = Buffer.from(input.contentNonce).toString("hex");
  const { error } = await nexSupabaseAdmin
    .from("nex_vault_file")
    .update({
      wrapped_content_key: hexToBytea(wrappedHex),
      content_nonce: hexToBytea(nonceHex),
      encryption_algorithm: input.encryptionAlgorithm,
      migration_state: "migrating",
    })
    .eq("account_id", input.accountId)
    .eq("id", input.fileId)
    .in("migration_state", ["legacy", "failed"]);
  if (error) {
    throw new Error(
      `vault/migration-service.writeEncryptionMetadata: ${error.message}`,
    );
  }
}

/** Final transition: delete legacy object + flip metadata to
 *  'encrypted'. Database CHECK rejects this if any of the four
 *  required columns is NULL. */
export async function finalizeEncrypted(input: {
  accountId: NexUuid;
  fileId: NexUuid;
  legacyBytesPath: string;
}): Promise<void> {
  await deleteLegacyObject({ legacyBytesPath: input.legacyBytesPath });
  const { error } = await nexSupabaseAdmin
    .from("nex_vault_file")
    .update({
      legacy_bytes_path: null,
      migration_state: "encrypted",
      migrated_at: new Date().toISOString(),
    })
    .eq("account_id", input.accountId)
    .eq("id", input.fileId)
    .eq("migration_state", "migrating");
  if (error) {
    throw new Error(
      `vault/migration-service.finalizeEncrypted: ${error.message}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Reconciliation (§M.3) · deterministic · idempotent
// ---------------------------------------------------------------------------

export async function reconcile(input: {
  accountId: NexUuid;
  fileId: NexUuid;
}): Promise<ReconcileResult> {
  const file = await getFileForMigration({
    accountId: input.accountId,
    fileId: input.fileId,
  });
  if (!file) {
    return { outcome: "critical_inconsistency", detail: "file_not_found" };
  }

  if (file.migration_state === "encrypted") {
    return { outcome: "noop" };
  }

  const encHead = await headEncryptedObject({
    accountId: input.accountId,
    fileId: input.fileId,
    rotationGeneration: file.rotation_generation,
  });
  const legHead = file.legacy_bytes_path
    ? await headLegacyObject({ legacyBytesPath: file.legacy_bytes_path })
    : { exists: false as const };

  // ─── state: legacy ─────────────────────────────────────────────────
  if (file.migration_state === "legacy") {
    if (encHead.exists) {
      // Orphan from a crashed pre-metadata attempt · delete it, do NOT
      // trust the ciphertext we never wrote metadata for.
      await deleteOrphanEncryptedObject({
        accountId: input.accountId,
        fileId: input.fileId,
        rotationGeneration: file.rotation_generation,
      });
      return { outcome: "orphan_deleted_ready_for_retry" };
    }
    return { outcome: "noop" };
  }

  // ─── state: failed ────────────────────────────────────────────────
  if (file.migration_state === "failed") {
    if (encHead.exists) {
      await deleteOrphanEncryptedObject({
        accountId: input.accountId,
        fileId: input.fileId,
        rotationGeneration: file.rotation_generation,
      });
    }
    // Reset UI marker so the next attempt is clean. Legacy bytes
    // still exist (hard invariant).
    await markFileLegacy({
      accountId: input.accountId,
      fileId: input.fileId,
    });
    return { outcome: "ready_for_retry_from_failed" };
  }

  // ─── state: migrating ─────────────────────────────────────────────
  if (file.migration_state === "migrating") {
    if (encHead.exists && legHead.exists) {
      // Both copies present · verify structure + finalize.
      const validation = await validateFinalizeState({
        file,
        encryptedPath: encryptedPathFor(
          input.accountId,
          input.fileId,
          file.rotation_generation,
        ),
      });
      if (!validation.ok) {
        // Metadata inconsistent · mark failed, keep legacy intact.
        await markFileFailed({
          accountId: input.accountId,
          fileId: input.fileId,
        });
        return {
          outcome: "critical_inconsistency",
          detail: `structure_invalid: ${validation.error}`,
        };
      }
      await finalizeEncrypted({
        accountId: input.accountId,
        fileId: input.fileId,
        legacyBytesPath: file.legacy_bytes_path!,
      });
      await logSignInEvent({
        account_id: input.accountId,
        event_type: "legacy_file_migrated",
        success: true,
      });
      return { outcome: "finalized" };
    }

    if (encHead.exists && !legHead.exists) {
      // Crash between legacy delete and DB finalize (§M.3 critical case).
      // Legacy bytes already gone · encrypted is the sole surviving
      // copy. If structure validates, finalize the DB state.
      const validation = await validateFinalizeState({
        file,
        encryptedPath: encryptedPathFor(
          input.accountId,
          input.fileId,
          file.rotation_generation,
        ),
      });
      if (!validation.ok) {
        // Legacy already gone AND encrypted structure is bad → data
        // loss risk. Hold state at 'migrating' so an operator can
        // intervene. Emit critical event.
        await logSignInEvent({
          account_id: input.accountId,
          event_type: "legacy_file_migration_failed",
          success: false,
        });
        return {
          outcome: "critical_inconsistency",
          detail: `metadata_without_legacy_bytes: ${validation.error}`,
        };
      }
      // Finalize DB only (legacy is already gone).
      const { error } = await nexSupabaseAdmin
        .from("nex_vault_file")
        .update({
          legacy_bytes_path: null,
          migration_state: "encrypted",
          migrated_at: new Date().toISOString(),
        })
        .eq("account_id", input.accountId)
        .eq("id", input.fileId)
        .eq("migration_state", "migrating");
      if (error) {
        throw new Error(
          `vault/migration-service.reconcile.finalize_from_partial: ${error.message}`,
        );
      }
      await logSignInEvent({
        account_id: input.accountId,
        event_type: "legacy_file_migrated",
        success: true,
      });
      return { outcome: "finalized_from_partial_deletion" };
    }

    if (!encHead.exists && legHead.exists) {
      // Encrypted somehow lost after metadata was written · roll back
      // metadata to 'legacy' so a clean retry can run. Must clear
      // wrapped_content_key / content_nonce / encryption_algorithm
      // atomically with the state flip to satisfy the hard invariant
      // (CHECK nex_vault_file_migration_invariant).
      const { error: rollbackErr } = await nexSupabaseAdmin
        .from("nex_vault_file")
        .update({
          wrapped_content_key: null,
          content_nonce: null,
          encryption_algorithm: null,
          migration_state: "legacy",
        })
        .eq("account_id", input.accountId)
        .eq("id", input.fileId)
        .eq("migration_state", "migrating");
      if (rollbackErr) {
        throw new Error(
          `vault/migration-service.reconcile.rollback: ${rollbackErr.message}`,
        );
      }
      return { outcome: "rolled_back_ready_for_retry" };
    }

    // Both gone · data loss.
    await markFileFailed({
      accountId: input.accountId,
      fileId: input.fileId,
    });
    await logSignInEvent({
      account_id: input.accountId,
      event_type: "legacy_file_migration_failed",
      success: false,
    });
    return { outcome: "data_loss" };
  }

  return {
    outcome: "critical_inconsistency",
    detail: `unexpected_state: ${file.migration_state}`,
  };
}
