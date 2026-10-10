"use client";

// src/app/nex-native/chat/prototypes/nex-bubbles/page.tsx
//
// VISUAL MOCKUP ONLY · NEX Free · Bubble chat (NEX blue) · 2026-10-03.
// -------------------------------------------------------------------------
// Static design preview for founder approval. Same mocked conversation
// as the /direct-text mockup so you can compare the two free NEX
// layouts side-by-side with identical content.
//
// NOT WIRED to anything:
//   · No real chat engine · hardcoded messages
//   · No new entry in chat-render/registry.ts
//   · No change to the shipping bubbles chrome (PortraitBloomShell)
//   · This exists purely as a design-review artefact
//
// Open at: http://localhost:3008/nex-native/chat/prototypes/nex-bubbles
//
// Pair comparison:
//   WITHOUT bubbles · /nex-native/chat/prototypes/direct-text
//   WITH    bubbles · /nex-native/chat/prototypes/nex-bubbles  ← here

import * as React from "react";
import Link from "next/link";

const NEX = {
  bg: "#020914",
  panel: "#03101D",
  textPrimary: "#F2F5F8",
  textSecondary: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanFaint: "rgba(0, 175, 255, 0.14)",
  orange: "#FF7200",
};

type Mock =
  | { kind: "text"; author: "them" | "me"; time?: string; body: string; reactions?: string[] }
  | { kind: "attachment-image"; author: "them" | "me"; time?: string; caption?: string };

// Same message content as the Direct Text mockup for apples-to-apples comparison.
const CONVERSATION: Mock[] = [
  { kind: "text", author: "them", time: "09:14", body: "hey are you still coming today" },
  { kind: "text", author: "them", body: "are the kids coming too?" },
  { kind: "text", author: "me", time: "09:16", body: "yeah leaving in 10 minutes" },
  { kind: "text", author: "me", body: "bringing the dog as well" },
  { kind: "text", author: "them", time: "09:17", body: "ok perfect", reactions: ["♥"] },
  { kind: "attachment-image", author: "them", time: "09:19", caption: "the beach is empty today" },
  { kind: "text", author: "me", time: "09:21", body: "no way be there in 5" },
];

