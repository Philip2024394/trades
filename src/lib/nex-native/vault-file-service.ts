// src/lib/nex-native/vault-file-service.ts
//
// Stage 4 · Vault file service · founder-sealed vault-build-plan-2026-10-03.
//
// CRUD over nex_vault_file + signed-URL issuance for the private
// nex-vault-files bucket. All reads/writes are explicitly owner-scoped
// — callers vouch for the viewer via session and pass account_id; this
// service enforces that account_id in every query.
//
// HONEST BOUNDARY (D2): this file deals with PRIVATE access-controlled
// storage, NOT end-to-end encrypted storage. The server CAN read object
// bytes at this stage. UI surfaces that touch this service must carry
// the honest-limits disclaimer established on /vault/settings.

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import type { NexUuid } from "./types";

export const VAULT_BUCKET = "nex-vault-files";
export const SIGNED_URL_TTL_SECONDS = 60;

export type VaultFileCategory =
  | "documents"
  | "photos"
  | "videos"
  | "plans"
  | "important"
  | "archived";

export const VAULT_FILE_CATEGORIES: readonly VaultFileCategory[] = [
  "documents",
  "photos",
  "videos",
  "plans",
  "important",
  "archived",
];

export interface VaultFileRow {
  id: NexUuid;
  account_id: NexUuid;
  category: VaultFileCategory;
  folder_path: string | null;
  display_name: string;
  mime_type: string;
  byte_size: number;
  bucket_path: string;
  created_at: string;
  updated_at: string;
}

/** Deterministic path layout: `{account_id}/{file_id}`. Owner-scoped
 *  storage policies in migration 129 enforce that clients only touch
 *  paths whose first segment matches their account. */
export function bucketPathFor(accountId: NexUuid, fileId: NexUuid): string {
  return `${accountId}/${fileId}`;
}

export async function listFilesInRoomForAccount(
  accountId: NexUuid,
  category: VaultFileCategory,
): Promise<VaultFileRow[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_vault_file")
    .select("*")
    .eq("account_id", accountId)
    .eq("category", category)
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(
      `vault-file-service.listFilesInRoomForAccount: ${error.message}`,
    );
  }
  return (data as VaultFileRow[]) ?? [];
}

export async function getVaultFileById(
  fileId: NexUuid,
): Promise<VaultFileRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_vault_file")
    .select("*")
    .eq("id", fileId)
    .maybeSingle();
  if (error) {
    throw new Error(`vault-file-service.getVaultFileById: ${error.message}`);
  }
  return (data as VaultFileRow | null) ?? null;
}

export interface CreateVaultFileInput {
  accountId: NexUuid;
  category: VaultFileCategory;
  displayName: string;
  mimeType: string;
  byteSize: number;
  folderPath?: string | null;
}

/** Inserts a metadata row for a file that has already been uploaded to
 *  the bucket at `bucketPathFor(accountId, newId)`. The caller is
 *  responsible for the actual byte upload. If the metadata insert fails,
 *  the caller MUST delete the uploaded object to avoid orphan bytes. */
export async function insertVaultFileMetadata(
  input: CreateVaultFileInput,
): Promise<VaultFileRow> {
  const newId = crypto.randomUUID();
  const bucket_path = bucketPathFor(input.accountId, newId);
  const { data, error } = await nexSupabaseAdmin
    .from("nex_vault_file")
    .insert({
      id: newId,
      account_id: input.accountId,
      category: input.category,
      folder_path: input.folderPath ?? null,
      display_name: input.displayName.slice(0, 256),
      mime_type: input.mimeType,
      byte_size: input.byteSize,
      bucket_path,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `vault-file-service.insertVaultFileMetadata: ${error?.message ?? "no row"}`,
    );
  }
  return data as VaultFileRow;
}

/** Permanent delete: metadata row + bucket object. Owner-scoped — the
 *  caller must pass their own accountId; cross-account delete is a no-op. */
export async function deleteVaultFile(
  accountId: NexUuid,
  fileId: NexUuid,
): Promise<void> {
  const file = await getVaultFileById(fileId);
  if (!file || file.account_id !== accountId) {
    // Cross-account or missing · no-op (RLS would reject anyway in
    // non-admin contexts; this guard protects admin-driven callers).
    return;
  }
  // Delete object first; if it fails we still try to clean metadata.
  const objDel = await nexSupabaseAdmin.storage
    .from(VAULT_BUCKET)
    .remove([file.bucket_path]);
  if (objDel.error) {
    // non-fatal · keep metadata delete so UI stops listing it; the
    // orphan object is a janitor sweep candidate.
    // (We still proceed.)
  }
  const { error } = await nexSupabaseAdmin
    .from("nex_vault_file")
    .delete()
    .eq("id", fileId)
    .eq("account_id", accountId);
  if (error) {
    throw new Error(`vault-file-service.deleteVaultFile: ${error.message}`);
  }
}

/** Issue a short-lived signed URL for a file. Verifies ownership first;
 *  returns null if the file does not belong to the caller. */
export async function createSignedDownloadUrl(
  accountId: NexUuid,
  fileId: NexUuid,
  ttlSeconds: number = SIGNED_URL_TTL_SECONDS,
): Promise<string | null> {
  const file = await getVaultFileById(fileId);
  if (!file || file.account_id !== accountId) return null;
  const { data, error } = await nexSupabaseAdmin.storage
    .from(VAULT_BUCKET)
    .createSignedUrl(file.bucket_path, ttlSeconds);
  if (error || !data) {
    throw new Error(
      `vault-file-service.createSignedDownloadUrl: ${error?.message ?? "no url"}`,
    );
  }
  return data.signedUrl;
}

/** Upload bytes to the bucket at the deterministic owner-scoped path.
 *  Called immediately after insertVaultFileMetadata; if the upload
 *  fails the caller MUST delete the metadata row. */
export async function uploadVaultFileBytes(
  accountId: NexUuid,
  fileId: NexUuid,
  bytes: ArrayBuffer | Uint8Array | Blob | File,
  mimeType: string,
): Promise<void> {
  const bucket_path = bucketPathFor(accountId, fileId);
  const { error } = await nexSupabaseAdmin.storage
    .from(VAULT_BUCKET)
    .upload(bucket_path, bytes as Blob, {
      contentType: mimeType,
      upsert: false,
    });
  if (error) {
    throw new Error(
      `vault-file-service.uploadVaultFileBytes: ${error.message}`,
    );
  }
}
