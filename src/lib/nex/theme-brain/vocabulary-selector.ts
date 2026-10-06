// src/lib/nex/theme-brain/vocabulary-selector.ts
//
// Pure deterministic selection of Theme Engine vocabulary from a
// parsed intent. No LLM, no provider calls, no side effects.
//
// Phase 1 reasoning strategy · keyword matching against the parsed
// creativeSeed + structured hints. When a more capable reasoning
// pass is needed in a future phase, the Brain's package-compiler can
// invoke NexBrainProvider · this selector remains the deterministic
// baseline.
//
// The selector returns a VocabularySelection + a list of "missing"
// requirements the caller's intent asked for but no token covers.
// The capability-validator consumes that output.

import type { WorldIntent, CapabilityGap } from "./intent";
import type {
  AnimationPersonality,
  BubbleMaterial,
  BubbleShape,
} from "@/lib/nex-native/theme-package/types";
import {
  AVAILABLE_AMBIENT_FAMILIES,
  AVAILABLE_MATERIALS,
  AVAILABLE_PERSONALITIES,
  AVAILABLE_SHAPES,
  AVAILABLE_SHOP_CARD_STYLES,
  AVAILABLE_SHOP_PRODUCT_FRAMINGS,
  AVAILABLE_STICKER_CONCEPTS,
  type AvailableAmbientFamily,
  type AvailableShopCardStyle,
  type AvailableShopProductFraming,
} from "./vocabulary";

export interface VocabularySelection {
  readonly personality: AnimationPersonality;
  readonly materials: readonly BubbleMaterial[];
  readonly shapes: readonly BubbleShape[];
  readonly ambientFamilies: readonly AvailableAmbientFamily[];
  readonly shopCardStyle: AvailableShopCardStyle;
  readonly shopProductFraming: AvailableShopProductFraming;
  readonly stickerConcepts: readonly string[];
  readonly gaps: readonly CapabilityGap[];
}

/** Lightweight keyword classifier · maps user vocabulary to engine
 *  vocabulary via a lookup table. Each entry is deterministic. */
