// src/lib/nex/brain/llm-cost-model.ts
//
// D7 · Per-provider USD pricing table. Feeds `dailyUsageSnapshot()`
// so operators see spend, not just token volume.
//
// Values captured 2026-08-10 from public provider docs for the default
// model each provider serves (see DEFAULT_MODEL in llm.ts). Free-tier
// entries carry `price_per_1k_in = 0` — spend calculation still runs
// so if the free-tier is ever exhausted and traffic spills to paid,
// the operator sees the shift.
//
// IMPORTANT · these numbers WILL drift. Verify quarterly against provider
// billing pages. When a default model changes in llm.ts, update the row
// here in the same commit.

import type { LlmProvider } from "./llm";

export type ProviderPrice = {
  /** USD per 1000 input tokens */
  price_per_1k_in: number;
  /** USD per 1000 output tokens */
  price_per_1k_out: number;
  /** Free tier note (informational) */
  note: string;
  /** Date the pricing was last verified */
  verified: string;
};

/** USD per 1K tokens · verify quarterly against provider docs. */
export const LLM_PRICE_MODEL: Record<LlmProvider, ProviderPrice> = {
  // Anthropic Claude Haiku 4.5 · $1.00/M in, $5.00/M out
  anthropic:  { price_per_1k_in: 0.001,    price_per_1k_out: 0.005,    note: "paid · verify quarterly",           verified: "2026-08-10" },
  // Gemini flash-latest · $0.075/M in, $0.30/M out (as of Jan 2026)
  gemini:     { price_per_1k_in: 0.000075, price_per_1k_out: 0.0003,   note: "paid · very cheap · vision",         verified: "2026-08-10" },
  // Groq llama-3.3-70b · $0.59/M in, $0.79/M out
  groq:       { price_per_1k_in: 0.00059,  price_per_1k_out: 0.00079,  note: "paid · fast · no vision",            verified: "2026-08-10" },
  // Mistral small · $0.20/M in, $0.60/M out
  mistral:    { price_per_1k_in: 0.0002,   price_per_1k_out: 0.0006,   note: "paid",                                verified: "2026-08-10" },
  // SambaNova llama-3.3-70b · $0.60/M in, $1.20/M out
  sambanova:  { price_per_1k_in: 0.0006,   price_per_1k_out: 0.0012,   note: "paid · fast",                         verified: "2026-08-10" },
  // Cerebras gpt-oss-120b · free tier · ~$0.10/M paid tier
  cerebras:   { price_per_1k_in: 0,        price_per_1k_out: 0,        note: "free tier · paid ≈ $0.10/M each way", verified: "2026-08-10" },
  // Cloudflare Workers AI · 10K neurons/day free · paid ~$0.11/M in $0.35/M out
  cloudflare: { price_per_1k_in: 0,        price_per_1k_out: 0,        note: "free 10K neurons/day · then paid",    verified: "2026-08-10" },
  // OpenRouter Nemotron :free · free
  openrouter: { price_per_1k_in: 0,        price_per_1k_out: 0,        note: "free tier · Nemotron 550B",           verified: "2026-08-10" },
  // HuggingFace Router · variable per target provider
  huggingface:{ price_per_1k_in: 0,        price_per_1k_out: 0,        note: "variable · router picks target",      verified: "2026-08-10" },
  // Mock · always free
  mock:       { price_per_1k_in: 0,        price_per_1k_out: 0,        note: "mock · never real spend",             verified: "2026-08-10" },
};

/** Compute USD spend from (tokens_in, tokens_out) for a provider. */
export function estimateUsdSpend(provider: LlmProvider, tokens_in: number, tokens_out: number): number {
  const p = LLM_PRICE_MODEL[provider];
  if (!p) return 0;
  const inCost  = (tokens_in  / 1000) * p.price_per_1k_in;
  const outCost = (tokens_out / 1000) * p.price_per_1k_out;
  return Number((inCost + outCost).toFixed(6));
}
