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

// Haunted Hotel reaction set · same shape as the Joker _shared
// gestures ReactionPicker (8 emojis + the floating-pill panel).
// Prototype-only · reactions live in local state, not persisted.
const REACTION_SET = ["❤️", "🔥", "😂", "😢", "👏", "🎉", "👍", "✨"] as const;

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
  // Reaction state · per-message emoji list + which bubble's picker is
  // currently open (if any). Picker anchor is captured from the button's
  // bounding rect so the floating pill sits above the clicked smiley.
  const [reactions, setReactions] = React.useState<Record<string, string[]>>({});
  const [pickerFor, setPickerFor] = React.useState<string | null>(null);
  const [pickerAnchor, setPickerAnchor] = React.useState<{ x: number; y: number } | null>(null);
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
            padding: "10px 14px 10px",
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
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
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
          {/* Reaction chips · existing emoji grouped + counted · appear
              above the smiley button so stacking reads bubble → chips
              → trigger. */}
          {reactions[replyingTo.id] && reactions[replyingTo.id].length > 0 ? (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 4,
                marginTop: 8,
              }}
            >
              {Array.from(
                reactions[replyingTo.id].reduce((map, e) => {
                  map.set(e, (map.get(e) ?? 0) + 1);
                  return map;
                }, new Map<string, number>()),
              ).map(([emoji, count]) => (
                <span
                  key={emoji}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 3,
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: "rgba(0,0,0,0.55)",
                    border: "1px solid rgba(216,168,86,0.4)",
                    fontSize: 12,
                    lineHeight: 1,
                    color: "#FFF",
                  }}
                >
                  <span aria-hidden>{emoji}</span>
                  {count > 1 && (
                    <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.85 }}>
                      {count}
                    </span>
                  )}
                </span>
              ))}
            </div>
          ) : null}
          {/* Smiley reaction trigger · Joker-flow panel style ·
              anchored under the replying-to bubble. Click opens the
              floating 8-emoji pill. */}
          <button
            type="button"
            aria-label="Add reaction"
            onClick={(e) => {
              e.stopPropagation();
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setPickerAnchor({ x: r.left + r.width / 2, y: r.top });
              setPickerFor(pickerFor === replyingTo.id ? null : replyingTo.id);
            }}
            style={{
              marginTop: 6,
              alignSelf: "flex-start",
              width: 14,
              height: 14,
              padding: 0,
              borderRadius: "50%",
              border: "1px solid rgba(180,180,180,0.4)",
              background: "transparent",
              color: "rgba(200,200,200,0.75)",
              cursor: "pointer",
              display: "inline-grid",
              placeItems: "center",
            }}
          >
            <SmileyGlyph />
          </button>
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
                // Haunted Hotel card · Candlelit Parchment (Prototype 02
                // from the haunted-hotel-bubbles gallery). Warm aged-paper
                // gradient on the owner side, slightly cooler parchment
                // on the peer side so you can still read who's talking.
                // Rim colour rgba(216,168,86,0.85) is the EXACT value
                // the composer footer uses — derived from the
                // depth-cards themeAccent "#d8a856" via composerRim()
                // at 0.85 alpha. One amber tone shared across cards
                // and composer.
                borderRadius: mine ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                background: mine
                  ? "linear-gradient(145deg, #f5e9ca 0%, #e9d6a4 55%, #d9bf85 100%)"
                  : "linear-gradient(145deg, #ede4d0 0%, #ddd0ae 55%, #c7b89a 100%)",
                border: "1px solid rgba(216, 168, 86, 0.85)",
                color: "#3a2612",
                fontSize: isTop ? 16 : 14,
                lineHeight: 1.42,
                transform: `translateY(${translateY}px) translateZ(${translateZ}px) scale(${scale})`,
                transformOrigin: "50% 100%",
                opacity,
                boxShadow: `0 ${mine ? 24 : 18}px ${mine ? 42 : 36}px rgba(0,0,0,${0.52 - depth * 0.06}), inset 0 1px 0 rgba(255, 240, 190, 0.4)`,
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
              {/* Joker-pattern · newest reaction stamps the top-right
                  corner of the bubble, overlapping the rim. */}
              {reactions[m.id] && reactions[m.id].length > 0 ? (
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: -10,
                    right: -8,
                    fontSize: 20,
                    lineHeight: 1,
                    filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.75))",
                    pointerEvents: "none",
                  }}
                >
                  {reactions[m.id][reactions[m.id].length - 1]}
                </span>
              ) : null}

              <div
                style={{
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {m.body}
              </div>

              {/* Joker-pattern · chip row below the bubble body.
                  Each distinct emoji becomes a pill with its count. */}
              {reactions[m.id] && reactions[m.id].length > 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 4,
                    marginTop: 6,
                    justifyContent: mine ? "flex-end" : "flex-start",
                  }}
                >
                  {Array.from(
                    reactions[m.id].reduce((map, e) => {
                      map.set(e, (map.get(e) ?? 0) + 1);
                      return map;
                    }, new Map<string, number>()),
                  ).map(([emoji, count]) => (
                    <span
                      key={emoji}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 3,
                        padding: "2px 8px",
                        borderRadius: 999,
                        background: "rgba(0,0,0,0.55)",
                        border: "1px solid rgba(216,168,86,0.4)",
                        fontSize: 12,
                        lineHeight: 1,
                        color: "#FFF",
                      }}
                    >
                      <span aria-hidden>{emoji}</span>
                      {count > 1 && (
                        <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.85 }}>
                          {count}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              ) : null}

              <div
                style={{
                  marginTop: 6,
                  fontSize: 10,
                  letterSpacing: "0.04em",
                  // Parchment uses dark-brown text so timestamps + chevron
                  // sit legibly on both sides. Same tone as the main body
                  // text (#3a2612), slightly transparent for subordinacy.
                  color: "rgba(58, 38, 18, 0.65)",
                  textAlign: "right",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 6,
                  alignItems: "center",
                }}
              >
                {/* Joker-pattern · tiny +😊 chip opens the reaction
                    picker · only on the top card so the deck's lower
                    stack stays visually clean. */}
                {isTop ? (
                  <button
                    type="button"
                    aria-label="Add reaction"
                    onClick={(e) => {
                      e.stopPropagation();
                      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      setPickerAnchor({ x: r.left + r.width / 2, y: r.top });
                      setPickerFor(pickerFor === m.id ? null : m.id);
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 2,
                      padding: "2px 6px",
                      height: 16,
                      borderRadius: 999,
                      border: "1px solid rgba(180,180,180,0.4)",
                      background: "transparent",
                      color: "rgba(200,200,200,0.75)",
                      cursor: "pointer",
                      fontSize: 10,
                      lineHeight: 1,
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>+</span>
                    <SmileyGlyph />
                  </button>
                ) : (
                  <span aria-hidden style={{ width: 1 }} />
                )}
                <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
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
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating Joker-style reaction picker · pill with 8 emoji ·
          anchored to the smiley button of the active message. Click
          outside dismisses. */}
      {pickerFor && pickerAnchor ? (
        <>
          <div
            onClick={() => setPickerFor(null)}
            aria-hidden
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 400,
              background: "transparent",
            }}
          />
          <div
            role="dialog"
            aria-label="React with emoji"
            style={{
              position: "fixed",
              zIndex: 401,
              left: Math.max(
                8,
                Math.min(
                  pickerAnchor.x - 160,
                  (typeof window !== "undefined" ? window.innerWidth : 400) - 328,
                ),
              ),
              top: Math.max(72, pickerAnchor.y - 56),
              padding: "8px 10px",
              borderRadius: 999,
              background: "rgba(20, 14, 10, 0.92)",
              border: "1px solid rgba(216,168,86,0.55)",
              boxShadow:
                "0 12px 32px rgba(0,0,0,0.6), 0 0 24px rgba(216,168,86,0.2)",
              backdropFilter: "blur(18px) saturate(140%)",
              WebkitBackdropFilter: "blur(18px) saturate(140%)",
              display: "flex",
              alignItems: "center",
              gap: 4,
              animationName: "hh-reaction-pop",
              animationDuration: "180ms",
              animationTimingFunction: "cubic-bezier(.2,.7,.2,1)",
              animationFillMode: "both",
            }}
          >
            <style>{`
              @keyframes hh-reaction-pop {
                from { opacity: 0; transform: translateY(4px) scale(.92); }
                to   { opacity: 1; transform: translateY(0)   scale(1);   }
              }
            `}</style>
            {REACTION_SET.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  setReactions((prev) => {
                    const next = { ...prev };
                    const existing = next[pickerFor] ?? [];
                    next[pickerFor] = [...existing, emoji];
                    return next;
                  });
                  setPickerFor(null);
                }}
                aria-label={`React ${emoji}`}
                style={{
                  width: 32,
                  height: 32,
                  padding: 0,
                  borderRadius: 999,
                  background: "transparent",
                  border: "none",
                  fontSize: 20,
                  cursor: "pointer",
                  lineHeight: 1,
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {/* Date label · Today / Yesterday / weekday / Month-day pill ·
          references the newest message currently visible in the deck. */}
      {deck.length > 0 ? (
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
          <DateLabel iso={deck[deck.length - 1]!.sent_at} />
        </div>
      ) : null}

    </section>
    </>
  );
}

