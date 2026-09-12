// src/lib/nex/language/intent-parser.ts
//
// Founder BEGIN 2026-09-10 · deterministic intent parser for the NEX language
// engine. Given a normalised utterance + a set of domain intents, score each
// intent by trigger-token overlap, return the top match + confidence.
//
// Zero LLM. Explainable · returns the exact triggers that fired.

import type { DomainIntent, IntentResolution } from "./types";
import { normalise, type NormaliserOptions } from "./normaliser";

export interface ParseOptions extends NormaliserOptions {
  intents: readonly DomainIntent[];
  minConfidence?: number;
}

export function parseIntent(raw: string, opts: ParseOptions): IntentResolution {
  const normResult = normalise(raw, opts);
  const canonSet = new Set(normResult.canonical_tokens);
  const canonJoined = ` ${normResult.canonical_tokens.join(" ")} `;
  // Also keep the raw lowercased text for phrase matching · normaliser strips
  // stopwords ("is", "does", "a", "the") so phrases like "what is" won't
  // survive canonicalisation. Phrase matching on the raw catches them.
  const rawLower = ` ${String(raw ?? "").toLowerCase().replace(/[.,;!?"'`()\[\]{}—–]/g, " ").replace(/\s+/g, " ").trim()} `;
  // Track which surface phrases were already substituted by the normaliser
  // so we don't double-count them when phrase-matching against rawLower.
  const substitutedFroms = new Set(normResult.substitutions.map(s => s.from));

  const candidate_intents: { slug: string; score: number }[] = [];
  let best: DomainIntent | null = null;
  let bestTriggers: string[] = [];
  let bestScore = 0;

  // Scoring model · match count × confidence_base · soft-capped at 3 matches
  // giving full weight. Intents with more trigger vocab are NOT punished —
  // they're just easier to hit. Phrases weigh 1.5× a single token match.
  // Phrase check runs against BOTH the canonicalised token stream and the raw
  // lowered text · the raw check catches phrases containing stopwords like
  // "what is" that the canonicaliser strips.
  for (const intent of opts.intents) {
    let matchCount = 0;
    const matches: string[] = [];
    for (const t of intent.trigger_tokens) {
      if (canonSet.has(t)) { matchCount += 1; matches.push(t); }
    }
    for (const p of (intent.trigger_phrases ?? [])) {
      const hitCanon = canonJoined.includes(` ${p} `);
      // Only credit the rawLower path when the phrase wasn't already handled
      // by an alias substitution · otherwise we'd score both the alias'd
      // token AND the raw phrase, inflating slang-heavy intents.
      const hitRaw = !hitCanon && !substitutedFroms.has(p) && rawLower.includes(` ${p} `);
      if (hitCanon || hitRaw) { matchCount += 1.5; matches.push(p); }
    }
    if (matchCount === 0) continue;
    const confidence = Math.min(1, (matchCount / 3) * intent.confidence_base);
    candidate_intents.push({ slug: intent.slug, score: Number(confidence.toFixed(3)) });
    if (confidence > bestScore) {
      bestScore = confidence;
      best = intent;
      bestTriggers = matches;
    }
  }

  candidate_intents.sort((a, b) => b.score - a.score);

  const minConf = opts.minConfidence ?? 0.15;
  const resolved = best && bestScore >= minConf ? best : null;

  return {
    domain: resolved?.domain ?? null,
    intent_slug: resolved?.slug ?? null,
    confidence: Number(bestScore.toFixed(3)),
    trigger_matches: bestTriggers,
    candidate_intents,
    raw_normalisation: normResult,
  };
}

export function composeReply(intent: DomainIntent, vars: Record<string, string>): string {
  return intent.reply_template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}
