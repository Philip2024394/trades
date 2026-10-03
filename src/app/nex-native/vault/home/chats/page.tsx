// src/app/nex-native/vault/home/chats/page.tsx
//
// Vault · Chats & Friends · Stage 3 (sealed vault-build-plan-2026-10-03).
// Lists conversations and friends the viewer has moved to Vault. Header
// copy sealed by D3. The whole-friend view and the per-conversation view
// are both represented so the viewer sees:
//   · a "People" row for each friend they moved whole (D1.b)
//   · a conversation row for each per-conversation move (D1.a) that is
//     NOT redundant with a vaulted-friend row (de-duped)

import Link from "next/link";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as vaultEntryService from "@/lib/nex-native/vault-entry-service";
import * as accountService from "@/lib/nex-native/account-service";
import * as peerMsgService from "@/lib/nex-native/peer-message-service";
import { RoomShell, EmptyState } from "../_room-shell";
import { IconChats } from "../_room-icons";
import { mapChatThemeToDoorwaySlug } from "../_resolve-theme";
import { NEX, GLASS_CHIP } from "../_palette";
import { MoveToVaultAffordance } from "../../_move-to-vault-affordance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function VaultChatsFriendsRoom() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/vault/home/chats");
  }
  const me = session.account.id;
  const themeSlug = mapChatThemeToDoorwaySlug(
    (session.account.chat_theme as string | null) ?? null,
  );

  // Fetch vaulted friends + conversations in parallel.
  const [vaultedFriendIds, vaultedConvs] = await Promise.all([
    vaultEntryService.listVaultedFriendIdsForAccount(me),
    vaultEntryService.listVaultedConversationsForAccount(me),
  ]);

  // Hydrate friend display names.
  const friendRows = await Promise.all(
    vaultedFriendIds.map(async (id) => {
      const acc = await accountService.getAccountById(id);
      return {
        kind: "friend" as const,
        id,
        displayName: acc?.display_name ?? "Unknown contact",
        handle: acc?.nex_handle ?? null,
      };
    }),
  );
  const vaultedFriendSet = new Set(vaultedFriendIds);

  // For each vaulted conversation whose peer is NOT a vaulted friend,
  // hydrate a conversation row. (Conversations whose peer IS a vaulted
  // friend are implicitly represented by the friend row — avoid double
  // listing per D1.b.)
  const conversationRows = await Promise.all(
    vaultedConvs
      .filter((v) => !vaultedFriendSet.has(v.peerAccountId))
      .map(async (v) => {
        const [peer, lastMsg] = await Promise.all([
          accountService.getAccountById(v.peerAccountId),
          peerMsgService.getLastPeerMessageInConversation(v.conversation.id),
        ]);
        return {
          kind: "conversation" as const,
          conversationId: v.conversation.id,
          peerAccountId: v.peerAccountId,
          displayName: peer?.display_name ?? "Unknown contact",
          handle: peer?.nex_handle ?? null,
          lastMessagePreview: previewFor(lastMsg),
          movedAt: v.movedAt,
        };
      }),
  );

  const totalCount = friendRows.length + conversationRows.length;

  return (
    <RoomShell
      title="Vault · Chats & Friends"
      subtitle="Private chats"
      themeSlug={themeSlug}
    >
      {totalCount === 0 ? (
        <EmptyState
          icon={<IconChats />}
          title="No private chats yet"
          message="Chats and friends you move into Vault will appear here. Long-press a chat or a contact card in NEX to move it here. They stay hidden from your main NEX inbox and contacts list until you move them back."
          footnote="Only you see what you've moved here. The other person's view of NEX is unchanged."
        />
      ) : (
        <section
          data-nex-vault-chats-list
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginTop: 8,
          }}
        >
          {friendRows.map((f) => (
            <MoveToVaultAffordance
              key={`friend-${f.id}`}
              mode={{
                kind: "remove-friend",
                friendId: f.id,
                friendName: f.displayName,
              }}
            >
              <Link
                href={`/nex-native/chat/peer/${f.id}`}
                data-nex-vault-chats-row-kind="friend"
                data-nex-vault-chats-row-id={f.id}
                style={rowStyle}
              >
                <span aria-hidden style={avatarStyle}>
                  <IconChats />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={rowTitle}>
                    {f.displayName}
                  </span>
                  <span style={rowBlurb}>
                    {f.handle ?? "Whole friend moved to Vault"}
                  </span>
                </span>
                <PrivateChip />
              </Link>
            </MoveToVaultAffordance>
          ))}
          {conversationRows.map((c) => (
            <MoveToVaultAffordance
              key={`conv-${c.conversationId}`}
              mode={{
                kind: "remove-conversation",
                conversationId: c.conversationId,
                friendName: c.displayName,
              }}
            >
              <Link
                href={`/nex-native/chat/peer/${c.peerAccountId}`}
                data-nex-vault-chats-row-kind="conversation"
                data-nex-vault-chats-row-id={c.conversationId}
                style={rowStyle}
              >
                <span aria-hidden style={avatarStyle}>
                  <IconChats />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={rowTitle}>{c.displayName}</span>
                  <span style={rowBlurb}>
                    {c.lastMessagePreview}
                  </span>
                </span>
                <PrivateChip />
              </Link>
            </MoveToVaultAffordance>
          ))}
        </section>
      )}
    </RoomShell>
  );
}

function PrivateChip() {
  return (
    <span
      aria-label="Private"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 10px",
        borderRadius: 999,
        background: NEX.accentSoft,
        color: NEX.accent,
        border: `1px solid ${NEX.accentStrong}`,
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: "0.14em",
      }}
    >
      <Lock size={11} strokeWidth={2} aria-hidden />
      PRIVATE
    </span>
  );
}

const rowStyle: React.CSSProperties = {
  ...GLASS_CHIP,
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: "14px 16px",
  borderRadius: 18,
  minHeight: 72,
  color: NEX.textPrimary,
};

const avatarStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 999,
  background: NEX.accentSoft,
  color: NEX.accent,
  border: `1px solid ${NEX.accentStrong}`,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const rowTitle: React.CSSProperties = {
  display: "block",
  fontSize: 15,
  fontWeight: 600,
  color: NEX.textPrimary,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const rowBlurb: React.CSSProperties = {
  display: "block",
  marginTop: 2,
  fontSize: 12.5,
  color: NEX.textSecondary,
  lineHeight: 1.35,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

function previewFor(msg: peerMsgService.NexPeerMessageRow | null): string {
  if (!msg) return "No messages yet";
  if (msg.deleted_for_everyone) return "🚫 Message deleted";
  if (msg.encrypted) return "🔒 New message";
  if (msg.attachment_type) {
    switch (msg.attachment_type) {
      case "image":          return "📷 Photo";
      case "video":          return "🎬 Video";
      case "audio":          return "🎤 Voice note";
      case "theme_sticker":  return "🎨 Sticker";
      case "product_share":  return "🛍 Shared a product";
      case "cart_order":     return "🧾 Order";
      case "link_preview":   return msg.link_title ?? msg.link_source_domain ?? "🔗 Link";
      default:               return "📎 Attachment";
    }
  }
  if (msg.body && msg.body.length > 0) {
    const t = msg.body.trim();
    return t.length > 64 ? t.slice(0, 61) + "…" : t;
  }
  return "Message";
}
