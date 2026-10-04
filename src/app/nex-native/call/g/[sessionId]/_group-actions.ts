"use server";

// Server actions scoped to a group-call session · join / leave / end.

import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  endGroupCallSession,
  getGroupCallSession,
  joinGroupCallSession,
  leaveGroupCallSession,
  listParticipants,
} from "@/lib/nex-native/calls/group-call-service";

export async function joinGroupCallAction(sessionId: string): Promise<
  | { ok: true; mediaType: "audio" | "video" }
  | { ok: false; reason: string }
> {
  try {
    const session = await resolveNexAppSessionFromContext();
    if (!session) return { ok: false, reason: "unauthenticated" };
    const row = await getGroupCallSession(sessionId);
    if (!row) return { ok: false, reason: "session not found" };
    if (row.state === "ended") return { ok: false, reason: "session has ended" };
    try {
      await joinGroupCallSession({
        sessionId,
        accountId: session.account.id,
      });
    } catch (e) {
      const msg = (e as Error).message;
      if (/4 participants/i.test(msg) || /P0001/i.test(msg)) {
        return { ok: false, reason: "This call is full (4-person limit)." };
      }
      throw e;
    }
    return { ok: true, mediaType: row.media_type };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}

export async function leaveGroupCallAction(
  sessionId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const session = await resolveNexAppSessionFromContext();
    if (!session) return { ok: false, reason: "unauthenticated" };
    await leaveGroupCallSession({ sessionId, accountId: session.account.id });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}

export async function endGroupCallAction(
  sessionId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const session = await resolveNexAppSessionFromContext();
    if (!session) return { ok: false, reason: "unauthenticated" };
    await endGroupCallSession(sessionId, session.account.id);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}

export async function listGroupParticipantsAction(sessionId: string): Promise<
  Array<{ accountId: string; role: "host" | "guest"; joined: boolean; left: boolean }>
> {
  try {
    const rows = await listParticipants(sessionId);
    return rows.map((r) => ({
      accountId: r.account_id,
      role: r.role,
      joined: !!r.joined_at,
      left: !!r.left_at,
    }));
  } catch {
    return [];
  }
}
