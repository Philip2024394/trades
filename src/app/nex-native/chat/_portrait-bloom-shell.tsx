// src/app/nex-native/chat/_portrait-bloom-shell.tsx
//
// Portrait Bloom · shared chat surface shell for NEX-native.
// ----------------------------------------------------------
// The Founder-approved chat interface for both friend chats
// (/nex-native/chat/peer/[accountId]) and business chats
// (/nex-native/conversations/[conversationId]).
//
// Sealed 2026-09-27. Design language stays the same across both
// surfaces so identity + relationship + conversation reads
// consistently regardless of who the peer is. Only the data mapping
// differs (peer account vs business, avatar_url vs logo_url,
// profession vs product context, chat_theme accent vs cyan default,
// online-presence vs open-hours).
//
// The composer is delegated to `chat/peer/[accountId]/_composer.tsx`
// (PeerComposer) which is a headless client component that takes an
// `action` prop, so both surfaces bind their own Server Action.

import * as React from "react";
import { PeerComposer } from "./peer/[accountId]/_composer";
import { ScrollToBottomOnMount } from "./_scroll-to-bottom";

const NEX = {
  bg: "#020914",
  cyan: "#009FEF",
  cyanDeep: "#063B67",
  orange: "#FF7800",
  green: "#16D66B",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  glassBubble: "rgba(255,255,255,0.06)",
  glassBorder: "rgba(255,255,255,0.08)",
};

export type PortraitBloomPresenceKind = "online" | "offline" | "away";

export interface PortraitBloomMessage {
  id: string;
  body: string;
  sent_at: string;
  read_at: string | null;
  mine: boolean;
}

export interface PortraitBloomContextChip {
  label: string;
  sublabel?: string | null;
}

export interface PortraitBloomShellProps {
  /** Big name printed over the portrait fade zone. */
  displayName: string;
  /** Small caption under the name · profession for friends, business
   *  tagline for businesses, product name for a product-scoped chat.
   *  Null hides the row. */
  subtitle: string | null;
  /** Portrait behind the fade · avatar_url for friends, logo_url for
   *  businesses. Null falls back to a gradient with initials. */
  portraitUrl: string | null;
  /** Optional additional context chip rendered under the subtitle ·
   *  used for business chat to show "About <product>" price. */
  contextChip?: PortraitBloomContextChip | null;
  /** Presence state · drives portrait desaturation + status pip. */
  presenceKind: PortraitBloomPresenceKind;
  /** Small label above the name · presence-aware. "NEX · chatting
   *  with" / "Away · will see later" / "OPEN · here now" etc. */
  presenceLabel: string;
  /** Accent colour for the fresh-inbound ripple. Chat-theme colour
   *  for friends · NEX cyan default for businesses (unless they later
   *  set a brand colour). */
  rippleColor: string;
  /** Href for the back navigation. Currently unused visually (no back
   *  button rendered) but retained so callers can keep supplying it
   *  and a future affordance can wire in without a prop refactor. */
  backHref: string;
  /** Full ordered message list (asc by sent_at). */
  messages: PortraitBloomMessage[];
  /** Server Action bound with the peer/conversation id. */
  composerAction: (formData: FormData) => Promise<never> | void | Promise<void>;
  /** Composer placeholder ("Message X…"). */
  composerPlaceholder: string;
  /** Data attribute for test/telemetry scoping. */
  scope: string;
  /** Optional badge · currently unused visually (header tag removed
   *  by Founder direction 2026-09-27). Callers may keep passing it. */
  headerTag?: string;
}

