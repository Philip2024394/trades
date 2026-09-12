// src/lib/nex/master-ai/types.ts
//
// NEX Master AI Engineer · shared type vocabulary
// Philip 2026-09-07 · AUTHORIZE
//
// The load-bearing types Master AI uses across M1..M11. Kept together
// so cross-phase references (e.g. CapabilityRecord referencing AgentId)
// never diverge.
//
// PRESERVATION: this file does NOT modify src/lib/nex/agent-runtime/types.ts.
// The existing `AgentId = "programmer" | "accommodation"` union stays as it
// is · Master AI uses an EXTENSIBLE `string` newtype (via branded type) so
// future specialist agents can register without recompiling the runtime.

// ─── AgentId (extensible) ────────────────────────────────────────────
// Deliberately `string` — Master AI catalogue may register future agents
// without editing existing agent-runtime union. Every AgentId is
// validated on registration (see agent-registry/registry.ts).
export type MasterAgentId = string;

// ─── Authority tier (mirrors Phase A) ───────────────────────────────
// Copied verbatim from src/lib/nex/programmer-learning/types.ts so
// research findings + capability evidence use the exact same tier
// vocabulary the Programmer already knows.
export type AuthorityTier = "TIER_1" | "TIER_2" | "TIER_3" | "TIER_4" | "TIER_5";

// ─── Claim classification (M9) ──────────────────────────────────────
export type ClaimClassification =
  | "FACT"
  | "OBSERVATION"
  | "INFERENCE"
  | "ESTIMATE"
  | "FORECAST"
  | "SCENARIO"
  | "UNKNOWN";

// ─── M1 · Agent catalogue ───────────────────────────────────────────
export type AgentLifecycleState =
  | "PROPOSED"     // Factory-produced spec · not yet registered
  | "REGISTERED"   // In catalogue · not yet activated
  | "ACTIVE"       // Registered + runtime active (per agent-runtime)
  | "DEPRECATED"
  | "RETIRED";

export type AgentAuthorizationState =
  | "AUTHORIZED"
  | "PENDING"
  | "REVOKED";

export type AgentCatalogueEntry = {
  agent_id: MasterAgentId;
  name: string;
  description: string;
  version: string;                              // "v0.1.0"
  lifecycle_state: AgentLifecycleState;
  domain: string;                               // "engineering" | "accommodation" | "restaurant" | ...
  capabilities: string[];                       // capability_slug references (M2)
  benchmark_suite_ref: string | null;           // → M6 benchmark_registry entry
  knowledge_domains: string[];
  authorization_state: AgentAuthorizationState;
  registered_at_iso: string;
  registered_by: string;
  notes: string | null;
};

// ─── M2 · Capability model ──────────────────────────────────────────
export type CapabilityPromotionStatus =
  | "PROPOSED"
  | "TESTED"
  | "VERIFIED"
  | "PROMOTED"
  | "DEPRECATED";

export type CapabilityRecord = {
  capability_id: string;
  capability_slug: string;                      // e.g. "deterministic_review"
  agent_id: MasterAgentId;                      // owning agent
  version: string;
  evidence_refs: string[];                      // free-form refs into research/benchmark ledgers
  benchmark_ref: string | null;
  performance_metrics: Record<string, number>;
  promotion_status: CapabilityPromotionStatus;
  authority_tier: AuthorityTier;
  created_at_iso: string;
  created_by: string;
  supersedes: string | null;                    // capability_id of previous version
};

// ─── M3 · Observation ───────────────────────────────────────────────
export type ObservationKind =
  | "AGENT_HEARTBEAT_SNAPSHOT"
  | "AGENT_EVENT_TAIL"
  | "AGENT_HEALTH_DERIVED"
  | "CROSS_AGENT_METRIC"
  | "RUNTIME_ANOMALY";

export type ObservationRecord = {
  observation_id: string;
  kind: ObservationKind;
  observer_run_id: string;
  timestamp_iso: string;
  agent_id: MasterAgentId | null;               // null = system-wide observation
  provenance: {
    source_path: string;                        // file/API/etc.
    read_only: true;                            // structural: observations are ALWAYS read-only
  };
  attributes: Record<string, string | number | boolean | null>;
};

