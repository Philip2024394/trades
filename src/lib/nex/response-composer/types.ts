// src/lib/nex/response-composer/types.ts
//
// NEX Master AI Engineer · Response Composer · shared types
// Founder BEGIN 2026-09-08 · Reservoir Phase 1 + Intelligence Composition Pilot
//
// Additive layer around existing brain/orchestrate.ts + brain/tool-router.ts.
// Does NOT replace any existing module. Answers the Founder's critical
// question: "How often does NEX actually need an LLM?" with auditable
// per-request route classification.
//
// Route classes (A/B/C/D/E) match Founder mandate verbatim.

/**
 * Route classification for a single request.
 *
 * A = deterministic only              (no data lookup, no inference)
 * B = deterministic + structured      (lookup a known record, compose deterministically)
 * C = retrieval + reasoning           (semantic/composite retrieval, no LLM required)
 * D = small local inference required  (Ollama Qwen3-8B or similar for language surface)
 * E = unresolved / UNKNOWN            (honest inability to answer · Gap Engine enqueue)
 */
export type RouteClass = "A" | "B" | "C" | "D" | "E";

export const ROUTE_CLASS_DESCRIPTIONS: Record<RouteClass, string> = {
  A: "deterministic only · no data lookup · no inference",
  B: "deterministic + structured knowledge · lookup + compose",
  C: "retrieval + reasoning · semantic/composite retrieval · deterministic composition",
  D: "small local inference · Ollama · language surface required",
  E: "unresolved · UNKNOWN · Gap Engine enqueue · never fabricate",
};

/** Deterministic reasons the router chose a route. */
export type RouteReasonCode =
  | "SAFETY_EXPRESSION"                // safety-mode question · e.g. "chest pain"
  | "EXACT_CACHE_HIT"                  // identical prior query in cache · fresh
  | "SEMANTIC_CACHE_HIT"               // near-identical prior query · fresh
  | "PATTERN_INTENT_DETERMINISTIC"     // conversation-intent.ts matched at ≥0.85 confidence
  | "TOOL_ROUTER_BLOCKED_ON_INPUTS"    // brain/tool-router.ts flagged missing inputs
  | "STRUCTURED_LOOKUP_MATCH"          // accommodation-postgres.ts hit exact record
  | "RETRIEVAL_HIGH_CONFIDENCE"        // rag-pipeline.ts top-1 above threshold
  | "RETRIEVAL_MULTI_MATCH_COMPARISON" // multiple records · deterministic comparison
  | "AMBIGUOUS_REQUIRES_INFERENCE"     // could go either way · LM chosen honestly
  | "GENUINELY_NOVEL"                  // no cache · no structured hit · no retrieval hit
  | "FRESHNESS_STALE"                  // knowledge exists but past freshness_ttl
  | "COVERAGE_GAP"                     // no data in reservoir for this predicate
  | "UNSAFE_QUERY"                     // safety gate refused
  | "TOOL_REQUIRED_DETERMINISTIC"      // tool exists · run it · no LM needed
  | "TOOL_REQUIRED_INFERENCE"          // tool selection requires LM
  | "FALLBACK_UNKNOWN";                // no path could answer honestly

/** Auditable trace emitted for every request · fulfils Founder mandate "auditable trace showing route → knowledge → tools → cache → inference/not → verification → final response". */
export interface ComposerTrace {
  request_id: string;
  received_at_iso: string;
  completed_at_iso: string | null;
  latency_ms: number | null;

  /** Route decision (A/B/C/D/E) + reason. */
  route: {
    class: RouteClass;
    reason_code: RouteReasonCode;
    reason_detail: string;
    confidence: number; // 0..1
    considered_classes: RouteClass[];
  };

  /** Cache result — always present · records exact + semantic outcome. */
  cache: {
    exact_lookup: "hit" | "miss" | "skipped";
    semantic_lookup: "hit" | "miss" | "skipped";
    stale_rejected: boolean;
    latency_saved_ms: number | null;
    cache_key_fingerprint: string | null; // sha256[:24]
  };

