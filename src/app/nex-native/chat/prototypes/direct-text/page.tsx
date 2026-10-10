// src/app/nex-native/chat/prototypes/direct-text/page.tsx
//
// VISUAL MOCKUP ONLY · NEX Free · Direct Text · 2026-10-03.
// -------------------------------------------------------------------------
// Static design preview for founder approval. Renders a mocked
// conversation using the proposed Direct Text visual rules so you
// can see the exact pixel-level design on a real device before any
// chrome gets built.
//
// NOT WIRED to anything:
//   · No real chat engine · hardcoded messages
//   · No new entry in chat-render/registry.ts
//   · No new value in nex_chat_theme.layout_style
//   · No new theme row inserted
//   · No change to Origin, Joker, or any other existing theme
//
// If founder approves this design, the real Direct Text chrome will
// live at src/lib/nex-native/chat-render/chrome/direct-text/ and
// delegate to the shared CORE for send/receive/E2E/history/reactions
// (same engine as every other chrome).
//
// Open at: http://localhost:3008/nex-native/chat/prototypes/direct-text

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
  | {
      kind: "text";
      author: "them" | "me";
      handle?: string;   // only shown on first message in a run
      time?: string;     // only shown on first message in a run
      body: string;
    }
  | {
      kind: "attachment-image";
      author: "them" | "me";
      handle?: string;
      time?: string;
      caption?: string;
    }
  | {
      kind: "reaction";
      author: "them" | "me";
      emoji: string;
    };

const CONVERSATION: Mock[] = [
  { kind: "text", author: "them", handle: "@maria", time: "09:14", body: "hey are you still coming today" },
  { kind: "text", author: "them", body: "are the kids coming too?" },
  { kind: "text", author: "me", handle: "you", time: "09:16", body: "yeah leaving in 10 minutes" },
  { kind: "text", author: "me", body: "bringing the dog as well" },
  { kind: "text", author: "them", handle: "@maria", time: "09:17", body: "ok perfect" },
  { kind: "reaction", author: "me", emoji: "♥" },
  { kind: "attachment-image", author: "them", handle: "@maria", time: "09:19", caption: "the beach is empty today" },
  { kind: "text", author: "me", handle: "you", time: "09:21", body: "no way be there in 5" },
];