// ─── M4 · Knowledge ledger record categories ────────────────────────
export type KnowledgeRecordCategory =
  | "RESEARCH_FINDING"           // (also cross-refs M5)
  | "CAPABILITY_PROPOSAL"        // (also cross-refs M7)
  | "EXPERIMENT_RESULT"
  | "PHILIP_INTEL_CLAIM"         // (also cross-refs M9)
  | "OPPORTUNITY_SIGNAL"
  | "RISK_SIGNAL"
  | "FORECAST"
  | "SCENARIO"
  | "ARCHITECTURE_DECISION";

export type KnowledgeRecord = {
  record_id: string;
  category: KnowledgeRecordCategory;
  agent_id: MasterAgentId | null;               // null = cross-agent / master-ai general
  authority_tier: AuthorityTier;
  content: Record<string, unknown>;             // category-specific payload
  supersedes: string | null;                    // NEW record supersedes OLD (never in-place edit)
  provenance: {
    source: string;
    source_ref: string | null;
  };
  created_at_iso: string;
  created_by: string;
};

// ─── M5 · Research ──────────────────────────────────────────────────
export type SourceKind =
  | "PUBLIC_WEB"
  | "LICENSED_API"
  | "OFFICIAL_DATASET"
  | "GOVERNMENT_DATA"
  | "REGULATOR"
  | "PEER_REVIEWED"
  | "OWNER_SUBMITTED"
  | "INTERNAL"
  | "FIXTURE";                                  // test fixtures only

export type SourceRegistryEntry = {
  source_id: string;
  source_slug: string;
  name: string;
  kind: SourceKind;
  authority_tier: AuthorityTier;
  base_url: string | null;
  rate_policy: {
    max_requests_per_minute: number;
    respect_retry_after: boolean;
  };
  respects_robots_txt: boolean;
  license_note: string | null;
  authorization_state: AgentAuthorizationState;
  registered_at_iso: string;
  registered_by: string;
};

export type ResearchQueryStatus =
  | "QUEUED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "BLOCKED"
  | "FAILED";

export type ResearchQuery = {
  query_id: string;
  question: string;
  target_source_slugs: string[];
  priority: number;
  status: ResearchQueryStatus;
  created_at_iso: string;
  created_by: string;
  resolved_at_iso: string | null;
  blocked_reason: string | null;
};

export type ResearchFinding = {
  finding_id: string;
  query_id: string;
  source_slug: string;
  authority_tier: AuthorityTier;
  classification: ClaimClassification;
  raw_evidence: string;                         // preserved verbatim
  normalized_claim: string;
  content_hash: string;                         // dedup
  retrieved_at_iso: string;
  freshness_expires_at_iso: string | null;
  language: string | null;
  license: string | null;
};

// ─── M6 · Benchmark ─────────────────────────────────────────────────
export type BenchmarkVerdict =
  | "IMPROVED"
  | "STABLE"
  | "DEGRADED"
  | "FAILED"
  | "UNEXPLAINED";

export type BenchmarkCase<TIn = unknown, TOut = unknown> = {
  case_id: string;
  input: TIn;
  expected: TOut;
  metadata: Record<string, string | number | boolean | null>;
};

export type BenchmarkCorpus<TIn = unknown, TOut = unknown> = {
  corpus_id: string;
  agent_id: MasterAgentId;
  version: string;
  frozen: true;                                 // structural: never mutable
  cases: readonly BenchmarkCase<TIn, TOut>[];
  registered_at_iso: string;
};

export type BenchmarkRun = {
  run_id: string;
  corpus_id: string;
  capability_id: string;
  timestamp_iso: string;
  case_count: number;
  pass_count: number;
  fail_count: number;
  per_class_metrics: Record<string, number>;
  verdict: BenchmarkVerdict;
  compared_against_run_id: string | null;
  attribution: string | null;                   // which dimension changed (per Phase E pattern)
};

// ─── M7 · Cross-agent teaching ──────────────────────────────────────
export type ProposalAuthorizationState =
  | "AWAITING_APPROVAL"
  | "AUTHORIZED"
  | "REJECTED"
  | "SUPERSEDED";

export type CapabilityProposal = {
  proposal_id: string;
  source_agent_id: MasterAgentId;
  source_capability_id: string;
  target_agent_id: MasterAgentId;
  proposed_capability_slug: string;
  hypothesis: string;
  evidence_refs: string[];
  benchmark_prediction: string | null;
  authorization_state: ProposalAuthorizationState;
  founder_user_id: string | null;
  authorization_reason: string;
  slice_authorization_prompt: string | null;    // populated when authorized
  created_at_iso: string;
  resolved_at_iso: string | null;
};

