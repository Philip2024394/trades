// src/lib/nex/context-management/types.ts
//
// WAVE-P-1.4 · GAP-4 · Context window overflow handling
// Founder BEGIN WAVE-P-1 · 2026-09-08
//
// Sliding window · summarization anchor · cache breakpoint discipline.
// Self-sustainment doctrine: primary target is any Ollama-served model
// with generous context. Anthropic prompt-cache semantics supported for
// the opt-in fallback case only.

import type { NexMessage } from "@/lib/nex/brain/provider";

// ═══════════════════════════════════════════════════════════════════
// § A · TRUNCATION STRATEGY
// ═══════════════════════════════════════════════════════════════════

export type TruncationStrategy =
  | "sliding_window"           // keep last N tokens · drop oldest
  | "sliding_window_with_anchors"  // keep last N + preserved anchor messages
  | "summarize_and_replace"    // replace old block with generated summary
  | "hybrid_anchor_summarize"  // anchors preserved · middle summarized · tail kept
  | "none";                    // no truncation · caller manages

/** Anchor selection rule · which messages must always survive truncation. */
export type AnchorRule =
  | { kind: "first_n_user_messages"; n: number }         // opening context
  | { kind: "last_n_user_messages"; n: number }          // recent intent
  | { kind: "system_prompt" }                            // always preserved
  | { kind: "tagged_pinned" };                           // caller-tagged messages

// ═══════════════════════════════════════════════════════════════════
// § B · CONTEXT BUDGET
// ═══════════════════════════════════════════════════════════════════

/** Budget for a single request. Token counts are approximations
 *  (1 token ≈ 4 chars heuristic) unless a real tokenizer is wired in. */
export type ContextBudget = {
  max_input_tokens: number;             // hard ceiling for input side
  reserve_for_output_tokens: number;    // subtract from max before packing
  headroom_fraction: number;            // e.g. 0.10 · leave 10% for tokenizer variance
};

export const DEFAULT_CONTEXT_BUDGET: ContextBudget = {
  max_input_tokens: 32_000,
  reserve_for_output_tokens: 4_096,
  headroom_fraction: 0.10,
};

// ═══════════════════════════════════════════════════════════════════
// § C · CACHE BREAKPOINT DISCIPLINE (Anthropic-compatible)
// ═══════════════════════════════════════════════════════════════════

/** Anthropic prompt caching: max 4 breakpoints per request · min 512-4096
 *  tokens per cacheable segment · 20-block lookback. Even when NEX uses
 *  Ollama primary · this discipline is preserved for the opt-in fallback
 *  case. */
export const MAX_CACHE_BREAKPOINTS = 4;
export const MIN_CACHEABLE_TOKENS = 512;

export type CacheBreakpoint = {
  /** Where in the message list the breakpoint sits. */
  message_index: number;
  /** Tokens accumulated up to (and including) this breakpoint. */
  cumulative_tokens: number;
  /** Semantic reason · used for debugging + telemetry · never affects behavior. */
  reason: "system_prompt_end" | "conversation_start_stable" | "large_context_block" | "manual";
};

// ═══════════════════════════════════════════════════════════════════
// § D · TRUNCATION RESULT (what the packer returns)
// ═══════════════════════════════════════════════════════════════════

export type TruncationResult = {
  packed_messages: readonly NexMessage[];
  /** Messages dropped without replacement · lost information · caller
   *  should be aware. */
  dropped_message_count: number;
  /** Messages replaced by a generated summary · summary itself IS in
   *  packed_messages. */
  summarized_message_count: number;
  /** Anchor messages preserved through truncation. */
  anchor_message_count: number;
  input_tokens_estimated: number;
  input_tokens_budget: number;
  strategy_used: TruncationStrategy;
  cache_breakpoints: readonly CacheBreakpoint[];
  /** Explicit honesty flag · did we lose material information? */
  information_lost: boolean;
  /** Human-readable notes about what was dropped/summarized. */
  notes: string;
};
