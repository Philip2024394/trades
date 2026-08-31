"use client";

// src/components/nexapp/hud/NexDiscoveryStage.tsx · Philip 2026-08-29.
//
// Full-viewport interface takeover · fires when the Discover rail room
// activates. Uses a BLACK CURTAIN REVEAL instead of a fade-in:
//
//   t=0     · Discover tapped
//   t=0     · Stage + drawer + orb all mount instantly at full opacity
//   t=0     · A black curtain (z:300 · covers EVERYTHING including the
//             orb + frame chrome) appears opaque, hiding the drawer slide
//   t=0-700 · Curtain opacity 1 → 0 (ease-out)
//   t=700   · Everything revealed together · orb "appears with the fade
//             up" naturally · no visible slide-in for the drawer
//   Close   · Whole stack fades opacity 1 → 0 over 500ms then unmounts
//
// Envelope is FULL HEIGHT (top: 0 to bottom: 100dvh) so the hero flows
// UP under the header chrome and DOWN under the footer chrome instead
// of being clipped to the inner viewport.

import { AnimatePresence, motion } from "framer-motion";
import { NexInterfaceHero } from "@/components/nexapp/NexInterfaceHero";

// Bezel envelope math · matches BEZEL_METAL in geometry.ts (850×1850).
const BEZEL_W  = "min(100dvw, calc(100dvh * 850 / 1850))";
const H_GUTTER = `max(0px, calc((100dvw - ${BEZEL_W}) / 2))`;

interface Props {
  isOpen: boolean;
  /** Optional composition nudge · matches interface-sample preview. */
  shiftXpx?: number;
}

export function NexDiscoveryStage({ isOpen, shiftXpx = -15 }: Props) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="nex-discovery-root"
          // Root fades on EXIT only · entrance is handled by the curtain
          // lifting off. This gives: open = curtain reveal · close = fade
          // to black.
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit   ={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0, 0.2, 1] }}
        >
          {/* ── STAGE · full-height hero · behind frame chrome (z:20+) ── */}
          <div
            aria-hidden
            style={{
              position: "fixed",
              top: 0,
              right: H_GUTTER,
              width: BEZEL_W,
              height: "100dvh",
              overflow: "hidden",
              zIndex: 12,
              pointerEvents: "none",
              background: "#020306",
            }}
          >
            {/* animateEntrance=false · the curtain lifting IS the entrance. */}
            <NexInterfaceHero animateEntrance={false} shiftXpx={shiftXpx} />
          </div>

          {/* ── BLACK CURTAIN · covers EVERYTHING during the reveal ──
              z:300 so it sits above frame chrome + rail + orb. Fades from
              opaque to transparent over 700ms while everything underneath
              (drawer slide, orb, frame) settles into place. Once
              transparent, has pointer-events:none so it never blocks
              interaction. */}
          {/* Bounded to the bezel envelope · sits at z:13 (just above the
              hero at z:12, below the frame chrome at z:20+). Frame stays
              visible throughout · only the image behind it fades in ·
              Philip 2026-08-29 · "just image change, not frame jump". */}
          <motion.div
            aria-hidden
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: [0.25, 0, 0.2, 1] }}
            style={{
              position: "fixed",
              top: 0,
              right: H_GUTTER,
              width: BEZEL_W,
              height: "100dvh",
              background: "#000",
              zIndex: 13,
              pointerEvents: "none",
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
