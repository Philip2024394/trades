// NEX Explore satellites · 2026-08-23 (Philip refinement).
// Doctrine: project_nex_communication_hub_final_direction_2026_08_23 ·
// "Explore mode · 1 center NEX circle · 5 same-size satellites · no
//  connecting lines · uniform floating · background image."
//
// Layout · full-circle constellation on a themed background:
//     · Background image fills the Explore area (Truth-Invariant · it is
//       a NEX-authored theme asset, not a fabricated stock photo).
//     · Central NEX circle at the geometric centre (both axes) of the
//       Explore area · same size as the satellites (60 px) · radial
//       orange gradient · orange border · subtle glow.
//     · 5 satellites orbit at a fixed radius (118 px). All 5 share the
//       exact same visual treatment · dark background · gray-muted
//       border · standard shadow. Positions:
//         Discovery top (90°) · Video upper-right (18°) · Camera lower-
//         right (306°) · Call lower-left (234°) · Emoji upper-left (162°).
//     · Uniform floating: every satellite runs the same diamond-loop
//       oscillation (±3 px, 5.0 s, no delay), so the whole constellation
//       breathes in unison.
//
// Interaction: only Discovery is active — it opens the right-side
// Discovery Drawer. Emoji · Call · Video · Camera remain disabled with
// aria-label "(coming soon)" per Truth Invariant, but visually match the
// other satellites so the constellation reads as one uniform system.

"use client";

import { motion } from "framer-motion";
import { Smile, Phone, Compass, Video, Camera } from "lucide-react";
import type { ReactNode } from "react";
import { NEX } from "@/lib/nexapp/tokens";

type Satellite = {
  id: string;
  label: string;
  icon: ReactNode;
  /** Degrees from positive-x (right), measured counter-clockwise. */
  angle: number;
};

const ICON_SIZE = 22;
const ICON_STROKE = 1.7;

const SATELLITES: Satellite[] = [
  { id: "discovery", label: "Discovery", icon: <Compass size={ICON_SIZE} strokeWidth={ICON_STROKE} />, angle: 90  },
  { id: "video",     label: "Video",     icon: <Video size={ICON_SIZE} strokeWidth={ICON_STROKE} />,   angle: 18  },
  { id: "camera",    label: "Camera",    icon: <Camera size={ICON_SIZE} strokeWidth={ICON_STROKE} />,  angle: 306 },
  { id: "call",      label: "Call",      icon: <Phone size={ICON_SIZE} strokeWidth={ICON_STROKE} />,   angle: 234 },
  { id: "emoji",     label: "Emoji",     icon: <Smile size={ICON_SIZE} strokeWidth={ICON_STROKE} />,   angle: 162 },
];

const CONTAINER = 320;
const CENTER = CONTAINER / 2;
// Orbit radius reverted to 118 (2026-08-23 troubleshoot). Previous 138
// caused satellites to overflow the container on narrow mobile parents
// where maxWidth:100% clamps the container below its ideal 340 px width,
// leaving fixed-pixel absolute positions past the visible edge. NEX at
// 2× size (120 px) doesn't leave physical room for +20 edge-to-edge
// without a bigger container that overflows mobile viewports.
const RADIUS = 118;
const BUTTON_SIZE = 60;
// Centre NEX circle is 2× the satellite size (Philip 2026-08-23) so it
// reads as the dominant anchor of the constellation.
const NEX_CENTER_SIZE = BUTTON_SIZE * 2;
const FLOAT_AMP = 3;
const FLOAT_DURATION = 5.0;

// Explore background image now lives on the conversation frame (see
// NexAppHome.tsx) so it fills the frame edge-to-edge (up to the frame
// rim), not just the inner panel area. This wrapper stays transparent
// so the frame image shows through.