const KEYWORD_TABLE: {
  readonly keywords: readonly string[];
  readonly personality?: AnimationPersonality;
  readonly materials?: readonly BubbleMaterial[];
  readonly shapes?: readonly BubbleShape[];
  readonly ambientFamilies?: readonly AvailableAmbientFamily[];
  readonly shopCardStyle?: AvailableShopCardStyle;
  readonly shopProductFraming?: AvailableShopProductFraming;
  readonly stickerConcepts?: readonly string[];
}[] = [
  // Ocean / water / underwater
  {
    keywords: ["ocean", "sea", "underwater", "wave", "aquatic", "nautical"],
    personality: "drift",
    materials: ["water", "glass"],
    shapes: ["water-droplet", "shell"],
    ambientFamilies: ["bubbles-rising", "light-rays", "mist"],
    shopCardStyle: "driftwood-board",
    shopProductFraming: "buoy",
    stickerConcepts: ["fish", "shell", "wave", "diver", "bubble", "treasure", "octopus"],
  },
  // Coffee / warm / café / cosy
  {
    keywords: ["coffee", "café", "cafe", "espresso", "latte", "warm", "cosy", "cozy", "aroma", "bakery"],
    personality: "warm",
    materials: ["warm-liquid", "ceramic"],
    shapes: ["domed"],
    ambientFamilies: ["mist", "sparkles"],
    shopCardStyle: "wood-plank",
    shopProductFraming: "coaster",
    stickerConcepts: ["mug", "espresso", "coffee", "steam", "bean", "croissant", "latte-art"],
  },
  // Botanical / plants / fresh / natural
  {
    keywords: ["botanical", "plant", "garden", "greenhouse", "fresh", "natural", "leaf", "fern", "foliage", "herb"],
    personality: "sway",
    materials: ["ceramic"],
    shapes: ["domed"],
    ambientFamilies: ["sun-dapple", "pollen-float", "leaves-falling", "sparkles"],
    shopCardStyle: "ceramic-tile",
    shopProductFraming: "coaster",
    stickerConcepts: ["fern", "plant-pot", "teacup", "honey-jar", "leaf", "croissant"],
  },
  // Midnight / neon / nightclub / bar
  {
    keywords: ["midnight", "neon", "night", "nightclub", "bar", "club", "jazz", "noir", "cyberpunk", "arcade"],
    personality: "neon",
    materials: ["neon-glass"],
    shapes: ["pill"],
    ambientFamilies: ["neon-flicker", "rain-streak", "sparkles"],
    shopCardStyle: "glass",
    shopProductFraming: "float",
    stickerConcepts: ["vinyl-record", "moon", "neon-heart", "jazz-note"],
  },
  // French / elegant / refined / parisian
  {
    keywords: ["french", "parisian", "elegant", "refined", "timeless", "patisserie", "boutique", "luxury"],
    personality: "warm",
    materials: ["parchment"],
    shapes: ["pill"],
    ambientFamilies: ["sparkles", "mist"],
    shopCardStyle: "marble-top",
    shopProductFraming: "saucer-under-glass",
    stickerConcepts: ["baguette", "macaron", "wine-glass", "beret", "eiffel-tower", "croissant"],
  },
  // Fire / flame / hot
  {
    keywords: ["fire", "flame", "hot", "ember", "forge"],
    personality: "flicker",
    materials: ["glow"],
    shapes: ["classic"],
    ambientFamilies: ["sparks", "heat-shimmer"],
  },
  // Space / cosmic / stars
  {
    keywords: ["space", "cosmic", "star", "galaxy", "orbit", "nebula"],
    personality: "orbit",
    materials: ["glow"],
    shapes: ["classic"],
    ambientFamilies: ["stars", "sparkles"],
  },
  // Haunted / spooky / dark
  {
    keywords: ["haunted", "spooky", "dark", "gothic", "halloween", "ghost"],
    personality: "creep",
    materials: ["frosting"],
    shapes: ["classic"],
    ambientFamilies: ["mist"],
  },
  // Racing / cyber / grid
  {
    keywords: ["racing", "race", "cyber", "grid", "terminal", "circuit"],
    personality: "slide",
    materials: ["solid"],
    shapes: ["square"],
    ambientFamilies: ["particles-up"],
  },
  // Cakes / sprinkle / party
  {
    keywords: ["cake", "cakes", "bakery", "sprinkle", "party", "celebration", "icing", "frosting"],
    personality: "bounce",
    materials: ["frosting"],
    shapes: ["pill"],
    ambientFamilies: ["sparkles"],
  },
];

