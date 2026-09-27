// src/lib/nex-native/peer-message-service.ts
//
// Bridge 3 · peer-to-peer message service.
// -----------------------------------------
// Immutable append-only log of messages between two friends. Companion
// to peer-conversation-service.ts.
//
// Doctrine:
//   · Messages are IMMUTABLE · no updateMessage export. The only
//     mutable column is read_at, which flips from null to a timestamp
//     when the recipient views the message.
//   · Send guards: sender must be a participant of the conversation.
//     Enforced here at the service boundary in addition to RLS.
//   · Body length: 1-4000 chars, matches DB CHECK. Longer messages
//     should be split (client responsibility).

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import {
  getPeerConversationById,
  touchPeerConversation,
} from "./peer-conversation-service";
import type { NexUuid } from "./types";

export interface NexPeerMessageRow {
  id: NexUuid;
  conversation_id: NexUuid;
  sender_account_id: NexUuid;
  body: string;
  sent_at: string;
  read_at: string | null;
  /** When non-null, this message is a reply that quotes the target
   *  peer message. Introduced Bridge 5 · migration 052. */
  reply_to_id: NexUuid | null;
  /** Set to true when the sender retracts the message. UI renders a
   *  "🚫 deleted" placeholder in its slot. Body is preserved for
   *  audit. Sealed Bridge 6 · migration 053. */
  deleted_for_everyone: boolean;
  /** When the retraction happened. */
  deleted_at: string | null;
}

/** Window in which a sender can still retract a message. WhatsApp
 *  uses roughly 1 hour · we match that. Beyond the window the
 *  service refuses to delete. */
export const NEX_PEER_MESSAGE_DELETE_WINDOW_MS = 60 * 60 * 1000;

export interface SendPeerMessageInput {
  conversation_id: NexUuid;
  sender_account_id: NexUuid;
  body: string;
  /** Optional · when set, the message quotes this target and the UI
   *  renders a reply-quote header inside the bubble. */
  reply_to_id?: NexUuid | null;
}

/** Persist a peer chat message. Sender must be a participant of the
 *  conversation · throws otherwise. Bumps last_message_at on the
 *  conversation as a side-effect (so listing conversations sorted by
 *  recency works without an aggregate query). */
export async function sendPeerMessage(
  input: SendPeerMessageInput,
): Promise<NexPeerMessageRow> {
  const body = input.body.trim();
  if (body.length === 0) {
    throw new Error("peer-message-service.sendPeerMessage: body is empty");
  }
  if (body.length > 4000) {
    throw new Error(
      "peer-message-service.sendPeerMessage: body exceeds 4000 chars",
    );
  }
  const conversation = await getPeerConversationById(input.conversation_id);
  if (!conversation) {
    throw new Error(
      "peer-message-service.sendPeerMessage: conversation not found",
    );
  }
  const isParticipant =
    conversation.participant_a_id === input.sender_account_id ||
    conversation.participant_b_id === input.sender_account_id;
  if (!isParticipant) {
    throw new Error(
      "peer-message-service.sendPeerMessage: sender is not a participant of this conversation",
    );
  }
  // Validate the reply target exists AND belongs to the same
  // conversation · defends against replying to a message in another
  // thread (impossible via UI but cheap to enforce here).
  let replyToId: NexUuid | null = null;
  if (input.reply_to_id) {
    const { data: target, error: targetErr } = await nexSupabaseAdmin
      .from("nex_peer_message")
      .select("id, conversation_id")
      .eq("id", input.reply_to_id)
      .maybeSingle();
    if (targetErr) {
      throw new Error(
        `peer-message-service.sendPeerMessage · reply target lookup failed: ${targetErr.message}`,
      );
    }
    if (
      target &&
      (target as { conversation_id: string }).conversation_id ===
        input.conversation_id
    ) {
      replyToId = input.reply_to_id;
    }
    // Silently drop bad reply pointers rather than erroring the send.
  }

  const { data, error } = await nexSupabaseAdmin
    .from("nex_peer_message")
    .insert({
      conversation_id: input.conversation_id,
      sender_account_id: input.sender_account_id,
      body,
      reply_to_id: replyToId,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `peer-message-service.sendPeerMessage: ${error?.message ?? "no row returned"}`,
    );
  }
  const row = data as NexPeerMessageRow;
  await touchPeerConversation(row.conversation_id, row.sent_at).catch(() => {
    // best-effort · leaving last_message_at stale won't break sends
  });
  return row;
}

