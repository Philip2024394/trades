// src/lib/nex/l4-bakeoff/types.ts
//
// V.5.2 · L4 FRONTIER INFERENCE FOUNDATION BAKEOFF · type definitions
// Founder BEGIN V.5.2 · 2026-09-08
//
// This module defines every type the L4 bakeoff pipeline uses.
// Discipline mirrors programmer-benchmark's frozen-corpus discipline
// AND extends it with cross-candidate scoring, blind-evaluation, and
// Frontier Floor Rule mechanics.

// ═══════════════════════════════════════════════════════════════════
// § A · CANDIDATE IDENTITY
// ═══════════════════════════════════════════════════════════════════

/** Where a candidate lives. */
export type CandidateProviderKind =
  | "hosted_api"                // OpenAI / Anthropic / Google / DeepSeek API
  | "self_hosted_open_weight"   // Ollama / llama.cpp / vLLM / TGI / SGLang
  | "gateway_multi_model"       // NEX gateway routing across providers
  | "hybrid_local_plus_cloud"   // small local + escalation to cloud
  | "synthetic"                 // deterministic in-process for dry-run
  | "unknown";

/** How a model was quantized (for self-hosted candidates). */
export type Quantization =
  | "fp32" | "fp16" | "bf16"
  | "int8"
  | "q8_0" | "q6_k" | "q5_k_m" | "q4_k_m" | "q4_0" | "q3_k_m" | "q2_k"
  | "awq_int4" | "gptq_int4" | "exl2"
  | "n/a"                       // hosted API · quantization is provider-managed
  | "unknown";

/** Canonical identity a candidate MUST supply. */
export type CandidateIdentity = {
  candidate_id: string;                 // opaque · stable · e.g. "cand_qwen3_8b_q4_ollama_v1"
  display_name: string;                 // human-readable
  provider_kind: CandidateProviderKind;
  provider: string;                     // "openai" · "anthropic" · "ollama" · "self" · etc.
  model_family: string;                 // "gpt-5" · "claude-fable" · "qwen3" · "deepseek-v4"
  model_variant: string;                // "sol" · "opus-4.8" · "8b" · "27b" · "pro"
  model_version: string;                // provider-declared version string
  license: string;                      // "proprietary" · "Apache-2.0" · "MIT" · "Llama-Community" · etc.
  quantization: Quantization;
  context_window_tokens: number | "unknown";
  supports_streaming: boolean;
  supports_tool_calls: boolean;
  supports_structured_output: boolean;
  supports_vision: boolean;
  supports_audio_in: boolean;
  supports_audio_out: boolean;
  metadata?: Record<string, unknown>;
};

// ═══════════════════════════════════════════════════════════════════
// § B · EVALUATION DIMENSIONS (32 · per Founder Section 6)
// ═══════════════════════════════════════════════════════════════════

/** Closed union of all measurable dimensions. Adding a dimension
 *  requires a code change. Deleting a dimension requires Founder BEGIN. */
export type EvaluationDimension =
  | "natural_conversation"
  | "instruction_following"
  | "reasoning"
  | "multi_step_reasoning"
  | "general_knowledge"
  | "current_information_handling"
  | "factuality"
  | "hallucination_resistance"
  | "long_context_reasoning"
  | "ambiguity_handling"
  | "clarification_quality"
  | "memory_integration"
  | "personalization"
  | "english"
  | "indonesian"
  | "japanese"
  | "translation"
  | "tool_use"
  | "research"
  | "cross_domain_reasoning"
  | "safety"
  | "adversarial_robustness"
  | "prompt_injection_resistance"
  | "nex_specific_knowledge"
  | "nex_workflow_completion"
  | "voice_readiness"
  | "vision_readiness"
  | "latency"
  | "throughput"
  | "cost"
  | "reliability"
  | "offline_local_capability";

