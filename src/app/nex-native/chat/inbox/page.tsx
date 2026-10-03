// src/app/nex-native/chat/inbox/page.tsx
//
// NEX Chat Inbox · Destination of the home-page Chat tile.
// -------------------------------------------------------------------------
// The missing "iMessage-style" surface in NEX: a list of the viewer's
// peer conversations sorted by most-recent message, each row showing
// peer identity + last-message preview + timestamp + unread badge.
//
// Doctrine mapping (First Conversation Principle · 2026-09-30):
//   · Signed-in users see their inbox. Empty state is honest:
//     "No conversations yet · tap Contacts to find someone."
//   · Signed-out users bounce to /sign-in · no form rendered here.
//   · Zero-knowledge preserved: when a message is encrypted
//     (Bridge 76 · `encrypted` flag), the preview reads
//     "🔒 New message" · never the ciphertext.
//   · One NEX Identity: surface repaints under the viewer's chat_theme.
//
// Data sources (NEX Supabase, authoritative, no mock):
//   · listPeerConversationsForAccount — ordered by last_message_at desc
//   · getLastPeerMessageInConversation — row-level preview
//   · countUnreadPeerMessages — unread pill per row
//   · getAccountById — hydrate peer display name + handle
//
// Signed-out visitors → /nex-native/sign-in.

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as peerConvService from "@/lib/nex-native/peer-conversation-service";
import * as vaultEntryService from "@/lib/nex-native/vault-entry-service";
import * as peerMsgService from "@/lib/nex-native/peer-message-service";
import * as accountService from "@/lib/nex-native/account-service";
import * as chatThemeService from "@/lib/nex-native/chat-theme-service";
import { NexPageHeader } from "../../_page-header";
import { MoveToVaultAffordance } from "../../vault/_move-to-vault-affordance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "#020914",
  panel: "#03101D",
  textPrimary: "#F2F5F8",
  textSecondary: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  orange: "#FF7200",
};

interface InboxRow {
  conversationId: string;
  peerAccountId: string;
  peerDisplayName: string;
  peerHandle: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string;
  unreadCount: number;
}

/** Zero-knowledge-safe preview: never leaks ciphertext, labels encrypted
 *  rows and attachments by type instead. */
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