/** List messages in a conversation, oldest first. Optional limit. */
export async function listPeerMessages(
  conversationId: NexUuid,
  opts?: { limit?: number },
): Promise<NexPeerMessageRow[]> {
  let query = nexSupabaseAdmin
    .from("nex_peer_message")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("sent_at", { ascending: true });
  if (opts?.limit && opts.limit > 0) query = query.limit(opts.limit);
  const { data, error } = await query;
  if (error) {
    throw new Error(`peer-message-service.listPeerMessages: ${error.message}`);
  }
  return (data as NexPeerMessageRow[]) ?? [];
}

/** Mark every inbound (not-from-viewer) message in the conversation as
 *  read. Idempotent side-effect · safe to call on every page load. */
export async function markPeerMessagesRead(
  conversationId: NexUuid,
  viewerAccountId: NexUuid,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await nexSupabaseAdmin
    .from("nex_peer_message")
    .update({ read_at: now })
    .eq("conversation_id", conversationId)
    .neq("sender_account_id", viewerAccountId)
    .is("read_at", null);
  if (error) {
    // best-effort · never throw from a read-marker
    // eslint-disable-next-line no-console
    console.warn(
      `peer-message-service.markPeerMessagesRead soft-fail: ${error.message}`,
    );
  }
}

/** Retract a peer message · "delete for everyone". Sender-only,
 *  within a 1-hour window from send time. Sets deleted_for_everyone
 *  + deleted_at · body is preserved for audit. Throws with clear
 *  reasons the Server Action can surface as user-facing banners. */
export async function deletePeerMessageForEveryone(
  messageId: NexUuid,
  viewerAccountId: NexUuid,
): Promise<void> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_peer_message")
    .select("id, sender_account_id, sent_at, deleted_for_everyone")
    .eq("id", messageId)
    .maybeSingle();
  if (error) {
    throw new Error(
      `peer-message-service.deletePeerMessageForEveryone lookup: ${error.message}`,
    );
  }
  if (!data) {
    throw new Error("message not found");
  }
  const row = data as Pick<
    NexPeerMessageRow,
    "sender_account_id" | "sent_at" | "deleted_for_everyone"
  > & { id: NexUuid };
  if (row.deleted_for_everyone) {
    // Idempotent · already deleted · nothing to do.
    return;
  }
  if (row.sender_account_id !== viewerAccountId) {
    throw new Error("only the sender can delete this message");
  }
  const age = Date.now() - new Date(row.sent_at).getTime();
  if (age > NEX_PEER_MESSAGE_DELETE_WINDOW_MS) {
    throw new Error(
      "delete window has passed · you can retract messages within an hour",
    );
  }
  const now = new Date().toISOString();
  const upd = await nexSupabaseAdmin
    .from("nex_peer_message")
    .update({ deleted_for_everyone: true, deleted_at: now })
    .eq("id", messageId);
  if (upd.error) {
    throw new Error(
      `peer-message-service.deletePeerMessageForEveryone update: ${upd.error.message}`,
    );
  }
}

/** Count unread messages for a viewer across a specific conversation.
 *  Cheap · used for the chat surface unread pill. */
export async function countUnreadPeerMessages(
  conversationId: NexUuid,
  viewerAccountId: NexUuid,
): Promise<number> {
  const { count, error } = await nexSupabaseAdmin
    .from("nex_peer_message")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId)
    .neq("sender_account_id", viewerAccountId)
    .is("read_at", null);
  if (error) return 0;
  return count ?? 0;
}
