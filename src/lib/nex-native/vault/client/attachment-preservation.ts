// src/lib/nex-native/vault/client/attachment-preservation.ts
//
// Vault Phase B · Commit B.5 · Policy X · future-attachment auto-
// preservation orchestrator.
//
// Role in the sealed architecture:
//   · The sealed Phase A.1 `copyConversationAttachmentsToVault` runs
//     once at MOVE time and preserves every historical attachment that
//     existed before the move.
//   · The sealed B.2 server route `/api/nex-native/vault/chat/
//     attachment/preserve` is idempotent per `source_message_id`
//     (partial unique index from migration 140) and plaintext-blind.
//   · The sealed B.3 K_c layer is irrelevant here · attachment bytes
//     ride the A.1 → A.6 encrypted file pipeline, not the per-message
//     K_c cache.
//   · This client orchestrator fires on each Vault chat open to
//     catch any attachment that arrived AFTER the move. Idempotent at
//     every layer · safe to run on every mount.
//
// Non-scope:
//   · No new API route. Reuses `/api/nex-native/vault/chat/attachment
//     /preserve` from B.2.
//   · No new object-storage path. Reuses A.1/A.6.
//   · No new encryption primitive. The sealed A.6 migration runner
//     encrypts the preserved file on next Vault unlock (we are
//     already unlocked when this runs).
//   · No server-side plaintext · the server stays blind. This module
//     only POSTs {conversation_id, message_id} and interprets the
//     opaque result.
//
// Honest failure semantics:
//   · Per-message failure is NON-FATAL · we accumulate counts and
//     return them. A single failed attachment must not report "all
//     preserved" (brief §9).
//   · Server step-up / lock errors propagate as `step_up_required` ·
//     the caller surfaces this to the UI.

"use client";

export interface PreserveAttachmentCandidate {
  conversationId: string;
  messageId: string;
}

export type PreserveState =
  | "preserved" // new nex_vault_file row created this run
  | "already_preserved" // sealed B.2 route · idempotency hit
  | "no_attachment" // message has no attachment · nothing to do
  | "forbidden" // server rejected (not participant / wrong conv)
  | "step_up_required"
  | "copy_failed"
  | "unknown_error";

export interface PreserveOne {
  conversationId: string;
  messageId: string;
  state: PreserveState;
  vault_file_id?: string;
  http_status?: number;
}

export interface PreserveBatchResult {
  total: number;
  preserved: number; // state === "preserved"
  already_preserved: number; // state === "already_preserved"
  skipped: number; // no_attachment
  failed: number; // everything else
  rows: PreserveOne[];
}

/**
 * Preserve a single attachment-bearing message into Vault. Idempotent
 * at the server · safe to call multiple times.
 */
export async function preserveAttachmentIfVaulted(
  input: PreserveAttachmentCandidate,
): Promise<PreserveOne> {
  try {
    const res = await fetch(
      "/api/nex-native/vault/chat/attachment/preserve",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversation_id: input.conversationId,
          message_id: input.messageId,
        }),
      },
    );
    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      state?: "preserved" | "already_preserved";
      vault_file_id?: string;
      error?: string;
    };
    if (res.ok && body.ok) {
      return {
        conversationId: input.conversationId,
        messageId: input.messageId,
        state: body.state ?? "preserved",
        vault_file_id: body.vault_file_id,
        http_status: 200,
      };
    }
    if (res.status === 403) {
      return {
        conversationId: input.conversationId,
        messageId: input.messageId,
        state:
          body.error === "step_up_required" ? "step_up_required" : "forbidden",
        http_status: 403,
      };
    }
    if (body.error === "no_attachment") {
      return {
        conversationId: input.conversationId,
        messageId: input.messageId,
        state: "no_attachment",
        http_status: res.status,
      };
    }
    if (body.error === "copy_failed" || res.status === 502) {
      return {
        conversationId: input.conversationId,
        messageId: input.messageId,
        state: "copy_failed",
        http_status: res.status,
      };
    }
    return {
      conversationId: input.conversationId,
      messageId: input.messageId,
      state: "unknown_error",
      http_status: res.status,
    };
  } catch {
    return {
      conversationId: input.conversationId,
      messageId: input.messageId,
      state: "unknown_error",
    };
  }
}

/**
 * Preserve every supplied candidate · caller filters down to
 * attachment-bearing messages. The caller is responsible for
 * determining which messages have attachments; this orchestrator
 * does not inspect message bodies (and could not · they are
 * encrypted or sentinelled server-side).
 *
 * Returns the honest partial state · a single failure never reports
 * "all preserved" (brief §9).
 */
export async function preserveAttachmentsForVaultedConversation(
  candidates: PreserveAttachmentCandidate[],
): Promise<PreserveBatchResult> {
  const result: PreserveBatchResult = {
    total: candidates.length,
    preserved: 0,
    already_preserved: 0,
    skipped: 0,
    failed: 0,
    rows: [],
  };
  // Serialise · the sealed A.1 flow fetches bytes from the public chat
  // bucket per attachment · parallel bursts could stampede. Sequential
  // keeps the server-side batch helper safe + the client memory
  // predictable.
  for (const c of candidates) {
    const r = await preserveAttachmentIfVaulted(c);
    result.rows.push(r);
    switch (r.state) {
      case "preserved":
        result.preserved += 1;
        break;
      case "already_preserved":
        result.already_preserved += 1;
        break;
      case "no_attachment":
        result.skipped += 1;
        break;
      default:
        result.failed += 1;
    }
  }
  return result;
}
