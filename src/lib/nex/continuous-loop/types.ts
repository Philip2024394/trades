// src/lib/nex/continuous-loop/types.ts
//
// UWI · Wave 7 · Continuous loop + purity contract shared types.
// Founder-authorised programme.
//
// The continuous loop is what lets NEX operate WITHOUT Claude being
// present (Rule 5c runtime-loop purity invariant). Every trigger is
// typed. Every stopping rule is typed. Every fetch/parse/transform
// surface is gate-checked. Every runtime path is verifiably free of
// Claude / Firecrawl / external LLM.

// ═══ 6 trigger classes (M27) ═══════════════════════════════════════
export type TriggerKind =
  | "scheduled"              // cron: next_review_at due (Wave 5 cadence)
  | "event_triggered"        // source publishes new data (RSS · changefeed · git-tag)
  | "change_triggered"       // evidence confidence changed by ≥Δ
  | "user_triggered"         // explicit ask from a user turn
  | "hypothesis_triggered"   // VALIDATING opportunity requests specific evidence
  | "failure_recovery_triggered"; // prior research failed · cool-down expired

export interface TriggerEvent {
  readonly kind: TriggerKind;
  readonly at_iso: string;
  /** Opportunity / workflow / research campaign this trigger targets. */
  readonly target_id: string;
  /** Free-form kind-specific detail. */
  readonly detail: Readonly<Record<string, unknown>>;
}

// ═══ 4 stopping rules (M28) ════════════════════════════════════════
export type StoppingRuleKind =
  | "enough_evidence"          // ≥N independent sources agree + confidence ≥ threshold + novelty < ε
  | "unresolvable_contradiction" // sources disagree beyond tolerance · all high-reliability · all fresh → escalate to human
  | "decay"                     // no new corroborating evidence in T time → PARKED
  | "cost_cap"                  // research effort budget exhausted for this cycle
  | "still_running";            // no stopping rule fired · continue

export interface StoppingDecision {
  readonly rule: StoppingRuleKind;
  readonly reason: string;
  readonly should_stop: boolean;
  readonly should_escalate_to_human: boolean;
  readonly recommended_next_action: "continue" | "park" | "escalate" | "archive" | "cost_cap_review";
}

export interface StoppingRuleInputs {
  readonly independent_source_count: number;
  readonly confidence: number;
  readonly novelty_of_last_source: number;
  readonly contradicting_signal_count: number;
  readonly supporting_signal_count: number;
  readonly high_reliability_sources_disagreeing: number;
  readonly all_sources_fresh: boolean;
  readonly time_since_last_supporting_ms: number;
  readonly decay_window_ms: number | null;
  readonly cost_spent_units: number;
  readonly cost_cap_units: number | null;
}

export interface StoppingRuleConfig {
  readonly enough_evidence_min_independent_sources: number;
  readonly enough_evidence_min_confidence: number;
  readonly enough_evidence_max_novelty: number;
  readonly contradiction_high_reliability_threshold: number;
}

export const DEFAULT_STOPPING_RULE_CONFIG: StoppingRuleConfig = {
  enough_evidence_min_independent_sources: 3,
  enough_evidence_min_confidence: 0.8,
  enough_evidence_max_novelty: 0.1,
  contradiction_high_reliability_threshold: 2,
};

// ═══ Runtime-loop purity contract (M30) ════════════════════════════
/** Blocked substrate — must NEVER appear as a runtime import in any
 *  NEX runtime-path module. Design-time / audit-time use is fine. */
export const BLOCKED_RUNTIME_IMPORTS: ReadonlyArray<string> = [
  // Third-party AI providers (all HTTP-hosted)
  "openai",
  "@anthropic-ai/sdk",
  "@anthropic-ai/anthropic",
  "@google/generative-ai",
  "@google-ai/generativelanguage",
  "cohere-ai",
  "@cohere/",
  "groq-sdk",
  "@groq/",
  "mistralai",
  "@mistralai/",
  "together-ai",
  "@together-ai/",
  "replicate",
  "@replicate/",
  "@huggingface/inference",
  // Firecrawl (rejected by FCA)
  "@mendable/firecrawl",
  "firecrawl-scraper-js",
  "firecrawl",
  // AI-agent frameworks (LLM at runtime = LangGraph / CrewAI / AutoGen / etc.)
  "@langchain/",
  "langchain",
  "crewai",
  "@microsoft/autogen",
  "autogen-agentchat",
  "@modelcontextprotocol/",
];

/** File paths that ARE ALLOWED to import blocked substrate for design-
 *  time purposes (audits · migrations · reference implementations behind
 *  R1 constitutional gate). These paths must contain a
 *  `blockThirdPartyAI(...)` call before any network access. */
export const RUNTIME_PURITY_ALLOWLISTED_PATHS: ReadonlyArray<string> = [
  // R1-gated wrappers (must include blockThirdPartyAI before any HTTP call)
  "src/lib/llm/",
  "src/lib/openai/",
  "src/lib/videos/aiEnrich.ts",
  "src/lib/videos/whisperTranscribe.ts",
  "src/lib/knowledge/embed.ts",
  "src/lib/studio/aiProviders/anthropic.ts",
  "src/lib/ai-visualiser/providers/openai.ts",
  "src/lib/nex/cv/compare.ts",
  "src/lib/nex/brain/llm.ts",
  "src/lib/os/receiptVision.ts",
  "src/lib/os/agreementVision.ts",
  // Two API routes with gate call (Wave 3.1 census)
  "src/app/api/admin/vision/preview/route.ts",
  "src/app/api/site/editor/ai-caption/route.ts",
  // Constitutional gate itself
  "src/lib/nex/constitutional-gate/",
];

export interface PurityViolation {
  readonly file: string;
  readonly line: number;
  readonly imported: string;
  readonly reason: string;
}

export interface PurityContractReport {
  readonly checked_at_iso: string;
  readonly files_scanned: number;
  readonly violations: readonly PurityViolation[];
  readonly is_pure: boolean;
}
