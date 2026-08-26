// NEX PHRASE PICKER · Activity → Intent → Personality → Phrase.
//
// Chooses the right thing for NEX to say based on:
//   · target (what UI she's talking about)
//   · intent (what she's trying to do)
//   · user's guidance memory (what she's already said)
//   · tone mix (70% warm · 15% cool · 15% witty · 10% concise · 5% firm)
//
// Doctrine (Philip 2026-08-26): NEX should sound like the same intelligent
// woman · not a random-phrase rotator. The picker is deterministic given
// the same inputs (except for the weighted tone selection which is bounded).

import { PHRASE_LIBRARY } from "./phraseLibrary";
import {
  familiarityFrom,
  type NexIntent,
  type NexPhrase,
  type NexTarget,
  type NexTone,
  TONE_MIX,
} from "./nexPersonality";
import { getTargetMemory, recordPhraseHeard } from "./nexGuidanceMemory";

export interface PickOptions {
  /** Prefer this intent · falls through to related intents if none available. */
  intent?: NexIntent;
  /** Explicit tone override · skips the weighted sampling. */
  tone?: NexTone;
  /** Set to true to bypass the memory dedupe (test / demo usage). */
  ignoreMemory?: boolean;
}

/**
 * Sample a tone from the personality mix. Returns a NexTone name.
 */
function sampleTone(): NexTone {
  const total = Object.values(TONE_MIX).reduce((a, b) => a + b, 0);
  let n = Math.random() * total;
  for (const [tone, weight] of Object.entries(TONE_MIX) as [NexTone, number][]) {
    n -= weight;
    if (n <= 0) return tone;
  }
  return "warm";
}

/**
 * Determine the appropriate intent to bias toward, given user familiarity.
 * New user       · prefer introduce / explain
 * Returning user · prefer familiar / recommend / playful
 * Experienced    · prefer micro / familiar
 */
function biasIntentByFamiliarity(baseIntent: NexIntent, target: NexTarget): NexIntent {
  if (target === "eye-tap") return baseIntent; // eye-tap uses its own escalation
  const t = getTargetMemory(target);
  const fam = familiarityFrom(t.explanationsSeen);
  if (baseIntent === "introduce" || baseIntent === "explain") {
    if (fam === "experienced") return "micro";
    if (fam === "returning")   return "familiar";
  }
  return baseIntent;
}

/**
 * Score a phrase for selection. Higher = better fit.
 */
function scorePhrase(phrase: NexPhrase, wantIntent: NexIntent, wantTone: NexTone, heardIds: Set<string>): number {
  if (phrase.intent !== wantIntent) return -Infinity;
  let score = 10;
  if (heardIds.has(phrase.id)) score -= 20;       // recently heard · avoid
  if (phrase.tone === wantTone) score += 5;       // preferred tone match
  return score;
}

/**
 * Pick the best phrase for the requested target + intent, honouring memory
 * and personality mix. Records the choice as "heard" so the next call
 * respects dedupe.
 */
export function pickPhrase(target: NexTarget, opts: PickOptions = {}): NexPhrase | null {
  const requestedIntent = opts.intent ?? "introduce";
  const intent = biasIntentByFamiliarity(requestedIntent, target);
  const tone   = opts.tone ?? sampleTone();

  const heardIds = opts.ignoreMemory
    ? new Set<string>()
    : new Set(getTargetMemory(target).phrasesHeard);

  // First pass · exact intent match.
  const candidates = PHRASE_LIBRARY.filter((p) => p.target === target && p.intent === intent);
  if (candidates.length === 0) {
    // Fallback · any phrase for this target · use base intent.
    const anyForTarget = PHRASE_LIBRARY.filter((p) => p.target === target);
    if (anyForTarget.length === 0) return null;
    // Pick the least-heard one · deterministic fallback.
    const picked = anyForTarget.slice().sort((a, b) =>
      (heardIds.has(a.id) ? 1 : 0) - (heardIds.has(b.id) ? 1 : 0),
    )[0];
    recordPhraseHeard(target, picked.id, picked.tone);
    return picked;
  }

  // Score all candidates · pick highest scoring · random tiebreak.
  const scored = candidates
    .map((p) => ({ p, score: scorePhrase(p, intent, tone, heardIds) }))
    .sort((a, b) => b.score - a.score || (Math.random() - 0.5));

  const winner = scored[0]?.p;
  if (!winner) return null;
  if (!opts.ignoreMemory) recordPhraseHeard(target, winner.id, winner.tone);
  return winner;
}
