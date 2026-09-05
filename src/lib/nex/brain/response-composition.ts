// src/lib/nex/brain/response-composition.ts
//
// P0 · Response Composition Layer (Philip 2026-09-05 · P0 doctrine §§1-10).
//
// PURPOSE
// -------
// The deterministic Brain (orchestrateChatTurn) produces rich state:
// intent, entities, resolved references, retrieved knowledge, world
// cards, honesty boundaries, verification audits. For structured
// intents (commerce · accommodation · comparison · recommendation ·
// action · verification · safety) the existing gated composers do
// their job well and MUST remain in charge — they enforce honesty
// boundaries the LLM cannot be trusted with.
//
// For OPEN-KNOWLEDGE intents (general questions · greetings-plus-
// questions · cultural/historical/economic queries · topic continuity ·
// reference-driven follow-ups) the deterministic composers currently
// collapse to a canned "Happy to chat" fallback. That is the P0 gap
// this module fixes.
//
// This module wraps a local Ollama call to compose a NATURAL LANGUAGE
// reply for open-knowledge intents, GIVEN:
//
//   · the Live Conversational Frame (running topic, resolved references,
//     recent turns) — so continuity is preserved
//   · the retrieved knowledge hits (Indonesia RAG results) — so any
//     facts stated are grounded in retrieval
//   · the BrainReply state (entities, current reference, intent,
//     confidence audit) — so composition subordinates to Brain decisions
//   · the user's latest message
//
// The composed text is subject to claim-level post-verification
// (claim-verification.ts) BEFORE being returned. If verification
// rejects the composition, the caller falls back to the deterministic
// reply — hallucination silently corrected, never surfaced to owner.
//
// DISCIPLINE (per P0 doctrine)
// ----------------------------
//   · Never invent facts (§2 Evidence-Grounded Fluency)
//   · Never override Brain decisions (§3 Epistemic Subordination)
//   · Always subordinate to retrieval + honesty boundaries
//   · Fail closed: any error → fall back to deterministic reply
//   · Never touch commerce / accommodation / comparison / recommendation
//     / action / verification / safety paths
//
// This module owns only the OPEN-KNOWLEDGE reply text.

import type { ConversationalFrame } from "./conversational-frame";
import { frameToPromptBlock } from "./conversational-frame";
import { getModelForRole } from "./model-registry";

// ─── Config ────────────────────────────────────────────────────────

const OLLAMA_URL = process.env.NEX_LOCAL_LLM_URL ?? "http://localhost:11434";
const PRIMARY_MODEL = process.env.NEX_P0_MODEL_PRIMARY ?? getModelForRole("brain.primary_local").ollamaTag;
const FALLBACK_MODEL = process.env.NEX_P0_MODEL_FALLBACK ?? getModelForRole("brain.fast_local").ollamaTag;
// Cold-load of qwen2.5:7b into 4GB VRAM takes ~15s on the dev laptop
// (measured 2026-09-05). Warm calls return in <2s. 30s gives comfortable
// margin for cold start · warm calls will not approach this bound.
const SOFT_TIMEOUT_MS = Number(process.env.NEX_P0_TIMEOUT_MS ?? "30000");
const TEMPERATURE = Number(process.env.NEX_P0_TEMPERATURE ?? "0.3");
const MAX_TOKENS = Number(process.env.NEX_P0_MAX_TOKENS ?? "400");

// ─── Types ─────────────────────────────────────────────────────────

export type KnowledgeSnippet = {
  topic?: string;
  content: string;
  source?: string;
  region?: string;
  last_verified?: string;
  stability?: string;
  score?: number;
};

export type CompositionInput = {
  /** The user's raw current-turn message. */
  message: string;
  /** The Live Conversational Frame for this turn. */
  frame: ConversationalFrame;
  /** Retrieved knowledge snippets available for this turn.
   *  Empty array = no knowledge · composition should acknowledge the
   *  gap rather than invent. */
  knowledge: KnowledgeSnippet[];
  /** The deterministic Brain's intent for this turn. Used for prompt
   *  framing only · never overridden. */
  intent?: string;
  /** The deterministic Brain's baseline reply text. Passed to the LLM
   *  as a "reference draft" · the LLM may improve continuity/fluency
   *  but must preserve any honesty boundaries the draft included. */
  brain_reply?: string;
  /** Additional owner-facing entities the Brain has recognised · the
   *  LLM can use these as anchors but must not fabricate new ones. */
  known_entities?: string[];
  /** Owner-side language preference · influences reply language. */
  owner_language?: "en" | "id";
};

