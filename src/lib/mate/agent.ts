// Mate agent orchestrator — glues personality + context + Claude.
//
// Public entry point: askMate({ surface, userKey, question,
// conversationHistory, extras }) → { answer, usage, cost, modelUsed }
//
// Model tiering:
//   • Haiku 4.5 for short chatter (< 300 words in the last user
//     message and no analytics-heavy keywords)
//   • Opus 4.7 for longer / analysis / "should I" strategic asks
// Both go through the SAME wrapper (src/lib/llm/anthropic.ts).

import { completeWithUsage, type AnthropicMessage } from "@/lib/llm/anthropic";
import { buildSystemPrompt } from "./personality";
import { buildMateContext, type MateSurface } from "./context";
import type { KnowledgeHit } from "@/lib/knowledge/search";

const MODEL_HAIKU = "claude-haiku-4-5-20251001";
const MODEL_OPUS  = "claude-opus-4-7";

// Anthropic pricing (2026-07 · $ per million tokens). Kept in
// this file — one place to update when Anthropic changes prices.
const PRICING: Record<string, { input_usd_per_mtok: number; output_usd_per_mtok: number; cache_read_usd_per_mtok: number }> = {
  [MODEL_HAIKU]: { input_usd_per_mtok: 1.00,  output_usd_per_mtok: 5.00,  cache_read_usd_per_mtok: 0.10 },
  [MODEL_OPUS]:  { input_usd_per_mtok: 15.00, output_usd_per_mtok: 75.00, cache_read_usd_per_mtok: 1.50 }
};

// £ / $ estimate for the cost-tracking column. Rough — actual FX
// applied by Anthropic invoice at month end. 0.79 = £/$ (mid-2026).
const GBP_PER_USD = 0.79;

export type AskMateParams = {
  surface:              MateSurface;
  userKey:              string;
  question:             string;
  conversationHistory:  AnthropicMessage[];
  extras:               { slug?: string; homeownerId?: string; canteenSlug?: string };
};

export type AskMateResult = {
  answer:           string;
  modelUsed:        string;
  usage: {
    inputTokens:  number; outputTokens: number;
    cacheReadTokens: number; cacheCreationTokens: number;
  };
  costPence:        number;
  contextSnapshot:  Record<string, unknown>;
  latencyMs:        number;
};

/** Choose the cheaper Haiku unless the question hints at analysis. */
function pickModel(question: string): string {
  const q = question.toLowerCase();
  const hardHints = [
    "should i", "why did", "analyse", "analyze", "compare",
    "strategy", "recommend", "explain why", "break down",
    "how am i doing", "growth", "trend"
  ];
  if (hardHints.some((h) => q.includes(h))) return MODEL_OPUS;
  if (question.length > 260) return MODEL_OPUS;
  return MODEL_HAIKU;
}

function knowledgeToText(hits: KnowledgeHit[]): string {
  if (hits.length === 0) return "(no matching knowledge base entries)";
  return hits.map((h, i) => {
    const src = h.source_publisher ? ` — source: ${h.source_publisher}` : "";
    return `[${i + 1}] ${h.title}${src}\n${h.ai_summary}`;
  }).join("\n\n");
}

export async function askMate(params: AskMateParams): Promise<AskMateResult> {
  const started = Date.now();
  const model   = pickModel(params.question);

  // Build the runtime context — one data pull per turn.
  const ctx = await buildMateContext(params.surface, params.question, {
    slug:         params.extras.slug         ?? "",
    homeownerId:  params.extras.homeownerId  ?? "",
    canteenSlug:  params.extras.canteenSlug  ?? ""
  } as never);

  const systemBase = buildSystemPrompt(params.surface);

  // We split the system prompt into a CACHED prefix (identity + rules,
  // stable) and a FRESH suffix (per-user context). Prompt caching
  // makes the cached prefix 10× cheaper on reuse.
  const cachedSystem = systemBase;
  const freshSystem  = [
    `${ctx.userLabel}.`,
    "",
    "CONTEXT (real data on this user right now — cite these numbers when relevant):",
    JSON.stringify(ctx.systemFacts, null, 2),
    "",
    "KNOWLEDGE BASE HITS (relevant excerpts — cite the source name if you use them):",
    knowledgeToText(ctx.knowledge)
  ].join("\n");

  const messages: AnthropicMessage[] = [
    ...params.conversationHistory,
    { role: "user", content: params.question }
  ];

  const res = await completeWithUsage({
    model,
    cachedSystem,
    system:      freshSystem,
    messages,
    maxTokens:   700,
    temperature: 0.35
  });

  const latencyMs = Date.now() - started;

  if (!res) {
    // Anthropic key missing OR upstream error. Fall back to a
    // deterministic response so the widget doesn't just error.
    return {
      answer:            "I'm having trouble reaching my brain right now, mate. Try again in a bit, or ping the team via the Help centre in the drawer.",
      modelUsed:         model,
      usage:             { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 },
      costPence:         0,
      contextSnapshot:   { fallback: true, reason: "provider_unavailable" },
      latencyMs
    };
  }

  const pricing = PRICING[model];
  const usdCost =
    (res.usage.inputTokens        / 1_000_000) * pricing.input_usd_per_mtok +
    (res.usage.outputTokens       / 1_000_000) * pricing.output_usd_per_mtok +
    (res.usage.cacheReadTokens    / 1_000_000) * pricing.cache_read_usd_per_mtok;
  const costPence = Math.ceil(usdCost * GBP_PER_USD * 100);

  return {
    answer:           res.text,
    modelUsed:        model,
    usage:            res.usage,
    costPence,
    contextSnapshot: {
      surface:      params.surface,
      knowledge_hit_count: ctx.knowledge.length,
      knowledge_hit_titles: ctx.knowledge.map((h) => h.title),
      fact_keys:    Object.keys(ctx.systemFacts)
    },
    latencyMs
  };
}
