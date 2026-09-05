// src/lib/nex/brain/comparison-ranking-intelligence.ts
//
// Wave 1 · Comparison + Ranking Intelligence
// Philip 2026-09-06 · AUTHORIZE · WAVE 1 · CONVERSATIONAL SEMANTIC CONTROL
//
// GOVERNING PRINCIPLE (§9 §10 §11 §19)
//   Comparison and Ranking are represented as DISTINCT semantic
//   intents even though they share vocabulary and infrastructure.
//   Never fabricate attribute values (prices, distances, ratings).
//   If evidence cannot support the operation, explain the limitation.

import type { Lang } from "./language-state";

// ─── Types ──────────────────────────────────────────────────────

export type SemanticIntent =
  | "COMPARE"      // "which is cheaper?" / "is the first one closer?"
  | "RANK"         // "which is the cheapest?" / "top three cheapest"
  | "SELECT"       // "give me the cheapest one" (implicit ranking + selection)
  | "NONE";

export type SortDirection = "ASC" | "DESC" | "SAME";

export type AttributeCategory =
  | "PRICE"        // cheap · cheapest · expensive · affordable · murah · mahal
  | "DISTANCE"    // close · closest · far · dekat · jauh
  | "SIZE"         // big · biggest · small · smallest · besar · kecil
  | "QUALITY"      // best · worst · terbaik · terburuk
  | "RATING"       // highest-rated · lowest-rated
  | "TIME"         // earliest · latest · earlier · later · pertama · terakhir
  | "ORDINAL"      // first · second · third · pertama · kedua · ketiga
  | "GENERIC";     // more · less · better · worse · lebih

export type ComparisonRankingState = {
  intent: SemanticIntent;
  attribute: AttributeCategory | null;
  direction: SortDirection | null;
  /** For RANK / SELECT · how many entities requested (top N / bottom N). */
  count: number | null;
  /** For SELECT · bottom-of-ranked slice ("last two") vs top ("first two"). */
  ranking_edge: "TOP" | "BOTTOM" | null;
  /** COMPARE-specific · the entities being compared (best-effort tokens). */
  compared_entities: string[];
  markers: string[];
  confidence: "HIGH" | "MEDIUM" | "LOW";
  reason: string;
};

// ─── Tokenizer ──────────────────────────────────────────────────