export type CompositionResult = {
  /** The composed reply text, or `null` if composition failed / disabled. */
  text: string | null;
  /** Which model produced it (or `null` on failure). */
  model: string | null;
  /** Whether we fell back to the smaller model after primary failed. */
  fell_back: boolean;
  /** Latency of the actual LLM call in ms. */
  latency_ms: number | null;
  /** Prompt token count (best-effort · from Ollama response). */
  prompt_tokens: number | null;
  /** Response token count (best-effort · from Ollama response). */
  response_tokens: number | null;
  /** If null text · why. */
  reason?: string;
};

// ─── System prompt (locked · §2, §3, §6, §7, §10) ─────────────────

const SYSTEM_PROMPT = [
  "You are NEX — an Indonesian-first business operating intelligence assistant.",
  "",
  "ABSOLUTE RULES · these are non-negotiable · violating them ends the reply:",
  "",
  "1. EVIDENCE OR SILENCE.",
  "   · Only state facts that are present in the [KNOWLEDGE] block, or that you can derive from the [CONVERSATION FRAME].",
  "   · If asked for a specific number, date, price, phone number, URL, or named person that is NOT in [KNOWLEDGE] — say clearly you do not have that specific detail, and offer to look it up or explain what you do know at a general level.",
  "   · NEVER invent a phone number, address, price, exchange rate, statistic, name, or year.",
  "",
  "2. SUBORDINATE TO THE BRAIN.",
  "   · The Brain has already decided the intent and prepared a reference draft ([BRAIN_DRAFT]). You may reshape wording for continuity and warmth, but you must not contradict any explicit boundary the draft states.",
  "   · If the draft says 'I never invent price or availability' — that boundary carries into your reply.",
  "",
  "3. USE THE CONVERSATION FRAME.",
  "   · [CONVERSATION FRAME] tells you what the user is currently talking about (topic, subject, resolved references, recent turns).",
  "   · If the current turn is a bare follow-up ('and yogyakarta?', 'what about the food scene there?', 'is it healthier than tofu?'), carry the prior topic/subject forward. Do not restart the conversation.",
  "",
  "4. UTILITY OVER FLUENCY.",
  "   · A short, useful, honest answer beats a long, generic one.",
  "   · If the user asked something you can partly answer, do that; then name the gap.",
  "   · Never fall back to 'Happy to chat, ask me about Indonesia' — that phrase is banned.",
  "",
  "5. LANGUAGE.",
  "   · If the user's message is in Indonesian, reply in Indonesian.",
  "   · Otherwise reply in English.",
  "   · Match the register: casual for casual, professional for professional.",
  "",
  "6. LENGTH.",
  "   · Aim for 2-5 sentences unless the user asked for depth.",
  "   · Never dump lists longer than 5 items.",
  "",
  "OUTPUT FORMAT.",
  "   · Reply directly · no preamble like 'Sure!' or 'Great question!'",
  "   · No headers, no bullet lists unless the user asked for a list.",
  "   · No markdown emphasis (no ** or __).",
].join("\n");

// ─── Public API ────────────────────────────────────────────────────

/**
 * Compose a natural-language reply via local Ollama, subject to the
 * discipline in the system prompt. Returns { text: null, reason }
 * on any error · caller MUST have a deterministic fallback ready.
 *
 * Never throws. Always resolves.
 */
