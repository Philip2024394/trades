// src/lib/nex/brains/_synthesis.ts
//
// D1 Runtime · Answer Synthesis (Philip 2026-07-28)
// ─────────────────────────────────────────────────
// Composes an answer envelope from retrieved published content. Two
// synthesizer implementations · pluggable:
//
//   1. RetrievalOnlySynthesizer (default · no LLM · SHIPS TODAY)
//      Concatenates retrieved content with citations. Zero invention
//      risk. Enough to run Validation v1.0 Phase 2 on Terminology.
//
//   2. LlmSynthesizer (interface only · SDK to be added later)
//      Passes retrieved content to an LLM with a strict prompt: "answer
//      ONLY from this content, cite sources, mark unknown when not
//      addressed." The LLM composes prose; it never authors knowledge.
//
// Philip's three hard rules encoded in this module:
//   Rule 1 · Published knowledge always wins
//   Rule 2 · Unknown means unknown
//   Rule 3 · Every factual statement has provenance

import type { LoadedBrain } from "./_types";
import type { BrainAnswerEnvelope, BrainAnswerKind } from "./_living_types";
import { buildBrainAnswerEnvelope } from "./_explainability";
import type { Intent } from "./_intent";
import type { RetrievalResult, RetrievedTopic } from "./_retrieval";

export type SynthesisInput = {
  brain: LoadedBrain;
  brain_slug: string;
  brain_version: string;
  brain_version_id: string;
  query: string;
  intent: Intent;
  retrieval: RetrievalResult;
};

export interface Synthesizer {
  synthesize(input: SynthesisInput): Promise<BrainAnswerEnvelope>;
}

// ---------- Retrieval-only synthesizer (default) ----------

export class RetrievalOnlySynthesizer implements Synthesizer {
  async synthesize(input: SynthesisInput): Promise<BrainAnswerEnvelope> {
    const { brain_slug, brain_version, brain_version_id, query, intent, retrieval } = input;

    // Rule · out_of_scope
    if (intent.kind === "out_of_scope") {
      return buildBrainAnswerEnvelope({
        answer:
          "This question appears to be about a different domain. The Staircase Brain answers questions about interior domestic staircase design, manufacture, installation and compliance. For other trades or garden staircases, use the appropriate brain.",
        reason: `Intent classified as out_of_scope · matched keywords: ${intent.matched_keywords.join(", ")}`,
        brain_slug,
        brain_version,
        brain_version_id,
        confidence: 0.9,
        evidence: [],
        trade_rule: null,
        answer_kind: "out_of_scope",
      });
    }

    // Rule · unknown means unknown
    if (retrieval.no_content_found) {
      return buildBrainAnswerEnvelope({
        answer: buildUnknownExplanation(intent),
        reason: `No published content found matching intent '${intent.kind}' with candidates [${intent.candidate_topics.join(", ") || "none"}]`,
        brain_slug,
        brain_version,
        brain_version_id,
        confidence: 0,
        evidence: [],
        trade_rule: null,
        answer_kind: "unknown",
      });
    }

    // Compose the answer from retrieved hits
    const answerText = composeAnswer(query, intent, retrieval.hits);
    const answerKind: BrainAnswerKind =
      retrieval.matched_modules.length > 1 ? "derived" : "verified";

    // Confidence: verified single-module hits with strong intent → 0.95
    // derived multi-module composition → 0.85
    // low-intent match → 0.6
    const confidence =
      answerKind === "verified" && intent.confidence >= 0.8 ? 0.95 :
      answerKind === "derived" ? 0.85 :
      0.6;

    const tradeRule = extractTradeRule(retrieval.hits);

    return buildBrainAnswerEnvelope({
      answer: answerText,
      reason: buildReason(retrieval, intent),
      brain_slug,
      brain_version,
      brain_version_id,
      confidence,
      evidence: retrieval.evidence,
      trade_rule: tradeRule,
      answer_kind: answerKind,
    });
  }
}

// ---------- LLM synthesizer (interface · Anthropic/OpenAI adapter to be added) ----------

