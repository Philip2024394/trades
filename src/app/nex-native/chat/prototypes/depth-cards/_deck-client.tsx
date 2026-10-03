"use client";

// src/app/nex-native/chat/prototypes/depth-cards/_deck-client.tsx
//
// Client-side deck for Prototype 06 · Depth Cards.
// ------------------------------------------------
// Owns the scroll-peels-the-deck gesture: wheel / touch / keyboard
// advances a `offset` state representing how far back from the newest
// message the window is anchored. offset=0 shows the latest 6; offset=N
// shows [latest-6-N, latest-N).

import * as React from "react";

export interface DeckMessage {
  id: string;
  body: string;
  sender_account_id: string;
  sent_at: string;
  read_at: string | null;
}

const NEX = {
  cyan: "#009FEF",
  cyanDeep: "#063B67",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
};

const WINDOW_SIZE = 6;
const WHEEL_THRESHOLD = 60; // px of accumulated wheel delta per card step
const TOUCH_THRESHOLD = 60; // px of touch delta per card step
// Replying-to bubble char limit before it collapses behind an expand
// chevron. Sized so ~99% of real messages render in full on first
// paint (fontSize 13 · line-height 1.4 · ~72% viewport width).
const LONG_REPLY_THRESHOLD = 240;
const LONG_REPLY_COLLAPSED_LINES = 4;

