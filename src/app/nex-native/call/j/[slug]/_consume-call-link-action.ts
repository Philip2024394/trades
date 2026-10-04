"use server";

// Server action: validates + atomically consumes a call link seat.
// Session-scoped. Returns ok with the link's media kind, or an
// error reason the lobby can surface.

import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { consumeCallLink, resolveCallLink } from "@/lib/nex-native/call-link-service";

export interface ConsumeResult {
  ok: true;
  mediaType: "audio" | "video";
  creatorId: string;
}

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
    if (status.row.created_by === session.account.id) {
      // Creator "joins" their own link · just no-op success so the
      // lobby's redirect lands them on /calls.
      return {
        ok: true,
        mediaType: status.row.media_type,
        creatorId: status.row.created_by,
      };
    }
    const consumed = await consumeCallLink(slug);
    if (!consumed) {
      return { ok: false, reason: "Someone else just took the last seat." };
    }
    return {
      ok: true,
      mediaType: consumed.media_type,
      creatorId: consumed.created_by,
    };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}
