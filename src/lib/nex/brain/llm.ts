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

// ── Provider selection ───────────────────────────────────────────────

export function activeProvider(): LlmProvider {
  if (process.env.GROQ_API_KEY) return "groq";
  if (process.env.GOOGLE_GEMINI_API_KEY) return "gemini";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return "mock";
}

// Default model per provider — chosen for structured extraction quality.
const DEFAULT_MODEL: Record<LlmProvider, string> = {
  groq: "llama-3.3-70b-versatile",
  gemini: "gemini-1.5-flash-latest",
  anthropic: "claude-haiku-4-5-20251001",
  mock: "mock-llama-70b",
};

// ── Public API ───────────────────────────────────────────────────────

export async function complete(
  messages: LlmMessage[],
  options: LlmCallOptions = {}
): Promise<LlmCallResult> {
  const provider = activeProvider();
  const model = options.model ?? DEFAULT_MODEL[provider];
  const start = Date.now();

  try {
    if (provider === "groq") return await callGroq(messages, model, options, start);
    if (provider === "gemini") return await callGemini(messages, model, options, start);
    if (provider === "anthropic") return await callAnthropic(messages, model, options, start);
    return await callMock(messages, model, options, start);
  } catch (err) {
    // On any failure, fall back to mock so the pipeline never hard-fails
    // in dev. Real production would surface + retry.
    console.error(`[nex-brain.llm] ${provider} call failed, falling back to mock:`, err);
    return await callMock(messages, DEFAULT_MODEL.mock, options, start);
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
