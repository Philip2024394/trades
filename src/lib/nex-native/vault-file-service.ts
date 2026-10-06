// src/lib/nex-native/vault-file-service.ts
//
// Stage 4 · Vault file service · founder-sealed vault-build-plan-2026-10-03.
// Phase A.1 · 2026-10-06 · migrated from direct Supabase Storage calls to
// the NEX object-storage abstraction (`getObjectStorage()`). Vault bytes
// now live in NEX-owned infrastructure (MinIO backend when
// NEX_OBJECT_BACKEND=minio; filesystem for dev; postgres/r2 available via
// the sealed object-registry). Supabase Storage is no longer touched by
// this service.
//
// CRUD over nex_vault_file + signed-URL issuance for the private
// nex-vault-files bucket. All reads/writes are explicitly owner-scoped
// — callers vouch for the viewer via session and pass account_id; this
// service enforces that account_id in every query.
//
// HONEST BOUNDARY (D2 · still in effect): this file deals with PRIVATE
// access-controlled storage, NOT end-to-end encrypted storage. The
// server CAN read object bytes at this stage. Phase A delivers client-
// side encryption where the server never holds a key. UI surfaces that
// touch this service must carry the honest-limits disclaimer established
// on /vault/settings.
//
// Phase A.1 ADDITION · nex_vault_file now carries two linkage columns
// (migration 140):
//   · source_message_id       (nullable) · the nex_peer_message.id this
//                              file was copied from (chat attachment copy)
//   · source_conversation_id  (nullable) · the nex_peer_conversation.id
//                              it belonged to (for cascade-delete on
//                              remove-from-vault)
// Standalone uploads leave both NULL · the behaviour is unchanged for
// those rows.

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import { getObjectStorage } from "@/lib/nex/storage/object-registry";
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
  source_message_id: NexUuid | null;
  source_conversation_id: NexUuid | null;
}

/** Deterministic path layout: `{account_id}/{file_id}`. Owner-scope
 *  enforcement happens at the service layer (ownership check before
 *  every signed URL / download) and at the metadata layer (RLS on
 *  nex_vault_file + nex-vault-files storage policies from migration
 *  129, which remain in force for the Supabase storage integration).
 *  Phase A.1 object-storage adapter does not reach storage.objects RLS
 *  directly, so the service-side ownership guard is the authoritative
 *  check. */
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
  /** Phase A.1 · the chat message this attachment was copied from. */
  sourceMessageId?: NexUuid | null;
  /** Phase A.1 · the conversation the attachment belonged to. */
  sourceConversationId?: NexUuid | null;
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
      source_message_id: input.sourceMessageId ?? null,
      source_conversation_id: input.sourceConversationId ?? null,
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
  // Delete the object via the NEX object-storage abstraction. Hard
  // delete so no soft-delete marker sits in bucket · the metadata row
  // is the authoritative existence record and we're deleting that too.
  try {
    const storage = getObjectStorage();
    await storage.delete(VAULT_BUCKET, file.bucket_path, { hard: true });
  } catch (err) {
    // Non-fatal · keep metadata delete so UI stops listing it. Orphan
    // objects are a janitor-sweep candidate (same posture as the
    // previous Supabase-direct implementation).
    console.warn(
      `[vault-file-service] delete object failed for ${file.bucket_path}: ${
        err instanceof Error ? err.message : err
      }`,
    );
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
  const storage = getObjectStorage();
  // presign() on backends with nativePresign (R2 / MinIO) returns a
  // real signed URL. On the filesystem backend it returns a dev URL.
  // In both cases the server-side ownership check above is the
  // authoritative access gate.
  const url = await storage.presign(VAULT_BUCKET, file.bucket_path, {
    operation: "get",
    expires_seconds: ttlSeconds,
  });
  return url;
}

/** Fetch raw bytes for a Vault file · owner-scoped. Returns null when
 *  the file does not exist or does not belong to the caller. Used by
 *  server-side flows that need to re-stream Vault content (e.g. the
 *  future Vault chat reader renders inline previews). */
