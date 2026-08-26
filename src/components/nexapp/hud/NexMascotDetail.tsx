// NEX Mascot Detail overlay · Philip 2026-08-27 · future-style.
//
// Opens when a mascot in the drawer grid is tapped. Frosted-black sheet
// morphs in from the grid mascot's position (shared framer layoutId), lands
// centred, with a red close button ABOVE the mascot and a green post-to-chat
// button BELOW. Reverse choreography on close · mascot shrinks back to its
// grid position, sheet contracts, overlay fades.
//
// Sci-fi treatment:
//   · rotating conic-gradient rim (accent-tinted)
//   · HUD-style corner tick marks
//   · vertical scan-line sweep
//   · mascot floats with soft drop shadow
//   · pulsing rings around the red/green buttons

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import type { Mascot } from "@/lib/nex-mascots/types";
import type { NexHudTheme } from "./theme";

interface Props {
  mascot: Mascot | null;
  theme: NexHudTheme;
  onClose: () => void;
  onPost: (m: Mascot) => void;
}

export function NexMascotDetail({ mascot, theme, onClose, onPost }: Props) {
  // Esc key closes the overlay · quality-of-life.
  useEffect(() => {
    if (!mascot) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [mascot, onClose]);

  return (
    <AnimatePresence>
      {mascot && (
        <motion.div
          key={`detail-overlay-${mascot.id}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
          onClick={onClose}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 5,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            background: "rgba(0,0,0,0.60)",
            backdropFilter: "blur(18px) saturate(1.15)",
            WebkitBackdropFilter: "blur(18px) saturate(1.15)",
            cursor: "pointer",
          }}
        >
          <motion.div
            key={`detail-sheet-${mascot.id}`}
            initial={{ scale: 0.55, opacity: 0, rotateX: 10, y: 12 }}
            animate={{ scale: 1,    opacity: 1, rotateX: 0,  y: 0  }}
            exit={{    scale: 0.55, opacity: 0, rotateX: 10, y: 12 }}
            transition={{ type: "spring", damping: 22, stiffness: 240 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              width: "82%",
              maxWidth: 260,
              aspectRatio: "3 / 4",
              borderRadius: 20,
              overflow: "visible",
              cursor: "default",
              transformStyle: "preserve-3d",
            }}
          >
            {/* Philip 2026-08-27 · orange conic rim removed · sheet reads
                as a clean black frosted plate now, no theme-tinted border. */}

            {/* Inner frosted-black sheet. */}
            <div
              style={{
                position: "absolute",
                inset: 1,
                borderRadius: 19,
                background: "linear-gradient(150deg, rgba(12,12,16,0.94) 0%, rgba(4,4,7,0.98) 100%)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                boxShadow: "0 22px 60px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.04)",
                overflow: "hidden",
                zIndex: 1,
              }}
            >
              {/* HUD corner tick marks. */}
              <CornerTicks color={theme.accents.primary} />

              {/* Scan-line sweep · continuous vertical pass. */}
              <motion.div
                aria-hidden
                initial={{ y: "-20%" }}
                animate={{ y: "110%" }}
                transition={{ duration: 3.2, repeat: Infinity, ease: "linear" }}
                style={{
                  position: "absolute",
                  top: 0, left: 0, right: 0,
                  height: "22%",
                  background: `linear-gradient(180deg, transparent 0%, ${theme.accents.primary}1a 50%, transparent 100%)`,
                  pointerEvents: "none",
                  zIndex: 2,
                }}
              />

              {/* Subtle grid overlay · reads as HUD readout. */}
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundImage: `
                    linear-gradient(to right, rgba(255,255,255,0.025) 1px, transparent 1px),
                    linear-gradient(to bottom, rgba(255,255,255,0.025) 1px, transparent 1px)
                  `,
                  backgroundSize: "24px 24px",
                  pointerEvents: "none",
                  zIndex: 2,
                }}
              />
            </div>

            {/* Sheet content · red top button · mascot mid · green bottom button. */}
            <div
              style={{
                position: "relative",
                zIndex: 3,
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "18px 14px 30px",
                boxSizing: "border-box",
              }}
            >
              <ActionButton kind="close" onClick={onClose} />
              <MascotDisplay mascot={mascot} />
              <ActionButton kind="send" onClick={() => onPost(mascot)} />
            </div>

            {/* Mascot name · caption strip at the very bottom of the sheet. */}
            <div
              style={{
                position: "absolute",
                bottom: 10, left: 0, right: 0,
                textAlign: "center",
                zIndex: 3,
                fontSize: 9,
                color: "rgba(245,245,245,0.55)",
                letterSpacing: 2.2,
                textTransform: "uppercase",
                fontWeight: 600,
                pointerEvents: "none",
              }}
            >
              {mascot.name}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function CornerTicks({ color }: { color: string }) {
  const size = 14;
  const w = 1.5;
  const inset = 8;
  const common: React.CSSProperties = {
    position: "absolute",
    width: size,
    height: size,
    borderColor: color,
    borderStyle: "solid",
    borderWidth: 0,
    opacity: 0.6,
    pointerEvents: "none",
    zIndex: 3,
  };
  return (
    <>
      <div style={{ ...common, top: inset,     left: inset,    borderTopWidth: w, borderLeftWidth:  w, borderTopLeftRadius: 3 }} />
      <div style={{ ...common, top: inset,     right: inset,   borderTopWidth: w, borderRightWidth: w, borderTopRightRadius: 3 }} />
      <div style={{ ...common, bottom: inset,  left: inset,    borderBottomWidth: w, borderLeftWidth:  w, borderBottomLeftRadius: 3 }} />
      <div style={{ ...common, bottom: inset,  right: inset,   borderBottomWidth: w, borderRightWidth: w, borderBottomRightRadius: 3 }} />
    </>
  );
}

function MascotDisplay({ mascot }: { mascot: Mascot }) {
  if (!mascot.hasArtwork) {
    return (
      <div style={{
        color: "rgba(255,255,255,0.6)",
        fontSize: 11,
        textAlign: "center",
        padding: 12,
      }}>
        {mascot.name}
        <div style={{ fontSize: 9, opacity: 0.55, marginTop: 4 }}>pending artwork</div>
      </div>
    );
  }
  return (
    <motion.img
      layoutId={`mascot-img-${mascot.id}`}
      src={mascot.asset}
      alt={mascot.name}
      animate={{ y: [0, -5, 0] }}
      transition={{ y: { duration: 3.6, repeat: Infinity, ease: "easeInOut" } }}
      style={{
        width: "auto",
        height: "min(56%, 160px)",
        maxWidth: "78%",
        objectFit: "contain",
        filter: "drop-shadow(0 10px 22px rgba(0,0,0,0.72)) drop-shadow(0 0 12px rgba(255,255,255,0.08))",
        pointerEvents: "none",
        userSelect: "none",
      }}
    />
  );
}

function ActionButton({ kind, onClick }: { kind: "close" | "send"; onClick: () => void }) {
  const isSend = kind === "send";
  // Dark green / dark red bases · glowing rims for the future-style feel.
  const base = isSend ? "#0e5f34" : "#7c1d2a";
  const rim  = isSend ? "#22c55e" : "#f43f5e";
  const glyph = isSend ? "▶" : "×";   // send arrow · close cross
  const label = isSend ? "Post to chat" : "Close";
  return (
    <motion.button
      type="button"
      aria-label={label}
      onClick={onClick}
      whileTap={{ scale: 0.90 }}
      whileHover={{ scale: 1.06 }}
      initial={{ scale: 0.2, opacity: 0 }}
      animate={{ scale: 1,   opacity: 1 }}
      exit={{    scale: 0.2, opacity: 0 }}
      transition={{ type: "spring", damping: 18, stiffness: 320, delay: 0.14 }}
      style={{
        appearance: "none",
        position: "relative",
        width: 44,
        height: 44,
        borderRadius: "50%",
        background: `radial-gradient(circle at 32% 28%, ${base} 0%, #08080b 92%)`,
        border: `1.5px solid ${rim}aa`,
        color: rim,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: isSend ? 15 : 22,
        fontWeight: 700,
        lineHeight: 1,
        boxShadow: `0 0 22px ${rim}55, inset 0 0 12px ${rim}33, 0 4px 12px rgba(0,0,0,0.5)`,
        padding: 0,
        paddingLeft: isSend ? 3 : 0,   // nudge send arrow visually centred
      }}
    >
      {glyph}
      {/* Pulsing outer ring · continuous 'live' effect. */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: -6,
          borderRadius: "50%",
          border: `1px solid ${rim}`,
          opacity: 0.32,
          animation: "nex-btn-ring 2.4s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />
      <style>{`
        @keyframes nex-btn-ring {
          0%, 100% { transform: scale(1);    opacity: 0.32; }
          50%      { transform: scale(1.22); opacity: 0.04; }
        }
      `}</style>
    </motion.button>
  );
}
