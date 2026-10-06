// src/lib/nex-native/vault-persistence-service.ts
//
// Phase A.1 · attachment-copy flow for Vault persistence.
// Sealed 2026-10-06.
//
// When a conversation is moved to Vault, the ENCRYPTED CIPHERTEXT rows
// are preserved by migration 140's Bridge 78 vault-aware purge
// predicate (server never decrypts · existing per-device Curve25519
// encryption model unchanged). This service handles the OTHER half of
// persistence: the CHAT ATTACHMENTS (photos / videos / voice notes)
// that live at public URLs in nex-peer-chat-attachments.
//
// Flow when a conversation is moved to Vault:
//   1. Enumerate nex_peer_message rows in the conversation that carry
//      an attachment_url for which this account would be the viewer.
//   2. For each attachment:
//        a. Idempotency: look up findVaultFileBySourceMessage; skip if
//           already copied.
//        b. Fetch the bytes from the public chat attachment URL.
//        c. Upload the bytes to the NEX-owned nex-vault-files bucket
//           via the sealed object-storage abstraction (MinIO default).
//        d. Insert a nex_vault_file row with source_message_id +
//           source_conversation_id so (i) a future re-move is a no-op,
//           (ii) remove-from-vault can cascade-delete, (iii) byte
//           accounting rolls these up for the Phase D quota check.
//   3. The ORIGINAL attachment is NEVER deleted · the counterparty may
//      still need it. Only the Vault COPY is created.
//
// Flow when a conversation is removed from Vault:
//   · list every nex_vault_file row with source_conversation_id matching
//     the conversation and account_id = the viewer, delete each via
//     deleteVaultFile (which cleans up both the object bytes and the
//     metadata row).
//   · the original chat attachments remain untouched.
//
// Security + ownership
//   · the account_id argument comes from the authenticated session;
//     no client-provided account_id is ever accepted here.
//   · the enumeration query filters by conversation participation (the
//     caller `vault-entry-service.moveConversationToVault` has already
//     asserted the viewer is a participant).
//   · the fetch uses the attachment_url as-is · attachment_urls are
//     public by design (migration 055 sealed) so we don't need a signed
//     url. The vault copy lands in a PRIVATE owner-scoped bucket, so
//     this is a security IMPROVEMENT (public → private).
//
// NOT in scope for Phase A.1 (deferred to later phases):
//   · encrypting the Vault copy (Phase A delivers client-side encryption)
//   · UI to browse vaulted conversation attachments (later Vault UI phase)
//   · quota enforcement against the 10 GB allowance (Phase D)
//   · stripe/midtrans/entitlement billing (Phase C)

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import {
  deleteVaultFile,
  findVaultFileBySourceMessage,
  insertVaultFileMetadata,
  listVaultFilesForSourceConversation,
  uploadVaultFileBytes,
  type VaultFileCategory,
  type VaultFileRow,
} from "./vault-file-service";
import type { NexUuid } from "./types";

export interface VaultAttachmentCopyResult {
  /** Total attachments found in the conversation (across all messages). */
  attachments_total: number;
  /** Attachments actually copied this run (new vault_file rows). */
  attachments_copied: number;
  /** Attachments skipped because an earlier move already copied them. */
  attachments_skipped: number;
  /** Attachments that failed to copy (logged, non-fatal · remainder of
   *  the batch still processes). The move operation does not reject
   *  on partial failure · the user retains access via the preserved
   *  ciphertext + the surviving copies. */
  attachments_failed: number;
  /** Sum of byte_size for rows copied THIS run (not including skipped). */
  bytes_added: number;
}

export interface VaultAttachmentCleanupResult {
  files_deleted: number;
  bytes_released: number;
}

interface AttachmentCandidate {
  message_id: NexUuid;
  attachment_url: string;
  attachment_type: "image" | "video" | "audio";
  size_bytes: number | null;
  display_name: string;
}

