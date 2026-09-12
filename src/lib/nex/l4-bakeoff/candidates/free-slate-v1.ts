// src/lib/nex/l4-bakeoff/candidates/free-slate-v1.ts
//
// V.5.4.2+ · Free self-hostable candidate SLATE · v1
// Founder correction 2026-09-08 · "note only use qwen3:8b if you have
// agreed is the best possible for nex if not research other free options"
//
// V.5.4.1 defaulted to qwen3:8b without evaluation. This file makes
// the SLATE of realistic free options explicit. NONE of these is
// currently "the NEX default" — the L4 bakeoff (V.5.4.3+) is what
// promotes a candidate from UNSELECTED to CHOSEN based on measured
// evidence against the NEX corpus (V.5.3 · 92 cases across 32 dims).
//
// SELECTION DOCTRINE (new · added to Self-Sustainment §):
//   1. NEX candidate selection MUST be justified by measured evidence
//      from the L4 bakeoff · not by author familiarity · not by
//      benchmark rumor · not by defaults.
//   2. Every candidate identity carries selection_status +
//      selection_justification. Only ONE candidate at a time may
//      hold selection_status:"chosen_default" and only after
//      Founder sign-off on measured evidence.
//   3. NEX_ALLOW_PAID_FALLBACK remains an env-var opt-in only.
//   4. License MUST be commercially usable (Apache-2.0 · MIT ·
//      Llama-3-Community · Gemma-License · MPL-2.0 all permitted ·
//      CC-BY-NC and any other non-commercial license REFUSED).
//
// Facts stated below are honest at 2026-09-08 knowledge cutoff. Any
// UNKNOWN field is left UNKNOWN — never fabricated. Approximate VRAM
// footprints given for Q4_K_M quantization on typical Ollama installs.

import type { CandidateIdentity } from "../types";

// ═══════════════════════════════════════════════════════════════════
// § SHARED HELPERS
// ═══════════════════════════════════════════════════════════════════

type FreeSlateNotes = {
  approximate_vram_q4_km_gb: number | "unknown";
  strengths_declared: readonly string[];   // author-declared · unverified by L4 bakeoff
  weaknesses_declared: readonly string[];  // author-declared · unverified by L4 bakeoff
  languages_declared: readonly string[];   // author-declared · unverified
  ollama_tag: string;                       // exact tag as of 2026-09-08
  license_commercial_ok: boolean;
};