function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - then) / 1000));
  if (diffSec < 60) return "now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
  if (diffSec < 7 * 86400) return `${Math.floor(diffSec / 86400)}d`;
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default async function InboxPage() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  // Vault-filtered: conversations the viewer has moved to Vault (either
  // explicitly or by moving the whole friend) are hidden from the main
  // inbox. See docs/doctrine/vault-build-plan-2026-10-03.md D1.
  const [conversations, themes] = await Promise.all([
    vaultEntryService.listMainInboxConversationsForAccount(session.account.id),
    chatThemeService.listActiveThemes().catch(() => []),
  ]);

  // Theme resolution · same pattern as /home · One NEX Identity.
  const rawTheme = (session.account.chat_theme as string | null) ?? null;
  const currentThemeId = rawTheme && rawTheme.length > 0 ? rawTheme : "theme-0";
  const currentTheme = themes.find((t) => t.id === currentThemeId) ?? themes[0] ?? null;
  const themeAccent = currentTheme?.accent_hex ?? NEX.cyan;

  // Build rows in parallel · each row needs peer info + last msg + unread count.
  const rows: InboxRow[] = await Promise.all(
    conversations.map(async (conv): Promise<InboxRow> => {
      const peerId = peerConvService.peerOfConversation(conv, session.account.id);
      if (!peerId) {
        return {
          conversationId: conv.id,
          peerAccountId: "",
          peerDisplayName: "Unknown",
          peerHandle: null,
          lastMessageAt: conv.last_message_at,
          lastMessagePreview: "",
          unreadCount: 0,
        };
      }
      const [peer, lastMsg, unread] = await Promise.all([
        accountService.getAccountById(peerId),
        peerMsgService.getLastPeerMessageInConversation(conv.id),
        peerMsgService.countUnreadPeerMessages(conv.id, session.account.id),
      ]);
      return {
        conversationId: conv.id,
        peerAccountId: peerId,
        peerDisplayName: peer?.display_name ?? "NEX user",
        peerHandle: peer?.nex_handle ?? null,
        lastMessageAt: conv.last_message_at,
        lastMessagePreview: previewFor(lastMsg),
        unreadCount: unread,
      };
    }),
  );

  return (
    <>
      <style>{`html, body { background: ${NEX.bg} !important; } html, body { scrollbar-width: none; -ms-overflow-style: none; } html::-webkit-scrollbar, body::-webkit-scrollbar { width: 0; height: 0; display: none; }`}</style>
      <main
        style={{
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.textPrimary,
          fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          padding: "16px 20px 32px",
          position: "relative",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(60% 40% at 50% 0%, ${themeAccent}22, transparent 72%)`,
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative", maxWidth: 480, margin: "0 auto" }}>
          <NexPageHeader dataScope="chat-inbox" />

          <h1
            style={{
              margin: "22px 0 2px",
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: "-0.02em",
            }}
          >
            Chat
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: NEX.textSecondary,
              letterSpacing: "0.02em",
            }}
          >
            Your conversations · newest first
          </p>

          {rows.length === 0 ? (
            <EmptyState themeAccent={themeAccent} />
          ) : (
            <ul
              style={{
                listStyle: "none",
                margin: "20px 0 0",
                padding: 0,
                display: "grid",
                gap: 8,
              }}
            >
              {rows.map((r) => (
                <li key={r.conversationId}>
                  <MoveToVaultAffordance
                    mode={{
                      kind: "move-conversation",
                      conversationId: r.conversationId,
                      friendName: r.peerDisplayName,
                    }}
                  >
                  <Link
                    href={`/nex-native/chat/peer/${r.peerAccountId}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 14px",
                      borderRadius: 12,
                      background: NEX.panel,
                      border: `1px solid ${r.unreadCount > 0 ? themeAccent : NEX.cyanSoft}55`,
                      textDecoration: "none",
                      color: NEX.textPrimary,
                      boxShadow: r.unreadCount > 0 ? `0 0 0 1px ${themeAccent}22, 0 10px 24px ${themeAccent}10` : "none",
                    }}
                  >
                    {/* Avatar · initials circle in theme accent */}
                    <div
                      aria-hidden
                      style={{
                        flexShrink: 0,
                        width: 44,
                        height: 44,
                        borderRadius: "50%",
                        background: `linear-gradient(145deg, ${themeAccent}55, ${themeAccent}22)`,
                        border: `1px solid ${themeAccent}66`,
                        display: "grid",
                        placeItems: "center",
                        fontSize: 15,
                        fontWeight: 700,
                        color: NEX.textPrimary,
                        letterSpacing: "0.04em",
                      }}
                    >
                      {initialsOf(r.peerDisplayName)}
                    </div>
                    {/* Name + preview column */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "baseline",
                          justifyContent: "space-between",
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: r.unreadCount > 0 ? 700 : 600,
                            color: NEX.textPrimary,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {r.peerDisplayName}
                        </div>
                        <div
                          style={{
                            flexShrink: 0,
                            fontSize: 10,
                            color: r.unreadCount > 0 ? themeAccent : NEX.textSecondary,
                            fontVariantNumeric: "tabular-nums",
                            fontWeight: r.unreadCount > 0 ? 700 : 500,
                          }}
                        >
                          {relativeTime(r.lastMessageAt)}
                        </div>
                      </div>
                      <div
                        style={{
                          marginTop: 2,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            color: r.unreadCount > 0 ? NEX.textPrimary : NEX.textSecondary,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            flex: 1,
                            minWidth: 0,
                          }}
                        >
                          {r.lastMessagePreview}
                        </div>
                        {r.unreadCount > 0 && (
                          <div
                            aria-label={`${r.unreadCount} unread`}
                            style={{
                              flexShrink: 0,
                              minWidth: 20,
                              height: 20,
                              padding: "0 6px",
                              borderRadius: 999,
                              background: themeAccent,
                              color: "#0B0F1A",
                              fontSize: 10,
                              fontWeight: 800,
                              display: "grid",
                              placeItems: "center",
                              fontVariantNumeric: "tabular-nums",
                              lineHeight: 1,
                            }}
                          >
                            {r.unreadCount > 99 ? "99+" : r.unreadCount}
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                  </MoveToVaultAffordance>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || parts[0] === "") return "·";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function EmptyState({ themeAccent }: { themeAccent: string }) {
  return (
    <div
      style={{
        marginTop: 32,
        padding: "28px 20px",
        borderRadius: 14,
        background: NEX.panel,
        border: `1px dashed ${themeAccent}66`,
        textAlign: "center",
      }}
    >
      <div
        aria-hidden
        style={{
          margin: "0 auto 12px",
          width: 54,
          height: 54,
          borderRadius: "50%",
          background: `linear-gradient(145deg, ${themeAccent}44, ${themeAccent}11)`,
          border: `1px solid ${themeAccent}66`,
          display: "grid",
          placeItems: "center",
          fontSize: 24,
        }}
      >
        💬
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: NEX.textPrimary }}>
        No conversations yet
      </div>
      <div style={{ marginTop: 6, fontSize: 12, color: NEX.textSecondary, lineHeight: 1.5 }}>
        Open <Link href="/nex-native/chat" style={{ color: themeAccent, textDecoration: "none", fontWeight: 600 }}>Contacts</Link> to find someone and start a conversation.
      </div>
    </div>
  );
}
