// src/lib/nex/brain/refinement-detector.ts
//
// Stage 3.41.n · Refinement Classifier (Philip 2026-08-31).
//
// CONSTITUTIONAL contract:
//
//   A refinement CHANGES the constraints/preferences applied to the
//   current goal. It does NOT abandon the current goal.
//
//   REFINEMENT       — "Jangan yang third-party, official aja"
//                    · "Yang lebih murah"
//                    · "Yang rating below 4.5 skip"
//                    · "Gak usah pake paylater, cash aja"
//                    · "Yang direct flight"
//
//   ABANDONMENT      — "Gak jadi beli" · "Lupakan" · "Cancel that"
//                      (handled by abandonment-detector.ts · MUST fire)
//
//   ACTION_SUB_CANCEL — "Cancel the payment"
//                      (handled by ACTION layer · out of scope here)
//
//   CANCELLATION_INFO — "Udah deadline cancellation request jam berapa"
//                      (informational · out of scope here)
//
// INVARIANT: If the utterance REJECTS or MODIFIES an option while
// preserving the underlying goal → REFINEMENT. If it TERMINATES the
// underlying goal → ABANDONMENT. When evidence is insufficient →
// DO NOT promote to either. Fail closed.
//
// This detector is STATE-FREE. It marks intent + family + phrase.
// The caller composes with session (active vertical / current
// reference) to decide routing.

export type RefinementFamily =
  | "exclude"           // "jangan yang X" · "jangan pake X"
  | "require"           // "yang X aja" with known attribute
  | "comparative"       // "yang lebih X" · "yang paling X" · "yang terX"
  | "skip_by_attribute" // "yang rating below X skip"
  | "swap";             // "gak usah pake X, Y aja"

export type RefinementDetection =
  | { matched: false }
  | {
      matched: true;
      family:   RefinementFamily;
      phrase:   string;
      language: "en" | "id" | "mix";
    };

// ─── EXCLUDE family ────────────────────────────────────────────────
//
// "Jangan yang X" · "Jangan yang X, Y aja" · "Jangan pake X, Y aja"
//
// Guard: bare "jangan lupakan" already blocked by abandonment guard.
// This detector does NOT need to re-block · abandonment stays a
// separate concern. But "jangan yang X" must NOT fire abandonment
// (protected by constitutional wall).
const EXCLUDE_PATTERNS: RegExp[] = [
  /\bjangan\s+yang\s+\S+/i,          // "Jangan yang third-party"
  /\bjangan\s+pake\s+\S+/i,          // "Jangan pake standard exchange"
];

// ─── REQUIRE family ────────────────────────────────────────────────
//
// "Yang X aja" · "Yang X" where X is an explicit attribute anchor.
// Kept intentionally narrow — MUST NOT collide with reference forms
// like "yang second one" · "yang tadi" · "yang terakhir" (those are
// 3.41.m territory).
//
// Vocabulary chosen from Philip's constitutional contract + corpora
// (hotel · commerce · ride). Expansion belongs in future audit-driven
// landings, NOT here.
const REQUIRE_ATTRIBUTES = [
  // Travel
  "direct(\\s+(flight|ride))?", "non-?stop", "transit",
  // Commerce preferences
  "official(\\s+(brand|store))?", "recommended", "top-rated",
  "highly-rated", "best\\s+seller", "authentic", "genuine",
  "budget-friendly", "premium",
  // Product / service quality
  "non-?refundable", "refundable", "non-?smoking", "smoking",
  "instant", "instant\\s+delivery", "same-day",
  // Location / proximity
  "nearest", "closest", "nearby",
  // Ride/vehicle
  "electric", "electric\\s+(bike|option)",
  // Amenities (hotel)
  "(ocean|city|sea)\\s+view", "twin-bed", "king-bed",
].join("|");
const REQUIRE_PATTERNS: RegExp[] = [
  new RegExp(`\\byang\\s+(${REQUIRE_ATTRIBUTES})(\\s+aja)?\\b`, "i"),
  // EN bare "the direct flight" / "the recommended one"
  new RegExp(`\\bthe\\s+(${REQUIRE_ATTRIBUTES})(\\s+one)?\\b`, "i"),
];

// ─── COMPARATIVE family ────────────────────────────────────────────
//
// "Yang lebih X" · "Yang paling X" · "Yang terX" · "Cheaper" · "Nearest"
//
// Guards: "lebih baik dari itu" (better than that) is comparative
// commentary, not refinement · we require "yang" prefix so bare
// "lebih murah" mid-sentence does NOT fire.
const COMPARATIVE_PATTERNS: RegExp[] = [
  /\byang\s+lebih\s+\w+/i,           // "Yang lebih murah / dekat / mahal"
  /\byang\s+paling\s+\w+/i,          // "Yang paling murah"
  // "Yang termurah / terdekat / terbaik" · superlative refinement.
  // Negative look-ahead excludes positional reference terms (`terakhir`
  // = "last", `terdahulu` = "earlier") which belong to 3.41.m as
  // reference resolution, NOT as comparative refinement.
  /\byang\s+ter(?!(akhir|dahulu)\b)[a-z]{3,}\b/i,
  /\b(the\s+)?cheaper(\s+one)?\b/i,  // "cheaper one"
  /\b(the\s+)?nearer(\s+one)?\b/i,
];

// ─── SKIP_BY_ATTRIBUTE family ──────────────────────────────────────
//
// "yang X below Y skip" · "yang rating-nya below 4.5 skip"
// · "yang acceptance rate below 90% skip"
//
// Requires the "skip" (or ID equivalent) verb at the end. Guards
// against generic "yang rating tinggi" (that's REQUIRE, handled
// elsewhere).
const SKIP_ATTRIBUTE_PATTERNS: RegExp[] = [
  /\byang\s+.+\s+(below|above|di\s+bawah|di\s+atas|kurang\s+dari|lebih\s+dari)\s+[\d.,%]+.*\b(skip|lewat|lewatin)\b/i,
];

