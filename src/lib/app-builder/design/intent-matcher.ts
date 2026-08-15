// NEX App Builder · Intent-based image matcher (Philip 2026-08-14).
//
// Consumes: Blueprint intent tags + page purpose + existing heroLibrary.
// Produces: a scored match with full provenance — OR a NO_SUITABLE_IMAGE
// signal that the operator/generation-worker must act on.
//
// Constitutional rules enforced here:
//   - Never invent a heroLibrary id
//   - Never silently substitute a visually inappropriate image
//   - Every match records its provenance (source, reason, score)
//   - No match → status: REQUIRED  · NOT a silent fallback

import type { IntentTag } from "./intent-taxonomy";

// heroLibrary types mirror src/lib/heroLibrary/index.ts
export type HeroEntryLike = {
  id: string;
  image_url: string;
  subject?: string;
  keywords_strict?: string[];
  excluded_trades?: string[];
  vibe?: string;
  hero_use_case?: string;
  theme_palette?: unknown;
};

export type MatchProvenance = {
  source: "heroLibrary";
  id: string;
  reason: string[];        // human-readable reasons this match was chosen
  intentTagsMatched: IntentTag[];
  scoreBreakdown: Record<string, number>;
  totalScore: number;
};

export type ImageSelectionOutcome =
  | { status: "MATCHED"; entry: HeroEntryLike; provenance: MatchProvenance; alternates: HeroEntryLike[] }
  | { status: "NO_SUITABLE_IMAGE"; reason: string; consideredIds: string[]; intentTags: IntentTag[] };

export type MatchOptions = {
  /** Where in the app this image will be used. */
  pagePurpose: "homepage" | "gallery" | "product" | "about" | "contact" | "services";
  /** Trade taxonomy slug (used as strict-keyword eligibility filter). */
  tradeSlug: string;
  /** Minimum score to accept a match (0..1 scale · defaults to 0.35). */
  minScore?: number;
};

/** Score an entry against intent tags. Higher = better fit. */
export function scoreEntry(entry: HeroEntryLike, tags: IntentTag[], tradeSlug: string): {
  total: number;
  breakdown: Record<string, number>;
  matchedTags: IntentTag[];
} {
  const breakdown: Record<string, number> = {};
  const matchedTags: IntentTag[] = [];
  let total = 0;

  // Excluded trade — hard zero.
  if (entry.excluded_trades && entry.excluded_trades.includes(tradeSlug)) {
    breakdown.excluded_trade = -Infinity;
    return { total: -Infinity, breakdown, matchedTags: [] };
  }

  // Trade keyword strict match — required baseline (0 or 1).
  const keywords = (entry.keywords_strict ?? []).map((k) => k.toLowerCase());
  const tradeInKeywords = keywords.some((k) => tradeSlug.toLowerCase().includes(k) || k.includes(tradeSlug.toLowerCase()));
  breakdown.trade_keyword = tradeInKeywords ? 0.4 : 0.0;
  total += breakdown.trade_keyword;

  // Intent-tag intersections against keywords + vibe + subject + hero_use_case
  const searchable = [
    ...keywords,
    (entry.vibe ?? "").toLowerCase(),
    (entry.subject ?? "").toLowerCase(),
    (entry.hero_use_case ?? "").toLowerCase()
  ].join(" ");

  for (const t of tags) {
    if (searchable.includes(t.value.toLowerCase())) {
      const contribution = t.weight * 0.15;
      total += contribution;
      matchedTags.push(t);
      breakdown[`tag:${t.category}:${t.value}`] = contribution;
    }
  }

  return { total, breakdown, matchedTags };
}

/** Rank + pick best. Honest NO_SUITABLE_IMAGE when nothing clears the bar. */
export function selectImage(
  entries: readonly HeroEntryLike[],
  intentTags: IntentTag[],
  opts: MatchOptions
): ImageSelectionOutcome {
  const minScore = opts.minScore ?? 0.35;

  const scored = entries
    .map((entry) => ({ entry, ...scoreEntry(entry, intentTags, opts.tradeSlug) }))
    .filter((s) => s.total > -Infinity)
    .sort((a, b) => b.total - a.total);

  if (scored.length === 0 || scored[0].total < minScore) {
    return {
      status: "NO_SUITABLE_IMAGE",
      reason: scored.length === 0
        ? "no library entries eligible for this trade (all excluded or none exist)"
        : `top score ${scored[0].total.toFixed(2)} below minScore ${minScore}`,
      consideredIds: scored.map((s) => s.entry.id),
      intentTags
    };
  }

  const winner = scored[0];
  const alternates = scored.slice(1, 4).map((s) => s.entry);

  const reason: string[] = [];
  if (winner.breakdown.trade_keyword > 0) reason.push(`trade "${opts.tradeSlug}" matches library keyword`);
  for (const [k, v] of Object.entries(winner.breakdown)) {
    if (k.startsWith("tag:") && v > 0) {
      reason.push(`intent "${k.slice(4)}" (+${v.toFixed(2)})`);
    }
  }

  return {
    status: "MATCHED",
    entry: winner.entry,
    alternates,
    provenance: {
      source: "heroLibrary",
      id: winner.entry.id,
      reason,
      intentTagsMatched: winner.matchedTags,
      scoreBreakdown: winner.breakdown,
      totalScore: winner.total
    }
  };
}
