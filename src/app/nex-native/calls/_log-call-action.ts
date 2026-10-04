"use server";

// src/app/nex-native/calls/_log-call-action.ts
//
// Thin server action around call-log-service.logCallEvent. Called by
// the client-side _call-launcher on PeerCall.onEnded. Resolves the
// viewer via session cookies and rejects if that doesn't match the
// account_id the client claims (no cross-account writes).

import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  logCallEvent,
  type CallLogDirection,
  type CallLogMediaType,
  type CallLogOutcome,
} from "@/lib/nex-native/call-log-service";

export interface LogCallArgs {
  peerAccountId: string;
  conversationId: string | null;
  direction: CallLogDirection;
  mediaType: CallLogMediaType;
  outcome: CallLogOutcome;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
}

export async function logCallAction(
  args: LogCallArgs,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const session = await resolveNexAppSessionFromContext();
    if (!session) return { ok: false, reason: "unauthenticated" };
    await logCallEvent({
      accountId: session.account.id,
      peerAccountId: args.peerAccountId,
      conversationId: args.conversationId,
      direction: args.direction,
      mediaType: args.mediaType,
      outcome: args.outcome,
      startedAt: args.startedAt,
      endedAt: args.endedAt,
      durationSeconds: args.durationSeconds,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}