// ─── M8 · Agent factory ─────────────────────────────────────────────
export type AgentSpecification = {
  specification_id: string;
  proposed_agent_id: MasterAgentId;
  proposed_name: string;
  mission_statement: string;
  domain_definition: string;
  required_capabilities: string[];              // capability_slug list (M2)
  research_requirements: string[];              // research query text · queued to M5
  knowledge_requirements: string[];
  benchmark_specification: {
    corpus_size_min: number;
    case_categories: string[];
  };
  architecture_sketch: string;                  // Markdown allowed
  runtime_requirements: {
    domain: string;
    internet_requirement: "NOT_REQUIRED" | "PREFERRED" | "REQUIRED";
  };
  safety_boundaries: string[];
  deployment_gate_list: string[];               // ordered slice-authorization list
  status: "DRAFT" | "READY_FOR_REVIEW" | "APPROVED" | "REJECTED" | "IMPLEMENTED";
  created_at_iso: string;
  created_by: string;
  approved_by: string | null;
  approved_at_iso: string | null;
};

// ─── M9 · Philip intelligence claim ─────────────────────────────────
export type PhilipIntelCategory =
  | "COMPARISON"
  | "TREND"
  | "OPPORTUNITY"
  | "RISK"
  | "PERFORMANCE_SUMMARY"
  | "AGENT_COMPARISON"
  | "IMPROVEMENT_SUMMARY";

export type PhilipIntelClaim = {
  claim_id: string;
  classification: ClaimClassification;
  statement: string;
  supporting_refs: string[];                    // observation/finding/benchmark refs
  uncertainty_note: string | null;
  time_horizon: "NOW" | "NEAR_TERM" | "LONG_TERM" | null;
  category: PhilipIntelCategory;
  created_at_iso: string;
};

// ─── M10 · Offline reservoir ────────────────────────────────────────
export type OfflineModeState = {
  online: boolean;
  since_iso: string;
  last_online_iso: string | null;
  reason: string;
};

// ─── M11 · Autonomous evolution ─────────────────────────────────────
export type AutonomousInvocationBounds = {
  max_iterations: number;         // inherited from Phase G · 1..32
  max_runtime_ms: number;         // inherited from Phase G · 100..600000
  max_files_changed: number;      // inherited from Phase G · 1..64
};

export type AutonomousInvocationRecord = {
  invocation_id: string;
  invoked_at_iso: string;
  invoker_reason: string;
  bounds_applied: AutonomousInvocationBounds;
  candidates_produced: number;
  proposals_created: number;
  founder_approvals_pending: number;
  terminated_reason: string;
};

export type PromotionApprovalStatus =
  | "AWAITING_APPROVAL"
  | "APPROVED"
  | "REJECTED";

export type PromotionApprovalEntry = {
  entry_id: string;
  proposal_id: string;                          // M7 CapabilityProposal reference
  capability_id: string;
  target_agent_id: MasterAgentId;
  status: PromotionApprovalStatus;
  founder_user_id: string | null;
  reason: string;
  created_at_iso: string;
  resolved_at_iso: string | null;
};

// ─── Version pin ────────────────────────────────────────────────────
export const MASTER_AI_VERSION = "0.2.0";

// ═══════════════════════════════════════════════════════════════════
// WAVE 2 · Intelligence engines that CONSUME wave-1 primitives
// ═══════════════════════════════════════════════════════════════════

// ─── Observatory (§6) ───────────────────────────────────────────────
export type DerivedHealthState =
  | "HEALTHY"          // process alive + fresh heartbeat + producing work
  | "IDLE"             // alive + fresh heartbeat + NO work observed (like Programmer today)
  | "DEGRADED"         // alive but heartbeat stale OR error rate elevated
  | "STOPPED"          // no process
  | "CRASHED"          // process died but wasn't cleanly stopped
  | "UNKNOWN";         // insufficient evidence

export type AgentHealthReport = {
  report_id: string;
  timestamp_iso: string;
  agent_id: MasterAgentId;
  derived_health: DerivedHealthState;
  running: boolean;
  heartbeat_fresh: boolean;
  heartbeat_stale_ms: number | null;
  observed_events_since_last_report: number;
  work_completed_since_last_report: number;
  work_failed_since_last_report: number;
  useful: boolean;                              // derived · running + producing meaningful work
  reasons: string[];                            // human-readable justifications
};