export function NexExploreSatellites({ onDiscoveryTap }: { onDiscoveryTap: () => void }) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
      }}
      data-nex-explore-radial
    >
      <div
        style={{
          position: "relative",
          width: CONTAINER,
          height: CONTAINER,
          maxWidth: "100%",
          // Background image's circle rim is centred at ~54% of image
          // height (596×1101). With background-size:cover + center, this
          // lands ~25 px below the container's flex-centered midpoint on
          // typical mobile viewports. Shift the whole constellation
          // (NEX + all 5 satellites) down 25 px so the centre NEX sits
          // inside the image's central circle.
          transform: "translateY(25px)",
        }}
      >
        {/* Central NEX circle · visual anchor · non-interactive.
            2× satellite size (Philip 2026-08-23) so it dominates the
            constellation. Nudged 15 px left of the constellation centre
            to sit inside the background image's central circle. */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.36, ease: [0.4, 0, 0.2, 1] }}
          style={{
            position: "absolute",
            // Positioned -23 left / -8 up from the constellation centre
            // so the NEX aligns with the background image's central
            // circle (Philip 2026-08-23).
            left: CENTER - NEX_CENTER_SIZE / 2 - 23,
            top: CENTER - NEX_CENTER_SIZE / 2 - 8,
            width: NEX_CENTER_SIZE,
            height: NEX_CENTER_SIZE,
            borderRadius: "50%",
            background: `radial-gradient(circle at 50% 50%, rgba(249,115,22,0.22) 0%, rgba(13,13,13,0.95) 72%)`,
            border: `2px solid ${NEX.orange}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: NEX.text,
            fontWeight: 700,
            fontSize: 28,
            letterSpacing: 0.6,
            boxShadow: `0 12px 44px rgba(0,0,0,0.6), 0 0 40px ${NEX.orangeGlowLo}`,
            zIndex: 2,
            userSelect: "none",
          }}
          aria-hidden
        >
          <span>NE</span>
          <span style={{ color: NEX.orange, marginLeft: 2 }}>X</span>
        </motion.div>

        {/* Orbiting satellites · uniform float in unison · same visual
            treatment across all 5 (Discovery is the only active button). */}
        {SATELLITES.map((sat, i) => {
          const rad = (sat.angle * Math.PI) / 180;
          const baseX = CENTER + Math.cos(rad) * RADIUS - BUTTON_SIZE / 2;
          const baseY = CENTER - Math.sin(rad) * RADIUS - BUTTON_SIZE / 2;
          const isDiscovery = sat.id === "discovery";
          return (
            <motion.div
              key={sat.id}
              style={{
                position: "absolute",
                left: baseX,
                top: baseY,
                width: BUTTON_SIZE,
                height: BUTTON_SIZE,
                zIndex: 3,
              }}
              animate={{
                x: [0, FLOAT_AMP, 0, -FLOAT_AMP, 0],
                y: [0, -FLOAT_AMP, 0, FLOAT_AMP, 0],
              }}
              transition={{
                duration: FLOAT_DURATION,
                repeat: Infinity,
                ease: "easeInOut",
                // No delay · all satellites float in unison per refinement.
              }}
            >
              <motion.button
                type="button"
                aria-label={
                  isDiscovery
                    ? "Discovery — open directory drawer"
                    : `${sat.label} (coming soon)`
                }
                disabled={!isDiscovery}
                onClick={isDiscovery ? onDiscoveryTap : undefined}
                initial={{ scale: 0.2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  duration: 0.34,
                  delay: 0.08 + 0.04 * i,
                  ease: [0.4, 0, 0.2, 1],
                }}
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "50%",
                  // Uniform visual across all 5 satellites per refinement.
                  background: "rgba(13, 13, 13, 0.92)",
                  border: `1.5px solid ${NEX.borderMuted}`,
                  color: NEX.orange,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                  padding: 0,
                  cursor: isDiscovery ? "pointer" : "not-allowed",
                  boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
                  transition: "background 180ms ease, border-color 180ms ease",
                }}
              >
                {sat.icon}
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 500,
                    letterSpacing: 0.2,
                    lineHeight: 1,
                  }}
                >
                  {sat.label}
                </span>
              </motion.button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
