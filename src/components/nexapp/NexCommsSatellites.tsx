// NEX Communication satellites · Phase B (2026-08-23 · Philip greenlit).
// Doctrine: project_nex_communication_hub_final_direction_2026_08_23 ·
// "Communication mode radial: File · Camera · Emoji/GIF · Call · Video.
//  Small circular controls matching the existing NEX radial design.
//  Do not make them oversized. Do not use a conventional rectangular
//  toolbar. The controls should feel like they are orbiting NEX."
//
// Rendering:
//   · Fixed overlay above the temporary composer (NexCommsDock).
//   · Follows keyboard height via useVirtualKeyboard so the satellite
//     ring rises with the composer instead of being obscured.
//   · 5 satellites arranged in a semicircle above the composer:
//         File (top) · Camera (upper-left) · Emoji (upper-right)
//         · Call (left) · Video (right)
//     — matches the doctrine diagram's left/right assignments, flattened
//     to a semicircle because the composer occupies the lower half.
//   · Emerge stagger: scale 0→1 · opacity 0→1 · 28ms delay per satellite ·
//     ~280 ms total (inside the doctrine's 200–300 ms window).
//   · Every satellite is a placeholder no-op — Truth Invariant: buttons
//     that don't yet deliver a capability must clearly indicate that.
//     Dim visual + aria-label suffix "(coming soon)" satisfies this
//     until Phase H wires real infrastructure.

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Paperclip, Camera, Smile, Phone, Video } from "lucide-react";
import type { ReactNode } from "react";
import { NEX } from "@/lib/nexapp/tokens";
import { useVirtualKeyboard } from "@/lib/nexapp/useVirtualKeyboard";

type Satellite = {
  id: string;
  label: string;
  icon: ReactNode;
  /** Degrees from positive-x (right), measured counter-clockwise.
   *  0° = right, 90° = top, 180° = left. */
  angle: number;
};

// Icon stroke matches the corner buttons (NexCornerSlot uses stroke-width 1.8).
const ICON_SIZE = 18;
const ICON_STROKE = 1.8;

const SATELLITES: Satellite[] = [
  { id: "camera", label: "Camera", icon: <Camera size={ICON_SIZE} strokeWidth={ICON_STROKE} />, angle: 180 },
  { id: "call",   label: "Call",   icon: <Phone size={ICON_SIZE} strokeWidth={ICON_STROKE} />,  angle: 135 },
  { id: "file",   label: "File",   icon: <Paperclip size={ICON_SIZE} strokeWidth={ICON_STROKE} />, angle: 90 },
  { id: "emoji",  label: "Emoji",  icon: <Smile size={ICON_SIZE} strokeWidth={ICON_STROKE} />,  angle: 45 },
  { id: "video",  label: "Video",  icon: <Video size={ICON_SIZE} strokeWidth={ICON_STROKE} />,  angle: 0 },
];

const RADIUS = 92;
const BUTTON_SIZE = 44;

export function NexCommsSatellites({ isOpen }: { isOpen: boolean }) {
  const { keyboardHeight, isKeyboardOpen } = useVirtualKeyboard();

  // Composer sits at bottom = keyboardHeight + 12 (keyboard open) OR 22 (idle),
  // and is ~48 px tall. Satellite arc baseline sits ABOVE the composer with a
  // small breathing gap so the arc reads as a distinct layer rather than a
  // toolbar attached to the composer.
  const composerBottom = isKeyboardOpen ? keyboardHeight + 12 : 22;
  const composerHeight = 48;
  const arcGap = 28;
  const arcBaselineBottom = composerBottom + composerHeight + arcGap;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={{
            position: "fixed",
            left: "50%",
            bottom: arcBaselineBottom,
            width: RADIUS * 2 + BUTTON_SIZE,
            height: RADIUS + BUTTON_SIZE,
            transform: "translateX(-50%)",
            zIndex: 22,
            pointerEvents: "none",
          }}
          aria-hidden={!isOpen}
          data-nex-comms-satellites={isOpen ? "open" : undefined}
        >
          {SATELLITES.map((sat, i) => {
            const rad = (sat.angle * Math.PI) / 180;
            // Arc-baseline at container bottom-centre; positive x = right,
            // positive y = up. Subtract BUTTON_SIZE/2 to centre each button
            // on its computed (x, y) point.
            const x = RADIUS * Math.cos(rad);
            const y = RADIUS * Math.sin(rad);
            return (
              <motion.button
                key={sat.id}
                type="button"
                aria-label={`${sat.label} (coming soon)`}
                disabled
                initial={{ scale: 0.2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.2, opacity: 0 }}
                transition={{
                  duration: 0.28,
                  delay: 0.028 * i,
                  ease: [0.4, 0, 0.2, 1],
                }}
                style={{
                  position: "absolute",
                  left: `calc(50% + ${x}px - ${BUTTON_SIZE / 2}px)`,
                  bottom: `${y - BUTTON_SIZE / 2}px`,
                  width: BUTTON_SIZE,
                  height: BUTTON_SIZE,
                  borderRadius: "50%",
                  background: "rgba(13, 13, 13, 0.9)",
                  border: `1.5px solid ${NEX.borderMuted}`,
                  color: NEX.orange,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 1,
                  padding: 0,
                  cursor: "not-allowed",
                  // Dim treatment · Truth Invariant: a placeholder button
                  // should visually indicate it does not yet deliver its
                  // capability. Phase H wires real infrastructure.
                  opacity: 0.55,
                  pointerEvents: "auto",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                }}
              >
                {sat.icon}
                <span style={{ fontSize: 7.5, fontWeight: 500, letterSpacing: 0.2, lineHeight: 1 }}>
                  {sat.label}
                </span>
              </motion.button>
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
