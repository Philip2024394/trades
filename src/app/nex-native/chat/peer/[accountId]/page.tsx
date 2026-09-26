// src/app/nex-native/chat/peer/[accountId]/page.tsx
//
// Bridge 3 · peer-to-peer chat surface.
// --------------------------------------
// This page renders the message thread between the signed-in account
// and a peer (another account). Loads the peer's identity + presence
// hints, gets-or-creates the peer conversation, lists messages, marks
// inbound messages read, and posts new messages via a Server Action.
//
// Reachable from the Friends tab on /nex-native/chat (each friend card
// links here). Sealed 2026-09-27.

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as accountService from "@/lib/nex-native/account-service";
import * as peerConversationService from "@/lib/nex-native/peer-conversation-service";
import * as peerMessageService from "@/lib/nex-native/peer-message-service";
import { sendPeerMessageAction } from "../../../_actions";
import { SubmitButton } from "../../../_submit-button";
import { NexPageHeader } from "../../../_page-header";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "#020914",
  panel: "#03101D",
  fieldBg: "#04101F",
  textPrimary: "#F2F5F8",
  textSecondary: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanFaint: "rgba(0, 175, 255, 0.12)",
  orange: "#FF7200",
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.charAt(0) ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

export default async function PeerChatPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId: peerAccountId } = await params;

  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");
  if (peerAccountId === session.account.id) {
    // Self-chat isn't supported · bounce.
    redirect("/nex-native/chat");
  }

  const peer = await accountService.getAccountById(peerAccountId);
  if (!peer) {
    // Unknown account · route back to friends list.
    redirect("/nex-native/chat");
  }

  // Best-effort profile enrichment for avatar + profession.
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

  return (
    <>
      <style>{`html, body { background: ${NEX.bg} !important; }`}</style>
      <main
        style={{
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.textPrimary,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "12px 20px 0",
            position: "sticky",
            top: 0,
            background: NEX.bg,
            zIndex: 10,
          }}
        >
          <div style={{ maxWidth: 640, margin: "0 auto" }}>
            <NexPageHeader dataScope="peer-chat" />
            <PeerIdentityHeader
              displayName={peer.display_name}
              handle={peer.nex_handle}
              avatarUrl={profile?.avatar_url ?? null}
              profession={profile?.profession ?? null}
            />
          </div>
        </div>

        <section
          data-nex-peer-message-list
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "12px 20px 20px",
            maxWidth: 640,
            width: "100%",
            margin: "0 auto",
          }}
        >
          {messages.length === 0 ? (
            <EmptyThread displayName={peer.display_name} />
          ) : (
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {messages.map((m) => {
                const mine = m.sender_account_id === session.account.id;
                return (
                  <li
                    key={m.id}
                    style={{
                      display: "flex",
                      justifyContent: mine ? "flex-end" : "flex-start",
                    }}
                  >
                    <div
                      data-nex-peer-message
                      data-nex-peer-message-mine={mine ? "true" : undefined}
                      style={{
                        maxWidth: "78%",
                        padding: "8px 12px",
                        borderRadius: mine
                          ? "14px 14px 4px 14px"
                          : "14px 14px 14px 4px",
                        background: mine
                          ? "rgba(255, 114, 0, 0.14)"
                          : NEX.panel,
                        border: `1px solid ${
                          mine ? "rgba(255, 114, 0, 0.35)" : NEX.cyanSoft
                        }`,
                        color: NEX.textPrimary,
                        fontSize: 14,
                        lineHeight: 1.45,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      <div>{m.body}</div>
                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 10,
                          color: NEX.textSecondary,
                          letterSpacing: "0.02em",
                          display: "flex",
                          justifyContent: mine ? "flex-end" : "flex-start",
                          gap: 6,
                          alignItems: "center",
                        }}
                      >
                        <span>
                          {new Date(m.sent_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {mine && (
                          <span
                            style={{
                              color: m.read_at ? NEX.cyan : NEX.textSecondary,
                            }}
                            aria-label={m.read_at ? "read" : "sent"}
                          >
                            {m.read_at ? "✓✓" : "✓"}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <form
          action={bind}
          data-nex-peer-composer
          style={{
            position: "sticky",
            bottom: 0,
            background: NEX.bg,
            borderTop: `1px solid ${NEX.cyanFaint}`,
            padding: "10px 20px calc(env(safe-area-inset-bottom, 0) + 10px)",
          }}
        >
          <div
            style={{
              maxWidth: 640,
              margin: "0 auto",
              display: "flex",
              gap: 8,
              alignItems: "flex-end",
            }}
          >
            <textarea
              name="body"
              required
              maxLength={4000}
              placeholder={`Message ${peer.display_name}…`}
              rows={1}
              style={{
                flex: 1,
                minHeight: 44,
                maxHeight: 140,
                padding: "10px 12px",
                background: NEX.fieldBg,
                color: NEX.textPrimary,
                border: `1px solid ${NEX.cyanSoft}`,
                borderRadius: 12,
                fontSize: 14,
                fontFamily: "inherit",
                resize: "none",
                outline: "none",
              }}
            />
            <SubmitButton label="Send" pendingLabel="…" />
          </div>
        </form>
      </main>
    </>
  );
}

interface PeerIdentityHeaderProps {
  displayName: string;
  handle: string | null;
  avatarUrl: string | null;
  profession: string | null;
}

function PeerIdentityHeader(props: PeerIdentityHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 0 14px",
      }}
    >
      <Link
        href="/nex-native/chat"
        aria-label="Back to friends"
        style={{
          color: NEX.textSecondary,
          fontSize: 20,
          textDecoration: "none",
          padding: "4px 8px 4px 0",
          lineHeight: 1,
        }}
      >
        ←
      </Link>
      <div
        aria-hidden
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: NEX.cyanFaint,
          color: NEX.cyan,
          display: "grid",
          placeItems: "center",
          fontSize: 14,
          fontWeight: 600,
          letterSpacing: "0.05em",
          border: `2px solid ${NEX.cyanSoft}`,
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        {props.avatarUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={props.avatarUrl}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          initialsFromName(props.displayName)
        )}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: NEX.textPrimary,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {props.displayName}
        </div>
        <div
          style={{
            marginTop: 2,
            fontSize: 11,
            color: NEX.textSecondary,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {props.profession ? (
            props.profession
          ) : props.handle ? (
            <code style={{ fontFamily: "ui-monospace, monospace" }}>
              {props.handle}
            </code>
          ) : (
            "friend"
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyThread({ displayName }: { displayName: string }) {
  return (
    <div
      style={{
        margin: "48px auto 0",
        maxWidth: 320,
        textAlign: "center",
        padding: "20px 16px",
        color: NEX.textSecondary,
      }}
    >
      <div style={{ fontSize: 28, marginBottom: 10 }}>👋</div>
      <div style={{ fontSize: 14, color: NEX.textPrimary, marginBottom: 6 }}>
        Start your NEX chat with {displayName}
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.6 }}>
        Every message persists on NEX. Say hi.
      </div>
    </div>
  );
}