/**
 * Placeholder interface for a future LLM-backed synthesizer.
 *
 * When implemented, the LLM will be called with:
 *   - The user query
 *   - The retrieval result (verbatim content + citations)
 *   - A strict system prompt: "Answer ONLY from the content above.
 *     Do not add information from training data. If content does not
 *     fully address the question, say so and set answer_kind='unknown'.
 *     Cite the sources. Do not speculate."
 *
 * Wiring the LLM SDK is a small addition when the API key is available.
 * The interface below is stable; only the implementation changes.
 */
export interface LlmSynthesizerAdapter {
  callLlm(prompt: string, systemPrompt: string): Promise<string>;
}

export class LlmAugmentedSynthesizer implements Synthesizer {
  constructor(private readonly llm: LlmSynthesizerAdapter) {}

  async synthesize(input: SynthesisInput): Promise<BrainAnswerEnvelope> {
    // For v1: delegate to retrieval-only for the base envelope, then
    // OPTIONALLY use the LLM to polish the language WITHOUT changing
    // the underlying facts. If LLM output contains anything not in the
    // retrieved content, the envelope falls back to retrieval-only.
    const base = new RetrievalOnlySynthesizer();
    const envelope = await base.synthesize(input);

    if (envelope.answer_kind === "unknown" || envelope.answer_kind === "out_of_scope") {
      // Unknown/out-of-scope answers are never LLM-composed — no invention path.
      return envelope;
    }

    try {
      const systemPrompt = buildLlmSystemPrompt();
      const userPrompt = buildLlmUserPrompt(input, envelope);
      const raw = await this.llm.callLlm(userPrompt, systemPrompt);
      // Validate: LLM output must not add claims outside envelope.answer + retrieved content
      const validated = validateLlmOutput(raw, input, envelope);
      if (validated) {
        return { ...envelope, answer: validated };
      }
    } catch (err) {
      console.warn("[synthesis] LLM call failed · falling back to retrieval-only:", err);
    }
    return envelope;
  }
}

// ---------- Composition helpers ----------

function composeAnswer(_query: string, intent: Intent, hits: RetrievedTopic[]): string {
  if (hits.length === 0) return "";

  // Single-hit terminology lookup: return the definition + purpose
  if (intent.kind === "terminology_lookup" && hits.length === 1) {
    const hit = hits[0];
    const def = pickString(hit.content, "definition") ?? pickString(hit.content, "value") ?? pickString(hit.content, "description");
    const purpose = pickString(hit.content, "purpose");
    const mistakes = pickStringArray(hit.content, "common_mistakes");

    const parts: string[] = [];
    if (def) parts.push(def);
    if (purpose) parts.push(`Purpose: ${purpose}`);
    if (mistakes && mistakes.length > 0) {
      parts.push(`Common mistake${mistakes.length > 1 ? "s" : ""}: ${mistakes.join(" · ")}`);
    }
    return parts.join("\n\n") || fallbackAnswerFromHit(hit);
  }

  // Comparison: describe each hit in turn
  if (intent.kind === "comparison" && hits.length >= 2) {
    const parts: string[] = [];
    for (const hit of hits.slice(0, 3)) {
      const def = pickString(hit.content, "definition") ?? pickString(hit.content, "description");
      parts.push(`${hit.topic.replace(/_/g, " ")}: ${def ?? "(no definition captured)"}`);
    }
    return parts.join("\n\n");
  }

  // General case: concatenate the top hits' most useful field
  return hits.slice(0, 3).map(fallbackAnswerFromHit).filter(Boolean).join("\n\n");
}

function fallbackAnswerFromHit(hit: RetrievedTopic): string {
  const preferred = ["definition", "value", "description", "purpose", "summary", "answer"];
  for (const k of preferred) {
    const v = pickString(hit.content, k);
    if (v) return `${hit.topic.replace(/_/g, " ")}: ${v}`;
  }
  // Last resort · serialise a minimal view
  const summary = Object.entries(hit.content)
    .filter(([k, v]) => !k.startsWith("_") && (typeof v === "string" || typeof v === "number"))
    .slice(0, 3)
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ");
  return summary ? `${hit.topic.replace(/_/g, " ")} · ${summary}` : "";
}

