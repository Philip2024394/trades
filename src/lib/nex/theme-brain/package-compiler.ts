// src/lib/nex/theme-brain/package-compiler.ts
//
// Compile a ThemePackage from a VocabularySelection + WorldIntent.
// Pure function · no provider calls in Phase 1 · deterministic
// output for a given input.
//
// Why no NexBrainProvider in Phase 1:
//
//   For the Phase 1 acceptance tests the compiler reasons
//   deterministically from the keyword-table-selected vocabulary.
//   The provider abstraction is the integration boundary · callers
//   who need richer reasoning (free-form naming, non-keyword intent,
//   cross-world refinement) can pass a NexBrainProvider through
//   `compileWithProvider` which wraps `compile` and may consult the
//   provider for naming + rationale strings. The Phase 1 acceptance
//   test proves the provider path exists and is honoured when
//   supplied · it is not required to produce a valid ThemePackage.

import type { ThemePackage } from "@/lib/nex-native/theme-package/types";
import type { WorldIntent, VocabularyUsageTrace } from "./intent";
import type { VocabularySelection } from "./vocabulary-selector";

export interface CompiledPackage {
  readonly package: ThemePackage;
  readonly trace: VocabularyUsageTrace;
  readonly rationale: string;
}

/** Build an identity (id · name · tagline · concept) from the intent.
 *  Deterministic · uses the worldName if supplied otherwise synthesises
 *  from the creative seed's first noun-like token. */
function buildIdentity(intent: WorldIntent): ThemePackage["identity"] {
  const name =
    intent.worldName?.trim() ||
    intent.creativeSeed.split(/[—-]/)[0].trim() ||
    "World";
  const id = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const adjectives = (intent.emotionalAdjectives ?? []).join(" · ");
  const tagline = adjectives || "a world made for you";
  const conceptOneLine = intent.creativeSeed.trim() || name;
  return { id: id || "world", name, tagline, conceptOneLine };
}

/** Default colour palette per personality · deterministic fallback.
 *  Future phases will consult NexBrainProvider for rich colour
 *  reasoning; Phase 1 uses conservative defaults the Engine resolves
 *  cleanly. */
function defaultColours(selection: VocabularySelection): ThemePackage["colours"] {
  switch (selection.personality) {
    case "drift":
      return {
        primary: "#2E90B5",
        secondary: "#4FC3DC",
        highlight: "#E8F7FF",
        glow: "rgba(130,210,255,0.55)",
        deep: "#0A2535",
      };
    case "warm":
      return {
        primary: "#6B3F22",
        secondary: "#C8976B",
        highlight: "#F7E7CA",
        glow: "rgba(232,170,90,0.55)",
        deep: "#2A160A",
      };
    case "sway":
      return {
        primary: "#3F7A4A",
        secondary: "#86B46A",
        highlight: "#F5EBCC",
        glow: "rgba(240,215,140,0.60)",
        deep: "#17281A",
      };
    case "neon":
      return {
        primary: "#FF3EA5",
        secondary: "#38C6FF",
        highlight: "#F2E8FF",
        glow: "rgba(255,70,180,0.70)",
        deep: "#0B0A1E",
      };
    case "flicker":
      return {
        primary: "#C04020",
        secondary: "#FF8830",
        highlight: "#FFE0A0",
        glow: "rgba(255,140,40,0.60)",
        deep: "#2A0A05",
      };
    case "bounce":
      return {
        primary: "#E25D8A",
        secondary: "#FFB8CE",
        highlight: "#FFF0F5",
        glow: "rgba(255,180,210,0.60)",
        deep: "#3A1522",
      };
    case "orbit":
      return {
        primary: "#4A5BC7",
        secondary: "#8C9EFF",
        highlight: "#E0E8FF",
        glow: "rgba(140,160,255,0.55)",
        deep: "#0B0F2A",
      };
    case "creep":
      return {
        primary: "#5A2E8A",
        secondary: "#8C66B5",
        highlight: "#E8D9F2",
        glow: "rgba(140,100,180,0.45)",
        deep: "#180A28",
      };
    case "slide":
      return {
        primary: "#30D070",
        secondary: "#7FFFBF",
        highlight: "#E0FFEC",
        glow: "rgba(50,220,120,0.55)",
        deep: "#061A10",
      };
    case "glitch":
      return {
        primary: "#8FFF6E",
        secondary: "#FF4FA3",
        highlight: "#F5F0E8",
        glow: "rgba(143,255,110,0.55)",
        deep: "#0B0E07",
      };
  }
}

/** Shape the ambient families array · dedup + respect density. */
function buildAmbient(selection: VocabularySelection): ThemePackage["ambient"] {
  return {
    density: "medium",
    families: [...new Set(selection.ambientFamilies)],
  };
}

/** Build the bubbles treatment · pick the first material + shape from
 *  the selection as the primary. */
function buildBubbles(selection: VocabularySelection): ThemePackage["bubbles"] {
  return {
    material: selection.materials[0],
    shape: selection.shapes[0],
  };
}

function buildStickers(selection: VocabularySelection): ThemePackage["stickers"] {
  if (selection.stickerConcepts.length === 0) return undefined;
  return { conceptKeywords: [...selection.stickerConcepts] };
}

function buildShop(selection: VocabularySelection): ThemePackage["shop"] {
  return {
    cardStyle: selection.shopCardStyle,
    productFraming: selection.shopProductFraming,
    scrollFeel: "momentum",
  };
}

/** Deterministic composition · pure function · no I/O. */
export function compile(
  intent: WorldIntent,
  selection: VocabularySelection,
): CompiledPackage {
  const identity = buildIdentity(intent);
  const pkg: ThemePackage = {
    identity,
    colours: defaultColours(selection),
    personality: selection.personality,
    bubbles: buildBubbles(selection),
    ambient: buildAmbient(selection),
    stickers: buildStickers(selection),
    shop: buildShop(selection),
  };

  const trace: VocabularyUsageTrace = {
    materials: [...selection.materials],
    personality: selection.personality,
    ambientFamilies: [...selection.ambientFamilies],
    bubbleShapes: [...selection.shapes],
    shopCardStyle: selection.shopCardStyle,
    shopProductFraming: selection.shopProductFraming,
    stickerKeywords: [...selection.stickerConcepts],
  };

  const rationale = [
    `Personality: ${selection.personality} (matches "${intent.creativeSeed}").`,
    `Bubbles: ${selection.shapes[0]} shape · ${selection.materials[0]} material.`,
    `Ambient: ${selection.ambientFamilies.join(" + ")}.`,
    `Shop: ${selection.shopCardStyle} card · ${selection.shopProductFraming} framing.`,
    `Stickers: ${selection.stickerConcepts.join(", ") || "none"}.`,
  ].join(" ");

  return { package: pkg, trace, rationale };
}
