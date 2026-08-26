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
} from "./hud/geometry";
import { useChromaKeyedBezel } from "./hud/useChromaKeyedBezel";
import { NexVoiceOrb } from "./NexVoiceOrb";
import { NexEyeBubble } from "./NexEyeBubble";
import { useGuidanceTarget, type GuidanceTargetId } from "./hud/NexGuidance";
import type { NexVoiceState } from "@/lib/nex-voice";
import {
  NEX_HUD_THEME_REGISTRY,
  DEFAULT_THEME_ID,
  type NexHudTheme,
} from "./hud/theme";
import { MODE_LABEL, type NexHudMode } from "./hud/modes";

export type { NexHudMode } from "./hud/modes";

export interface RailButton {
  id: string;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  onClick: () => void;
  /** Optional guidance target id · lets NEX point at this button. */
  guidanceTarget?: GuidanceTargetId;
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
  onBezelButton?: (id: BezelButtonId) => void;
  /** Live workspace content · rendered inside the transparent interior. */
  children?: React.ReactNode;
  /** Voice state · drives the central voice orb animation. */
  voiceState?: NexVoiceState;
  /** Tap the voice orb → voice.tap() (idle→listen · etc.). */
  onVoiceOrbTap?: () => void;
  /** Eye look direction · orb pupil turns toward it, auto-returns to centre. */
  voiceOrbLookAt?: import("./NexVoiceOrb").OrbLookDirection | null;
  /** Speech bubble beneath the eye · character response to eye taps. */
  eyeBubbleMessage?: string | null;
  eyeBubbleDwellMs?: number;
  onEyeBubbleDismiss?: () => void;
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
  baseSrc, speakingBackgrounds, speakingSwapMs, filter, isSpeaking,
}: {
  baseSrc?: string;
  speakingBackgrounds: string[];
  speakingSwapMs: number;
  filter?: string;
  isSpeaking: boolean;
}) {
  const [overlaySrc, setOverlaySrc] = useState<string | null>(null);
  const [overlayVisible, setOverlayVisible] = useState(false);

  useEffect(() => {
    if (!isSpeaking || speakingBackgrounds.length === 0) {
      // Fade overlay out · then clear.
      setOverlayVisible(false);
      const clear = setTimeout(() => setOverlaySrc(null), 500);
      return () => clearTimeout(clear);
    }
    // Start swapping. Immediately pick a random overlay and fade in.
    const pickRandom = () => {
      const options = [baseSrc, ...speakingBackgrounds].filter(Boolean) as string[];
      // Prefer not to reshow the currently-displayed overlay.
      const filtered = options.filter((s) => s !== overlaySrc);
      const pool = filtered.length > 0 ? filtered : options;
      return pool[Math.floor(Math.random() * pool.length)];
    };
    setOverlaySrc(pickRandom());
    setOverlayVisible(true);
    const interval = setInterval(() => {
      setOverlaySrc(pickRandom());
    }, speakingSwapMs);
    return () => clearInterval(interval);
    // baseSrc / speakingBackgrounds / swapMs are stable per theme so we
    // deliberately exclude them from deps to avoid restarting the interval
    // on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSpeaking]);

  if (!baseSrc) return null;

  const style: React.CSSProperties = {
    position: "absolute",
    top: 0,
    left: -4,
    width: "calc(100% + 4px)",
    height: "100%",
    objectFit: "cover",
    objectPosition: "center top",
    pointerEvents: "none",
    filter,
  };

  return (
    <>
      {/* Base image · always visible · z:0 */}
      <img
        src={baseSrc}
        alt=""
        aria-hidden
        style={{ ...style, zIndex: 0 }}
      />
      {/* Overlay image · crossfades in during speaking · z:0.5
          (0 doesn't quite work in React so we use inline zIndex with a
          decimal cheat via string · the important thing is it sits above
          base + below content zones at z:3). */}
      {overlaySrc && (
        <img
          src={overlaySrc}
          alt=""
          aria-hidden
          style={{
            ...style,
            zIndex: 0,
            opacity: overlayVisible ? 1 : 0,
            transition: "opacity 500ms ease-in-out",
          }}
        />
      )}
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
    <button
      ref={attach as (el: HTMLButtonElement | null) => void}
      type="button"
      aria-label={btn.label}
      onClick={btn.onClick}
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
    </button>
  );
}

function RailButtonSlot({ btn, accent }: { btn: RailButton; accent: string }) {
  const attach = useGuidanceTarget(btn.guidanceTarget ?? btn.id);
  return (
    <button
      ref={attach as (el: HTMLButtonElement | null) => void}
      type="button"
      aria-label={btn.label}
      onClick={btn.onClick}
      style={{
        appearance: "none",
        border: "none",
        background: "transparent",
        cursor: "pointer",
        padding: 0,
        color: accent,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "3%",
        transition: "opacity 180ms ease",
        opacity: btn.active ? 1 : 0.85,
      }}
    >
      <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "40%", height: "40%" }}>
        {btn.icon}
      </span>
      <span
        style={{
          fontSize: "clamp(8px, 1.3vw, 11px)",
          fontWeight: 600,
          letterSpacing: 0.2,
          color: accent,
          lineHeight: 1,
          whiteSpace: "nowrap",
        }}
      >
        {btn.label}
      </span>
    </button>
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
  onBezelButton,
  children,
  voiceState = "idle",
  onVoiceOrbTap,
  voiceOrbLookAt = null,
  eyeBubbleMessage = null,
  eyeBubbleDwellMs,
  onEyeBubbleDismiss,
}: Props) {
  const theme = resolveTheme(themeId);
  const accent = theme.accents.primary;
  // Chroma-key JPEGs; PNG/SVG/WebP pass through untouched (v6 has native alpha).
  const bezelSrc = useChromaKeyedBezel(theme.bezel.imageSrc) ?? theme.bezel.imageSrc;

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
      {/* Frame container · aspect-locked to v6 · fits inside phone viewport
          preserving aspect · all zone %s below are relative to this box. */}
      <div
        className="nex-console-viewport"
        style={{
          position: "relative",
          aspectRatio: BEZEL_ASPECT_RATIO,
          width: `min(100dvw, calc(100dvh * ${BEZEL_METAL.w} / ${BEZEL_METAL.h}))`,
          height: "auto",
          maxHeight: "100dvh",
          background: "#000000",
          overflow: "hidden",
        }}
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
        />

        {/* LAYER 1 · Live workspace content · sits inside the interior opening
            behind the frame overlay. Chat / artifacts / cards render here. */}
        <div
          style={{
            position: "absolute",
            top:    DEFAULT_ZONES.workspace.top,
            left:   DEFAULT_ZONES.workspace.left,
            width:  DEFAULT_ZONES.workspace.width,
            height: DEFAULT_ZONES.workspace.height,
            zIndex: 1,
            overflow: "hidden",
            borderRadius: 4,
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

        {/* LAYER 20 · Frame overlay artwork · transparent interior · sits
            ABOVE live content. Metal chassis + rail housings + bottom pill
            + orange glow are all opaque parts of this image. */}
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
            filter: theme.bezel.filter,
          }}
        />

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

        {/* NEX VOICE ORB · centered on the portal ring · MAIN NEX feature.
            Philip 2026-08-27: z:10 · UNDER the drawer wrapper (z:15) so the
            drawer visibly covers the orb ("NEX ball behind the drawer"). Orb
            stays tappable when drawer closed (nothing at z:10-15 sits over
            the orb region). Bezel img at z:20 is pointerEvents:none · doesn't
            block taps. Voice orb visible through bezel's transparent interior.
            Doctrine: workspace identity 2026-08-25 · voice is core NEX. */}
        <div
          style={{
            position: "absolute",
            top:    BEZEL_AFFORDANCES.voiceOrb.top,
            left:   BEZEL_AFFORDANCES.voiceOrb.left,
            width:  BEZEL_AFFORDANCES.voiceOrb.width,
            height: BEZEL_AFFORDANCES.voiceOrb.height,
            zIndex: 10,
          }}
        >
          <NexVoiceOrb nexState={voiceState} onTap={onVoiceOrbTap} lookAt={voiceOrbLookAt} />
          <NexEyeBubble
            message={eyeBubbleMessage}
            dwellMs={eyeBubbleDwellMs}
            onDismiss={onEyeBubbleDismiss}
          />
        </div>

        {/* NEX wordmark hit target · top-left of top bezel */}
        <button
          type="button"
          aria-label="NEX home"
          onClick={() => onBezelButton?.("nex-wordmark")}
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
        />

        {/* 3 header icons · top-right · rendered on top of the frame's header
            icon housings. 2026-08-26 · Philip · white + 2x size. */}
        {[BEZEL_AFFORDANCES.headerIcon1, BEZEL_AFFORDANCES.headerIcon2, BEZEL_AFFORDANCES.headerIcon3].map((slot, i) => {
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
            z:100 keeps rail buttons ON TOP of the mascot drawer (z:29) so
            the drawer visibly slides OUT from under the rail column instead
            of covering it · Philip 2026-08-27. */}
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
          }}
        >
          {Array.from({ length: RAIL_SLOT_COUNT }).map((_, i) => {
            const btn = rightRailContent[i];
            if (!btn) return <div key={`slot-${i}`} aria-hidden />;
            return <RailButtonSlot key={btn.id} btn={btn} accent={accent} />;
          })}
        </div>

        {/* BOTTOM · composer · sits over the bottom pill housing artwork.
            Always visible · no separate nav dock per Philip 2026-08-26. */}
        <div
          style={{
            position: "absolute",
            bottom: DEFAULT_ZONES.bottom.bottom,
            left:   DEFAULT_ZONES.bottom.left,
            width:  DEFAULT_ZONES.bottom.width,
            height: DEFAULT_ZONES.bottom.height,
            zIndex: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {composerSlot}
        </div>

        {/* OVERLAY SLOT · Philip 2026-08-27 · same-stacking-context sibling
            of chat/bezel/rail so its own z-index can layer between them.
            Mascot drawer uses z:29 · paints ABOVE chat (z:1) + bezel (z:20)
            but BELOW the rail buttons (z:50). */}
        {overlaySlot}
      </div>
    </div>
  );
}
