// src/lib/nex/friend-edge/friend-edge.ts
//
// NEX Y-P3 · Server-authoritative Friend Edge domain
// Philip 2026-09-07
//
// This module owns every rule that defines a mutual NEX friendship.
// Callers (API routes) MUST authenticate their caller first, then pass
// the verified `actor_user_id` into these functions. The functions
// themselves DO NOT re-authenticate — they enforce authorization based
// on the actor id they receive and refuse any operation the actor is
// not entitled to.
//
// Invariants (enforced here + reinforced by DB constraints):
//   · sender_user_id != recipient_user_id                        (no self-invite)
//   · at most one PENDING invite per (sender, recipient) pair    (unique partial index)
//   · only recipient may accept/decline                          (403 otherwise)
//   · only sender may revoke                                     (403 otherwise)
//   · only PENDING invites can transition                        (409 otherwise)
//   · ACCEPTED creates EXACTLY ONE canonical friend edge with LEAST/GREATEST ordering
//   · client localStorage MAY reflect these rows as a cache only · never as authority
//
// Uses service-role Supabase (via @/lib/supabaseNexAdmin) once the caller
// has been authenticated at the API-route layer. This is deliberate:
// service-role bypasses RLS, so we must NEVER call these functions
// without first checking `actor_user_id`.

import "server-only";
import { supabaseNexAdmin } from "@/lib/supabaseNexAdmin";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InviteStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "REVOKED";

export interface FriendInviteRow {
  id: string;
  sender_user_id: string;
  recipient_user_id: string;
  meeting_pref: string | null;
  status: InviteStatus;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FriendEdgeRow {
  id: string;
  user_low: string;
  user_high: string;
  origin_invite_id: string;
  meeting_pref: string | null;
  connected_at: string;
  created_at: string;
  updated_at: string;
}

export type FriendEdgeResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; error: string };

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

