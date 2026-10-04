"use server";

// Server action: host-only · creates a group-call session and
// (optionally) pre-invites a list of account_ids. Returns the
// sessionId so the client can navigate to /call/g/{sessionId}.

import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  createGroupCallSession,
  type GroupCallMediaType,
} from "@/lib/nex-native/calls/group-call-service";

export interface StartGroupCallArgs {
  mediaType: GroupCallMediaType;
  inviteeAccountIds?: string[];
}

export interface StartGroupCallResult {
  ok: true;
  sessionId: string;
  mediaType: GroupCallMediaType;
  participantCount: number;
  rejectedCount: number;
}

export async function startGroupCallAction(
  args: StartGroupCallArgs,
): Promise<StartGroupCallResult | { ok: false; reason: string }> {
  try {
    const session = await resolveNexAppSessionFromContext();
    if (!session) return { ok: false, reason: "unauthenticated" };
    const result = await createGroupCallSession({
      hostAccountId: session.account.id,
      mediaType: args.mediaType,
      inviteeAccountIds: args.inviteeAccountIds ?? [],
    });
    return {
      ok: true,
      sessionId: result.session.id,
      mediaType: result.session.media_type,
      participantCount: result.participants.length,
      rejectedCount: result.rejectedCount,
    };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}
