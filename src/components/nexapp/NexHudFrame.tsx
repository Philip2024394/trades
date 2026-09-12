// NEX HUD Frame · v6 overlay architecture (Philip 2026-08-26 spec).
//
// Architecture (Philip spec section 1):
//   Phone viewport
//     → live NEX content layer                 (z:1)
//     → transparent frame overlay              (z:20)
//     → invisible hit targets over housings    (z:30)
//
// The frame is a decorative overlay above the live application. Interior
// opening in the frame image is transparent → live content shows through.
// Rail button housings + bottom pill are opaque frame artwork · interactive
// controls sit on top of them as click-through hit targets rendering icons +
// labels above the visible housing.
//
// Doctrine anchors:
//   · project_nex_themeable_architecture_constitution_2026_08_25
//   · project_nex_workspace_identity_doctrine_2026_08_25
//   · project_nex_workspace_terminology_addendum_2026_08_25

"use client";

import React, { useEffect, useState } from "react";
import {
  DEFAULT_ZONES,
  BEZEL_AFFORDANCES,
  RAIL_SLOT_COUNT,
  BEZEL_ASPECT_RATIO,
  BEZEL_METAL,
  NEX_BRAND_ACCENT_REGIONS,
  HERO_HEIGHT_PCT,
  HERO_TOP_OFFSET_PX,
  WORKSPACE_WIDTH_NO_RAIL,
} from "./hud/geometry";
import { useChromaKeyedBezel } from "./hud/useChromaKeyedBezel";
import { NexVoiceOrb } from "./NexVoiceOrb";
import { NexEyeBubble } from "./NexEyeBubble";
import { useGuidanceTarget, type GuidanceTargetId } from "./hud/NexGuidance";
import type { NexVoiceState } from "@/lib/nex-voice";
import {
  NEX_HUD_THEME_REGISTRY,
  DEFAULT_THEME_ID,
  NEX_FRAME_DISABLE_ACCENT_STACK,
  type NexHudTheme,
} from "./hud/theme";
import { MODE_LABEL, type NexHudMode } from "./hud/modes";
import { TouchButton } from "./primitives/TouchButton";

export type { NexHudMode } from "./hud/modes";

export interface RailButton {
  id: string;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  onClick: () => void;
  /** Optional guidance target id · lets NEX point at this button. */
  guidanceTarget?: GuidanceTargetId;
  /**
   * Per-button colour override for icon + (aria-only) label · Philip
   * 2026-08-29. Overrides the theme accent when set. Used to blue-tint
   * an active room button while dimming the others.
   */
  accentOverride?: string;
}

export interface HeaderIconButton {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  guidanceTarget?: GuidanceTargetId;
}

export type BezelButtonId = "nex-wordmark";

interface Props {
  mode?: NexHudMode;
  themeId?: string;
  /** Visible + labelled rail on the right side (5 slots per v6 spec). */
  rightRailContent?: RailButton[];
  /** 3 header icons in the top-right (per v6 example: search, bell, menu). */
  headerIcons?: HeaderIconButton[];
  /** Below-workspace contextual card (Philip contextual workspace doctrine). */
  contextSlot?: React.ReactNode;
  /** Composer · sits over the bottom pill housing · always visible. */
  composerSlot?: React.ReactNode;
  /** Overlay slot · Philip 2026-08-27 · renders as a direct child of the
   *  outer frame container so its z-index competes at the same stacking
   *  level as the bezel/rail/orb. Used by the mascot side-drawer to sit
   *  above chat + bezel but BELOW the rail buttons. */
  overlaySlot?: React.ReactNode;
  /** When true, hides composer + header icons + wordmark from render so a
   *  full-canvas overlay (e.g. NexMascotStage) can black out the interior
   *  without those chrome pieces poking through. Rail + bezel + orb all
   *  stay put. Philip 2026-08-27. */
  hideInteriorControls?: boolean;
  /** Renders a small header block in the top-bezel free-space (between the
   *  wordmark and header-icon plates). z:30 · paints above the bezel metal.
   *  Only visible while `hideInteriorControls` is true. Philip 2026-08-27. */
  interiorHeader?: React.ReactNode;
  onBezelButton?: (id: BezelButtonId) => void;
  /** Live workspace content · rendered inside the transparent interior. */
  children?: React.ReactNode;
  /** Voice state · drives the central voice orb animation. */
  voiceState?: NexVoiceState;
  /** Tap the voice orb → voice.tap() (idle→listen · etc.). */
  onVoiceOrbTap?: () => void;
  /** Eye look direction · orb pupil turns toward it, auto-returns to centre. */
  voiceOrbLookAt?: import("./NexVoiceOrb").OrbLookDirection | null;
  /** Override pupil transition duration (ms). Default 380 · parent sets 1000
   *  during chat launch follow so the pupil takes 1s to track the message. */
  voiceOrbPupilTransitionMs?: number;
  /** When false, disable the orb's internal 700ms auto-return timer so the
   *  parent controls when the pupil returns to centre. */
  voiceOrbAutoReturn?: boolean;
  /** When true, override orb palette with red · used the split-second before
   *  a guidance laser fires so the eye reads "arming." */
  voiceOrbFlashRed?: boolean;
  /** When true, NEX grows tiny black duck legs and hops DOWN out of her
   *  circle housing. Toggled by double-tapping the eye. */
  voiceOrbHopped?: boolean;
  /** When true, NEX floats to the top-right corner of the frame · used
   *  during full-width mode so she perches out of the way while chat expands.
   *  Position override composes with hopped (she floats WHILE hopped). */
  voiceOrbPerched?: boolean;
  /** When true, NEX's personality scheduler runs faster (0.35-0.7s gaps
   *  instead of 0.8-1.9s). Reads as "curious/nosy" · used during layout
   *  transitions so she's actively watching everything change. */
  voiceOrbHyperMode?: boolean;
  /** Optional style override applied to the orb container. Composes over
   *  the base + perched transforms. Used by the shell to fly the orb off
   *  screen during page transitions and back in on the new page ·
   *  Philip 2026-08-29. */
  voiceOrbTransitStyle?: React.CSSProperties;
  /** When true, the voice orb container is not rendered · used by
   *  workspaces where the orb would visually compete with the interior
   *  content (Philip 2026-09-05 · Products workspace). This is a
   *  visibility gate only · voice/tap wiring is unaffected · the orb
   *  returns whenever this flag is false again. */
  voiceOrbHidden?: boolean;
  /** When false, the hero image layer fades out to reveal the black
   *  background · used in full-width chat mode (Philip 2026-08-28). */
  heroVisible?: boolean;
  /** When true, workspace zone (chat container) expands wider + up so chat
   *  reclaims the freed hero + rail space · full-width cinematic. */
  chatFullWidth?: boolean;
  /** Rendered INSIDE the aspect-locked phone container (not the workspace).
   *  Use for absolute-positioned overlays that need phone-relative coords
   *  (e.g. butterfly cinematic · Philip 2026-08-28). */
  frameOverlaySlot?: React.ReactNode;
  /** Speech bubble beneath the eye · character response to eye taps. */
  eyeBubbleMessage?: string | null;
  eyeBubbleDwellMs?: number;
  onEyeBubbleDismiss?: () => void;
  /**
   * Frame material mode · Philip 2026-08-27.
   *
   * Controls how the frame image renders WITHOUT changing artwork.
   * Uses CSS filters on the bezel <img> · non-destructive · reversible.
   *
   *   "normal"  · default · full colour · orange accents visible
   *   "dim"     · reduced brightness · muted orange (viewer knows there's a frame · frame doesn't compete with content)
   *   "cinema"  · fully desaturated (grayscale) · zero orange · frame becomes silvery metal · best for immersive video
   *   "off"     · frame drops to near black · minimal chrome · maximum immersion
   *
   * All modes preserve the bezel silhouette · rail housing · button hit targets.
   * The user CAN tap the rail and voice orb in any mode.
   */
  frameMode?: "normal" | "dim" | "cinema" | "off";
  /** Bezel image src override · Philip 2026-09-01 · per-artifact frames.
   *  When set, this replaces the theme's imageSrc / imageSrcNoRail for the
   *  bezel overlay only (chroma-key + mask pipeline still applied).
   *  Used to render a distinct frame on the chat screen without switching
   *  themes globally. Pass undefined to fall back to the theme default. */
  bezelSrcOverride?: string;
  /**
   * Right-side kebab (3-dot vertical) menu · Philip 2026-08-28.
   * Sits under the last rail button (Food) in the dead space between rail
   * and composer. Toggles rail visibility · see hideRail.
   */
  onRightKebabTap?: () => void;
  /** When true, kebab renders in "active" state (dots brighten). */
  rightKebabActive?: boolean;
  /**
   * Rail collapse · Philip 2026-08-28. When true:
   *   · The 5 right-rail buttons are NOT rendered
   *   · If the theme provides `bezel.imageSrcNoRail`, the frame image
   *     swaps to that variant (chassis drawn without rail housing) so
   *     content can widen into the previously-occupied space
   *   · Kebab (onRightKebabTap) STAYS visible so the user can toggle back
   */
  hideRail?: boolean;
  /**
   * Per-region accent opacity override · Philip 2026-08-29 · BATCH 7.
   *
   * Map of NEX_BRAND_ACCENT_REGIONS id → opacity 0..1. When provided,
   * each listed region renders at the given opacity; regions absent from
   * the map fall through to per-region default rules (see below).
   *
   * Default rules when the prop is undefined OR a region isn't in the map:
   *   · Regions whose id starts with "railHousing" default to 0
   *     (rail housings are ceremony-controlled · never render unbidden ·
   *     preserves pre-BATCH-6 LIVE mode where the rail was fully greyed)
   *   · All other regions default to 1 (backwards-compatible with any
   *     future accent region that doesn't need explicit gating)
   *
   * Only meaningful when frameMode !== "normal" (the accent overlay
   * layer only renders in those modes · see line ~592).
   */
  accentRegionOpacities?: Record<string, number>;
  /**
   * Per-button rail visibility · Philip 2026-08-29 · BATCH 7.
   *
   * When set to N (0..RAIL_SLOT_COUNT), only the top N rail buttons
   * render (opacity 1); the rest render at opacity 0. Enables sequential
   * top-to-bottom reveal during the activation ceremony.
   *
   * When undefined, falls back to the existing `hideRail` boolean
   * (all-or-nothing) so pre-BATCH-7 callers behave identically.
   */
  visibleRailButtonCount?: number;
  /**
   * Surgical frame-removal mode · Philip 2026-09-07.
   *
   * When true, NexHudFrame skips rendering the phone chassis / bezel
   * overlay / rail housing accents / interior hero background / voice
   * orb, and the app content fills the entire mobile viewport
   * (100vw · 100dvh) instead of the old 850×1850 aspect-locked
   * container.
   *
   * The `.nex-console-viewport` class stays on the inner container so
   * every component that portals into it (ControlCenterPanel,
   * NexLiveClient inShell mount, etc.) keeps working unchanged.
   *
   * IMPORTANT: this must NOT change hook order between frameless and
   * legacy paths. The one hook this component calls
   * (`useChromaKeyedBezel`) runs unconditionally before we branch on
   * `frameless` so Fast Refresh never sees a hook-count mismatch.
   */
  frameless?: boolean;
}

