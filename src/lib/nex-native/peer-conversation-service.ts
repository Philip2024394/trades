// src/lib/nex-native/peer-conversation-service.ts
//
// Bridge 3 · peer-to-peer conversation service.
// ----------------------------------------------
// Companion to conversation-service.ts (which handles business chat).
// This service manages friend↔friend chat threads that don't belong to
// any business.
//
// Doctrine:
//   · Canonical (a, b) ordering · participant_a_id < participant_b_id
//     enforced by both this service and the DB CHECK constraint. Callers
//     may pass ids in any order; we normalise here.
//   · getOrCreate is idempotent · the DB UNIQUE(a,b) constraint
//     guarantees only one conversation exists per pair.
//   · Only participants can read their conversations · enforced by RLS
//     migration 047. Service layer uses supabase-admin (bypasses RLS)
//     because callers vouch for the viewer via session; we still do
//     participant checks explicitly.

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import type { NexUuid } from "./types";

export interface NexPeerConversationRow {
  id: NexUuid;
  participant_a_id: NexUuid;
  participant_b_id: NexUuid;
  created_at: string;
  last_message_at: string | null;
}

/** Sort two account ids so (a, b) is the canonical pair regardless of
 *  which side the caller passed first. */
function orderPair(x: NexUuid, y: NexUuid): [NexUuid, NexUuid] {
  return x < y ? [x, y] : [y, x];
}

/** Read a peer conversation by id. */
export async function getPeerConversationById(
  id: NexUuid,
): Promise<NexPeerConversationRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_peer_conversation")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    throw new Error(
      `peer-conversation-service.getPeerConversationById: ${error.message}`,
    );
  }
  return (data as NexPeerConversationRow | null) ?? null;
}

/** Find the conversation between two accounts, if it exists. */
export async function findPeerConversation(
  x: NexUuid,
  y: NexUuid,
): Promise<NexPeerConversationRow | null> {
  const [a, b] = orderPair(x, y);
  const { data, error } = await nexSupabaseAdmin
    .from("nex_peer_conversation")
    .select("*")
    .eq("participant_a_id", a)
    .eq("participant_b_id", b)
    .maybeSingle();
  if (error) {
    throw new Error(
      `peer-conversation-service.findPeerConversation: ${error.message}`,
    );
  }
  return (data as NexPeerConversationRow | null) ?? null;
}

/** Get the peer conversation between two accounts, creating it if
 *  needed. Idempotent · safe to call repeatedly. Callers should ensure
 *  the viewer is one of the two accounts (RLS also blocks otherwise).
 *  Throws if x === y (same-account self-chat is not supported). */
export async function getOrCreatePeerConversation(
  x: NexUuid,
  y: NexUuid,
): Promise<NexPeerConversationRow> {
  if (x === y) {
    throw new Error(
      "peer-conversation-service.getOrCreatePeerConversation: cannot create self-conversation",
    );
  }
  const existing = await findPeerConversation(x, y);
  if (existing) return existing;
  const [a, b] = orderPair(x, y);
  const { data, error } = await nexSupabaseAdmin
    .from("nex_peer_conversation")
    .insert({ participant_a_id: a, participant_b_id: b })
    .select("*")
    .single();
  if (error || !data) {
    // Race · another insert may have won. Try to read again.
    const raced = await findPeerConversation(x, y);
    if (raced) return raced;
    throw new Error(
      `peer-conversation-service.getOrCreatePeerConversation: ${error?.message ?? "no row returned"}`,
    );
  }
  return data as NexPeerConversationRow;
}

/** List every peer conversation the given account is part of.
 *  Ordered by last_message_at (newest first) so the caller can render
 *  a conversation-list surface without extra sorting. */
export async function listPeerConversationsForAccount(
  accountId: NexUuid,
): Promise<NexPeerConversationRow[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_peer_conversation")
    .select("*")
    .or(`participant_a_id.eq.${accountId},participant_b_id.eq.${accountId}`)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(
      `peer-conversation-service.listPeerConversationsForAccount: ${error.message}`,
    );
  }
  return (data as NexPeerConversationRow[]) ?? [];
}

/** Return true iff the viewer is a participant of the conversation.
 *  Cheap · use as a guard before rendering messages. */
export async function isPeerConversationParticipant(
  conversationId: NexUuid,
  viewerAccountId: NexUuid,
): Promise<boolean> {
  const c = await getPeerConversationById(conversationId);
  if (!c) return false;
  return (
    c.participant_a_id === viewerAccountId ||
    c.participant_b_id === viewerAccountId
  );
}

/** Given a conversation + viewer, return the OTHER participant's id.
 *  Returns null if the viewer is not a participant of the conversation. */
export function peerOfConversation(
  conversation: NexPeerConversationRow,
  viewerAccountId: NexUuid,
): NexUuid | null {
  if (conversation.participant_a_id === viewerAccountId) {
    return conversation.participant_b_id;
  }
  if (conversation.participant_b_id === viewerAccountId) {
    return conversation.participant_a_id;
  }
  return null;
}

/** Bump last_message_at on the conversation · called from
 *  peer-message-service.sendPeerMessage after a successful insert. */
export async function touchPeerConversation(
  conversationId: NexUuid,
  at: string,
): Promise<void> {
  const { error } = await nexSupabaseAdmin
    .from("nex_peer_conversation")
    .update({ last_message_at: at })
    .eq("id", conversationId);
  if (error) {
    throw new Error(
      `peer-conversation-service.touchPeerConversation: ${error.message}`,
    );
  }
}