  /** Knowledge / retrieval — records what was fetched, from where, and freshness. */
  knowledge: Array<{
    source: string;              // e.g. "accommodation_postgres" · "knowledge_ledger" · "semantic_memory"
    record_id: string | null;
    ref_key: string | null;      // e.g. business_name or listing_ref
    confidence: number | null;
    freshness_state: "FRESH" | "STALE" | "PERMANENT" | "UNKNOWN";
    evidence_refs: string[];     // provenance chain
  }>;

  /** Tools used (empty if none). */
  tools: Array<{
    name: string;
    inputs: Record<string, unknown>;
    outputs: Record<string, unknown>;
    latency_ms: number;
    ok: boolean;
    error: string | null;
  }>;

  /** Inference used (null if none · Route A/B/C should be null · Route D populates this). */
  inference: {
    provider: string | null;      // "ollama" · "anthropic" · "stub" · null
    model: string | null;
    input_tokens: number | null;
    output_tokens: number | null;
    ttft_ms: number | null;
    total_ms: number | null;
    stop_reason: string | null;
  } | null;

  /** Verification — every response must be verifiable. */
  verification: {
    method: "deterministic_match" | "known_answer_registry" | "safety_deterministic" | "human_pending" | "skipped";
    verdict: "PASS" | "FAIL" | "UNKNOWN";
    evidence_refs: string[];
    reason: string;
  };

  /** Final answer contract · what user sees. */
  response: {
    answer_text: string | null;
    answer_kind: "text" | "card" | "unknown_with_clarification" | "unknown_with_gap_enqueued";
    confidence: number; // 0..1
    freshness_state: "FRESH" | "STALE" | "PERMANENT" | "UNKNOWN";
    disclaimers: string[];         // "I don't know" · "researching this now" · etc.
    gap_enqueued_ref: string | null; // present if Route E → Gap Engine record
  };

  /** Cost classification (never per-token — deterministic bucket). */
  cost_classification: {
    third_party_billable: boolean;   // any external API call
    local_gpu_seconds: number;       // approx GPU time consumed (Ollama)
    electricity_bucket: "negligible" | "small" | "medium" | "large";
  };

  /** Failure mode (null on success · populated on any partial/full failure). */
  failure_mode: {
    code: string;                   // e.g. "OLLAMA_UNAVAILABLE" · "POSTGRES_TIMEOUT" · "CACHE_STALE_REJECTED"
    stage: "route" | "cache" | "knowledge" | "tools" | "inference" | "verification" | "response";
    recoverable: boolean;
    detail: string;
  } | null;
}

/**
 * Input to the composer. Kept minimal · composes with existing NexBrainProvider
 * without requiring caller to know about it.
 */
export interface ComposerInput {
  /** Raw user question. */
  question: string;
  /** User-scope for cache isolation (Owner-Identity boundary · V.1). */
  user_scope: string;
  /** Optional surface hint (merchant · homeowner · visitor · api). */
  surface?: "merchant" | "homeowner" | "visitor" | "api";
  /** Optional conversation frame from brain/session.ts. */
  frame_hint?: {
    running_topic?: string | null;
    running_subject?: string | null;
    active_market?: string | null;
    dialogue_turns?: number;
  };
  /** Optional per-request override of NEX_COMPOSITION_PILOT flag (test harness). */
  force_route_class?: RouteClass;
  /** Optional pilot flag (test harness). */
  pilot_context?: {
    corpus_id?: string;
    case_id?: string;
    expected_route_class?: RouteClass;
  };
}

/** Response envelope · trace is always present so caller can inspect. */
export interface ComposerResponse {
  trace: ComposerTrace;
  route_class: RouteClass;
  answer_text: string | null;
  answer_kind: ComposerTrace["response"]["answer_kind"];
  confidence: number;
  disclaimers: string[];
}
