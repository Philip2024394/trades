"use client";

// src/app/nex-native/themes/_shared/gestures.tsx
//
// Bridge 28 · Shared message-gesture kit for theme previews.
// -----------------------------------------------------------
// Provides:
//   - useMessageGestures({ onSwipeReply, onLongPress })
//       returns pointer handlers you spread onto a bubble ·
//       swipe past 60px horizontally fires onSwipeReply · press &
//       hold for 450ms fires onLongPress with the pointer coords.
//   - <ReactionPicker anchor={...} onPick /> · centred floating
//     bubble of 8 emoji + a "+" that expands · positions itself
//     above the message.
//   - <ReplyChip target /> · floating "Replying to · <preview>"
//     bar that sits above the composer · has a × to cancel.
//   - <MessageReactions list /> · renders a horizontal row of
//     tiny emoji chips at the bottom of a bubble.
//
// Everything is client-only, no persistence · this is preview UI
// so you can judge the gestures. Real production work (nex_peer_
// message_reaction migration + service + wired shell) is a
// separate follow-up bridge.

import { useCallback, useEffect, useRef, useState } from "react";

const REACTION_SET = ["❤️", "🔥", "😂", "😢", "👏", "🎉", "👍", "✨"];

export interface ReactionPickerAnchor {
  x: number;
  y: number;
  side: "left" | "right";
}

export interface ReplyTarget {
  id: string;
  speaker: string;
  preview: string;
  accent: string;
}

interface UseGesturesOpts {
  messageId: string;
  side: "left" | "right";
  onSwipeReply: (id: string) => void;
  onLongPress: (id: string, anchor: ReactionPickerAnchor) => void;
}

/** Attach the returned handlers to your bubble root:
 *    const g = useMessageGestures({ ... });
 *    <div {...g}>...</div>
 *
 *  Detects a 60px horizontal swipe in the "reply-in" direction
 *  (right-swipe on left-side bubbles, left-swipe on right-side)
 *  and a 450ms hold with < 8px movement for reactions. Uses
 *  Pointer Events so it works with mouse + touch + pen. */
export function useMessageGestures({
  messageId,
  side,
  onSwipeReply,
  onLongPress,
}: UseGesturesOpts) {
  const startRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [translate, setTranslate] = useState(0);
  const fired = useRef<"reply" | "long" | null>(null);
  const SWIPE_THRESHOLD = 60;
  const LONG_PRESS_MS = 450;
  const MOVE_TOLERANCE = 8;

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      startRef.current = { x: e.clientX, y: e.clientY, t: Date.now() };
      fired.current = null;
      setTranslate(0);
      // Long-press: fire after 450ms if pointer hasn't moved much.
      longPressTimer.current = setTimeout(() => {
        const s = startRef.current;
        if (!s || fired.current) return;
        fired.current = "long";
        // Anchor picker slightly above the message on the tap point.
        onLongPress(messageId, {
          x: s.x,
          y: s.y - 60,
          side,
        });
        try {
          navigator.vibrate?.(20);
        } catch {
          // Vibrate not available on this platform · ignore.
        }
      }, LONG_PRESS_MS);
    },
    [messageId, onLongPress, side],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const s = startRef.current;
      if (!s) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      // Any significant movement kills the long-press candidate.
      if (Math.abs(dx) > MOVE_TOLERANCE || Math.abs(dy) > MOVE_TOLERANCE) {
        clearLongPress();
      }
      // Only track horizontal swipe in the correct direction:
      //   left-side bubble → swipe RIGHT to reply (dx > 0)
      //   right-side bubble → swipe LEFT to reply (dx < 0)
      const dir = side === "left" ? 1 : -1;
      const projected = Math.max(0, dx * dir);
      if (Math.abs(dy) < 30 && projected > 6) {
        setTranslate(Math.min(SWIPE_THRESHOLD + 20, projected) * dir);
      }
    },
    [side],
  );

  const onPointerUp = useCallback(() => {
    clearLongPress();
    const dir = side === "left" ? 1 : -1;
    const projected = translate * dir;
    if (projected >= SWIPE_THRESHOLD && fired.current !== "long") {
      fired.current = "reply";
      onSwipeReply(messageId);
    }
    setTranslate(0);
    startRef.current = null;
  }, [messageId, onSwipeReply, side, translate]);

  const onPointerCancel = useCallback(() => {
    clearLongPress();
    setTranslate(0);
    startRef.current = null;
  }, []);

  return {
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
    },
    translate,
  };
}

/** Floating emoji picker · positions above the pressed message ·
 *  8 emojis in a horizontal pill · click outside or Esc closes. */
