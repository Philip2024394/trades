"use client";

// src/app/nex-native/chat-standard/_engine/theme-engine.tsx
//
// Phase 2A.0 · The Theme Engine.
//
// Load-bearing: NEX owns the experience. The Theme Engine owns how
// that experience feels.
//
// Takes a (possibly partial) ThemePackage, fills gaps with sensible
// NEX-neutral defaults, and exposes one method per surface returning
// a resolved treatment object. Surfaces call these methods — they
// never read package.id, theme.id, or wallpaper_config directly.
//
// New surfaces add a new method here + a new treatment type in
// ./types.ts. New themes just supply more of the package.

import * as React from "react";
import {
  type AmbientLayer,
  type AmbientTreatment,
  type AnimationPersonality,
  type BubbleTreatment,
  type ColourSystem,
  type ComposerTreatment,
  type EmojiTreatment,
  type IntroResolverInput,
  type IntroSource,
  type ReactionTreatmentResolved,
  type ShopTreatmentResolved,
  type StickerTreatment,
  type ThemePackage,
} from "./types";
import { generateStickerSet } from "./sticker-generator";
import { FALLBACK_FADE_IN, MOTION_TABLE, keyframesFor } from "./motion-library";

// ─── Default colour system ──────────────────────────────────────────

const NEX_DEFAULT_COLOURS: ColourSystem = {
  primary: "#00AFFF",
  secondary: "#4FC3DC",
  highlight: "#F4F7FC",
  glow: "rgba(0,175,255,0.35)",
  deep: "#020914",
};

