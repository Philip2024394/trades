// src/app/nex-native/chat/peer/[accountId]/page.tsx
//
// NEX Friend Chat · Bridge 3 · pixel-accurate mobile UI.
// ------------------------------------------------------
// Server Component. Uses the existing Bridge 3 backend
// (peer-conversation-service + peer-message-service + Server Action).
//
// Layout stack (top → bottom):
//   1. Custom header · back + 88px avatar + name + profession + 3 actions
//   2. NEX Friend Introduction panel (identity → relationship affordance)
//   3. Today divider pill
//   4. Message list · incoming (dark glass) + outgoing (blue→purple grad)
//   5. Typing bubble (spec calls for the "Maria is typing" state after
//      the last inbound message)
//   6. Composer footer · attach + input pill + gradient send
//   7. Atmospheric background · subtle blurred blue/orange/purple curves
//
// All colours + geometry come from the pixel-accurate reference. See
// the client-supplied brief 2026-09-27.

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as accountService from "@/lib/nex-native/account-service";
import * as peerConversationService from "@/lib/nex-native/peer-conversation-service";
import * as peerMessageService from "@/lib/nex-native/peer-message-service";
import { sendPeerMessageAction } from "../../../_actions";
import { PeerComposer } from "./_composer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "#020914",
  bgMid: "#03101D",
  glassSurface: "rgba(5,20,36,0.72)",
  glassHeader: "rgba(8,28,48,0.72)",
  cyan: "#009FEF",
  cyanElectric: "#168BFF",
  cyanDeep: "#063B67",
  cyanBorder: "rgba(0,159,239,0.38)",
  cyanBorderSoft: "rgba(0,159,239,0.22)",
  cyanBorderVerySoft: "rgba(0,159,239,0.16)",
  orange: "#FF7800",
  orangeWarm: "#FF9A2F",
  white: "#F7FAFF",
  textPrimary: "#F4F7FC",
  textSecondary: "#8BA9D1",
  textMuted: "#526B89",
  onlineGreen: "#16D66B",
  incomingBubble: "#0C2239",
  incomingText: "#F2F7FD",
  incomingTimestamp: "#6F8EAF",
  outgoingText: "#FFFFFF",
  readCheck: "#C4E5FF",
  introSecondary: "#82A9D4",
  todayPillBg: "rgba(8,39,68,0.70)",
  todayPillText: "#4CAEFF",
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.charAt(0) ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function PeerChatPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId: peerAccountId } = await params;

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

  // Group messages by day for the "Today" divider · this page shows
  // only "Today" for now (single-day chat is the common case). A future
  // slice can add per-day dividers ("Yesterday", "Monday", etc.).
  const messagesToday = messages;

  // Typing indicator: shown after the last incoming message if the
  // most recent message was from the peer. Real Realtime typing wiring
  // is deferred to the presence Bridge; this is the visual state only.
  const lastMessage = messagesToday[messagesToday.length - 1];
  const showTyping =
    !!lastMessage && lastMessage.sender_account_id === peer.id;

  return (
    <>
      <style>{`
        html, body { background: ${NEX.bg} !important; }
        @keyframes nex-typing-dot {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
          30%           { opacity: 1;   transform: translateY(-3px); }
        }
        @keyframes nex-message-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes nex-online-breathe {
          0%, 100% { box-shadow: 0 0 0 0 rgba(22,214,107,0.55); }
          50%      { box-shadow: 0 0 0 4px rgba(22,214,107,0.0); }
        }
        [data-nex-msg] {
          animation: nex-message-in 220ms cubic-bezier(.2,.7,.2,1) both;
        }
        [data-nex-header-action]:active {
          transform: scale(0.94);
          transition: transform 120ms ease;
        }
      `}</style>
      <main
        style={{
          minHeight: "100dvh",
          position: "relative",
          background: `linear-gradient(180deg, ${NEX.bg} 0%, ${NEX.bgMid} 40%, ${NEX.bg} 100%)`,
          color: NEX.textPrimary,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <AtmosphereBackdrop />

        <Header
          peerId={peer.id}
          displayName={peer.display_name}
          profession={profile?.profession ?? null}
          avatarUrl={profile?.avatar_url ?? null}
        />

        <section
          data-nex-peer-message-list
          style={{
            flex: 1,
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain",
            padding: "10px 18px 24px",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div style={{ maxWidth: 480, margin: "0 auto" }}>
            <IntroPanel />

            <TodayDivider />

            {messagesToday.length === 0 ? (
              <EmptyState displayName={peer.display_name} />
            ) : (
              <MessageList
                messages={messagesToday}
                myAccountId={session.account.id}
                peerAvatarUrl={profile?.avatar_url ?? null}
                peerName={peer.display_name}
                showTyping={showTyping}
              />
            )}
          </div>
        </section>

        <ComposerFooter placeholder={`Message ${peer.display_name}…`} action={bind} />
      </main>
    </>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

interface HeaderProps {
  peerId: string;
  displayName: string;
  profession: string | null;
  avatarUrl: string | null;
}

function Header({ peerId: _peerId, displayName, profession, avatarUrl }: HeaderProps) {
  void _peerId; // reserved for future presence lookup
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        padding:
          "calc(env(safe-area-inset-top, 0) + 14px) 16px 18px",
        background:
          "linear-gradient(180deg, rgba(2,9,20,0.92) 0%, rgba(2,9,20,0.62) 80%, rgba(2,9,20,0.0) 100%)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
      }}
    >
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Link
            href="/nex-native/chat"
            aria-label="Back to friends"
            data-nex-header-action
            style={{
              flexShrink: 0,
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: NEX.glassHeader,
              border: `1px solid ${NEX.cyanBorderSoft}`,
              color: NEX.textPrimary,
              display: "grid",
              placeItems: "center",
              textDecoration: "none",
              transition: "transform 140ms ease",
            }}
          >
            <svg
              width={24}
              height={24}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.9}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>

          {/* Avatar · 68px in this compact header row (spec's 88px
              reserved for a future expanded profile state). Online
              indicator dot lives at the bottom-right of the avatar. */}
          <div
            style={{
              flexShrink: 0,
              position: "relative",
              width: 68,
              height: 68,
            }}
          >
            <div
              aria-hidden
              style={{
                width: 68,
                height: 68,
                borderRadius: "50%",
                border: `1.5px solid ${NEX.cyan}`,
                boxShadow: `0 0 14px rgba(0,159,239,0.18)`,
                overflow: "hidden",
                background: NEX.cyanDeep,
              }}
            >
              {avatarUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={avatarUrl}
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "grid",
                    placeItems: "center",
                    color: NEX.cyan,
                    fontSize: 22,
                    fontWeight: 600,
                    letterSpacing: "0.05em",
                  }}
                >
                  {initialsFromName(displayName)}
                </div>
              )}
            </div>
            <span
              aria-label="Online"
              style={{
                position: "absolute",
                right: -1,
                bottom: -1,
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: NEX.onlineGreen,
                border: `2px solid ${NEX.bg}`,
                animation: "nex-online-breathe 3s ease-in-out infinite",
              }}
            />
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: 20,
                fontWeight: 650,
                lineHeight: 1.15,
                color: NEX.white,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                letterSpacing: "-0.005em",
              }}
            >
              {displayName}
            </div>
            <div
              style={{
                marginTop: 3,
                fontSize: 13,
                color: NEX.textSecondary,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span
                aria-hidden
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: NEX.onlineGreen,
                  boxShadow: "0 0 0 2px rgba(22,214,107,0.15)",
                  animation: "nex-online-breathe 3s ease-in-out infinite",
                }}
              />
              Online
              {profession && (
                <>
                  <span style={{ color: NEX.textMuted }}>·</span>
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {profession}
                  </span>
                </>
              )}
            </div>
          </div>

          <HeaderActions />
        </div>
      </div>
    </header>
  );
}