// SSR-safe date label · renders the absolute date (deterministic) on
// the server, then on client mount flips to "Today" / "Yesterday" /
// weekday for recent dates. This avoids hydration mismatch while
// still giving the viewer a human-readable anchor.
function DateLabel({ iso }: { iso: string }): React.JSX.Element {
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => {
    setHydrated(true);
  }, []);

  const d = new Date(iso);
  // Deterministic UTC "Month Day" string for SSR + pre-hydration.
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const absolute = `${monthNames[d.getUTCMonth()]} ${d.getUTCDate()}`;

  if (!hydrated) return <>{absolute}</>;

  const now = new Date();
  const msgLocal = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const nowLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round(
    (nowLocal.getTime() - msgLocal.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays === 0) return <>Today</>;
  if (diffDays === 1) return <>Yesterday</>;
  if (diffDays > 1 && diffDays < 7) {
    return <>{d.toLocaleDateString([], { weekday: "long" })}</>;
  }
  return <>{absolute}</>;
}

function SmileyGlyph() {
  return (
    <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <circle cx="9" cy="10" r="1.2" fill="currentColor" />
      <circle cx="15" cy="10" r="1.2" fill="currentColor" />
      <path d="M 8 14 Q 12 17, 16 14" strokeLinecap="round" />
    </svg>
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
