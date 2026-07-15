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

/** Load the hero library once and cache in module scope.
 *
 *  Dev caveat: the cache lives across HMR reloads because the file
 *  is read at module init, so editing scripts/hero-library.json
 *  wouldn't surface until a full server restart. To keep the
 *  authoring loop tight, we bypass the cache when NODE_ENV !==
 *  "production" and re-read on every call. Prod path stays cached
 *  since the file is bundled at build time and never changes. */
function loadEntries(): HeroEntry[] {
  if (cache && process.env.NODE_ENV === "production") return cache;
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

/** Random shuffle of the full library for the "browse-all" landing
 *  view (no query). Deterministic per-seed so pagination works
 *  without server state — same seed + offset always returns the
 *  same window, but reload picks a fresh seed. */
export function heroesBrowseAll(seed: number, offset: number, limit = 24): HeroEntry[] {
  const entries = loadEntries();
  if (entries.length === 0) return [];
  // Fisher-Yates seeded shuffle. Cheap, in-memory, ~168 entries.
  const rng = mulberry32(seed);
  const shuffled = [...entries];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(offset, offset + limit);
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Progressive broadening. If the exact query exhausts, drop the
 *  narrowest token and retry until we get more results. Powers the
 *  endless-scroll "flow into related categories" — e.g. "loft
 *  ladder fit" runs out → "loft ladder" → "ladder" → "loft" →
 *  fall through to the shuffled browse feed as the ultimate
 *  fallback so scroll never dead-ends. */
export function heroesForQueryPaged(query: string, offset: number, limit: number): HeroEntry[] {
  const cleaned = (query ?? "").toLowerCase().trim();
  if (!cleaned) return [];
  const tokens = cleaned
    .split(/[\s,]+/)
    .map((t) => t.replace(/[^a-z0-9]/g, ""))
    .filter((t) => t.length >= 2);
  if (tokens.length === 0) return [];

  const seen = new Set<string>();
  const scoredAll: Array<{ entry: HeroEntry; score: number; tier: number }> = [];
  const entries = loadEntries();

  // Tier 0: full query. Tier 1: drop the LAST token. Tier N: keep
  // dropping until we're down to a single token. Tier boost sorts
  // exact-query hits before broader-match hits so category flow
  // reads as an intentional widening, not a random dump.
  for (let tier = 0; tier < tokens.length; tier++) {
    const activeTokens = tokens.slice(0, tokens.length - tier);
    if (activeTokens.length === 0) break;
    const tierBoost = (tokens.length - tier) * 1000;
    for (const entry of entries) {
      if (seen.has(entry.id)) continue;
      const score = scoreEntryForQuery(entry, activeTokens);
      if (score > 0) {
        seen.add(entry.id);
        scoredAll.push({ entry, score: score + tierBoost, tier });
      }
    }
  }
  scoredAll.sort((a, b) => b.score - a.score);
  return scoredAll.slice(offset, offset + limit).map((s) => s.entry);
}

// ─── Free-text query search (powers /trade-off/search Inspiration tab) ─
//
// Different signal than pickHeroForTrade: the query is user free-text
// ("loft ladder", "garden design", "kitchen worktop"), NOT a trade
// slug. We token-match every whitespace-split query word against every
// keyword in every entry's keywords_strict, sum the overlap, and rank.
// Excluded_trades is IGNORED for query search — the exclusion list
// exists to stop cross-trade leakage on merchant hero swaps, but a
// homeowner searching "kitchen" legitimately wants kitchen-fitter
// imagery on the inspiration tab even if the entry excludes carpenter.

function scoreEntryForQuery(entry: HeroEntry, queryTokens: string[]): number {
  if (queryTokens.length === 0) return 0;
  const kws = entry.keywords_strict.map(normaliseKeyword);
  const subject = normaliseKeyword(entry.subject ?? "");
  let keywordScore = 0;
  let subjectScore = 0;
  for (const q of queryTokens) {
    for (const k of kws) {
      if (k === q) keywordScore += 20;
      else if (k.includes(q)) keywordScore += 8;
    }
    // Subject-line hit — TIEBREAKER only. Was previously a standalone
    // qualifier which let cross-category images sneak in: a garden
    // photo whose subject mentions "ladder" would score 3+ and leak
    // into a loft-ladder search. Requiring at least one keyword hit
    // before counting subject hits kills that class of false positive
    // while still preserving the tiebreaker for niche photos whose
    // curator forgot to add a keyword.
    if (subject.includes(q)) subjectScore += 3;
  }
  if (keywordScore === 0) return 0;
  let total = keywordScore + subjectScore;
  if (entry.recommended_use === "hero") total += 2;
  return total;
}

/** Score every entry against a free-text query. Returns entries with
 *  positive score, sorted best first. Cap results via the second
 *  argument. */
export function heroesForQuery(query: string, limit = 60): HeroEntry[] {
  const cleaned = (query ?? "").toLowerCase().trim();
  if (!cleaned) return [];
  const tokens = cleaned
    .split(/[\s,]+/)
    .map((t) => t.replace(/[^a-z0-9]/g, ""))
    .filter((t) => t.length >= 2);
  if (tokens.length === 0) return [];
  const entries = loadEntries();
  const scored: Array<{ entry: HeroEntry; score: number }> = [];
  for (const entry of entries) {
    const score = scoreEntryForQuery(entry, tokens);
    if (score > 0) scored.push({ entry, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.entry);
}