/** Phase A.1 · copy every chat attachment in a vaulted conversation
 *  into the account's Vault. Idempotent · a second move of the same
 *  conversation is a no-op for already-copied attachments. The caller
 *  (vault-entry-service.moveConversationToVault) has already asserted
 *  the viewer is a participant.
 *
 *  Returns a summary; never throws for individual attachment failures
 *  (those are logged + counted so the move succeeds for the rest). */
export async function copyConversationAttachmentsToVault(
  accountId: NexUuid,
  conversationId: NexUuid,
): Promise<VaultAttachmentCopyResult> {
  const candidates = await listConversationAttachments(conversationId);

  const result: VaultAttachmentCopyResult = {
    attachments_total: candidates.length,
    attachments_copied: 0,
    attachments_skipped: 0,
    attachments_failed: 0,
    bytes_added: 0,
  };

  for (const candidate of candidates) {
    try {
      const existing = await findVaultFileBySourceMessage(
        accountId,
        candidate.message_id,
      );
      if (existing) {
        result.attachments_skipped += 1;
        continue;
      }

      // Fetch the bytes · public URL · HEAD/GET. If size wasn't recorded
      // in attachment_meta, fall back to the actual response length.
      const fetched = await fetchAttachmentBytes(candidate.attachment_url);
      if (!fetched) {
        result.attachments_failed += 1;
        continue;
      }
      const sizeBytes =
        candidate.size_bytes && candidate.size_bytes > 0
          ? candidate.size_bytes
          : fetched.body.length;

      // Insert metadata FIRST so we have the deterministic bucket_path.
      // If the subsequent upload fails, we clean up the metadata row
      // via deleteVaultFile below.
      const category = categoryFor(candidate.attachment_type);
      const row = await insertVaultFileMetadata({
        accountId,
        category,
        displayName: candidate.display_name,
        mimeType: fetched.contentType,
        byteSize: sizeBytes,
        folderPath: `chat/${conversationId}`,
        sourceMessageId: candidate.message_id,
        sourceConversationId: conversationId,
      });

      try {
        await uploadVaultFileBytes(
          accountId,
          row.id,
          fetched.body,
          fetched.contentType,
        );
      } catch (uploadErr) {
        // Upload failed · roll back the metadata row to keep state
        // consistent · the next move attempt will try again cleanly.
        await deleteVaultFile(accountId, row.id).catch(() => undefined);
        console.warn(
          `[vault-persistence] upload failed for message=${candidate.message_id}: ${
            uploadErr instanceof Error ? uploadErr.message : uploadErr
          }`,
        );
        result.attachments_failed += 1;
        continue;
      }

      result.attachments_copied += 1;
      result.bytes_added += sizeBytes;
    } catch (err) {
      console.warn(
        `[vault-persistence] copy failed for message=${candidate.message_id}: ${
          err instanceof Error ? err.message : err
        }`,
      );
      result.attachments_failed += 1;
    }
  }

  return result;
}

/** Phase A.1 · remove the Vault attachment copies belonging to a
 *  conversation when the vault entry is deleted. Caller
 *  (vault-entry-service.removeConversationFromVault) runs this AFTER
 *  the nex_vault_entry row is deleted so the Bridge 78 exemption no
 *  longer applies to the original encrypted messages. The vault copies
 *  are owned by the account; cleanup is owner-scoped. */
export async function removeConversationAttachmentsFromVault(
  accountId: NexUuid,
  conversationId: NexUuid,
): Promise<VaultAttachmentCleanupResult> {
  const existing = await listVaultFilesForSourceConversation(
    accountId,
    conversationId,
  );
  let files_deleted = 0;
  let bytes_released = 0;
  for (const file of existing) {
    try {
      await deleteVaultFile(accountId, file.id);
      files_deleted += 1;
      bytes_released += file.byte_size;
    } catch (err) {
      console.warn(
        `[vault-persistence] delete failed for vault_file=${file.id}: ${
          err instanceof Error ? err.message : err
        }`,
      );
    }
  }
  return { files_deleted, bytes_released };
}

// ---------------------------------------------------------------------------
// Internal · attachment enumeration + fetch
// ---------------------------------------------------------------------------

