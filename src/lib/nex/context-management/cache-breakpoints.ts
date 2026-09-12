// src/lib/nex/context-management/cache-breakpoints.ts
//
// WAVE-P-1.4 · Anthropic-compatible cache breakpoint placement
// Founder BEGIN WAVE-P-1 · 2026-09-08
//
// Discipline (Anthropic prompt caching):
//   · Max 4 breakpoints per request
//   · Min ~512 tokens per cacheable segment (varies by model 512-4096)
//   · 20-block lookback
//   · Break on STABLE boundaries · not per-request timestamps
//
// This module places breakpoints deterministically so identical input
// produces identical cache hits. Applies even under Ollama-primary
// because prompt caching semantics also help vLLM/llama.cpp KV cache
// reuse.

import type { NexMessage } from "@/lib/nex/brain/provider";
import type { CacheBreakpoint } from "./types";
import { MAX_CACHE_BREAKPOINTS, MIN_CACHEABLE_TOKENS } from "./types";
import { estimateMessageTokens } from "./sliding-window";

/** Given the pipeline (system prompt + messages) · propose cache
 *  breakpoints. Deterministic. Never places more than MAX_CACHE_BREAKPOINTS. */
export function proposeCacheBreakpoints(input: {
  system_prompt_tokens: number;
  messages: readonly NexMessage[];
  /** Per-model minimum · overrides the union default when known. */
  min_cacheable_tokens?: number;
}): CacheBreakpoint[] {
  const min_seg = input.min_cacheable_tokens ?? MIN_CACHEABLE_TOKENS;
  const out: CacheBreakpoint[] = [];

  // Breakpoint 1 · always at end of system prompt if it exceeds min_seg
  if (input.system_prompt_tokens >= min_seg) {
    out.push({
      message_index: -1, // sentinel · before message 0
      cumulative_tokens: input.system_prompt_tokens,
      reason: "system_prompt_end",
    });
  }

  // Walk messages · accumulate tokens · place breakpoints at stable
  // conversation-milestone boundaries (after N user turns · after a
  // large block · etc.).
  let cumulative = input.system_prompt_tokens;
  let last_breakpoint_tokens = out.length > 0 ? out[out.length - 1].cumulative_tokens : 0;

  for (let i = 0; i < input.messages.length; i++) {
    const m = input.messages[i];
    const t = estimateMessageTokens(m);
    cumulative += t;

    if (out.length >= MAX_CACHE_BREAKPOINTS) break;

    // Only break AFTER assistant turns (stable content · user turns
    // change rapidly). Also require min segment size since last break.
    const segment_size = cumulative - last_breakpoint_tokens;
    if (m.role === "assistant" && segment_size >= min_seg && i < input.messages.length - 1) {
      // Determine reason
      const reason = t >= min_seg ? "large_context_block" : "conversation_start_stable";
      out.push({
        message_index: i,
        cumulative_tokens: cumulative,
        reason,
      });
      last_breakpoint_tokens = cumulative;
    }
  }

  return out;
}

/** Deterministic stable hash of the cache prefix · lets caller detect
 *  when the cached prefix has changed and invalidate downstream logic. */
export function cachePrefixFingerprint(input: {
  system_prompt: string;
  cached_prefix?: string;
}): string {
  // Simple FNV-like hash · deterministic · no crypto (fingerprint · not security)
  const s = (input.system_prompt ?? "") + "|" + (input.cached_prefix ?? "");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
