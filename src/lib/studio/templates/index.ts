// Templates — the user-facing gallery layer over the blueprint registry.
//
// Each of the 51 registered blueprints becomes a template with:
//   • a thumbnail derived from the hero library (real trade photograph)
//   • a compact "wow" tagline
//   • trade-fit + goal tags for filtering
//   • a similarity payload the vision-matcher can score against
//
// The template picker (Step 2 of the wizard) reads from here.
// Templates are also the payload the AI composer seeds itself from
// when the merchant picks one.

import "@/lib/studio/blueprints";
import { blueprintRegistry } from "@/lib/studio/blueprints/registry";
import { pickHeroForTrade } from "@/lib/heroLibrary";

export type TemplateTone =
  | "trades-native"
  | "professional"
  | "premium"
  | "editorial"
  | "bold"
  | "friendly"
  | "urgent"
  | "documentary";

export type TemplateLength = "short" | "medium" | "long";

export type Template = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  /** Trade slugs this template ships for — powers the filter. */
  bestForTrades: readonly string[];
  /** Business outcomes the template optimises for. */
  outcomes: readonly string[];
  variant: string;
  /** Thumbnail URL used in the picker grid. Falls back to a generated
   *  gradient tile when the trade has no hero library match. */
  thumbnailUrl: string | null;
  /** Vibe / tone descriptor — used both in the UI and in the vision
   *  matcher scoring. */
  tone: TemplateTone;
  /** Rough count of sections on the home page — feeds "length" tag. */
  homeSectionCount: number;
  length: TemplateLength;
  /** Palette hint pulled from the paired hero library entry when
   *  available. Vision matcher scores palette closeness against this. */
  palette: {
    primary: string;
    secondary: string;
    accent: string;
  } | null;
};

/** Derive length label from the home section count. */
function lengthFor(count: number): TemplateLength {
  if (count <= 5) return "short";
  if (count <= 9) return "medium";
  return "long";
}

/** Map blueprint variant → tone. Kept small and explicit so we can
 *  tune later without touching the picker UI. */
function toneFor(variant: string, outcomes: readonly string[]): TemplateTone {
  if (outcomes.includes("emergency-callout")) return "urgent";
  const v = variant.toLowerCase();
  if (v.includes("premium") || v.includes("luxury")) return "premium";
  if (v.includes("editorial") || v.includes("magazine")) return "editorial";
  if (v.includes("bold") || v.includes("industrial")) return "bold";
  if (v.includes("corporate") || v.includes("commercial")) return "professional";
  if (v.includes("minimal") || v.includes("clean")) return "documentary";
  if (v.includes("creative") || v.includes("friendly")) return "friendly";
  return "trades-native";
}

/** Turn a registered blueprint into a Template. */
function toTemplate(bp: ReturnType<typeof blueprintRegistry.list>[number]): Template {
  const primaryTrade = bp.trades[0];
  const heroPick = primaryTrade ? pickHeroForTrade(primaryTrade) : null;
  const hero = heroPick?.entry ?? null;
  const homeCount = Array.isArray(bp.layout?.home) ? bp.layout.home.length : 0;

  return {
    id: bp.slug,
    name: bp.name,
    tagline: bp.tagline,
    description: bp.description,
    bestForTrades: bp.trades,
    outcomes: (bp.outcomes ?? []) as readonly string[],
    variant: bp.variant ?? "trades-native",
    thumbnailUrl: hero?.image_url ?? null,
    tone: toneFor(bp.variant ?? "", bp.outcomes ?? []),
    homeSectionCount: homeCount,
    length: lengthFor(homeCount),
    palette: hero
      ? {
          primary: hero.theme_palette.primary,
          secondary: hero.theme_palette.secondary,
          accent: hero.theme_palette.accent
        }
      : null
  };
}

let cached: Template[] | null = null;

/** Full template catalogue, cached in module scope. */
export function listTemplates(): Template[] {
  if (cached) return cached;
  cached = blueprintRegistry.list().map(toTemplate);
  return cached;
}

/** Filter by trade slug — returns templates whose `bestForTrades`
 *  intersects the slug or lists "*". */
export function templatesForTrade(tradeSlug: string): Template[] {
  if (!tradeSlug) return listTemplates();
  return listTemplates().filter(
    (t) =>
      t.bestForTrades.includes(tradeSlug) ||
      t.bestForTrades.includes("*") ||
      t.bestForTrades.some(
        (s) => s.includes(tradeSlug) || tradeSlug.includes(s)
      )
  );
}

/** Get a single template by id. */
export function getTemplate(id: string): Template | null {
  return listTemplates().find((t) => t.id === id) ?? null;
}

/** Facet counts for the picker filter chips. */
export function templateFacets(): {
  tones: Array<{ id: TemplateTone; count: number }>;
  lengths: Array<{ id: TemplateLength; count: number }>;
  total: number;
} {
  const list = listTemplates();
  const toneCounts = new Map<TemplateTone, number>();
  const lengthCounts = new Map<TemplateLength, number>();
  for (const t of list) {
    toneCounts.set(t.tone, (toneCounts.get(t.tone) ?? 0) + 1);
    lengthCounts.set(t.length, (lengthCounts.get(t.length) ?? 0) + 1);
  }
  return {
    tones: [...toneCounts].map(([id, count]) => ({ id, count })),
    lengths: [...lengthCounts].map(([id, count]) => ({ id, count })),
    total: list.length
  };
}
