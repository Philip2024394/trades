"use server";

// Server action: a group-call-link creator opens their own room.
// Creates the group session (if not yet created), writes session_id
// back onto the link row so guests can discover it, and returns the
// sessionId. Idempotent · re-opening returns the existing session.

import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { getCallLinkBySlug } from "@/lib/nex-native/call-link-service";
import {
  createGroupCallSession,
  getGroupCallSession,
  linkSessionToCallLink,
} from "@/lib/nex-native/calls/group-call-service";

export interface OpenGroupLinkResult {
  ok: true;
  sessionId: string;
}

export async function openGroupLinkCallAction(
  slug: string,
): Promise<OpenGroupLinkResult | { ok: false; reason: string }> {
  try {
    const session = await resolveNexAppSessionFromContext();
    if (!session) return { ok: false, reason: "Sign in to open this call." };

    const link = await getCallLinkBySlug(slug);
    if (!link) return { ok: false, reason: "Link not found." };
    if (link.created_by !== session.account.id) {
      return { ok: false, reason: "Only the link creator can open the room." };
    }
    if (link.revoked_at) return { ok: false, reason: "Link was revoked." };
    if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) {
      return { ok: false, reason: "Link has expired." };
    }

    // Idempotent · reuse existing session if present.
    if (link.group_call_session_id) {
      const existing = await getGroupCallSession(link.group_call_session_id);
      if (existing && existing.state !== "ended") {
        return { ok: true, sessionId: existing.id };
      }
    }

    const { session: newSession } = await createGroupCallSession({
      hostAccountId: session.account.id,
      mediaType: link.media_type,
      fromCallLinkId: link.id,
    });
    await linkSessionToCallLink(newSession.id, link.id);
    return { ok: true, sessionId: newSession.id };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}
