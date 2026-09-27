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
import * as friendService from "@/lib/nex-native/friend-service";
import * as peerConversationService from "@/lib/nex-native/peer-conversation-service";
import * as peerMessageService from "@/lib/nex-native/peer-message-service";
import * as chatThemeService from "@/lib/nex-native/chat-theme-service";
import { sendPeerMessageAction } from "../../../_actions";
import {
  PortraitBloomShell,
  type PortraitBloomPresenceKind,
} from "../../_portrait-bloom-shell";
import type {
  HeaderContact,
  PendingInvite,
} from "../../_header-contacts-menu";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Peer's chat theme now resolves via chat-theme-service (Bridge 4 ·
// nex_chat_theme table) so admin-created themes light up on any
// existing peer's chat without a code change. Fallback baked in for
// unknown / inactive rows.

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

  // Header contacts menu · list of accepted friends so the user can
  // hop between peer chats without leaving the chat surface. Best-
  // effort · if any lookup fails we return an empty list rather than
  // block the page render.
  const contacts: HeaderContact[] = await (async () => {
    try {
      const friendIds = await friendService.listFriends(session.account.id);
      const others = friendIds.filter((id) => id !== peer.id);
      // Put the current peer FIRST so it's obvious you're in that
      // chat when the drawer opens · include ALL friends after.
      const orderedIds = [peer.id, ...others];
      const list = await Promise.all(
        orderedIds.map(async (id) => {
          const [acc, profile] = await Promise.all([
            accountService.getAccountById(id),
            (async () => {
              try {
                const svc = await import(
                  "@/lib/nex-native/account-profile-service"
                );
                return await svc.getProfileByAccountId(id);
              } catch {
                return null;
              }
            })(),
          ]);
          if (!acc) return null;
          const professionShort = profile?.profession
            ? profile.profession.split(/[\s·,/-]+/).filter(Boolean)[0] ?? null
            : null;
          return {
            id: acc.id,
            name: acc.display_name,
            profession: professionShort,
            avatarUrl: profile?.avatar_url ?? null,
            href: `/nex-native/chat/peer/${acc.id}`,
            isCurrent: acc.id === peer.id,
          };
        }),
      );
      return list.filter((c): c is HeaderContact => !!c);
    } catch {
      return [];
    }
  })();

  // Pending friend invites the viewer can accept · shown at the top
  // of the header drawer.
  const pendingInvites: PendingInvite[] = await (async () => {
    try {
      const edges = await friendService.listPendingIncoming(session.account.id);
      const rows = await Promise.all(
        edges.map(async (edge) => {
          const otherId =
            edge.a_account_id === session.account.id
              ? edge.b_account_id
              : edge.a_account_id;
          const [acc, profile] = await Promise.all([
            accountService.getAccountById(otherId),
            (async () => {
              try {
                const svc = await import(
                  "@/lib/nex-native/account-profile-service"
                );
                return await svc.getProfileByAccountId(otherId);
              } catch {
                return null;
              }
            })(),
          ]);
          if (!acc) return null;
          const professionShort = profile?.profession
            ? profile.profession.split(/[\s·,/-]+/).filter(Boolean)[0] ?? null
            : null;
          return {
            otherAccountId: acc.id,
            name: acc.display_name,
            avatarUrl: profile?.avatar_url ?? null,
            profession: professionShort,
          };
        }),
      );
      return rows.filter((r): r is PendingInvite => !!r);
    } catch {
      return [];
    }
  })();

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
      rippleColor={await chatThemeService.accentForTheme(peer.chat_theme)}
      backHref="/nex-native/chat"
      messages={bloomMessages}
      composerAction={bind}
      composerPlaceholder={`Message ${peer.display_name}…`}
      headerTag="NEX Chat"
      contacts={contacts}
      pendingInvites={pendingInvites}
    />
  );
}
