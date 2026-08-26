"use client";

// src/components/nex-directory/SmartDiscoveryCard.tsx
//
// NEX Smart Discovery Card wrapper (2026-08-24 prototype).
//
// Wraps an existing business card with a 3D flip surface. The FRONT is the
// existing card (unchanged). The BACK is a compact Smart Discovery panel
// showing a real "what's useful around this place" signal (or clearly-marked
// demo). Flipping is CONTROLLED · this component does not decide when to flip
// · the SmartDiscoveryController orchestrates timing to enforce the 1-2
// flips-per-session rule.
//
// Doctrine (Philip 2026-08-24):
//   · Don't hard-code the flip into cards · reusable system.
//   · Restrained animation · respects prefers-reduced-motion.
//   · Cancellable on user interaction.
//   · "surprise and usefulness, not distraction"
//   · "NEX found something useful about this place" · not "ADVERTISEMENT!"

import { useEffect, useRef } from "react";
import type { SmartDiscoverySignal } from "@/lib/nex-accommodation/smart-discovery-signals";

interface Props {
  publicListingRef: string;
  signal: SmartDiscoverySignal;
  isFlipped: boolean;
  onFlipComplete?: () => void;    // fired when the back has been shown then flipped back
  onUserCancel?: () => void;      // fired if the user clicks/interacts while flipped
  onDetailsClick?: () => void;    // opens the accommodation detail slider from the back
  children: React.ReactNode;      // the FRONT · the existing card
}

export function SmartDiscoveryCard({
  publicListingRef, signal, isFlipped, onFlipComplete, onUserCancel, onDetailsClick, children,
}: Props): React.JSX.Element {
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // If reduced-motion is preferred, we STILL surface the signal · but as a
  // subtle static ribbon at the top of the card instead of a flip. That is
  // enforced by the parent controller (which never sets isFlipped=true when
  // reduced-motion applies · see SmartDiscoveryController).

  // Cancel on user interaction while flipped (click / touch / keyboard).
  useEffect(() => {
    if (!isFlipped || !onUserCancel) return;
    const el = wrapperRef.current;
    if (!el) return;
    const handler = (e: Event) => {
      // Allow the "Details" button on the back to fire without cancelling.
      const t = e.target as HTMLElement | null;
      if (t && t.closest("[data-nex-flip-details]")) return;
      onUserCancel();
    };
    el.addEventListener("click", handler);
    el.addEventListener("touchstart", handler, { passive: true });
    return () => {
      el.removeEventListener("click", handler);
      el.removeEventListener("touchstart", handler);
    };
  }, [isFlipped, onUserCancel]);

  // Auto-flip-back after 3.5s of showing the back · signals the controller.
  useEffect(() => {
    if (!isFlipped) return;
    const t = setTimeout(() => { onFlipComplete?.(); }, 3500);
    return () => clearTimeout(t);
  }, [isFlipped, onFlipComplete]);

  const emoji = signal.emoji;

  return (
    <div
      ref={wrapperRef}
      data-smart-discovery-ref={publicListingRef}
      style={{ perspective: 1200, position: "relative" }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          transformStyle: "preserve-3d",
          transition: "transform 720ms cubic-bezier(.4, .2, .2, 1)",
          transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* FRONT · the existing card, unchanged */}
        <div style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}>
          {children}
        </div>

        {/* BACK · Smart Discovery panel */}
        <div
          style={{
            position: "absolute", inset: 0,
            backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            borderRadius: 16,
            overflow: "hidden",
            background: signal.isDemo
              ? "linear-gradient(135deg, #f5f2ea 0%, #ede9df 100%)"
              : "linear-gradient(135deg, #fff5eb 0%, #ffeed4 100%)",
            border: signal.isDemo
              ? "1px dashed rgba(0,0,0,0.16)"
              : "1px solid rgba(255,120,30,0.28)",
            padding: 16,
            display: "flex", flexDirection: "column", gap: 10,
            boxShadow: signal.isDemo ? "none" : "0 3px 12px rgba(255,120,30,0.10)",
          }}
          aria-hidden={!isFlipped}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 22, lineHeight: 1 }}>{emoji}</span>
            <span style={{
              fontSize: 9.5, letterSpacing: 1.2, textTransform: "uppercase",
              color: signal.isDemo ? "#8a8776" : "#c2410c", fontWeight: 800,
            }}>
              {signal.isDemo ? "NEX Prototype signal" : "NEX Smart Discovery"}
            </span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#1a1a1a", lineHeight: 1.2, letterSpacing: "-0.005em" }}>
            {signal.title}
          </div>
          <div style={{ fontSize: 12.5, color: "#4a4a4a", lineHeight: 1.45, flex: 1 }}>
            {signal.body}
          </div>
          {onDetailsClick && (
            <button
              type="button"
              data-nex-flip-details
              onClick={(e) => { e.stopPropagation(); onDetailsClick(); }}
              style={{
                alignSelf: "flex-start",
                padding: "6px 12px",
                borderRadius: 999,
                border: "none",
                background: signal.isDemo ? "rgba(0,0,0,0.06)" : "#c2410c",
                color: signal.isDemo ? "#555" : "#fff",
                fontSize: 11.5, fontWeight: 700, cursor: "pointer",
              }}
            >
              {signal.cta}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