export default function DirectTextMockupPage() {
  return (
    <>
      <style>{`html, body { background: ${NEX.bg} !important; } html, body { scrollbar-width: none; -ms-overflow-style: none; } html::-webkit-scrollbar, body::-webkit-scrollbar { width: 0; height: 0; display: none; }`}</style>
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
        {/* Mockup banner · identifies this as a design preview, not real chat */}
        <div
          style={{
            background: `${NEX.orange}22`,
            borderBottom: `1px solid ${NEX.orange}66`,
            padding: "8px 16px",
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            fontWeight: 700,
            color: NEX.orange,
            textAlign: "center",
          }}
        >
          Visual mockup · NEX Free · Direct Text · awaiting approval
        </div>

        {/* ── Chat header · identical to Origin bubbles chat ──────────── */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 14px",
            borderBottom: `1px solid ${NEX.cyanSoft}`,
            background: NEX.panel,
          }}
        >
          <Link
            href="/nex-native/chat/inbox"
            aria-label="Back"
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              border: `1px solid ${NEX.cyanSoft}`,
              background: "transparent",
              color: NEX.cyan,
              display: "grid",
              placeItems: "center",
              textDecoration: "none",
              fontSize: 18,
              lineHeight: 1,
            }}
          >
            ‹
          </Link>
          <div
            aria-hidden
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: `linear-gradient(145deg, ${NEX.cyan}, #0088CC)`,
              display: "grid",
              placeItems: "center",
              color: NEX.bg,
              fontWeight: 800,
              fontSize: 15,
            }}
          >
            MA
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
          <button
            type="button"
            aria-label="Voice call"
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
            }}
          >
            ☏
          </button>
          <button
            type="button"
            aria-label="Shop"
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
            }}
          >
            🛍
          </button>
        </header>

        {/* ── Direct-text feed · THE DIFFERENCE vs Origin bubbles ──────── */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            padding: "20px 20px 24px",
            gap: 14,
            overflowY: "auto",
          }}
        >
          {CONVERSATION.map((m, i) => {
            const alignRight = m.author === "me";

            // Reaction chip · attaches under the previous message
            if (m.kind === "reaction") {
              return (
                <div
                  key={i}
                  style={{
                    marginTop: -8,
                    display: "flex",
                    justifyContent: alignRight ? "flex-end" : "flex-start",
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: NEX.cyanFaint,
                      border: `1px solid ${NEX.cyanSoft}`,
                      color: NEX.textPrimary,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      lineHeight: 1,
                    }}
                  >
                    {m.emoji} 1
                  </span>
                </div>
              );
            }

            // Text message · THE CORE "no bubble" rule · plain text
            // against the dark navy base, aligned by author.
            if (m.kind === "text") {
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: alignRight ? "flex-end" : "flex-start",
                  }}
                >
                  {m.handle && (
                    <div
                      style={{
                        marginBottom: 4,
                        fontSize: 10,
                        letterSpacing: "0.16em",
                        textTransform: "uppercase",
                        fontWeight: 700,
                        color: NEX.cyan,
                        display: "flex",
                        gap: 10,
                        alignItems: "center",
                      }}
                    >
                      <span>{m.handle}</span>
                      {m.time && (
                        <span
                          style={{
                            color: NEX.textSecondary,
                            fontWeight: 500,
                            letterSpacing: "0.08em",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {m.time}
                        </span>
                      )}
                    </div>
                  )}
                  <div
                    style={{
                      maxWidth: "80%",
                      fontSize: 15,
                      lineHeight: 1.5,
                      color: NEX.textPrimary,
                      textAlign: alignRight ? "right" : "left",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {m.body}
                  </div>
                </div>
              );
            }

            // Attachment · media KEEPS its card chrome (an image cannot
            // just be plain text). Only the TEXT feed loses its bubbles.
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: alignRight ? "flex-end" : "flex-start",
                }}
              >
                {m.handle && (
                  <div
                    style={{
                      marginBottom: 4,
                      fontSize: 10,
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      fontWeight: 700,
                      color: NEX.cyan,
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                    }}
                  >
                    <span>{m.handle}</span>
                    {m.time && (
                      <span
                        style={{
                          color: NEX.textSecondary,
                          fontWeight: 500,
                          letterSpacing: "0.08em",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {m.time}
                      </span>
                    )}
                  </div>
                )}
                <div
                  style={{
                    width: "70%",
                    maxWidth: 280,
                    borderRadius: 14,
                    border: `1px solid ${NEX.cyanSoft}`,
                    background: NEX.panel,
                    overflow: "hidden",
                  }}
                >
                  {/* Placeholder "image" · gradient to indicate media */}
                  <div
                    style={{
                      aspectRatio: "4 / 3",
                      background: `linear-gradient(135deg, ${NEX.cyan}22, ${NEX.cyan}0a 60%, #050810)`,
                      display: "grid",
                      placeItems: "center",
                      fontSize: 36,
                      opacity: 0.6,
                    }}
                  >
                    🏖
                  </div>
                  {m.caption && (
                    <div
                      style={{
                        padding: "8px 12px",
                        fontSize: 13,
                        color: NEX.textPrimary,
                      }}
                    >
                      {m.caption}
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
              marginTop: -8,
            }}
          >
            ✓✓ read 09:21
          </div>
        </div>

        {/* ── Composer · identical to Origin bubbles chat ─────────────── */}
        <div
          style={{
            borderTop: `1px solid ${NEX.cyanSoft}`,
            background: NEX.panel,
            padding: "10px 14px",
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

        {/* Approval instructions footer */}
        <div
          style={{
            padding: "14px 16px 22px",
            background: NEX.bg,
            fontSize: 11,
            color: NEX.textSecondary,
            lineHeight: 1.5,
            borderTop: `1px solid rgba(255,255,255,0.04)`,
            textAlign: "center",
          }}
        >
          <strong style={{ color: NEX.textPrimary }}>What differs from Origin (bubbles):</strong>
          <br />
          Message text flows directly against the dark navy base · no bubble containers · author identified by{" "}
          <code style={{ color: NEX.cyan, fontFamily: "ui-monospace, monospace" }}>@handle</code> label above each run · left/right alignment · timestamps subtle · reactions anchor to the text block · attachments keep their card chrome.
          <br />
          <br />
          <strong style={{ color: NEX.textPrimary }}>What stays identical:</strong>
          <br />
          Header · composer · shop slider · call buttons · reactions UI · delete-for-everyone · reply-to · read ticks · presence · typing indicator · all CORE engine behaviour.
        </div>
      </main>
    </>
  );
}