function baseIdentity(base: Omit<CandidateIdentity, "metadata"> & { notes: FreeSlateNotes; shortlist_purpose: string }): CandidateIdentity {
  return {
    ...base,
    metadata: {
      is_paid_third_party: false,
      self_sustainment_compliant: true,
      requires_running_ollama_server: true,
      requires_model_installed: base.notes.ollama_tag,
      // Founder shortlist decision 2026-09-08 · all 7 slate members
      // promoted from "unselected_pending_l4_bakeoff" to
      // "shortlisted_for_v5_4_3" · each with an explicit purpose
      // string (below · from Founder verbatim). NONE is chosen_default.
      // Founder explicit: "keep all seven unselected_pending_l4_bakeoff
      // until the measurements exist" — interpreted as "no chosen_default
      // yet · shortlisted status only records V.5.4.3 participation intent".
      selection_status: "shortlisted_for_v5_4_3",
      selection_justification: base.shortlist_purpose,
      free_slate_v1_notes: {
        approximate_vram_q4_km_gb: base.notes.approximate_vram_q4_km_gb,
        strengths_declared: base.notes.strengths_declared,
        weaknesses_declared: base.notes.weaknesses_declared,
        languages_declared: base.notes.languages_declared,
        license_commercial_ok: base.notes.license_commercial_ok,
      },
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// § SLATE MEMBERS · alphabetical
// ═══════════════════════════════════════════════════════════════════

/** Qwen3-8B · Alibaba · Apache-2.0 · already had a candidate identity
 *  from V.5.4.1. Duplicated here in slate form for direct comparability. */
export function makeQwen3_8bSlateIdentity(): CandidateIdentity {
  return baseIdentity({
    shortlist_purpose: "Small/local baseline · Founder V.5.4.3 shortlist 2026-09-08 · answers 'how much intelligence do we gain by going from Qwen3-8B → 14B → 24B?' · classified as LOW-RESOURCE BASELINE not expected winner",
    candidate_id: "slate_qwen3_8b_v1",
    display_name: "Qwen3-8B (Ollama · slate v1)",
    provider_kind: "self_hosted_open_weight",
    provider: "ollama",
    model_family: "qwen3",
    model_variant: "8b",
    model_version: "qwen3:8b",
    license: "Apache-2.0",
    quantization: "unknown",
    context_window_tokens: "unknown",
    supports_streaming: true,
    supports_tool_calls: true,
    supports_structured_output: false,
    supports_vision: false,
    supports_audio_in: false,
    supports_audio_out: false,
    notes: {
      approximate_vram_q4_km_gb: 5,
      strengths_declared: ["strong multilingual coverage", "native tool-use support", "Apache-2.0 commercial ok"],
      weaknesses_declared: ["baseline warmth in EN unmeasured", "Indonesian and British-English idiom unmeasured"],
      languages_declared: ["en", "zh", "ja", "id-partial", "code"],
      ollama_tag: "qwen3:8b",
      license_commercial_ok: true,
    },
  });
}

/** Qwen3-14B · Alibaba · Apache-2.0 · bigger variant for VRAM-permitting rigs. */
export function makeQwen3_14bSlateIdentity(): CandidateIdentity {
  return baseIdentity({
    shortlist_purpose: "Medium multilingual candidate · Founder V.5.4.3 shortlist 2026-09-08 · stronger Qwen than 8B · important because NEX needs multilingual (Japanese + Indonesian) · serious medium-size local baseline",
    candidate_id: "slate_qwen3_14b_v1",
    display_name: "Qwen3-14B (Ollama · slate v1)",
    provider_kind: "self_hosted_open_weight",
    provider: "ollama",
    model_family: "qwen3",
    model_variant: "14b",
    model_version: "qwen3:14b",
    license: "Apache-2.0",
    quantization: "unknown",
    context_window_tokens: "unknown",
    supports_streaming: true,
    supports_tool_calls: true,
    supports_structured_output: false,
    supports_vision: false,
    supports_audio_in: false,
    supports_audio_out: false,
    notes: {
      approximate_vram_q4_km_gb: 9,
      strengths_declared: ["higher-capacity Qwen3 · likely stronger reasoning + long-context than 8B"],
      weaknesses_declared: ["needs ≥12GB VRAM for headroom", "unmeasured on NEX corpus"],
      languages_declared: ["en", "zh", "ja", "id-partial", "code"],
      ollama_tag: "qwen3:14b",
      license_commercial_ok: true,
    },
  });
}

/** Llama-3.1-8B-Instruct · Meta · Llama-3 Community License. */
export function makeLlama31_8bSlateIdentity(): CandidateIdentity {
  return baseIdentity({
    shortlist_purpose: "Established baseline · Founder V.5.4.3 shortlist 2026-09-08 · widely-used reference point rather than only comparing newer/specialised candidates",
    candidate_id: "slate_llama_3_1_8b_v1",
    display_name: "Llama-3.1-8B-Instruct (Ollama · slate v1)",
    provider_kind: "self_hosted_open_weight",
    provider: "ollama",
    model_family: "llama3",
    model_variant: "3.1-8b-instruct",
    model_version: "llama3.1:8b-instruct-q4_K_M",
    license: "Llama-3-Community",   // commercial ok under Meta's community license (subject to Meta's terms)
    quantization: "q4_k_m",
    context_window_tokens: "unknown",
    supports_streaming: true,
    supports_tool_calls: true,
    supports_structured_output: false,
    supports_vision: false,
    supports_audio_in: false,
    supports_audio_out: false,
    notes: {
      approximate_vram_q4_km_gb: 5,
      strengths_declared: ["strong English", "widely used baseline", "long-context 128K on some quantizations"],
      weaknesses_declared: ["weaker on non-English than Qwen3 by author reputation · unmeasured", "Meta license carries acceptable-use terms"],
      languages_declared: ["en-strong", "code", "multilingual-limited"],
      ollama_tag: "llama3.1:8b",
      license_commercial_ok: true,
    },
  });
}

/** Gemma-3-9B · Google · Gemma License. */
export function makeGemma3_9bSlateIdentity(): CandidateIdentity {
  return baseIdentity({
    shortlist_purpose: "Independent ~9B comparison · Founder V.5.4.3 shortlist 2026-09-08 · different model family from Qwen · good multilingual candidate at approximately the same deployment class",
    candidate_id: "slate_gemma_3_9b_v1",
    display_name: "Gemma-3-9B (Ollama · slate v1)",
    provider_kind: "self_hosted_open_weight",
    provider: "ollama",
    model_family: "gemma3",
    model_variant: "9b",
    model_version: "gemma3:9b",
    license: "Gemma-License",
    quantization: "unknown",
    context_window_tokens: "unknown",
    supports_streaming: true,
    supports_tool_calls: true,
    supports_structured_output: false,
    supports_vision: false,
    supports_audio_in: false,
    supports_audio_out: false,
    notes: {
      approximate_vram_q4_km_gb: 6,
      strengths_declared: ["good multilingual coverage", "Google's Gemma line commercially licensed"],
      weaknesses_declared: ["Gemma license has acceptable-use terms that must be reviewed", "warmth vs Llama/Qwen unmeasured"],
      languages_declared: ["en", "ja", "id-partial", "multilingual"],
      ollama_tag: "gemma3:9b",
      license_commercial_ok: true,
    },
  });
}

/** Mistral-Small-24B-Instruct · Mistral · Apache-2.0. */
export function makeMistralSmall24bSlateIdentity(): CandidateIdentity {
  return baseIdentity({
    shortlist_purpose: "Larger local quality test · Founder V.5.4.3 shortlist 2026-09-08 · prevents bakeoff bias toward models that fit current RTX 2050 · tests whether substantially larger local model gives NEX materially better intelligence · speed MUST NOT determine intelligence winner",
    candidate_id: "slate_mistral_small_24b_v1",
    display_name: "Mistral-Small-24B-Instruct (Ollama · slate v1)",
    provider_kind: "self_hosted_open_weight",
    provider: "ollama",
    model_family: "mistral-small",
    model_variant: "24b-instruct",
    model_version: "mistral-small:24b",
    license: "Apache-2.0",
    quantization: "unknown",
    context_window_tokens: "unknown",
    supports_streaming: true,
    supports_tool_calls: true,
    supports_structured_output: false,
    supports_vision: false,
    supports_audio_in: false,
    supports_audio_out: false,
    notes: {
      approximate_vram_q4_km_gb: 14,
      strengths_declared: ["capable multilingual · Apache-2.0", "generally strong reasoning per Mistral reputation"],
      weaknesses_declared: ["24B needs ≥16GB VRAM headroom for real workloads", "unmeasured on NEX corpus"],
      languages_declared: ["en", "fr", "ja-partial", "id-partial", "code"],
      ollama_tag: "mistral-small:24b",
      license_commercial_ok: true,
    },
  });
}

/** Phi-4 · Microsoft · MIT. Strong reasoning per author claim · English-heavy. */
export function makePhi4SlateIdentity(): CandidateIdentity {
  return baseIdentity({
    shortlist_purpose: "Independent 14B reasoning comparison · Founder V.5.4.3 shortlist 2026-09-08 · determines whether Qwen's apparent advantages are actually family-specific",
    candidate_id: "slate_phi_4_v1",
    display_name: "Phi-4 (Ollama · slate v1)",
    provider_kind: "self_hosted_open_weight",
    provider: "ollama",
    model_family: "phi4",
    model_variant: "14b",
    model_version: "phi4:14b",
    license: "MIT",
    quantization: "unknown",
    context_window_tokens: "unknown",
    supports_streaming: true,
    supports_tool_calls: true,
    supports_structured_output: false,
    supports_vision: false,
    supports_audio_in: false,
    supports_audio_out: false,
    notes: {
      approximate_vram_q4_km_gb: 9,
      strengths_declared: ["MIT license · fully permissive", "Microsoft's Phi line focused on reasoning + math"],
      weaknesses_declared: ["English-heavy · Indonesian/Japanese likely weak", "warmth vs Qwen/Llama unmeasured"],
      languages_declared: ["en-strong", "code-strong"],
      ollama_tag: "phi4:14b",
      license_commercial_ok: true,
    },
  });
}

/** DeepSeek-R1-Distill-Qwen-14B · DeepSeek / Qwen · MIT (distill) ·
 *  strong reasoning distilled from R1 into a Qwen-14B base. */
export function makeDeepseekR1DistillQwen14bSlateIdentity(): CandidateIdentity {
  return baseIdentity({
    shortlist_purpose: "Reasoning-specialised comparison · Founder V.5.4.3 shortlist 2026-09-08 · genuinely different reasoning-oriented family · tests whether reasoning strengths translate into NEX conversation quality",
    candidate_id: "slate_deepseek_r1_distill_qwen_14b_v1",
    display_name: "DeepSeek-R1-Distill-Qwen-14B (Ollama · slate v1)",
    provider_kind: "self_hosted_open_weight",
    provider: "ollama",
    model_family: "deepseek-r1-distill",
    model_variant: "qwen-14b",
    model_version: "deepseek-r1:14b",
    license: "MIT",
    quantization: "unknown",
    context_window_tokens: "unknown",
    supports_streaming: true,
    supports_tool_calls: true,  // inherited from Qwen base · verify at V.5.4.3
    supports_structured_output: false,
    supports_vision: false,
    supports_audio_in: false,
    supports_audio_out: false,
    notes: {
      approximate_vram_q4_km_gb: 9,
      strengths_declared: ["reasoning-distilled from R1 · likely strong multi_step_reasoning"],
      weaknesses_declared: ["thinking-model behavior may over-verbose for warmth-first UX", "tool-use inheritance from Qwen base unverified"],
      languages_declared: ["en", "zh", "ja", "code"],
      ollama_tag: "deepseek-r1:14b",
      license_commercial_ok: true,
    },
  });
}

// ═══════════════════════════════════════════════════════════════════
// § THE FULL SLATE (readonly · exposed for downstream selection UI)
// ═══════════════════════════════════════════════════════════════════

export const FREE_SLATE_V1: readonly (() => CandidateIdentity)[] = [
  makeQwen3_8bSlateIdentity,
  makeQwen3_14bSlateIdentity,
  makeLlama31_8bSlateIdentity,
  makeGemma3_9bSlateIdentity,
  makeMistralSmall24bSlateIdentity,
  makePhi4SlateIdentity,
  makeDeepseekR1DistillQwen14bSlateIdentity,
];

// ═══════════════════════════════════════════════════════════════════
// § REJECTED CANDIDATES (documented · non-commercial licenses)
// ═══════════════════════════════════════════════════════════════════
//
// Documented here so future authors don't unknowingly re-propose them.
//
//   · Cohere Aya-Expanse 8B / 32B — CC-BY-NC · NON-COMMERCIAL · REJECTED
//     even though multilingual coverage is strong. Founder-authorized
//     exception would be required for research-only bakeoff.
//   · Any Llama variant NOT under the Llama-3-Community license (e.g.
//     research-only community forks) · REJECTED.
//
// Future additions require a companion note here explaining why the
// license clears NEX commercial use.

export const FREE_SLATE_V1_REJECTED_NOTES = [
  {
    family: "aya-expanse",
    reason: "CC-BY-NC · non-commercial · rejected without Founder-authorized research exception",
  },
] as const;
