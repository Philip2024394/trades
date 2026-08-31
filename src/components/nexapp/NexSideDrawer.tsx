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
import { NEX_FRAME_INNER_ROOM } from "@/components/nexapp/hud/geometry";

// ═══════════════════════════════════════════════════════════════════════════
// NEX DRAWER GEOMETRY · Philip 2026-08-29 · CONSTITUTIONAL · LOCKED · FROZEN.
//
// This is the SINGLE SOURCE OF TRUTH for the drawer's position and size.
// Every value below is derived from the NEX frame — never from raw viewport
// units, never from arbitrary breakpoints. The NEX frame is the coordinate
// system; the browser viewport is not.
//
// SCALING CONTRACT:
//   · Frame scales with viewport (aspect-locked 850:1850).
//   · Every drawer value below scales with the frame automatically because
//     it is expressed as % of BEZEL_W / BEZEL_H or as a small px nudge on
//     top of a %.
//   · No breakpoint-specific overrides. No responsive centering. No
//     viewport-percentage math outside the aspect-locked BEZEL formulas.
//
// LAYOUT LOCK (approved by Philip 2026-08-29):
//
//   ┌──────────────────────────────┐
//   │   [    METAL DRAWER    ]  │RAIL│    ← rail at right frame column
//   │   [    METAL DRAWER    ]  │RAIL│    ← drawer in LEFT chamber
//   │   [    METAL DRAWER    ]  │RAIL│      with fixed rail gap
//   └──────────────────────────────┘
//
// Change values here ONLY with an explicit Philip decision. Any tuning
// happens by editing this block; downstream code reads from the frozen
// object below and must not compute geometry independently.
// ═══════════════════════════════════════════════════════════════════════════

// Bezel envelope · matches the frame image's aspect ratio (850:1850). Used
// as the coordinate system for every drawer value below.
const BEZEL_W  = "min(100dvw, calc(100dvh * 850 / 1850))";
const BEZEL_H  = "min(100dvh, calc(100dvw * 1850 / 850))";
const H_GUTTER = `max(0px, calc((100dvw - ${BEZEL_W}) / 2))`;
const V_GUTTER = `max(0px, calc((100dvh - ${BEZEL_H}) / 2))`;

/**
 * NEX_DRAWER_GEOMETRY · CONSTITUTIONAL · LOCKED (Philip 2026-08-29).
 *
 * Every drawer position/size value in the app must derive from this object.
 * Do not compute drawer geometry independently. Do not add breakpoint
 * overrides. Do not add browser-viewport centering.
 */
export const NEX_DRAWER_GEOMETRY = Object.freeze({
  // ── Vertical band ──────────────────────────────────────────────────────
  // Rail band 24-76% of bezel height (from DEFAULT_ZONES.side). Drawer
  // extends ±25px past the rail so it clearly overhangs the rail endcaps.
  railTop:    `calc(${V_GUTTER} + ${BEZEL_H} * 0.24 - 25px)`,
  railHeight: `calc(${BEZEL_H} * 0.52 + 50px)`,

  // ── Drawer width (both surfaces) ───────────────────────────────────────
  // 60% of bezel width, clamped so it stays usable on narrow phones and
  // never blows out on desktop. Mirrors the chat-bubble rhythm.
  drawerWidth: `clamp(260px, calc(${BEZEL_W} * 0.60), 420px)`,

  // ── Glass surface (legacy · Discovery / Mascot / Directory) ────────────
  // Right stand-off from the bezel edge · clears the rail column so the
  // drawer reads as a floating panel that slides forward from the rail.
  glassRightOffsetPx: 62,

  // ── Metal surface (five-button IA rooms) ───────────────────────────────
  // Sits in the LEFT CONTENT CHAMBER · anchored to a fixed offset from the
  // left inner bezel edge, then filled to DRAWER_WIDTH. The chamber's
  // right edge (81.93%) minus (left + width) leaves ≥10% clearance before
  // the rail housing on any bezel size.
  //
  // leftInset math:
  //   NEX_FRAME_INNER_ROOM.leftBezelInsetPct = 11.80
  //   Philip approved nudge cumulative from +8px → −17px → −25px (visually
  //   correct as of 2026-08-29 · reads as a module set slightly forward of
  //   the bezel silhouette).
  metalLeftInset: `calc(${NEX_FRAME_INNER_ROOM.leftBezelInsetPct}% - 25px)`,

  // ── Slide animation ────────────────────────────────────────────────────
  // Guaranteed off-screen on any drawer width + inset combination. Outer
  // wrapper (below) is `overflow: hidden` at bezel bounds, so the drawer
  // is clipped inside the phone silhouette during the slide.
  slideOffscreenX: "100vw",
} as const);

