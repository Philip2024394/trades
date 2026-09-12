// src/lib/nex/context-management/sliding-window.ts
//
// WAVE-P-1.4 · Sliding-window packing with optional anchors
// Founder BEGIN WAVE-P-1 · 2026-09-08
//
// Deterministic · pure. Given messages + budget + anchor rule, pack the
// tail of the conversation up to the budget · preserving anchors first.

import type { NexMessage, NexContentBlock } from "@/lib/nex/brain/provider";
import type {
  AnchorRule,
  ContextBudget,
  TruncationResult,
} from "./types";
import { DEFAULT_CONTEXT_BUDGET } from "./types";

/** 1 token ≈ 4 chars · standard OpenAI/Anthropic guidance. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function estimateMessageTokens(msg: NexMessage): number {
  if (typeof msg.content === "string") return estimateTokens(msg.content);
  let sum = 0;
  for (const b of msg.content) {
    sum += estimateContentBlockTokens(b);
  }
  return sum;
}

function estimateContentBlockTokens(b: NexContentBlock): number {
  switch (b.type) {
    case "text":
    case "thinking":
      return estimateTokens(b.text);
    case "tool_result":
      return estimateTokens(b.result);
    case "tool_call":
      return estimateTokens(JSON.stringify(b.input));
    case "image_url":
      // Rough constant · vision costs are provider-specific
      return 1000;
  }
}

// ─── Anchor identification ──────────────────────────────────────

export function identifyAnchorIndices(messages: readonly NexMessage[], rules: readonly AnchorRule[]): Set<number> {
  const set = new Set<number>();
  const userIndices = messages
    .map((m, i) => ({ m, i }))
    .filter((x) => x.m.role === "user")
    .map((x) => x.i);

  for (const rule of rules) {
    if (rule.kind === "first_n_user_messages") {
      for (let k = 0; k < Math.min(rule.n, userIndices.length); k++) set.add(userIndices[k]);
    } else if (rule.kind === "last_n_user_messages") {
      for (let k = 0; k < Math.min(rule.n, userIndices.length); k++) set.add(userIndices[userIndices.length - 1 - k]);
    } else if (rule.kind === "tagged_pinned") {
      // Convention: pinned messages carry meta via content array first block with a marker string
      messages.forEach((m, i) => {
        if (Array.isArray(m.content) && m.content.length > 0) {
          const first = m.content[0];
          if (first.type === "text" && /\[NEX_PINNED\]/.test(first.text)) set.add(i);
        }
      });
    }
    // system_prompt handled separately (it's NOT in messages · lives in NexChatInput.systemPrompt)
  }
  return set;
}

// ─── Pack messages within budget ────────────────────────────────

export function packWithSlidingWindow(input: {
  messages: readonly NexMessage[];
  system_prompt_tokens: number;    // caller estimates · counted against budget
  budget?: ContextBudget;
  anchor_rules?: readonly AnchorRule[];
}): TruncationResult {
  const budget = input.budget ?? DEFAULT_CONTEXT_BUDGET;
  const rules = input.anchor_rules ?? [];
  const anchorIndices = identifyAnchorIndices(input.messages, rules);

  const effective_budget = Math.floor(
    (budget.max_input_tokens - budget.reserve_for_output_tokens) * (1 - budget.headroom_fraction),
  ) - input.system_prompt_tokens;

  if (effective_budget <= 0) {
    return {
      packed_messages: [],
      dropped_message_count: input.messages.length,
      summarized_message_count: 0,
      anchor_message_count: 0,
      input_tokens_estimated: input.system_prompt_tokens,
      input_tokens_budget: budget.max_input_tokens,
      strategy_used: "sliding_window_with_anchors",
      cache_breakpoints: [],
      information_lost: input.messages.length > 0,
      notes: `system_prompt (${input.system_prompt_tokens} tok) exceeds budget · no messages packed`,
    };
  }

  // Pass 1 · pack anchors first (they always survive)
  const anchor_msgs: { idx: number; tokens: number; msg: NexMessage }[] = [];
  let tokens_used = 0;
  for (const idx of Array.from(anchorIndices).sort((a, b) => a - b)) {
    const m = input.messages[idx];
    const t = estimateMessageTokens(m);
    if (tokens_used + t > effective_budget) break; // anchor doesn't fit · abandon rest
    anchor_msgs.push({ idx, tokens: t, msg: m });
    tokens_used += t;
  }
  const packed_anchor_indices = new Set(anchor_msgs.map((a) => a.idx));

  // Pass 2 · fill from the tail with non-anchor messages
  const tail_msgs: { idx: number; tokens: number; msg: NexMessage }[] = [];
  for (let i = input.messages.length - 1; i >= 0; i--) {
    if (packed_anchor_indices.has(i)) continue;
    const m = input.messages[i];
    const t = estimateMessageTokens(m);
    if (tokens_used + t > effective_budget) break;
    tail_msgs.unshift({ idx: i, tokens: t, msg: m });
    tokens_used += t;
  }

  // Assemble in original order
  const combined = [...anchor_msgs, ...tail_msgs].sort((a, b) => a.idx - b.idx);
  const packed = combined.map((c) => c.msg);
  const dropped = input.messages.length - combined.length;

  return {
    packed_messages: packed,
    dropped_message_count: dropped,
    summarized_message_count: 0,
    anchor_message_count: anchor_msgs.length,
    input_tokens_estimated: tokens_used + input.system_prompt_tokens,
    input_tokens_budget: budget.max_input_tokens,
    strategy_used: rules.length > 0 ? "sliding_window_with_anchors" : "sliding_window",
    cache_breakpoints: [],
    information_lost: dropped > 0,
    notes: dropped > 0
      ? `Dropped ${dropped} message(s) to fit ${effective_budget}-token budget · ${anchor_msgs.length} anchor(s) preserved`
      : "All messages packed within budget",
  };
}