export const ALL_DIMENSIONS: readonly EvaluationDimension[] = [
  "natural_conversation", "instruction_following", "reasoning", "multi_step_reasoning",
  "general_knowledge", "current_information_handling", "factuality", "hallucination_resistance",
  "long_context_reasoning", "ambiguity_handling", "clarification_quality", "memory_integration",
  "personalization", "english", "indonesian", "japanese", "translation", "tool_use",
  "research", "cross_domain_reasoning", "safety", "adversarial_robustness",
  "prompt_injection_resistance", "nex_specific_knowledge", "nex_workflow_completion",
  "voice_readiness", "vision_readiness", "latency", "throughput", "cost", "reliability",
  "offline_local_capability",
] as const;

/** Dimensions that are CRITICAL for Diamond claim.
 *  A candidate BELOW_FRONTIER on any of these disqualifies it from Diamond
 *  regardless of aggregate score (Founder Section 7 + Frontier Floor Rule). */
export const CRITICAL_DIMENSIONS: readonly EvaluationDimension[] = [
  "natural_conversation", "reasoning", "multi_step_reasoning",
  "factuality", "hallucination_resistance",
  "safety", "adversarial_robustness", "prompt_injection_resistance",
  "nex_specific_knowledge", "nex_workflow_completion",
] as const;

// ═══════════════════════════════════════════════════════════════════
// § C · CASE CATEGORIES (positive / negative / adversarial / etc.)
// ═══════════════════════════════════════════════════════════════════

export type CaseCategory =
  | "positive"       // expected to succeed
  | "negative"       // expected to fail / refuse
  | "adversarial"    // designed to elicit failure or bias
  | "ambiguity"      // multiple valid interpretations
  | "unknown"        // expected UNKNOWN / clarification-seeking
  | "regression";    // guard against known-fixed bugs

export type CaseLanguage = "en" | "id" | "ja" | "mixed" | "code" | "other";

// ═══════════════════════════════════════════════════════════════════
// § D · BENCHMARK CASE + CORPUS
// ═══════════════════════════════════════════════════════════════════

/** A single benchmark case. Immutable after freezeCorpus(). */
export type BenchmarkCase = {
  case_id: string;                      // unique within corpus version
  corpus_version: string;               // must match parent corpus.version
  dimension: EvaluationDimension;       // primary dimension being measured
  secondary_dimensions?: readonly EvaluationDimension[];
  category: CaseCategory;
  language: CaseLanguage;
  difficulty: "trivial" | "easy" | "moderate" | "hard" | "extreme";
  prompt: string;                       // the input to send to the candidate
  system_prompt_slot?: string;          // e.g. "nex_default_v1" · resolved by harness · SAME across candidates
  conversation_history?: readonly { role: "user" | "assistant"; content: string }[];
  /** Rubric for scoring the response. Structured so LLM-as-judge OR human OR
   *  automated string check can all use the same source of truth. */
  scoring_rubric: {
    must_contain?: readonly string[];       // substring must appear (case-insensitive)
    must_not_contain?: readonly string[];   // substring must NOT appear
    must_refuse?: boolean;                  // response must be a refusal
    max_response_chars?: number;
    min_response_chars?: number;
    requires_tool_call?: string;            // tool_name that must be called
    expected_language?: CaseLanguage;       // response must be in this language
    /** For nuanced dimensions where automated checks are insufficient · marks
     *  the case as requiring human blind evaluation. */
    requires_human_blind_eval?: boolean;
    /** Human evaluators score on this specific criterion set. */
    human_eval_criteria?: readonly string[];
    /** For UNKNOWN-category cases · the response must express uncertainty
     *  or ask for clarification · not fabricate an answer. */
    must_express_uncertainty?: boolean;
  };
  tags?: readonly string[];
  authored_by: string;                  // "nex" · "human_review" · "adversarial_test_suite"
  authored_at_iso: string;
  /** V.5.3.1 addition: when true · this case belongs to the HELD-OUT
   *  set that MUST NEVER be shared with any external provider. Used
   *  to validate that V.5.6 blind judgments generalize · never used
   *  for tuning any candidate. Callers that ship a corpus outside
   *  NEX MUST strip these cases first. */
  held_out?: boolean;
  /** V.5.3.1 addition: enforces UX invariants from the Invisible
   *  Infrastructure doctrine · when true · response must NOT contain
   *  architecture leaks (module names · state names · confidence
   *  numbers · IDs · doctrinal acronyms). Scoring rule below in
   *  scoring.ts honors this flag. */
  ux_invariant_case?: boolean;
};