// Legacy const aliases · retained so existing style objects keep reading
// familiar identifiers. Every alias resolves to the frozen master above.
const RAIL_TOP                = NEX_DRAWER_GEOMETRY.railTop;
const RAIL_HEIGHT             = NEX_DRAWER_GEOMETRY.railHeight;
const DRAWER_WIDTH            = NEX_DRAWER_GEOMETRY.drawerWidth;
const DRAWER_RIGHT_OFFSET_PX  = NEX_DRAWER_GEOMETRY.glassRightOffsetPx;
const DRAWER_METAL_LEFT_INSET = NEX_DRAWER_GEOMETRY.metalLeftInset;

/**
 * NexSideDrawer · right-side sliding drawer attached to the bezel's rail band.
 * Solid drawer material (no glass) · Philip 2026-08-27 · glass reveal removed.
 * `hideDefaultHeader` lets the caller render its own top bar inside `children`
 * (e.g. a search input as the header · placeholder replacing the title).
 */
export type NexSideDrawerSurface = "glass" | "metal";

export function NexSideDrawer({
  isOpen,
  onClose,
  title,
  children,
  hideDefaultHeader = false,
  hideDefaultScrollWrapper = false,
  surface = "glass",
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  hideDefaultHeader?: boolean;
  /**
   * When true, the drawer stops wrapping children in a scrollable div.
   * The caller becomes responsible for laying out fixed regions + a scroll
   * region themselves (typical pattern: flex column with a fixed intro on
   * top, `flex:1; overflowY:auto` list in the middle, fixed footer on the
   * bottom). Prevents the whole panel from becoming one big scroll surface
   * — matches Philip's 2026-08-29 drawer-scroll doctrine.
   */
  hideDefaultScrollWrapper?: boolean;
  /**
   * "glass" (default) · dark translucent surface + orange rim. Legacy
   *   look, kept for Discovery / Mascot / Directory callers.
   * "metal" · brushed-steel industrial chassis per Philip's 2026-08-29
   *   reference (physical control panel with rivet-fastened plates).
   *   Used by NexRoomDrawer for the five-button IA. Chassis is dark
   *   gunmetal · the plates themselves are drawn by the caller inside
   *   the scroll region for the correct raised-plate feel.
   */
  surface?: NexSideDrawerSurface;
}) {
  const isMetal = surface === "metal";
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
              // Philip 2026-08-29 · z:25 so the drawer sits ABOVE the workspace
              // + bezel silhouette (z:20 or below) but BELOW the right rail
              // button strip (z:30) — the rail must stay tappable while the
              // drawer is open. Bezel img has pointerEvents:none so the
              // drawer surface stays interactive under the frame.
              zIndex: 25,
              pointerEvents: "none",
            }}
          >
          {/* Backdrop · dims the bezel area only · tap to dismiss.
              pointerEvents auto restores click-through only on the backdrop
              (the wrapper itself is pointerEvents:none).
              Philip 2026-08-27: SAFE ZONE at the top of the backdrop · taps
              in the first 130px of the drawer's vertical extent are ignored
              so mobile finger-overshoot near the search input doesn't
              accidentally close the drawer. */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.42 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
            onClick={(e) => {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              const relY = e.clientY - rect.top;
              // Skip close if tap lands in the top safe zone.
              if (relY < 130) return;
              onClose();
            }}
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
            // Animation entry/exit offset · guaranteed off-screen right for
            // both surfaces. Read from the frozen NEX_DRAWER_GEOMETRY so no
            // downstream code sets its own slide distance. Wrapper
            // `overflow: hidden` clips anything past the bezel silhouette.
            initial={{ x: NEX_DRAWER_GEOMETRY.slideOffscreenX }}
            animate={{ x: 0 }}
            exit={{ x: NEX_DRAWER_GEOMETRY.slideOffscreenX }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            style={{
              position: "absolute",
              top:    RAIL_TOP,
              // Position + width branch on surface:
              //   metal · original DRAWER_WIDTH, anchored to the LEFT CONTENT
              //           CHAMBER (left inset = leftBezelInsetPct + 8px). The
              //           rail gap on the right is guaranteed by the chamber
              //           bounds since width ≤ 60% of bezel and chamber ≈
              //           70% of bezel · leaves ≥10% clear before the rail.
              //   glass · legacy · fixed width, hugs the right rail column.
              ...(isMetal
                ? { left: DRAWER_METAL_LEFT_INSET, width: DRAWER_WIDTH }
                : { right: DRAWER_RIGHT_OFFSET_PX, width: DRAWER_WIDTH }),
              height: RAIL_HEIGHT,
              pointerEvents: "auto",
              // Philip 2026-08-29 · drawer shell is a clipping container.
              // Its inner regions manage their own scroll (see the flex
              // column below · header/intro/footer stay fixed, only the
              // list region gets overflowY:auto). This prevents the whole
              // panel from ever becoming a giant scroll surface.
              overflow: "hidden",
              // Surface branch · Philip 2026-08-29.
              //   glass · legacy translucent dark + orange rim (Discovery / Mascot / Directory)
              //   metal · dark gunmetal chassis matching Philip's reference image
              //           (industrial control panel with rivet-fastened plates).
              //           Plates themselves are rendered by the caller inside
              //           the scroll region so they can carry their own rivets/
              //           labels/interactions.
              ...(isMetal
                ? {
                    // Philip 2026-08-29 · chassis is TRANSPARENT. The image
                    // Philip supplied IS the panel · no dark plate, no
                    // border, no glass overlay behind it. Keeps the frozen
                    // visual identical to the approved state.
                    background: "transparent",
                    border: "none",
                    boxShadow: "none",
                  }
                : {
                    // 2026-08-27 · Philip v11 · BLACK FROSTED GLASS.
                    background: "linear-gradient(180deg, rgba(6,6,8,0.62) 0%, rgba(10,10,14,0.72) 100%)",
                    backdropFilter: "blur(24px) saturate(1.25)",
                    WebkitBackdropFilter: "blur(24px) saturate(1.25)",
                    border: "1px solid rgba(249,115,22,0.65)",
                    boxShadow: `
                      0 0 0 1px rgba(249,115,22,0.35),
                      0 0 18px rgba(249,115,22,0.35),
                      -20px 0 48px rgba(0, 0, 0, 0.6)
                    `,
                  }),
              display: "flex",
              flexDirection: "column",
              // Rounded on ALL corners · reads as a compartment attached to
              // the rail. Metal chassis uses a tighter industrial radius,
              // glass keeps the softer 20px legacy radius.
              borderRadius: isMetal ? 10 : 20,
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

            {/* Content region.
                Default: single scrollable div (backward-compatible with
                Discovery / Mascot / Directory callers that pass flat lists).
                When `hideDefaultScrollWrapper` is true, children take over
                and are expected to render their own flex layout with a
                dedicated `overflow-y: auto` middle region — used by the
                Room drawer so intro + footer stay fixed. */}
            {hideDefaultScrollWrapper ? (
              <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", position: "relative" }}>
                {children}
              </div>
            ) : (
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
            )}

            {/* Orange close pull-handle removed 2026-08-29 (Philip).
                Backdrop tap still closes the drawer; the rail button also
                toggles it off. Metal drawers can wire their own close
                affordance in their own header if needed. */}
          </motion.aside>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
