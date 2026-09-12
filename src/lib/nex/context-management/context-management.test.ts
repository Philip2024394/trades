// src/lib/nex/context-management/context-management.test.ts
//
// WAVE-P-1.4 · Context management contract tests
// Founder BEGIN WAVE-P-1 · 2026-09-08

import { describe, it, expect } from "vitest";
import type { NexMessage } from "@/lib/nex/brain/provider";
import { estimateTokens, estimateMessageTokens, identifyAnchorIndices, packWithSlidingWindow } from "./sliding-window";
import { deterministicSummarizer, packWithHybridSummary } from "./summarization-anchor";
import { proposeCacheBreakpoints, cachePrefixFingerprint } from "./cache-breakpoints";
import { MAX_CACHE_BREAKPOINTS, MIN_CACHEABLE_TOKENS } from "./types";

// ─── ESTIMATE ────────────────────────────────────────────────

describe("§P14-ESTIMATE · token estimation", () => {
  it("estimateTokens = ceil(chars/4)", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abc")).toBe(1);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2);
  });

  it("estimateMessageTokens handles string content", () => {
    expect(estimateMessageTokens({ role: "user", content: "hello world" })).toBeGreaterThan(0);
  });

  it("estimateMessageTokens handles content-block array", () => {
    const m: NexMessage = { role: "assistant", content: [
      { type: "text", text: "some text here" },
      { type: "tool_call", toolId: "t1", toolName: "search", input: { q: "abc" } },
    ]};
    expect(estimateMessageTokens(m)).toBeGreaterThan(0);
  });
});

// ─── ANCHORS ─────────────────────────────────────────────────

describe("§P14-ANCHORS · identification rules", () => {
  it("first_n_user_messages picks earliest user turns", () => {
    const msgs: NexMessage[] = [
      { role: "user", content: "u1" },
      { role: "assistant", content: "a1" },
      { role: "user", content: "u2" },
      { role: "user", content: "u3" },
    ];
    const s = identifyAnchorIndices(msgs, [{ kind: "first_n_user_messages", n: 2 }]);
    expect(Array.from(s).sort((a, b) => a - b)).toEqual([0, 2]);
  });

  it("last_n_user_messages picks latest user turns", () => {
    const msgs: NexMessage[] = [
      { role: "user", content: "u1" }, { role: "user", content: "u2" }, { role: "user", content: "u3" },
    ];
    const s = identifyAnchorIndices(msgs, [{ kind: "last_n_user_messages", n: 2 }]);
    expect(Array.from(s).sort((a, b) => a - b)).toEqual([1, 2]);
  });

  it("tagged_pinned picks NEX_PINNED-marked messages", () => {
    const msgs: NexMessage[] = [
      { role: "user", content: "u1" },
      { role: "user", content: [{ type: "text", text: "[NEX_PINNED] critical instruction" }] },
      { role: "user", content: "u3" },
    ];
    const s = identifyAnchorIndices(msgs, [{ kind: "tagged_pinned" }]);
    expect(Array.from(s)).toEqual([1]);
  });
});

// ─── SLIDING WINDOW ──────────────────────────────────────────

describe("§P14-PACK · sliding window with anchors", () => {
  it("all messages fit within budget · nothing dropped", () => {
    const msgs: NexMessage[] = [
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi" },
    ];
    const r = packWithSlidingWindow({ messages: msgs, system_prompt_tokens: 100, budget: { max_input_tokens: 10_000, reserve_for_output_tokens: 1000, headroom_fraction: 0.1 } });
    expect(r.dropped_message_count).toBe(0);
    expect(r.information_lost).toBe(false);
    expect(r.packed_messages.length).toBe(2);
  });

  it("dropped messages counted honestly · information_lost=true", () => {
    const msgs: NexMessage[] = Array.from({ length: 100 }, (_, i) => ({ role: "user", content: `msg ${i} `.repeat(100) }));
    const r = packWithSlidingWindow({ messages: msgs, system_prompt_tokens: 0, budget: { max_input_tokens: 1000, reserve_for_output_tokens: 100, headroom_fraction: 0.1 } });
    expect(r.dropped_message_count).toBeGreaterThan(0);
    expect(r.information_lost).toBe(true);
  });

  it("anchors preserved through truncation", () => {
    const msgs: NexMessage[] = Array.from({ length: 20 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `long message content ${i} `.repeat(50),
    }));
    const r = packWithSlidingWindow({
      messages: msgs,
      system_prompt_tokens: 0,
      budget: { max_input_tokens: 2000, reserve_for_output_tokens: 100, headroom_fraction: 0.1 },
      anchor_rules: [{ kind: "first_n_user_messages", n: 1 }],
    });
    // First user (idx 0) should be present
    expect(r.packed_messages.includes(msgs[0])).toBe(true);
  });

  it("system prompt exceeding budget · returns empty packed_messages honestly", () => {
    const r = packWithSlidingWindow({
      messages: [{ role: "user", content: "hi" }],
      system_prompt_tokens: 100_000,
      budget: { max_input_tokens: 1000, reserve_for_output_tokens: 100, headroom_fraction: 0.1 },
    });
    expect(r.packed_messages.length).toBe(0);
    expect(r.information_lost).toBe(true);
  });
});