function HeaderActions() {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        flexShrink: 0,
      }}
    >
      <HeaderIconButton label="Voice call" icon={<IconPhone />} />
      <HeaderIconButton label="Video call" icon={<IconVideo />} />
      <HeaderIconButton label="More" icon={<IconMore />} />
    </div>
  );
}

function HeaderIconButton({
  label,
  icon,
}: {
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={`${label} · coming soon`}
      data-nex-header-action
      style={{
        width: 40,
        height: 40,
        borderRadius: "50%",
        background: NEX.glassHeader,
        border: `1px solid ${NEX.cyanBorderSoft}`,
        color: NEX.textPrimary,
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
        padding: 0,
        transition: "transform 140ms ease",
      }}
    >
      {icon}
    </button>
  );
}

function IconPhone() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0122 16.92z" />
    </svg>
  );
}

function IconVideo() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function IconMore() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// NEX Friend Introduction panel
// ---------------------------------------------------------------------------

function IntroPanel() {
  return (
    <div
      role="note"
      aria-label="You're chatting with a friend"
      style={{
        margin: "6px 4px 18px",
        padding: "14px 18px",
        minHeight: 82,
        borderRadius: 24,
        background:
          "linear-gradient(135deg, rgba(6,20,34,0.65) 0%, rgba(4,14,26,0.7) 100%)",
        // Blue → orange gradient border via a masked linear gradient.
        border: `1px solid transparent`,
        backgroundClip: "padding-box, border-box",
        backgroundOrigin: "padding-box, border-box",
        backgroundImage: `linear-gradient(135deg, rgba(6,20,34,0.65) 0%, rgba(4,14,26,0.7) 100%),
                          linear-gradient(120deg, rgba(0,159,239,0.55) 0%, rgba(0,159,239,0.15) 55%, rgba(255,120,0,0.5) 100%)`,
        display: "flex",
        alignItems: "center",
        gap: 14,
        boxShadow: "0 6px 24px rgba(0,0,0,0.35)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden
        style={{
          flexShrink: 0,
          width: 40,
          height: 40,
          borderRadius: "50%",
          background:
            "radial-gradient(circle at 30% 30%, rgba(0,159,239,0.35), rgba(0,159,239,0.05) 65%, transparent 80%)",
          display: "grid",
          placeItems: "center",
          color: NEX.cyan,
        }}
      >
        <SparkleIcon />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: NEX.white,
            lineHeight: 1.25,
          }}
        >
          You&rsquo;re chatting with a friend
        </div>
        <div
          style={{
            marginTop: 2,
            fontSize: 12,
            color: NEX.introSecondary,
            lineHeight: 1.35,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          Share ideas, get feedback, or just say hi!
        </div>
      </div>
      <FlowingLinesIcon />
    </div>
  );
}

function SparkleIcon() {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6" />
      <circle cx="12" cy="12" r="2" fill="currentColor" opacity={0.85} />
    </svg>
  );
}

function FlowingLinesIcon() {
  return (
    <svg
      width={54}
      height={44}
      viewBox="0 0 54 44"
      aria-hidden
      style={{ flexShrink: 0, opacity: 0.75 }}
    >
      <defs>
        <linearGradient id="nex-intro-flow" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#009FEF" />
          <stop offset="55%" stopColor="#4657FF" />
          <stop offset="100%" stopColor="#FF7A00" />
        </linearGradient>
      </defs>
      <path
        d="M2 30 Q10 8, 22 22 T42 20 T52 12"
        stroke="url(#nex-intro-flow)"
        strokeWidth={1.6}
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M2 38 Q12 22, 24 32 T44 30 T52 24"
        stroke="url(#nex-intro-flow)"
        strokeWidth={1.2}
        fill="none"
        strokeLinecap="round"
        opacity={0.6}
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Today divider
// ---------------------------------------------------------------------------

function TodayDivider() {
  return (
    <div
      role="separator"
      style={{
        display: "flex",
        justifyContent: "center",
        margin: "6px 0 14px",
      }}
    >
      <span
        style={{
          padding: "8px 20px",
          minWidth: 100,
          textAlign: "center",
          background: NEX.todayPillBg,
          color: NEX.todayPillText,
          fontSize: 13,
          fontWeight: 600,
          borderRadius: 999,
          letterSpacing: "0.02em",
        }}
      >
        Today
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Message list
// ---------------------------------------------------------------------------

interface MessageListProps {
  messages: {
    id: string;
    sender_account_id: string;
    body: string;
    sent_at: string;
    read_at: string | null;
  }[];
  myAccountId: string;
  peerAvatarUrl: string | null;
  peerName: string;
  showTyping: boolean;
}

function MessageList(props: MessageListProps) {
  return (
    <ul
      style={{
        listStyle: "none",
        padding: 0,
        margin: 0,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      {props.messages.map((m, idx) => {
        const mine = m.sender_account_id === props.myAccountId;
        const prev = props.messages[idx - 1];
        const groupStart = !prev || prev.sender_account_id !== m.sender_account_id;
        return (
          <li
            key={m.id}
            data-nex-msg
            data-nex-msg-mine={mine ? "true" : undefined}
            style={{
              display: "flex",
              justifyContent: mine ? "flex-end" : "flex-start",
              alignItems: "flex-end",
              gap: 10,
              marginTop: groupStart ? 16 : 4,
            }}
          >
            {!mine &&
              (groupStart ? (
                <PeerAvatar
                  avatarUrl={props.peerAvatarUrl}
                  peerName={props.peerName}
                />
              ) : (
                <div style={{ width: 40, flexShrink: 0 }} aria-hidden />
              ))}

            {mine ? (
              <OutgoingBubble body={m.body} sentAt={m.sent_at} read={!!m.read_at} />
            ) : (
              <IncomingBubble body={m.body} sentAt={m.sent_at} />
            )}
          </li>
        );
      })}
      {props.showTyping && (
        <li
          style={{
            display: "flex",
            justifyContent: "flex-start",
            alignItems: "flex-end",
            gap: 10,
            marginTop: 10,
          }}
        >
          <PeerAvatar
            avatarUrl={props.peerAvatarUrl}
            peerName={props.peerName}
          />
          <TypingBubble />
        </li>
      )}
    </ul>
  );
}

function PeerAvatar({
  avatarUrl,
  peerName,
}: {
  avatarUrl: string | null;
  peerName: string;
}) {
  return (
    <div
      aria-hidden
      style={{
        flexShrink: 0,
        width: 40,
        height: 40,
        borderRadius: "50%",
        border: `1px solid ${NEX.cyanBorderVerySoft}`,
        overflow: "hidden",
        background: NEX.cyanDeep,
      }}
    >
      {avatarUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={avatarUrl}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "grid",
            placeItems: "center",
            color: NEX.cyan,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {initialsFromName(peerName)}
        </div>
      )}
    </div>
  );
}

function IncomingBubble({ body, sentAt }: { body: string; sentAt: string }) {
  return (
    <div
      data-nex-incoming
      style={{
        maxWidth: "73%",
        padding: "10px 14px 8px",
        background: "linear-gradient(145deg, #102B46 0%, #0A1D31 100%)",
        border: `1px solid rgba(105,170,220,0.08)`,
        borderRadius: "20px 20px 20px 6px",
        color: NEX.incomingText,
        fontSize: 15,
        lineHeight: 1.45,
        boxShadow: "0 4px 14px rgba(0,0,0,0.22)",
      }}
    >
      <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {body}
      </div>
      <div
        style={{
          marginTop: 3,
          fontSize: 10,
          color: NEX.incomingTimestamp,
          textAlign: "right",
          letterSpacing: "0.02em",
        }}
      >
        {formatTime(sentAt)}
      </div>
    </div>
  );
}

function OutgoingBubble({
  body,
  sentAt,
  read,
}: {
  body: string;
  sentAt: string;
  read: boolean;
}) {
  return (
    <div
      data-nex-outgoing
      style={{
        maxWidth: "72%",
        padding: "10px 14px 8px",
        background: "linear-gradient(120deg, #087FFF 0%, #6945F5 100%)",
        borderRadius: "20px 20px 6px 20px",
        color: NEX.outgoingText,
        fontSize: 15,
        lineHeight: 1.45,
        boxShadow: "0 4px 18px rgba(8,127,255,0.28)",
      }}
    >
      <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {body}
      </div>
      <div
        style={{
          marginTop: 3,
          fontSize: 10,
          textAlign: "right",
          letterSpacing: "0.02em",
          color: "rgba(255,255,255,0.75)",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 5,
        }}
      >
        <span>{formatTime(sentAt)}</span>
        <span
          style={{ color: read ? NEX.readCheck : "rgba(255,255,255,0.55)" }}
          aria-label={read ? "read" : "sent"}
        >
          <ReadCheckIcon double={read} />
        </span>
      </div>
    </div>
  );
}

function ReadCheckIcon({ double }: { double: boolean }) {
  if (double) {
    return (
      <svg width={16} height={12} viewBox="0 0 24 16" fill="none" aria-hidden>
        <path
          d="M1 8 L6 13 L14 3"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M9 8 L14 13 L23 3"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg width={12} height={12} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M1 8 L6 13 L15 3"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TypingBubble() {
  return (
    <div
      role="status"
      aria-label="typing"
      style={{
        padding: "12px 16px",
        background: "linear-gradient(145deg, #102B46 0%, #0A1D31 100%)",
        border: `1px solid rgba(105,170,220,0.08)`,
        borderRadius: "20px 20px 20px 6px",
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        boxShadow: "0 4px 14px rgba(0,0,0,0.22)",
      }}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          aria-hidden
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: NEX.cyan,
            animation: "nex-typing-dot 1.2s ease-in-out infinite",
            animationDelay: `${i * 0.16}s`,
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ displayName }: { displayName: string }) {
  return (
    <div
      style={{
        margin: "38px auto 0",
        maxWidth: 300,
        textAlign: "center",
        padding: "18px 12px",
        color: NEX.textSecondary,
      }}
    >
      <div style={{ fontSize: 26, marginBottom: 8 }}>👋</div>
      <div style={{ fontSize: 14, color: NEX.textPrimary, marginBottom: 6 }}>
        Start your NEX chat with {displayName}
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.55 }}>
        Every message persists on NEX. Say hi.
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composer footer
// ---------------------------------------------------------------------------

function ComposerFooter({
  action,
  placeholder,
}: {
  action: (formData: FormData) => Promise<never> | void | Promise<void>;
  placeholder: string;
}) {
  return (
    <div
      data-nex-composer-footer
      style={{
        position: "sticky",
        bottom: 0,
        zIndex: 20,
        padding:
          "12px 16px calc(env(safe-area-inset-bottom, 0) + 14px)",
        background:
          "linear-gradient(180deg, rgba(2,9,20,0.0) 0%, rgba(2,9,20,0.72) 30%, rgba(2,9,20,0.92) 100%)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderTop: `1px solid ${NEX.cyanBorderVerySoft}`,
      }}
    >
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <PeerComposer action={action} placeholder={placeholder} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Atmospheric backdrop · subtle blurred curves in the lower half.
// ---------------------------------------------------------------------------

function AtmosphereBackdrop() {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 0,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "-15%",
          bottom: "20%",
          width: 320,
          height: 320,
          borderRadius: "50%",
          background: "rgba(0,130,255,0.10)",
          filter: "blur(52px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: "-10%",
          bottom: "8%",
          width: 260,
          height: 260,
          borderRadius: "50%",
          background: "rgba(255,120,0,0.08)",
          filter: "blur(60px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "20%",
          bottom: "-8%",
          width: 300,
          height: 300,
          borderRadius: "50%",
          background: "rgba(100,60,255,0.08)",
          filter: "blur(72px)",
        }}
      />
    </div>
  );
}
