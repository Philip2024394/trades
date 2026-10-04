// src/lib/nex-native/call-log-service.ts
//
// Backs the /nex-native/calls hub's "Recent calls" section + the
// per-call insert hook on the peer-chat call launcher. Each viewer
// owns their own call-history rows (migration 131, owner-scoped
// RLS); a 1:1 call between A and B produces two rows, one per party.

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import type { NexUuid } from "./types";

export type CallLogDirection = "incoming" | "outgoing";
export type CallLogMediaType = "audio" | "video";
export type CallLogOutcome =
  | "completed"
  | "missed"
  | "declined"
  | "failed";

export type CallLogFilter =
  | "missed"
  | "incoming"
  | "outgoing"
  | "voice"
  | "video";

export interface CallLogRow {
  id: NexUuid;
  account_id: NexUuid;
  peer_account_id: NexUuid;
  conversation_id: NexUuid | null;
  direction: CallLogDirection;
  media_type: CallLogMediaType;
  outcome: CallLogOutcome;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  created_at: string;
}

export interface LogCallInput {
  accountId: NexUuid;
  peerAccountId: NexUuid;
  conversationId?: NexUuid | null;
  direction: CallLogDirection;
  mediaType: CallLogMediaType;
  outcome: CallLogOutcome;
  startedAt?: string;
  endedAt?: string | null;
  durationSeconds?: number | null;
}

/** Insert one call-log row for the given viewer. Idempotency is NOT
 *  guaranteed · callers (the call launcher onEnded hook) should fire
 *  this exactly once per call lifecycle. */
export async function logCallEvent(input: LogCallInput): Promise<CallLogRow> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_call_log")
    .insert({
      account_id: input.accountId,
      peer_account_id: input.peerAccountId,
      conversation_id: input.conversationId ?? null,
      direction: input.direction,
      media_type: input.mediaType,
      outcome: input.outcome,
      started_at: input.startedAt ?? new Date().toISOString(),
      ended_at: input.endedAt ?? null,
      duration_seconds: input.durationSeconds ?? null,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `call-log-service.logCallEvent: ${error?.message ?? "no row"}`,
    );
  }
  return data as CallLogRow;
}

export interface ListRecentOptions {
  filter?: CallLogFilter | null;
  limit?: number;
}

/** List this viewer's most recent call rows, newest first. Applies
 *  the given filter server-side when supplied. */
export async function listRecentCallsForAccount(
  accountId: NexUuid,
  options: ListRecentOptions = {},
): Promise<CallLogRow[]> {
  let q = nexSupabaseAdmin
    .from("nex_call_log")
    .select("*")
    .eq("account_id", accountId);

  if (options.filter) {
    switch (options.filter) {
      case "missed":
        q = q.eq("outcome", "missed");
        break;
      case "incoming":
        q = q.eq("direction", "incoming");
        break;
      case "outgoing":
        q = q.eq("direction", "outgoing");
        break;
      case "voice":
        q = q.eq("media_type", "audio");
        break;
      case "video":
        q = q.eq("media_type", "video");
        break;
    }
  }

  const { data, error } = await q
    .order("started_at", { ascending: false })
    .limit(options.limit ?? 50);
  if (error) {
    throw new Error(
      `call-log-service.listRecentCallsForAccount: ${error.message}`,
    );
  }
  return (data as CallLogRow[]) ?? [];
}