export async function composeReplyViaLocalLLM(
  input: CompositionInput,
): Promise<CompositionResult> {
  const t0 = Date.now();
  const userPrompt = buildUserPrompt(input);

  // Try primary
  const primary = await callOllama(PRIMARY_MODEL, userPrompt);
  if (primary.ok) {
    return {
      text: sanitizeReply(primary.text),
      model: PRIMARY_MODEL,
      fell_back: false,
      latency_ms: Date.now() - t0,
      prompt_tokens: primary.promptTokens,
      response_tokens: primary.responseTokens,
    };
  }

  // Try fallback
  const fallback = await callOllama(FALLBACK_MODEL, userPrompt);
  if (fallback.ok) {
    return {
      text: sanitizeReply(fallback.text),
      model: FALLBACK_MODEL,
      fell_back: true,
      latency_ms: Date.now() - t0,
      prompt_tokens: fallback.promptTokens,
      response_tokens: fallback.responseTokens,
      reason: `primary_failed: ${primary.reason}`,
    };
  }

  return {
    text: null,
    model: null,
    fell_back: false,
    latency_ms: Date.now() - t0,
    prompt_tokens: null,
    response_tokens: null,
    reason: `primary_failed: ${primary.reason} · fallback_failed: ${fallback.reason}`,
  };
}

// ─── Internals ─────────────────────────────────────────────────────

function buildUserPrompt(input: CompositionInput): string {
  const parts: string[] = [];

  const langLabel = input.owner_language === "id" ? "Indonesian" : "English";
  parts.push(`[LANGUAGE] The user's message is in ${langLabel}. You MUST reply in ${langLabel}. Do not switch languages.`);
  parts.push("");

  parts.push(frameToPromptBlock(input.frame));

  if (input.known_entities && input.known_entities.length) {
    parts.push(`\n[KNOWN ENTITIES]\n${input.known_entities.slice(0, 20).join(", ")}`);
  }

  parts.push("\n[KNOWLEDGE]");
  if (!input.knowledge.length) {
    parts.push("(no retrieved knowledge for this turn · rely on the frame and be honest about gaps)");
  } else {
    input.knowledge.slice(0, 6).forEach((k, i) => {
      const header = [
        `#${i + 1}`,
        k.topic ? `topic="${k.topic}"` : null,
        k.region ? `region=${k.region}` : null,
        k.stability ? `stability=${k.stability}` : null,
      ].filter(Boolean).join(" · ");
      parts.push(`${header}\n${truncate(k.content, 600)}`);
    });
  }

  if (input.brain_reply) {
    parts.push(`\n[BRAIN_DRAFT]\n${truncate(input.brain_reply, 600)}`);
  }

  if (input.intent) {
    parts.push(`\n[INTENT] ${input.intent}`);
  }

  parts.push(`\n[USER TURN]\n${input.message}`);

  parts.push("\n[YOUR REPLY · plain text · 2-5 sentences · evidence or silence]");

  return parts.join("\n");
}

type OllamaCallResult =
  | { ok: true; text: string; promptTokens: number | null; responseTokens: number | null }
  | { ok: false; reason: string };

async function callOllama(model: string, userPrompt: string): Promise<OllamaCallResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), SOFT_TIMEOUT_MS);
  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        options: { temperature: TEMPERATURE, num_predict: MAX_TOKENS },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      return { ok: false, reason: `http_${res.status}` };
    }
    const json = (await res.json()) as {
      message?: { content?: string };
      prompt_eval_count?: number;
      eval_count?: number;
    };
    const text = (json.message?.content ?? "").trim();
    if (!text) return { ok: false, reason: "empty_content" };
    return {
      ok: true,
      text,
      promptTokens: json.prompt_eval_count ?? null,
      responseTokens: json.eval_count ?? null,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, reason: `exception: ${msg}` };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Strip common LLM preambles + markdown emphasis + code fences.
 * Ensures we don't ship '**Sure!** ...' or '```\n...\n```'.
 */
function sanitizeReply(text: string): string {
  let t = text.trim();
  // Strip code fences
  t = t.replace(/^```[a-zA-Z]*\s*/g, "").replace(/```\s*$/g, "");
  // Strip common preambles
  t = t.replace(/^(sure!?|great question!?|absolutely!?|of course!?)[\s,\.!:—-]*/i, "");
  // Strip bold / italic emphasis
  t = t.replace(/\*\*/g, "").replace(/__/g, "");
  // Collapse doubled blank lines
  t = t.replace(/\n{3,}/g, "\n\n");
  return t.trim();
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
