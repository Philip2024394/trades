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

export type LlmProvider = "groq" | "gemini" | "anthropic" | "mock";

export type LlmMessage = { role: "system" | "user" | "assistant"; content: string };

export type LlmCallOptions = {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  json_mode?: boolean;
  timeout_ms?: number;
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

// Default model per provider.
const DEFAULT_MODEL: Record<LlmProvider, string> = {
  groq: "llama-3.3-70b-versatile",
  gemini: "gemini-1.5-flash-latest",
  anthropic: "claude-haiku-4-5-20251001",
  mock: "mock-llama-70b",
};

// Circuit breaker config
const CIRCUIT_BREAKER_THRESHOLD = 3;         // consecutive failures to open
const CIRCUIT_BREAKER_COOLDOWN_MS = 60_000;  // how long before half-open retry
const PER_PROVIDER_RETRIES = 2;              // attempts per provider (before backoff to next)
const RETRY_BACKOFF_MS = [500, 2000, 8000];  // one entry per retry

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

const HEALTH: Record<LlmProvider, ProviderHealth> = {
  groq:      { provider: "groq",      consecutive_failures: 0, circuit_open_until: null, last_success_at: null, last_failure_at: null, last_error: null, recent_calls: [] },
  gemini:    { provider: "gemini",    consecutive_failures: 0, circuit_open_until: null, last_success_at: null, last_failure_at: null, last_error: null, recent_calls: [] },
  anthropic: { provider: "anthropic", consecutive_failures: 0, circuit_open_until: null, last_success_at: null, last_failure_at: null, last_error: null, recent_calls: [] },
  mock:      { provider: "mock",      consecutive_failures: 0, circuit_open_until: null, last_success_at: null, last_failure_at: null, last_error: null, recent_calls: [] },
};

// Which providers are configured (have credentials). Mock is always OK.
function providerConfigured(p: LlmProvider): boolean {
  switch (p) {
    case "groq":      return Boolean(process.env.GROQ_API_KEY);
    case "gemini":    return Boolean(process.env.GOOGLE_GEMINI_API_KEY);
    case "anthropic": return Boolean(process.env.ANTHROPIC_API_KEY);
    case "mock":      return true;
  }
}

// Compute the provider chain from LLM_PROVIDER_CHAIN env var, falling
// back to the "best available first" default. Mock is always last.
function providerChain(): LlmProvider[] {
  const raw = process.env.LLM_PROVIDER_CHAIN;
  const seed = raw
    ? raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) as LlmProvider[]
    : ["groq", "gemini", "anthropic"];
  const chain: LlmProvider[] = [];
  for (const p of seed) {
    if ((["groq", "gemini", "anthropic", "mock"] as string[]).includes(p) && providerConfigured(p)) {
      chain.push(p);
    }
  }
  if (!chain.includes("mock")) chain.push("mock"); // always the safety net
  return chain;
}

// Which is the currently-active primary provider? (Chain head after
// skipping any with an open circuit.)
export function activeProvider(): LlmProvider {
  const chain = providerChain();
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
  const providers: ProviderReport[] = (["groq", "gemini", "anthropic", "mock"] as LlmProvider[]).map((p) => {
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
  const chain = providerChain();
  const errors: string[] = [];

  for (const provider of chain) {
    if (isCircuitOpen(provider)) {
      errors.push(`${provider}: circuit-open (skipped)`);
      continue;
    }
    const model = options.model ?? DEFAULT_MODEL[provider];

    // Per-provider retries with exponential backoff
    for (let attempt = 0; attempt < PER_PROVIDER_RETRIES; attempt += 1) {
      const start = Date.now();
      try {
        const result = await dispatchToProvider(provider, messages, model, options, start);
        recordSuccess(provider, result.ms, result.tokens_in + result.tokens_out);
        return result;
      } catch (err) {
        const msg = (err as Error).message;
        const ms = Date.now() - start;
        recordFailure(provider, msg, ms);
        errors.push(`${provider} attempt ${attempt + 1}: ${msg.slice(0, 120)}`);

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
  throw new Error(
    `[nex-brain.llm] all providers exhausted. Chain: [${chain.join(", ")}]. Errors: ${errors.join(" | ")}`
  );
}

async function dispatchToProvider(
  provider: LlmProvider,
  messages: LlmMessage[],
  model: string,
  options: LlmCallOptions,
  start: number
): Promise<LlmCallResult> {
  switch (provider) {
    case "groq":      return callGroq(messages, model, options, start);
    case "gemini":    return callGemini(messages, model, options, start);
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

async function callGemini(
  messages: LlmMessage[],
  model: string,
  options: LlmCallOptions,
  start: number
): Promise<LlmCallResult> {
  const key = process.env.GOOGLE_GEMINI_API_KEY;
  if (!key) throw new Error("GOOGLE_GEMINI_API_KEY not set");

  // Convert OpenAI-style messages to Gemini contents.
  const systemInstruction = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

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
    .map((m) => ({ role: m.role, content: m.content }));

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
