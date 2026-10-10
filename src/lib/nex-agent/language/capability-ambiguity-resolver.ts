// src/lib/nex-agent/language/capability-ambiguity-resolver.ts
//
// NEX1 · Agent 10 · Ambiguity Resolver · 2026-09-17.
// Founder-authorised (frontier doctrine · smallest first slice).
//
// PURPOSE
//   When the classifier is mid-confidence (0.30 - 0.75) OR the top two intent
//   candidates are within a narrow score band, DON'T refuse and DON'T guess.
//   Instead offer the founder 2-3 concrete interpretations so a single click /
//   quick rephrase resolves the ambiguity.
//
// WHY IT IS NOT JUST A CLASSIFIER PATCH
//   The existing classifier returns top-1 with a confidence. When two intents
//   both score similarly (e.g. "make it faster" scores refactor 0.55 and
//   fix_bug 0.50) the top-1 flow silently picks refactor. This module scores
//   ALL registry intents deterministically and returns the top-K so the founder
//   sees the real ambiguity and picks. Zero LLM · zero randomness.
//
// SAFETY / SCOPE
//   · No source modification.
//   · Read-only against the CODE_INTENT_REGISTRY.
//   · Runs only when the classifier would otherwise refuse.
//   · Never executes anything · always emits a clarifying step.
//   · Deterministic scoring · same prompt → same options every time.
//
// PIPELINE POSITION
//   orchestrator → classify → confidence < 0.55 → detectAmbiguity() → if
//   should_clarify then emit "ambiguity_clarification" handoff with options,
//   set task.status = "clarifying", return. Else fall through to existing
//   refuse-with-generic-question flow.

import { CODE_INTENT_REGISTRY } from "./code-intent-registry";
import type { DomainIntent } from "@/lib/nex/language/types";
import { isChatOnlyIntent } from "./capability-nex1-persona";

export interface ScoredIntent {
  readonly slug: string;
  readonly display: string;
  readonly score: number;                 // final composite score · [0, 1]
  readonly base_confidence: number;       // intent.confidence_base
  readonly matched_tokens: readonly string[];
  readonly matched_phrases: readonly string[];
  readonly reply_template: string;
  readonly is_chat_only: boolean;
}

export interface AmbiguityOption {
  readonly id: "A" | "B" | "C" | "D";
  readonly slug: string;
  readonly display: string;
  readonly preview: string;               // human-readable "if you meant this, I would…"
}

export interface AmbiguityResult {
  readonly should_clarify: boolean;
  readonly reason: "clear_winner" | "too_vague" | "chat_dominant" | "ambiguous";
  readonly primary: ScoredIntent | null;
  readonly alternates: readonly ScoredIntent[];
  readonly options: readonly AmbiguityOption[];
  readonly text: string;                  // formatted question for the founder
  readonly zero_llm: true;
}

// ─── Configuration · founder-tunable constants ─────────────────────────────
// These describe the "ambiguity zone". Outside this zone we defer to the
// existing pipeline (either confident coding, chat short-circuit, or the
// existing refuse-with-example behaviour). Inside the zone we clarify.
const CFG = Object.freeze({
  // Top-1 score BELOW this means the prompt is too vague · fall back.
  // Single-token match on a strong trigger scores ~0.35 (see scoreIntent
  // below · TOKEN_WEIGHT × 1 saturating term). Anything under 0.20 is noise.
  TOO_VAGUE_MAX: 0.20,
  // Top-1 score ABOVE this means we already have a clear winner · fall through.
  CLEAR_WINNER_MIN: 0.75,
  // Top-1 minus Top-2 gap ABOVE this means the winner is clear enough.
  DECISIVE_GAP: 0.25,
  // Max alternates surfaced to the founder (plus "something else").
  MAX_ALTERNATES: 3,
  // Trigger-token match weight vs phrase-match weight in the score composition.
  // A single matched token contributes TOKEN_WEIGHT to `signal`. Two tokens
  // = 2 × TOKEN_WEIGHT (capped at 1). One phrase = PHRASE_WEIGHT.
  TOKEN_WEIGHT: 0.35,
  PHRASE_WEIGHT: 0.55,
  // Contribution of intent.confidence_base to the final score.
  BASE_CONFIDENCE_WEIGHT: 0.3,
} as const);

// ─── Scoring · deterministic · O(intents × triggers) ───────────────────────