function isUuid(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

/** Canonicalise a pair of user ids so friendship storage stays deduplicated. */
export function canonicalPair(a: string, b: string): { low: string; high: string } {
  return a < b ? { low: a, high: b } : { low: b, high: a };
}

// ---------------------------------------------------------------------------
// createInvite
// ---------------------------------------------------------------------------

export interface CreateInviteInput {
  actor_user_id: string;         // must match sender_user_id
  recipient_user_id: string;
  meeting_pref?: string | null;
}

export async function createInvite(input: CreateInviteInput): Promise<FriendEdgeResult<FriendInviteRow>> {
  const { actor_user_id, recipient_user_id, meeting_pref = null } = input;

  if (!isUuid(actor_user_id))     return { ok: false, status: 400, error: "actor_user_id must be a uuid" };
  if (!isUuid(recipient_user_id)) return { ok: false, status: 400, error: "recipient_user_id must be a uuid" };
  if (actor_user_id === recipient_user_id) return { ok: false, status: 400, error: "cannot invite yourself" };
  if (meeting_pref != null && (typeof meeting_pref !== "string" || meeting_pref.length < 1 || meeting_pref.length > 64)) {
    return { ok: false, status: 400, error: "meeting_pref must be a string of 1-64 chars if provided" };
  }

  // Verify recipient is a registered NEX user before creating the invite.
  // Prevents inviting stranger UUIDs that were never provisioned.
  const { data: recipientRow, error: recipientErr } = await supabaseNexAdmin
    .from("hammerex_nex_users")
    .select("supabase_user_id, status")
    .eq("supabase_user_id", recipient_user_id)
    .maybeSingle();
  if (recipientErr)         return { ok: false, status: 500, error: `recipient_lookup_failed: ${recipientErr.message}` };
  if (!recipientRow)        return { ok: false, status: 404, error: "recipient_not_a_registered_nex_user" };
  if (recipientRow.status !== "active") {
    return { ok: false, status: 403, error: `recipient_status_${recipientRow.status}` };
  }

  // If a canonical friendship already exists, refuse (Y-P3 does not
  // support re-invitation of existing friends).
  const { low, high } = canonicalPair(actor_user_id, recipient_user_id);
  const { data: existingEdge } = await supabaseNexAdmin
    .from("nex_friend_edge")
    .select("id")
    .eq("user_low", low)
    .eq("user_high", high)
    .maybeSingle();
  if (existingEdge) return { ok: false, status: 409, error: "already_friends" };

  // Insert · the DB unique partial index prevents a duplicate PENDING
  // invite from the same sender to the same recipient. If a duplicate
  // is attempted, we translate the DB error to a 409.
  const { data, error } = await supabaseNexAdmin
    .from("nex_friend_invite")
    .insert({
      sender_user_id:     actor_user_id,
      recipient_user_id:  recipient_user_id,
      meeting_pref,
      status:             "PENDING",
    })
    .select("*")
    .single();

  if (error) {
    // 23505 = unique_violation on the unique_pending index
    const msg = (error.message || "").toLowerCase();
    if (msg.includes("duplicate") || msg.includes("unique") || (error as { code?: string }).code === "23505") {
      return { ok: false, status: 409, error: "invite_already_pending" };
    }
    return { ok: false, status: 500, error: `invite_insert_failed: ${error.message}` };
  }

  return { ok: true, value: data as FriendInviteRow };
}

// ---------------------------------------------------------------------------
// respondToInvite
// ---------------------------------------------------------------------------

export interface RespondInput {
  actor_user_id: string;        // must be the invite.recipient_user_id
  invite_id: string;
  decision: "ACCEPT" | "DECLINE";
}

export type RespondValue = {
  invite: FriendInviteRow;
  edge:   FriendEdgeRow | null;   // present iff decision was ACCEPT
};

export async function respondToInvite(input: RespondInput): Promise<FriendEdgeResult<RespondValue>> {
  const { actor_user_id, invite_id, decision } = input;
  if (!isUuid(actor_user_id))     return { ok: false, status: 400, error: "actor_user_id must be a uuid" };
  if (!isUuid(invite_id))         return { ok: false, status: 400, error: "invite_id must be a uuid" };
  if (decision !== "ACCEPT" && decision !== "DECLINE") {
    return { ok: false, status: 400, error: "decision must be ACCEPT or DECLINE" };
  }

  const { data: invite, error: readErr } = await supabaseNexAdmin
    .from("nex_friend_invite")
    .select("*")
    .eq("id", invite_id)
    .maybeSingle();
  if (readErr) return { ok: false, status: 500, error: `invite_read_failed: ${readErr.message}` };
  if (!invite) return { ok: false, status: 404, error: "invite_not_found" };

  // AUTHORIZATION: only the RECIPIENT may accept/decline. Not the sender.
  // Not an unrelated user. Not a client-claimed sub of either.
  if (invite.recipient_user_id !== actor_user_id) {
    return { ok: false, status: 403, error: "only_the_recipient_may_respond" };
  }

  // STATE MACHINE: only PENDING invites can transition.
  if (invite.status !== "PENDING") {
    return { ok: false, status: 409, error: `invite_status_is_${invite.status}` };
  }

  const now = new Date().toISOString();
  const nextStatus: InviteStatus = decision === "ACCEPT" ? "ACCEPTED" : "DECLINED";

  const { data: updatedInvite, error: updErr } = await supabaseNexAdmin
    .from("nex_friend_invite")
    .update({ status: nextStatus, responded_at: now })
    .eq("id", invite_id)
    .eq("status", "PENDING")           // optimistic guard against concurrent responder
    .select("*")
    .single();
  if (updErr)          return { ok: false, status: 500, error: `invite_update_failed: ${updErr.message}` };
  if (!updatedInvite)  return { ok: false, status: 409, error: "invite_race_lost" };

  if (decision === "DECLINE") {
    return { ok: true, value: { invite: updatedInvite as FriendInviteRow, edge: null } };
  }

  // ACCEPT → create canonical edge (idempotent via unique(user_low, user_high))
  const { low, high } = canonicalPair(invite.sender_user_id, invite.recipient_user_id);
  const { data: edge, error: edgeErr } = await supabaseNexAdmin
    .from("nex_friend_edge")
    .insert({
      user_low:         low,
      user_high:        high,
      origin_invite_id: invite.id,
      meeting_pref:     invite.meeting_pref,
    })
    .select("*")
    .single();
  if (edgeErr) {
    const msg = (edgeErr.message || "").toLowerCase();
    if (msg.includes("duplicate") || msg.includes("unique") || (edgeErr as { code?: string }).code === "23505") {
      // Edge already exists (both users accepted concurrent invites, or
      // duplicate accept fired). Re-read the existing edge and return it.
      const { data: existing } = await supabaseNexAdmin
        .from("nex_friend_edge")
        .select("*")
        .eq("user_low", low)
        .eq("user_high", high)
        .maybeSingle();
      if (existing) return { ok: true, value: { invite: updatedInvite as FriendInviteRow, edge: existing as FriendEdgeRow } };
    }
    return { ok: false, status: 500, error: `edge_insert_failed: ${edgeErr.message}` };
  }

  return { ok: true, value: { invite: updatedInvite as FriendInviteRow, edge: edge as FriendEdgeRow } };
}

// ---------------------------------------------------------------------------
// revokeInvite
// ---------------------------------------------------------------------------

export interface RevokeInput {
  actor_user_id: string;   // must be invite.sender_user_id
  invite_id: string;
}

export async function revokeInvite(input: RevokeInput): Promise<FriendEdgeResult<FriendInviteRow>> {
  const { actor_user_id, invite_id } = input;
  if (!isUuid(actor_user_id))     return { ok: false, status: 400, error: "actor_user_id must be a uuid" };
  if (!isUuid(invite_id))         return { ok: false, status: 400, error: "invite_id must be a uuid" };

  const { data: invite, error: readErr } = await supabaseNexAdmin
    .from("nex_friend_invite")
    .select("*")
    .eq("id", invite_id)
    .maybeSingle();
  if (readErr) return { ok: false, status: 500, error: `invite_read_failed: ${readErr.message}` };
  if (!invite) return { ok: false, status: 404, error: "invite_not_found" };
  if (invite.sender_user_id !== actor_user_id) {
    return { ok: false, status: 403, error: "only_the_sender_may_revoke" };
  }
  if (invite.status !== "PENDING") {
    return { ok: false, status: 409, error: `invite_status_is_${invite.status}` };
  }

  const now = new Date().toISOString();
  const { data: updated, error: updErr } = await supabaseNexAdmin
    .from("nex_friend_invite")
    .update({ status: "REVOKED", responded_at: now })
    .eq("id", invite_id)
    .eq("status", "PENDING")
    .select("*")
    .single();
  if (updErr)     return { ok: false, status: 500, error: `invite_update_failed: ${updErr.message}` };
  if (!updated)   return { ok: false, status: 409, error: "invite_race_lost" };
  return { ok: true, value: updated as FriendInviteRow };
}

// ---------------------------------------------------------------------------
// Read helpers · every read is scoped to the actor
// ---------------------------------------------------------------------------

export async function listIncomingInvites(actor_user_id: string, status: InviteStatus | null = "PENDING"): Promise<FriendEdgeResult<FriendInviteRow[]>> {
  if (!isUuid(actor_user_id)) return { ok: false, status: 400, error: "actor_user_id must be a uuid" };
  let q = supabaseNexAdmin.from("nex_friend_invite").select("*").eq("recipient_user_id", actor_user_id);
  if (status) q = q.eq("status", status);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) return { ok: false, status: 500, error: `invites_read_failed: ${error.message}` };
  return { ok: true, value: (data ?? []) as FriendInviteRow[] };
}

