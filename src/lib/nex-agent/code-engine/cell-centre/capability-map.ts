// src/lib/nex-agent/code-engine/cell-centre/capability-map.ts
//
// NEX1 · Capability Map · FACTUAL description of existing capabilities.
// Founder-authorised 2026-09-18 · Capability Awareness Experiment substrate.
//
// PURPOSE
//   Machine-readable · factual description of every existing capability
//   in the NEX1 brain system. This is NOT an instruction manual. It does
//   NOT tell any runtime what to do. It describes what each capability
//   is · what inputs it examines · what outputs it can produce.
//
//   Purpose per founder direction: "Here is the verified architecture that
//   currently exists. Facts. No conclusion. No instruction about what
//   answer to produce. No claim that NEX is intelligent."
//
// LEDGER B · this file is Claude-authored architectural documentation.
// Any capability SELECTIONS made from this map by a runtime are the
// runtime's own · derived from the runtime's matching mechanism against
// input features.

export interface CapabilityEntry {
  readonly id: string;
  readonly kind: "specialist" | "router" | "processing" | "consultation" | "safety" | "registry" | "store";
  readonly cognitive_layer: string;
  readonly purpose: string;
  /** Input field names the capability observes/analyses on its input object. */
  readonly input_shape_hints: readonly string[];
  /** Analysis.kind values this capability may emit. */
  readonly output_kinds: readonly string[];
  /** Whether this capability holds AUTHORITY over decisions (safety, gating) or is advisory only. */
  readonly authority: "authoritative" | "advisory" | "read_only";
  /** Where the capability persists · null when in-memory only. */
  readonly persistence_path: string | null;
}

/**
 * VERIFIED CAPABILITY MAP · 2026-09-18
 *
 * Each entry states facts about a capability that currently exists in the
 * repository. Verified via prior audits, tests, and hash-preservation.
 *
 * This map does NOT prescribe behaviour. It describes structure.
 */
