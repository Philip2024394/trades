// src/app/nex-native/chat/prototypes/portrait-bloom/page.tsx
//
// Live preview · Prototype 01 · Portrait Bloom.
// ---------------------------------------------
// Renders Maria Santos' seeded Bridge 3 conversation at full mobile
// viewport with the Portrait Bloom visual language: her portrait fills
// the top 58% and fades into the abyss below · messages float in the
// darkness · gradient send button and glass composer at the bottom.
//
// Real backend · functional composer · this is a promoted design not
// a mock. The gallery at /nex-native/chat/prototypes links here.

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as accountService from "@/lib/nex-native/account-service";
import * as peerConversationService from "@/lib/nex-native/peer-conversation-service";
import * as peerMessageService from "@/lib/nex-native/peer-message-service";
import { sendPeerMessageAction } from "../../../_actions";
import { PeerComposer } from "../../peer/[accountId]/_composer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Hardcoded to Maria for the live preview · she has the seeded
// reference conversation. Other prototypes can accept any friend.
const MARIA_ID = "d3e7f000-0001-4a00-b000-000000000001";

const NEX = {
  bg: "#020914",
  cyan: "#009FEF",
  cyanDeep: "#063B67",
  orange: "#FF7800",
  purple: "#6945F5",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  glassBubble: "rgba(255,255,255,0.06)",
  glassBorder: "rgba(255,255,255,0.08)",
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Map nex_account.chat_theme → the accent used for the ripple that
 *  fires when the peer sends a new message. Every friend gets THEIR
 *  colour ripple, which reinforces identity. */
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

export default async function PortraitBloomLivePage({
  searchParams,
}: {
  // Presence Bridge isn't built yet · ?online=0 lets us preview the
  // offline desaturation state until real presence lands.
  searchParams: Promise<{ online?: string }>;
}) {
  const params = await searchParams;
  const isOffline = params.online === "0";

  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const peer = await accountService.getAccountById(MARIA_ID);
  if (!peer) {
    // Seed hasn't run in this environment · guide the caller.
    return <MissingPeerFallback />;
  }

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
  const avatarUrl = profile?.avatar_url ?? null;
  const profession = profile?.profession ?? null;
  const displayName = peer.display_name;
  const chatTheme = peer.chat_theme ?? "default";
  const rippleColor = chatThemeAccent(chatTheme);

  // Chat-theme ripple: fires once on load if the last message is a
  // fresh inbound (< 15s old). Server re-renders after every send, so
  // when Maria's reply "lands" on refresh, the ripple plays. Real
  // Realtime patching is deferred to the presence Bridge.
  const lastMessage = messages[messages.length - 1];
  const now = Date.now();
  const lastAgeMs = lastMessage
    ? now - new Date(lastMessage.sent_at).getTime()
    : Number.POSITIVE_INFINITY;
  const showFreshRipple =
    !!lastMessage &&
    lastMessage.sender_account_id === peer.id &&
    lastAgeMs < 15_000;
  // React key changes with each fresh inbound message id · forces the
  // ripple animation to restart when a new one arrives on refresh.
  const rippleKey = showFreshRipple ? lastMessage!.id : "idle";

  return (
    <>
      <style>{`
        html, body { background: ${NEX.bg} !important; }
        @keyframes nex-msg-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        [data-nex-bloom-msg] {
          animation: nex-msg-in 260ms cubic-bezier(.2,.7,.2,1) both;
        }
        @keyframes nex-portrait-breathe {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.025); }
        }
        [data-nex-bloom-portrait] {
          animation: nex-portrait-breathe 8s ease-in-out infinite;
          transform-origin: 50% 30%;
          transition: filter 900ms ease;
        }
        [data-nex-bloom-offline] {
          filter: grayscale(0.72) brightness(0.72) contrast(0.92);
        }
        @keyframes nex-bloom-ripple {
          0%   { opacity: 0.0; transform: translate(-50%, -50%) scale(0.6); }
          40%  { opacity: 0.55; }
          100% { opacity: 0;   transform: translate(-50%, -50%) scale(3.4); }
        }
        [data-nex-bloom-ripple-inner] {
          animation: nex-bloom-ripple 2600ms cubic-bezier(.2,.7,.2,1) both;
        }
      `}</style>
      <main
        style={{
          position: "relative",
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.text,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Portrait fills top 58% · masked to fade into the abyss.
            Wrapped so the mask stays put while the inner image can
            breathe (scale) and desaturate (filter) without dragging
            the fade edge with it. */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "58vh",
            maskImage:
              "linear-gradient(180deg, #000 0%, #000 50%, rgba(0,0,0,0.6) 78%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(180deg, #000 0%, #000 50%, rgba(0,0,0,0.6) 78%, transparent 100%)",
            overflow: "hidden",
          }}
        >
          <div
            data-nex-bloom-portrait
            data-nex-bloom-offline={isOffline ? "true" : undefined}
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: avatarUrl
                ? `url(${avatarUrl})`
                : "radial-gradient(ellipse at 50% 25%, rgba(0,159,239,0.25) 0%, rgba(2,9,20,0.4) 60%, transparent 100%)",
              backgroundSize: "cover",
              backgroundPosition: "center 22%",
            }}
          />
        </div>

        {/* Chat-theme ripple · fires once when a fresh inbound message
            is on screen. Origin is behind the portrait's face area
            (~28% down from top, centred). */}
        <div
          key={rippleKey}
          aria-hidden
          style={{
            position: "absolute",
            top: "28vh",
            left: "50%",
            width: 0,
            height: 0,
            pointerEvents: "none",
            zIndex: 2,
          }}
        >
          {showFreshRipple && (
            <div
              data-nex-bloom-ripple-inner
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: 220,
                height: 220,
                borderRadius: "50%",
                background: `radial-gradient(circle, ${rippleColor}55 0%, ${rippleColor}22 45%, transparent 70%)`,
                mixBlendMode: "screen",
                transform: "translate(-50%, -50%) scale(0.6)",
              }}
            />
          )}
        </div>

        {/* Abyss gradient layer over the whole viewport */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, transparent 34%, rgba(2,9,20,0.55) 54%, rgba(2,9,20,0.9) 72%, #020914 90%)",
          }}
        />

        {/* Header · back + identity */}
        <header
          style={{
            position: "relative",
            zIndex: 3,
            padding:
              "calc(env(safe-area-inset-top, 0) + 14px) 20px 16px",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <Link
            href="/nex-native/chat"
            aria-label="Back to friends"
            style={{
              flexShrink: 0,
              width: 42,
              height: 42,
              borderRadius: "50%",
              background: "rgba(0,0,0,0.35)",
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: NEX.text,
              display: "grid",
              placeItems: "center",
              textDecoration: "none",
            }}
          >
            <svg
              width={22}
              height={22}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>

          <Link
            href="/nex-native/chat/prototypes"
            style={{
              alignSelf: "center",
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.75)",
              padding: "6px 12px",
              borderRadius: 999,
              background: "rgba(0,0,0,0.35)",
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
              border: "1px solid rgba(255,255,255,0.12)",
              textDecoration: "none",
            }}
          >
            Portrait Bloom · live
          </Link>
        </header>

        {/* Name overlay ~ mid portrait */}
        <div
          style={{
            position: "relative",
            zIndex: 3,
            padding: "22vh 22px 0",
            textShadow: "0 2px 20px rgba(0,0,0,0.75)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              opacity: 0.75,
              color: isOffline ? NEX.textDim : NEX.cyan,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              aria-hidden
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: isOffline ? "#7D9BC0" : "#16D66B",
                boxShadow: isOffline
                  ? "none"
                  : "0 0 8px rgba(22,214,107,0.6)",
                transition: "background 500ms ease",
              }}
            />
            {isOffline ? "Away · will see later" : "NEX · chatting with"}
          </div>
          <div
            style={{
              fontSize: 34,
              fontWeight: 700,
              marginTop: 4,
              lineHeight: 1.05,
              letterSpacing: "-0.01em",
            }}
          >
            {displayName}
          </div>
          {profession && (
            <div
              style={{
                marginTop: 6,
                fontSize: 14,
                color: "rgba(244,247,252,0.85)",
              }}
            >
              {profession}
            </div>
          )}
        </div>

        {/* Message list · floats over the darkness · scrolls up if long */}
        <section
          style={{
            position: "relative",
            zIndex: 3,
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            padding: "20px 20px 0",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
              overscrollBehavior: "contain",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              paddingBottom: 12,
            }}
          >
            {messages.length === 0 ? (
              <div
                style={{
                  alignSelf: "center",
                  maxWidth: 260,
                  textAlign: "center",
                  color: NEX.textDim,
                  fontSize: 13,
                  padding: "20px 12px",
                }}
              >
                Say hi to {displayName} · every message persists on NEX.
              </div>
            ) : (
              messages.map((m) => {
                const mine = m.sender_account_id === session.account.id;
                return (
                  <div
                    key={m.id}
                    data-nex-bloom-msg
                    style={{
                      alignSelf: mine ? "flex-end" : "flex-start",
                      maxWidth: "78%",
                      padding: "11px 14px 9px",
                      borderRadius: 20,
                      background: mine
                        ? "linear-gradient(120deg, #087FFF 0%, #6945F5 100%)"
                        : NEX.glassBubble,
                      backdropFilter: mine ? "none" : "blur(14px)",
                      WebkitBackdropFilter: mine ? "none" : "blur(14px)",
                      border: mine
                        ? "none"
                        : `1px solid ${NEX.glassBorder}`,
                      color: NEX.text,
                      fontSize: 15,
                      lineHeight: 1.42,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      boxShadow: mine
                        ? "0 10px 28px rgba(8,127,255,0.35)"
                        : "0 6px 22px rgba(0,0,0,0.55)",
                    }}
                  >
                    <div>{m.body}</div>
                    <div
                      style={{
                        marginTop: 4,
                        fontSize: 10,
                        color: mine
                          ? "rgba(255,255,255,0.75)"
                          : "rgba(139,169,209,0.85)",
                        textAlign: "right",
                        letterSpacing: "0.02em",
                      }}
                    >
                      {formatTime(m.sent_at)}
                      {mine && (
                        <span
                          style={{
                            marginLeft: 5,
                            color: m.read_at
                              ? "#C4E5FF"
                              : "rgba(255,255,255,0.6)",
                          }}
                        >
                          {m.read_at ? "✓✓" : "✓"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Composer · glass footer */}
        <div
          style={{
            position: "relative",
            zIndex: 4,
            padding:
              "12px 16px calc(env(safe-area-inset-bottom, 0) + 14px)",
            background:
              "linear-gradient(180deg, rgba(2,9,20,0) 0%, rgba(2,9,20,0.65) 40%, rgba(2,9,20,0.95) 100%)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
        >
          <div style={{ maxWidth: 480, margin: "0 auto" }}>
            <PeerComposer
              action={bind}
              placeholder={`Message ${displayName}…`}
            />
          </div>
        </div>
      </main>
    </>
  );
}

function MissingPeerFallback() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        display: "grid",
        placeItems: "center",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        padding: 32,
      }}
    >
      <div style={{ maxWidth: 400, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🌌</div>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>
          Maria isn&rsquo;t seeded in this environment
        </h1>
        <p
          style={{
            marginTop: 8,
            fontSize: 14,
            color: NEX.textDim,
            lineHeight: 1.55,
          }}
        >
          Run{" "}
          <code
            style={{
              background: "rgba(255,255,255,0.06)",
              padding: "2px 6px",
              borderRadius: 4,
              fontFamily: "ui-monospace, monospace",
              fontSize: 12,
            }}
          >
            NEX_ALLOW_DEV_ADMIN=1 npx tsx scripts/nex-seed-dev-friends.mts
          </code>{" "}
          then reload.
        </p>
        <Link
          href="/nex-native/chat/prototypes"
          style={{
            display: "inline-block",
            marginTop: 20,
            padding: "10px 18px",
            borderRadius: 999,
            background: "rgba(0,159,239,0.15)",
            border: `1px solid ${NEX.cyan}`,
            color: NEX.text,
            textDecoration: "none",
            fontSize: 13,
          }}
        >
          ← Back to gallery
        </Link>
      </div>
    </main>
  );
}