export default function NexBubblesMockupPage() {
  // Quick-action tray state · opens the Call / Video / Mic slide-out
  // panel from behind the 3-dots trigger. Mockup-only state · in the
  // real chrome this will tie into the WebRTC signalling CORE.
  const [trayOpen, setTrayOpen] = React.useState(false);

  return (
    <>
      <style>{`
        html, body { background: ${NEX.bg} !important; }
        html, body { scrollbar-width: none; -ms-overflow-style: none; }
        html::-webkit-scrollbar, body::-webkit-scrollbar { width: 0; height: 0; display: none; }
        @keyframes nex-online-ping {
          0%   { transform: scale(1);    opacity: 0.7; }
          100% { transform: scale(1.45); opacity: 0;   }
        }
      `}</style>
      <main
        style={{
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.textPrimary,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          display: "flex",
          flexDirection: "column",
          // Anchor for the absolutely-positioned quick-action tray.
          position: "relative",
        }}
      >
        {/* ── Chat header · no background panel, no bottom line ───────── */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 14px",
            background: "transparent",
          }}
        >
          {/* Avatar · green ring when online + pulsing ping ring that
              radiates every 1.6s. Back button intentionally removed
              per founder direction. */}
          <div
            style={{
              position: "relative",
              width: 44,
              height: 44,
              flexShrink: 0,
            }}
          >
            {/* Pulsing ping · absolutely positioned behind the avatar.
                `nex-online-ping` keyframes defined in the inline style
                block below. */}
            <span
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                border: "2px solid #3AE26B",
                animation: "nex-online-ping 1.6s cubic-bezier(0,0,0.2,1) infinite",
                pointerEvents: "none",
              }}
            />
            {/* The avatar itself · green solid rim so the online state
                is readable even between pings. */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                background: `linear-gradient(145deg, ${NEX.cyan}, #0088CC)`,
                display: "grid",
                placeItems: "center",
                color: NEX.bg,
                fontWeight: 800,
                fontSize: 15,
                border: "2px solid #3AE26B",
                boxShadow: "0 0 10px rgba(58,226,107,0.45)",
              }}
            >
              MA
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Maria</div>
            <div style={{ fontSize: 11, color: NEX.textSecondary, display: "flex", alignItems: "center", gap: 6 }}>
              <span
                aria-hidden
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#3AE26B",
                  boxShadow: "0 0 6px #3AE26B",
                }}
              />
              online · @maria
            </div>
          </div>
          <HeaderIconButton label="Home" icon="🏠" href="/nex-native/home" />
          <HeaderIconButton label="Cart" icon="🛒" href="/nex-native/cart" />
          <HeaderIconButton label="Shop" icon="🛍" href="/nex-native/manage/shop" />
        </header>

        {/* ── Bubble feed · THE DIFFERENCE vs Direct Text ──────────────── */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            padding: "16px 14px 20px",
            gap: 6,
            overflowY: "auto",
          }}
        >
          {CONVERSATION.map((m, i) => {
            const alignRight = m.author === "me";
            const prev = i > 0 ? CONVERSATION[i - 1] : null;
            const sameAuthorAsPrev = prev && prev.author === m.author;
            // Tighter spacing when same author continues; wider on author change.
            const groupTopGap = sameAuthorAsPrev ? 2 : 10;

            // Bubble colour · my messages = frosted glass mist cyan;
            // theirs = dark panel. Frosted glass = translucent fill +
            // backdrop blur + top-light inner rim + soft outer glow.
            // Text stays light since the surface is translucent.
            const bubbleBg = alignRight
              ? "linear-gradient(180deg, rgba(0,175,255,0.22) 0%, rgba(0,175,255,0.12) 100%)"
              : NEX.panel;
            const bubbleText = NEX.textPrimary;
            const bubbleBorder = alignRight ? "rgba(255,255,255,0.14)" : NEX.cyanSoft;

            // Rounded corners · pointed on the "sender" corner, soft on the
            // other three. iMessage-style tail hint without an SVG arrow.
            const radius: React.CSSProperties = alignRight
              ? { borderRadius: "18px 18px 6px 18px" }
              : { borderRadius: "18px 18px 18px 6px" };

            if (m.kind === "text") {
              return (
                <div
                  key={i}
                  style={{
                    marginTop: groupTopGap,
                    display: "flex",
                    justifyContent: alignRight ? "flex-end" : "flex-start",
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      maxWidth: "75%",
                      padding: "9px 13px",
                      background: bubbleBg,
                      border: `1px solid ${bubbleBorder}`,
                      color: bubbleText,
                      fontSize: 15,
                      lineHeight: 1.42,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      // Frosted mist · translucent fill + backdrop blur
                      // + top-light inner rim (glass glint) + soft outer
                      // glow in cyan. Theirs stays a solid dark panel.
                      backdropFilter: alignRight ? "blur(14px) saturate(160%)" : undefined,
                      WebkitBackdropFilter: alignRight ? "blur(14px) saturate(160%)" : undefined,
                      boxShadow: alignRight
                        ? "0 10px 28px rgba(0,175,255,0.18), inset 0 1px 0 rgba(255,255,255,0.22)"
                        : "0 4px 10px rgba(0,0,0,0.35)",
                      ...radius,
                    }}
                  >
                    {m.body}
                    {m.time && (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: 10,
                          opacity: 0.7,
                          color: bubbleText,
                          fontVariantNumeric: "tabular-nums",
                          verticalAlign: "baseline",
                        }}
                      >
                        {m.time}
                      </span>
                    )}
                    {m.reactions && m.reactions.length > 0 && (
                      <span
                        style={{
                          position: "absolute",
                          bottom: -10,
                          right: alignRight ? "auto" : 10,
                          left: alignRight ? 10 : "auto",
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: NEX.bg,
                          border: `1px solid ${NEX.cyanSoft}`,
                          color: NEX.textPrimary,
                          fontSize: 11,
                          lineHeight: 1,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {m.reactions.join(" ")} 1
                      </span>
                    )}
                  </div>
                </div>
              );
            }

            // Attachment · image inside bubble envelope. Caption below.
            return (
              <div
                key={i}
                style={{
                  marginTop: groupTopGap,
                  display: "flex",
                  justifyContent: alignRight ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    maxWidth: "75%",
                    background: bubbleBg,
                    border: `1px solid ${bubbleBorder}`,
                    overflow: "hidden",
                    backdropFilter: alignRight ? "blur(14px) saturate(160%)" : undefined,
                    WebkitBackdropFilter: alignRight ? "blur(14px) saturate(160%)" : undefined,
                    boxShadow: alignRight
                      ? "0 10px 28px rgba(0,175,255,0.18), inset 0 1px 0 rgba(255,255,255,0.22)"
                      : "0 4px 10px rgba(0,0,0,0.35)",
                    ...radius,
                  }}
                >
                  <div
                    style={{
                      aspectRatio: "4 / 3",
                      background: `linear-gradient(135deg, ${NEX.cyan}44, ${NEX.cyan}0a 60%, #050810)`,
                      display: "grid",
                      placeItems: "center",
                      fontSize: 36,
                      opacity: 0.75,
                    }}
                  >
                    🏖
                  </div>
                  {(m.caption || m.time) && (
                    <div
                      style={{
                        padding: "8px 12px",
                        display: "flex",
                        alignItems: "flex-end",
                        gap: 8,
                      }}
                    >
                      {m.caption && (
                        <div style={{ fontSize: 13, color: bubbleText, flex: 1 }}>
                          {m.caption}
                        </div>
                      )}
                      {m.time && (
                        <span
                          style={{
                            fontSize: 10,
                            opacity: 0.7,
                            color: bubbleText,
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {m.time}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Read tick for the latest "me" message, aligned right */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              fontSize: 10,
              color: NEX.cyan,
              letterSpacing: "0.08em",
              marginTop: 4,
            }}
          >
            ✓✓ read 09:21
          </div>
        </div>

        {/* ── Quick-action tray · 3-dots button + slide-out panel ──────── */}
        <div
          style={{
            position: "absolute",
            right: 14,
            // Sits just above the composer bar. Composer is ~62px tall
            // (10px padding × 2 + ~42px input) + iOS safe-area bottom
            // when present. Clear it comfortably on both desktop + phone.
            bottom: "calc(78px + env(safe-area-inset-bottom, 0px))",
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            gap: 8,
            pointerEvents: "none", // children re-enable so taps go to buttons only
          }}
        >
          {/* Slide-out panel · translateX off-screen when closed, 0 when open.
              Keeps its DOM in the tree so animations run on open & close. */}
          <div
            aria-hidden={!trayOpen}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: trayOpen ? "6px 8px" : 0,
              borderRadius: 999,
              background: trayOpen
                ? "linear-gradient(180deg, rgba(0,175,255,0.18) 0%, rgba(0,175,255,0.08) 100%)"
                : "transparent",
              border: trayOpen ? "1px solid rgba(255,255,255,0.12)" : "1px solid transparent",
              backdropFilter: trayOpen ? "blur(14px) saturate(160%)" : undefined,
              WebkitBackdropFilter: trayOpen ? "blur(14px) saturate(160%)" : undefined,
              boxShadow: trayOpen
                ? "0 10px 28px rgba(0,175,255,0.22), inset 0 1px 0 rgba(255,255,255,0.22)"
                : "none",
              transform: trayOpen ? "translateX(0)" : "translateX(16px)",
              opacity: trayOpen ? 1 : 0,
              maxWidth: trayOpen ? 220 : 0,
              overflow: "hidden",
              transition:
                "opacity 180ms ease, transform 260ms cubic-bezier(0.25,0.9,0.3,1.1), max-width 260ms cubic-bezier(0.25,0.9,0.3,1.1), padding 220ms ease, background 220ms ease, border-color 220ms ease, box-shadow 220ms ease",
              pointerEvents: trayOpen ? "auto" : "none",
            }}
          >
            <TrayButton label="Voice call" icon="☏" />
            <TrayButton label="Video call" icon="📹" />
            <TrayButton label="Record voice note" icon="🎤" />
          </div>

          {/* The 3-dots trigger · tap toggles the tray. Rotates to × when open. */}
          <button
            type="button"
            aria-label={trayOpen ? "Close quick actions" : "Open quick actions"}
            aria-expanded={trayOpen}
            onClick={() => setTrayOpen((v) => !v)}
            style={{
              pointerEvents: "auto",
              width: 42,
              height: 42,
              borderRadius: "50%",
              border: "1px solid rgba(255,255,255,0.14)",
              background:
                "linear-gradient(180deg, rgba(0,175,255,0.22) 0%, rgba(0,175,255,0.12) 100%)",
              color: NEX.textPrimary,
              fontSize: 22,
              lineHeight: 1,
              cursor: "pointer",
              backdropFilter: "blur(14px) saturate(160%)",
              WebkitBackdropFilter: "blur(14px) saturate(160%)",
              boxShadow:
                "0 10px 28px rgba(0,175,255,0.22), inset 0 1px 0 rgba(255,255,255,0.22)",
              display: "grid",
              placeItems: "center",
              fontWeight: 700,
              transition: "transform 220ms cubic-bezier(0.25,0.9,0.3,1.1)",
              transform: trayOpen ? "rotate(90deg)" : "rotate(0deg)",
            }}
          >
            ⋮
          </button>
        </div>

        {/* ── Composer · pinned to real viewport bottom with iOS safe-area ─ */}
        <div
          style={{
            borderTop: `1px solid ${NEX.cyanSoft}`,
            background: NEX.panel,
            padding: "10px 14px calc(10px + env(safe-area-inset-bottom, 0px))",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <button
            type="button"
            aria-label="Add attachment"
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              border: `1px solid ${NEX.cyanSoft}`,
              background: "transparent",
              color: NEX.cyan,
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
            }}
          >
            +
          </button>
          <div
            style={{
              flex: 1,
              borderRadius: 999,
              border: `1px solid ${NEX.cyanSoft}`,
              background: "transparent",
              padding: "10px 14px",
              fontSize: 14,
              color: NEX.textSecondary,
            }}
          >
            type a message
          </div>
          <button
            type="button"
            aria-label="Send"
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              border: "none",
              background: NEX.orange,
              color: "#1A0A00",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              fontSize: 18,
              fontWeight: 800,
            }}
          >
            →
          </button>
        </div>

      </main>
    </>
  );
}

// Single circular button in the quick-action tray. Frosted-glass fill,
// cyan accent icon, same visual family as the 3-dots trigger.
function TrayButton({ label, icon }: { label: string; icon: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      style={{
        width: 40,
        height: 40,
        borderRadius: "50%",
        border: "1px solid rgba(255,255,255,0.14)",
        background:
          "linear-gradient(180deg, rgba(0,175,255,0.22) 0%, rgba(0,175,255,0.10) 100%)",
        color: "#F2F5F8",
        fontSize: 18,
        lineHeight: 1,
        cursor: "pointer",
        backdropFilter: "blur(10px) saturate(160%)",
        WebkitBackdropFilter: "blur(10px) saturate(160%)",
        boxShadow:
          "0 6px 14px rgba(0,175,255,0.22), inset 0 1px 0 rgba(255,255,255,0.22)",
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
      }}
    >
      {icon}
    </button>
  );
}

// Right-side header icon · behaves as a link (Home / Cart / Shop).
function HeaderIconButton({ label, icon, href }: { label: string; icon: string; href: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      style={{
        width: 36,
        height: 36,
        borderRadius: "50%",
        border: "1px solid rgba(0,175,255,0.35)",
        background: "transparent",
        color: "#00AFFF",
        display: "grid",
        placeItems: "center",
        textDecoration: "none",
        fontSize: 16,
        lineHeight: 1,
      }}
    >
      {icon}
    </Link>
  );
}
