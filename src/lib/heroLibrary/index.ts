// heroLibrary — server-side loader for scripts/hero-library.json.
//
// The App Builder pipeline uses this to pick a real trade-appropriate
// hero banner instead of a generic Unsplash fallback. Matching is by
// keyword intersection with the trade slug (strict — no cross-trade
// leaks) plus explicit trade exclusions.
//
// The palette from the picked hero flows into brand tokens so the
// theme harmonises with the banner photograph automatically.
//
// SERVER-ONLY — reads the JSON off disk at module init. Consumers
// call `pickHeroForTrade(tradeSlug)` and get a fully-resolved entry.

import fs from "node:fs";
import path from "node:path";

export type HeroTextZone = {
  primary: string;
  container_required: boolean;
  text_shadow_recommended: boolean;
};

export type HeroPalette = {
  primary: string;
  secondary: string;
  surface_warm: string;
  surface_deep: string;
  accent: string;
};

export type HeroEntry = {
  id: string;
  image_url: string;
  subject: string;
  keywords_strict: string[];
  excluded_trades?: string[];
  vibe: string;
  text_zone: HeroTextZone;
  theme_palette: HeroPalette;
  aspect_variants?: Record<string, string>;
  sibling_group_id?: string;
  hero_use_case?: string;
  burned_in_text?: boolean;
  worker_visible?: boolean;
  recommended_use?: "hero" | "split-hero" | "product-grid" | "section-content";
};

type HeroLibraryFile = {
  $schema_version: string;
  entries: HeroEntry[];
};

let cache: HeroEntry[] | null = null;

/** Load the hero library once and cache in module scope. */
function loadEntries(): HeroEntry[] {
  if (cache) return cache;
  try {
    const file = path.join(process.cwd(), "scripts", "hero-library.json");
    const raw = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(raw) as HeroLibraryFile;
    cache = Array.isArray(parsed.entries) ? parsed.entries : [];
  } catch {
    cache = [];
  }
  return cache;
}

function normaliseKeyword(k: string): string {
  return k.toLowerCase().replace(/-/g, " ").trim();
}

/** Score an entry against a trade slug. Higher is a better match. */
function scoreEntry(entry: HeroEntry, tradeSlug: string): number {
  const trade = normaliseKeyword(tradeSlug);

  // Hard exclude — never surface an entry that lists this trade as
  // excluded.
  const excluded = (entry.excluded_trades ?? []).map(normaliseKeyword);
  if (excluded.some((t) => t === trade || trade.includes(t) || t.includes(trade))) {
    return -1;
  }

  const kws = entry.keywords_strict.map(normaliseKeyword);
  let score = 0;

  for (const k of kws) {
    if (k === trade) {
      score += 100;
    } else if (k.includes(trade) || trade.includes(k)) {
      score += 40;
    } else {
      // Token overlap
      const tradeTokens = new Set(trade.split(/\s+/));
      const kwTokens = k.split(/\s+/);
      const overlap = kwTokens.filter((t) => tradeTokens.has(t)).length;
      if (overlap > 0) score += overlap * 10;
    }
  }

  if (entry.recommended_use === "hero") score += 10;
  if (entry.worker_visible) score += 3;

  return score;
}

export type PickedHero = {
  entry: HeroEntry;
  score: number;
};

/** Pick the best-fit hero entry for a trade slug. Returns null when
 *  nothing in the library scores above 0. */
export function pickHeroForTrade(tradeSlug: string): PickedHero | null {
  if (!tradeSlug) return null;
  const entries = loadEntries();
  let best: PickedHero | null = null;
  for (const entry of entries) {
    const score = scoreEntry(entry, tradeSlug);
    if (score > 0 && (!best || score > best.score)) {
      best = { entry, score };
    }
  }
  return best;
}

/** Every hero for a trade, sorted by score. Powers the "swap image"
 *  chip in Studio's media picker. */
export function heroesForTrade(tradeSlug: string): PickedHero[] {
  if (!tradeSlug) return [];
  const entries = loadEntries();
  const scored: PickedHero[] = [];
  for (const entry of entries) {
    const score = scoreEntry(entry, tradeSlug);
    if (score > 0) scored.push({ entry, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

/** Total count for observability. */
export function heroLibrarySize(): number {
  return loadEntries().length;
}
