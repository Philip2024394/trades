// NEX App Builder · Design intent taxonomy (Philip 2026-08-14).
//
// Turns Blueprint hints (industry + brand.archetype + imageryDirection)
// into a structured set of intent tags used by the image-selection
// worker. Extensible per-vertical.
//
// Constitutional rule: intent tags are DERIVED, not fabricated. Every
// tag traces back to a Blueprint field. If a tag has no source in the
// Blueprint, it doesn't appear.

import type { AppBlueprint } from "../blueprint-schema";

export type IntentTagCategory =
  | "style"          // modern / traditional / contemporary / rustic / etc.
  | "material"       // oak / walnut / metal / glass / painted / etc.
  | "tier"           // premium / mid / entry
  | "usage"          // renovation / refacing / new-build / feature / storage
  | "form-factor"    // straight / curved / cantilever / spiral
  | "page-purpose";  // homepage / gallery / product / about / contact

export type IntentTag = {
  category: IntentTagCategory;
  value: string;
  source: string;      // Blueprint dotted path OR "vertical-default:<taxonomy>"
  weight: number;      // 0..1 · higher = stronger signal
};

/** The staircase intent tree Philip specified — extensible per vertical. */
export const STAIRCASE_INTENT_VOCAB: Record<IntentTagCategory, readonly string[]> = {
  style: [
    "modern", "traditional", "contemporary", "luxury", "minimalist",
    "classic", "rustic", "premium", "grand", "understated"
  ],
  material: [
    "timber", "oak", "walnut", "pine", "mahogany", "maple", "ash",
    "painted", "glass", "metal", "matt-black", "brushed-stainless"
  ],
  tier: ["premium", "mid", "entry"],
  usage: [
    "renovation", "refacing", "new-build", "feature-staircase",
    "under-stair-storage", "wall-fixed", "two-sided"
  ],
  "form-factor": [
    "straight", "curved", "cantilever", "spiral", "l-shaped", "u-shaped",
    "helical", "floating"
  ],
  "page-purpose": ["homepage", "gallery", "product", "about", "contact", "services"]
};

/** Derive intent tags from a Blueprint. */
export function deriveIntentTags(bp: AppBlueprint): IntentTag[] {
  const tags: IntentTag[] = [];

  // 1. Vertical archetype → tier + style
  const arch = bp.vertical.archetype;
  if (arch === "premium") {
    tags.push({ category: "tier", value: "premium", source: "vertical.archetype", weight: 1.0 });
    tags.push({ category: "style", value: "premium", source: "vertical.archetype", weight: 0.7 });
  } else if (arch === "modern") {
    tags.push({ category: "style", value: "modern", source: "vertical.archetype", weight: 1.0 });
  } else if (arch === "traditional") {
    tags.push({ category: "style", value: "traditional", source: "vertical.archetype", weight: 1.0 });
  } else if (arch === "rustic") {
    tags.push({ category: "style", value: "rustic", source: "vertical.archetype", weight: 1.0 });
  }

  // 2. Brand tone of voice → style hint
  const tone = bp.brand.toneOfVoice;
  if (tone === "premium") {
    tags.push({ category: "tier", value: "premium", source: "brand.toneOfVoice", weight: 0.8 });
  } else if (tone === "artisanal") {
    tags.push({ category: "style", value: "traditional", source: "brand.toneOfVoice", weight: 0.6 });
  }

  // 3. Brand imageryDirection — controlled dictionary intersection
  const flatVocab = new Set<string>();
  for (const list of Object.values(STAIRCASE_INTENT_VOCAB)) {
    for (const v of list) flatVocab.add(v.toLowerCase());
  }
  for (const raw of bp.brand.imageryDirection ?? []) {
    const tokens = raw.toLowerCase().split(/[\s,]+/);
    for (const tok of tokens) {
      if (!flatVocab.has(tok)) continue;
      // Find which category this belongs to
      for (const [category, values] of Object.entries(STAIRCASE_INTENT_VOCAB) as [IntentTagCategory, readonly string[]][]) {
        if (values.includes(tok)) {
          tags.push({ category, value: tok, source: "brand.imageryDirection", weight: 0.9 });
          break;
        }
      }
    }
  }

  return dedupe(tags);
}

function dedupe(tags: IntentTag[]): IntentTag[] {
  const map = new Map<string, IntentTag>();
  for (const t of tags) {
    const key = `${t.category}:${t.value}`;
    const existing = map.get(key);
    if (!existing || t.weight > existing.weight) map.set(key, t);
  }
  return [...map.values()].sort((a, b) => b.weight - a.weight);
}