/** Lowercase + strip punctuation · deterministic tokenisation. */
function tokenise(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

/** Score every keyword table entry against the intent's tokens. The
 *  highest-scoring entry wins personality + default vocabulary.
 *  Returns the matched index AND a Set of extra concept words from
 *  the intent so the stickerConcepts list can be enriched. */
function classifyIntent(intent: WorldIntent): {
  readonly bestMatchIndex: number;
  readonly extraKeywords: readonly string[];
} {
  const seedTokens = new Set(tokenise(intent.creativeSeed));
  (intent.businessCategories ?? []).forEach((c) =>
    tokenise(c).forEach((t) => seedTokens.add(t)),
  );
  (intent.emotionalAdjectives ?? []).forEach((a) =>
    tokenise(a).forEach((t) => seedTokens.add(t)),
  );
  if (intent.worldName) {
    tokenise(intent.worldName).forEach((t) => seedTokens.add(t));
  }

  let bestIndex = 0;
  let bestScore = 0;
  for (let i = 0; i < KEYWORD_TABLE.length; i++) {
    const entry = KEYWORD_TABLE[i];
    let score = 0;
    for (const kw of entry.keywords) {
      if (seedTokens.has(kw)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }
  return { bestMatchIndex: bestIndex, extraKeywords: [...seedTokens] };
}

/** Compute which sticker concepts the intent asked for but the engine
 *  has no renderer for. These become capability gaps. */
function detectStickerGaps(
  stickerConcepts: readonly string[],
  requestedExtras: readonly string[],
): readonly CapabilityGap[] {
  const available = new Set<string>(AVAILABLE_STICKER_CONCEPTS);
  const already = new Set(stickerConcepts);
  const gaps: CapabilityGap[] = [];
  // Only flag words that look like concrete object nouns · simple
  // heuristic to avoid treating adjectives ("fresh") as sticker gaps.
  const probablyObject = /^[a-z][a-z-]{2,}$/;
  for (const word of requestedExtras) {
    if (already.has(word)) continue;
    if (available.has(word)) continue;
    if (!probablyObject.test(word)) continue;
    // Only treat as a sticker gap if the caller supplied an explicit
    // stickers hint (via future API) · in Phase 1 we don't flag every
    // noun in the creative seed as a sticker gap. The gap detector
    // for Phase 1 is intentionally conservative.
  }
  return gaps;
}

/** Explicit vocabulary check · if the caller requested something we
 *  cannot select from the KEYWORD_TABLE at all, report it. Phase 1
 *  conservative: only flag when the caller used a token that looks
 *  like a direct vocabulary category request we cannot satisfy. */
function detectUnsupportedCategoryRequests(
  intent: WorldIntent,
): readonly CapabilityGap[] {
  const seed = intent.creativeSeed.toLowerCase();
  const gaps: CapabilityGap[] = [];
  // Example triggers · if the caller asked for a specific material we
  // don't have, surface it as a gap.
  const unsupportedMaterials: Array<{ ask: string; why: string }> = [
    { ask: "holographic", why: "Caller asked for holographic bubble material" },
    { ask: "wax-seal", why: "Caller asked for wax-seal bubble material" },
    { ask: "fabric", why: "Caller asked for fabric bubble material" },
    { ask: "metal", why: "Caller asked for metal bubble material" },
    { ask: "wood", why: "Caller asked for wood bubble material (driftwood is close)" },
  ];
  for (const u of unsupportedMaterials) {
    if (seed.includes(u.ask) && !AVAILABLE_MATERIALS.includes(u.ask as BubbleMaterial)) {
      gaps.push({
        category: "material",
        requested: u.ask,
        whyNeeded: u.why,
        suggestedFallback:
          u.ask === "wood"
            ? "driftwood"
            : null,
      });
    }
  }
  return gaps;
}

export function selectVocabulary(intent: WorldIntent): VocabularySelection {
  const { bestMatchIndex, extraKeywords } = classifyIntent(intent);
  const entry = KEYWORD_TABLE[bestMatchIndex];
  const personality = entry.personality ?? "drift";
  const materials =
    entry.materials ?? (["glass"] as readonly BubbleMaterial[]);
  const shapes = entry.shapes ?? (["classic"] as readonly BubbleShape[]);
  const ambientFamilies =
    entry.ambientFamilies ??
    (["sparkles"] as readonly AvailableAmbientFamily[]);
  const shopCardStyle = entry.shopCardStyle ?? "glass";
  const shopProductFraming = entry.shopProductFraming ?? "card";
  const stickerConcepts = entry.stickerConcepts ?? [];

  const gaps: CapabilityGap[] = [];
  gaps.push(...detectUnsupportedCategoryRequests(intent));
  gaps.push(...detectStickerGaps(stickerConcepts, extraKeywords));

  // Defensive assertion · everything we selected MUST be in the
  // available-vocabulary arrays. If not, that's a serious bug · we
  // throw so a test catches it in CI.
  if (!AVAILABLE_PERSONALITIES.includes(personality)) {
    throw new Error(
      `theme-brain selector internal error · selected personality "${personality}" is not in AVAILABLE_PERSONALITIES`,
    );
  }
  for (const m of materials) {
    if (!AVAILABLE_MATERIALS.includes(m)) {
      throw new Error(
        `theme-brain selector internal error · selected material "${m}" is not in AVAILABLE_MATERIALS`,
      );
    }
  }

  return {
    personality,
    materials,
    shapes,
    ambientFamilies,
    shopCardStyle,
    shopProductFraming,
    stickerConcepts,
    gaps,
  };
}