export async function listOutgoingInvites(actor_user_id: string, status: InviteStatus | null = "PENDING"): Promise<FriendEdgeResult<FriendInviteRow[]>> {
  if (!isUuid(actor_user_id)) return { ok: false, status: 400, error: "actor_user_id must be a uuid" };
  let q = supabaseNexAdmin.from("nex_friend_invite").select("*").eq("sender_user_id", actor_user_id);
  if (status) q = q.eq("status", status);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) return { ok: false, status: 500, error: `invites_read_failed: ${error.message}` };
  return { ok: true, value: (data ?? []) as FriendInviteRow[] };
}

export async function listFriends(actor_user_id: string): Promise<FriendEdgeResult<FriendEdgeRow[]>> {
  if (!isUuid(actor_user_id)) return { ok: false, status: 400, error: "actor_user_id must be a uuid" };
  const { data, error } = await supabaseNexAdmin
    .from("nex_friend_edge")
    .select("*")
    .or(`user_low.eq.${actor_user_id},user_high.eq.${actor_user_id}`)
    .order("connected_at", { ascending: false });
  if (error) return { ok: false, status: 500, error: `friends_read_failed: ${error.message}` };
  return { ok: true, value: (data ?? []) as FriendEdgeRow[] };
}

export async function isFriend(user_a: string, user_b: string): Promise<boolean> {
  if (!isUuid(user_a) || !isUuid(user_b) || user_a === user_b) return false;
  const { low, high } = canonicalPair(user_a, user_b);
  const { data } = await supabaseNexAdmin
    .from("nex_friend_edge")
    .select("id")
    .eq("user_low", low)
    .eq("user_high", high)
    .maybeSingle();
  return !!data;
}