function resolveTheme(themeId?: string): NexHudTheme {
  return NEX_HUD_THEME_REGISTRY[themeId ?? DEFAULT_THEME_ID] ?? NEX_HUD_THEME_REGISTRY[DEFAULT_THEME_ID];
}

/**
 * Interior background layer · always shows base image (v1). When isSpeaking
 * flips on, an overlay image cross-fades to a random one from the speaking
 * pool every `swapMs` ms. On voice end, the overlay fades out and the base
 * image is the only one visible again.
 *
 * Uses two <img> elements stacked with opacity transitions so swaps are
 * gpu-accelerated crossfades, not full reloads.
 */
function InteriorBackgroundLayer({
  baseSrc, speakingBackgrounds, speakingSwapMs, filter, isSpeaking, heroSequence,
  visible = true,
}: {
  baseSrc?: string;
  speakingBackgrounds: string[];
  speakingSwapMs: number;
  filter?: string;
  isSpeaking: boolean;
  heroSequence?: string[];
  /** When false, entire hero layer fades to opacity 0 · black background
   *  becomes the surface. Philip 2026-08-28 · full-width mode. */
  visible?: boolean;
}) {
  // Hero sequence player · Philip 2026-08-28.
  // Accepts an ordered list of image URLs and cycles through them at a fixed
  // interval. Each UNIQUE URL is rendered once as a stacked <img>; opacity
  // switches to give a crossfade between whichever image is active at each
  // step. Sequence can repeat images in any pattern (e.g. 1,2,3,1,2,3,2,1,3).
  //
  // Fallback for callers not using heroSequence: [baseSrc, ...speakingBackgrounds]
  // becomes the sequence (backward-compat with the earlier 2-image cycle).
  const sequence =
    heroSequence && heroSequence.length > 0
      ? heroSequence
      : ([baseSrc, ...speakingBackgrounds].filter(Boolean) as string[]);
  const uniqueSrcs = Array.from(new Set(sequence));

  const [stepIdx, setStepIdx] = useState(0);
  useEffect(() => {
    if (sequence.length <= 1) return;
    const timer = setInterval(() => {
      setStepIdx((i) => (i + 1) % sequence.length);
    }, speakingSwapMs);
    return () => clearInterval(timer);
  }, [sequence.length, speakingSwapMs]);
  void isSpeaking; // reserved · could tune swap speed on voice state later

  if (uniqueSrcs.length === 0) return null;

  // Hero image height driven by geometry.HERO_HEIGHT_PCT (Philip 2026-08-28)
  // so orb + hero always stay in sync. Change HERO_HEIGHT_PCT to resize hero;
  // the voice orb automatically re-centers on the new hero.
  //
  // object-fit: contain (Philip 2026-08-28 "full height image must be
  // displaying") shows the ENTIRE image without cropping · any letterbox
  // gutters are invisible against the black console background.
  // Fade the bottom of the hero into the black background · Philip 2026-08-28.
  // Linear mask: fully opaque top 55% → transparent by bottom edge. Chat
  // area below reads as a single continuous black surface (no hard edge).
  const HERO_FADE_MASK =
    "linear-gradient(to bottom, black 0%, black 55%, transparent 100%)";

  const style: React.CSSProperties = {
    position: "absolute",
    top: HERO_TOP_OFFSET_PX,
    left: 0,
    width: "100%",
    height: `${HERO_HEIGHT_PCT}%`,
    objectFit: "contain",
    objectPosition: "center top",
    pointerEvents: "none",
    filter,
    maskImage: HERO_FADE_MASK,
    WebkitMaskImage: HERO_FADE_MASK,
  };

  const activeSrc = sequence[stepIdx];
  return (
    <>
      {uniqueSrcs.map((src) => (
        <img
          key={src}
          src={src}
          alt=""
          aria-hidden
          style={{
            ...style,
            zIndex: 0,
            // Multiply cross-fade opacity with visibility · when visible=false
            // (full-width mode) the whole hero layer fades to black background.
            opacity: (src === activeSrc && visible) ? 1 : 0,
            transition: "opacity 500ms ease-in-out",
          }}
        />
      ))}
    </>
  );
}

