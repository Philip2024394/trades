// Universal Intent classifier.
//
// Given a user's natural-language input, returns Layer 1 (verb) + Layer 2 (domain)
// + Layer 3 (capability) + confidence score. Uses token-Jaccard + verb-keyword
// fallback. Never guesses at low confidence — <0.7 → caller must ask (Brain 14).
//
// Doctrine: docs/brains/nex-master-intent-library-v1-philip-2026-08-03.md
// Runtime layer: composes with existing src/lib/nex/intent-router.ts (kind)
// as an orthogonal dimension (verb).

import type { IntentClassification, UniversalVerb, PhrasingRow } from "./types";
import { loadPhrasings } from "./phrasings";

/** Verb-signal keywords used as a fallback when no phrasing is close enough. */
const VERB_KEYWORDS: Record<UniversalVerb, string[]> = {
  Create:      ["create", "build", "make", "design", "generate", "write", "produce", "compose", "start"],
  Communicate: ["reply", "send", "write", "email", "message", "text", "notify", "thank", "translate", "answer"],
  Decide:      ["compare", "vs", "which", "or", "best", "choose", "help me pick", "decide", "rank"],
  Plan:        ["plan", "organise", "organize", "schedule", "prepare", "roadmap", "timeline", "itinerary"],
  Manage:      ["manage", "track", "add", "update", "organise my", "organize my", "store", "record"],
  Automate:    ["automate", "auto", "every monday", "every day", "every week", "recurring", "schedule for", "post automatically", "auto reply"],
  Analyse:     ["why", "show my", "which", "compare", "trend", "dashboard", "performance", "analyse", "analyze", "report"],
  Learn:       ["teach me", "explain", "how do i", "what is", "what's the", "define", "summarise", "summarize"],
  Improve:     ["improve", "increase", "reduce", "grow", "boost", "optimise", "optimize", "get more", "sell more"],
  Monitor:     ["remind me", "alert me", "watch", "notify me when", "track my", "warning", "expiry"],
};

/** Tokenise a phrase: lower · alphanumeric words · strip stopwords. */
function tokenise(s: string): Set<string> {
  const STOP = new Set(["a", "an", "the", "my", "our", "i", "we", "to", "for", "of", "in", "on", "at", "and", "or", "please", "nex", "me"]);
  const toks = s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  return new Set(toks.filter((t) => !STOP.has(t)));
}

/** Jaccard similarity between two token sets. */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersect = 0;
  for (const t of a) if (b.has(t)) intersect++;
  const union = a.size + b.size - intersect;
  return union === 0 ? 0 : intersect / union;
}

/** Rank the corpus rows by Jaccard similarity to the input. */
function rankByPhrasing(input: string, corpus: PhrasingRow[]): Array<{ row: PhrasingRow; score: number }> {
  const inputTokens = tokenise(input);
  return corpus
    .map((row) => ({ row, score: jaccard(inputTokens, tokenise(row.phrasing)) }))
    .sort((a, b) => b.score - a.score);
}

/** Verb-keyword fallback: pick the verb whose keyword list overlaps the input most. */
function fallbackVerb(input: string): { verb: UniversalVerb; score: number } {
  const lower = input.toLowerCase();
  let bestVerb: UniversalVerb = "Learn";
  let bestScore = 0;
  for (const [verb, kws] of Object.entries(VERB_KEYWORDS) as [UniversalVerb, string[]][]) {
    for (const kw of kws) {
      if (lower.includes(kw)) {
        const score = kw.length / lower.length; // longer keywords weigh more
        if (score > bestScore) {
          bestScore = score;
          bestVerb = verb;
        }
      }
    }
  }
  return { verb: bestVerb, score: Math.min(0.6, 0.3 + bestScore) };
}

/** Public classify function. Never throws. Always returns a classification. */
export function classifyUniversalIntent(input: string): IntentClassification {
  const original = input.trim();
  if (!original) {
    return {
      layer1_verb: "Learn",
      layer2_domain: "General",
      layer3_capability: "Answer",
      confidence: 0,
      matched_phrasing: null,
      original,
      reason: "empty input",
    };
  }

  const corpus = loadPhrasings();
  const ranked = rankByPhrasing(original, corpus);
  const top = ranked[0];

  // High-confidence match against the corpus.
  if (top && top.score >= 0.5) {
    return {
      layer1_verb: top.row.layer1_verb,
      layer2_domain: top.row.layer2_domain,
      layer3_capability: top.row.layer3_capability,
      confidence: Math.min(0.98, top.score + 0.35), // corpus match adds baseline confidence
      matched_phrasing: top.row.phrasing,
      original,
      reason: `Matched corpus phrasing "${top.row.phrasing}" (jaccard=${top.score.toFixed(2)})`,
    };
  }

  // Medium confidence — corpus had a partial match; combine with verb-keyword fallback.
  if (top && top.score >= 0.25) {
    const fallback = fallbackVerb(original);
    return {
      layer1_verb: top.row.layer1_verb,
      layer2_domain: top.row.layer2_domain,
      layer3_capability: top.row.layer3_capability,
      confidence: Math.max(top.score + 0.2, fallback.score),
      matched_phrasing: top.row.phrasing,
      original,
      reason: `Partial corpus match "${top.row.phrasing}" (jaccard=${top.score.toFixed(2)}); fallback verb=${fallback.verb}`,
    };
  }

  // Low confidence — keyword-only fallback. Caller MUST ask (Brain 14) if <0.7.
  const fallback = fallbackVerb(original);
  return {
    layer1_verb: fallback.verb,
    layer2_domain: "General",
    layer3_capability: "Answer",
    confidence: fallback.score,
    matched_phrasing: null,
    original,
    reason: `No corpus match; keyword-fallback verb=${fallback.verb} score=${fallback.score.toFixed(2)}`,
  };
}