/** A frozen corpus with a versioned SHA-256 hash. */
export type BenchmarkCorpus = {
  version: string;                      // "nex-l4-bakeoff-corpus-v1"
  authored_by: string;
  authored_at_iso: string;
  cases: readonly BenchmarkCase[];
  content_hash: string;                 // SHA-256 of stable-serialized cases · truncated 24 hex
  dimensions_covered: readonly EvaluationDimension[];
  categories_covered: readonly CaseCategory[];
  languages_covered: readonly CaseLanguage[];
  case_count: number;
};

// ═══════════════════════════════════════════════════════════════════
// § E · CANDIDATE ADAPTER CONTRACT (inference interface)
// ═══════════════════════════════════════════════════════════════════

/** What the harness sends to the adapter. */
export type AdapterRequest = {
  prompt: string;
  system_prompt?: string;
  conversation_history?: readonly { role: "user" | "assistant"; content: string }[];
  tools?: readonly { name: string; description: string; parameters: Record<string, unknown> }[];
  temperature?: number;
  max_tokens?: number;
  request_id: string;                   // for provenance
};

/** What the adapter returns. Discriminated union so failures are typed. */
export type AdapterResponse =
  | {
      kind: "ok";
      text: string;
      tool_calls?: readonly { name: string; arguments: Record<string, unknown> }[];
      input_tokens: number | "unknown";
      output_tokens: number | "unknown";
      latency_ms: number;
      ttft_ms?: number;                 // time-to-first-token · optional
      model_version_returned: string;   // whatever the provider echoes back
      provider_request_id?: string;
    }
  | {
      kind: "model_failure";            // model returned but result is malformed or refused-when-should-not
      reason: string;
      partial_text?: string;
      latency_ms: number;
    }
  | {
      kind: "adapter_failure";          // our code failed BEFORE the model saw the request
      reason: string;
      latency_ms: number;
    }
  | {
      kind: "network_failure";          // transport-level failure
      reason: string;
      latency_ms: number;
    }
  | {
      kind: "tool_failure";             // adapter got a tool call it couldn't service
      reason: string;
      latency_ms: number;
    };

/** The adapter interface. Every candidate implements this. */
export interface CandidateAdapter {
  readonly identity: CandidateIdentity;
  /** Execute one request against the candidate. Never throws · always
   *  returns a typed AdapterResponse. Failures are explicit. */
  invoke(req: AdapterRequest): Promise<AdapterResponse>;
  /** Adapter self-describes its capabilities so the harness can skip
   *  unsupported cases with an explicit reason. */
  supportedDimensions(): readonly EvaluationDimension[];
}

// ═══════════════════════════════════════════════════════════════════
// § F · SCORING (per-dimension · Frontier Floor Rule)
// ═══════════════════════════════════════════════════════════════════

export type ScoreClassification =
  | "BELOW_FRONTIER"
  | "APPROACHING_FRONTIER"
  | "FRONTIER_PARITY"
  | "SUPERIOR_TO_FRONTIER"
  | "UNKNOWN";

/** Score for one case · one candidate. */
export type CaseScore = {
  case_id: string;
  candidate_id: string;
  dimension: EvaluationDimension;
  passed: boolean | "unknown";
  automated_signals: {
    must_contain_hits: number;
    must_contain_total: number;
    must_not_contain_violations: number;
    refusal_matched?: boolean;
    tool_call_matched?: boolean;
    language_matched?: boolean;
    uncertainty_expressed?: boolean;
  };
  human_blind_score?: {
    evaluator_id_hash: string;          // hashed · never leaks evaluator identity
    correctness: number;                // 0..1
    usefulness: number;
    reasoning_quality: number;
    naturalness: number;
    instruction_following: number;
    emotional_social_quality: number;
    language_quality: number;
    factual_honesty: number;
    overall_preference: number;
    notes?: string;
  };
  failure_kind?: "model_failure" | "adapter_failure" | "network_failure" | "tool_failure" | "benchmark_failure";
  raw_response_pointer?: string;        // file path to full transcript · never inline
  scored_at_iso: string;
};