export function PortraitBloomShell({
  displayName,
  subtitle,
  portraitUrl,
  contextChip,
  presenceKind,
  presenceLabel,
  rippleColor,
  messages,
  composerAction,
  composerPlaceholder,
  scope,
}: PortraitBloomShellProps) {
  const isOffline = presenceKind !== "online";

  const lastMessage = messages[messages.length - 1];
  const now = Date.now();
  const lastAgeMs = lastMessage
    ? now - new Date(lastMessage.sent_at).getTime()
    : Number.POSITIVE_INFINITY;
  const showFreshRipple =
    !!lastMessage && !lastMessage.mine && lastAgeMs < 15_000;
  const rippleKey = showFreshRipple ? lastMessage!.id : "idle";

  return (
    <>
      <style>{`
        html, body {
          background: ${NEX.bg} !important;
          overflow: hidden;
          overscroll-behavior: none;
        }
        @keyframes nex-bloom-msg-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        [data-nex-bloom-msg] {
          animation: nex-bloom-msg-in 260ms cubic-bezier(.2,.7,.2,1) both;
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
        /* Scrollbar hidden · scrolling still works, just no visible
           bar on the side of the chat window. Sealed 2026-09-27. */
        [data-nex-message-scroll] {
          scrollbar-width: none;
          /* Fade the top edge so bubbles dissolve into the header
             instead of cutting hard against it. Bottom stays sharp
             so the composer keeps a clean boundary. */
          mask-image: linear-gradient(
            180deg,
            transparent 0px,
            #000 56px,
            #000 100%
          );
          -webkit-mask-image: linear-gradient(
            180deg,
            transparent 0px,
            #000 56px,
            #000 100%
          );
        }
        [data-nex-message-scroll]::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }
      `}</style>
      <main
        data-nex-bloom-scope={scope}
        style={{
          position: "fixed",
          inset: 0,
          // dvh accounts for mobile browser chrome (URL bar collapse/
          // expand) · pins the shell exactly to the visible viewport
          // so composer + name never slip off screen.
          height: "100dvh",
          background: NEX.bg,
          color: NEX.text,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Portrait layer · masked to fade into the abyss */}
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
              backgroundImage: portraitUrl
                ? `url(${portraitUrl})`
                : `linear-gradient(135deg, ${NEX.cyanDeep} 0%, #05101f 60%, #020914 100%)`,
              backgroundSize: "cover",
              backgroundPosition: "center 22%",
              backgroundColor: NEX.cyanDeep,
            }}
          >
            {/* Initials fallback when no portrait image */}
            {!portraitUrl && (
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "grid",
                  placeItems: "center",
                  color: NEX.cyan,
                  fontSize: 96,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  opacity: 0.4,
                }}
              >
                {initialsFromName(displayName)}
              </div>
            )}
          </div>
        </div>

        {/* Chat-theme ripple */}
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

        {/* Abyss gradient over full viewport */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, transparent 34%, rgba(2,9,20,0.55) 54%, rgba(2,9,20,0.9) 72%, #020914 90%)",
          }}
        />

        {/* Identity overlay · top-left · compact so the portrait can
            breathe and messages get more room. The "NEX · chatting
            with" label was removed 2026-09-27 · the portrait already
            signals "chatting with" and the presence dot lives inline
            beside the name. Backdrop-blur means bubbles scrolling
            behind get blurred rather than cutting hard against the
            header. */}
        <div
          style={{
            position: "relative",
            zIndex: 3,
            flexShrink: 0,
            padding:
              "calc(env(safe-area-inset-top, 0) + 14px) 20px 12px",
            textShadow: "0 2px 20px rgba(0,0,0,0.75)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span
              aria-label={presenceLabel}
              title={presenceLabel}
              style={{
                display: "inline-block",
                flexShrink: 0,
                width: 10,
                height: 10,
                borderRadius: "50%",
                background:
                  presenceKind === "online"
                    ? NEX.green
                    : presenceKind === "away"
                      ? "#F59E0B"
                      : "#7D9BC0",
                boxShadow:
                  presenceKind === "online"
                    ? `0 0 10px ${NEX.green}, 0 0 0 3px ${NEX.green}22`
                    : "none",
                transition: "background 500ms ease",
              }}
            />
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                lineHeight: 1.1,
                letterSpacing: "-0.005em",
                minWidth: 0,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {displayName}
            </div>
          </div>
          {subtitle && (
            <div
              style={{
                marginTop: 2,
                fontSize: 12,
                color: "rgba(244,247,252,0.78)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {subtitle}
            </div>
          )}
          {contextChip && (
            <div
              style={{
                marginTop: 6,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 10px",
                borderRadius: 999,
                background: "rgba(0,159,239,0.14)",
                border: "1px solid rgba(0,159,239,0.4)",
                color: NEX.text,
                fontSize: 11,
                letterSpacing: "0.02em",
                textShadow: "none",
              }}
            >
              <span style={{ opacity: 0.75, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase" }}>About</span>
              <span style={{ fontWeight: 600 }}>{contextChip.label}</span>
              {contextChip.sublabel && (
                <>
                  <span style={{ opacity: 0.5 }}>·</span>
                  <span>{contextChip.sublabel}</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Message list · the ONLY scrollable region on the surface.
            flex:1 + minHeight:0 lets it shrink below its natural
            content size so overflow-y: auto actually activates.
            Auto-scroll to bottom on load lives in
            _scroll-to-bottom.tsx (client component). */}
        <section
          data-nex-message-scroll
          style={{
            position: "relative",
            zIndex: 3,
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain",
            display: "flex",
            flexDirection: "column",
            padding: "20px 20px 12px",
          }}
        >
          <div
            style={{
              marginTop: "auto",
              display: "flex",
              flexDirection: "column",
              // Explicit per-message spacing replaces the flex gap ·
              // grouping rhythm is applied via marginTop on each item.
              gap: 0,
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
              messages.map((m, idx) => {
                const prev = messages[idx - 1];
                const senderChanged = !prev || prev.mine !== m.mine;
                const timeGapMs = prev
                  ? new Date(m.sent_at).getTime() -
                    new Date(prev.sent_at).getTime()
                  : Number.POSITIVE_INFINITY;
                const bigTimeGap = timeGapMs > 5 * 60_000;
                const isFirst = idx === 0;
                // Grouping rhythm · tight cluster within same-sender
                // run · larger gap on sender change · time separator
                // + biggest gap on >5min pauses.
                const marginTop = isFirst
                  ? 0
                  : bigTimeGap
                    ? 22
                    : senderChanged
                      ? 16
                      : 4;
                // Only show timestamp inside the bubble for the last
                // message in a same-sender group OR when there's a
                // big time gap coming after this message. Reduces
                // visual noise in a rapid burst.
                const next = messages[idx + 1];
                const nextSenderDiffers = !next || next.mine !== m.mine;
                const nextTimeGap = next
                  ? new Date(next.sent_at).getTime() -
                    new Date(m.sent_at).getTime() >
                    5 * 60_000
                  : true;
                const showTimestamp = nextSenderDiffers || nextTimeGap;
                return (
                  <React.Fragment key={m.id}>
                    {bigTimeGap && !isFirst && (
                      <div
                        style={{
                          alignSelf: "center",
                          padding: "4px 12px",
                          margin: "6px 0",
                          borderRadius: 999,
                          background: "rgba(8,39,68,0.55)",
                          color: NEX.textDim,
                          fontSize: 10,
                          letterSpacing: "0.14em",
                          textTransform: "uppercase",
                          fontWeight: 600,
                        }}
                      >
                        {formatTime(m.sent_at)}
                      </div>
                    )}
                    <div
                      data-nex-bloom-msg
                      data-nex-bloom-msg-mine={m.mine ? "true" : undefined}
                      style={{
                        position: "relative",
                        alignSelf: m.mine ? "flex-end" : "flex-start",
                        maxWidth: "78%",
                        padding: showTimestamp
                          ? "11px 14px 9px"
                          : "10px 14px",
                        marginTop,
                        borderRadius: 18,
                        background: m.mine
                          ? "rgba(120,140,180,0.14)"
                          : NEX.glassBubble,
                        backdropFilter: "blur(14px)",
                        WebkitBackdropFilter: "blur(14px)",
                        border: m.mine
                          ? "1px solid rgba(0,159,239,0.85)"
                          : `1px solid ${NEX.glassBorder}`,
                        color: NEX.text,
                        fontSize: 15,
                        lineHeight: 1.42,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        boxShadow: m.mine
                          ? "0 0 14px rgba(0,159,239,0.25), 0 6px 20px rgba(0,0,0,0.45)"
                          : "0 6px 22px rgba(0,0,0,0.55)",
                      }}
                    >
                      <div>{m.body}</div>
                      {showTimestamp && (
                        <div
                          style={{
                            marginTop: 4,
                            fontSize: 10,
                            color: m.mine
                              ? "rgba(255,255,255,0.75)"
                              : "rgba(139,169,209,0.85)",
                            textAlign: "right",
                            letterSpacing: "0.02em",
                          }}
                        >
                          {formatTime(m.sent_at)}
                          {m.mine && (
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
                      )}
                    </div>
                  </React.Fragment>
                );
              })
            )}
          </div>
        </section>

        {/* Composer · floats over the chat with no glass panel · the
            aurora pill + ghost icons carry all the visual weight. */}
        <div
          style={{
            position: "relative",
            zIndex: 4,
            flexShrink: 0,
            padding:
              "10px 16px calc(env(safe-area-inset-bottom, 0) + 10px)",
            background: "transparent",
          }}
        >
          <div style={{ maxWidth: 480, margin: "0 auto" }}>
            <PeerComposer
              action={composerAction}
              placeholder={composerPlaceholder}
            />
          </div>
        </div>
        <ScrollToBottomOnMount />
      </main>
    </>
  );
}

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
