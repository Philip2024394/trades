// NEX Tooltip · F3.5 (2026-08-25).
//
// Every NEX mascot / action explains itself through this component. NOT the
// browser native title="" tooltip. Matches the existing NEX visual language
// (charcoal · orange rim · frosted-black card).
//
// Desktop:   hover → tooltip · subtle fade-in · positioned above the mascot
// Touch:     tap-and-hold → tooltip · dismisses on release or outside tap
// Keyboard:  focus → tooltip · Escape dismisses
// Reduced motion: no fade animation
//
// Content shape:
//   title · e.g. "💣 Grenade" or "😂 Laughing NEX"
//   body  · one-line explanation
//   cost  · optional "· 100 Sparks"
//
// The tooltip renders as an absolutely-positioned child of the wrapped
// element · uses portal-free positioning to avoid stacking-context issues.

"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { NEX } from "@/lib/nexapp/tokens";

export type NexTooltipContent = {
  title: string;
  body: string;
  cost?: string;
};

const LONG_PRESS_MS = 400;

export function NexTooltip({
  content,
  children,
  placement = "top",
}: {
  content: NexTooltipContent;
  children: ReactNode;
  placement?: "top" | "bottom";
}) {
  const [visible, setVisible] = useState(false);
  const tipId = useId();
  const pressTimer = useRef<number | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);

  // Dismiss on Escape while visible
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setVisible(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible]);

  const startPress = () => {
    if (pressTimer.current !== null) return;
    pressTimer.current = window.setTimeout(() => setVisible(true), LONG_PRESS_MS);
  };
  const endPress = () => {
    if (pressTimer.current !== null) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    setVisible(false);
  };

  return (
    <span
      ref={wrapRef}
      style={{ position: "relative", display: "inline-block", lineHeight: 0 }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocusCapture={() => setVisible(true)}
      onBlurCapture={() => setVisible(false)}
      onTouchStart={startPress}
      onTouchEnd={endPress}
      onTouchCancel={endPress}
      aria-describedby={visible ? tipId : undefined}
    >
      {children}
      {visible && (
        <span
          id={tipId}
          role="tooltip"
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            [placement === "top" ? "bottom" : "top"]: "calc(100% + 8px)",
            zIndex: 40,
            pointerEvents: "none",
            minWidth: 180,
            maxWidth: 240,
            padding: "8px 12px",
            background: "rgba(0,0,0,0.92)",
            border: `1px solid ${NEX.orange}`,
            borderRadius: 12,
            boxShadow: `0 8px 24px rgba(0,0,0,0.6), 0 0 12px ${NEX.orangeGlowLo}`,
            color: NEX.text,
            fontSize: 12,
            lineHeight: 1.35,
            textAlign: "center" as const,
            animation: "nex-tooltip-fade 140ms ease-out",
          }}
        >
          <style>{`
            @keyframes nex-tooltip-fade {
              from { opacity: 0; transform: translateX(-50%) translateY(${placement === "top" ? "4px" : "-4px"}); }
              to   { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
            @media (prefers-reduced-motion: reduce) {
              [role="tooltip"] { animation: none !important; }
            }
          `}</style>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>{content.title}</div>
          <div style={{ color: NEX.textMuted, fontSize: 11 }}>
            {content.body}
            {content.cost && (
              <>
                {" · "}
                <span style={{ color: NEX.orange, fontWeight: 600 }}>{content.cost}</span>
              </>
            )}
          </div>
        </span>
      )}
    </span>
  );
}

// Convenience · derive default tooltip content from a NexAction registry row.
export function tooltipForAction(action: {
  id: string;
  tier: "reaction" | "intelligence" | "action" | "consumable";
  mascot: { label: string };
  cost?: { sparks: number };
}): NexTooltipContent {
  // Label is the sole title now (Philip 2026-08-25 · "remove NEX name") ·
  // no glyph prefix since the mascot image already appears next to the tip.
  const title = action.mascot.label;
  // Consequence-oriented copy · tell the user what will HAPPEN if they use
  // this mascot, not just what the mascot represents (Philip 2026-08-25).
  const body =
    action.id === "grenade"    ? "Blow up your own post with a cinematic explosion" :
    action.id === "weather"    ? "NEX posts the current weather at your location into the chat" :
    action.id === "birthday"   ? "NEX posts a birthday message with a cinematic celebration" :
    action.id === "reminder"   ? "Schedule a message to arrive at a future time" :
    action.id === "currency"   ? "NEX posts today's exchange rate into the chat" :
    action.id === "coffee"     ? "NEX picks a nearby coffee spot and posts a suggestion" :
    action.id === "food"       ? "NEX picks a nearby restaurant and posts a suggestion" :
    action.id === "date"       ? "NEX picks a date-night venue nearby and posts a suggestion" :
    action.id === "cinema"     ? "NEX finds a cinema with tonight's showtimes and posts it" :
    action.id === "beach"      ? "NEX finds a nearby beach + current conditions" :
    action.id === "walk"       ? "NEX picks a nearby walking spot and posts a suggestion" :
    action.tier === "reaction" ? "React to this post" :
    "Post this action to the chat";
  const cost = action.cost?.sparks ? `${action.cost.sparks} Sparks` : undefined;
  return { title, body, cost };
}
