// NEX Brain · LLM adapter
//
// Every worker calls llm.complete(...) or llm.completeJson(...).
// Provider selection happens here — never in the worker code.
//
// Provider selection precedence (auto-detected from env):
//   1. GROQ_API_KEY               → Groq (Llama 3.3 70B by default)
//   2. GOOGLE_GEMINI_API_KEY      → Gemini 1.5 Flash
//   3. ANTHROPIC_API_KEY          → Claude Haiku (paid backup)
//   4. nothing set                → deterministic MOCK adapter
//
// The mock adapter returns realistic-looking structured output so the
// whole pipeline (Manager → Extractor → Checker → storage) works
// end-to-end without any API key. That makes local dev + CI trivial.
//
// All calls report token usage + latency so worker_results can log
// budget consumption per LLM call. That drives the dashboard's
// "LLM calls (24h)" and "LLM tokens (24h)" stats.

// ── Types ────────────────────────────────────────────────────────────

export type LlmProvider = "openrouter" | "sambanova" | "mistral" | "groq" | "gemini" | "cerebras" | "cloudflare" | "huggingface" | "anthropic" | "mock";

// Capabilities each worker can require of a provider. If a worker
// declares requires_capability, providers lacking that capability are
// filtered out of the chain automatically for that call.
export type LlmCapability =
  | "text"          // basic text completion (all providers)
  | "vision"        // accepts image inputs
  | "audio"         // accepts audio inputs (transcription / analysis)
  | "json_mode"     // reliable structured JSON output
  | "tool_use"      // function/tool calling
  | "long_context"; // 200K+ token context window

// Which capabilities each provider offers. Update this as new providers
// or model tiers are added.
const PROVIDER_CAPABILITIES: Record<LlmProvider, LlmCapability[]> = {
  // OpenRouter: aggregator giving access to many free-tier models incl.
  // NVIDIA Nemotron 3 Ultra 550B, Google Gemma 4, Cohere North, etc.
  // Long context on the big models. No vision on default free tier.
  openrouter: ["text", "json_mode", "tool_use", "long_context"],
  // SambaNova Cloud: fast (~1000 tok/s) Meta-Llama-3.3-70B, DeepSeek V3,
  // gpt-oss-120b, gemma-4-31B-it. OpenAI-compatible.
  sambanova:  ["text", "json_mode", "tool_use", "long_context"],
  // Mistral La Plateforme: mistral-small/medium (medium has vision),
  // codestral. 131K context, OpenAI-compatible schema, JSON mode.
  mistral:    ["text", "vision", "json_mode", "tool_use", "long_context"],
  // Groq: fast text + JSON, no vision (as of Llama 3.3 / DeepSeek line)
  groq:      ["text", "json_mode", "tool_use"],
  // Gemini 1.5 Flash: vision + 1M-token context + JSON
  gemini:    ["text", "vision", "audio", "json_mode", "long_context", "tool_use"],
  // Cerebras Cloud: fastest inference on the market (~2000 tok/s) for
  // Llama 3.3 70B, Qwen 2.5 72B. OpenAI-compatible API. No vision.
  cerebras:  ["text", "json_mode", "tool_use"],
  // Cloudflare Workers AI: 10K neurons/day free · Llama 3.3 70B on
  // Cloudflare's edge · fast · own JSON-schema response format.
  cloudflare:["text", "json_mode", "tool_use"],
  // Hugging Face Router API: unified endpoint routing to Together /
  // Fireworks / Cerebras / SambaNova etc. under one HF key. Free tier
  // ~1000 req/day. OpenAI-compatible. Model catalogue is huge (Llama
  // 3.3 70B, Qwen 2.5 72B, Mixtral, DeepSeek etc).
  huggingface:["text", "json_mode", "tool_use", "long_context"],
  // Anthropic Claude Haiku: vision + tools + JSON + 200K context
  anthropic: ["text", "vision", "json_mode", "tool_use", "long_context"],
  // Mock: deterministic stand-in for everything so tests never block
  mock:      ["text", "vision", "audio", "json_mode", "tool_use", "long_context"],
};

// Images can be attached to user messages for vision-capable providers.
// Stored as base64 (raw, no data-URI prefix) + mime type. The provider
// adapter formats them per each API's spec (Anthropic content blocks,
// Gemini inline_data parts).
export type LlmImage = {
  mime: string;   // "image/jpeg" | "image/png" | "image/webp"
  data: string;   // base64-encoded bytes (no "data:...;base64," prefix)
};

export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
  images?: LlmImage[];
};

export type LlmCallOptions = {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  json_mode?: boolean;
  timeout_ms?: number;
  // Provider intelligence (Philip 2026-08-06): workers declare which
  // provider is best-suited AND / OR which capability is required.
  //   prefer_provider     — move to head of chain if configured + healthy
  //   requires_capability — filter chain to providers offering this cap
  // Both are hints — the chain still falls back to any working provider
  // if the preferred / capable one is down.
  prefer_provider?: LlmProvider;
  requires_capability?: LlmCapability;
  // D2 · per-consumer LLM budget isolation. Naming the consumer (usually
  // the worker_type · e.g. "knowledge-extractor") lets budget accounting
  // track per-consumer slices. When set, the per-consumer counter is
  // incremented alongside the global counter AND the per-consumer budget
  // (`<PROVIDER>_<CONSUMER>_DAILY_CALL_BUDGET` env) is enforced first.
  // If no per-consumer budget is configured, the shared budget applies.
  // Unset consumer preserves the pre-D2 shared-bucket behaviour.
  consumer?: string;
};

export type LlmCallResult = {
  provider: LlmProvider;
  model: string;
  text: string;
  json?: unknown;
  tokens_in: number;
  tokens_out: number;
  ms: number;
};

// ── AI Connection Manager (Philip 2026-08-06) ────────────────────────
//
// NEX is the manager of the AI providers, not just the manager of the
// workers. Every complete() call flows through a provider chain with:
//   · Circuit breaker per provider (opens after N consecutive failures,
//     auto-closes after cooldown for a retry)
//   · Exponential backoff retry within each provider before falling back
//   · Fallback chain: primary → secondary → tertiary → mock
//   · Rolling 24h metrics per provider (success rate, avg latency)
//
// When Groq times out, NEX doesn't just fail — she retries with backoff,
// then falls to Gemini, then Anthropic, then to the mock as a last
// resort. Every step is logged so the dashboard shows what happened.