// ── Sub-components that register themselves as guidance targets ────────────
// Each interactive control registers under a canonical id so NEX guidance
// beams can find its live coordinates via `useGuidanceTarget(id)`.

function HeaderIconSlot({
  slot, btn,
}: {
  slot: typeof BEZEL_AFFORDANCES.headerIcon1;
  btn: HeaderIconButton;
}) {
  const attach = useGuidanceTarget(btn.guidanceTarget ?? btn.id);
  return (
    <TouchButton
      ref={attach as (el: HTMLButtonElement | null) => void}
      aria-label={btn.label}
      onTap={btn.onClick}
      style={{
        position: "absolute",
        top:    slot.top,
        right:  slot.right,
        width:  slot.width,
        height: slot.height,
        zIndex: 30,
        appearance: "none",
        border: "none",
        background: "transparent",
        cursor: "pointer",
        padding: 0,
        color: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: "140%", height: "140%",
        }}
      >
        {btn.icon}
      </span>
    </TouchButton>
  );
}

function RailButtonSlot({ btn, accent }: { btn: RailButton; accent: string }) {
  const attach = useGuidanceTarget(btn.guidanceTarget ?? btn.id);
  // Colour resolution · per-button override wins over theme accent so an
  // active room can be tinted while the rest of the rail dims.
  const effectiveColor = btn.accentOverride ?? accent;
  return (
    <TouchButton
      ref={attach as (el: HTMLButtonElement | null) => void}
      aria-label={btn.label}
      onTap={btn.onClick}
      style={{
        appearance: "none",
        border: "none",
        background: "transparent",
        cursor: "pointer",
        padding: 0,
        color: effectiveColor,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        opacity: btn.active ? 1 : 0.85,
      }}
    >
      {/* Icon wrapper · Philip 2026-08-29 measured centering.
          Rail grid produces 5 equal-height cells at 190.8px tall × 153.6px
          wide on the nominal 850×1850 bezel (see calculation in the
          NexAppShell rail comment). Flex centers this wrapper inside the
          button; `aspect-ratio:1` keeps the icon square across viewports.
          width:42% = prior 60% reduced 30% per Philip · icon stays exactly
          centered because the wrapper shrinks symmetrically around its
          flex-center origin (no re-position math needed). */}
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "42%",
          aspectRatio: "1",
          // Icon SVG inside will render at 100% × 100% of this wrapper.
          lineHeight: 0,
        }}
      >
        {btn.icon}
      </span>
    </TouchButton>
  );
}

