// src/lib/nex-native/friend-service.ts
//
// friend-service · Wave B Slice 9a · canonical friend-edge operations.
//
// Doctrine:
//   · Identity Doctrine · every FK is nex_account.id (UUID)
//   · Canonical pair · one row per pair (a < b lex) · duplicates impossible
//   · Anti-fabrication · self-friend rejected · unknown participant errors
//   · Recipient-only response · sender cannot accept their own invite
//   · State machine (service-enforced):
//       pending  → accepted · declined
//       declined → pending (allowed · reset)
//       accepted → (stable · unfriend deletes the row · not implemented in 9a)
//
// UI arrives in Slice 9b (/nex-native/friends surface).

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import type { NexUuid } from "./types";

export type FriendEdgeStatus = "pending" | "accepted" | "declined" | "blocked";

export interface FriendEdgeRow {
  a_account_id: NexUuid;
  b_account_id: NexUuid;
  requested_by: NexUuid;
  status: FriendEdgeStatus;
  created_at: string;
  updated_at: string;
}

/** Return the canonical pair `[a, b]` with `a < b` (lex on UUID string). */
export function canonicalPair(x: NexUuid, y: NexUuid): [NexUuid, NexUuid] {
  if (x === y) {
    throw new Error(`friend-service: self-friend rejected · both IDs are ${x}`);
  }
  return x < y ? [x, y] : [y, x];
}

/**
 * Send an invite from `from` to `to` (both nex_account UUIDs).
 * Idempotent under three cases:
 *   · No existing edge → INSERT status=pending, requested_by=from
 *   · Existing pending edge (either direction) → row unchanged, return current
 *   · Existing accepted edge → row unchanged (already friends), return current
 *   · Existing declined edge → RESET to pending, update requested_by=from,
 *     bump updated_at (allows re-invite after prior decline)
 * Self-friend rejected at canonicalPair.
 */
export async function sendInvite(
  from: NexUuid,
  to: NexUuid
): Promise<FriendEdgeRow> {
  const [a, b] = canonicalPair(from, to);
  const existing = await getEdge(a, b);

  if (!existing) {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_friend_edge")
      .insert({ a_account_id: a, b_account_id: b, requested_by: from, status: "pending" })
      .select("*")
      .single();
    if (error || !data) {
      throw new Error(`friend-service.sendInvite: ${error?.message ?? "no row"}`);
    }
    return data as FriendEdgeRow;
  }

  // Slice 9d · blocked edges reject re-invite from either side.
  if (existing.status === "blocked") {
    throw new Error("nex-friend · this account is blocked");
  }

  if (existing.status === "pending" || existing.status === "accepted") {
    return existing;
  }

  // declined → reset to pending with new requester
  const { data, error } = await nexSupabaseAdmin
    .from("nex_friend_edge")
    .update({ status: "pending", requested_by: from, updated_at: new Date().toISOString() })
    .eq("a_account_id", a)
    .eq("b_account_id", b)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`friend-service.sendInvite reset: ${error?.message ?? "no row"}`);
  }
  return data as FriendEdgeRow;
}

/**
 * Respond to a pending invite. `actor` MUST be the recipient (not the
 * sender · the sender cannot accept their own invite). Idempotent when
 * the edge is already in the target status.
 */
export async function respondToInvite(
  actor: NexUuid,
  other: NexUuid,
  decision: "accept" | "decline"
): Promise<FriendEdgeRow> {
  const [a, b] = canonicalPair(actor, other);
  const existing = await getEdge(a, b);
  if (!existing) {
    throw new Error(`friend-service.respondToInvite: no edge between (${a}, ${b})`);
  }
  if (existing.status !== "pending") {
    // Idempotent · already at some terminal · return unchanged
    return existing;
  }
  if (existing.requested_by === actor) {
    throw new Error(
      `friend-service.respondToInvite: the sender (${actor}) cannot respond to their own invite · only the recipient can`
    );
  }
  const nextStatus: FriendEdgeStatus = decision === "accept" ? "accepted" : "declined";
  const { data, error } = await nexSupabaseAdmin
    .from("nex_friend_edge")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("a_account_id", a)
    .eq("b_account_id", b)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`friend-service.respondToInvite: ${error?.message ?? "no row"}`);
  }
  return data as FriendEdgeRow;
}

/** Return the edge between two accounts if one exists · null otherwise. */
export async function getEdge(a: NexUuid, b: NexUuid): Promise<FriendEdgeRow | null> {
  const [aa, bb] = canonicalPair(a, b);
  const { data, error } = await nexSupabaseAdmin
    .from("nex_friend_edge")
    .select("*")
    .eq("a_account_id", aa)
    .eq("b_account_id", bb)
    .maybeSingle();
  if (error) throw new Error(`friend-service.getEdge: ${error.message}`);
  return (data as FriendEdgeRow) ?? null;
}

/** Accepted friends of `accountId` · returns the OTHER participant's id. */
export async function listFriends(accountId: NexUuid): Promise<NexUuid[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_friend_edge")
    .select("a_account_id, b_account_id")
    .eq("status", "accepted")
    .or(`a_account_id.eq.${accountId},b_account_id.eq.${accountId}`);
  if (error) throw new Error(`friend-service.listFriends: ${error.message}`);
  return ((data ?? []) as Array<{ a_account_id: NexUuid; b_account_id: NexUuid }>).map((r) =>
    r.a_account_id === accountId ? r.b_account_id : r.a_account_id
  );
}