const WORD_BOUNDARY_CACHE = new Map<string, RegExp>();
function wordBoundaryRE(tok: string): RegExp {
  const key = tok.toLowerCase();
  let re = WORD_BOUNDARY_CACHE.get(key);
  if (!re) {
    // Escape regex specials then wrap in word boundaries.
    const esc = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    re = new RegExp(`(^|\\W)${esc}(\\W|$)`, "i");
    WORD_BOUNDARY_CACHE.set(key, re);
  }
  return re;
}

function normalisePrompt(prompt: string): { lower: string; tokens: string[] } {
  const lower = prompt.trim().toLowerCase();
  const tokens = lower.split(/\W+/).filter((t) => t.length > 0);
  return { lower, tokens };
}

/**
 * Score a single intent against the prompt.
 * Composite score = (token-hit-rate * TOKEN_WEIGHT + phrase-hit-rate * PHRASE_WEIGHT)
 *                   * (1 - BASE_CONFIDENCE_WEIGHT) + confidence_base * BASE_CONFIDENCE_WEIGHT
 * Result clamped to [0, 1].
 */
export function scoreIntent(prompt: string, intent: DomainIntent): ScoredIntent {
  const { lower, tokens } = normalisePrompt(prompt);
  const matched_tokens: string[] = [];
  const matched_phrases: string[] = [];

  // Token matching · word-boundary regex against the raw prompt.
  const triggerTokens = intent.trigger_tokens ?? [];
  for (const tt of triggerTokens) {
    if (wordBoundaryRE(tt).test(lower)) matched_tokens.push(tt);
  }
  // Phrase matching · substring against the space-normalised prompt.
  const triggerPhrases = intent.trigger_phrases ?? [];
  for (const tp of triggerPhrases) {
    if (lower.includes(tp.toLowerCase())) matched_phrases.push(tp);
  }

  // Saturating hit rate · a single strong match already scores TOKEN_WEIGHT.
  // Formula: 1 - (1 - w)^n where n = matched count. n=1 gives w; n=2 gives
  // 1-(1-w)^2. Bounded to [0, 1]. Rewards distinctiveness, not coverage.
  const tokenHitRate = matched_tokens.length > 0
    ? 1 - Math.pow(1 - CFG.TOKEN_WEIGHT, matched_tokens.length)
    : 0;
  const phraseHitRate = matched_phrases.length > 0
    ? 1 - Math.pow(1 - CFG.PHRASE_WEIGHT, matched_phrases.length)
    : 0;

  // If NO signal at all · score is zero.
  if (matched_tokens.length === 0 && matched_phrases.length === 0) {
    return {
      slug: intent.slug,
      display: intent.display,
      score: 0,
      base_confidence: intent.confidence_base ?? 0.5,
      matched_tokens: [],
      matched_phrases: [],
      reply_template: intent.reply_template ?? "",
      is_chat_only: isChatOnlyIntent(intent.slug),
    };
  }

  // signal is the max of token/phrase hit rates (either channel alone can win).
  const signal = Math.max(tokenHitRate, phraseHitRate);
  const base = intent.confidence_base ?? 0.5;
  const composite = signal * (1 - CFG.BASE_CONFIDENCE_WEIGHT) + base * CFG.BASE_CONFIDENCE_WEIGHT;

  // Length penalty for very short prompts (they carry less certainty).
  const lengthPenalty = tokens.length <= 1 ? 0.15 : 0;
  const finalScore = Math.max(0, Math.min(1, composite - lengthPenalty));

  return {
    slug: intent.slug,
    display: intent.display,
    score: finalScore,
    base_confidence: base,
    matched_tokens,
    matched_phrases,
    reply_template: intent.reply_template ?? "",
    is_chat_only: isChatOnlyIntent(intent.slug),
  };
}

/**
 * Score every intent in the registry. Returns descending by score.
 * Deterministic · zero randomness · O(registry × triggers).
 */
