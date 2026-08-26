// NEX Side Drawer · 2026-08-23.
// Doctrine: project_nex_communication_hub_final_direction_2026_08_23 ·
// "Discovery Drawer" section.
//
// Right-side drawer, 60% viewport width (max 480 px). Backdrop dims screen.
// Dark translucent surface · subtle orange border · backdrop-filter blur ·
// rounded corners · smooth 300 ms slide (cubic-out) · safe-area padding.
// Header shows title + close button. Content area is vertically scrollable
// with hidden scrollbars (.nex-no-scrollbar utility from NexAppHome).
//
// Currently used by the Discovery satellite in Explore mode. Component is
// generic so future Personalize / Create surfaces can share the same
// drawer language.

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { NEX } from "@/lib/nexapp/tokens";

// Bezel-aware positioning · matches the geometry NexHudFrame uses to draw
// the console (aspect 850/1850 portrait). Without this the drawer would
// anchor to the raw viewport edge on desktop and float far right of the
// centered bezel · Philip 2026-08-27 spotted the misalignment.
const BEZEL_W  = "min(100dvw, calc(100dvh * 850 / 1850))";
const BEZEL_H  = "min(100dvh, calc(100dvw * 1850 / 850))";
const H_GUTTER = `max(0px, calc((100dvw - ${BEZEL_W}) / 2))`;
const V_GUTTER = `max(0px, calc((100dvh - ${BEZEL_H}) / 2))`;
// Rail band · 24-76% of bezel height (from DEFAULT_ZONES.side in geometry.ts).
// Philip 2026-08-27: drawer extends 25px above the top button and 25px below
// the bottom button (total +50px height) so it clearly overhangs the rail
// strip rather than aligning flush with the endcaps.
const RAIL_TOP    = `calc(${V_GUTTER} + ${BEZEL_H} * 0.24 - 25px)`;
const RAIL_HEIGHT = `calc(${BEZEL_H} * 0.52 + 50px)`;
// Drawer width scales with bezel · never wider than 480 · never narrower
// than 260 (small phones). Attaches cleanly to the bezel's right edge on
// desktop where the bezel is height-limited.
const DRAWER_WIDTH = `clamp(260px, calc(${BEZEL_W} * 0.65), 480px)`;

/**
 * NexSideDrawer · right-side sliding drawer attached to the bezel's rail band.
 * Solid drawer material (no glass) · Philip 2026-08-27 · glass reveal removed.
 * `hideDefaultHeader` lets the caller render its own top bar inside `children`
 * (e.g. a search input as the header · placeholder replacing the title).
 */