// Default model per provider. Verified 2026-08-06 against live APIs.
const DEFAULT_MODEL: Record<LlmProvider, string> = {
  // OpenRouter · Nemotron 3 Ultra 550B free tier · biggest available
  // free model on the internet as of 2026-08-06. Verified end-to-end.
  openrouter: "nvidia/nemotron-3-ultra-550b-a55b:free",
  // SambaNova · Meta Llama 3.3 70B · fast, generous free tier
  sambanova: "Meta-Llama-3.3-70B-Instruct",
  // Mistral · small-latest · fast, JSON-reliable, free tier
  mistral: "mistral-small-latest",
  // Groq · fast, free, no vision
  groq: "llama-3.3-70b-versatile",
  // Gemini · vision + 1M ctx · use the -latest alias so Google's
  // rolling model refresh flows through automatically. Previous
  // gemini-1.5-flash-latest was deprecated.
  gemini: "gemini-flash-latest",
  // Cerebras · gpt-oss-120b · largest free model on cerebras · ~2000 tok/s
  // (as of 2026-08-06 the free-tier key catalogue is: zai-glm-4.7,
  // gemma-4-31b, gpt-oss-120b · no Llama-3.3-70b on the free tier)
  cerebras: "gpt-oss-120b",
  // Cloudflare Workers AI · Llama 3.3 70B fp8-fast · 10K neurons/day free
  cloudflare: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  // Hugging Face Router · Llama 3.3 70B Turbo (router picks fastest
  // available provider · Together/Fireworks/Cerebras etc.)
  huggingface: "meta-llama/Llama-3.3-70B-Instruct",
  // Anthropic Claude Haiku · vision · paid
  anthropic: "claude-haiku-4-5-20251001",
  mock: "mock-llama-70b",
};

// Circuit breaker config
const CIRCUIT_BREAKER_THRESHOLD = 3;         // consecutive failures to open
const CIRCUIT_BREAKER_COOLDOWN_MS = 60_000;  // how long before half-open retry
const PER_PROVIDER_RETRIES = 2;              // attempts per provider (before backoff to next)
const RETRY_BACKOFF_MS = [500, 2000, 8000];  // one entry per retry

// ── Daily free-tier budget (Philip 2026-08-06) ───────────────────────
// Per-provider daily call cap sized ~10% under the published free-tier
// ceiling. When today's counter hits the budget, that provider is
// skipped by the chain until UTC midnight — the date key rolls over
// and every provider becomes fresh again with zero manual intervention.
// This is a preventative layer above the circuit breaker: circuit
// breaker reacts to 429/5xx, budget stops us reaching them.
//
// Override any budget with env: <PROVIDER>_DAILY_CALLS=<n>. 0 = unlimited
// (use for paid providers, mock, or when you've verified higher quota).
// Set a much lower number if you're uncredited on OpenRouter (~45/day).
const DAILY_CALL_BUDGET_DEFAULTS: Record<LlmProvider, number> = {
  openrouter: 900,   // ~1,000/day with $10+ credit · set 45 if uncredited
  sambanova:  300,   // conservative · free-tier quotas vary by model
  mistral:    500,   // La Plateforme free tier
  groq:       900,   // ~1,000/day for llama-3.3-70b-versatile
  gemini:     1300,  // ~1,500/day for gemini-2.5-flash
  cerebras:   800,   // ~900/day for llama-3.3-70b
  cloudflare: 900,   // ~10K neurons/day; ~7 neurons/1K out tokens on 70B → ~1200 short calls; keep conservative
  huggingface:800,   // ~1K req/day free tier via router; conservative buffer
  anthropic:  0,     // paid — no cap
  mock:       0,     // no cap
};

