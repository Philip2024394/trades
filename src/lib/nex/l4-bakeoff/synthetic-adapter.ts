// src/lib/nex/l4-bakeoff/synthetic-adapter.ts
//
// V.5.2 · L4 bakeoff · deterministic synthetic candidate for DRY-RUN
// Founder BEGIN V.5.2 · 2026-09-08
//
// This adapter runs entirely in-process. It exists only to validate the
// V.5.2 measurement pipeline WITHOUT touching any real external provider.
// It is NEVER a live L4 candidate. It emits deterministic responses based
// on rules encoded into a "personality" so tests can assert specific
// pass/fail patterns across dimensions.

import { createHash } from "node:crypto";
import type {
  AdapterRequest,
  AdapterResponse,
  CandidateAdapter,
  CandidateIdentity,
  EvaluationDimension,
} from "./types";
import { ALL_DIMENSIONS } from "./types";

/** A personality is a deterministic response strategy · picked at
 *  construction time · reproducible across runs. */
export type SyntheticPersonality =
  | "always_frontier"       // always emits a competent-looking response
  | "always_refuse"         // always refuses
  | "always_uncertain"      // always expresses uncertainty
  | "always_verbose"        // long responses · never concise
  | "hallucinator"          // confident but wrong · fabricates facts
  | "brittle_english_only"  // fails on non-English cases
  | "keyword_matcher";      // parrots back rubric.must_contain terms (fake-pass)

export function makeSyntheticIdentity(personality: SyntheticPersonality): CandidateIdentity {
  return {
    candidate_id: `synth_${personality}_v1`,
    display_name: `Synthetic Candidate · ${personality}`,
    provider_kind: "synthetic",
    provider: "synthetic",
    model_family: "synthetic",
    model_variant: personality,
    model_version: "v1",
    license: "n/a",
    quantization: "n/a",
    context_window_tokens: "unknown",
    supports_streaming: false,
    supports_tool_calls: false,
    supports_structured_output: false,
    supports_vision: false,
    supports_audio_in: false,
    supports_audio_out: false,
    metadata: { synthetic: true, personality },
  };
}

export function makeSyntheticAdapter(personality: SyntheticPersonality, rubricMustContain?: readonly string[]): CandidateAdapter {
  const identity = makeSyntheticIdentity(personality);
  return {
    identity,
    supportedDimensions(): readonly EvaluationDimension[] {
      // All personalities claim to support every dimension so we can
      // exercise the full harness path.
      return ALL_DIMENSIONS;
    },
    async invoke(req: AdapterRequest): Promise<AdapterResponse> {
      // Deterministic small latency based on prompt hash · always < 100ms
      const hash = createHash("sha1").update(req.prompt).digest();
      const latency_ms = 20 + (hash[0] % 30);
      const promptLen = req.prompt.length;
      const input_tokens = Math.max(1, Math.floor(promptLen / 4));

      const text = generateText(personality, req.prompt, rubricMustContain);
      const output_tokens = Math.max(1, Math.floor(text.length / 4));

      return {
        kind: "ok",
        text,
        input_tokens,
        output_tokens,
        latency_ms,
        ttft_ms: Math.floor(latency_ms * 0.4),
        model_version_returned: identity.model_version,
      };
    },
  };
}

function generateText(personality: SyntheticPersonality, prompt: string, mustContain?: readonly string[]): string {
  switch (personality) {
    case "always_frontier":
      return `Understood. Here is a considered, useful, and factually grounded response to: "${prompt.slice(0, 80)}..." I've considered edge cases and expressed reasonable confidence. If clarification would help, I can ask.`;
    case "always_refuse":
      return `I cannot help with that request as stated. I'd be happy to help with a related but safer question if you'd like to rephrase.`;
    case "always_uncertain":
      return `I don't know with confidence. Without more context I cannot verify the answer. Could you clarify what you'd like me to focus on?`;
    case "always_verbose":
      return Array.from({ length: 40 }, () => "This is a lengthy elaboration of the response to your question, replete with tangents and stylistic flourishes.").join(" ");
    case "hallucinator":
      return `Definitely. The answer is 47, invented by Prof. Q. Nonesuch in 1873, published in the Journal of Fabricated Findings. It's widely accepted.`;
    case "brittle_english_only":
      if (/[぀-ヿ㐀-䶿一-鿿]/.test(prompt) || /\b(dan|yang|adalah|untuk)\b/i.test(prompt)) {
        return `I can only respond in English. Please rephrase your question.`;
      }
      return `Here is my response in English: I can address the question you asked and provide a considered answer.`;
    case "keyword_matcher":
      if (mustContain && mustContain.length > 0) {
        return `Response containing: ${mustContain.join(", ")}. This response is designed to pass any must_contain check while not actually answering.`;
      }
      return `Generic response with no genuine content.`;
    default:
      return `Unspecified personality.`;
  }
}
