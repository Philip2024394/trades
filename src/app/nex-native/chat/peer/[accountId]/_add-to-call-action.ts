"use server";

// Server action: upgrade an active 1:1 call into a group call by
// inviting another contact. Creates the group session (host = viewer),
// pre-invites both the current peer and the new contact, then sends
// each of them a chat message carrying the join URL so they can
// accept into the group room. Returns the sessionId · the launcher
// hangs up the current 1:1 and routes the viewer there.
//
// This does NOT magically teleport the current peer across signalling
// layers · WebRTC's 1:1 and the group mesh use different channels.
// The honest flow is "end the 1:1, offer everyone the group room."

import { headers } from "next/headers";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { createGroupCallSession } from "@/lib/nex-native/calls/group-call-service";
import { getOrCreatePeerConversation } from "@/lib/nex-native/peer-conversation-service";
import { sendPeerMessage } from "@/lib/nex-native/peer-message-service";
import { getAccountById } from "@/lib/nex-native/account-service";

export interface InviteToGroupCallArgs {
  currentPeerAccountId: string;
  inviteeAccountId: string;
  mediaType: "audio" | "video";
}

export interface InviteToGroupCallResult {
  ok: true;
  sessionId: string;
  joinUrl: string;
  inviteeDisplayName: string;
}

export async function inviteToGroupCallAction(
  args: InviteToGroupCallArgs,
): Promise<InviteToGroupCallResult | { ok: false; reason: string }> {
  try {
    const session = await resolveNexAppSessionFromContext();
    if (!session) return { ok: false, reason: "unauthenticated" };

    if (
      args.inviteeAccountId === session.account.id ||
      args.inviteeAccountId === args.currentPeerAccountId
    ) {
      return { ok: false, reason: "pick a different contact" };
    }

    const [self, currentPeer, invitee] = await Promise.all([
      getAccountById(session.account.id).catch(() => null),
      getAccountById(args.currentPeerAccountId).catch(() => null),
      getAccountById(args.inviteeAccountId).catch(() => null),
    ]);
    if (!invitee) return { ok: false, reason: "contact not found" };

    const { session: groupSession } = await createGroupCallSession({
      hostAccountId: session.account.id,
      mediaType: args.mediaType,
      inviteeAccountIds: [args.currentPeerAccountId, args.inviteeAccountId],
    });

    const h = await headers();
    const host = h.get("host") ?? "localhost:3008";
    const proto = h.get("x-forwarded-proto") ?? "http";
    const joinUrl = `${proto}://${host}/nex-native/call/g/${groupSession.id}`;

    const selfName = self?.display_name ?? "Someone";
    const callKind = args.mediaType === "video" ? "video call" : "voice call";
    const inviteBody = `📞 ${selfName} started a group ${callKind} · tap to join\n${joinUrl}`;

    // Send the invite message into each peer's existing (or new) 1:1
    // conversation with the viewer. Soft-fails so a message hiccup
    // doesn't nuke the whole upgrade · the sessionId is still returned.
    const sendInvite = async (otherId: string): Promise<void> => {
      try {
        const conv = await getOrCreatePeerConversation(session.account.id, otherId);
        await sendPeerMessage({
          conversation_id: conv.id,
          sender_account_id: session.account.id,
          body: inviteBody,
        });
      } catch {
        /* best-effort · viewer still gets routed into the room */
      }
    };
    if (currentPeer) await sendInvite(args.currentPeerAccountId);
    await sendInvite(args.inviteeAccountId);

    return {
      ok: true,
      sessionId: groupSession.id,
      joinUrl,
      inviteeDisplayName: invitee.display_name ?? "Contact",
    };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}
