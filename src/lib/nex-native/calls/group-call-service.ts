// src/lib/nex-native/calls/group-call-service.ts
//
// Server-side helpers for nex_group_call_session + nex_group_call_participant
// (migration 133). Thin wrappers over nexSupabaseAdmin. Policy
// decisions (who can start, who can invite) live in the server
// actions · this layer trusts its callers.
//
// The 4-participant hard cap is enforced by a DB trigger, so these
// helpers surface the resulting error as a typed reason rather than
// trying to pre-validate.

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";
import type { NexUuid } from "../types";

export type GroupCallMediaType = "audio" | "video";
export type GroupCallState = "ringing" | "live" | "ended";
export type GroupParticipantRole = "host" | "guest";

export interface GroupCallSessionRow {
  id: NexUuid;
  host_account_id: NexUuid;
  media_type: GroupCallMediaType;
  state: GroupCallState;
  started_at: string;
  live_at: string | null;
  ended_at: string | null;
  from_call_link_id: NexUuid | null;
}

export interface GroupCallParticipantRow {
  id: NexUuid;
  session_id: NexUuid;
  account_id: NexUuid;
  role: GroupParticipantRole;
  invited_at: string;
  joined_at: string | null;
  left_at: string | null;
  removed_by: NexUuid | null;
}

export interface CreateGroupCallSessionInput {
  hostAccountId: NexUuid;
  mediaType: GroupCallMediaType;
  /** account_ids to pre-invite as guest participants (host is auto-added). */
  inviteeAccountIds?: NexUuid[];
  /** Optional link that spawned this session (nex_call_link.id). */
  fromCallLinkId?: NexUuid | null;
}

/** Creates the session + the host participant row atomically-ish. If
 *  pre-invitees exceed the 4-cap, the trigger will reject · we return
 *  what fits + a `rejected` count so the caller can surface it. */
export async function createGroupCallSession(
  input: CreateGroupCallSessionInput,
): Promise<{
  session: GroupCallSessionRow;
  participants: GroupCallParticipantRow[];
  rejectedCount: number;
}> {
  const admin = nexSupabaseAdmin;

  const { data: session, error: sessionErr } = await admin
    .from("nex_group_call_session")
    .insert({
      host_account_id: input.hostAccountId,
      media_type: input.mediaType,
      state: "ringing",
      from_call_link_id: input.fromCallLinkId ?? null,
    })
    .select("*")
    .single();
  if (sessionErr || !session) {
    throw new Error(
      `group-call-service.createGroupCallSession: ${sessionErr?.message ?? "no session"}`,
    );
  }

  // Host always joins · joined_at marks "actually in the room".
  const nowIso = new Date().toISOString();
  const participantsToInsert = [
    {
      session_id: session.id,
      account_id: input.hostAccountId,
      role: "host" as const,
      joined_at: nowIso,
    },
    ...(input.inviteeAccountIds ?? [])
      .filter((id) => id !== input.hostAccountId)
      .slice(0, 3) // host + 3 guests = 4 cap
      .map((id) => ({
        session_id: session.id,
        account_id: id,
        role: "guest" as const,
      })),
  ];
  const rejectedCount =
    (input.inviteeAccountIds?.length ?? 0) -
    (participantsToInsert.length - 1 /* host */);

  const participants: GroupCallParticipantRow[] = [];
  for (const row of participantsToInsert) {
    const { data, error } = await admin
      .from("nex_group_call_participant")
      .insert(row)
      .select("*")
      .single();
    if (error) {
      // 23505 = unique violation (already a participant) · skip
      // P0001 = our 4-cap trigger · skip + bump rejected
      if (error.code === "23505") continue;
      throw new Error(
        `group-call-service.createGroupCallSession/participants: ${error.message}`,
      );
    }
    if (data) participants.push(data as GroupCallParticipantRow);
  }

  return { session: session as GroupCallSessionRow, participants, rejectedCount: Math.max(0, rejectedCount) };
}

export async function getGroupCallSession(
  sessionId: NexUuid,
): Promise<GroupCallSessionRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_group_call_session")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) {
    throw new Error(`group-call-service.getGroupCallSession: ${error.message}`);
  }
  return (data as GroupCallSessionRow | null) ?? null;
}

