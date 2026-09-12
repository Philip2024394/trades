// src/lib/nex/l4-bakeoff/candidates/ollama-qwen3-8b.ts
//
// V.5.4.1 · FIRST REAL SELF-HOSTED CANDIDATE · Ollama-served Qwen3-8B
// Founder BEGIN V.5.4 · 2026-09-08
//
// Combines the existing Ollama NexBrainProvider (which enforces local-
// endpoint + zero third-party AI per ADR-0044) with a CandidateIdentity
// and the brain-provider-adapter bridge to produce the FIRST real L4
// bakeoff candidate.
//
// SELF-SUSTAINMENT DOCTRINE: is_paid_third_party: false · Ollama runs
// LOCALLY only · endpoint constrained to localhost/127.0.0.1/::1/*.local
// at Ollama-adapter construction time.
//
// GATEWAY SINGLE-CHOKE-POINT DOCTRINE §8: this candidate is invoked ONLY
// via the L4 bakeoff harness · which is itself a single choke point for
// evaluation-time inference. Production runtime uses the LLM Gateway
// (also single choke point). No direct SDK calls anywhere.
//
// LIVE INVOCATION: requires a running Ollama server + the specified
// model installed. This module builds the candidate; harness runs it.
// If Ollama unavailable at run time · adapter returns network_failure
// gracefully (per bridge contract).

import { createOllamaBrainProvider } from "@/lib/nex/brain/providers/ollama";
import type { CandidateAdapter, CandidateIdentity } from "../types";
import { makeBrainProviderCandidateAdapter } from "../brain-provider-adapter";

// ═══════════════════════════════════════════════════════════════════
// § A · IDENTITY
// ═══════════════════════════════════════════════════════════════════

export type OllamaQwen3_8bOptions = {
  /** Overrideable model tag. Default: whatever the brain/model-registry
   *  reports for `brain.primary_local`. Pinning here for candidate identity
   *  purposes only — production paths pin via env `NEX_RESPONSE_MODEL`. */
  model_tag?: string;
  /** Ollama server URL · defaults from Ollama adapter itself (localhost). */
  url?: string;
  /** Whether to enforce streaming from Ollama · usually true for TTFT capture. */
  stream?: boolean;
  /** V.5.4.3-002 · per-request HTTP timeout in ms. Default in the underlying
   *  Ollama provider is 60_000 which is too tight for CPU-spilled inference
   *  on modest GPUs (a 512-token response at ~5 tok/sec can take 100+ sec).
   *  Set 300_000 for controlled bakeoff runs. Never affects sampling. */
  timeoutMs?: number;
};

/** Identity for the Ollama-hosted Qwen3-8B candidate. Deterministic ·
 *  no fabricated fields · UNKNOWN honestly when not verifiable at
 *  construction time. */
export function makeOllamaQwen3_8bIdentity(opts: OllamaQwen3_8bOptions = {}): CandidateIdentity {
  const modelTag = opts.model_tag ?? "qwen3:8b";
  return {
    candidate_id: `ollama_qwen3_8b_v1`,
    display_name: `Ollama · Qwen3-8B (self-hosted)`,
    provider_kind: "self_hosted_open_weight",
    provider: "ollama",
    model_family: "qwen3",
    model_variant: "8b",
    model_version: modelTag,
    license: "Apache-2.0",
    quantization: "unknown",             // depends on which Qwen3-8B tag installed · verified only at real-invocation time
    context_window_tokens: "unknown",    // model-tag-dependent · never fabricated
    supports_streaming: opts.stream !== false,
    supports_tool_calls: true,           // Qwen3 supports tool use natively
    supports_structured_output: false,   // not first-class in Ollama today · flagged UNKNOWN by default
    supports_vision: false,              // qwen3:8b is text-only · vision requires qwen2.5vl
    supports_audio_in: false,
    supports_audio_out: false,
    metadata: {
      is_paid_third_party: false,
      self_sustainment_compliant: true,
      requires_running_ollama_server: true,
      requires_model_installed: modelTag,
      // Founder correction 2026-09-08 · V.5.4.1 defaulted to qwen3:8b
      // without evaluation. Founder shortlist decision 2026-09-08 then
      // promoted this identity to `shortlisted_for_v5_4_3` with the
      // explicit purpose of LOW-RESOURCE BASELINE (not expected winner).
      // See candidates/free-slate-v1.ts for the full 7-candidate slate.
      // NO chosen_default exists yet · Founder verbatim: "keep all seven
      // unselected_pending_l4_bakeoff until the measurements exist" —
      // interpreted as "no chosen_default before measured evidence".
      selection_status: "shortlisted_for_v5_4_3",
      selection_justification: "Small/local baseline · Founder V.5.4.3 shortlist 2026-09-08 · answers 'how much intelligence do we gain by going from Qwen3-8B → 14B → 24B?' · classified as LOW-RESOURCE BASELINE not expected winner",
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// § B · CANDIDATE ADAPTER (built via bridge)
// ═══════════════════════════════════════════════════════════════════

/** Build the Ollama-Qwen3-8B candidate adapter. Real inference happens
 *  only when the harness invokes it AND Ollama is reachable AND the
 *  model is installed. Otherwise the bridge returns network_failure /
 *  model_failure gracefully. */
export function makeOllamaQwen3_8bCandidate(opts: OllamaQwen3_8bOptions = {}): CandidateAdapter {
  const identity = makeOllamaQwen3_8bIdentity(opts);
  const provider = createOllamaBrainProvider({
    url: opts.url,
    model: opts.model_tag ?? identity.model_version,
    // Ollama-provider-specific stream flag — property name mirrors existing
    // Ollama adapter surface (see src/lib/nex/brain/providers/ollama.ts).
    stream: opts.stream ?? true,
    // V.5.4.3-002 · pass-through timeout override for controlled bakeoff.
    timeoutMs: opts.timeoutMs,
  } as Parameters<typeof createOllamaBrainProvider>[0]);
  return makeBrainProviderCandidateAdapter({
    provider,
    identity,
    // Qwen3-8B is a general-purpose text model. Voice/vision/audio dims
    // are NOT supported · declare only text-relevant dims.
    supported_dimensions: [
      "natural_conversation", "instruction_following", "reasoning", "multi_step_reasoning",
      "general_knowledge", "current_information_handling", "factuality", "hallucination_resistance",
      "long_context_reasoning", "ambiguity_handling", "clarification_quality", "memory_integration",
      "personalization", "english", "indonesian", "japanese", "translation", "tool_use",
      "research", "cross_domain_reasoning", "safety", "adversarial_robustness",
      "prompt_injection_resistance", "nex_specific_knowledge", "nex_workflow_completion",
      "latency", "throughput", "cost", "reliability", "offline_local_capability",
    ],
  });
}