/** Return all attachment-bearing messages in a conversation. Covers both
 *  plaintext and encrypted rows that happen to have an attachment_url
 *  (attachments are stored unencrypted in the chat bucket today ·
 *  Phase A delivers true E2E including attachments). */
async function listConversationAttachments(
  conversationId: NexUuid,
): Promise<AttachmentCandidate[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_peer_message")
    .select("id, attachment_url, attachment_type, attachment_meta, body, sent_at")
    .eq("conversation_id", conversationId)
    .not("attachment_url", "is", null)
    .order("sent_at", { ascending: true });
  if (error) {
    throw new Error(
      `vault-persistence-service.listConversationAttachments: ${error.message}`,
    );
  }
  const rows = (data ?? []) as Array<{
    id: NexUuid;
    attachment_url: string | null;
    attachment_type: "image" | "video" | "audio" | null;
    attachment_meta: { size_bytes?: number; mime?: string } | null;
    body: string | null;
    sent_at: string;
  }>;
  const out: AttachmentCandidate[] = [];
  for (const row of rows) {
    if (!row.attachment_url || !row.attachment_type) continue;
    const sizeFromMeta = row.attachment_meta?.size_bytes;
    const displayName = deriveDisplayName(
      row.attachment_url,
      row.attachment_type,
      row.sent_at,
    );
    out.push({
      message_id: row.id,
      attachment_url: row.attachment_url,
      attachment_type: row.attachment_type,
      size_bytes: typeof sizeFromMeta === "number" ? sizeFromMeta : null,
      display_name: displayName,
    });
  }
  return out;
}

/** Fetch bytes from the public chat-attachment URL. Returns null on
 *  error so the caller can count the failure without aborting the batch.
 *
 *  SSRF HARDENING (sealed 2026-10-06 Phase A.1 security verification)
 *  ------------------------------------------------------------------
 *  attachment_url rows CAN be user-supplied today · the peer-message
 *  send paths at _actions.ts (sendPeerMessageAction) and
 *  _e2e-composer-intercept.tsx read attachment_url straight from client
 *  FormData without origin validation. A crafted FormData could set
 *  attachment_url to anything · without this guard a Vault migration
 *  on a vaulted conversation would turn into a server-side fetch of
 *  attacker-chosen URLs (classic SSRF · OWASP A10:2021).
 *
 *  This guard narrows the fetch destination to the sealed
 *  nex-peer-chat-attachments bucket URL · nothing else. Specifically:
 *    · scheme MUST be https (no file://, data:, javascript:, http://)
 *    · host MUST equal the Supabase project host derived from
 *      NEXT_PUBLIC_NEX_SUPABASE_URL (no attacker-controlled host · no
 *      localhost · no 127.0.0.1 · no 169.254.169.254 metadata · no
 *      private IP ranges · no alternate ports · no userinfo credentials)
 *    · path MUST start with /storage/v1/object/public/nex-peer-chat-attachments/
 *      (prevents an attacker from pivoting to a different Supabase
 *      bucket on the same host)
 *    · fetch is called with redirect: "error" (defeats a 302 bypass
 *      from the Supabase gateway to a different origin)
 *
 *  Rejected URLs are COUNTED (attachments_failed++) · the move keeps
 *  running for the valid attachments in the batch. This is intentional ·
 *  a vault owner should not have the whole move operation reject
 *  because the counterparty sent them one weird link. */
async function fetchAttachmentBytes(
  url: string,
): Promise<{ body: Buffer; contentType: string } | null> {
  if (!isTrustedChatAttachmentUrl(url)) {
    console.warn(
      `[vault-persistence] fetch REJECTED untrusted attachment_url (SSRF guard)`,
    );
    return null;
  }
  try {
    const res = await fetch(url, { redirect: "error" });
    if (!res.ok) {
      console.warn(
        `[vault-persistence] fetch returned ${res.status} for trusted-origin URL`,
      );
      return null;
    }
    const contentType =
      res.headers.get("content-type") || "application/octet-stream";
    const arrayBuf = await res.arrayBuffer();
    return { body: Buffer.from(arrayBuf), contentType };
  } catch (err) {
    console.warn(
      `[vault-persistence] fetch threw: ${
        err instanceof Error ? err.message : err
      }`,
    );
    return null;
  }
}