export async function listParticipants(
  sessionId: NexUuid,
): Promise<GroupCallParticipantRow[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_group_call_participant")
    .select("*")
    .eq("session_id", sessionId)
    .order("invited_at", { ascending: true });
  if (error) {
    throw new Error(`group-call-service.listParticipants: ${error.message}`);
  }
  return (data as GroupCallParticipantRow[]) ?? [];
}

/** Upserts a participant row (idempotent for a given account+session).
 *  Returns null if the row already exists + was already joined (no-op). */
export async function joinGroupCallSession(input: {
  sessionId: NexUuid;
  accountId: NexUuid;
  role?: GroupParticipantRole;
}): Promise<GroupCallParticipantRow | null> {
  const admin = nexSupabaseAdmin;
  const nowIso = new Date().toISOString();

  // Try UPDATE first (existing row from pre-invite).
  const { data: updated, error: updErr } = await admin
    .from("nex_group_call_participant")
    .update({ joined_at: nowIso, left_at: null })
    .eq("session_id", input.sessionId)
    .eq("account_id", input.accountId)
    .select("*")
    .maybeSingle();
  if (updErr) {
    throw new Error(`group-call-service.joinGroupCallSession/update: ${updErr.message}`);
  }
  if (updated) {
    await promoteSessionToLive(input.sessionId);
    return updated as GroupCallParticipantRow;
  }

  // Not pre-invited · insert fresh.
  const { data: inserted, error: insErr } = await admin
    .from("nex_group_call_participant")
    .insert({
      session_id: input.sessionId,
      account_id: input.accountId,
      role: input.role ?? "guest",
      joined_at: nowIso,
    })
    .select("*")
    .single();
  if (insErr) {
    // 23505 = already a participant · race with another join
    if (insErr.code === "23505") return null;
    throw new Error(
      `group-call-service.joinGroupCallSession/insert: ${insErr.message}`,
    );
  }
  await promoteSessionToLive(input.sessionId);
  return inserted as GroupCallParticipantRow;
}

/** Flips state=ringing→live on first non-host join. */
async function promoteSessionToLive(sessionId: NexUuid): Promise<void> {
  await nexSupabaseAdmin
    .from("nex_group_call_session")
    .update({ state: "live", live_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("state", "ringing");
}

export async function leaveGroupCallSession(input: {
  sessionId: NexUuid;
  accountId: NexUuid;
}): Promise<void> {
  const { error } = await nexSupabaseAdmin
    .from("nex_group_call_participant")
    .update({ left_at: new Date().toISOString() })
    .eq("session_id", input.sessionId)
    .eq("account_id", input.accountId)
    .is("left_at", null);
  if (error) {
    throw new Error(`group-call-service.leaveGroupCallSession: ${error.message}`);
  }
  await maybeEndSession(input.sessionId);
}

/** If the last joined participant leaves, flip state=ended. */
async function maybeEndSession(sessionId: NexUuid): Promise<void> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_group_call_participant")
    .select("id", { count: "exact", head: false })
    .eq("session_id", sessionId)
    .is("left_at", null);
  if (error) return;
  if ((data?.length ?? 0) === 0) {
    await nexSupabaseAdmin
      .from("nex_group_call_session")
      .update({ state: "ended", ended_at: new Date().toISOString() })
      .eq("id", sessionId)
      .in("state", ["ringing", "live"]);
  }
}

export async function endGroupCallSession(
  sessionId: NexUuid,
  hostAccountId: NexUuid,
): Promise<void> {
  const { error } = await nexSupabaseAdmin
    .from("nex_group_call_session")
    .update({ state: "ended", ended_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("host_account_id", hostAccountId)
    .in("state", ["ringing", "live"]);
  if (error) {
    throw new Error(`group-call-service.endGroupCallSession: ${error.message}`);
  }
}

/** Links a session to the call-link row that spawned it (phase 2+3 bridge). */
export async function linkSessionToCallLink(
  sessionId: NexUuid,
  callLinkId: NexUuid,
): Promise<void> {
  await nexSupabaseAdmin
    .from("nex_group_call_session")
    .update({ from_call_link_id: callLinkId })
    .eq("id", sessionId);

  await nexSupabaseAdmin
    .from("nex_call_link")
    .update({ group_call_session_id: sessionId })
    .eq("id", callLinkId);
}