// ─── Source federation (§7 §38.3) ───────────────────────────────────
export type SourceHealthState =
  | "HEALTHY"          // available + within quota + recently succeeded
  | "APPROACHING_LIMIT"
  | "QUOTA_EXHAUSTED"
  | "RATE_LIMITED"
  | "UNAVAILABLE"
  | "DEGRADED"         // succeeded recently but with elevated failure rate
  | "UNKNOWN";

export type SourceHealthRecord = {
  record_id: string;
  source_slug: string;
  observed_at_iso: string;
  health: SourceHealthState;
  requests_last_hour: number;
  requests_last_day: number;
  failures_last_hour: number;
  quota_used_ratio: number;                     // 0..1 (unknown = -1)
  latest_success_iso: string | null;
  latest_failure_iso: string | null;
  latest_failure_reason: string | null;
};

export type SourceSelectionResult =
  | { chosen: string; reason: string; alternatives_skipped: Array<{ source_slug: string; reason: string }> }
  | { chosen: null; reason: string; alternatives_skipped: Array<{ source_slug: string; reason: string }> };

// ─── Cost intelligence (§25 §44) ────────────────────────────────────
export type UsageMetric = "REQUEST" | "TOKEN" | "BYTE" | "SECOND" | "ROW";

export type SourceQuotaPolicy = {
  source_slug: string;
  metric: UsageMetric;
  free_allowance_per_day: number | null;
  paid_allowance_per_day: number | null;
  hard_daily_limit: number | null;              // fail-closed when reached · null = no hard cap
  cost_per_unit_paid_idr: number | null;        // Indonesian rupiah per unit for paid usage
  updated_at_iso: string;
};

export type UsageEvent = {
  event_id: string;
  source_slug: string;
  metric: UsageMetric;
  units: number;
  status: "OK" | "REJECTED_QUOTA" | "REJECTED_LIMIT" | "REJECTED_UNAUTHORIZED";
  cost_estimate_idr: number | null;
  observed_at_iso: string;
  invoker: string;
};

export type QuotaCheckResult =
  | { allowed: true; remaining_free: number | null; remaining_paid: number | null }
  | { allowed: false; reason: "QUOTA_EXHAUSTED" | "HARD_LIMIT_REACHED" | "SOURCE_UNAUTHORIZED"; details: string };

// ─── Reconciliation (§9) ────────────────────────────────────────────
export type ReconciliationVerdict =
  | "AGREED"
  | "MOST_LIKELY"
  | "CONFLICTED"
  | "UNVERIFIED"
  | "UNKNOWN";

export type ClaimUnderTest = {
  source_slug: string;
  authority_tier: AuthorityTier;
  raw_value: string;
  normalized_value: string;
  observed_at_iso: string;
};

export type ReconciliationRecord = {
  reconciliation_id: string;
  subject_key: string;                          // canonical key describing what is being reconciled
  claims: ClaimUnderTest[];
  verdict: ReconciliationVerdict;
  canonical_value: string | null;
  reasoning: string;                            // why the canonical was chosen (or why none)
  preserved_conflicts: ClaimUnderTest[];
  performed_at_iso: string;
};

// ─── Failure intelligence (§18) ─────────────────────────────────────
export type FailurePattern = {
  pattern_id: string;
  pattern_key: string;                          // canonicalized fingerprint
  first_seen_iso: string;
  last_seen_iso: string;
  occurrence_count: number;
  representative_reason: string;
  affected_agents: MasterAgentId[];
  candidate_improvement_slug: string | null;    // populated when pattern promoted to improvement candidate
};

// ─── Experiment engine (§16) ────────────────────────────────────────
export type ExperimentComparison = {
  comparison_id: string;
  candidate_capability_id: string;
  current_capability_id: string | null;
  corpus_id: string;
  candidate_metrics: { pass: number; fail: number; per_class: Record<string, number> };
  current_metrics: { pass: number; fail: number; per_class: Record<string, number> } | null;
  verdict: "SUPERIOR" | "EQUIVALENT" | "INFERIOR" | "UNEXPLAINED" | "INSUFFICIENT_EVIDENCE";
  reasoning: string;
  performed_at_iso: string;
};