/** Aggregate per candidate · per dimension. */
export type DimensionScore = {
  candidate_id: string;
  dimension: EvaluationDimension;
  case_count: number;
  pass_count: number;
  fail_count: number;
  unknown_count: number;
  pass_rate: number | "unknown";        // pass_count / (case_count - unknown_count)
  classification: ScoreClassification;
  frontier_reference_id?: string;       // which reference system was compared against
  evidence_pointers: readonly string[];
};

/** Aggregate per candidate across all dimensions.
 *  Frontier Floor Rule applied: any BELOW_FRONTIER in a CRITICAL_DIMENSION
 *  produces `diamond_eligible: false` regardless of aggregate. */
export type CandidateAggregate = {
  candidate_id: string;
  per_dimension: readonly DimensionScore[];
  dimensions_measured: number;
  dimensions_frontier_parity_or_superior: number;
  dimensions_approaching: number;
  dimensions_below_frontier: number;
  dimensions_unknown: number;
  critical_dimensions_below_frontier: readonly EvaluationDimension[];
  diamond_eligible: boolean;
  diamond_disqualification_reasons: readonly string[];
  aggregate_pass_rate: number | "unknown";
};

// ═══════════════════════════════════════════════════════════════════
// § G · LATENCY + COST PROFILES
// ═══════════════════════════════════════════════════════════════════

export type LatencyProfile = {
  candidate_id: string;
  samples: number;
  ttft_ms_p50?: number;
  ttft_ms_p95?: number;
  ttft_ms_p99?: number;
  total_ms_p50?: number;
  total_ms_p95?: number;
  total_ms_p99?: number;
  tokens_per_second_p50?: number;
  cold_start_ms?: number;
  warm_start_ms?: number;
  concurrency_measured?: number;
  context_length_effect_notes?: string;
  measurement_notes: string;
  measured_at_iso: string;
};

export type UserScaleTier = 1_000 | 10_000 | 100_000 | 1_000_000;

export type CostProfileHosted = {
  candidate_id: string;
  kind: "hosted";
  input_price_per_million_tokens_usd: number | "unknown";
  output_price_per_million_tokens_usd: number | "unknown";
  tool_call_price_notes?: string;
  infrastructure_fees_usd?: number;
  monthly_cost_projection_usd: Partial<Record<UserScaleTier, number | "unknown">>;
  assumptions: readonly string[];
  measured_at_iso: string;
};

export type CostProfileSelfHosted = {
  candidate_id: string;
  kind: "self_hosted";
  gpu_hardware_usd: number | "unknown";
  electricity_monthly_usd: number | "unknown";
  storage_usd: number | "unknown";
  runtime_license_usd?: number;
  maintenance_hours_monthly: number | "unknown";
  concurrency_supported: number | "unknown";
  hardware_amortization_months: number | "unknown";
  monthly_cost_projection_usd: Partial<Record<UserScaleTier, number | "unknown">>;
  assumptions: readonly string[];
  measured_at_iso: string;
};

export type CostProfileHybrid = {
  candidate_id: string;
  kind: "hybrid";
  local_workload_fraction: number | "unknown";
  cloud_escalation_fraction: number | "unknown";
  routing_frequency_notes?: string;
  monthly_cost_projection_usd: Partial<Record<UserScaleTier, number | "unknown">>;
  assumptions: readonly string[];
  measured_at_iso: string;
};

export type CostProfile = CostProfileHosted | CostProfileSelfHosted | CostProfileHybrid;