function resolveColours(c: ColourSystem | undefined): Required<ColourSystem> {
  return {
    primary: c?.primary ?? NEX_DEFAULT_COLOURS.primary!,
    secondary: c?.secondary ?? NEX_DEFAULT_COLOURS.secondary!,
    highlight: c?.highlight ?? NEX_DEFAULT_COLOURS.highlight!,
    glow: c?.glow ?? `${c?.primary ?? NEX_DEFAULT_COLOURS.primary}55`,
    deep: c?.deep ?? NEX_DEFAULT_COLOURS.deep!,
  };
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace(/^#/, "");
  const full =
    clean.length === 3
      ? clean.split("").map((x) => x + x).join("")
      : clean.length === 6 || clean.length === 8
        ? clean.slice(0, 6)
        : "00afff";
  const n = parseInt(full, 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Engine ─────────────────────────────────────────────────────────

export interface ResolvedEngine {
  package: ThemePackage;
  personality: AnimationPersonality;
  colours: Required<ColourSystem>;

  // Surface treatments
  bubbleTreatment(args: { mine: boolean; isReacting?: boolean }): BubbleTreatment;
  composerTreatment(): ComposerTreatment;
  emojiTreatment(): EmojiTreatment;
  stickerTreatment(): StickerTreatment;
  ambientTreatment(): AmbientTreatment;
  shopTreatment(): ShopTreatmentResolved;
  reactionTreatment(): ReactionTreatmentResolved;

  // Intro resolver (architecture-aware for Business Intro)
  resolveIntro(input: IntroResolverInput): IntroSource | null;

  // The <style> block callers should mount once (keyframes + CSS vars).
  stylesheet: string;
}

export function createEngine(pkg: ThemePackage): ResolvedEngine {
  const personality = pkg.personality;
  const colours = resolveColours(pkg.colours);
  const motionRow = MOTION_TABLE[personality];

  // CSS custom properties scoped under [data-nex-standard-experience]
  // so every surface can lean on them.
  const cssVars = `
    [data-nex-standard-experience] {
      --nex-se-primary:   ${colours.primary};
      --nex-se-secondary: ${colours.secondary};
      --nex-se-highlight: ${colours.highlight};
      --nex-se-glow:      ${colours.glow};
      --nex-se-deep:      ${colours.deep};
      --nex-se-primary-25: ${hexToRgba(colours.primary, 0.25)};
      --nex-se-primary-45: ${hexToRgba(colours.primary, 0.45)};
      --nex-se-primary-75: ${hexToRgba(colours.primary, 0.75)};
      --nex-se-focus: ${hexToRgba(colours.primary, 0.35)};
    }`;

  const stylesheet = `${cssVars}\n${keyframesFor(personality)}`;

  const bubbleShape = pkg.bubbles?.shape ?? "classic";
  const bubbleMaterial = pkg.bubbles?.material ?? "glass";
  const entranceToken = pkg.bubbles?.motion?.entrance ?? motionRow.bubbleEntrance;
  const idleToken = pkg.bubbles?.motion?.idle ?? motionRow.bubbleIdle;
  const reactionToken =
    pkg.bubbles?.motion?.reaction ?? motionRow.bubbleReaction;

  function bubbleTreatment({
    mine,
    isReacting,
  }: {
    mine: boolean;
    isReacting?: boolean;
  }): BubbleTreatment {
    const borderRadius = resolveBubbleGeometry(bubbleShape, mine);
    const background = resolveBubbleBackground(
      bubbleMaterial,
      colours,
      mine,
    );
    const border = resolveBubbleBorder(bubbleMaterial, colours, mine);
    const shadow = resolveBubbleShadow(bubbleMaterial, colours, mine);
    const backdropFilter = resolveBackdropFilter(bubbleMaterial);
    const effects = {
      sendFlicker: pkg.bubbles?.effects?.sendFlicker ?? true,
      receiveRipple: pkg.bubbles?.effects?.receiveRipple ?? true,
      sparkleOnSend: pkg.bubbles?.effects?.sparkleOnSend ?? false,
      bubbleTrailOnSend:
        pkg.bubbles?.effects?.bubbleTrailOnSend ?? false,
    };

    // Inner-light overlay · liquid-ish materials get a slow drifting
    // highlight so they feel alive at rest. Water uses a wandering
    // caustic highlight; warm-liquid uses a thin surface-steam band
    // near the top (reads as crema haze catching light). Pure CSS ·
    // the Bubble surface renders this as an aria-hidden overlay.
    const innerLightOverlay: React.CSSProperties | undefined =
      bubbleMaterial === "water"
        ? {
            position: "absolute",
            inset: 0,
            borderRadius,
            pointerEvents: "none",
            background: `radial-gradient(ellipse 40% 30% at 20% 15%, ${hexToRgba(colours.highlight, 0.55)} 0%, ${hexToRgba(colours.highlight, 0.1)} 45%, transparent 70%)`,
            backgroundSize: "180% 180%",
            mixBlendMode: "screen",
            animation:
              "nex-se-water-inner-drift 5.5s ease-in-out infinite alternate",
          }
        : bubbleMaterial === "warm-liquid"
          ? {
              // Crema band at top + a slow horizontal drift of the
              // highlight. Also adds a small inner bottom-core glow
              // (like coffee settling) via the same background stack.
              // Explicitly NOT a wandering caustic · a lateral breath.
              position: "absolute",
              inset: 0,
              borderRadius,
              pointerEvents: "none",
              background: `
                linear-gradient(180deg, ${hexToRgba(colours.highlight, 0.55)} 0%, ${hexToRgba(colours.highlight, 0.14)} 14%, transparent 24%),
                radial-gradient(ellipse 55% 25% at 50% 92%, ${hexToRgba(colours.glow, 0.6)} 0%, transparent 70%)
              `,
              backgroundSize: "180% 100%, 100% 100%",
              backgroundRepeat: "no-repeat, no-repeat",
              mixBlendMode: "screen",
              animation:
                "nex-se-warm-liquid-surface 4.2s ease-in-out infinite",
            }
          : undefined;

    return {
      geometry: {
        borderRadius,
        padding: "9px 14px",
      },
      material: {
        background,
        backdropFilter,
        border,
        boxShadow: shadow,
      },
      motion: {
        entrance:
          typeof entranceToken === "string" ? entranceToken : FALLBACK_FADE_IN,
        idle: idleToken ?? null,
        reaction: isReacting ? (reactionToken ?? null) : null,
      },
      effects,
      typography: {
        color: colours.highlight,
        textShadow: "0 1px 4px rgba(0,0,0,0.55)",
        fontWeight: 500,
      },
      innerLightOverlay,
    };
  }

  function composerTreatment(): ComposerTreatment {
    const sendGlyph = pkg.composer?.sendGlyph ?? "↑";
    const shape = pkg.composer?.shape ?? "pill";
    const material = pkg.composer?.material ?? bubbleMaterial;
    const containerBg = resolveBubbleBackground(material, colours, false);
    const containerBorder = resolveBubbleBorder(material, colours, false);
    const borderRadius =
      shape === "water"
        ? "28px 36px 24px 32px / 24px 28px 20px 26px"
        : shape === "rounded"
          ? "16px"
          : "999px";
    const isWarmMaterial =
      material === "ceramic" ||
      material === "warm-liquid" ||
      material === "parchment";
    const containerBoxShadow =
      material === "water"
        ? `inset 0 2px 4px ${hexToRgba(colours.highlight, 0.4)}, inset 0 -4px 10px ${hexToRgba(colours.deep, 0.3)}, 0 2px 14px ${hexToRgba(colours.primary, 0.25)}`
        : isWarmMaterial
          ? `inset 0 2px 4px ${hexToRgba(colours.highlight, 0.5)}, inset 0 -6px 14px ${hexToRgba(colours.deep, 0.35)}, 0 2px 14px ${hexToRgba(colours.glow, 0.4)}`
          : undefined;
    return {
      containerStyle: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "9px 12px",
        borderRadius,
        background: containerBg,
        border: containerBorder,
        backdropFilter: resolveBackdropFilter(material) ?? undefined,
        boxShadow: containerBoxShadow,
        // Perceptible-during-use motion · water gets a shimmer with a
        // tiny lateral surface ripple; warm materials get a calm breath
        // with a tiny vertical lift reading as warmth. Both cycles sit
        // around 3-4s so a user sees them live without them nagging.
        animation:
          material === "water"
            ? "nex-se-water-ambient-shimmer 3.4s ease-in-out infinite"
            : isWarmMaterial
              ? "nex-se-warm-container-breath 3.6s ease-in-out infinite"
              : undefined,
      },
      inputStyle: {
        flex: 1,
        minWidth: 0,
        background: "transparent",
        border: "none",
        outline: "none",
        color: colours.highlight,
        fontSize: 13,
        fontFamily: "inherit",
      },
      sendButtonStyle: {
        width: 32,
        height: 32,
        borderRadius: 999,
        background: colours.primary,
        border: "none",
        color: colours.deep,
        fontSize: 14,
        fontWeight: 800,
        cursor: "pointer",
        display: "grid",
        placeItems: "center",
      },
      sendGlyph,
      focusAnimation: motionRow.composerFocusKeyframes
        ? "nex-se-focus-pulse"
        : null,
    };
  }

  function emojiTreatment(): EmojiTreatment {
    const tileSize = pkg.emoji?.tileSize ?? 36;
    const framingKind = pkg.emoji?.framingKind ?? "none";
    const tileStyle: React.CSSProperties = (() => {
      switch (framingKind) {
        case "water-ring":
          return {
            width: tileSize,
            height: tileSize,
            borderRadius: 999,
            background: hexToRgba(colours.highlight, 0.1),
            border: `1.5px solid ${hexToRgba(colours.secondary, 0.5)}`,
            display: "grid",
            placeItems: "center",
            boxShadow: `inset 0 0 10px ${hexToRgba(colours.primary, 0.25)}`,
          };
        case "card":
          return {
            width: tileSize,
            height: tileSize,
            borderRadius: 10,
            background: hexToRgba(colours.deep, 0.4),
            border: `1px solid ${hexToRgba(colours.primary, 0.3)}`,
            display: "grid",
            placeItems: "center",
          };
        case "sticker":
          return {
            width: tileSize,
            height: tileSize,
            borderRadius: 12,
            background: hexToRgba(colours.highlight, 0.08),
            display: "grid",
            placeItems: "center",
          };
        case "none":
        default:
          return {
            width: tileSize,
            height: tileSize,
            display: "grid",
            placeItems: "center",
          };
      }
    })();
    return {
      tileSize,
      tileStyle,
      colorFilter: pkg.emoji?.colorShift ?? null,
      pickAnimation: pkg.emoji?.bounceOnPick ? "nex-se-pop" : null,
    };
  }

  function stickerTreatment(): StickerTreatment {
    return generateStickerSet(pkg.stickers, colours, personality);
  }

  function ambientTreatment(): AmbientTreatment {
    const ambient = pkg.ambient;
    const families = ambient?.families ?? motionRow.ambientFamily;
    const density = ambient?.density ?? "medium";
    const densityScale =
      density === "sparse" ? 0.5 : density === "dense" ? 1.6 : 1;
    return {
      families: families.map((kind) => ({
        kind,
        color: resolveAmbientColour(kind, colours),
        density: Math.round(resolveAmbientBaseCount(kind) * densityScale),
        speedSeconds: resolveAmbientSpeed(kind),
        size: resolveAmbientSize(kind),
      })),
    };
  }

  function shopTreatment(): ShopTreatmentResolved {
    const cardStyle = pkg.shop?.cardStyle ?? "glass";
    const scrollFeel = pkg.shop?.scrollFeel ?? "momentum";
    const productFraming = pkg.shop?.productFraming ?? "card";
    const base = resolveBubbleBackground("glass", colours, false);
    // When the theme uses a water-adjacent card style, overlay a thin
    // diagonal sheen that drifts across the tile · same shared
    // keyframe (nex-se-water-tile-sheen) any theme can opt into.
    const wantsWaterLight =
      cardStyle === "driftwood-board" || cardStyle === "shell";
    const wantsWarmSheen =
      cardStyle === "wood-plank" || cardStyle === "ceramic-tile";
    const sheenBg = wantsWaterLight
      ? `linear-gradient(100deg, transparent 10%, ${hexToRgba(colours.highlight, 0.22)} 40%, ${hexToRgba(colours.highlight, 0.32)} 50%, ${hexToRgba(colours.highlight, 0.22)} 60%, transparent 90%)`
      : wantsWarmSheen
        ? `linear-gradient(100deg, transparent 20%, ${hexToRgba(colours.glow, 0.3)} 48%, ${hexToRgba(colours.glow, 0.42)} 52%, transparent 80%)`
        : null;
    const cardBg =
      cardStyle === "driftwood-board"
        ? `linear-gradient(135deg, ${hexToRgba(colours.secondary, 0.4)}, ${hexToRgba(colours.deep, 0.65)})`
        : cardStyle === "shell"
          ? `radial-gradient(ellipse at 50% 100%, ${hexToRgba(colours.highlight, 0.28)}, ${hexToRgba(colours.secondary, 0.44)})`
          : cardStyle === "ticket"
            ? `${hexToRgba(colours.highlight, 0.95)}`
            : cardStyle === "terminal"
              ? `${hexToRgba(colours.deep, 0.92)}`
              : cardStyle === "wood-plank"
                ? `
                  linear-gradient(90deg, ${hexToRgba(colours.deep, 0.55)} 0%, ${hexToRgba(colours.secondary, 0.4)} 50%, ${hexToRgba(colours.deep, 0.55)} 100%),
                  repeating-linear-gradient(90deg, ${hexToRgba(colours.deep, 0.18)} 0 8px, transparent 8px 24px)
                `
                : cardStyle === "ceramic-tile"
                  ? `
                    radial-gradient(ellipse at 50% 15%, ${hexToRgba(colours.highlight, 0.35)}, transparent 55%),
                    linear-gradient(180deg, ${hexToRgba(colours.secondary, 0.6)} 0%, ${hexToRgba(colours.primary, 0.72)} 100%)
                  `
                  : base;
    const cardBorder = resolveBubbleBorder("glass", colours, false);
    const scrollSnap =
      scrollFeel === "snap"
        ? "mandatory"
        : scrollFeel === "current"
          ? "proximity"
          : "none";
    return {
      containerStyle: {
        display: "flex",
        gap: 10,
        overflowX: "auto",
        scrollSnapType: scrollSnap === "mandatory" ? "x mandatory" : scrollSnap === "proximity" ? "x proximity" : "none",
        padding: "8px 2px",
      },
      cardStyle: {
        flex: "0 0 auto",
        width: 160,
        padding: 10,
        borderRadius:
          productFraming === "buoy"
            ? "16px 16px 50% 50%"
            : productFraming === "coaster"
              ? "999px"
              : productFraming === "mug"
                ? "18px 18px 10px 10px"
                : 14,
        background: cardBg,
        border: cardBorder,
        color: colours.highlight,
        scrollSnapAlign: scrollSnap !== "none" ? "start" : undefined,
        boxShadow: `0 6px 18px ${hexToRgba(colours.deep, 0.45)}, inset 0 1px 1px ${hexToRgba(colours.highlight, 0.18)}`,
        position: "relative" as const,
        overflow: "hidden" as const,
        ...(sheenBg
          ? {
              backgroundImage: `${sheenBg}, ${cardBg}`,
              backgroundSize: "220% 100%, 100% 100%",
              backgroundRepeat: "no-repeat, no-repeat",
              backgroundPosition: "-140% 50%, 0 0",
              animation: "nex-se-water-tile-sheen 7s ease-in-out infinite",
            }
          : {}),
      },
      cardAccentStyle: {
        color: colours.primary,
      },
      scrollSnap: scrollSnap === "mandatory" ? "mandatory" : scrollSnap === "proximity" ? "proximity" : "none",
      productFraming,
    };
  }

  function reactionTreatment(): ReactionTreatmentResolved {
    const defaultGlyphs = ["❤️", "👍", "😂", "🫧", "✨", "🐚"];
    const glyphs = pkg.reactions?.glyphs ?? defaultGlyphs;
    return {
      glyphs,
      chipStyle: {
        padding: "2px 8px",
        borderRadius: 999,
        background: hexToRgba(colours.primary, 0.18),
        border: `1px solid ${hexToRgba(colours.primary, 0.35)}`,
        color: colours.highlight,
        fontSize: 11,
      },
      burstAnimation: reactionToken ?? null,
    };
  }

  function resolveIntro(input: IntroResolverInput): IntroSource | null {
    const p = input.package;
    if (input.businessIntroEnabled && p.businessIntro) {
      return p.businessIntro;
    }
    if (p.intro) {
      if (p.intro.playPolicy === "twice-then-skip") {
        if (input.viewerSeenCount >= 2) return null;
      }
      return p.intro;
    }
    return null;
  }

  return {
    package: pkg,
    personality,
    colours,
    bubbleTreatment,
    composerTreatment,
    emojiTreatment,
    stickerTreatment,
    ambientTreatment,
    shopTreatment,
    reactionTreatment,
    resolveIntro,
    stylesheet,
  };
}

// ─── Geometry / material helpers ────────────────────────────────────

function resolveBubbleGeometry(shape: string, mine: boolean): string {
  switch (shape) {
    case "pill":
      return "24px";
    case "square":
      return "4px";
    case "outlined":
      return "12px";
    case "gradient":
      return mine ? "16px 16px 6px 16px" : "16px 16px 16px 6px";
    case "water-droplet":
      return mine
        ? "38px 48px 14px 28px / 32px 40px 18px 26px"
        : "48px 38px 28px 14px / 40px 32px 26px 18px";
    case "shell":
      return mine ? "20px 50% 10px 50%" : "50% 20px 50% 10px";
    case "domed":
      // Vessel silhouette · wider rounded top, slightly flatter base.
      // Reads like a mug / cup / bowl without being tied to any single
      // theme. Mine/peer mirror so inbound and outbound feel paired.
      return mine
        ? "24px 24px 14px 20px / 28px 28px 12px 18px"
        : "24px 24px 20px 14px / 28px 28px 18px 12px";
    case "classic":
    default:
      return mine ? "14px 14px 4px 14px" : "14px 14px 14px 4px";
  }
}

function resolveBubbleBackground(
  material: string,
  c: Required<ColourSystem>,
  mine: boolean,
): string {
  switch (material) {
    case "solid":
      return mine ? c.primary : hexToRgba(c.secondary, 0.9);
    case "gradient":
      return mine
        ? `linear-gradient(135deg, ${hexToRgba(c.primary, 0.85)}, ${hexToRgba(c.deep, 0.9)})`
        : `linear-gradient(135deg, ${hexToRgba(c.secondary, 0.5)}, ${hexToRgba(c.deep, 0.7)})`;
    case "glow":
      return mine
        ? `radial-gradient(circle at 30% 30%, ${hexToRgba(c.primary, 0.75)}, ${hexToRgba(c.primary, 0.25)})`
        : `radial-gradient(circle at 30% 30%, ${hexToRgba(c.secondary, 0.45)}, ${hexToRgba(c.deep, 0.6)})`;
    case "parchment":
      return mine
        ? `linear-gradient(180deg, ${hexToRgba(c.secondary, 0.9)}, ${hexToRgba(c.highlight, 0.75)})`
        : `linear-gradient(180deg, ${hexToRgba(c.highlight, 0.9)}, ${hexToRgba(c.secondary, 0.7)})`;
    case "frosting":
      return mine
        ? `linear-gradient(145deg, ${hexToRgba(c.primary, 0.65)}, ${hexToRgba(c.highlight, 0.35)})`
        : `linear-gradient(145deg, ${hexToRgba(c.highlight, 0.7)}, ${hexToRgba(c.secondary, 0.4)})`;
    case "water":
      // Translucent water · multi-layer refraction. The top-left
      // radial highlight simulates light catching a droplet; a second
      // narrow highlight along the top edge adds a "surface line"
      // feel. Base gradient carries the ocean tint from highlight
      // (foam) → primary (shallow) → deep (abyss). Peer bubbles cool
      // toward secondary so inbound/outbound feel related but distinct.
      return mine
        ? `
          radial-gradient(ellipse 60% 50% at 25% 18%, ${hexToRgba(c.highlight, 0.45)} 0%, ${hexToRgba(c.highlight, 0.05)} 55%, transparent 75%),
          linear-gradient(170deg, ${hexToRgba(c.highlight, 0.22)} 0%, ${hexToRgba(c.highlight, 0)} 18%, transparent 32%),
          linear-gradient(180deg, ${hexToRgba(c.highlight, 0.14)} 0%, ${hexToRgba(c.primary, 0.52)} 55%, ${hexToRgba(c.deep, 0.68)} 100%)
        `
        : `
          radial-gradient(ellipse 60% 50% at 20% 15%, ${hexToRgba(c.highlight, 0.4)} 0%, ${hexToRgba(c.highlight, 0.04)} 55%, transparent 75%),
          linear-gradient(170deg, ${hexToRgba(c.highlight, 0.2)} 0%, ${hexToRgba(c.highlight, 0)} 18%, transparent 32%),
          linear-gradient(180deg, ${hexToRgba(c.highlight, 0.12)} 0%, ${hexToRgba(c.secondary, 0.48)} 55%, ${hexToRgba(c.deep, 0.68)} 100%)
        `;
    case "driftwood":
      return mine
        ? `linear-gradient(135deg, ${hexToRgba(c.secondary, 0.55)}, ${hexToRgba(c.deep, 0.8)})`
        : `linear-gradient(135deg, ${hexToRgba(c.highlight, 0.4)}, ${hexToRgba(c.secondary, 0.5)})`;
    case "ceramic":
      // Matte-glazed solid · soft top-light highlight + warm body +
      // slightly darker base. Mine vs peer differ in body tint so they
      // read as paired vessels, not identical cups.
      return mine
        ? `
          radial-gradient(ellipse 70% 50% at 50% 10%, ${hexToRgba(c.highlight, 0.4)} 0%, transparent 55%),
          linear-gradient(180deg, ${hexToRgba(c.secondary, 0.85)} 0%, ${hexToRgba(c.primary, 0.78)} 55%, ${hexToRgba(c.deep, 0.82)} 100%)
        `
        : `
          radial-gradient(ellipse 70% 50% at 50% 10%, ${hexToRgba(c.highlight, 0.5)} 0%, transparent 55%),
          linear-gradient(180deg, ${hexToRgba(c.highlight, 0.72)} 0%, ${hexToRgba(c.secondary, 0.72)} 55%, ${hexToRgba(c.deep, 0.78)} 100%)
        `;
    case "warm-liquid":
      // Hot drink · rich amber core, deeper edges, faint surface
      // steam-haze near top. The visible top-strip simulates a crema
      // ring sitting on the drink surface.
      return mine
        ? `
          radial-gradient(ellipse 85% 30% at 50% 8%, ${hexToRgba(c.highlight, 0.35)} 0%, transparent 65%),
          linear-gradient(180deg, ${hexToRgba(c.secondary, 0.5)} 0%, ${hexToRgba(c.primary, 0.9)} 25%, ${hexToRgba(c.deep, 0.95)} 100%)
        `
        : `
          radial-gradient(ellipse 85% 30% at 50% 8%, ${hexToRgba(c.highlight, 0.45)} 0%, transparent 65%),
          linear-gradient(180deg, ${hexToRgba(c.highlight, 0.42)} 0%, ${hexToRgba(c.secondary, 0.72)} 25%, ${hexToRgba(c.deep, 0.9)} 100%)
        `;
    case "glass":
    default:
      return mine ? hexToRgba(c.primary, 0.26) : hexToRgba(c.deep, 0.72);
  }
}

function resolveBubbleBorder(
  material: string,
  c: Required<ColourSystem>,
  mine: boolean,
): string {
  if (material === "water") {
    return mine
      ? `1px solid ${hexToRgba(c.highlight, 0.55)}`
      : `1px solid ${hexToRgba(c.secondary, 0.5)}`;
  }
  if (material === "parchment") {
    return `1px solid ${hexToRgba(c.deep, 0.3)}`;
  }
  if (material === "frosting") {
    return `1px solid ${hexToRgba(c.highlight, 0.5)}`;
  }
  if (material === "ceramic" || material === "warm-liquid") {
    // Soft rim-light border rather than hard outline.
    return mine
      ? `1px solid ${hexToRgba(c.highlight, 0.42)}`
      : `1px solid ${hexToRgba(c.secondary, 0.5)}`;
  }
  return mine
    ? `1px solid ${hexToRgba(c.primary, 0.85)}`
    : `1px solid rgba(150,160,180,0.55)`;
}

function resolveBubbleShadow(
  material: string,
  c: Required<ColourSystem>,
  mine: boolean,
): string {
  if (material === "ceramic") {
    // Soft top-inset highlight + lower-rim warm glow + grounded shadow
    // underneath. Reads like a solid matte cup under warm light.
    return `
      inset 0 2px 3px ${hexToRgba(c.highlight, 0.45)},
      inset 0 -6px 10px ${hexToRgba(c.deep, 0.5)},
      0 1px 0 ${hexToRgba(c.highlight, 0.15)},
      0 0 18px ${hexToRgba(c.glow, 0.4)},
      0 10px 24px rgba(0,0,0,0.55)
    `;
  }
  if (material === "warm-liquid") {
    // Strong top crema highlight + warm glow outside + deeper bottom
    // shadow so the drink looks hot and inviting.
    return mine
      ? `
        inset 0 3px 4px ${hexToRgba(c.highlight, 0.6)},
        inset 0 -8px 16px ${hexToRgba(c.deep, 0.65)},
        0 0 26px ${hexToRgba(c.glow, 0.55)},
        0 10px 28px rgba(0,0,0,0.6)
      `
      : `
        inset 0 3px 4px ${hexToRgba(c.highlight, 0.55)},
        inset 0 -8px 16px ${hexToRgba(c.deep, 0.6)},
        0 0 22px ${hexToRgba(c.glow, 0.45)},
        0 10px 28px rgba(0,0,0,0.6)
      `;
  }
  if (material === "water") {
    // Inset highlight along the top gives the bubble a glossy
    // water-droplet feel. Deeper outer glow in primary suggests the
    // bubble is lit from above by surface caustics. Dark bottom-inset
    // reinforces depth.
    return mine
      ? `
        inset 0 2px 4px ${hexToRgba(c.highlight, 0.55)},
        inset 0 -8px 18px ${hexToRgba(c.deep, 0.42)},
        inset -4px -6px 14px ${hexToRgba(c.primary, 0.22)},
        0 0 22px ${hexToRgba(c.primary, 0.35)},
        0 8px 24px rgba(0,0,0,0.55)
      `
      : `
        inset 0 2px 4px ${hexToRgba(c.highlight, 0.45)},
        inset 0 -8px 18px ${hexToRgba(c.deep, 0.4)},
        inset -4px -6px 14px ${hexToRgba(c.secondary, 0.2)},
        0 0 18px ${hexToRgba(c.secondary, 0.3)},
        0 8px 26px rgba(0,0,0,0.6)
      `;
  }
  return mine
    ? `0 0 14px ${hexToRgba(c.primary, 0.25)}, 0 6px 20px rgba(0,0,0,0.45)`
    : `0 6px 22px rgba(0,0,0,0.55)`;
}

function resolveBackdropFilter(material: string): string | undefined {
  switch (material) {
    case "glass":
    case "water":
    case "frosting":
    case "glow":
      return "blur(12px) saturate(1.15)";
    case "warm-liquid":
      // Lighter blur so the warm colour reads strongly, but still has
      // some presence to feel like a hot drink and not a flat tile.
      return "blur(4px) saturate(1.2)";
    default:
      return undefined;
  }
}

// ─── Ambient layer tables ───────────────────────────────────────────

function resolveAmbientColour(kind: string, c: Required<ColourSystem>): string {
  switch (kind) {
    case "bubbles-rising":
      return hexToRgba(c.highlight, 0.55);
    case "light-rays":
      return hexToRgba(c.highlight, 0.28);
    case "sparks":
      return hexToRgba(c.primary, 0.75);
    case "heat-shimmer":
      return hexToRgba(c.highlight, 0.2);
    case "sparkles":
      return hexToRgba(c.highlight, 0.8);
    case "mist":
      return hexToRgba(c.secondary, 0.52);
    case "surface-caustics":
      return hexToRgba(c.highlight, 0.9);
    case "steam-rising":
      return hexToRgba(c.highlight, 0.55);
    case "warm-glow-pulse":
      // Full-alpha glow for the halos; the renderer softens with blur
      // + screen blend. The visibility floor has to be high enough that
      // warm lighting reads as actual lamps/candles, not faint smudges.
      return hexToRgba(c.glow, 0.95);
    case "leaves-falling":
      return hexToRgba(c.secondary, 0.6);
    case "stars":
      return hexToRgba(c.highlight, 0.85);
    case "particles-up":
      return hexToRgba(c.primary, 0.5);
    default:
      return hexToRgba(c.primary, 0.5);
  }
}

function resolveAmbientBaseCount(kind: string): number {
  switch (kind) {
    case "bubbles-rising":
      return 28; // layered across 3 depths · ~9-10 per layer
    case "light-rays":
      return 9; // 2 depths · 4-5 per layer
    case "sparks":
      return 20;
    case "sparkles":
      return 22;
    case "stars":
      return 24;
    case "mist":
      return 14; // paired as two visual bands (bottom + mid) at 7 each
    case "surface-caustics":
      return 18;
    case "steam-rising":
      return 32; // three layers of ~10-11 each
    case "warm-glow-pulse":
      return 7;
    case "heat-shimmer":
      return 1;
    case "leaves-falling":
      return 10;
    case "particles-up":
      return 16;
    default:
      return 12;
  }
}

function resolveAmbientSpeed(kind: string): number {
  switch (kind) {
    case "bubbles-rising":
      return 14;
    case "light-rays":
      return 11;
    case "sparks":
      return 7;
    case "sparkles":
      return 3;
    case "stars":
      return 3;
    case "mist":
      return 18;
    case "surface-caustics":
      return 5;
    case "steam-rising":
      return 8.5; // faster so more lifecycle registers during normal use
    case "warm-glow-pulse":
      return 4.5;
    case "heat-shimmer":
      return 5;
    case "leaves-falling":
      return 10;
    case "particles-up":
      return 14;
    default:
      return 10;
  }
}

function resolveAmbientSize(kind: string): number {
  switch (kind) {
    case "bubbles-rising":
      return 7;
    case "light-rays":
      return 90;
    case "sparks":
      return 3;
    case "sparkles":
      return 2;
    case "stars":
      return 2;
    case "mist":
      return 220;
    case "surface-caustics":
      return 7;
    case "steam-rising":
      return 55;
    case "warm-glow-pulse":
      return 120;
    case "heat-shimmer":
      return 200;
    case "leaves-falling":
      return 10;
    case "particles-up":
      return 4;
    default:
      return 4;
  }
}
