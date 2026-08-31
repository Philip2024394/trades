"use client";

// src/components/nex-directory/NexCallSlider.tsx
//
// Placeholder slider for the Call + Video buttons on business cards.
// Philip 2026-08-27: "add the call and video button for now" · UI only ·
// backend (WebRTC + signalling + TURN) is scoped in ADR-0100 and awaits
// approval before any code lands.
//
// When the caller taps Call or Video on a business card, this slider slides
// up from the bottom, shows a NEX-branded placeholder, and explains that
// NEX Internal Calling is coming. No real call happens.

import { useEffect } from "react";

export interface CallSliderTarget {
  businessName: string;
  city?: string | null;
  category?: string | null;
  mode: "voice" | "video";
}

export function NexCallSlider({
  target,
  onClose,
}: {
  target: CallSliderTarget | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!target) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [target, onClose]);

  if (!target) return null;

  const isVideo = target.mode === "video";

  return (
    <>
      {/* Scrim */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          zIndex: 500, animation: "nex-fade 0.2s ease-out",
        }}
      />
      {/* Sheet · slides up from bottom */}
      <div
        style={{
          position: "fixed", left: 0, right: 0, bottom: 0,
          background: "#faf7f2", borderTopLeftRadius: 24, borderTopRightRadius: 24,
          zIndex: 501, padding: "24px 20px 32px",
          maxWidth: 480, margin: "0 auto",
          boxShadow: "0 -8px 32px rgba(0,0,0,0.15)",
          animation: "nex-slide-up 0.28s cubic-bezier(0.25,0.8,0.25,1)",
        }}
      >
        {/* Handle */}
        <div style={{
          width: 40, height: 4, background: "rgba(0,0,0,0.15)", borderRadius: 999,
          margin: "0 auto 20px",
        }} />

        {/* Hero glyph */}
        <div style={{
          width: 80, height: 80, borderRadius: "50%",
          background: isVideo ? "#dbeafe" : "#dcfce7",
          margin: "0 auto 16px",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 36,
        }}>
          {isVideo ? "🎥" : "📞"}
        </div>

        {/* Titles */}
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 12, letterSpacing: 1.2, color: "#8a8776", textTransform: "uppercase", marginBottom: 6 }}>
            {isVideo ? "NEX Video Call" : "NEX Voice Call"}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#1a1a1a", lineHeight: 1.2 }}>
            {target.businessName}
          </div>
          {(target.category || target.city) && (
            <div style={{ marginTop: 6, fontSize: 13, color: "#666" }}>
              {target.category ? target.category : ""}{target.category && target.city ? " · " : ""}{target.city ?? ""}
            </div>
          )}
        </div>

        {/* Placeholder message */}
        <div style={{
          background: "#fff", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 12,
          padding: 16, marginBottom: 16, textAlign: "center",
        }}>
          <div style={{ fontSize: 14, color: "#1a1a1a", fontWeight: 600, marginBottom: 6 }}>
            NEX Internal Calling · coming soon
          </div>
          <div style={{ fontSize: 12, color: "#666", lineHeight: 1.5 }}>
            You&apos;ll be able to {isVideo ? "video call" : "voice call"} this business
            directly through NEX identity — no phone number, no third-party dialer.
          </div>
          <div style={{ marginTop: 12, fontSize: 10, color: "#8a8776", letterSpacing: 0.5 }}>
            Requires the business to be a paid NEX customer.
          </div>
        </div>

        {/* CTA row */}
        <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1, padding: "12px 16px", background: "#1a1a1a", color: "#fff",
              border: "none", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}
          >
            Got it
          </button>
        </div>

        <style>{`
          @keyframes nex-slide-up {
            from { transform: translateY(100%); }
            to   { transform: translateY(0); }
          }
          @keyframes nex-fade {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
        `}</style>
      </div>
    </>
  );
}