// ─── SWAP family ───────────────────────────────────────────────────
//
// "Gak usah pake X, Y aja" — reject method X, prefer method Y. Both
// must be present or it's a preference statement not a swap. Requires
// "pake" specifically so "gak usah pusing" (advice) doesn't collide.
const SWAP_PATTERNS: RegExp[] = [
  /\b(gak|nggak|ga|ngga|tidak)\s+usah\s+pake\s+\S+.*,\s*\S+.*\baja\b/i,
];

// ─── Interrogative / imperative opener guard ────────────────────────
//
// Corpus Q (Philip 2026-09-01) surfaced 6 real false positives where
// question-form sentences containing refinement-adjacent vocabulary
// ("the nearest", "yang paling recommended", "the official store",
// "the non-refundable") absorbed as REFINEMENT. Rule: sentences
// opened by an interrogative marker are ASKING, not REFINING.
//
// Fail-closed: any sentence starting with English question-words
// (What/When/Where/Why/How/Who/Which/Whose), English auxiliary-verb
// yes/no openers (Can/Could/Should/Would/Do/Does/Did/Is/Are/Was/Were
// /Will/May/Might), the imperative "Come X" (Corpus Q family), or
// Indonesian question-word openers (Apa/Apakah/Kapan/Dimana/Kemana
// /Mengapa/Kenapa/Bagaimana/Gimana/Siapa/Mana/Berapa) or Indonesian
// auxiliary/politeness openers (Bisa/Boleh) DOES NOT match refinement.
//
// This does NOT block imperatives like "Show me yang cheaper" (still
// fires as REFINEMENT / comparative), only genuine question forms and
// the "Come X" imperative family which Corpus Q showed is always a
// command/pointer, never a refinement.
// Corpus ADDRESS-INDONESIA guard extension (Philip 2026-09-01):
// allow an optional Indonesian address prefix ("Mas, ..." · "Pak Ahmad, ...")
// before the interrogative marker. Constitutional rule: address terms
// must NEVER become intent signals · therefore they must ALSO not
// block the interrogative guard from recognising a question. Up to 2
// name words allowed after the address term.
const ADDR = String.raw`(?:(?:pak|bapak|bu|ibu|mas|mbak|kak|bang|dek|dik|om|tante)(?:\s+[A-Za-z]+){0,2},\s+)?`;

const INTERROGATIVE_OPENERS: RegExp[] = [
  new RegExp(`^\\s*${ADDR}(what|when|where|why|how|who|which|whose)\\b`, "i"),
  new RegExp(`^\\s*${ADDR}(can|could|should|would|do|does|did|is|are|was|were|will|may|might)\\s+`, "i"),
  new RegExp(`^\\s*${ADDR}come\\s+`, "i"),
  new RegExp(`^\\s*${ADDR}(apa|apakah|kapan|dimana|di\\s+mana|kemana|ke\\s+mana|mengapa|kenapa|bagaimana|gimana|siapa|mana|berapa)\\b`, "i"),
  new RegExp(`^\\s*${ADDR}(bisa|boleh)\\s+`, "i"),
];

// ─── Detector ──────────────────────────────────────────────────────

function tryMatch(msg: string, patterns: RegExp[]): string | undefined {
  for (const rx of patterns) {
    const hit = msg.match(rx);
    if (hit) return hit[0].trim();
  }
  return undefined;
}

/**
 * Detect refinement intent + family. Deterministic · state-free ·
 * fail-closed. Caller composes with session (active vertical /
 * current reference) to decide whether to actually apply the
 * refinement to the goal.
 *
 * Precedence when multiple families match: SKIP_BY_ATTRIBUTE beats
 * EXCLUDE beats SWAP beats COMPARATIVE beats REQUIRE. Ordered so the
 * most SPECIFIC structural signal wins.
 */
export function detectRefinement(message: string): RefinementDetection {
  const m = message.trim();
  if (!m) return { matched: false };

  // Corpus Q guard · interrogative/imperative openers → NOT refinement.
  for (const rx of INTERROGATIVE_OPENERS) {
    if (rx.test(m)) return { matched: false };
  }

  const skipHit = tryMatch(m, SKIP_ATTRIBUTE_PATTERNS);
  if (skipHit) return { matched: true, family: "skip_by_attribute", phrase: skipHit, language: "mix" };

  const excludeHit = tryMatch(m, EXCLUDE_PATTERNS);
  if (excludeHit) return { matched: true, family: "exclude", phrase: excludeHit, language: "id" };

  const swapHit = tryMatch(m, SWAP_PATTERNS);
  if (swapHit) return { matched: true, family: "swap", phrase: swapHit, language: "id" };

  const compHit = tryMatch(m, COMPARATIVE_PATTERNS);
  if (compHit) {
    // Detect language by whether the match is EN or ID form.
    const lang: "en" | "id" = /^(the\s+)?(cheaper|nearer)/i.test(compHit) ? "en" : "id";
    return { matched: true, family: "comparative", phrase: compHit, language: lang };
  }

  const reqHit = tryMatch(m, REQUIRE_PATTERNS);
  if (reqHit) {
    const lang: "en" | "id" | "mix" = /^\bthe\b/i.test(reqHit) ? "en" : "mix";
    return { matched: true, family: "require", phrase: reqHit, language: lang };
  }

  return { matched: false };
}
