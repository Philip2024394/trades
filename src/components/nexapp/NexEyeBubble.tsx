// NEX Eye Bubble · small character speech bubble that appears near the orb
// when the user taps the eye. Auto-dismisses after dwellMs.
//
// Doctrine: eye is CHARACTER · voice button is FUNCTION. Bubble teaches by
// showing NEX responding conversationally to eye taps and pointing users
// toward the actual voice button.

"use client";

import React, { useEffect, useState } from "react";

interface Props {
  /** Message to show · null hides the bubble. */
  message: string | null;
  /** Milliseconds the bubble stays before auto-fade. */
  dwellMs?: number;
  /** Called when the bubble finishes fading out · caller can clear message. */
  onDismiss?: () => void;
}

export function NexEyeBubble({ message, dwellMs = 2800, onDismiss }: Props) {
  const [visible, setVisible] = useState(false);
  const [rendered, setRendered] = useState<string | null>(null);

  useEffect(() => {
    if (!message) return;
    setRendered(message);
    setVisible(true);
    const hideAt = setTimeout(() => setVisible(false), dwellMs);
    const clearAt = setTimeout(() => {
      setRendered(null);
      onDismiss?.();
    }, dwellMs + 350);
    return () => { clearTimeout(hideAt); clearTimeout(clearAt); };
  }, [message, dwellMs, onDismiss]);

  if (!rendered) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "absolute",
        // Sit just below the orb · vertically offset · centred horizontally.
        top: "calc(100% + 10px)",
        left: "50%",
        transform: `translateX(-50%) translateY(${visible ? 0 : -8}px)`,
        opacity: visible ? 1 : 0,
        transition: "opacity 320ms ease, transform 320ms ease",
        pointerEvents: "none",
        maxWidth: "min(80vw, 320px)",
        minWidth: 200,
        padding: "10px 14px",
        borderRadius: 14,
        background: "rgba(10,10,10,0.9)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        border: "1px solid rgba(249,115,22,0.4)",
        boxShadow: "0 6px 24px rgba(249,115,22,0.25), inset 0 0 0 1px rgba(255,255,255,0.05)",
        color: "rgba(245,245,245,0.95)",
        fontSize: 12,
        lineHeight: 1.4,
        textAlign: "center",
        zIndex: 40,
      }}
    >
      {/* Small tail pointing up toward the orb */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: -6,
          left: "50%",
          transform: "translateX(-50%) rotate(45deg)",
          width: 10, height: 10,
          background: "rgba(10,10,10,0.9)",
          borderTop: "1px solid rgba(249,115,22,0.4)",
          borderLeft: "1px solid rgba(249,115,22,0.4)",
        }}
      />
      {rendered}
    </div>
  );
}
