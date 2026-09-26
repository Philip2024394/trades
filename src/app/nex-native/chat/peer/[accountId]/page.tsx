// src/app/nex-native/chat/peer/[accountId]/page.tsx
//
// NEX peer-to-peer chat · Portrait Bloom shell.
// ---------------------------------------------
// Renders friend↔friend conversations using the sealed Portrait Bloom
// design language shared with business chat. The peer's identity
// dominates the visual space (their avatar becomes the environment)
// and messages float over the fade zone.
//
// Refinements included:
//   · portrait breathes on an 8-second loop
//   · one-shot chat-theme ripple when the last inbound is < 15s old
//   · offline desaturation via ?online=0 (until presence Bridge lands)
//
// Backend is Bridge 3 (peer-conversation-service + peer-message-service).

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as accountService from "@/lib/nex-native/account-service";
import * as peerConversationService from "@/lib/nex-native/peer-conversation-service";
import * as peerMessageService from "@/lib/nex-native/peer-message-service";
import { sendPeerMessageAction } from "../../../_actions";
import {
  PortraitBloomShell,
  type PortraitBloomPresenceKind,
} from "../../_portrait-bloom-shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Chat-theme → ripple accent · every friend gets their own colour. */
function chatThemeAccent(theme: string | null | undefined): string {
  switch (theme) {
    case "pink":
      return "#EC4899";
    case "gold":
      return "#F59E0B";
    case "titanium":
      return "#B0B7C3";
    case "night":
      return "#3B82F6";
    case "default":
    default:
      return "#00AFFF";
  }
}

export default async function PeerChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ accountId: string }>;
  searchParams: Promise<{ online?: string }>;
}) {
  const { accountId: peerAccountId } = await params;
  const sp = await searchParams;
  // Presence Bridge isn't built yet · query param toggle for preview.
  const isOffline = sp.online === "0";

  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");
  if (peerAccountId === session.account.id) redirect("/nex-native/chat");

  const peer = await accountService.getAccountById(peerAccountId);
  if (!peer) redirect("/nex-native/chat");

  const profile = await (async () => {
    try {
      const svc = await import("@/lib/nex-native/account-profile-service");
      return await svc.getProfileByAccountId(peer.id);
    } catch {
      return null;
    }
  })();

  const conversation =
    await peerConversationService.getOrCreatePeerConversation(
      session.account.id,
      peer.id,
    );

  const [messages] = await Promise.all([
    peerMessageService.listPeerMessages(conversation.id),
    peerMessageService.markPeerMessagesRead(conversation.id, session.account.id),
  ]);

  const bind = sendPeerMessageAction.bind(null, peer.id);

  const presenceKind: PortraitBloomPresenceKind = isOffline
    ? "offline"
    : "online";
  const presenceLabel = isOffline
    ? "Away · will see later"
    : "NEX · chatting with";

  const bloomMessages = messages.map((m) => ({
    id: m.id,
    body: m.body,
    sent_at: m.sent_at,
    read_at: m.read_at,
    mine: m.sender_account_id === session.account.id,
  }));

  return (
    <PortraitBloomShell
      scope="peer-chat"
      displayName={peer.display_name}
      subtitle={profile?.profession ?? null}
      portraitUrl={profile?.avatar_url ?? null}
      presenceKind={presenceKind}
      presenceLabel={presenceLabel}
      rippleColor={chatThemeAccent(peer.chat_theme)}
      backHref="/nex-native/chat"
      messages={bloomMessages}
      composerAction={bind}
      composerPlaceholder={`Message ${peer.display_name}…`}
      headerTag="NEX Chat"
    />
  );
}
