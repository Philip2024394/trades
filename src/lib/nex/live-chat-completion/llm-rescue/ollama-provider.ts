// src/lib/nex/live-chat-completion/llm-rescue/ollama-provider.ts
//
// Founder BEGIN Phase 3.4 · Ollama-backed LLM rescue provider.
//
// Zero paid API. Uses the Ollama installation already present (Qwen2.5:3B
// or similar small local model). Streams tokens for real TTFT · settles a
// structured LlmRescueOutput after the JSON body has been received.
//
// The provider ONLY generates. Truth Engine validation lives in a separate
// module (llm-rescue/gate.ts). This split preserves the founder rule that
// LLM output NEVER reaches the customer without evidence-backed validation.

import type { LlmRescueProvider, LlmRescueOutput, RetrievalBundle } from "./contract";
import { parseLlmOutputStrict } from "./output-schema";

const OLLAMA_BASE = process.env.NEX_OLLAMA_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.NEX_OLLAMA_RESCUE_MODEL ?? "qwen2.5:3b";
// Founder AIW-4 · bigger local model on-demand for hard queries.
// Research Brain synthesis (or router.model_class === "reasoning") may
// pass model_size: "large" to select this. Default: same as small model
// so behaviour is unchanged unless the operator opts in.
const OLLAMA_MODEL_LARGE = process.env.NEX_OLLAMA_RESCUE_MODEL_LARGE ?? OLLAMA_MODEL;
const OLLAMA_KEEPALIVE = process.env.NEX_OLLAMA_KEEPALIVE ?? "10m";
export function selectOllamaModel(size?: "small" | "large"): string {
  return size === "large" ? OLLAMA_MODEL_LARGE : OLLAMA_MODEL;
}

// ═══════════════════════════════════════════════════════════════════
// System prompt · zero fabrication invariant
// ═══════════════════════════════════════════════════════════════════

const SYSTEM_PROMPT = `You are NEX. You are answering a customer question, but ONLY using facts from the evidence bundle provided below.

STRICT RULES YOU MUST FOLLOW:
1. You may ONLY state facts that are explicitly present in the evidence bundle.
2. Every fact you state must cite the ref_id of the evidence item it came from.
3. If the evidence bundle does not contain enough information to answer, respond honestly: answered=false with a short unverified_reason.
4. NEVER invent hotel names, addresses, prices, phone numbers, availability, or any other detail not present in the evidence bundle.
5. NEVER cite a source_ref that is not in the evidence bundle. If you do, your response will be rejected.
6. Keep the reply_hint short (1-3 sentences), natural, and useful. It is a suggestion for how to phrase the final customer reply.

DOCTRINE #4 — MEMORY IS NOT TRUTH:
7. If a "USER CONTEXT" section is provided below, it contains user preferences and past user-stated context — NOT verified facts. You may use it to shape TONE, FORMAT, or FILTERING. You must NOT cite it as evidence. There is no ref_id for user context; any claim that references user context must be labelled "based on what you've told me" and must NOT set answered=true unless it is ALSO cited to a real ref_id from the evidence bundle.
8. Custom instructions (about_user, response_style) shape how you write, never what you know.

OUTPUT FORMAT: You MUST output valid JSON in this exact shape:

{
  "answered": true | false,
  "claims": [
    { "text": "short claim", "source_ref": "REF_ID_FROM_EVIDENCE", "confidence": 0.0..1.0 }
  ],
  "reply_hint": "optional short human reply",
  "unverified_reason": "optional short reason when answered=false"
}

Do not include any text before or after the JSON. No markdown fences. Just the JSON object.`;

function formatEvidence(bundle: RetrievalBundle): string {
  if (bundle.items.length === 0) return "(no evidence items · answered must be false)";
  return bundle.items.map((it, idx) => {
    const parts: string[] = [`[ref_id: ${it.ref_id}]`];
    parts.push(`source_type: ${it.source_type}`);
    if (it.entity_ref) parts.push(`entity: ${it.entity_ref}`);
    if (it.intent_slug) parts.push(`intent: ${it.intent_slug}`);
    if (it.confidence !== undefined) parts.push(`confidence: ${it.confidence.toFixed(2)}`);
    if (it.verified_at) parts.push(`verified_at: ${it.verified_at}`);
    if (it.source_reference) parts.push(`source: ${it.source_reference}`);
    return `${idx + 1}. ${parts.join(" · ")}\n   fact: ${it.text}`;
  }).join("\n");
}

function formatUserContext(bundle: RetrievalBundle): string {
  const uc = bundle.user_context;
  if (!uc) return "";
  const lines: string[] = [];
  if (uc.custom_instructions?.about_user) lines.push(`about_user: ${uc.custom_instructions.about_user}`);
  if (uc.custom_instructions?.response_style) lines.push(`response_style: ${uc.custom_instructions.response_style}`);
  if (uc.custom_instructions?.preferred_language) lines.push(`preferred_language: ${uc.custom_instructions.preferred_language}`);
  if (uc.preferences && uc.preferences.length > 0) {
    lines.push("preferences (shape tone / format / filter · NOT facts):");
    for (const p of uc.preferences) lines.push(`  · [${p.category}] ${p.claim_text}`);
  }
  if (uc.user_asserted && uc.user_asserted.length > 0) {
    lines.push("user-stated context (NOT verified · label as 'based on what you\\'ve told me' if you use it):");
    for (const p of uc.user_asserted) lines.push(`  · [${p.category}] ${p.claim_text}`);
  }
  if (lines.length === 0) return "";
  return `\n\nUSER CONTEXT (personalization only · NOT evidence · no ref_ids):\n${lines.join("\n")}`;
}