/** Validate that `rawUrl` points at the sealed nex-peer-chat-attachments
 *  bucket on the configured Supabase project. Exported for tests only ·
 *  callers inside this file use it through fetchAttachmentBytes. */
export function isTrustedChatAttachmentUrl(rawUrl: string): boolean {
  if (typeof rawUrl !== "string" || rawUrl.length === 0) return false;
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  // No credentials in the URL · defeats user:pass@host tricks.
  if (parsed.username.length > 0 || parsed.password.length > 0) return false;
  // No alternate port · the Supabase public URL uses the default 443.
  if (parsed.port.length > 0 && parsed.port !== "443") return false;
  // Hostname must match the sealed Supabase project host.
  const expectedHost = resolveTrustedChatAttachmentHost();
  if (!expectedHost) return false;
  if (parsed.hostname.toLowerCase() !== expectedHost.toLowerCase()) return false;
  // Path must point at the sealed public-bucket prefix. Prevents a
  // same-origin pivot to a different Supabase bucket.
  if (
    !parsed.pathname.startsWith(
      "/storage/v1/object/public/nex-peer-chat-attachments/",
    )
  ) {
    return false;
  }
  return true;
}

/** Derive the host portion of NEXT_PUBLIC_NEX_SUPABASE_URL · never
 *  trusts anything but the configured project origin. Returns null when
 *  the env is missing or malformed so isTrustedChatAttachmentUrl
 *  rejects every URL by default (fail-closed). */
function resolveTrustedChatAttachmentHost(): string | null {
  const raw =
    process.env.NEXT_PUBLIC_NEX_SUPABASE_URL ??
    process.env.NEX_SUPABASE_URL ??
    "";
  if (!raw) return null;
  try {
    return new URL(raw).hostname;
  } catch {
    return null;
  }
}

function categoryFor(kind: "image" | "video" | "audio"): VaultFileCategory {
  switch (kind) {
    case "image":
      return "photos";
    case "video":
      return "videos";
    case "audio":
      // Voice notes land in the Important room · the sealed category
      // enum (migration 129) doesn't carry 'audio', and voice notes
      // are the kind of thing a user tends to vault specifically
      // because they matter. This mapping stays stable across Phase B.
      return "important";
  }
}

function deriveDisplayName(
  url: string,
  kind: "image" | "video" | "audio",
  sentAt: string,
): string {
  // Try to pull a human-ish filename off the URL · the chat bucket
  // uses `{senderId}/{timestamp}-{short}.{ext}` so the final segment
  // is often meaningful enough.
  const path = (() => {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  })();
  const lastSegment = path.split("/").filter(Boolean).pop();
  if (lastSegment && lastSegment.length > 0 && lastSegment.length <= 256) {
    return lastSegment;
  }
  const kindLabel =
    kind === "image" ? "Photo" : kind === "video" ? "Video" : "Voice note";
  const date = new Date(sentAt);
  const stamp = Number.isFinite(date.getTime())
    ? date.toISOString().slice(0, 10)
    : "unknown";
  return `${kindLabel} ${stamp}`;
}

/** Phase A.1 · the TYPE used by Vault file metadata rows that were
 *  copied from a chat attachment. Exported so tests can reference it
 *  without duplicating the mapping. */
export const VAULT_PERSISTENCE_FOLDER_PREFIX = "chat/";

/** Public helper · build the folder_path value used for every attachment
 *  copied from a given conversation. UI surfaces (later phase) can
 *  filter by this prefix to render a conversation-scoped view. */
export function folderPathForConversation(conversationId: NexUuid): string {
  return `${VAULT_PERSISTENCE_FOLDER_PREFIX}${conversationId}`;
}