/** Pending invites where `accountId` is the RECIPIENT (someone else asked). */
export async function listPendingIncoming(accountId: NexUuid): Promise<FriendEdgeRow[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_friend_edge")
    .select("*")
    .eq("status", "pending")
    .neq("requested_by", accountId)
    .or(`a_account_id.eq.${accountId},b_account_id.eq.${accountId}`)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`friend-service.listPendingIncoming: ${error.message}`);
  return (data as FriendEdgeRow[]) ?? [];
}

/** Pending invites where `accountId` is the SENDER (waiting on the other). */
export async function listPendingOutgoing(accountId: NexUuid): Promise<FriendEdgeRow[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_friend_edge")
    .select("*")
    .eq("status", "pending")
    .eq("requested_by", accountId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`friend-service.listPendingOutgoing: ${error.message}`);
  return (data as FriendEdgeRow[]) ?? [];
}

/**
 * Remove the friend edge between `actor` and `other` · Wave B Slice 9c.
 * Hard-DELETEs the canonical row regardless of status (accepted / pending /
 * declined all become "no edge" · re-invite after remove creates a fresh
 * pending row exactly like a first-time invite).
 * Rejects self-remove and no-existing-edge (idempotent semantics would hide
 * bugs · better to throw so the caller learns the row wasn't there).
 */
// Slice 9d · block/unblock

/**
 * Block `other` from actor's perspective. Transitions any existing edge
 * (or creates a new one) to status='blocked' with requested_by=actor.
 * · No self-block · rejected at canonicalPair.
 * · Idempotent when already blocked BY THE SAME actor · returns unchanged.
 * · If the OTHER party blocked us, we cannot re-block (row already reflects
 *   the block; unblock is theirs to make).
 */
export async function blockAccount(actor: NexUuid, other: NexUuid): Promise<FriendEdgeRow> {
  const [a, b] = canonicalPair(actor, other);
  const existing = await getEdge(a, b);
  if (existing?.status === "blocked") {
    if (existing.requested_by === actor) return existing;
    throw new Error("nex-friend · already blocked by the other party");
  }
  if (!existing) {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_friend_edge")
      .insert({ a_account_id: a, b_account_id: b, requested_by: actor, status: "blocked" })
      .select("*")
      .single();
    if (error || !data) throw new Error(`friend-service.blockAccount insert · ${error?.message ?? "no row"}`);
    return data as FriendEdgeRow;
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_friend_edge")
    .update({ status: "blocked", requested_by: actor, updated_at: new Date().toISOString() })
    .eq("a_account_id", a)
    .eq("b_account_id", b)
    .select("*")
    .single();
  if (error || !data) throw new Error(`friend-service.blockAccount update · ${error?.message ?? "no row"}`);
  return data as FriendEdgeRow;
}

/** List every account that `actor` has actively blocked (returns the other-id). */
export async function listBlockedByMe(actor: NexUuid): Promise<NexUuid[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_friend_edge")
    .select("a_account_id, b_account_id, requested_by, status")
    .eq("status", "blocked")
    .eq("requested_by", actor);
  if (error) throw new Error(`friend-service.listBlockedByMe: ${error.message}`);
  return ((data ?? []) as Array<{ a_account_id: string; b_account_id: string }>)
    .map((r) => (r.a_account_id === actor ? r.b_account_id : r.a_account_id));
}

/**
 * Unblock the pair · only the ORIGINAL blocker can lift the block.
 * Deletes the row · re-invite becomes possible again.
 */
export async function unblockAccount(actor: NexUuid, other: NexUuid): Promise<void> {
  const [a, b] = canonicalPair(actor, other);
  const existing = await getEdge(a, b);
  if (!existing) throw new Error("nex-friend · no relationship to unblock");
  if (existing.status !== "blocked") throw new Error("nex-friend · relationship is not currently blocked");
  if (existing.requested_by !== actor) {
    throw new Error("nex-friend · only the account that placed the block can lift it");
  }
  const { error } = await nexSupabaseAdmin
    .from("nex_friend_edge")
    .delete()
    .eq("a_account_id", a)
    .eq("b_account_id", b);
  if (error) throw new Error(`friend-service.unblockAccount · ${error.message}`);
}

export async function removeFriend(actor: NexUuid, other: NexUuid): Promise<void> {
  const [a, b] = canonicalPair(actor, other);  // throws on self
  const { data: existing, error: readErr } = await nexSupabaseAdmin
    .from("nex_friend_edge")
    .select("*")
    .eq("a_account_id", a)
    .eq("b_account_id", b)
    .maybeSingle();
  if (readErr) throw new Error(`friend-service.removeFriend: read · ${readErr.message}`);
  if (!existing) {
    throw new Error("nex-friend · no relationship to remove");
  }
  // Slice 9d · blocked rows can only be removed by the blocker (via unblockAccount).
  // A non-blocker cannot circumvent the block by deleting the row here.
  if ((existing as FriendEdgeRow).status === "blocked") {
    throw new Error("nex-friend · relationship is blocked · use unblock (blocker only)");
  }
  const { error: delErr } = await nexSupabaseAdmin
    .from("nex_friend_edge")
    .delete()
    .eq("a_account_id", a)
    .eq("b_account_id", b);
  if (delErr) throw new Error(`friend-service.removeFriend: delete · ${delErr.message}`);
}