export function NexSideDrawer({
  isOpen,
  onClose,
  title,
  children,
  hideDefaultHeader = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  hideDefaultHeader?: boolean;
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* BEZEL-CLIPPED WRAPPER · Philip 2026-08-27 · the drawer's entry
              and exit animation must stay INSIDE the phone edge · never
              visible in the desktop gutter. This wrapper is positioned at the
              exact bezel bounds with overflow:hidden · everything the drawer
              does animation-wise is clipped to the phone silhouette.
              z:25 sits BELOW the rail buttons (z:30) so buttons stay on top
              and tappable while the drawer is open. */}
          <div
            aria-hidden
            style={{
              position: "fixed",
              top: 0,
              right: H_GUTTER,
              width: BEZEL_W,
              height: "100dvh",
              overflow: "hidden",
              // Philip 2026-08-27 · MASTER-AI FIX · drawer sits UNDER the
              // bezel (z:20) so the frame silhouette + rail housing paint
              // ON TOP of the drawer · drawer visibly slides out from behind
              // the frame through the bezel's transparent interior.
              // Bezel img has pointerEvents:none so drawer stays tappable.
              zIndex: 15,
              pointerEvents: "none",
            }}
          >
          {/* Backdrop · dims the bezel area only · tap to dismiss.
              pointerEvents auto restores click-through only on the backdrop
              (the wrapper itself is pointerEvents:none). */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.42 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
            onClick={onClose}
            style={{
              position: "absolute",
              inset: 0,
              background: "#000",
              cursor: "pointer",
              pointerEvents: "auto",
            }}
          />

          {/* Drawer aside · position:ABSOLUTE inside the bezel-clipped
              wrapper · sliding animation now clipped to the phone silhouette
              so it never appears in the desktop gutter. Right offset now
              relative to wrapper's right edge = bezel's right edge. */}
          <motion.aside
            // initial x = 100% + 15px · accounts for the 15px stand-off (right:15)
            // so the drawer's right edge starts FLUSH with the wrapper's right
            // edge (bezel edge), fully behind the rail column. Otherwise a 15px
            // sliver would peek out at animation start.
            initial={{ x: "calc(100% + 15px)" }}
            animate={{ x: 0 }}
            exit={{ x: "calc(100% + 15px)" }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            style={{
              position: "absolute",
              top:    RAIL_TOP,
              right:  15,
              height: RAIL_HEIGHT,
              width:  DRAWER_WIDTH,
              pointerEvents: "auto",
              // 2026-08-27 · Philip v11 · BLACK FROSTED GLASS.
              // Dark semi-transparent surface + backdrop-filter blur so what
              // sits behind the drawer (chat, orb, atmosphere) reads as a
              // soft blurred wash · premium glass finish · no reference image.
              background: "linear-gradient(180deg, rgba(6,6,8,0.62) 0%, rgba(10,10,14,0.72) 100%)",
              backdropFilter: "blur(24px) saturate(1.25)",
              WebkitBackdropFilter: "blur(24px) saturate(1.25)",
              // Philip 2026-08-27 · orange rim effect ALL AROUND the slider ·
              // 1px hairline border + soft outer glow, all 4 sides.
              border: "1px solid rgba(249,115,22,0.65)",
              boxShadow: `
                0 0 0 1px rgba(249,115,22,0.35),
                0 0 18px rgba(249,115,22,0.35),
                -20px 0 48px rgba(0, 0, 0, 0.6)
              `,
              display: "flex",
              flexDirection: "column",
              // No backdrop blur · Philip 2026-08-27 v7 · solid material,
              // not glass. Nothing behind the drawer should show through
              // (the image is fully opaque).
              // Rounded on ALL corners now that the drawer no longer extends
              // to viewport edges · reads as a compartment attached to the rail.
              borderRadius: 20,
              // Safe-area is no longer relevant since drawer sits mid-viewport.
              paddingTop: 0,
              paddingBottom: 0,
            }}
            aria-label={title}
            role="dialog"
            aria-modal="true"
          >
            {/* Default header · title + close · suppressed when the caller
                provides its own top bar via `hideDefaultHeader`. */}
            {!hideDefaultHeader && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 18px 12px",
                  borderBottom: `1px solid ${NEX.borderMuted}`,
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: NEX.text,
                    letterSpacing: -0.1,
                  }}
                >
                  {title}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close drawer"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: NEX.bgSurface,
                    border: `1px solid ${NEX.borderMuted}`,
                    color: NEX.textMuted,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    padding: 0,
                    transition: "color 180ms ease, border-color 180ms ease",
                  }}
                >
                  <X size={16} strokeWidth={1.8} />
                </button>
              </div>
            )}

            {/* Scrollable content. */}
            <div
              className="nex-no-scrollbar"
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                padding: "14px 14px 20px",
                position: "relative",
              }}
            >
              {children}
            </div>

            {/* CLOSE HANDLE · Philip 2026-08-27 · SMALL orange tab centred
                on the drawer's left edge · reads as a physical pull handle
                to close the drawer. Full-height strip replaced with a compact
                48px tab (thumb-friendly hit area). Sits ON TOP of the orange
                rim border for continuity of colour. */}
            <button
              type="button"
              aria-label="Close drawer"
              onClick={onClose}
              style={{
                position: "absolute",
                top: "50%",
                left: -3,
                transform: "translateY(-50%)",
                width: 6,
                height: 48,
                border: "none",
                padding: 0,
                cursor: "pointer",
                background: "linear-gradient(180deg, #fb923c 0%, #f97316 50%, #ea580c 100%)",
                boxShadow: "0 0 14px rgba(249,115,22,0.75), inset 0 0 2px rgba(255,255,255,0.25)",
                borderRadius: 3,
              }}
            />
          </motion.aside>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