// ─── HYBRID SUMMARIZATION ────────────────────────────────────

describe("§P14-SUMMARIZE · hybrid anchor + summary + tail", () => {
  it("fits within plain window · falls back to sliding_window", async () => {
    const msgs: NexMessage[] = [{ role: "user", content: "a" }];
    const r = await packWithHybridSummary({ messages: msgs, system_prompt_tokens: 0 });
    expect(["sliding_window", "sliding_window_with_anchors"]).toContain(r.strategy_used);
  });

  it("large conversation · middle summarized · anchors + tail preserved · no information silently lost", async () => {
    const msgs: NexMessage[] = Array.from({ length: 40 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `content ${i} `.repeat(80),
    }));
    const r = await packWithHybridSummary({
      messages: msgs,
      system_prompt_tokens: 0,
      budget: { max_input_tokens: 3000, reserve_for_output_tokens: 300, headroom_fraction: 0.1 },
      anchor_rules: [{ kind: "first_n_user_messages", n: 2 }],
      summary_max_tokens: 400,
    });
    expect(r.strategy_used).toBe("hybrid_anchor_summarize");
    expect(r.summarized_message_count).toBeGreaterThan(0);
    expect(r.information_lost).toBe(false); // summarized · not silently dropped
    expect(r.anchor_message_count).toBeGreaterThan(0);
  });

  it("deterministic summarizer is honestly labelled · truncates gracefully", async () => {
    const s = deterministicSummarizer();
    const out = await s({
      messages: [{ role: "user", content: "hello" }, { role: "assistant", content: "world" }],
      target_tokens: 50,
    });
    expect(out).toContain("NEX CONTEXT SUMMARY");
  });
});

// ─── CACHE BREAKPOINTS ───────────────────────────────────────

describe("§P14-CACHE · Anthropic-compatible breakpoint placement", () => {
  it("no breakpoints when system_prompt tiny + conversation tiny", () => {
    const bps = proposeCacheBreakpoints({ system_prompt_tokens: 100, messages: [{ role: "user", content: "hi" }] });
    expect(bps.length).toBe(0);
  });

  it("system_prompt >= MIN_CACHEABLE_TOKENS triggers first breakpoint", () => {
    const bps = proposeCacheBreakpoints({ system_prompt_tokens: MIN_CACHEABLE_TOKENS, messages: [] });
    expect(bps.length).toBe(1);
    expect(bps[0].reason).toBe("system_prompt_end");
  });

  it("never exceeds MAX_CACHE_BREAKPOINTS", () => {
    const msgs: NexMessage[] = Array.from({ length: 100 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: "x".repeat(4000), // ~1000 tokens each
    }));
    const bps = proposeCacheBreakpoints({ system_prompt_tokens: MIN_CACHEABLE_TOKENS, messages: msgs });
    expect(bps.length).toBeLessThanOrEqual(MAX_CACHE_BREAKPOINTS);
  });

  it("cachePrefixFingerprint is deterministic", () => {
    const fp1 = cachePrefixFingerprint({ system_prompt: "You are NEX." });
    const fp2 = cachePrefixFingerprint({ system_prompt: "You are NEX." });
    expect(fp1).toBe(fp2);
    const fp3 = cachePrefixFingerprint({ system_prompt: "You are OTHER." });
    expect(fp3).not.toBe(fp1);
  });
});