function dailyBudget(p: LlmProvider): number {
  const override = process.env[`${p.toUpperCase()}_DAILY_CALLS`];
  if (override !== undefined && override !== "") {
    const n = Number(override);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return DAILY_CALL_BUDGET_DEFAULTS[p];
}

// D2 · per-consumer budget. Env pattern
// `<PROVIDER>_<CONSUMER>_DAILY_CALLS` overrides. Consumer is normalised
// to uppercase with hyphens/dots turned into underscores.
// Returns -1 to mean "no per-consumer budget configured — use shared".
function consumerBudget(p: LlmProvider, consumer: string): number {
  const key = `${p.toUpperCase()}_${consumer.replace(/[-.]/g, "_").toUpperCase()}_DAILY_CALLS`;
  const override = process.env[key];
  if (override === undefined || override === "") return -1;
  const n = Number(override);
  if (Number.isFinite(n) && n >= 0) return n;
  return -1;
}

type DailyUsage = { utc_date: string; calls: number; tokens_in: number; tokens_out: number };
function freshUsage(): DailyUsage {
  return { utc_date: currentUtcDate(), calls: 0, tokens_in: 0, tokens_out: 0 };
}
function currentUtcDate(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

// Phase 10.3 · Bug B fix. Anchor mutable module-scope state onto
// globalThis so Next.js dev mode (Turbopack) doesn't hand each API-route
// bundle its own private copy. Symptom before this fix: /verify-llm
// would record a success on cloudflare but /llm-health would still
// return status:"idle" for every provider — because the two routes were
// looking at different USAGE + HEALTH objects. Same pattern is used
// widely for Prisma singletons in Next.js. Zero behavioural change in
// production (single Node instance always shared module state).
type NexLlmRuntime = { usage?: Record<LlmProvider, DailyUsage>; health?: Record<LlmProvider, ProviderHealth> };
const RUNTIME: NexLlmRuntime = ((globalThis as unknown as { __nexBrainLlm__?: NexLlmRuntime }).__nexBrainLlm__ ??=
  {} as NexLlmRuntime);

const USAGE: Record<LlmProvider, DailyUsage> = RUNTIME.usage ??= {
  openrouter: freshUsage(), sambanova: freshUsage(), mistral: freshUsage(),
  groq: freshUsage(), gemini: freshUsage(), cerebras: freshUsage(),
  cloudflare: freshUsage(), huggingface: freshUsage(),
  anthropic: freshUsage(), mock: freshUsage(),
};

// D2 · per-consumer usage slices · optional (caller opts in via `consumer`).
// Map<providerName, Map<consumerName, DailyUsage>>. Anchored on globalThis
// so Next.js dev mode (Turbopack) sees a single view.
type ConsumerUsageMap = Map<LlmProvider, Map<string, DailyUsage>>;
const CONSUMER_USAGE: ConsumerUsageMap =
  ((globalThis as unknown as { __nexBrainLlmConsumer__?: ConsumerUsageMap }).__nexBrainLlmConsumer__ ??= new Map());

function consumerBucket(p: LlmProvider, consumer: string): DailyUsage {
  let byConsumer = CONSUMER_USAGE.get(p);
  if (!byConsumer) { byConsumer = new Map(); CONSUMER_USAGE.set(p, byConsumer); }
  let bucket = byConsumer.get(consumer);
  const today = currentUtcDate();
  if (!bucket || bucket.utc_date !== today) {
    bucket = freshUsage();
    byConsumer.set(consumer, bucket);
  }
  return bucket;
}

function rollDayIfNeeded(p: LlmProvider): void {
  const today = currentUtcDate();
  if (USAGE[p].utc_date !== today) USAGE[p] = freshUsage();
}

function isBudgetExhausted(p: LlmProvider, consumer?: string): boolean {
  rollDayIfNeeded(p);
  // Per-consumer check first (if configured). This makes one worker's
  // exhaustion visible without poisoning the shared bucket for others.
  if (consumer) {
    const perConsumer = consumerBudget(p, consumer);
    if (perConsumer > 0) {
      const b = consumerBucket(p, consumer);
      if (b.calls >= perConsumer) return true;
    }
  }
  const budget = dailyBudget(p);
  if (budget === 0) return false; // 0 = unlimited
  return USAGE[p].calls >= budget;
}

function recordUsage(p: LlmProvider, tokens_in: number, tokens_out: number, consumer?: string): void {
  rollDayIfNeeded(p);
  USAGE[p].calls += 1;
  USAGE[p].tokens_in += tokens_in;
  USAGE[p].tokens_out += tokens_out;
  if (consumer) {
    const b = consumerBucket(p, consumer);
    b.calls += 1;
    b.tokens_in += tokens_in;
    b.tokens_out += tokens_out;
  }
}

/** D2 · snapshot of per-consumer usage · for /brain-health + dashboards. */
export function consumerUsageSnapshot(): Array<{
  provider: LlmProvider;
  consumer: string;
  utc_date: string;
  calls: number;
  tokens_in: number;
  tokens_out: number;
  per_consumer_budget: number;   // -1 if none configured
  per_consumer_exhausted: boolean;
}> {
  const out: ReturnType<typeof consumerUsageSnapshot> = [];
  for (const [p, byConsumer] of CONSUMER_USAGE.entries()) {
    for (const [consumer, b] of byConsumer.entries()) {
      const budget = consumerBudget(p, consumer);
      out.push({
        provider: p,
        consumer,
        utc_date: b.utc_date,
        calls: b.calls,
        tokens_in: b.tokens_in,
        tokens_out: b.tokens_out,
        per_consumer_budget: budget,
        per_consumer_exhausted: budget > 0 && b.calls >= budget,
      });
    }
  }
  return out;
}

/** Public snapshot of today's per-provider call usage vs daily budget.
 *  Consumed by /api/nex/brain/llm-health, dashboards, and probe scripts.
 *  D7 (2026-08-10) · adds `usd_spend_today` computed from the cost model. */
export function dailyUsageSnapshot(): Record<
  LlmProvider,
  {
    utc_date: string;
    calls: number;
    budget: number;
    remaining: number | null; // null = unlimited
    exhausted: boolean;
    tokens_in: number;
    tokens_out: number;
    usd_spend_today: number;
  }
> {
  // Lazy import avoids circular-dep risk (cost model imports LlmProvider from this file)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { estimateUsdSpend } = require("./llm-cost-model") as typeof import("./llm-cost-model");
  const out = {} as ReturnType<typeof dailyUsageSnapshot>;
  for (const p of Object.keys(USAGE) as LlmProvider[]) {
    rollDayIfNeeded(p);
    const budget = dailyBudget(p);
    out[p] = {
      utc_date: USAGE[p].utc_date,
      calls: USAGE[p].calls,
      budget,
      remaining: budget === 0 ? null : Math.max(0, budget - USAGE[p].calls),
      exhausted: budget !== 0 && USAGE[p].calls >= budget,
      tokens_in: USAGE[p].tokens_in,
      tokens_out: USAGE[p].tokens_out,
      usd_spend_today: estimateUsdSpend(p, USAGE[p].tokens_in, USAGE[p].tokens_out),
    };
  }
  return out;
}

// Provider health state (in-memory; resets on server restart, fine for dev).
// A future pass persists this into Supabase for cross-instance coherence.
type ProviderHealth = {
  provider: LlmProvider;
  consecutive_failures: number;
  circuit_open_until: number | null;   // epoch ms
  last_success_at: number | null;
  last_failure_at: number | null;
  last_error: string | null;
  recent_calls: Array<{ at: number; ok: boolean; ms: number; tokens: number }>;
};

// Phase 10.3 · Bug B fix (see USAGE above). Same globalThis anchor so
// recordSuccess/recordFailure land on the SAME object /llm-health reads.
const HEALTH: Record<LlmProvider, ProviderHealth> = RUNTIME.health ??= {
  openrouter:{ provider: "openrouter",consecutive_failures: 0, circuit_open_until: null, last_success_at: null, last_failure_at: null, last_error: null, recent_calls: [] },
  sambanova: { provider: "sambanova", consecutive_failures: 0, circuit_open_until: null, last_success_at: null, last_failure_at: null, last_error: null, recent_calls: [] },
  mistral:   { provider: "mistral",   consecutive_failures: 0, circuit_open_until: null, last_success_at: null, last_failure_at: null, last_error: null, recent_calls: [] },
  groq:      { provider: "groq",      consecutive_failures: 0, circuit_open_until: null, last_success_at: null, last_failure_at: null, last_error: null, recent_calls: [] },
  gemini:    { provider: "gemini",    consecutive_failures: 0, circuit_open_until: null, last_success_at: null, last_failure_at: null, last_error: null, recent_calls: [] },
  cerebras:  { provider: "cerebras",  consecutive_failures: 0, circuit_open_until: null, last_success_at: null, last_failure_at: null, last_error: null, recent_calls: [] },
  cloudflare:{ provider: "cloudflare",consecutive_failures: 0, circuit_open_until: null, last_success_at: null, last_failure_at: null, last_error: null, recent_calls: [] },
  huggingface:{provider: "huggingface",consecutive_failures: 0, circuit_open_until: null, last_success_at: null, last_failure_at: null, last_error: null, recent_calls: [] },
  anthropic: { provider: "anthropic", consecutive_failures: 0, circuit_open_until: null, last_success_at: null, last_failure_at: null, last_error: null, recent_calls: [] },
  mock:      { provider: "mock",      consecutive_failures: 0, circuit_open_until: null, last_success_at: null, last_failure_at: null, last_error: null, recent_calls: [] },
};

// Which providers are configured (have credentials). Mock is always OK.
function providerConfigured(p: LlmProvider): boolean {
  switch (p) {
    case "openrouter":return Boolean(process.env.OPENROUTER_API_KEY);
    case "sambanova": return Boolean(process.env.SAMBANOVA_API_KEY);
    case "mistral":   return Boolean(process.env.MISTRAL_API_KEY);
    case "groq":      return Boolean(process.env.GROQ_API_KEY);
    case "gemini":    return Boolean(process.env.GOOGLE_GEMINI_API_KEY);
    case "cerebras":  return Boolean(process.env.CEREBRAS_API_KEY);
    case "cloudflare":return Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_WORKERS_AI_TOKEN);
    case "huggingface":return Boolean(process.env.HUGGINGFACE_API_KEY);
    case "anthropic": return Boolean(process.env.ANTHROPIC_API_KEY);
    case "mock":      return true;
  }
}

// Compute the provider chain from LLM_PROVIDER_CHAIN env var, applying
// per-call options (requires_capability filter, prefer_provider reorder).
// Mock is always the last resort.
function providerChain(options: {
  requires_capability?: LlmCapability;
  prefer_provider?: LlmProvider;
} = {}): LlmProvider[] {
  const raw = process.env.LLM_PROVIDER_CHAIN;
  const seed: string[] = raw
    ? raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
    : ["openrouter", "sambanova", "groq", "gemini"];

  const VALID: readonly LlmProvider[] = ["openrouter", "sambanova", "mistral", "groq", "gemini", "cerebras", "cloudflare", "huggingface", "anthropic", "mock"];
  let chain: LlmProvider[] = [];
  for (const p of seed) {
    const v = VALID.find((x) => x === p);
    if (v && providerConfigured(v)) {
      chain.push(v);
    }
  }

  // Mock fallback — env-gated per the Speaking & Knowledge Doctrine
  // (feedback_nex_speaking_knowledge_doctrine_2026_08_06.md).
  // In production we prefer failing loud + queueing for retry over
  // fabricated placeholder output. Default is `true` (preserves dev-
  // friendly behavior + tests). Set LLM_ALLOW_MOCK_FALLBACK=false on
  // production workers to route all-provider-failure through
  // completeWithRetryPersistence into llm_retry_queue instead.
  const allowMock = (process.env.LLM_ALLOW_MOCK_FALLBACK ?? "true").toLowerCase() !== "false";
  if (allowMock && !chain.includes("mock")) chain.push("mock");

  // Capability filter — drop providers that can't do the required job.
  if (options.requires_capability) {
    chain = chain.filter((p) =>
      PROVIDER_CAPABILITIES[p].includes(options.requires_capability!)
    );
    // Ensure mock stays present after filter IF allowed. Without it we
    // can end up with an empty chain in dev, which surfaces as a hard
    // exception (correct in prod, noisy in dev).
    if (allowMock && !chain.includes("mock")) chain.push("mock");
  }

  // Preference — move to head of chain if configured, capable, healthy.
  if (
    options.prefer_provider &&
    chain.includes(options.prefer_provider) &&
    !isCircuitOpen(options.prefer_provider)
  ) {
    chain = [options.prefer_provider, ...chain.filter((p) => p !== options.prefer_provider)];
  }

  return chain;
}

// Which is the currently-active primary provider for a given options
// context? (Chain head after skipping any with an open circuit.)
export function activeProvider(options: {
  requires_capability?: LlmCapability;
  prefer_provider?: LlmProvider;
} = {}): LlmProvider {
  const chain = providerChain(options);
  for (const p of chain) if (!isCircuitOpen(p)) return p;
  return chain[chain.length - 1]; // fall back to mock if everything is open
}

// ── Circuit breaker helpers ─────────────────────────────────────────

function isCircuitOpen(p: LlmProvider): boolean {
  const h = HEALTH[p];
  if (!h.circuit_open_until) return false;
  if (Date.now() > h.circuit_open_until) {
    // Cooldown passed → half-open (allow one probe request through)
    h.circuit_open_until = null;
    h.consecutive_failures = Math.max(0, h.consecutive_failures - 1);
    return false;
  }
  return true;
}

function recordSuccess(p: LlmProvider, ms: number, tokens: number) {
  const h = HEALTH[p];
  h.consecutive_failures = 0;
  h.circuit_open_until = null;
  h.last_success_at = Date.now();
  h.last_error = null;
  h.recent_calls.push({ at: Date.now(), ok: true, ms, tokens });
  trimCallHistory(p);
}

function recordFailure(p: LlmProvider, err: string, ms: number) {
  const h = HEALTH[p];
  h.consecutive_failures += 1;
  h.last_failure_at = Date.now();
  h.last_error = err.slice(0, 240);
  // Log every failure with the underlying error text so cloud logs
  // reveal the actual API problem (auth, quota, network, model name),
  // not just "circuit opened" three failures later.
  console.warn(`[nex-brain.llm] ${p} call failed (${ms}ms, streak ${h.consecutive_failures}): ${err.slice(0, 200)}`);
  if (h.consecutive_failures >= CIRCUIT_BREAKER_THRESHOLD) {
    h.circuit_open_until = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
    console.warn(`[nex-brain.llm] circuit OPEN for ${p} (${h.consecutive_failures} consecutive failures) · cooldown ${CIRCUIT_BREAKER_COOLDOWN_MS}ms`);
  }
  h.recent_calls.push({ at: Date.now(), ok: false, ms, tokens: 0 });
  trimCallHistory(p);
}

function trimCallHistory(p: LlmProvider) {
  const h = HEALTH[p];
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  h.recent_calls = h.recent_calls.filter((c) => c.at >= dayAgo).slice(-500);
}

// Public health snapshot for the /llm-health endpoint + dashboard.
export type ProviderStatus = "healthy" | "degraded" | "circuit-open" | "unconfigured" | "idle";
export type ProviderReport = {
  provider: LlmProvider;
  status: ProviderStatus;
  configured: boolean;
  capabilities: LlmCapability[];
  consecutive_failures: number;
  circuit_open_ms_remaining: number | null;
  last_success_at: number | null;
  last_failure_at: number | null;
  last_error: string | null;
  calls_24h: number;
  successes_24h: number;
  success_rate_24h: number | null;
  avg_ms_24h: number | null;
  tokens_24h: number;
};

export function providerReports(): { chain: LlmProvider[]; active: LlmProvider; providers: ProviderReport[] } {
  const chain = providerChain();
  const providers: ProviderReport[] = (["openrouter", "sambanova", "mistral", "groq", "gemini", "cerebras", "cloudflare", "huggingface", "anthropic", "mock"] as LlmProvider[]).map((p) => {
    const h = HEALTH[p];
    trimCallHistory(p);
    const successes = h.recent_calls.filter((c) => c.ok).length;
    const total = h.recent_calls.length;
    const avgMs = total > 0
      ? Math.round(h.recent_calls.reduce((sum, c) => sum + c.ms, 0) / total)
      : null;
    const tokens = h.recent_calls.reduce((sum, c) => sum + c.tokens, 0);
    const configured = providerConfigured(p);
    let status: ProviderStatus = "idle";
    if (!configured) status = "unconfigured";
    else if (h.circuit_open_until && Date.now() < h.circuit_open_until) status = "circuit-open";
    else if (h.consecutive_failures >= 1) status = "degraded";
    else if (h.last_success_at) status = "healthy";
    return {
      provider: p,
      status,
      configured,
      capabilities: PROVIDER_CAPABILITIES[p],
      consecutive_failures: h.consecutive_failures,
      circuit_open_ms_remaining: h.circuit_open_until ? Math.max(0, h.circuit_open_until - Date.now()) : null,
      last_success_at: h.last_success_at,
      last_failure_at: h.last_failure_at,
      last_error: h.last_error,
      calls_24h: total,
      successes_24h: successes,
      success_rate_24h: total > 0 ? successes / total : null,
      avg_ms_24h: avgMs,
      tokens_24h: tokens,
    };
  });
  return { chain, active: activeProvider(), providers };
}

// ── The main public entry — with chain + circuit breaker + retry ────

export async function complete(
  messages: LlmMessage[],
  options: LlmCallOptions = {}
): Promise<LlmCallResult> {
  const chain = providerChain({
    requires_capability: options.requires_capability,
    prefer_provider: options.prefer_provider,
  });
  const errors: string[] = [];

  // Lazy-import audit logger to avoid circular dependencies + keep audit
  // failures from ever breaking the LLM chain. This is the primary source
  // of provider observability per the "NEX must know its own state" doctrine.
  const { emitAuditEvent } = await import("./audit-log");
  const auditContext = {
    worker_type: (options as unknown as { audit_worker_type?: string }).audit_worker_type ?? "system",
    job_id: (options as unknown as { audit_job_id?: string }).audit_job_id ?? null,
    input_ref: (options as unknown as { audit_input_ref?: string }).audit_input_ref ?? null,
  } as const;

  for (const provider of chain) {
    if (isCircuitOpen(provider)) {
      errors.push(`${provider}: circuit-open (skipped)`);
      emitAuditEvent({
        worker_type: auditContext.worker_type as never,
        event_type: "provider_response_failed",
        actor: "nex",
        provider,
        outcome: "circuit_open",
        job_id: auditContext.job_id,
        input_ref: auditContext.input_ref,
      });
      continue;
    }
    if (isBudgetExhausted(provider, options.consumer)) {
      errors.push(
        `${provider}: daily-budget-exhausted (${USAGE[provider].calls}/${dailyBudget(provider)}${options.consumer ? ` · consumer=${options.consumer}` : ""})`
      );
      emitAuditEvent({
        worker_type: auditContext.worker_type as never,
        event_type: "provider_budget_exhausted",
        actor: "nex",
        provider,
        outcome: "budget_exhausted",
        job_id: auditContext.job_id,
        input_ref: auditContext.input_ref,
        details: { calls: USAGE[provider].calls, budget: dailyBudget(provider), consumer: options.consumer ?? null },
      });
      continue;
    }
    const model = options.model ?? DEFAULT_MODEL[provider];

    // Per-provider retries with exponential backoff
    for (let attempt = 0; attempt < PER_PROVIDER_RETRIES; attempt += 1) {
      const start = Date.now();
      emitAuditEvent({
        worker_type: auditContext.worker_type as never,
        event_type: "provider_request_sent",
        actor: "nex",
        provider,
        model,
        job_id: auditContext.job_id,
        input_ref: auditContext.input_ref,
        details: { attempt: attempt + 1 },
      });
      try {
        const result = await dispatchToProvider(provider, messages, model, options, start);
        recordSuccess(provider, result.ms, result.tokens_in + result.tokens_out);
        recordUsage(provider, result.tokens_in, result.tokens_out, options.consumer);
        emitAuditEvent({
          worker_type: auditContext.worker_type as never,
          event_type: "provider_response_ok",
          actor: "nex",
          provider,
          model,
          latency_ms: result.ms,
          outcome: "ok",
          job_id: auditContext.job_id,
          input_ref: auditContext.input_ref,
          details: { attempt: attempt + 1, tokens_in: result.tokens_in, tokens_out: result.tokens_out },
        });
        return result;
      } catch (err) {
        const msg = (err as Error).message;
        const ms = Date.now() - start;
        recordFailure(provider, msg, ms);
        errors.push(`${provider} attempt ${attempt + 1}: ${msg.slice(0, 120)}`);
        emitAuditEvent({
          worker_type: auditContext.worker_type as never,
          event_type: "provider_response_failed",
          actor: "nex",
          provider,
          model,
          latency_ms: ms,
          outcome: classifyProviderError(msg),
          error_snippet: msg.slice(0, 240),
          job_id: auditContext.job_id,
          input_ref: auditContext.input_ref,
          details: { attempt: attempt + 1 },
        });

        // If circuit just opened OR we've used our attempts on this
        // provider, fall through to the next one in the chain.
        if (isCircuitOpen(provider) || attempt === PER_PROVIDER_RETRIES - 1) break;

        // Otherwise wait then retry the same provider.
        const backoff = RETRY_BACKOFF_MS[attempt] ?? RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1];
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
  }

  // Every provider failed AND mock is meant to be in the chain — this
  // should be unreachable because mock never throws. If we get here,
  // something is genuinely broken.
  //
  // Stage 3 · production hook: the caller can enqueue this call for
  // background retry by passing options.retry_persist=true (see the
  // wrapper below in completeWithRetryPersistence).
  throw new Error(
    `[nex-brain.llm] all providers exhausted. Chain: [${chain.join(", ")}]. Errors: ${errors.join(" | ")}`
  );
}

// Stage 3 · Persistent retry wrapper.
// Wraps complete() so that if every provider fails, the call metadata is
// enqueued to llm_retry_queue and the caller receives a synthetic
// "queued for retry" response instead of an exception. The llm-retry
// worker then drains the queue when providers recover.
//
// Callers that need immediate throughput (no queue) can keep calling
// complete() directly. Workers that can tolerate deferred completion
// (extractor, checker) should use this wrapper.
export async function completeWithRetryPersistence(
  messages: LlmMessage[],
  options: LlmCallOptions & {
    call_purpose: string;
    parent_job_id?: string | null;
    parent_worker_type?: string | null;
    parent_input_ref?: string | null;
    max_attempts?: number;
  }
): Promise<{ result: LlmCallResult | null; queued: boolean; retry_id?: string }> {
  try {
    const result = await complete(messages, options);
    return { result, queued: false };
  } catch (err) {
    // Lazy-import the store so this file has no top-level dependency
    // on the storage module (which would create a cycle if it ever
    // imported llm.ts). This is only hit on catastrophic failure.
    try {
      const { brainStore } = await import("./storage");
      const entry = await brainStore().enqueueLlmRetry({
        parent_job_id: options.parent_job_id ?? null,
        parent_worker_type: options.parent_worker_type ?? null,
        parent_input_ref: options.parent_input_ref ?? null,
        call_purpose: options.call_purpose,
        call_options: {
          temperature: options.temperature,
          max_tokens: options.max_tokens,
          json_mode: options.json_mode,
          timeout_ms: options.timeout_ms,
          model: options.model,
        },
        call_messages: messages,
        requires_capability: options.requires_capability ?? null,
        prefer_provider: options.prefer_provider ?? null,
        max_attempts: options.max_attempts ?? 5,
      });
      console.warn(
        `[nex-brain.llm] all providers exhausted for ${options.call_purpose} — ` +
          `queued as retry ${entry.id}. Error: ${(err as Error).message}`
      );
      return { result: null, queued: true, retry_id: entry.id };
    } catch (queueErr) {
      // If even the queue write failed, re-throw the original LLM error
      // (which is more useful) after logging the queue failure.
      console.error(
        `[nex-brain.llm] failed to enqueue retry after exhaustion: ${(queueErr as Error).message}`
      );
      throw err;
    }
  }
}

async function dispatchToProvider(
  provider: LlmProvider,
  messages: LlmMessage[],
  model: string,
  options: LlmCallOptions,
  start: number
): Promise<LlmCallResult> {
  switch (provider) {
    case "openrouter":return callOpenRouter(messages, model, options, start);
    case "sambanova": return callSambaNova(messages, model, options, start);
    case "mistral":   return callMistral(messages, model, options, start);
    case "groq":      return callGroq(messages, model, options, start);
    case "gemini":    return callGemini(messages, model, options, start);
    case "cerebras":  return callCerebras(messages, model, options, start);
    case "cloudflare":return callCloudflare(messages, model, options, start);
    case "huggingface":return callHuggingFace(messages, model, options, start);
    case "anthropic": return callAnthropic(messages, model, options, start);
    case "mock":      return callMock(messages, model, options, start);
  }
}

// Convenience: request strict JSON output. Parses response. Retries on
// parse failure with a stricter re-prompt. Returns typed T.
export async function completeJson<T>(
  messages: LlmMessage[],
  options: LlmCallOptions = {}
): Promise<{ data: T; raw: LlmCallResult }> {
  const withJson = { ...options, json_mode: true };
  const raw = await complete(messages, withJson);
  if (raw.json !== undefined) {
    return { data: raw.json as T, raw };
  }
  // Attempt to parse from text (some providers ignore json_mode).
  const parsed = tryParseJson(raw.text);
  if (parsed !== null) {
    return { data: parsed as T, raw };
  }
  // One retry with a stricter instruction.
  const retry = await complete(
    [
      ...messages,
      {
        role: "user",
        content:
          "Your previous response was not valid JSON. Respond again with ONLY a JSON object. No markdown, no code fences, no commentary.",
      },
    ],
    withJson
  );
  const retryParsed = tryParseJson(retry.text);
  if (retryParsed !== null) {
    return { data: retryParsed as T, raw: retry };
  }
  throw new Error("llm.completeJson: failed to parse JSON from LLM response after retry");
}

// ── Provider implementations ─────────────────────────────────────────

async function callOpenRouter(
  messages: LlmMessage[],
  model: string,
  options: LlmCallOptions,
  start: number
): Promise<LlmCallResult> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY not set");

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeout_ms ?? 60000  // Nemotron 550B is slower than Groq
  );

  try {
    // OpenRouter aggregator: OpenAI-compatible schema, one key gives
    // access to dozens of providers. The HTTP-Referer + X-Title headers
    // are OpenRouter's optional attribution — they let free-tier
    // quotas be tracked per app rather than shared globally.
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
        "http-referer": "https://asknex.app",
        "x-title": "NEX Brain",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.max_tokens ?? 4096,
        response_format: options.json_mode ? { type: "json_object" } : undefined,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const bodyText = await res.text();
      throw new Error(`OpenRouter ${res.status}: ${bodyText.slice(0, 200)}`);
    }
    const body = await res.json();
    // OpenRouter can also wrap upstream errors in a 200 with an error
    // field — treat those as failures too so the circuit breaker sees them.
    if (body.error) {
      throw new Error(`OpenRouter upstream: ${JSON.stringify(body.error).slice(0, 200)}`);
    }
    const text: string = body.choices?.[0]?.message?.content ?? "";
    const json = options.json_mode ? tryParseJson(text) : undefined;
    return {
      provider: "openrouter",
      model,
      text,
      json: json ?? undefined,
      tokens_in: body.usage?.prompt_tokens ?? 0,
      tokens_out: body.usage?.completion_tokens ?? 0,
      ms: Date.now() - start,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function callSambaNova(
  messages: LlmMessage[],
  model: string,
  options: LlmCallOptions,
  start: number
): Promise<LlmCallResult> {
  const key = process.env.SAMBANOVA_API_KEY;
  if (!key) throw new Error("SAMBANOVA_API_KEY not set");

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeout_ms ?? 30000
  );

  try {
    // SambaNova Cloud: OpenAI-compatible chat completions endpoint.
    // Very fast Llama 3.3 70B (~1000 tok/s). Model IDs use CamelCase
    // (e.g. Meta-Llama-3.3-70B-Instruct) — different from Groq's snake_case.
    const res = await fetch("https://api.sambanova.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.max_tokens ?? 3072,  // SambaNova caps at 3072 for llama-3.3
        response_format: options.json_mode ? { type: "json_object" } : undefined,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const bodyText = await res.text();
      throw new Error(`SambaNova ${res.status}: ${bodyText.slice(0, 200)}`);
    }
    const body = await res.json();
    const text: string = body.choices?.[0]?.message?.content ?? "";
    const json = options.json_mode ? tryParseJson(text) : undefined;
    return {
      provider: "sambanova",
      model,
      text,
      json: json ?? undefined,
      tokens_in: body.usage?.prompt_tokens ?? 0,
      tokens_out: body.usage?.completion_tokens ?? 0,
      ms: Date.now() - start,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function callMistral(
  messages: LlmMessage[],
  model: string,
  options: LlmCallOptions,
  start: number
): Promise<LlmCallResult> {
  const key = process.env.MISTRAL_API_KEY;
  if (!key) throw new Error("MISTRAL_API_KEY not set");

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeout_ms ?? 30000
  );

  try {
    // Mistral La Plateforme: OpenAI-compatible chat completions. Free
    // tier is generous · mistral-small-latest is fast + JSON-reliable ·
    // mistral-medium-latest has vision (declared in PROVIDER_CAPABILITIES).
    const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.max_tokens ?? 4096,
        response_format: options.json_mode ? { type: "json_object" } : undefined,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const bodyText = await res.text();
      throw new Error(`Mistral ${res.status}: ${bodyText.slice(0, 200)}`);
    }
    const body = await res.json();
    const text: string = body.choices?.[0]?.message?.content ?? "";
    const json = options.json_mode ? tryParseJson(text) : undefined;
    return {
      provider: "mistral",
      model,
      text,
      json: json ?? undefined,
      tokens_in: body.usage?.prompt_tokens ?? 0,
      tokens_out: body.usage?.completion_tokens ?? 0,
      ms: Date.now() - start,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function callGroq(
  messages: LlmMessage[],
  model: string,
  options: LlmCallOptions,
  start: number
): Promise<LlmCallResult> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY not set");

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeout_ms ?? 30000
  );

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.max_tokens ?? 4096,
        response_format: options.json_mode ? { type: "json_object" } : undefined,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const bodyText = await res.text();
      throw new Error(`Groq ${res.status}: ${bodyText.slice(0, 200)}`);
    }
    const body = await res.json();
    const text: string = body.choices?.[0]?.message?.content ?? "";
    const json = options.json_mode ? tryParseJson(text) : undefined;
    return {
      provider: "groq",
      model,
      text,
      json: json ?? undefined,
      tokens_in: body.usage?.prompt_tokens ?? 0,
      tokens_out: body.usage?.completion_tokens ?? 0,
      ms: Date.now() - start,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function callCerebras(
  messages: LlmMessage[],
  model: string,
  options: LlmCallOptions,
  start: number
): Promise<LlmCallResult> {
  const key = process.env.CEREBRAS_API_KEY;
  if (!key) throw new Error("CEREBRAS_API_KEY not set");

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeout_ms ?? 30000
  );

  try {
    // Cerebras exposes an OpenAI-compatible chat completions endpoint at
    // /v1/chat/completions. Same body shape as Groq/OpenAI. Fastest
    // available Llama 3.3 70B inference (~2000 tok/s).
    const res = await fetch("https://api.cerebras.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.max_tokens ?? 4096,
        response_format: options.json_mode ? { type: "json_object" } : undefined,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const bodyText = await res.text();
      throw new Error(`Cerebras ${res.status}: ${bodyText.slice(0, 200)}`);
    }
    const body = await res.json();
    const text: string = body.choices?.[0]?.message?.content ?? "";
    const json = options.json_mode ? tryParseJson(text) : undefined;
    return {
      provider: "cerebras",
      model,
      text,
      json: json ?? undefined,
      tokens_in: body.usage?.prompt_tokens ?? 0,
      tokens_out: body.usage?.completion_tokens ?? 0,
      ms: Date.now() - start,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function callGemini(
  messages: LlmMessage[],
  model: string,
  options: LlmCallOptions,
  start: number
): Promise<LlmCallResult> {
  const key = process.env.GOOGLE_GEMINI_API_KEY;
  if (!key) throw new Error("GOOGLE_GEMINI_API_KEY not set");

  // Convert OpenAI-style messages to Gemini contents (with vision).
  const systemInstruction = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => {
      const parts: Array<Record<string, unknown>> = [];
      if (m.images?.length) {
        for (const img of m.images) {
          parts.push({ inline_data: { mime_type: img.mime, data: img.data } });
        }
      }
      if (m.content) parts.push({ text: m.content });
      return {
        role: m.role === "assistant" ? "model" : "user",
        parts,
      };
    });

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeout_ms ?? 45000
  );

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: options.temperature ?? 0.3,
        maxOutputTokens: options.max_tokens ?? 8192,
        responseMimeType: options.json_mode ? "application/json" : undefined,
      },
    };
    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const bodyText = await res.text();
      throw new Error(`Gemini ${res.status}: ${bodyText.slice(0, 200)}`);
    }
    const j = await res.json();
    const text: string =
      j.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
    const json = options.json_mode ? tryParseJson(text) : undefined;
    return {
      provider: "gemini",
      model,
      text,
      json: json ?? undefined,
      tokens_in: j.usageMetadata?.promptTokenCount ?? 0,
      tokens_out: j.usageMetadata?.candidatesTokenCount ?? 0,
      ms: Date.now() - start,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function callCloudflare(
  messages: LlmMessage[],
  model: string,
  options: LlmCallOptions,
  start: number
): Promise<LlmCallResult> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const key = process.env.CLOUDFLARE_WORKERS_AI_TOKEN;
  if (!accountId || !key) {
    throw new Error("CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_WORKERS_AI_TOKEN not set");
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeout_ms ?? 30000
  );

  try {
    // Cloudflare Workers AI: NOT OpenAI-compatible response shape. Path
    // includes account_id and model slug (e.g. @cf/meta/llama-3.3-70b-instruct-fp8-fast).
    // Response: {result:{response:"..."}, success:true, errors:[]}.
    // JSON mode: pass `response_format: {type: "json_schema", json_schema: {...}}`
    // — we use type:"json_object" here for parity; the model outputs
    // parseable JSON when instructed via system prompt.
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        messages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.max_tokens ?? 4096,
        stream: false,
        response_format: options.json_mode ? { type: "json_object" } : undefined,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const bodyText = await res.text();
      throw new Error(`Cloudflare ${res.status}: ${bodyText.slice(0, 200)}`);
    }
    const body = await res.json();
    if (!body.success) {
      throw new Error(`Cloudflare upstream: ${JSON.stringify(body.errors ?? []).slice(0, 200)}`);
    }
    const text: string = body.result?.response ?? "";
    const json = options.json_mode ? tryParseJson(text) : undefined;
    // Cloudflare doesn't return token counts in the standard response
    // shape, so estimate from character length (~4 chars/token).
    const est_in = Math.max(1, Math.floor(JSON.stringify(messages).length / 4));
    const est_out = Math.max(1, Math.floor(text.length / 4));
    return {
      provider: "cloudflare",
      model,
      text,
      json: json ?? undefined,
      tokens_in: body.result?.usage?.prompt_tokens ?? est_in,
      tokens_out: body.result?.usage?.completion_tokens ?? est_out,
      ms: Date.now() - start,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function callHuggingFace(
  messages: LlmMessage[],
  model: string,
  options: LlmCallOptions,
  start: number
): Promise<LlmCallResult> {
  const key = process.env.HUGGINGFACE_API_KEY;
  if (!key) throw new Error("HUGGINGFACE_API_KEY not set");

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeout_ms ?? 45000
  );

  try {
    // HF Router: unified endpoint that transparently proxies to Together /
    // Fireworks / Cerebras / SambaNova / Novita / Hyperbolic etc. under a
    // single HF token. Model IDs use the org/name Hub format
    // (e.g. meta-llama/Llama-3.3-70B-Instruct). OpenAI-compatible.
    const res = await fetch("https://router.huggingface.co/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.max_tokens ?? 4096,
        response_format: options.json_mode ? { type: "json_object" } : undefined,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const bodyText = await res.text();
      throw new Error(`HuggingFace ${res.status}: ${bodyText.slice(0, 200)}`);
    }
    const body = await res.json();
    const text: string = body.choices?.[0]?.message?.content ?? "";
    const json = options.json_mode ? tryParseJson(text) : undefined;
    return {
      provider: "huggingface",
      model,
      text,
      json: json ?? undefined,
      tokens_in: body.usage?.prompt_tokens ?? 0,
      tokens_out: body.usage?.completion_tokens ?? 0,
      ms: Date.now() - start,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function callAnthropic(
  messages: LlmMessage[],
  model: string,
  options: LlmCallOptions,
  start: number
): Promise<LlmCallResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");

  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const nonSystem = messages
    .filter((m) => m.role !== "system")
    .map((m) => {
      // Anthropic vision: content becomes an array of blocks when images present.
      if (m.images?.length) {
        const blocks: Array<Record<string, unknown>> = [];
        for (const img of m.images) {
          blocks.push({
            type: "image",
            source: { type: "base64", media_type: img.mime, data: img.data },
          });
        }
        if (m.content) blocks.push({ type: "text", text: m.content });
        return { role: m.role, content: blocks };
      }
      return { role: m.role, content: m.content };
    });

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeout_ms ?? 45000
  );

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: options.max_tokens ?? 4096,
        temperature: options.temperature ?? 0.3,
        system,
        messages: nonSystem,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const bodyText = await res.text();
      throw new Error(`Anthropic ${res.status}: ${bodyText.slice(0, 200)}`);
    }
    const j = await res.json();
    const text: string = j.content?.[0]?.text ?? "";
    const json = options.json_mode ? tryParseJson(text) : undefined;
    return {
      provider: "anthropic",
      model,
      text,
      json: json ?? undefined,
      tokens_in: j.usage?.input_tokens ?? 0,
      tokens_out: j.usage?.output_tokens ?? 0,
      ms: Date.now() - start,
    };
  } finally {
    clearTimeout(timeout);
  }
}

// ── Mock adapter ─────────────────────────────────────────────────────
//
// Returns a deterministic, plausible response so the whole pipeline
// works with no API key. It inspects the last user message and the
// system message for hints about what kind of output is expected.

async function callMock(
  messages: LlmMessage[],
  model: string,
  options: LlmCallOptions,
  start: number
): Promise<LlmCallResult> {
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const system = messages.find((m) => m.role === "system")?.content ?? "";
  const wantsJson = options.json_mode || /json/i.test(system) || /respond with json/i.test(lastUser);

  // Simulate a short thinking time so worker latency is realistic.
  await new Promise((r) => setTimeout(r, 40 + Math.floor(Math.random() * 60)));

  let text: string;
  let json: unknown | undefined;

  if (wantsJson) {
    // Detect whether this looks like an extraction request vs a check.
    if (/extract|author|structured knowledge|golden rule/i.test(system)) {
      json = mockExtractionResponse(lastUser);
      text = JSON.stringify(json, null, 2);
    } else if (/constitution|quality|check|validate|verify/i.test(system)) {
      json = mockQualityResponse();
      text = JSON.stringify(json, null, 2);
    } else {
      json = { note: "mock adapter · unrecognised prompt", echo: lastUser.slice(0, 80) };
      text = JSON.stringify(json, null, 2);
    }
  } else {
    text = "[mock adapter] " + lastUser.slice(0, 120);
  }

  const tokensIn = Math.max(1, Math.floor((lastUser.length + system.length) / 4));
  const tokensOut = Math.max(1, Math.floor(text.length / 4));

  return {
    provider: "mock",
    model,
    text,
    json,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    ms: Date.now() - start,
  };
}

function mockExtractionResponse(userMsg: string): Record<string, unknown> {
  // Very rough heuristics for demo purposes — enough to produce a
  // record-shaped skeleton. Real Groq/Gemini output is far richer.
  const domain = /kitchen/i.test(userMsg)
    ? "kitchen"
    : /door/i.test(userMsg)
      ? "door"
      : /floor/i.test(userMsg)
        ? "flooring"
        : "staircase";
  const timber =
    userMsg.match(/\b(oak|walnut|maple|beech|ash|sapele|pine|teak|chestnut)\b/i)?.[0]?.toLowerCase() ?? null;
  return {
    candidate_records: [
      {
        record_id: `mock_${domain}_${timber ?? "generic"}_${Date.now().toString(36)}`,
        title: `${domain.charAt(0).toUpperCase() + domain.slice(1)} — ${timber ?? "generic"} extraction`,
        category: `NEX ${domain}`,
        subcategory: "auto-extracted (mock adapter)",
        summary: `Mock adapter extracted a ${domain} record from the supplied text. Replace with real LLM by setting GROQ_API_KEY or GOOGLE_GEMINI_API_KEY.`,
        primary_audience: "homeowner",
        claims: [
          {
            claim_text: timber
              ? `The material discussed appears to be ${timber}.`
              : "No specific timber identified in the passage.",
            classification: timber ? "established_practice" : "design_opinion",
            confidence_band: timber ? "medium" : "low",
            confidence_score: timber ? 0.72 : 0.4,
            source_type: "trade_reference",
            rationale: "Mock adapter heuristic. Real adapter would cite verified sources.",
          },
        ],
        edges: timber
          ? [
              {
                to_record_id: `materials_${timber}_v1`,
                edge_type: "composes_material",
                is_gap_marker: false,
              },
            ]
          : [],
      },
    ],
  };
}

function mockQualityResponse(): Record<string, unknown> {
  // Deterministic pass — mock always says the record is fine at 0.82.
  // That deliberately lands in the UNDER_REVIEW band so mock-produced
  // records surface in Philip's review queue rather than auto-committing.
  return {
    passed: true,
    overall_confidence: 0.82,
    clause_1_owner: "ok",
    clause_2_per_claim_confidence: "ok",
    clause_3_industry_vs_nex_split: "ok",
    clause_4_versioned: "ok",
    clause_5_no_hard_delete: "ok",
    clause_6_typed_relationships: "warn — mock adapter only produced 1 edge; production would require 5+",
    clause_7_claims_trace_to_records: "ok",
    clause_8_no_forward_reference_invention: "ok",
    flags: ["mock-adapter", "under-review-recommended"],
    notes:
      "Mock quality check. Real LLM would apply detailed constitutional analysis. Set GROQ_API_KEY / GOOGLE_GEMINI_API_KEY / ANTHROPIC_API_KEY to use real inference.",
  };
}

// ── Utility ──────────────────────────────────────────────────────────

function tryParseJson(text: string): unknown | null {
  const trimmed = text.trim();
  // Strip code fences if the model wrapped its output.
  const fenceStripped = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(fenceStripped);
  } catch {
    // Try to find the first {...} block.
    const start = fenceStripped.indexOf("{");
    const end = fenceStripped.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(fenceStripped.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

/** Classify a provider error message into a coarse outcome enum for the
 *  audit log. Keeps observability comparable across providers even when
 *  their error text varies. Used by the audit emit in complete(). */
function classifyProviderError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("429") || m.includes("rate limit") || m.includes("quota"))         return "429";
  if (m.includes("aborted") || m.includes("timeout") || m.includes("timed out"))    return "timeout";
  if (m.includes("payment required") || m.includes("402"))                          return "budget_exhausted";
  if (m.match(/\b5\d\d\b/))                                                         return "5xx";
  if (m.includes("network") || m.includes("econnrefused") || m.includes("dns"))     return "network_error";
  if (m.includes("json") || m.includes("parse"))                                    return "invalid_response";
  return "unknown";
}