// ─── Statistics / Trend / Forecast (§20) ────────────────────────────
export type TrendDirection =
  | "INCREASING"
  | "DECREASING"
  | "STABLE"
  | "ACCELERATING"
  | "DECELERATING"
  | "EMERGING"
  | "DECLINING"
  | "INSUFFICIENT_DATA";

export type TrendReport = {
  trend_id: string;
  metric_key: string;
  window_start_iso: string;
  window_end_iso: string;
  sample_count: number;
  first_value: number;
  last_value: number;
  mean: number;
  min: number;
  max: number;
  slope_per_hour: number;                       // linear regression slope
  direction: TrendDirection;
  computed_at_iso: string;
};

// ─── Daily intelligence roll-up (§39) ───────────────────────────────
// ─── Self-criticism (§23) ───────────────────────────────────────────
export type SelfCriticismReport = {
  report_id: string;
  composed_at_iso: string;
  window_hours: number;
  answers: {
    what_i_learned: string;
    what_changed: string;
    what_i_missed: string;
    weak_sources: string[];
    stagnating_agents: string[];
    repeated_failures: string[];
    useless_research: string[];
    improved_capabilities: string[];
    wrong_predictions: string[];
    insufficient_evidence_topics: string[];
    going_stale: string[];
    costing_too_much: string[];
    investigate_next: string[];
  };
};

// ─── Research prioritisation (§10) ──────────────────────────────────
export type ResearchPriorityScore = {
  score_id: string;
  question: string;
  driver: "OBSERVED_WEAKNESS" | "KNOWLEDGE_GAP" | "STALE_INFO" | "UNRESOLVED_CONFLICT"
    | "AGENT_FAILURE" | "CAPABILITY_OPPORTUNITY" | "STRATEGIC_QUESTION" | "EXPLICIT_MISSION"
    | "TECHNOLOGY_CHANGE" | "DATA_QUALITY_ISSUE";
  components: {
    impact: number;                              // 1-10
    urgency: number;                             // 1-10
    confidence_in_signal: number;                // 1-10
    recurrence_count: number;                    // observed count
    expected_benefit: number;                    // 1-10
    cost_estimate: number;                       // 1-10 (higher = more costly)
    risk_estimate: number;                       // 1-10
    complexity_estimate: number;                 // 1-10
  };
  score: number;                                 // deterministic composition
  reasoning: string;
  computed_at_iso: string;
};

// ─── Offline reservoir demonstration (§18 §19) ──────────────────────
export type ReservoirDemonstrationRecord = {
  demo_id: string;
  scenario: "OFFLINE_FALLBACK" | "RECONNECT_REFRESH";
  online_before: boolean;
  online_after: boolean;
  chosen_source: string | null;
  fell_back_to_cache: boolean;
  cache_freshness_status: "LIVE" | "CACHED" | "STALE" | "UNKNOWN";
  reason: string;
  performed_at_iso: string;
};

// ─── Master AI lifecycle (§5) ───────────────────────────────────────
export type MasterAiLifecycleState =
  | "REGISTERED"
  | "STARTING"
  | "ACTIVE"
  | "DEGRADED"
  | "STOPPING"
  | "STOPPED"
  | "CRASHED";

export type MasterAiLifecycleRecord = {
  record_id: string;
  state: MasterAiLifecycleState;
  reason: string;
  observed_at_iso: string;
  evidence: {
    heartbeat_stale_ms: number | null;
    pid: number | null;
    last_work_iso: string | null;
  };
};

export type DailyIntelligenceReport = {
  report_id: string;
  window_start_iso: string;
  window_end_iso: string;
  system_status: {
    agents_monitored: number;
    agents_healthy: number;
    agents_idle: number;
    agents_degraded: number;
    agents_stopped: number;
  };
  new_knowledge_count: number;
  new_research_findings_count: number;
  agent_weaknesses: Array<{ agent_id: MasterAgentId; reason: string }>;
  experiments_run: number;
  improvements_proposed: number;
  cost_intelligence: {
    total_requests: number;
    total_estimated_cost_idr: number;
    sources_over_50_pct_quota: string[];
  };
  offline_intelligence: { mode: "ONLINE" | "OFFLINE"; last_online_iso: string | null };
  philip_intel_claim_ids: string[];
  future_opportunities: string[];
  risks: string[];
  next_research_targets: string[];
  composed_at_iso: string;
};