export async function readVaultFileBytes(
  accountId: NexUuid,
  fileId: NexUuid,
): Promise<{ meta: VaultFileRow; body: Buffer } | null> {
  const file = await getVaultFileById(fileId);
  if (!file || file.account_id !== accountId) return null;
  const storage = getObjectStorage();
  const result = await storage.get(VAULT_BUCKET, file.bucket_path);
  if (!result) return null;
  return { meta: file, body: result.body };
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
  const buffer = await normaliseToBuffer(bytes);
  const storage = getObjectStorage();
  await storage.put(VAULT_BUCKET, bucket_path, {
    body: buffer,
    mime_type: mimeType,
    uploaded_by: accountId,
    source_ref: "vault",
  });
}

/** Phase A.1 · byte accounting · sum of byte_size for every row the
 *  account owns in nex_vault_file. Includes standalone uploads AND
 *  attachment copies (both share the same byte_size column). Phase D
 *  will add the allowance check that compares this against the 10 GB
 *  Bisnis ceiling · Phase A.1 only exposes the aggregation. */
export async function getVaultBytesUsedForAccount(
  accountId: NexUuid,
): Promise<number> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_vault_file")
    .select("byte_size")
    .eq("account_id", accountId);
  if (error) {
    throw new Error(
      `vault-file-service.getVaultBytesUsedForAccount: ${error.message}`,
    );
  }
  let total = 0;
  for (const row of (data ?? []) as Array<{ byte_size: number | string }>) {
    const n = typeof row.byte_size === "number" ? row.byte_size : Number(row.byte_size);
    if (Number.isFinite(n) && n > 0) total += n;
  }
  return total;
}

/** Phase A.1 · list vault file rows for a given conversation (used by
 *  removeConversationFromVault to cascade-delete the attachment copies
 *  that came with the move). Owner-scoped. */
export async function listVaultFilesForSourceConversation(
  accountId: NexUuid,
  conversationId: NexUuid,
): Promise<VaultFileRow[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_vault_file")
    .select("*")
    .eq("account_id", accountId)
    .eq("source_conversation_id", conversationId);
  if (error) {
    throw new Error(
      `vault-file-service.listVaultFilesForSourceConversation: ${error.message}`,
    );
  }
  return (data as VaultFileRow[]) ?? [];
}

/** Phase A.1 · look up a vault file row by the message it was copied
 *  from. Returns null when no such copy exists. Used by the attachment-
 *  copy flow to detect re-moves and short-circuit. */
export async function findVaultFileBySourceMessage(
  accountId: NexUuid,
  sourceMessageId: NexUuid,
): Promise<VaultFileRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_vault_file")
    .select("*")
    .eq("account_id", accountId)
    .eq("source_message_id", sourceMessageId)
    .maybeSingle();
  if (error) {
    throw new Error(
      `vault-file-service.findVaultFileBySourceMessage: ${error.message}`,
    );
  }
  return (data as VaultFileRow | null) ?? null;
}

// ---------------------------------------------------------------------------
// Internal · byte normalisation (ArrayBuffer / Uint8Array / Blob / File → Buffer)
// The underlying ObjectStorage adapters expect a Node Buffer; this helper
// absorbs the client-friendly input types the previous Supabase-direct
// signature accepted so existing callers (upload action, future flows)
// continue to work byte-equivalent.
// ---------------------------------------------------------------------------

async function normaliseToBuffer(
  bytes: ArrayBuffer | Uint8Array | Blob | File,
): Promise<Buffer> {
  if (Buffer.isBuffer(bytes)) return bytes;
  if (bytes instanceof Uint8Array) {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  if (bytes instanceof ArrayBuffer) {
    return Buffer.from(bytes);
  }
  // Blob / File · includes browser-side File and server-side undici Blob.
  if (typeof (bytes as Blob).arrayBuffer === "function") {
    const ab = await (bytes as Blob).arrayBuffer();
    return Buffer.from(ab);
  }
  throw new Error(
    "vault-file-service.normaliseToBuffer: unsupported input type",
  );
}
