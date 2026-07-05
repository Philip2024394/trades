// Slice E — deterministic layout composer.
//
// Turns (tradeSlug + intent hints) into an ordered BlueprintSectionSeed[]
// ready for buildLayoutFromSeeds. Zero LLM calls in here — only intent
// EXTRACTION uses the model (upstream in the API route). Composition
// picks against the live sectionRegistry + Knowledge Graph, so every
// output is inspectable and reproducible.
//
// Standard trades home-page flow, in order:
//   1. Hero            — best-for-vertical + intent-aware sub-picker
//   2. Trust bar       — KG credentialSchemes (icon row)
//   3. Services        — KG services list
//   4. Features        — KG industryIntelligence (why-choose-us)
//   5. Gallery         — for visual trades only (roofer, landscaper, etc.)
//   6. Testimonials    — KG customerTypes → template quotes
//   7. FAQ             — KG commonFaqs
//   8. CTA / Contact   — deterministic band + contact split
//   9. Footer          — minimal
//
// Missing a section from the registry drops it silently — the layout
// still ships, just without that step. That matches how the blueprint
// installer treats unregistered seeds.

import "@/lib/studio/sections"; // register side-effect
import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import type { AnySectionRegistration } from "@/lib/studio/sectionTypes";
import type { BlueprintSectionSeed } from "@/lib/studio/blueprints";
import type { ThemePresetId } from "@/lib/studio/themePresets";
import { suggestThemeForTrade } from "@/lib/studio/themePresets";
import { packageForTrade } from "@/lib/knowledge";

/** Intent signals extracted from the merchant prompt (or supplied by
 *  the caller directly). Every field is optional — the composer
 *  degrades gracefully when nothing is supplied. */
export type ComposeIntent = {
  tradeSlug: string;
  /** Free-text prompt as the merchant typed it. Kept for downstream
   *  copy-injection (e.g. seeding the hero headline). */
  prompt?: string;
  /** Business name if the merchant mentioned it. */
  merchantName?: string;
  /** Emergency-first vs planned-work-first — flips hero picks. */
  emergencyFirst?: boolean;
  /** Product-heavy trade (merchant, supplies) → showroom hero. */
  productFirst?: boolean;
  /** For deterministic asset + hero rotation. */
  seed?: string;
};

export type ComposedLayout = {
  themePresetId: ThemePresetId;
  seeds: BlueprintSectionSeed[];
  /** Diagnostic: which registration id was picked at each slot. */
  picks: Array<{ slot: string; sectionId: string | null }>;
};

/** Trades where a gallery section adds value (visual work). */
const VISUAL_TRADES = new Set([
  "roofer",
  "landscaper",
  "tiler",
  "painter",
  "stonemason",
  "bricklayer",
  "kitchen-fitter",
  "stair-fitter",
  "window-fitter",
  "carpenter",
  "joiner",
  "plasterer"
]);

/** Trades where product-showroom or plant-hire hero fits better than
 *  the trust-anchor/split-photo default. */
const PRODUCT_TRADES = new Set([
  "building-merchant",
  "builders-supplies",
  "tool-hire",
  "heavy-machinery"
]);

/** Emergency-first trades — a 247 hero performs best. */
const EMERGENCY_TRADES = new Set([
  "plumber",
  "electrician",
  "gas-engineer",
  "roofer"
]);

// ─── Section picking ────────────────────────────────────────────────

/** Deterministic hash → 0..N-1 index. djb2 variant. */
function pickIndex(seed: string, length: number): number {
  if (length <= 0) return 0;
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) + h + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % length;
}

/** Registered sections in a library, filtered to those best-for the
 *  trade, deterministically ordered. Falls back to any-verticals when
 *  none matches. */
function candidatesForTrade(
  library: string,
  tradeSlug: string
): AnySectionRegistration[] {
  const all = sectionRegistry.list(library as never);
  if (all.length === 0) return [];
  const matches = all.filter(
    (r) => Array.isArray(r.bestForVerticals) && r.bestForVerticals.includes(tradeSlug)
  );
  return matches.length > 0 ? matches : all;
}

/** Pick a hero id given intent — respects emergency / product / visual
 *  hints, then falls back to trust-minimal. */