export function ReactionPicker({
  anchor,
  onPick,
  onClose,
}: {
  anchor: ReactionPickerAnchor | null;
  onPick: (emoji: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!anchor) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [anchor, onClose]);

  if (!anchor) return null;

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 40,
          background: "transparent",
        }}
      />
      <div
        role="dialog"
        aria-label="React with emoji"
        style={{
          position: "fixed",
          zIndex: 41,
          left: Math.max(8, Math.min(anchor.x - 140, window.innerWidth - 288)),
          top: Math.max(env(), anchor.y),
          padding: "8px 10px",
          borderRadius: 999,
          background: "rgba(20, 12, 28, 0.90)",
          border: "1px solid rgba(255, 139, 197, 0.55)",
          boxShadow:
            "0 12px 32px rgba(0,0,0,0.55), 0 0 24px rgba(255,79,163,0.20)",
          backdropFilter: "blur(18px) saturate(140%)",
          WebkitBackdropFilter: "blur(18px) saturate(140%)",
          display: "flex",
          alignItems: "center",
          gap: 4,
          animation: "nex-gesture-pop 180ms cubic-bezier(.2,.7,.2,1) both",
        }}
      >
        <style>{`
          @keyframes nex-gesture-pop {
            from { opacity: 0; transform: translateY(4px) scale(.92); }
            to   { opacity: 1; transform: translateY(0)   scale(1);   }
          }
          @keyframes nex-gesture-emoji-pop {
            0%   { transform: scale(1); }
            50%  { transform: scale(1.25); }
            100% { transform: scale(1); }
          }
        `}</style>
        {REACTION_SET.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => onPick(e)}
            aria-label={`React ${e}`}
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
            {e}
          </button>
        ))}
      </div>
    </>
  );
}

function env() {
  // Rough safe-area top so the picker never hides behind the notch.
  return typeof window !== "undefined" ? 64 : 0;
}

/** Floating "Replying to · X" chip that sits above the composer.
 *  × cancels · tap the chip to jump to the source (no-op in preview). */
export function ReplyChip({
  target,
  onCancel,
  accentFallback = "#FF4FA3",
}: {
  target: ReplyTarget | null;
  onCancel: () => void;
  accentFallback?: string;
}) {
  if (!target) return null;
  const accent = target.accent || accentFallback;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "relative",
        margin: "6px 12px 0",
        padding: "8px 10px 8px 12px",
        borderRadius: 12,
        background: "rgba(20, 12, 28, 0.72)",
        border: `1px solid ${accent}55`,
        borderLeft: `3px solid ${accent}`,
        color: "#FFF5FA",
        display: "flex",
        alignItems: "center",
        gap: 10,
        backdropFilter: "blur(14px) saturate(140%)",
        WebkitBackdropFilter: "blur(14px) saturate(140%)",
        fontFamily:
          "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 9,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            fontWeight: 700,
            color: accent,
          }}
        >
          Replying to · {target.speaker}
        </div>
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.35,
            marginTop: 2,
            color: "rgba(255,245,250,0.85)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {target.preview}
        </div>
      </div>
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancel reply"
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "rgba(0,0,0,0.35)",
          border: "1px solid rgba(255,255,255,0.14)",
          color: "#FFD4E8",
          cursor: "pointer",
          padding: 0,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
          <line
            x1="18"
            y1="6"
            x2="6"
            y2="18"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <line
            x1="6"
            y1="6"
            x2="18"
            y2="18"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}

/** Renders the reaction chips row at the bottom of a message.
 *  Groups duplicates and shows a count when > 1. */
export function MessageReactions({
  list,
  accent = "#FFF",
  align = "left",
}: {
  list: string[];
  accent?: string;
  align?: "left" | "right";
}) {
  if (!list.length) return null;
  const grouped = new Map<string, number>();
  for (const e of list) grouped.set(e, (grouped.get(e) ?? 0) + 1);
  return (
    <div
      style={{
        display: "flex",
        justifyContent: align === "right" ? "flex-end" : "flex-start",
        flexWrap: "wrap",
        gap: 4,
        marginTop: 6,
      }}
    >
      {Array.from(grouped.entries()).map(([emoji, count]) => (
        <span
          key={emoji}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            padding: "2px 8px",
            borderRadius: 999,
            background: "rgba(0, 0, 0, 0.55)",
            border: `1px solid ${accent}55`,
            fontSize: 12,
            lineHeight: 1,
            color: "#FFF",
            animation: "nex-gesture-emoji-pop 220ms cubic-bezier(.2,.7,.2,1)",
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
  );
}