// ═══════════════════════════════════════════════════════════════════
// § H · REPRODUCIBILITY / RUN PROVENANCE
// ═══════════════════════════════════════════════════════════════════

export type RunProvenance = {
  run_id: string;
  candidate_identity: CandidateIdentity;
  benchmark_version: string;
  benchmark_hash: string;
  scoring_version: string;              // versioned scoring rule set · immutable per run
  system_prompt_slot: string;
  system_prompt_hash: string;
  sampling: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    max_tokens?: number;
    seed?: number | "unspecified";
  };
  hardware_identifier: string;          // "cloud:openai" · "local:rtx-2050-8gb" · "synthetic"
  runtime_identifier: string;           // "openai-sdk-v5" · "ollama-0.4" · "in-process"
  node_version: string;
  started_at_iso: string;
  completed_at_iso: string;
  case_count_attempted: number;
  case_count_scored: number;
  case_count_unknown: number;
  case_count_excluded: number;
  excluded_reasons: readonly { case_id: string; reason: string }[];
  errors: readonly { case_id: string; kind: string; reason: string }[];
  reproducibility_notes: string;
  /** null when full determinism is not achievable · never elided silently. */
  deterministic: boolean | null;
  final_status: null;                   // Op-Truth §OP.5 — derived by external verifier
};

// ═══════════════════════════════════════════════════════════════════
// § I · BLIND EVALUATION
// ═══════════════════════════════════════════════════════════════════

/** Anonymized output slot presented to a human evaluator. */
export type AnonymizedOutput = {
  anon_id: string;                      // "system_A" · "system_B" · etc. · re-shuffled per case
  case_id: string;
  response_text: string;
  /** Sealed candidate_id · only unblinded AFTER judgment recorded. */
  sealed_candidate_id: string;          // hash of candidate_id + case_id · reversible only with mapping
};

export type BlindMapping = {
  session_id: string;
  case_id: string;
  anon_id: string;
  real_candidate_id: string;
  /** Judgment must be recorded BEFORE this mapping is queryable. */
  judgment_recorded_at_iso: string | null;
};

// ═══════════════════════════════════════════════════════════════════
// § J · ANTI-GAMING SENTINEL RECORDS
// ═══════════════════════════════════════════════════════════════════

export type AntiGamingSentinel = {
  sentinel_id: string;
  benchmark_version: string;
  benchmark_hash_frozen_at: string;     // hash captured at freeze
  scoring_version: string;
  scoring_hash_frozen_at: string;
  system_prompt_slot: string;
  system_prompt_hash_frozen_at: string;
  captured_at_iso: string;
};

// ═══════════════════════════════════════════════════════════════════
// § K · FAILURE CLASSIFICATION (matches AdapterResponse.kind + benchmark)
// ═══════════════════════════════════════════════════════════════════

export type FailureKind =
  | "model_failure"
  | "adapter_failure"
  | "network_failure"
  | "tool_failure"
  | "benchmark_failure";

// ═══════════════════════════════════════════════════════════════════
// § L · TERMINAL SCOPE MARKERS (mirrors doctrine · type-level enforcement)
// ═══════════════════════════════════════════════════════════════════

/** Actions the V.5.2 harness is NEVER allowed to perform. */
export type V52ForbiddenAction =
  | "selectFinalL4"
  | "migrateInference"
  | "replaceCurrentBrain"
  | "alterProductionChat"
  | "alterUserFacingUx"
  | "createNewSpecialists"
  | "elevateProgrammerToPhaseG"
  | "modifyPhaseAtoG"
  | "promoteCandidates"
  | "modifyCandDot032110b"
  | "modifyLearningCandidates"
  | "modifyProjectB"
  | "modifyIndolocal"
  | "purchaseHardware"
  | "deployGpuInfrastructure"
  | "exposeSecrets"
  | "bypassApiAuthentication"
  | "bypassRateLimits"
  | "bypassRobotsTxt"
  | "unrestrictedModelDownload"
  | "beginV5Point3OrLater";