export function scoreAllIntents(prompt: string): ScoredIntent[] {
  const scored: ScoredIntent[] = [];
  for (const intent of CODE_INTENT_REGISTRY) scored.push(scoreIntent(prompt, intent));
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

// ─── Ambiguity detection ────────────────────────────────────────────────────

function shortPreview(reply_template: string): string {
  const clean = reply_template.replace(/\{summary\}/g, "…").replace(/\s+/g, " ").trim();
  return clean.length > 90 ? clean.slice(0, 88).trimEnd() + "…" : clean;
}

/**
 * Decide whether the current prompt is in the ambiguity zone.
 * Returns AmbiguityResult with should_clarify=true only when clarifying will
 * actually help the founder pick between real candidate interpretations.
 *
 * Rules (all must be satisfied for should_clarify=true):
 *   R1 · top-1 score > TOO_VAGUE_MAX      (something matched)
 *   R2 · top-1 score < CLEAR_WINNER_MIN   (not confident enough)
 *   R3 · top-1 - top-2 < DECISIVE_GAP     (real competition, not runaway winner)
 *   R4 · top-1 must not be chat-only      (chat intents have their own path)
 *   R5 · at least 2 competing intents scored > TOO_VAGUE_MAX
 */
export function detectAmbiguity(prompt: string): AmbiguityResult {
  const empty: AmbiguityResult = {
    should_clarify: false,
    reason: "too_vague",
    primary: null,
    alternates: [],
    options: [],
    text: "",
    zero_llm: true,
  };
  if (!prompt || !prompt.trim()) return empty;

  const scored = scoreAllIntents(prompt);
  const top = scored[0];
  const second = scored[1];

  if (!top || top.score <= 0) return empty;

  // R1
  if (top.score <= CFG.TOO_VAGUE_MAX) {
    return { ...empty, reason: "too_vague", primary: top };
  }
  // R2
  if (top.score >= CFG.CLEAR_WINNER_MIN) {
    return { ...empty, reason: "clear_winner", primary: top };
  }
  // R3
  const gap = top.score - (second?.score ?? 0);
  if (gap >= CFG.DECISIVE_GAP) {
    return { ...empty, reason: "clear_winner", primary: top };
  }
  // R4 · chat-only intents don't need ambiguity resolution — persona handles them.
  if (top.is_chat_only) {
    return { ...empty, reason: "chat_dominant", primary: top };
  }
  // R5
  const competing = scored.filter((s) => s.score > CFG.TOO_VAGUE_MAX && !s.is_chat_only);
  if (competing.length < 2) {
    return { ...empty, reason: "clear_winner", primary: top };
  }

  // Ambiguity confirmed · build the options list.
  const alternates = competing.slice(0, CFG.MAX_ALTERNATES);
  const optionIds: Array<"A" | "B" | "C" | "D"> = ["A", "B", "C", "D"];
  const options: AmbiguityOption[] = alternates.map((s, i) => ({
    id: optionIds[i]!,
    slug: s.slug,
    display: s.display,
    preview: shortPreview(s.reply_template),
  }));
  // Add "something else" as the final option.
  const elseId = optionIds[Math.min(options.length, optionIds.length - 1)]!;
  const elseOption: AmbiguityOption = {
    id: elseId,
    slug: "unknown",
    display: "Something else",
    preview: "Rephrase in one sentence and I'll try again.",
  };
  const allOptions = [...options, elseOption];

  const lines = ["I'm close · which did you mean?"];
  for (const opt of allOptions) {
    lines.push(`  (${opt.id}) ${opt.display} · ${opt.preview}`);
  }
  lines.push("");
  lines.push("Reply with the letter (A/B/C…) or rephrase in your own words.");

  return {
    should_clarify: true,
    reason: "ambiguous",
    primary: top,
    alternates,
    options: allOptions,
    text: lines.join("\n"),
    zero_llm: true,
  };
}

// ─── Public convenience · tri-state entry ──────────────────────────────────
export type AmbiguityDecision = "clarify" | "proceed" | "refuse";
export interface AmbiguityEntry {
  readonly decision: AmbiguityDecision;
  readonly result: AmbiguityResult;
}

/**
 * Callable from the orchestrator. Returns a tri-state decision:
 *   · clarify  → emit ambiguity handoff · task stays clarifying
 *   · proceed  → confidence is high enough OR chat handled elsewhere
 *   · refuse   → prompt is too vague · fall through to existing refuse UX
 */
export function classifyAmbiguity(prompt: string): AmbiguityEntry {
  const result = detectAmbiguity(prompt);
  const decision: AmbiguityDecision =
    result.should_clarify ? "clarify" :
    result.reason === "clear_winner" || result.reason === "chat_dominant" ? "proceed" :
    "refuse";
  return { decision, result };
}
