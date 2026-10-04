"use server";

// Server action: validates + atomically consumes a call link seat.
// Returns:
//   · 1:1 link (max_uses=1)   → kind:"1:1" with creatorId + media
//   · Group link (max_uses>1) → kind:"group" with sessionId · if the
//     session doesn't exist yet, we return kind:"group-waiting" so
//     the lobby can show "waiting for host".

import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { consumeCallLink, resolveCallLink } from "@/lib/nex-native/call-link-service";
import {
  joinGroupCallSession,
} from "@/lib/nex-native/calls/group-call-service";

export type ConsumeResult =
  | {
      ok: true;
      kind: "1:1";
      mediaType: "audio" | "video";
      creatorId: string;
    }
  | {
      ok: true;
      kind: "group";
      sessionId: string;
      mediaType: "audio" | "video";
    }
  | {
      ok: true;
      kind: "group-waiting";
      creatorId: string;
      mediaType: "audio" | "video";
    };

export async function consumeCallLinkAction(
  slug: string,
): Promise<ConsumeResult | { ok: false; reason: string }> {
  try {
    const session = await resolveNexAppSessionFromContext();
    if (!session) return { ok: false, reason: "Sign in to join a call." };
    const status = await resolveCallLink(slug);
    if (status.kind !== "ok") {
      switch (status.kind) {
        case "not-found": return { ok: false, reason: "Link not found." };
        case "revoked":   return { ok: false, reason: "Link was revoked." };
        case "expired":   return { ok: false, reason: "Link has expired." };
        case "used-up":   return { ok: false, reason: "Link has been fully used." };
      }
    }
    const row = status.row;
    const isGroup = row.max_uses > 1;
    const isSelf = row.created_by === session.account.id;

    if (!isGroup) {
      // 1:1 path · creator "joining" their own link is a no-op success.
      if (isSelf) {
        return {
          ok: true,
          kind: "1:1",
          mediaType: row.media_type,
          creatorId: row.created_by,
        };
      }
      const consumed = await consumeCallLink(slug);
      if (!consumed) {
        return { ok: false, reason: "Someone else just took the last seat." };
      }
      return {
        ok: true,
        kind: "1:1",
        mediaType: consumed.media_type,
        creatorId: consumed.created_by,
      };
    }

    // Group path.
    if (!row.group_call_session_id) {
      // Host hasn't opened the room yet · guests wait.
      if (isSelf) {
        return {
          ok: false,
          reason: "Open the room from the lobby to start this call.",
        };
      }
      return {
        ok: true,
        kind: "group-waiting",
        creatorId: row.created_by,
        mediaType: row.media_type,
      };
    }

    // Session already exists · consume + join as participant.
    if (!isSelf) {
      const consumed = await consumeCallLink(slug);
      if (!consumed) {
        return { ok: false, reason: "No seats left on this link." };
      }
      try {
        await joinGroupCallSession({
          sessionId: row.group_call_session_id,
          accountId: session.account.id,
        });
      } catch (e) {
        const msg = (e as Error).message;
        if (/4 participants/i.test(msg) || /P0001/i.test(msg)) {
          return { ok: false, reason: "This call is full (4-person limit)." };
        }
        throw e;
      }
    }
    return {
      ok: true,
      kind: "group",
      sessionId: row.group_call_session_id,
      mediaType: row.media_type,
    };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}