function formatTime(iso: string): string {
  // Deterministic UTC-based HH:mm · locale-agnostic so SSR and client
  // produce identical output (prevents hydration mismatch).
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

interface DepthDeckProps {
  messages: DeckMessage[];
  viewerAccountId: string;
  peerAccountId: string;
  displayName: string;
  /** Test-only · forces a render-time throw to exercise the Tier 2
   *  VisualThemeBoundary. Not set in production call sites. */
  __faultInject?: boolean;
}

export function DepthDeck({
  messages,
  viewerAccountId,
  peerAccountId,
  displayName,
  __faultInject,
}: DepthDeckProps) {
  if (__faultInject) {
    throw new Error("fault-injection: depth-deck theme");
  }
  const total = messages.length;
  const maxOffset = Math.max(0, total - 1);

  const [offset, setOffset] = React.useState(0);
  // Which replying-to bubble (by message id) is currently expanded.
  // Only kicks in when the message exceeds LONG_REPLY_THRESHOLD chars.
  const [expandedReplyId, setExpandedReplyId] = React.useState<string | null>(
    null,
  );
  const wheelAccumRef = React.useRef(0);
  const touchYRef = React.useRef<number | null>(null);

  const changeOffset = React.useCallback(
    (delta: number) => {
      setOffset((prev) => Math.max(0, Math.min(maxOffset, prev + delta)));
    },
    [maxOffset],
  );

  const onWheel = (e: React.WheelEvent<HTMLElement>) => {
    wheelAccumRef.current += e.deltaY;
    // Scroll "up" (deltaY < 0) reveals OLDER → offset++
    while (wheelAccumRef.current <= -WHEEL_THRESHOLD) {
      wheelAccumRef.current += WHEEL_THRESHOLD;
      changeOffset(1);
    }
    while (wheelAccumRef.current >= WHEEL_THRESHOLD) {
      wheelAccumRef.current -= WHEEL_THRESHOLD;
      changeOffset(-1);
    }
  };

  const onTouchStart = (e: React.TouchEvent<HTMLElement>) => {
    touchYRef.current = e.touches[0]?.clientY ?? null;
  };
  const onTouchMove = (e: React.TouchEvent<HTMLElement>) => {
    if (touchYRef.current === null) return;
    const y = e.touches[0]?.clientY ?? touchYRef.current;
    const delta = y - touchYRef.current;
    // Finger drags DOWN (delta > 0) → reveal older → offset++
    while (delta >= TOUCH_THRESHOLD) {
      changeOffset(1);
      touchYRef.current = (touchYRef.current ?? 0) + TOUCH_THRESHOLD;
      return;
    }
    while (delta <= -TOUCH_THRESHOLD) {
      changeOffset(-1);
      touchYRef.current = (touchYRef.current ?? 0) - TOUCH_THRESHOLD;
      return;
    }
  };
  const onTouchEnd = () => {
    touchYRef.current = null;
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === "ArrowUp" || e.key === "PageUp") {
      e.preventDefault();
      changeOffset(1);
    } else if (e.key === "ArrowDown" || e.key === "PageDown") {
      e.preventDefault();
      changeOffset(-1);
    } else if (e.key === "Home") {
      e.preventDefault();
      setOffset(maxOffset);
    } else if (e.key === "End") {
      e.preventDefault();
      setOffset(0);
    }
  };

  // Window: [end-WINDOW_SIZE, end) of the messages array, where
  // end = total - offset.
  const end = total - offset;
  const start = Math.max(0, end - WINDOW_SIZE);
  const deck = messages.slice(start, end);

  const atLatest = offset === 0;
  const atOldest = offset >= maxOffset;

  // Replying-to context tracks scroll · shows the latest peer message
  // at or before the current front card (deck's newest visible).
  const replyingTo = React.useMemo(() => {
    for (let i = end - 1; i >= 0; i--) {
      const m = messages[i];
      if (m && m.sender_account_id === peerAccountId) return m;
    }
    return null;
  }, [messages, end, peerAccountId]);

  if (total === 0) {
    return <EmptyState displayName={displayName} />;
  }

  return (
    <>
    {replyingTo ? (
      <div
        style={{
          position: "relative",
          zIndex: 4,
          padding: "0 20px 10px",
          display: "flex",
          justifyContent: "flex-start",
        }}
      >
        <div
          key={replyingTo.id}
          style={{
            maxWidth: "72%",
            padding: "10px 14px 9px",
            borderRadius: 16,
            background:
              "linear-gradient(145deg, #102B46 0%, #0A1D31 100%)",
            border: "1px solid rgba(105,170,220,0.14)",
            color: NEX.text,
            fontSize: 13,
            lineHeight: 1.4,
            boxShadow: "0 10px 24px rgba(0,0,0,0.42)",
            animation:
              "nex-replying-swap 220ms cubic-bezier(.2,.7,.2,1) both",
          }}
        >
          <div
            style={{
              fontSize: 9,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: NEX.textDim,
              marginBottom: 4,
            }}
          >
            Replying to {displayName}
          </div>
          {(() => {
            const isLong = replyingTo.body.length > LONG_REPLY_THRESHOLD;
            const isExpanded = expandedReplyId === replyingTo.id;
            // 99% of chats: just render the full body, no chevron.
            if (!isLong) {
              return (
                <div
                  style={{
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {replyingTo.body}
                </div>
              );
            }
            // Edge case: long message · collapsible with chevron.
            return (
              <>
                <div
                  style={
                    isExpanded
                      ? {
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        }
                      : {
                          display: "-webkit-box",
                          WebkitLineClamp: LONG_REPLY_COLLAPSED_LINES,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                          wordBreak: "break-word",
                          whiteSpace: "pre-wrap",
                        }
                  }
                >
                  {replyingTo.body}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setExpandedReplyId(isExpanded ? null : replyingTo.id)
                  }
                  aria-label={isExpanded ? "Collapse message" : "Expand full message"}
                  aria-expanded={isExpanded}
                  style={{
                    marginTop: 6,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "3px 8px",
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 999,
                    color: NEX.textDim,
                    fontSize: 10,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                    alignSelf: "flex-start",
                  }}
                >
                  <span>{isExpanded ? "Show less" : "Show full"}</span>
                  <svg
                    width={10}
                    height={10}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 180ms ease",
                    }}
                    aria-hidden
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
              </>
            );
          })()}
        </div>
      </div>
    ) : null}
    <section
      data-nex-deck
      tabIndex={0}
      onWheel={onWheel}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onKeyDown={onKeyDown}
      style={{
        position: "relative",
        zIndex: 3,
        flex: 1,
        padding: "20px 20px 0",
        perspective: "1400px",
        outline: "none",
        touchAction: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: "0 16px 0 16px",
          transformStyle: "preserve-3d",
        }}
      >
        {deck.map((m, i) => {
          const depth = deck.length - 1 - i;
          const mine = m.sender_account_id === viewerAccountId;
          const scale = 1 - depth * 0.05;
          const translateY = depth * -18;
          const translateZ = -depth * 32;
          const opacity = Math.max(0, 1 - depth * 0.16);
          const isTop = depth === 0;
          return (
            <div
              key={m.id}
              data-nex-deck-card
              data-nex-deck-card-mine={mine ? "true" : undefined}
              data-nex-deck-top={isTop ? "true" : undefined}
              style={{
                position: "absolute",
                bottom: 32 + depth * 8,
                left: mine ? "16%" : 0,
                right: mine ? 0 : "16%",
                padding: "16px 20px 14px",
                // Haunted Hotel owner bubble · Spectral Smoke Trail
                // (Prototype 10) · frosted translucent glass with
                // bottom-right speaker point.
                borderRadius: mine ? "22px 22px 4px 22px" : 22,
                background: mine
                  ? "linear-gradient(145deg, rgba(255,255,255,0.12) 0%, rgba(180,195,215,0.18) 100%)"
                  : "linear-gradient(145deg, #102B46 0%, #0A1D31 100%)",
                border: mine
                  ? "1px solid rgba(255,255,255,0.15)"
                  : "1px solid rgba(105,170,220,0.10)",
                backdropFilter: mine ? "blur(8px)" : undefined,
                WebkitBackdropFilter: mine ? "blur(8px)" : undefined,
                color: mine ? "#f0e7dc" : NEX.text,
                fontSize: isTop ? 16 : 14,
                lineHeight: 1.42,
                transform: `translateY(${translateY}px) translateZ(${translateZ}px) scale(${scale})`,
                transformOrigin: "50% 100%",
                opacity,
                boxShadow: mine
                  ? `0 24px 42px rgba(0,0,0,${0.48 - depth * 0.06}), inset 0 0 30px rgba(255,255,255,0.08)`
                  : `0 18px 36px rgba(0,0,0,${0.48 - depth * 0.06})`,
                // Smoke tendrils on the top mine card need to escape
                // the bubble's rounded box.
                overflow: mine && isTop ? "visible" : undefined,
                zIndex: 100 - depth,
                transition:
                  "transform 320ms cubic-bezier(.2,.7,.2,1), opacity 260ms ease",
              }}
            >
              {/* Spectral Smoke Trail · ghost-white tendrils rising
                  from the top edge of the owner's front-of-deck
                  bubble. Eight staggered puffs so the smoke feels
                  denser and more spectral. Rendered only on the top
                  mine card so the deck stacks underneath stay calm. */}
              {mine && isTop
                ? [0, 1, 2, 3, 4, 5, 6, 7].map((k) => (
                    <div
                      key={`hh-smoke-${k}`}
                      aria-hidden
                      style={{
                        position: "absolute",
                        left: `${8 + k * 12}%`,
                        top: -10,
                        width: 54,
                        height: 54,
                        marginLeft: -27,
                        borderRadius: "50%",
                        background:
                          "radial-gradient(circle, rgba(255,255,255,0.85) 0%, rgba(230,235,245,0.4) 38%, rgba(255,255,255,0) 70%)",
                        filter: "blur(12px)",
                        animationName: "hh-smoke",
                        animationDuration: `${5 + (k % 4) * 0.7}s`,
                        animationTimingFunction: "ease-out",
                        animationIterationCount: "infinite",
                        animationDelay: `${k * 0.55}s`,
                        mixBlendMode: "screen",
                        pointerEvents: "none",
                        willChange: "transform, opacity, filter",
                      }}
                    />
                  ))
                : null}
              <div
                style={{
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {m.body}
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 10,
                  letterSpacing: "0.04em",
                  color: mine
                    ? "rgba(255,255,255,0.78)"
                    : "rgba(139,169,209,0.9)",
                  textAlign: "right",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 6,
                  alignItems: "center",
                }}
              >
                <span>{formatTime(m.sent_at)}</span>
                {mine && (
                  <span
                    style={{
                      color: m.read_at ? "#C4E5FF" : "rgba(255,255,255,0.6)",
                    }}
                  >
                    {m.read_at ? "✓✓" : "✓"}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Position indicator · appears when scrolled back from latest */}
      {!atLatest && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 12,
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: 10,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: NEX.textDim,
            padding: "6px 12px",
            borderRadius: 999,
            background: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            border: "1px solid rgba(255,255,255,0.10)",
            zIndex: 200,
          }}
        >
          {`${Math.min(end, total)} / ${total}`}
          {atOldest ? " · oldest" : ""}
        </div>
      )}

      {/* Jump-to-latest · appears when scrolled back */}
      {!atLatest && (
        <button
          type="button"
          onClick={() => setOffset(0)}
          aria-label="Jump to latest"
          style={{
            position: "absolute",
            right: 16,
            bottom: 16,
            width: 42,
            height: 42,
            borderRadius: "50%",
            background: "rgba(0,159,239,0.18)",
            border: `1px solid ${NEX.cyan}`,
            color: NEX.text,
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
            zIndex: 200,
          }}
        >
          <svg
            width={20}
            height={20}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      )}
    </section>
    </>
  );
}

function EmptyState({ displayName }: { displayName: string }) {
  return (
    <section
      style={{
        position: "relative",
        zIndex: 3,
        flex: 1,
        padding: "20px 20px 0",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          textAlign: "center",
          color: NEX.textDim,
          fontSize: 13,
          padding: 24,
        }}
      >
        <div>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🃏</div>
          <div>Deck is empty · say hi to {displayName}.</div>
        </div>
      </div>
    </section>
  );
}