function pickHeroId(intent: ComposeIntent): string | null {
  const seed = intent.seed ?? intent.tradeSlug;
  if (intent.emergencyFirst || EMERGENCY_TRADES.has(intent.tradeSlug)) {
    if (sectionRegistry.has("hero.emergency_247_1")) return "hero.emergency_247_1";
  }
  if (intent.productFirst || PRODUCT_TRADES.has(intent.tradeSlug)) {
    if (sectionRegistry.has("hero.product_showroom_1")) return "hero.product_showroom_1";
    if (sectionRegistry.has("hero.plant_hire_bold_1")) return "hero.plant_hire_bold_1";
  }
  const heroPool = [
    "hero.trust_anchor_1",
    "hero.trust_minimal_1",
    "hero.split_photo_left_1",
    "hero.stat_hero_1"
  ].filter((id) => sectionRegistry.has(id));
  if (heroPool.length === 0) {
    const candidates = candidatesForTrade("hero", intent.tradeSlug);
    return candidates[0]?.id ?? null;
  }
  return heroPool[pickIndex(`${seed}#hero`, heroPool.length)];
}

/** Pick the first section id that matches one of the given library ids
 *  and is registered. Used for the linear pipeline steps. */
function pickFirstAvailable(...ids: string[]): string | null {
  for (const id of ids) {
    if (sectionRegistry.has(id)) return id;
  }
  return null;
}

// ─── Seed construction ─────────────────────────────────────────────

function push(
  out: BlueprintSectionSeed[],
  picks: ComposedLayout["picks"],
  slot: string,
  sectionId: string | null,
  config: Record<string, unknown> = {}
): void {
  picks.push({ slot, sectionId });
  if (!sectionId) return;
  out.push({ key: sectionId, config });
}

/** Extract a rough headline from the merchant's prompt (first sentence,
 *  trimmed, capped at 60 chars). Used only when the merchant didn't
 *  give the hero its own headline. */
function headlineFromPrompt(prompt: string | undefined): string | undefined {
  if (!prompt) return undefined;
  const firstSentence = prompt.trim().split(/[.!?\n]/, 1)[0] ?? "";
  const trimmed = firstSentence.trim();
  if (trimmed.length === 0 || trimmed.length > 60) return undefined;
  return trimmed;
}

// ─── Public API ────────────────────────────────────────────────────

/** Compose the home page for a trade, honouring intent hints. Idempotent
 *  when `seed` is provided. */
export function composeHomeLayout(intent: ComposeIntent): ComposedLayout {
  if (!intent.tradeSlug || !packageForTrade(intent.tradeSlug)) {
    // No KG package → we can still ship *something* but it'll all be
    // fallback content. Surfaced through picks so the API can decide
    // whether to reject.
  }

  const seeds: BlueprintSectionSeed[] = [];
  const picks: ComposedLayout["picks"] = [];
  const promptHeadline = headlineFromPrompt(intent.prompt);
  const merchantName = intent.merchantName?.trim() || undefined;

  // 1. Hero — copy fields seeded when the prompt gives us something
  //    to work with; empty otherwise (renderer keeps its default).
  const heroId = pickHeroId(intent);
  const heroConfig: Record<string, unknown> = {};
  if (promptHeadline) heroConfig.heading = promptHeadline;
  if (merchantName) heroConfig.merchantName = merchantName;
  push(seeds, picks, "hero", heroId, heroConfig);

  // 2. Trust bar — pulls credential schemes from KG.
  push(seeds, picks, "trust_bar", pickFirstAvailable("trust_bar.icon_row_1"), {
    useKnowledgeGraph: true,
    eyebrow: ""
  });

  // 3. Services — pulls from KG.
  push(seeds, picks, "services", pickFirstAvailable("services.list_1"), {
    useKnowledgeGraph: true
  });

  // 4. Features — pulls industryIntelligence.
  push(seeds, picks, "features", pickFirstAvailable("features.three_up_reasons_1", "features.icon_grid_1"), {
    useKnowledgeGraph: true
  });

  // 5. Gallery — visual trades only.
  if (VISUAL_TRADES.has(intent.tradeSlug)) {
    push(seeds, picks, "gallery", pickFirstAvailable("gallery.grid_1"));
  } else {
    picks.push({ slot: "gallery", sectionId: null });
  }

  // 6. Testimonials — KG customerTypes.
  push(seeds, picks, "testimonials", pickFirstAvailable("testimonials.card_grid_1"), {
    useKnowledgeGraph: true
  });

  // 7. FAQ — KG commonFaqs.
  push(seeds, picks, "faq", pickFirstAvailable("faq.accordion_1"), {
    useKnowledgeGraph: true
  });

  // 8. CTA band + contact split.
  push(seeds, picks, "cta", pickFirstAvailable("cta.compact_band_1", "cta.centred_1"));
  push(seeds, picks, "contact", pickFirstAvailable("contact.split_1"));

  // 9. Footer.
  push(seeds, picks, "footer", pickFirstAvailable("footer.minimal_1"));

  return {
    themePresetId: suggestThemeForTrade(intent.tradeSlug),
    seeds,
    picks
  };
}
