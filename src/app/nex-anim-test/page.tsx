// NEX ANIMATION TEST · Philip 2026-08-28 · isolated Phase 2 proof.
//
// Purpose: prove ONE animation — a NEX text placed on the LEFT that launches
// diagonally at 45° up-right off the screen. Nothing else.
//
// Does NOT touch: /nexapp, NexWorkspaceChat, the anchor, the composer, or
// any shared component. Standalone route for visual approval only.

"use client";

import { useState } from "react";
import { motion } from "framer-motion";

export default function NexAnimTestPage() {
  const [launched, setLaunched] = useState(false);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        overflow: "hidden",
        fontFamily: `-apple-system, "SF Pro Text", "Segoe UI", system-ui, sans-serif`,
        color: "#fff",
      }}
    >
      {/* ONE NEX text · placed on the LEFT · flies diagonally to top-right. */}
      <motion.div
        initial={false}
        animate={
          launched
            ? {
                x: "120vw",     // travel across the whole viewport width
                y: "-60vh",     // and upward
                rotate: 45,     // subtle rotation during flight
                scale: 0.45,    // shrink
                opacity: 0,     // fade
              }
            : {
                x: 0,
                y: 0,
                rotate: 0,
                scale: 1,
                opacity: 1,
              }
        }
        transition={{
          duration: 1.1,
          ease: [0.4, 0.0, 0.2, 1],   // natural material ease
        }}
        style={{
          position: "absolute",
          top: "35%",
          left: "6%",
          maxWidth: "45%",
          transformOrigin: "top left",
          textAlign: "left",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 0.6,
            lineHeight: 1,
            color: "rgba(245,245,245,0.75)",
            marginBottom: 4,
          }}
        >
          NE<span style={{ color: "#f97316" }}>X</span>
        </div>
        <div
          style={{
            fontSize: 15,
            lineHeight: 1.4,
            color: "rgba(245,245,245,0.94)",
            fontWeight: 400,
            letterSpacing: 0.1,
            whiteSpace: "pre-wrap",
          }}
        >
          Hi. Ask me anything — food, stays, markets, or transport in your city.
        </div>
        <div
          style={{
            fontSize: 10,
            color: "rgba(245,245,245,0.32)",
            letterSpacing: 0.3,
            marginTop: 2,
          }}
        >
          10:24 AM
        </div>
      </motion.div>

      {/* Launch controls · centred at bottom · minimal test UI only. */}
      <div
        style={{
          position: "absolute",
          bottom: 32,
          left: 0,
          right: 0,
          display: "flex",
          gap: 12,
          justifyContent: "center",
          zIndex: 10,
        }}
      >
        <button
          type="button"
          onClick={() => setLaunched(true)}
          disabled={launched}
          style={{
            padding: "10px 24px",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 0.5,
            color: launched ? "rgba(245,245,245,0.4)" : "#000",
            background: launched ? "#333" : "#f97316",
            border: "none",
            borderRadius: 999,
            cursor: launched ? "default" : "pointer",
          }}
        >
          {launched ? "LAUNCHED" : "LAUNCH"}
        </button>
        <button
          type="button"
          onClick={() => setLaunched(false)}
          style={{
            padding: "10px 24px",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 0.5,
            color: "rgba(245,245,245,0.9)",
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.3)",
            borderRadius: 999,
            cursor: "pointer",
          }}
        >
          RESET
        </button>
      </div>

      {/* Route label · sits corner · doesn't affect the test. */}
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          fontSize: 10,
          letterSpacing: 0.5,
          color: "rgba(245,245,245,0.45)",
          fontWeight: 600,
        }}
      >
        NEX ANIM TEST · /nex-anim-test · tap LAUNCH
      </div>
    </div>
  );
}