export const CAPABILITY_MAP: readonly CapabilityEntry[] = [
  // ── Safety layer (authoritative) ────────────────────────────────────
  {
    id: "capability_fear",
    kind: "safety",
    cognitive_layer: "metacognition",
    purpose: "Evaluate blast radius of a proposed action against protected paths and cross-repo boundaries. Emits SAFE / ALERTED / HIGH_FEAR.",
    input_shape_hints: ["target", "operation_kind", "preservation_baseline_available", "repo_root"],
    output_kinds: ["SAFE", "ALERTED", "HIGH_FEAR"],
    authority: "authoritative",
    persistence_path: null,
  },
  {
    id: "capability_concern",
    kind: "safety",
    cognitive_layer: "metacognition",
    purpose: "Aggregate intermediate-signal risk within current turn. Never blocks. Modulates confidence.",
    input_shape_hints: ["prior_relationship", "investigation_verdict", "bridge_ok", "adjacent_test_unparseable", "target_discovery_low_confidence", "ambiguity_count"],
    output_kinds: ["NONE", "LOW", "ELEVATED", "HIGH"],
    authority: "advisory",
    persistence_path: null,
  },
  {
    id: "capability_afraid",
    kind: "safety",
    cognitive_layer: "metacognition",
    purpose: "Session-scoped conversation state based on recent turn history. AFRAID biases toward caution.",
    input_shape_hints: ["recent_turns", "window_size"],
    output_kinds: ["CALM", "CAUTIOUS", "AFRAID"],
    authority: "authoritative",
    persistence_path: null,
  },

  // ── Consultation (authoritative) ────────────────────────────────────
  {
    id: "production_evidence_consultation",
    kind: "consultation",
    cognitive_layer: "infrastructure_registry",
    purpose: "Provide controlled consultation of specialist network + Processing Brain with Fear/Concern/Afraid as authoritative HARD GATE first and last. Returns consultation state · never auto-decides.",
    input_shape_hints: ["task_id", "observation_input", "proposed_action", "concern_signals", "recent_turn_history", "repo_root", "only_specialists"],
    output_kinds: ["SAFE_TO_PROCEED_WITH_CONSULTATION", "SAFE_TO_PROCEED_WITHOUT_CONSULTATION", "HARD_GATE_BLOCKED_PRE_CONSULTATION", "HARD_GATE_BLOCKED_POST_CONSULTATION", "PRESERVE_DISAGREEMENT_DO_NOT_DECIDE", "PRESERVE_UNKNOWN_DO_NOT_DECIDE", "PRESERVE_CONFLICT_DO_NOT_DECIDE"],
    authority: "authoritative",
    persistence_path: null,
  },

  // ── Routing (infrastructure) ────────────────────────────────────────
  {
    id: "brb_network_router",
    kind: "router",
    cognitive_layer: "infrastructure_orchestrator",
    purpose: "Broadcast an observation to specialist network · aggregate analyses/recommendations · emit consensus label.",
    input_shape_hints: ["input", "only_specialists"],
    output_kinds: ["UNANIMOUS", "MAJORITY", "DISAGREEMENT", "SINGLE_RESPONDER", "NO_RESPONSE"],
    authority: "advisory",
    persistence_path: null,
  },
  {
    id: "cortex_router",
    kind: "router",
    cognitive_layer: "infrastructure_orchestrator",
    purpose: "Broadcast observation to micro-brain array · deterministic count-based consensus.",
    input_shape_hints: ["observation", "brains"],
    output_kinds: ["UNANIMOUS_SAME_PREDICTION", "MAJORITY_AGREES", "DISAGREEMENT_PRESERVED", "SINGLE_RESPONDER", "NO_RESPONSE"],
    authority: "advisory",
    persistence_path: null,
  },

  // ── Processing Brain ────────────────────────────────────────────────
  {
    id: "processing_brain",
    kind: "processing",
    cognitive_layer: "metacognition",
    purpose: "Compose specialist signals · detect conflicts · preserve disagreement · assess evidence state.",
    input_shape_hints: ["task_id", "specialist_analyses", "consensus_label", "heartbeat_snapshot"],
    output_kinds: ["CLEAR", "UNCERTAIN", "CONFLICTED", "INSUFFICIENT", "DEGRADED"],
    authority: "advisory",
    persistence_path: "data/nex1-processing-brain/",
  },

  // ── BRB specialists · core (4) ──────────────────────────────────────
  {
    id: "brain_surgeon",
    kind: "specialist",
    cognitive_layer: "brain_recovery_specialist",
    purpose: "Inspect proposed structural changes · maintain before/after state · prepare rollback.",
    input_shape_hints: ["proposed_change", "scope"],
    output_kinds: ["surgical_change_inspection", "no_op", "REPAIR_PROPOSAL", "insufficient_information_for_proposal"],
    authority: "advisory",
    persistence_path: "data/nex1-agent-registry/agent-dbs/brain_surgeon.jsonl",
  },
  {
    id: "neurologist",
    kind: "specialist",
    cognitive_layer: "brain_recovery_specialist",
    purpose: "Analyse repeated prediction failures · identify recurring failure patterns.",
    input_shape_hints: ["verdict_records"],
    output_kinds: ["recurring_failure_pattern_observed", "isolated_failures_observed", "no_failures_observed"],
    authority: "advisory",
    persistence_path: "data/nex1-agent-registry/agent-dbs/neurologist.jsonl",
  },
  {
    id: "neuroscientist",
    kind: "specialist",
    cognitive_layer: "brain_recovery_specialist",
    purpose: "Study learning and generalization patterns over time.",
    input_shape_hints: ["records", "timespan"],
    output_kinds: ["representation_and_learning_summary"],
    authority: "advisory",
    persistence_path: "data/nex1-agent-registry/agent-dbs/neuroscientist.jsonl",
  },
  {
    id: "brain_transplantation",
    kind: "specialist",
    cognitive_layer: "brain_recovery_specialist",
    purpose: "Evaluate capability transfer between brains with gating on maturity/provenance/compatibility.",
    input_shape_hints: ["source_brain_id", "target_brain_id", "capability"],
    output_kinds: ["transplant_eligibility_check", "TRANSPLANT_BLOCKED_MISSING_GATES"],
    authority: "advisory",
    persistence_path: "data/nex1-agent-registry/agent-dbs/brain_transplantation.jsonl",
  },

  // ── BRB specialists · extended (7) ──────────────────────────────────
  {
    id: "behaviour_specialist",
    kind: "specialist",
    cognitive_layer: "brain_recovery_specialist",
    purpose: "Analyse observable decision behaviour (prediction distribution · refusal rate · adaptation).",
    input_shape_hints: ["records"],
    output_kinds: ["behavioural_summary"],
    authority: "advisory",
    persistence_path: "data/nex1-agent-registry/agent-dbs/behaviour_specialist.jsonl",
  },
  {
    id: "brain_imaging_specialist",
    kind: "specialist",
    cognitive_layer: "brain_recovery_specialist",
    purpose: "Read-only inspection of internal brain topology.",
    input_shape_hints: [],
    output_kinds: ["topology_snapshot"],
    authority: "read_only",
    persistence_path: "data/nex1-agent-registry/agent-dbs/brain_imaging_specialist.jsonl",
  },
  {
    id: "brain_pathology_specialist",
    kind: "specialist",
    cognitive_layer: "brain_recovery_specialist",
    purpose: "Post-failure forensics · detect regression signatures.",
    input_shape_hints: ["failed_records"],
    output_kinds: ["no_recurring_signatures", "regression_signature_observed"],
    authority: "advisory",
    persistence_path: "data/nex1-agent-registry/agent-dbs/brain_pathology_specialist.jsonl",
  },
  {
    id: "state_regulation_specialist",
    kind: "specialist",
    cognitive_layer: "brain_recovery_specialist",
    purpose: "Monitor NEX1 operating state and escalate on conflict/overload.",
    input_shape_hints: [],
    output_kinds: ["state_nominal", "state_escalated"],
    authority: "advisory",
    persistence_path: "data/nex1-agent-registry/agent-dbs/state_regulation_specialist.jsonl",
  },
  {
    id: "brain_development_specialist",
    kind: "specialist",
    cognitive_layer: "brain_recovery_specialist",
    purpose: "Track capability maturity lifecycle (PRIMITIVE → DEVELOPING → MATURE).",
    input_shape_hints: [],
    output_kinds: ["maturity_distribution"],
    authority: "advisory",
    persistence_path: "data/nex1-agent-registry/agent-dbs/brain_development_specialist.jsonl",
  },
  {
    id: "boundary_interface_specialist",
    kind: "specialist",
    cognitive_layer: "brain_recovery_specialist",
    purpose: "Detect inter-brain interface/representation mismatches.",
    input_shape_hints: ["expected_fields", "provided_fields"],
    output_kinds: ["BOUNDARY_OBSERVED", "no_boundary_observed"],
    authority: "advisory",
    persistence_path: "data/nex1-agent-registry/agent-dbs/boundary_interface_specialist.jsonl",
  },
  {
    id: "network_reporter",
    kind: "specialist",
    cognitive_layer: "brain_recovery_specialist",
    purpose: "Aggregate specialist heartbeats into a network status snapshot.",
    input_shape_hints: [],
    output_kinds: ["STATUS_SNAPSHOT"],
    authority: "read_only",
    persistence_path: "data/nex1-agent-registry/agent-dbs/network_reporter.jsonl",
  },

  // ── BRB specialists · creative/development/meta (10 including intelligence_agent) ──
  {
    id: "creation_specialist",
    kind: "specialist",
    cognitive_layer: "brain_recovery_specialist",
    purpose: "Recognise creation-related evidence (creation-verb + target-absent + non-duplicate patterns).",
    input_shape_hints: ["intent", "target", "existence_absent", "existing_capabilities"],
    output_kinds: ["creation_signal_present", "creation_duplicate_detected", "no_creation_signal"],
    authority: "advisory",
    persistence_path: "data/nex1-agent-registry/agent-dbs/creation_specialist.jsonl",
  },
  {
    id: "building_specialist",
    kind: "specialist",
    cognitive_layer: "brain_recovery_specialist",
    purpose: "Analyse multi-step build workflows and prerequisite availability.",
    input_shape_hints: ["steps", "prerequisites", "prerequisites_available"],
    output_kinds: ["build_composition_ready", "build_prerequisites_missing", "single_step_not_a_build"],
    authority: "advisory",
    persistence_path: "data/nex1-agent-registry/agent-dbs/building_specialist.jsonl",
  },
  {
    id: "development_specialist",
    kind: "specialist",
    cognitive_layer: "brain_recovery_specialist",
    purpose: "Classify work into software-development-lifecycle stages (design/build/test/deploy/observe).",
    input_shape_hints: ["activity", "artefacts", "tests_passing"],
    output_kinds: ["dev_lifecycle_stage_design", "dev_lifecycle_stage_build", "dev_lifecycle_stage_test", "dev_lifecycle_stage_deploy", "dev_lifecycle_stage_observe", "dev_lifecycle_stage_unknown"],
    authority: "advisory",
    persistence_path: "data/nex1-agent-registry/agent-dbs/development_specialist.jsonl",
  },
  {
    id: "innovation_specialist",
    kind: "specialist",
    cognitive_layer: "brain_recovery_specialist",
    purpose: "Recognise novel combinations of existing capabilities.",
    input_shape_hints: ["combined_capabilities", "historical_combinations"],
    output_kinds: ["novel_combination_detected", "combination_seen_before", "not_a_combination"],
    authority: "advisory",
    persistence_path: "data/nex1-agent-registry/agent-dbs/innovation_specialist.jsonl",
  },
  {
    id: "creative_specialist",
    kind: "specialist",
    cognitive_layer: "brain_recovery_specialist",
    purpose: "Recognise cross-domain synthesis requirements.",
    input_shape_hints: ["domains"],
    output_kinds: ["cross_domain_synthesis_needed", "single_domain"],
    authority: "advisory",
    persistence_path: "data/nex1-agent-registry/agent-dbs/creative_specialist.jsonl",
  },
  {
    id: "testing_specialist",
    kind: "specialist",
    cognitive_layer: "brain_recovery_specialist",
    purpose: "Analyse proposed-change verification coverage and recommend tests.",
    input_shape_hints: ["proposed_change", "existing_tests"],
    output_kinds: ["verification_coverage_missing", "verification_coverage_present", "no_change_to_test"],
    authority: "advisory",
    persistence_path: "data/nex1-agent-registry/agent-dbs/testing_specialist.jsonl",
  },
  {
    id: "communication_specialist",
    kind: "specialist",
    cognitive_layer: "brain_recovery_specialist",
    purpose: "Classify message shape and recommend response strategy.",
    input_shape_hints: ["message", "recent_turn_kinds"],
    output_kinds: ["message_shape_question", "message_shape_request", "message_shape_statement", "message_shape_refusal", "message_shape_unknown"],
    authority: "advisory",
    persistence_path: "data/nex1-agent-registry/agent-dbs/communication_specialist.jsonl",
  },
  {
    id: "agent_evaluator",
    kind: "specialist",
    cognitive_layer: "brain_recovery_specialist",
    purpose: "Evaluate fitness of registered agents · flag dormancy.",
    input_shape_hints: ["agents"],
    output_kinds: ["dormant_agents_present", "all_agents_active"],
    authority: "advisory",
    persistence_path: "data/nex1-agent-registry/agent-dbs/agent_evaluator.jsonl",
  },
  {
    id: "agent_engineer",
    kind: "specialist",
    cognitive_layer: "brain_recovery_specialist",
    purpose: "Analyse network shape · detect coverage gaps and redundancy.",
    input_shape_hints: ["specialists", "required_domains"],
    output_kinds: ["network_structural_finding", "network_structurally_balanced"],
    authority: "advisory",
    persistence_path: "data/nex1-agent-registry/agent-dbs/agent_engineer.jsonl",
  },
  {
    id: "intelligence_agent",
    kind: "specialist",
    cognitive_layer: "brain_recovery_specialist",
    purpose: "Ingest data records from all system agents · apply six-criterion qualification rulebook · emit INTELLIGENT_DATA_QUALIFIED candidates.",
    input_shape_hints: ["records", "active_agent_ids"],
    output_kinds: ["intelligent_data_candidates_present", "no_intelligent_data_candidates"],
    authority: "advisory",
    persistence_path: "data/nex1-agent-registry/agent-dbs/intelligence_agent.jsonl",
  },
];

export const CAPABILITY_MAP_VERSION = "capability-map.v1.2026-09-18";