function tokens(message: string): string[] {
  return (message || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[?.!,;:"“”()]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

// ─── Vocabulary (EN + ID) ───────────────────────────────────────

// Superlatives (ranking) — highest specificity
const SUPERLATIVE_MAP: Record<string, { attr: AttributeCategory; dir: SortDirection }> = {
  cheapest: { attr: "PRICE", dir: "ASC" },
  "most expensive": { attr: "PRICE", dir: "DESC" }, // handled via bigram
  priciest: { attr: "PRICE", dir: "DESC" },
  closest: { attr: "DISTANCE", dir: "ASC" },
  nearest: { attr: "DISTANCE", dir: "ASC" },
  farthest: { attr: "DISTANCE", dir: "DESC" },
  furthest: { attr: "DISTANCE", dir: "DESC" },
  biggest: { attr: "SIZE", dir: "DESC" },
  largest: { attr: "SIZE", dir: "DESC" },
  smallest: { attr: "SIZE", dir: "ASC" },
  best: { attr: "QUALITY", dir: "DESC" },
  worst: { attr: "QUALITY", dir: "ASC" },
  earliest: { attr: "TIME", dir: "ASC" },
  latest: { attr: "TIME", dir: "DESC" },
  // NB: "first" and "last" removed from the superlative map · they are
  // pure ordinal markers handled by the single-ordinal rule 8. This
  // ensures comparatives elsewhere in the message ("Is the first one
  // closer?") take precedence over the bare ordinal.
};

// Indonesian superlatives · "paling <adj>" and "ter<adj>" morphology
const SUPER_ID_MAP: Record<string, { attr: AttributeCategory; dir: SortDirection }> = {
  murah: { attr: "PRICE", dir: "ASC" },      // "paling murah" / "termurah"
  mahal: { attr: "PRICE", dir: "DESC" },     // "paling mahal" / "termahal"
  dekat: { attr: "DISTANCE", dir: "ASC" },   // "paling dekat" / "terdekat"
  jauh: { attr: "DISTANCE", dir: "DESC" },
  besar: { attr: "SIZE", dir: "DESC" },
  kecil: { attr: "SIZE", dir: "ASC" },
  baik: { attr: "QUALITY", dir: "DESC" },
  buruk: { attr: "QUALITY", dir: "ASC" },
  cepat: { attr: "GENERIC", dir: "DESC" },
  lambat: { attr: "GENERIC", dir: "ASC" },
};

// Comparatives (comparison · not ranking) — "cheaper", "more expensive"
const COMPARATIVE_MAP: Record<string, { attr: AttributeCategory; dir: SortDirection }> = {
  cheaper: { attr: "PRICE", dir: "ASC" },
  pricier: { attr: "PRICE", dir: "DESC" },
  closer: { attr: "DISTANCE", dir: "ASC" },
  farther: { attr: "DISTANCE", dir: "DESC" },
  further: { attr: "DISTANCE", dir: "DESC" },
  bigger: { attr: "SIZE", dir: "DESC" },
  larger: { attr: "SIZE", dir: "DESC" },
  smaller: { attr: "SIZE", dir: "ASC" },
  better: { attr: "QUALITY", dir: "DESC" },
  worse: { attr: "QUALITY", dir: "ASC" },
  earlier: { attr: "TIME", dir: "ASC" },
  later: { attr: "TIME", dir: "DESC" },
  faster: { attr: "GENERIC", dir: "DESC" },
  slower: { attr: "GENERIC", dir: "ASC" },
  higher: { attr: "GENERIC", dir: "DESC" },
  lower: { attr: "GENERIC", dir: "ASC" },
  more: { attr: "GENERIC", dir: "DESC" },
  less: { attr: "GENERIC", dir: "ASC" },
};

const ORDINAL_TOKENS: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5,
  last: -1, next: 0,
  pertama: 1, kedua: 2, ketiga: 3, keempat: 4, kelima: 5,
  terakhir: -1, berikutnya: 0,
};

// ─── Number-word parser (subset of quantity's) ──────────────────

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5,
};

function parseNumberToken(tok: string): number | null {
  if (/^\d+$/.test(tok)) return parseInt(tok, 10);
  if (Object.prototype.hasOwnProperty.call(NUMBER_WORDS, tok)) return NUMBER_WORDS[tok];
  return null;
}

// ─── Helpers ────────────────────────────────────────────────────

function findBigram(t: string[], a: string, b: string): number {
  for (let i = 0; i < t.length - 1; i++) if (t[i] === a && t[i + 1] === b) return i;
  return -1;
}

// ─── Detector ───────────────────────────────────────────────────

export function detectComparisonRanking(message: string): ComparisonRankingState {
  const t = tokens(message);
  const markers: string[] = [];

  const empty = (reason: string): ComparisonRankingState => ({
    intent: "NONE", attribute: null, direction: null, count: null, ranking_edge: null,
    compared_entities: [], markers, confidence: "HIGH", reason,
  });

  if (t.length === 0) return empty("empty");

  // 1 · "most expensive" bigram — check FIRST
  const meIdx = findBigram(t, "most", "expensive");
  if (meIdx >= 0) {
    markers.push("most_expensive");
    return {
      intent: "SELECT", attribute: "PRICE", direction: "DESC",
      count: 1, ranking_edge: "TOP",
      compared_entities: [], markers, confidence: "HIGH", reason: "superlative:most_expensive",
    };
  }
  const heIdx = findBigram(t, "highest", "rated");
  if (heIdx >= 0) {
    markers.push("highest_rated");
    return { intent: "SELECT", attribute: "RATING", direction: "DESC", count: 1, ranking_edge: "TOP", compared_entities: [], markers, confidence: "HIGH", reason: "superlative:highest_rated" };
  }
  const leIdx = findBigram(t, "lowest", "rated");
  if (leIdx >= 0) {
    markers.push("lowest_rated");
    return { intent: "SELECT", attribute: "RATING", direction: "ASC", count: 1, ranking_edge: "BOTTOM", compared_entities: [], markers, confidence: "HIGH", reason: "superlative:lowest_rated" };
  }

  // 2a · Indonesian "paling <adj>" — SUPERLATIVE (RANK)
  for (let i = 0; i < t.length - 1; i++) {
    if (t[i] === "paling") {
      const spec = SUPER_ID_MAP[t[i + 1]];
      if (spec) {
        markers.push(`id_paling_${t[i + 1]}`);
        return {
          intent: "SELECT", attribute: spec.attr, direction: spec.dir,
          count: 1, ranking_edge: "TOP",
          compared_entities: [], markers, confidence: "HIGH",
          reason: `id_superlative:paling_${t[i + 1]}`,
        };
      }
    }
  }
  // 2b · Indonesian "ter<adj>" morphology — separate loop so the last
  // token is inspected (previous loop bound was t.length - 1).
  for (let i = 0; i < t.length; i++) {
    if (t[i].startsWith("ter") && t[i].length > 4) {
      const stem = t[i].slice(3);
      const spec = SUPER_ID_MAP[stem];
      if (spec) {
        markers.push(`id_ter_${stem}`);
        return {
          intent: "SELECT", attribute: spec.attr, direction: spec.dir,
          count: 1, ranking_edge: "TOP",
          compared_entities: [], markers, confidence: "HIGH",
          reason: `id_superlative:ter${stem}`,
        };
      }
    }
  }

  // 3 · Top N / Bottom N — "top three", "top 3", "the top three"
  for (let i = 0; i < t.length - 1; i++) {
    if (t[i] === "top" && parseNumberToken(t[i + 1]) !== null) {
      const n = parseNumberToken(t[i + 1])!;
      markers.push("top_N", `${n}`);
      return {
        intent: "SELECT", attribute: "GENERIC", direction: "DESC",
        count: n, ranking_edge: "TOP",
        compared_entities: [], markers, confidence: "HIGH", reason: `top_N:${n}`,
      };
    }
    if (t[i] === "bottom" && parseNumberToken(t[i + 1]) !== null) {
      const n = parseNumberToken(t[i + 1])!;
      markers.push("bottom_N", `${n}`);
      return {
        intent: "SELECT", attribute: "GENERIC", direction: "ASC",
        count: n, ranking_edge: "BOTTOM",
        compared_entities: [], markers, confidence: "HIGH", reason: `bottom_N:${n}`,
      };
    }
  }

  // 4 · Single-word superlative (RANK / SELECT)
  for (let i = 0; i < t.length; i++) {
    const spec = SUPERLATIVE_MAP[t[i]];
    if (spec) {
      // Determine count from surrounding context (e.g. "three cheapest" / "the three cheapest")
      let count = 1;
      let ranking_edge: "TOP" | "BOTTOM" = spec.dir === "DESC" ? "TOP" : "TOP";
      // Check preceding tokens for a number: "three cheapest"
      for (let j = Math.max(0, i - 3); j < i; j++) {
        const n = parseNumberToken(t[j]);
        if (n !== null) { count = n; break; }
      }
      markers.push(`superlative:${t[i]}`, `count=${count}`);
      return {
        intent: "SELECT", attribute: spec.attr, direction: spec.dir,
        count, ranking_edge,
        compared_entities: [], markers, confidence: "HIGH", reason: `superlative:${t[i]}`,
      };
    }
  }

  // 5 · Comparative bigrams FIRST · "more expensive", "less expensive"
  //     Runs BEFORE ordinal-single so "Is the first one closer?" is
  //     recognised as a COMPARE on closer, not SELECT on first.
  for (let i = 0; i < t.length - 1; i++) {
    if (t[i] === "more" && t[i + 1] === "expensive") {
      markers.push("more_expensive");
      return {
        intent: "COMPARE", attribute: "PRICE", direction: "DESC",
        count: null, ranking_edge: null,
        compared_entities: [], markers, confidence: "HIGH", reason: "comparative:more_expensive",
      };
    }
    if (t[i] === "less" && t[i + 1] === "expensive") {
      markers.push("less_expensive");
      return {
        intent: "COMPARE", attribute: "PRICE", direction: "ASC",
        count: null, ranking_edge: null,
        compared_entities: [], markers, confidence: "HIGH", reason: "comparative:less_expensive",
      };
    }
  }

  // Indonesian comparative "lebih <adj>" — COMPARE
  for (let i = 0; i < t.length - 1; i++) {
    if (t[i] === "lebih") {
      const spec = SUPER_ID_MAP[t[i + 1]];
      if (spec) {
        markers.push(`id_lebih_${t[i + 1]}`);
        return {
          intent: "COMPARE", attribute: spec.attr, direction: spec.dir,
          count: null, ranking_edge: null,
          compared_entities: [], markers, confidence: "HIGH", reason: `id_comparative:lebih_${t[i + 1]}`,
        };
      }
    }
  }

  // 7 · Single-word comparatives (COMPARE)
  for (let i = 0; i < t.length; i++) {
    const spec = COMPARATIVE_MAP[t[i]];
    if (spec) {
      markers.push(`comparative:${t[i]}`);
      return {
        intent: "COMPARE", attribute: spec.attr, direction: spec.dir,
        count: null, ranking_edge: null,
        compared_entities: [], markers, confidence: "HIGH", reason: `comparative:${t[i]}`,
      };
    }
  }

  // 8 · Bare ordinal ("first", "the second one") · runs LAST so a
  //     comparative anywhere in the message wins. ORDINAL_RANGE
  //     ("the first three") is detected by the quantity module in a
  //     separate concept space, so no skip is needed here. However
  //     we DO skip when the following token is a digit-only number,
  //     since "the first 2" is unambiguously a range (numeric).
  for (let i = 0; i < t.length; i++) {
    if (Object.prototype.hasOwnProperty.call(ORDINAL_TOKENS, t[i])) {
      const nextIsDigit = i + 1 < t.length && /^\d+$/.test(t[i + 1]);
      if (nextIsDigit) continue;
      markers.push(`ordinal:${t[i]}`);
      return {
        intent: "SELECT", attribute: "ORDINAL", direction: "ASC",
        count: 1, ranking_edge: "TOP",
        compared_entities: [], markers, confidence: "MEDIUM", reason: `ordinal_single:${t[i]}`,
      };
    }
  }

  return empty("no_comparison_ranking_marker");
}

// ─── Gate: fresh-conv ranking / comparison without result set ───

export type ComparisonRankingGateDecision =
  | { shouldGate: false; reason: string; state: ComparisonRankingState }
  | {
      shouldGate: true;
      reason: string;
      state: ComparisonRankingState;
      reply: string;
      language: Lang;
    };

export function decideComparisonRankingGate(input: {
  userMessage: string;
  hasActiveResultSet: boolean;
  activeLanguage: Lang;
}): ComparisonRankingGateDecision {
  const state = detectComparisonRanking(input.userMessage);

  if (state.intent === "NONE") {
    return { shouldGate: false, reason: "no_semantic_intent", state };
  }

  // Pure ORDINAL attribute is handled by P0.4 (fresh-conv ordinal
  // contamination guard) with a more specific and established reply.
  // Delegate rather than shadow.
  if (state.attribute === "ORDINAL") {
    return { shouldGate: false, reason: "delegated_to_p0_4_ordinal_gate", state };
  }

  // Fresh-conv RANK / SELECT / COMPARE without any active result set
  // to operate on — clarify rather than fabricate a ranking.
  if (!input.hasActiveResultSet) {
    const reply = replyNoResultSet(state, input.activeLanguage);
    return {
      shouldGate: true,
      reason: `no_result_set_for_${state.intent}`,
      state,
      reply,
      language: input.activeLanguage,
    };
  }

  // With a result set: pass observability through, do NOT gate.
  // The downstream composer receives the intent as context and can
  // rank/compare naturally OR the claim verifier can catch fabrication.
  return { shouldGate: false, reason: `pass_through:${state.intent}`, state };
}

function replyNoResultSet(state: ComparisonRankingState, lang: Lang): string {
  const attr = state.attribute === "PRICE" ? "price"
             : state.attribute === "DISTANCE" ? "distance"
             : state.attribute === "QUALITY" ? "quality"
             : state.attribute === "RATING" ? "rating"
             : "that attribute";
  if (lang === "ID") {
    return `Saya belum menampilkan hasil apa pun untuk dibandingkan. Ingin saya cari terlebih dahulu?`;
  }
  return `I haven't shown any results yet in this conversation to ${state.intent === "COMPARE" ? "compare" : "rank"} by ${attr}. Want me to search first?`;
}