function buildUnknownExplanation(intent: Intent): string {
  if (intent.kind === "unknown_intent") {
    return "I couldn't identify what this question is asking about within the Staircase Brain's current published knowledge. Please rephrase, or check whether this belongs to a different brain.";
  }
  if (intent.candidate_topics.length > 0) {
    return `I do not have verified published knowledge for ${intent.candidate_topics.map((t) => `'${t.replace(/_/g, " ")}'`).join(", ")} in the current version of the Staircase Brain. This topic is on the authoring backlog.`;
  }
  return `The Staircase Brain has no published content addressing this ${intent.kind.replace(/_/g, " ")} question yet.`;
}

function buildReason(retrieval: RetrievalResult, intent: Intent): string {
  const parts = [
    `Intent: ${intent.kind}`,
    `Modules matched: ${retrieval.matched_modules.join(", ") || "none"}`,
    `Topics matched: ${retrieval.hits.map((h) => h.topic).join(", ") || "none"}`,
  ];
  return parts.join(" · ");
}

function extractTradeRule(hits: RetrievedTopic[]): string | null {
  for (const hit of hits) {
    const hard = hit.content.hard_rule ?? hit.content.hard_rules ?? hit.content.rule;
    if (typeof hard === "string") return hard;
    if (Array.isArray(hard) && hard.length > 0 && typeof hard[0] === "string") return hard[0] as string;
  }
  return null;
}

function pickString(obj: Record<string, unknown>, key: string): string | null {
  const v = obj[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}

function pickStringArray(obj: Record<string, unknown>, key: string): string[] | null {
  const v = obj[key];
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  return null;
}

// ---------- LLM prompt scaffolding (used when LLM adapter is wired) ----------

function buildLlmSystemPrompt(): string {
  return [
    "You are the Reference Brain Runtime for the NEX platform.",
    "You do NOT generate knowledge. You retrieve, compose, and explain published, expert-authored content.",
    "",
    "STRICT RULES:",
    "1. Answer ONLY from the CONTENT block provided by the user prompt.",
    "2. Do NOT add facts from your training data.",
    "3. If the CONTENT does not fully answer the question, say so explicitly · do not fabricate.",
    "4. Cite the SOURCES provided · do not invent citations.",
    "5. Match the user's language level (technical for technical questions · simple for beginner questions).",
    "6. Do NOT speculate. Do NOT extrapolate.",
  ].join("\n");
}

function buildLlmUserPrompt(input: SynthesisInput, envelope: BrainAnswerEnvelope): string {
  const contentDump = input.retrieval.hits
    .map((h) => `--- ${h.module}.${h.topic} ---\n${JSON.stringify(h.content, null, 2)}`)
    .join("\n\n");
  const sourceDump = envelope.evidence.map((e) => `- ${e.kind}: ${e.ref}${e.excerpt ? " · " + e.excerpt : ""}`).join("\n");
  return [
    `USER QUESTION: ${input.query}`,
    "",
    "CONTENT (published expert-authored knowledge · this is your ONLY source):",
    contentDump,
    "",
    "SOURCES (cite these · do not invent):",
    sourceDump,
    "",
    "Compose a natural-language answer that stays strictly within the CONTENT. Cite sources naturally.",
  ].join("\n");
}

/**
 * Sanity-check LLM output. If it contains claims not grounded in the
 * retrieved content, return null (caller falls back to retrieval-only).
 * v1: very simple length + non-empty check. v2: more sophisticated
 * grounding validation.
 */
function validateLlmOutput(raw: string, _input: SynthesisInput, _envelope: BrainAnswerEnvelope): string | null {
  const trimmed = raw.trim();
  if (trimmed.length < 8) return null;
  if (trimmed.length > 4000) return null;      // suspicious over-generation
  return trimmed;
}

// ---------- Factory (env-driven selection) ----------

/**
 * Returns the active synthesizer for this process. When an LLM SDK is
 * wired later, extend this to return an LlmAugmentedSynthesizer when
 * the API key is present.
 */
export function getSynthesizer(): Synthesizer {
  // Future: if (process.env.ANTHROPIC_API_KEY) return new LlmAugmentedSynthesizer(new AnthropicAdapter());
  return new RetrievalOnlySynthesizer();
}