export function NexHudFrame({
  mode = "idle",
  themeId,
  rightRailContent = [],
  headerIcons = [],
  contextSlot,
  composerSlot,
  overlaySlot,
  hideInteriorControls = false,
  voiceOrbHidden = false,
  interiorHeader,
  onBezelButton,
  children,
  voiceState = "idle",
  onVoiceOrbTap,
  voiceOrbLookAt = null,
  voiceOrbPupilTransitionMs,
  voiceOrbAutoReturn = true,
  voiceOrbFlashRed = false,
  voiceOrbHopped = false,
  voiceOrbPerched = false,
  voiceOrbHyperMode = false,
  voiceOrbTransitStyle,
  heroVisible = true,
  chatFullWidth = false,
  frameOverlaySlot,
  eyeBubbleMessage = null,
  eyeBubbleDwellMs,
  onEyeBubbleDismiss,
  frameMode = "normal",
  onRightKebabTap,
  rightKebabActive = false,
  hideRail = false,
  accentRegionOpacities,
  visibleRailButtonCount,
  bezelSrcOverride,
  frameless = false,
}: Props) {
  const theme = resolveTheme(themeId);

  const accent = theme.accents.primary;
  // Frame variant swap (Philip 2026-08-28): when rail is hidden AND the
  // theme ships a no-rail alternate frame, use it. Otherwise reuse the
  // default frame (rail housing still visible · only buttons disappear).
  // Per-artifact override (Philip 2026-09-01) wins over both when present.
  const activeBezelSrc =
    bezelSrcOverride ??
    (hideRail && theme.bezel.imageSrcNoRail
      ? theme.bezel.imageSrcNoRail
      : theme.bezel.imageSrc);
  // Chroma-key JPEGs; PNG/SVG/WebP pass through untouched (v6 has native alpha).
  // NOTE: this hook MUST run unconditionally on every render, whether
  // `frameless` is true or false, so Fast Refresh never sees a hook-count
  // mismatch between the two paths.
  const bezelSrc = useChromaKeyedBezel(activeBezelSrc) ?? activeBezelSrc;

  // ── FRAMELESS MODE · Philip 2026-09-07 ────────────────────────
  //
  // Surgical: strip the phone chassis and let the existing NEX app page
  // fill the entire viewport. Preserves `.nex-console-viewport` on the
  // inner container so ControlCenterPanel + NexLiveClient portals still
  // work. Renders the existing header icons + kebab so the shell nav
  // survives. Skips bezel img, accent stack, interior hero, voice orb,
  // frameOverlaySlot, and the aspect-ratio lock — those ARE the frame.
  // Returns EARLY, but the single hook above already ran.
  if (frameless) {
    return (
      <>
        <style>{`
          .nex-console-viewport {
            position: relative;
            width: 100vw;
            width: 100svw;
            width: 100dvw;
            /* HEIGHT (not min-height) locks the frameless shell to the
               real mobile viewport · Philip 2026-09-07. Previously used
               min-height:100dvh which allowed the container to GROW
               when a workspace rendered content taller than the mobile
               viewport (e.g., Products SECTION at 875px pushed the
               viewport to 931px, dragging the composer + kebab below
               the mobile screen). Locking to height:100dvh + the body
               internal overflow-y:auto keeps the shell at exactly the
               mobile viewport and lets long workspace content scroll
               INSIDE the body zone. */
            height: 100vh;
            height: 100svh;
            height: 100dvh;
            max-height: 100vh;
            max-height: 100svh;
            max-height: 100dvh;
            margin: 0;
            /* Founder background image · full-viewport · center/cover so
               it never distorts. Black fallback if the asset 404s. */
            background-color: #000000;
            background-image: url("/nex/backgrounds/main-2026-09-07.jpg");
            background-size: cover;
            background-position: center center;
            background-repeat: no-repeat;
            background-attachment: scroll;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            color: ${theme.accents.onDark};
          }
          @media (min-width: 768px) and (hover: hover) and (pointer: fine) {
            .nex-console-viewport {
              background-attachment: fixed;
            }
          }
          .nex-frameless-header {
            flex: 0 0 auto;
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 4px;
            padding: calc(8px + env(safe-area-inset-top, 0px)) calc(8px + env(safe-area-inset-right, 0px)) 8px calc(8px + env(safe-area-inset-left, 0px));
            position: sticky;
            top: 0;
            z-index: 30;
          }
          .nex-frameless-body {
            position: relative;
            flex: 1;
            min-height: 0;
            display: flex;
            flex-direction: column;
            /* overflow-y: auto so long workspaces scroll INSIDE the body
               zone instead of pushing the shell past the mobile viewport
               (Philip 2026-09-07 · pairs with the viewport height lock
               above · every page now fits 100dvh exactly and long content
               scrolls naturally). overflow-x: hidden guards against any
               accidental horizontal creep from workspace children. */
            overflow-x: hidden;
            overflow-y: auto;
            /* Preserve momentum scroll on iOS Safari. */
            -webkit-overflow-scrolling: touch;
            padding-bottom: env(safe-area-inset-bottom, 0px);
          }
          .nex-frameless-icon-btn {
            appearance: none;
            background: transparent;
            border: none;
            padding: 0;
            width: 40px;
            height: 40px;
            border-radius: 999px;
            color: currentColor;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
          }
          .nex-frameless-icon-btn:active { background: rgba(255,255,255,0.06); }
          /* Frameless composer · CLOSED-state compensation for
             NexComposer's marginBottom:-16. Applies only when the NEX
             keypad is NOT a descendant of the composer wrapper. When
             the keypad opens it becomes a sibling of the composer form
             and NexAppShell's flex gap:16 cancels the -16 internally —
             so this extra +16 must NOT be applied then, or the whole
             assembly rides 16px above the viewport bottom. Modern
             browsers (Chrome/Safari/Firefox 2023+) all support :has(). */
          [data-testid="nex-frameless-composer"]:not(:has([role="group"][aria-label="NEX keypad"])) {
            bottom: calc(env(safe-area-inset-bottom, 0px) + calc(min(100dvh, 100dvw * 1850 / 850) * 0.032) + 16px) !important;
          }
        `}</style>
        <div className="nex-console-viewport" data-testid="nex-frameless-viewport" data-scope="full-viewport">
          <div className="nex-frameless-header" role="banner">
            {headerIcons.map((btn) => (
              <button
                key={btn.id}
                type="button"
                className="nex-frameless-icon-btn"
                aria-label={btn.label}
                onClick={btn.onClick}
                data-testid={`nex-frameless-header-${btn.id}`}
              >
                {btn.icon}
              </button>
            ))}
            {onRightKebabTap && (
              <button
                type="button"
                className="nex-frameless-icon-btn"
                aria-label="More"
                aria-pressed={rightKebabActive}
                onClick={onRightKebabTap}
                data-testid="nex-frameless-header-kebab"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <circle cx="5" cy="12" r="1.5" />
                  <circle cx="12" cy="12" r="1.5" />
                  <circle cx="19" cy="12" r="1.5" />
                </svg>
              </button>
            )}
          </div>
          <div className="nex-frameless-body">
            {children}
          </div>

          {/* NEX Composer / Keypad · restored to the frameless shell
              2026-09-07. Anchored to the bottom edge · full width ·
              safe-area padded so it never sits under the home-indicator
              gesture bar. Higher z-index than the orb so the composer
              is always tappable when open. Only rendered when NexAppShell
              provided a composerSlot (workspaces that hide the composer
              simply pass nothing). */}
          {composerSlot && (
            <div
              data-testid="nex-frameless-composer"
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                // Bottom offset compensates for the -3.2% inner assembly
                // offset NexAppShell line ~2311 applies to the composer
                // stack (calibrated for the framed world where composerSlot
                // sat at bottom:3.2% inside the frame). Frameless
                // composerSlot has bottom:0, so that inner -3.2% pushes
                // composer BELOW the viewport by ~27px at 390×844 without
                // this compensation. Plus env(safe-area) for iOS home-
                // indicator clearance. Philip 2026-09-07 · frameless fix.
                //
                // The +16px "keypad-closed" compensation for NexComposer's
                // marginBottom:-16 is applied via the :has()-conditional
                // style block below (line ~700 injected style), so it
                // only fires when the composer is the LAST element in the
                // assembly. When the keypad opens, it becomes a sibling
                // and NexAppShell's own `gap: 16` (line ~2334) cancels
                // the -16 automatically — the wrapper must stay at its
                // base offset in that case or the whole assembly rises
                // 16px above the viewport bottom.
                bottom: "calc(env(safe-area-inset-bottom, 0px) + calc(min(100dvh, 100dvw * 1850 / 850) * 0.032))",
                paddingLeft: "env(safe-area-inset-left, 0px)",
                paddingRight: "env(safe-area-inset-right, 0px)",
                zIndex: 50,
                display: "flex",
                alignItems: "stretch",
                justifyContent: "center",
                pointerEvents: "none",
                // overflow visible so the composer + keypad assembly
                // (which uses absolute positioning inside the wrapper)
                // can render above the wrapper's own bounds without
                // being clipped. Horizontal overshoot is prevented by
                // the inner width-clamp below.
                overflow: "visible",
              }}
            >
              <div
                style={{
                  // Match the width the composer + shared-console wrapper
                  // expect to live inside: `min(100dvw, 100dvh * 850/1850)`.
                  // That's the exact expression NexAppShell uses to compute
                  // the shared-console's edge-to-edge extent · giving the
                  // composer that width means its internal −10.82% margins
                  // resolve to the correct pixel values instead of pushing
                  // content off-screen. On a 390×844 phone this is ~388px
                  // (essentially full screen width). On desktop it produces
                  // a phone-shaped composer bar (~413px) so the keypad
                  // never stretches into a broken wide-screen row.
                  width: "min(100dvw, calc(100dvh * 850 / 1850))",
                  maxWidth: "100%",
                  height: "100%",
                  position: "relative",
                  pointerEvents: "auto",
                }}
              >
                {composerSlot}
              </div>
            </div>
          )}

          {/* NEX Voice Orb · restored to the frameless shell 2026-09-07.
              Absolute-positioned in the top-right corner (matches the
              legacy "perched" park position) · respects the same
              voiceOrbHidden gate the workspaces already use · honors
              voiceOrbTransitStyle so page-navigation flights keep
              working · the eye bubble mounts alongside as before. */}
          {!voiceOrbHidden && (
            <div
              style={{
                position: "absolute",
                // Park in the top-right AREA · sits below the sticky
                // header (~56px total: 40px icon + 8px padding + safe-
                // area-inset) so it never collides with the Profile /
                // Control Center icons on the chat page.
                top: `calc(env(safe-area-inset-top, 0px) + 64px)`,
                right: `calc(env(safe-area-inset-right, 0px) + 12px)`,
                width: 72,
                height: 72,
                zIndex: 40,
                transform: voiceOrbPerched
                  ? "translate(0%, 0%)"
                  : "translate(0, 0)",
                transition: "transform 1200ms cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                pointerEvents: "auto",
                ...voiceOrbTransitStyle,
              }}
              data-testid="nex-frameless-voice-orb"
            >
              <NexVoiceOrb
                nexState={voiceState}
                onTap={onVoiceOrbTap}
                lookAt={voiceOrbLookAt}
                pupilTransitionMs={voiceOrbPupilTransitionMs}
                autoReturn={voiceOrbAutoReturn}
                flashRed={voiceOrbFlashRed}
                hopped={voiceOrbHopped}
                hyperMode={voiceOrbHyperMode}
                perched={voiceOrbPerched}
              />
              <NexEyeBubble
                message={eyeBubbleMessage}
                dwellMs={eyeBubbleDwellMs}
                onDismiss={onEyeBubbleDismiss}
              />
            </div>
          )}
        </div>
      </>
    );
  }
  // ── /FRAMELESS ────────────────────────────────────────────────

  // Frame mode filter · Philip 2026-08-27. Applied on top of any theme-level
  // filter. Ordering: theme filter first · then mode filter · CSS composes.
  const frameModeFilter = (() => {
    switch (frameMode) {
      case "dim":    return "brightness(0.55) saturate(0.55)";     // muted orange
      case "cinema": return "grayscale(1) brightness(0.75)";        // no orange, silvery
      case "off":    return "grayscale(1) brightness(0.25)";        // near black chrome
      case "normal":
      default:       return "none";
    }
  })();
  const composedBezelFilter = [theme.bezel.filter, frameModeFilter]
    .filter((f) => f && f !== "none")
    .join(" ") || undefined;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        // Outer atmosphere fills phone edges · frame silhouette sits inside.
        // Aspect gutter on tall phones is inherent to the v6 asset aspect
        // (0.5628 vs typical phone 0.46). Philip explicitly requires no
        // metal distortion, so this gutter is intentional atmosphere.
        background: theme.lighting.outerAtmosphere,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: `-apple-system, "SF Pro Text", "Segoe UI", system-ui, sans-serif`,
        color: theme.accents.onDark,
      }}
    >
      {/* FULL-VIEWPORT BLACK ATMOSPHERE OVERLAY · Philip 2026-08-27 · when
          an interior blackout overlay (mascot stage) is active, fade the
          outer atmosphere gutter to solid black so the ENTIRE viewport is
          dark around the phone frame. z:0 sits BELOW the console viewport
          (z:1 below) · console viewport paints on top so bezel + rail
          decoration stays visible against the black atmosphere. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: "#000",
          zIndex: 0,
          opacity: hideInteriorControls ? 1 : 0,
          transition: "opacity 900ms cubic-bezier(0.4, 0, 0.2, 1)",
          pointerEvents: "none",
        }}
      />

      {/* Frame container · Philip 2026-09-01 Option B responsive sizing:
          · Default (tablet / desktop · aspect > 0.65): phone-column at
            locked aspect 850/1850 · letterboxed on wide viewports.
          · Phone-shaped device (aspect ≤ 0.65): fills viewport edge-to-
            edge · aspect stretches to device (rivets flex slightly on
            wider phones like iPhone SE) so every mobile gets full width.
          Sizing is driven by CSS class rules (see the <style> block just
          below · media query at `max-aspect-ratio: 65/100`) rather than
          inline styles so the media query can override. */}
      <style>{`
        /* Fallback chain for viewport units · Philip 2026-09-02 hard req.
           Order matters: dvh (dynamic · adjusts with browser UI) is the
           target. Older browsers fall back to vh. Middle browsers get svh
           (smallest viewport height, safe under all UI). Last declaration
           for each property wins in supporting browsers. */
        .nex-console-viewport {
          position: relative;
          z-index: 1;
          aspect-ratio: ${BEZEL_METAL.w} / ${BEZEL_METAL.h};
          width: min(100vw,  calc(100vh  * ${BEZEL_METAL.w} / ${BEZEL_METAL.h}));
          width: min(100svw, calc(100svh * ${BEZEL_METAL.w} / ${BEZEL_METAL.h}));
          width: min(100dvw, calc(100dvh * ${BEZEL_METAL.w} / ${BEZEL_METAL.h}));
          height: auto;
          max-height: 100vh;
          max-height: 100svh;
          max-height: 100dvh;
          background: #000000;
          overflow: hidden;
        }
        @media (max-aspect-ratio: 65/100) {
          .nex-console-viewport {
            aspect-ratio: auto;
            width: 100vw;
            width: 100svw;
            width: 100dvw;
            height: 100vh;
            height: 100svh;
            height: 100dvh;
            max-height: none;
          }
        }
      `}</style>
      {/* Inline style intentionally empty · all sizing/background/overflow
          rules live in the .nex-console-viewport class above so the media
          query can override them (inline styles beat class in specificity). */}
      <div
        className="nex-console-viewport"
        style={{}}
      >
        {/* LAYER 0 · Interior background · with speaking-state random swap.
            Philip 2026-08-26: base image (v1) is always default. When NEX
            enters SPEAKING state, extra images v2/v3/v4 randomly crossfade
            with v1 to give the impression the interior is reacting to voice.
            Returns to v1 when speaking ends. */}
        <InteriorBackgroundLayer
          baseSrc={theme.interior?.backgroundSrc}
          speakingBackgrounds={theme.interior?.speakingBackgrounds ?? []}
          speakingSwapMs={theme.interior?.speakingSwapMs ?? 900}
          filter={theme.interior?.backgroundFilter}
          isSpeaking={voiceState === "speaking"}
          heroSequence={theme.interior?.heroSequence}
          visible={heroVisible}
        />

        {/* LAYER 1 · Live workspace content · sits inside the interior opening
            behind the frame overlay. Chat / artifacts / cards render here. */}
        <div
          style={{
            position: "absolute",
            // Full-width mode nudges workspace UP into freed hero area.
            // Kept moderate (6% not 4%) so top edge stays inside the bezel
            // top-metal opaque strip · content doesn't render behind chrome.
            top:    chatFullWidth ? "6%" : DEFAULT_ZONES.workspace.top,
            // LEFT stays at the MEASURED bezel edge · we do NOT shift left
            // (Philip 2026-08-28 · identity chip + NEX text were being cut
            // when workspace shifted past measured viewport bounds).
            left:   DEFAULT_ZONES.workspace.left,
            // Width EXPANDS RIGHT into freed rail housing space only.
            // Normal: calc(70.13% + 4px) · Rail-hidden: WORKSPACE_WIDTH_NO_RAIL
            // Full-width: calc(70.13% + 18.07% + 4px) = ~88.2% · reaches to
            // the frame's rail-housing right boundary (99%) but stays inside.
            width:  chatFullWidth
              ? "calc(70.13% + 18.07% + 4px)"
              : hideRail ? WORKSPACE_WIDTH_NO_RAIL : DEFAULT_ZONES.workspace.width,
            // Full-width mode extends height into freed footer/hero space.
            height: chatFullWidth ? "86%" : DEFAULT_ZONES.workspace.height,
            zIndex: 1,
            // Smooth glide when full-width flips · syncs with hero fade + rail
            // stagger · reads as one coordinated layout change.
            transition: "top 600ms cubic-bezier(0.4, 0, 0.2, 1), left 600ms cubic-bezier(0.4, 0, 0.2, 1), width 600ms cubic-bezier(0.4, 0, 0.2, 1), height 600ms cubic-bezier(0.4, 0, 0.2, 1)",
            // Overflow kept as hidden so scroll happens on the inner container,
            // but borderRadius removed (Philip 2026-08-28) so there's no visible
            // rounded-corner line where bubbles clip.
            overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", inset: 0, overflow: "auto" }} className="nex-no-scrollbar">
            {children}
          </div>
        </div>

        {/* BELOW-CHAT · contextual workspace card · inside interior, below workspace */}
        <div
          style={{
            position: "absolute",
            top:    DEFAULT_ZONES.belowChat.top,
            left:   DEFAULT_ZONES.belowChat.left,
            width:  DEFAULT_ZONES.belowChat.width,
            height: DEFAULT_ZONES.belowChat.height,
            zIndex: 1,
            overflow: "hidden",
            pointerEvents: contextSlot ? "auto" : "none",
          }}
        >
          {contextSlot}
        </div>

        {/* LAYER 20 · Frame overlay artwork · sits ABOVE live content.
            When the frame image ships without a transparent interior
            (fully opaque palette PNG, external preview render, etc.)
            we cut a rectangular hole through the middle so the app
            UI beneath the frame stays visible in the phone-screen
            zone. Interior rectangle matches DEFAULT_ZONES.content
            (measured against the master chassis).
            NEX_FRAME_DISABLE_ACCENT_STACK doubles as the flag for
            "external frame image · needs interior mask". */}
        <img
          src={bezelSrc}
          alt=""
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "fill",
            pointerEvents: "none",
            zIndex: 20,
            filter: composedBezelFilter,
            transition: "filter 320ms ease",
            // Mask · white=visible, black=hidden. SVG defines a full-canvas
            // white rect with a black inner rect covering the transparent
            // interior zone. Uses the same 7.27/8.32/89.10/91.91 numbers
            // that DEFAULT_ZONES.content pins to (see hud/geometry.ts).
            ...(NEX_FRAME_DISABLE_ACCENT_STACK ? {
              maskImage:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'><rect width='100' height='100' fill='white'/><rect x='8.32' y='7.27' width='83.59' height='81.83' fill='black'/></svg>\")",
              WebkitMaskImage:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'><rect width='100' height='100' fill='white'/><rect x='8.32' y='7.27' width='83.59' height='81.83' fill='black'/></svg>\")",
              maskSize: "100% 100%",
              WebkitMaskSize: "100% 100%",
            } : {}),
          }}
        />

        {/* DEV OVERLAY · camera/earpiece cutout indicator · REMOVED
            Philip 2026-09-05 per explicit request "remove the camer red
            position in center header". The temporary red-circle marker
            (originally added 2026-09-03 to visualise where a modern
            iPhone Dynamic Island / front camera would physically sit)
            is no longer required · the position has been noted. */}

        {/* Rail-housing MASK REMOVED · Philip 2026-09-03. The dark
            overlay was itself reading as a visible black rectangle
            on the right side (didn't blend with the surrounding
            metallic chassis color). The 5 hexagonal rail housings are
            baked into the master frame PNG · to actually hide them
            cleanly we'd need either a proper `hud-frame-master-norail.png`
            variant (requires image editing) or a CSS mask-image on the
            frame img. Leaving the housings visible as chassis art for
            now · they're decorative rather than interactive. */}

        {/* Brand-orange accent regions · Philip 2026-08-28. When frameMode is
            not "normal", the base bezel image above is greyscaled/dimmed.
            These extra copies of the bezel image sit at z:21 with NO filter,
            each clip-path'd to a specific accent region.
            mix-blend-mode: color makes ONLY the chromatic (orange) pixels
            transfer their hue onto the greyscale below · neutral / grey /
            metal pixels within the clip rectangle are effectively invisible.
            Result: no visible clip-boundary artifacts · the accent regions
            blend seamlessly with the cinema-mode base. */}
        {!NEX_FRAME_DISABLE_ACCENT_STACK && frameMode !== "normal" && NEX_BRAND_ACCENT_REGIONS.map((region) => {
          // Per-region opacity resolution · Philip 2026-08-29 · BATCH 7.
          // Rail housings (id railHousing1..5) are ceremony-controlled and
          // default to 0 · this preserves pre-BATCH-6 LIVE mode where the
          // rail area was fully greyed. Non-rail regions (none exist today)
          // default to 1 so future callers get natural cinema-preserve
          // behavior without needing to opt in. Explicit map entries
          // always win.
          const isCeremonyControlled = region.id.startsWith("railHousing");
          const opacity =
            accentRegionOpacities?.[region.id] ??
            (isCeremonyControlled ? 0 : 1);
          // Accent overlay source · Philip 2026-08-29. ALWAYS use the full
          // rail variant (theme.bezel.imageSrc = v12) as the accent source,
          // never the collapsed variant. This lets housings MATERIALIZE on
          // top of a v12-norail base during the first-access ceremony · the
          // clipped v12 pixels contain the housing + baked orange while the
          // rest of the base bezel stays clean. For LIVE mode (base is v12)
          // this is unchanged (accent src was already v12).
          const accentSrc = theme.bezel.imageSrc;
          // Blend mode · Philip 2026-08-29. Rail housings paint pixels
          // directly ("normal") so they can physically appear on top of a
          // no-rail base. Non-rail regions keep the original hue-blend
          // behavior unless they specified their own blendMode.
          const resolvedBlendMode: React.CSSProperties["mixBlendMode"] =
            region.blendMode ?? (isCeremonyControlled ? "normal" : "color");
          return (
            <img
              key={region.id}
              src={accentSrc}
              alt=""
              aria-hidden
              draggable={false}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "fill",
                pointerEvents: "none",
                zIndex: 21,
                // clip-path insets · top right bottom left
                clipPath: `inset(${region.insetTop}% ${region.insetRight}% ${region.insetBottom}% ${region.insetLeft}%)`,
                // Per-region filter boost (saturate etc.) · defaults to none
                filter: region.filter ?? "none",
                mixBlendMode: resolvedBlendMode,
                opacity,
                transition: "opacity 400ms cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />
          );
        })}

        {/* Optional bezel material tint (theme-driven · doesn't change v6's
            baked orange glow · only recolours the metal luminance). */}
        {theme.bezel.tint && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 21,
              pointerEvents: "none",
              background: theme.bezel.tint.color,
              mixBlendMode: theme.bezel.tint.blendMode,
              opacity: theme.bezel.tint.opacity ?? 1,
            }}
          />
        )}

        {/* LAYER 30 · Interactive controls · rendered ON TOP of frame overlay.
            Icons + labels visible where housings appear in the artwork below. */}

        {/* SPEAKING STATIC LINES · Philip 2026-08-28. When voiceState is
            "speaking", overlay dense horizontal scan lines behind the orb
            (z:9 · below orb's z:10, above hero at z:0). Fades in over 200ms
            and out over 400ms so the effect ties visually to NEX voice.
            Uses the same hero-fade mask so lines don't bleed into chat area. */}
        {(() => {
          const SPEAKING_LINES_MASK =
            "linear-gradient(to bottom, black 0%, black 55%, transparent 100%)";
          return (
            <div
              aria-hidden
              style={{
                position: "absolute",
                top: HERO_TOP_OFFSET_PX,
                left: 0,
                width: "100%",
                height: `${HERO_HEIGHT_PCT}%`,
                zIndex: 9,
                pointerEvents: "none",
                // Dense horizontal scan lines · thin bright / dark gap pattern.
                backgroundImage:
                  "repeating-linear-gradient(0deg, rgba(249,115,22,0.20) 0px, rgba(249,115,22,0.20) 1px, transparent 1px, transparent 3px)",
                // Mask so lines vanish at the same fade boundary as the hero.
                maskImage: SPEAKING_LINES_MASK,
                WebkitMaskImage: SPEAKING_LINES_MASK,
                opacity: voiceState === "speaking" ? 0.85 : 0,
                transition:
                  voiceState === "speaking"
                    ? "opacity 200ms ease-in"
                    : "opacity 400ms ease-out",
                mixBlendMode: "screen",
              }}
            />
          );
        })()}

        {/* NEX VOICE ORB · centered on the portal ring · MAIN NEX feature.
            Philip 2026-08-27: z:10 · UNDER the drawer wrapper (z:15) so the
            drawer visibly covers the orb ("NEX ball behind the drawer"). Orb
            stays tappable when drawer closed (nothing at z:10-15 sits over
            the orb region). Bezel img at z:20 is pointerEvents:none · doesn't
            block taps. Voice orb visible through bezel's transparent interior.
            Doctrine: workspace identity 2026-08-25 · voice is core NEX.
            Philip 2026-09-05 · voiceOrbHidden gate: workspaces (e.g. Products)
            can hide the orb so it doesn't visually compete with interior
            content · orb stays functional · returns when flag is false. */}
        {!voiceOrbHidden && (
        <div
          style={{
            position: "absolute",
            top:    BEZEL_AFFORDANCES.voiceOrb.top,
            left:   BEZEL_AFFORDANCES.voiceOrb.left,
            width:  BEZEL_AFFORDANCES.voiceOrb.width,
            height: BEZEL_AFFORDANCES.voiceOrb.height,
            zIndex: 10,
            // Perched · NEX floats to TOP-RIGHT CORNER during full-width mode.
            // 1.2s slow curved trajectory · her hopped + shrink state carries
            // over so she arrives smaller. Composes with hopped translate/scale
            // handled inside the orb itself. (Philip 2026-08-28 · corner
            // destination bumped from (70%,-35%) → (110%,-70%) so she perches
            // actually AT the corner, not near it.)
            // Perched = VISIBLE top-right park position (Philip 2026-08-29
            // BATCH 1 · reverted from off-screen 220% back to 110%,-70%).
            // Kebab tap parks orb here · orb stays clearly inside phone
            // viewport. Chat auto-fly-off uses its own separate transit
            // style that goes off-screen (does NOT set perched).
            transform: voiceOrbPerched
              ? "translate(110%, -70%)"
              : "translate(0, 0)",
            transition: "transform 1200ms cubic-bezier(0.25, 0.46, 0.45, 0.94)",
            // Shell-provided transit style · overrides base transform +
            // adds opacity + custom transition during page-navigation
            // sequences (Philip 2026-08-29 · orb flies off in random
            // direction, page swaps, orb re-enters top-right corner).
            ...voiceOrbTransitStyle,
          }}
        >
          <NexVoiceOrb nexState={voiceState} onTap={onVoiceOrbTap} lookAt={voiceOrbLookAt} pupilTransitionMs={voiceOrbPupilTransitionMs} autoReturn={voiceOrbAutoReturn} flashRed={voiceOrbFlashRed} hopped={voiceOrbHopped} hyperMode={voiceOrbHyperMode} perched={voiceOrbPerched} />
          <NexEyeBubble
            message={eyeBubbleMessage}
            dwellMs={eyeBubbleDwellMs}
            onDismiss={onEyeBubbleDismiss}
          />
        </div>
        )}

        {/* NEX wordmark hit target · top-left of top bezel · hidden when
            an interior-blackout overlay (mascot stage) is active. */}
        {!hideInteriorControls && (
          <TouchButton
            aria-label="NEX home"
            onTap={() => onBezelButton?.("nex-wordmark")}
            style={{
              position: "absolute",
              top:    BEZEL_AFFORDANCES.wordmark.top,
              left:   BEZEL_AFFORDANCES.wordmark.left,
              width:  BEZEL_AFFORDANCES.wordmark.width,
              height: BEZEL_AFFORDANCES.wordmark.height,
              zIndex: 30,
              appearance: "none",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              padding: 0,
            }}
          >{null}</TouchButton>
        )}

        {/* Header-top-centre orange bar removed · Philip 2026-09-01.
            The CSS-drawn `.nex-header-lights` pulsing orange bar has been
            deleted from all frame surfaces. If a future surface needs an
            explicit top-centre affordance (e.g. friend identity), it should
            render as its own portalled overlay (see NexWorkspaceFriends'
            FriendHeaderIdentity for the pattern). */}

        {/* 3 header icons · top-right · rendered on top of the frame's header
            icon housings. 2026-08-26 · Philip · white + 2x size. */}
        {!hideInteriorControls && [BEZEL_AFFORDANCES.headerIcon1, BEZEL_AFFORDANCES.headerIcon2, BEZEL_AFFORDANCES.headerIcon3].map((slot, i) => {
          const btn = headerIcons[i];
          if (!btn) return null;
          return (
            <HeaderIconSlot
              key={btn.id}
              slot={slot}
              btn={btn}
            />
          );
        })}

        {/* SIDE · rail hit targets · 5 slots · overlaid on rail housing.
            Icons + labels rendered on top of the frame's visible slot
            artwork. Rail buttons render icon above label per v6 example.
            z:100 keeps rail buttons ON TOP of the mascot drawer (z:29).
            Philip 2026-08-28 · STAGGER-FADE: each button opacity animates
            individually with 60ms per-index delay so they vanish top-to-
            bottom instead of all-at-once. Rail div always in DOM · opacity
            + pointerEvents gate visibility + hit-testing. */}
        <div
          style={{
            position: "absolute",
            top:    DEFAULT_ZONES.side.top,
            right:  DEFAULT_ZONES.side.right,
            width:  DEFAULT_ZONES.side.width,
            height: DEFAULT_ZONES.side.height,
            zIndex: 100,
            display: "grid",
            gridTemplateRows: `repeat(${RAIL_SLOT_COUNT}, 1fr)`,
            gap: 2,
            pointerEvents: hideRail ? "none" : "auto",
          }}
        >
          {Array.from({ length: RAIL_SLOT_COUNT }).map((_, i) => {
            const btn = rightRailContent[i];
            // Per-button visibility resolution · Philip 2026-08-29 · BATCH 7.
            // When visibleRailButtonCount is provided (ceremony), only the
            // top N buttons are visible · gives the sequential top-to-bottom
            // reveal that pairs with each rail housing lighting up.
            // When undefined, falls back to the existing hideRail all-or-
            // nothing behavior so pre-BATCH-7 callers behave identically.
            const perButtonMode = typeof visibleRailButtonCount === "number";
            const isVisible = perButtonMode
              ? i < visibleRailButtonCount
              : !hideRail;
            // Ceremony cadence uses a longer per-button fade so each
            // control reads as "just powered on"; legacy hideRail path
            // keeps the original 240ms stagger.
            const transitionMs = perButtonMode ? 400 : 240;
            const delayMs      = perButtonMode ? 0   : i * 60;
            return (
              <div
                key={`slot-${i}`}
                style={{
                  opacity: isVisible ? 1 : 0,
                  pointerEvents: isVisible ? "auto" : "none",
                  transition: `opacity ${transitionMs}ms cubic-bezier(0.4, 0, 0.2, 1) ${delayMs}ms`,
                }}
              >
                {btn ? <RailButtonSlot btn={btn} accent={accent} /> : <div aria-hidden />}
              </div>
            );
          })}
        </div>

        {/* KEBAB · 3-dot vertical menu under the Food rail button · Philip
            2026-08-28. Sits in the dead space between rail (76%) and
            composer (92%). Tap → onRightKebabTap · parent opens a slide
            panel via overlaySlot. z:100 matches rail so both stay on top. */}
        {!hideInteriorControls && onRightKebabTap && (
          <>
            <TouchButton
              aria-label="More options"
              onTap={onRightKebabTap}
              style={{
                position: "absolute",
                // Philip 2026-08-29 · nudged left 5px + down 5px from
                // geometry.ts base position (calc keeps the existing
                // percentage + 5px offset without touching geometry).
                top:    `calc(${BEZEL_AFFORDANCES.rightKebab.top} + 5px)`,
                right:  `calc(${BEZEL_AFFORDANCES.rightKebab.right} + 5px)`,
                width:  BEZEL_AFFORDANCES.rightKebab.width,
                height: BEZEL_AFFORDANCES.rightKebab.height,
                zIndex: 100,
                appearance: "none",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                padding: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "18%",
              }}
            >
              {/* 3 flashing orange dots · heartbeat cadence · Philip 2026-08-29
                  (was white static dots). Each dot pulses on the same
                  lub-dub rhythm; staggered animation-delay makes it feel
                  more organic (dots don't strobe in perfect sync). */}
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  aria-hidden
                  className="nex-kebab-dot"
                  style={{
                    width: "16%",
                    height: "16%",
                    minWidth: 4,
                    minHeight: 4,
                    borderRadius: "50%",
                    background: rightKebabActive
                      ? accent
                      : "rgba(251, 146, 60, 0.95)",
                    boxShadow: "0 0 6px rgba(249,115,22,0.85), 0 0 12px rgba(249,115,22,0.45)",
                    animationDelay: `${i * 80}ms`,
                  }}
                />
              ))}
            </TouchButton>
            <style>{`
              @keyframes nex-kebab-heartbeat {
                0%, 40%, 100% { opacity: 0.55; transform: scale(1); }
                8%            { opacity: 1;    transform: scale(1.2); }
                20%           { opacity: 0.7;  transform: scale(1); }
                28%           { opacity: 1;    transform: scale(1.18); }
              }
              .nex-kebab-dot {
                animation: nex-kebab-heartbeat 1.4s ease-in-out infinite;
              }
              @media (prefers-reduced-motion: reduce) {
                .nex-kebab-dot { animation: none !important; opacity: 0.9 !important; }
              }
            `}</style>
          </>
        )}

        {/* BOTTOM FADE (z:15) · Philip 2026-09-02 · "shade should be
            behind the phone frame in footer not overlay". Sits BELOW the
            frame image (z:20) so the metallic chassis chrome paints on
            top of the gradient in the bezel area. Only the transparent
            centre of the frame lets the fade show through. */}
        {!hideInteriorControls && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              bottom: DEFAULT_ZONES.bottom.bottom,
              left:   DEFAULT_ZONES.bottom.left,
              width:  DEFAULT_ZONES.bottom.width,
              height: DEFAULT_ZONES.bottom.height,
              zIndex: 15,
              pointerEvents: "none",
              background:
                "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 40%, rgba(0,0,0,0.95) 65%, rgba(0,0,0,1) 73%, rgba(0,0,0,1) 100%)",
            }}
          />
        )}

        {/* BOTTOM · composer stack · Philip 2026-09-01 seamless HUD.
            Zone grew from 5% → 18% tall (see geometry.ts DEFAULT_ZONES.bottom)
            to hold the composer's own fade region + chips row + input bar.
            Wrapper is transparent · pointer-events pass through the fade
            to chat below · composer contents own their own hit targets.
            z:30 keeps the interactive INPUT ROW in front of the frame
            chassis so the user can see + tap it; only the fade below
            renders behind the frame. */}
        {!hideInteriorControls && (
          <div
            style={{
              position: "absolute",
              bottom: DEFAULT_ZONES.bottom.bottom,
              left:   DEFAULT_ZONES.bottom.left,
              width:  DEFAULT_ZONES.bottom.width,
              height: DEFAULT_ZONES.bottom.height,
              zIndex: 30,
              display: "flex",
              alignItems: "stretch",
              justifyContent: "center",
              pointerEvents: "none", // gradient part passes through · form re-enables
            }}
          >
            {composerSlot}
          </div>
        )}

        {/* OVERLAY SLOT · Philip 2026-08-27 · same-stacking-context sibling
            of chat/bezel/rail so its own z-index can layer between them.
            Mascot drawer uses z:29 · paints ABOVE chat (z:1) + bezel (z:20)
            but BELOW the rail buttons (z:50). */}
        {overlaySlot}

        {/* INTERIOR HEADER · Philip 2026-08-27 · text in the top-bezel free
            space (between the wordmark plate on the left and the header-icon
            plates on the right). Only visible while an interior blackout is
            active (mascot stage). z:30 paints above the bezel metal. */}
        {hideInteriorControls && interiorHeader && (
          <div
            style={{
              position: "absolute",
              // Philip 2026-08-27 · nudged down 32px total (10 + 10 + 7 + 5).
              top: "calc(1.4% + 32px)",
              left: "24%",
              right: "24%",
              zIndex: 30,
              textAlign: "center",
              pointerEvents: "none",
            }}
          >
            {interiorHeader}
          </div>
        )}
        {/* Frame overlay slot · absolute-positioned children render inside
            the aspect-locked phone container using phone-relative % coords.
            z:8 · ABOVE workspace content (z:1) + hero (z:0) but BELOW the
            frame chrome (z:20+ for bezel/rail). Butterfly and similar
            "inside phone" content clips naturally behind frame silhouette
            (Philip 2026-08-28 · "should fly under phone frame not over"). */}
        {frameOverlaySlot && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 8,
              pointerEvents: "none",
            }}
          >
            {frameOverlaySlot}
          </div>
        )}
      </div>
    </div>
  );
}