function buildPrompt(bundle: RetrievalBundle): string {
  const evidence = formatEvidence(bundle);
  const noteBlock = bundle.context_note ? `\n\nContext: ${bundle.context_note}` : "";
  const userContextBlock = formatUserContext(bundle);
  return `Customer question: ${bundle.message}
Language: ${bundle.language}${noteBlock}${userContextBlock}

Evidence bundle (the ONLY facts you may cite):
${evidence}

Respond with the JSON object described above. No prose. Just JSON.`;
}

// ═══════════════════════════════════════════════════════════════════
// Provider
// ═══════════════════════════════════════════════════════════════════

export function makeOllamaRescueProvider(): LlmRescueProvider {
  return {
    name: `ollama:${OLLAMA_MODEL}`,
    async invoke({ bundle, budget_ms, signal }) {
      const t0 = performance.now();
      let ttftMs: number | null = null;
      let completed = false;
      let firstTokenSeen = false;

      const prompt = buildPrompt(bundle);

      const controller = new AbortController();
      const linkedAbort = () => controller.abort();
      if (signal) signal.addEventListener("abort", linkedAbort, { once: true });
      const budgetTimer = setTimeout(() => controller.abort(), Math.max(1, Math.min(60_000, budget_ms)));

      let resolveOutput: (out: LlmRescueOutput) => void = () => {};
      let rejectOutput: (err: unknown) => void = () => {};
      const outputPromise = new Promise<LlmRescueOutput>((resolve, reject) => {
        resolveOutput = resolve;
        rejectOutput = reject;
      });

      // Async generator that yields tokens and, in the finally block,
      // parses the accumulated JSON and settles the output promise.
      async function* tokenStream(): AsyncGenerator<string, void, void> {
        let accumulated = "";
        try {
          const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: OLLAMA_MODEL,
              stream: true,
              keep_alive: OLLAMA_KEEPALIVE,
              format: "json",
              options: { temperature: 0.1, num_predict: 512 },
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: prompt },
              ],
            }),
            signal: controller.signal,
          });
          if (!res.ok || !res.body) {
            const errText = await res.text().catch(() => `HTTP ${res.status}`);
            resolveOutput({
              answered: false,
              claims: [],
              unverified_reason: `provider_error:${res.status}:${errText.slice(0, 100)}`,
            });
            return;
          }
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buf = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            let nl;
            while ((nl = buf.indexOf("\n")) !== -1) {
              const line = buf.slice(0, nl).trim();
              buf = buf.slice(nl + 1);
              if (!line) continue;
              let ev: { message?: { content?: string }; done?: boolean };
              try { ev = JSON.parse(line); } catch { continue; }
              const chunk = ev?.message?.content ?? "";
              if (chunk) {
                if (!firstTokenSeen) {
                  firstTokenSeen = true;
                  ttftMs = Math.round(performance.now() - t0);
                }
                accumulated += chunk;
                yield chunk;
              }
              if (ev?.done) completed = true;
            }
          }
          // Founder BEGIN Phase 3.6 · Zod strict-mode validation.
          const parsed = parseLlmOutputStrict(accumulated);
          if (!parsed.ok) {
            resolveOutput({
              answered: false,
              claims: [],
              unverified_reason: `provider_output_schema_violation:${parsed.errors?.join(";") ?? "unknown"}`.slice(0, 200),
            });
            return;
          }
          resolveOutput(parsed.output!);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg.includes("aborted") || msg.includes("The operation was aborted")) {
            resolveOutput({
              answered: false,
              claims: [],
              unverified_reason: "budget_or_abort",
            });
          } else {
            resolveOutput({
              answered: false,
              claims: [],
              unverified_reason: `provider_exception:${msg.slice(0, 100)}`,
            });
          }
        } finally {
          clearTimeout(budgetTimer);
          if (signal) signal.removeEventListener("abort", linkedAbort);
        }
      }

      // Wrap the generator so callers can iterate AND get provider_meta at end.
      const gen = tokenStream();
      const asyncIter: AsyncIterable<string> = {
        [Symbol.asyncIterator]: () => gen,
      };

      const providerMeta = {
        model: `${OLLAMA_MODEL}`,
        get ttft_ms() { return ttftMs; },
        get total_ms() { return Math.round(performance.now() - t0); },
        get completed() { return completed; },
      };

      return {
        tokens: asyncIter,
        output: outputPromise,
        provider_meta: providerMeta as unknown as {
          model: string; ttft_ms: number | null; total_ms: number | null; completed: boolean;
        },
      };
    },
  };
}

// Founder BEGIN Phase 3.6 · previous hand-rolled parseStrictJson replaced
// by Zod schema validation in ./output-schema.ts (parseLlmOutputStrict).
