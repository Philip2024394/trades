// src/lib/nex-agent/code-engine/brb/brb-creative-specialists.ts
//
// NEX1 · Brain Recovery Network · Creative + Development + Meta specialists.
// Founder-authorised 2026-09-18 · master prompt (continue and also build
// creation · building · development · innovation · creative · testing ·
// communication · agent_evaluated · agent_engineering).
//
// PURPOSE
//   Nine new BRB specialists that fully participate in the existing
//   coordination architecture (Cortex + BRB Network Router + Processing
//   Brain + Central Agent Registry). Each uses the SAME connection pattern
//   as the existing 11 specialists (surgeon · neurologist · neuroscientist ·
//   brain_transplantation · behaviour · brain_imaging · brain_pathology ·
//   state_regulation · brain_development · boundary_interface · network_reporter).
//
// CONNECTION PATTERN (identical to existing extended specialists)
//   · createSpecialistBrain(cfg)          → factory · auto-calls registerAgent()
//   · registerSpecialist(specialist)      → BRB Network Router registration
//   · Own JSONL DB + heartbeat file       → per-agent isolation
//   · Analyse + Recommend + Observe API   → same shape · same evidence_kind
//   · RECOMMEND_ONLY_NEVER_EXECUTE        → same safety pattern
//   · Zero LLM · deterministic            · Ledger B infrastructure
//   · NOT wired into chat-turn / native-loop / native-investigation-mode
//     (Gate 1 remains frozen per LAMBDA-BRAINS-CHECKPOINT)

import { createSpecialistBrain, type Capability, type Analysis, type Recommendation } from "./capability-specialist-brain";
import { registerSpecialist } from "./capability-brb-network-router";

// ═══════════════════════════════════════════════════════════════════════
// 1 · CREATION SPECIALIST · capability + artifact creation
// ═══════════════════════════════════════════════════════════════════════

const creationCapabilities: readonly Capability[] = [
  { id: "creation_signal_detection", kind: "study", maturity: "PRIMITIVE", description: "Detect signals that new capability/file/fixture creation is warranted (existence_absent + creation-intent in reason)." },
  { id: "creation_novelty_check", kind: "study", maturity: "PRIMITIVE", description: "Compare proposed creation against existing_capabilities list to avoid duplicate creation." },
  { id: "creation_proposal", kind: "proposal", maturity: "PRIMITIVE", description: "Emit CREATE_PROPOSAL when signals are present · never executes." },
];

export const creationSpecialist = createSpecialistBrain({
  specialist_id: "creation_specialist",
  domain: "capability_and_artifact_creation",
  description: "Analyse whether a request implies creation of a new capability, file, fixture, or module. Distinct from surgery (repair) and building (composition). Recommend-only.",
  capabilities: creationCapabilities,
  cognitive_layer: "brain_recovery_specialist",
  safety_level: "RECOMMEND_ONLY_NEVER_EXECUTE",
  onAnalyse: (input): Omit<Analysis, "specialist_id" | "timestamp"> => {
    const data = (input ?? {}) as { intent?: string; existing_capabilities?: readonly string[]; target?: string; existence_absent?: boolean };
    const intent = String(data.intent ?? "").toLowerCase();
    const existing = data.existing_capabilities ?? [];
    const target = String(data.target ?? "").toLowerCase();
    const hasCreationVerb = /\b(create|add|new|introduce|write|build\s+a\s+new)\b/.test(intent);
    const absent = data.existence_absent === true;
    const duplicate = target.length > 0 && existing.some((e) => e.toLowerCase() === target);
    return {
      kind: hasCreationVerb && absent && !duplicate ? "creation_signal_present" : (duplicate ? "creation_duplicate_detected" : "no_creation_signal"),
      findings: {
        creation_verb_matched: hasCreationVerb,
        existence_absent: absent,
        would_duplicate: duplicate,
        target: data.target ?? null,
      },
      confidence: hasCreationVerb && absent && !duplicate ? 0.7 : 0.3,
      evidence_ids: [],
      evidence_kind: "OBSERVED",
    };
  },
  onRecommend: (input): Omit<Recommendation, "specialist_id" | "timestamp" | "action_class" | "requires_approval"> => {
    const data = (input ?? {}) as { intent?: string; target?: string; existence_absent?: boolean; existing_capabilities?: readonly string[] };
    const intent = String(data.intent ?? "").toLowerCase();
    const hasCreationVerb = /\b(create|add|new|introduce|write|build\s+a\s+new)\b/.test(intent);
    const absent = data.existence_absent === true;
    const duplicate = data.target && data.existing_capabilities?.some((e) => e.toLowerCase() === data.target!.toLowerCase());
    return {
      kind: hasCreationVerb && absent && !duplicate ? "CREATE_PROPOSAL" : "no_op",
      detail: {
        proposed_target: data.target ?? null,
        rationale: hasCreationVerb && absent && !duplicate ? "creation-intent + absence + non-duplicate" : "conditions not met",
        requires_verification: true,
        requires_approval: true,
      },
      evidence_ids: [],
    };
  },
});
registerSpecialist(creationSpecialist);

// ═══════════════════════════════════════════════════════════════════════
// 2 · BUILDING SPECIALIST · multi-step composition and assembly
// ═══════════════════════════════════════════════════════════════════════

const buildingCapabilities: readonly Capability[] = [
  { id: "build_composition_analysis", kind: "study", maturity: "PRIMITIVE", description: "Analyse whether a request is a multi-step build (composition) vs a single edit." },
  { id: "build_dependency_check", kind: "study", maturity: "PRIMITIVE", description: "Check whether prerequisites are available before proposing build." },
  { id: "build_proposal", kind: "proposal", maturity: "PRIMITIVE", description: "Emit BUILD_PROPOSAL for multi-step assemblies. Never executes." },
];

export const buildingSpecialist = createSpecialistBrain({
  specialist_id: "building_specialist",
  domain: "build_composition_and_assembly",
  description: "Analyse multi-step build workflows · composition of multiple pieces into a working system. Distinct from surgeon (single-file repair). Recommend-only.",
  capabilities: buildingCapabilities,
  cognitive_layer: "brain_recovery_specialist",
  safety_level: "RECOMMEND_ONLY_NEVER_EXECUTE",
  onAnalyse: (input): Omit<Analysis, "specialist_id" | "timestamp"> => {
    const data = (input ?? {}) as { steps?: readonly { target?: string }[]; prerequisites?: readonly string[]; prerequisites_available?: readonly string[] };
    const steps = data.steps ?? [];
    const prereqs = data.prerequisites ?? [];
    const available = new Set(data.prerequisites_available ?? []);
    const missing = prereqs.filter((p) => !available.has(p));
    const isMultiStep = steps.length >= 2;
    return {
      kind: isMultiStep && missing.length === 0 ? "build_composition_ready" : (missing.length > 0 ? "build_prerequisites_missing" : "single_step_not_a_build"),
      findings: {
        step_count: steps.length,
        prereq_count: prereqs.length,
        missing_prereqs: missing,
      },
      confidence: isMultiStep && missing.length === 0 ? 0.7 : 0.4,
      evidence_ids: [],
      evidence_kind: "OBSERVED",
    };
  },
  onRecommend: (input): Omit<Recommendation, "specialist_id" | "timestamp" | "action_class" | "requires_approval"> => {
    const data = (input ?? {}) as { steps?: readonly unknown[]; prerequisites?: readonly string[]; prerequisites_available?: readonly string[] };
    const isMultiStep = (data.steps?.length ?? 0) >= 2;
    const missing = (data.prerequisites ?? []).filter((p) => !(data.prerequisites_available ?? []).includes(p));
    return {
      kind: isMultiStep && missing.length === 0 ? "BUILD_PROPOSAL" : "no_op",
      detail: {
        step_count: data.steps?.length ?? 0,
        missing_prereqs: missing,
        requires_verification: true,
        requires_approval: true,
      },
      evidence_ids: [],
    };
  },
});
registerSpecialist(buildingSpecialist);

// ═══════════════════════════════════════════════════════════════════════
// 3 · DEVELOPMENT SPECIALIST · software-development-workflow reasoning
// ═══════════════════════════════════════════════════════════════════════
//
// DISTINCT from `brain_development_specialist` (which is about capability
// MATURITY LIFECYCLE · PRIMITIVE → DEVELOPING → MATURE). This specialist
// reasons about software-dev-lifecycle stages (design → build → test →
// deploy → observe).

const developmentCapabilities: readonly Capability[] = [
  { id: "dev_lifecycle_stage_detection", kind: "study", maturity: "PRIMITIVE", description: "Classify current work into design/build/test/deploy/observe." },
  { id: "dev_lifecycle_advance", kind: "study", maturity: "PRIMITIVE", description: "Recommend next stage transition based on completion signals." },
];

export const developmentSpecialist = createSpecialistBrain({
  specialist_id: "development_specialist",
  domain: "software_development_workflow",
  description: "Reason about software-development-lifecycle stages (design → build → test → deploy → observe). Distinct from brain_development_specialist which handles capability maturity.",
  capabilities: developmentCapabilities,
  cognitive_layer: "brain_recovery_specialist",
  safety_level: "RECOMMEND_ONLY_NEVER_EXECUTE",
  onAnalyse: (input): Omit<Analysis, "specialist_id" | "timestamp"> => {
    const data = (input ?? {}) as { activity?: string; artefacts?: readonly string[]; tests_passing?: boolean };
    const activity = String(data.activity ?? "").toLowerCase();
    const artefacts = data.artefacts ?? [];
    const testsPassing = data.tests_passing === true;
    let stage: string = "unknown";
    if (/\b(design|plan|spec|architect)\b/.test(activity)) stage = "design";
    else if (/\b(build|implement|write|code)\b/.test(activity)) stage = "build";
    else if (/\b(test|verify|assert)\b/.test(activity)) stage = "test";
    else if (/\b(deploy|ship|release|merge)\b/.test(activity)) stage = "deploy";
    else if (/\b(observe|monitor|measure)\b/.test(activity)) stage = "observe";
    return {
      kind: "dev_lifecycle_stage_" + stage,
      findings: { stage, artefact_count: artefacts.length, tests_passing: testsPassing },
      confidence: stage === "unknown" ? 0.3 : 0.7,
      evidence_ids: [],
      evidence_kind: "OBSERVED",
    };
  },
  onRecommend: (input): Omit<Recommendation, "specialist_id" | "timestamp" | "action_class" | "requires_approval"> => {
    const data = (input ?? {}) as { activity?: string; tests_passing?: boolean };
    const activity = String(data.activity ?? "").toLowerCase();
    let nextStage: string | null = null;
    if (/\b(design|plan)\b/.test(activity)) nextStage = "build";
    else if (/\b(build|implement)\b/.test(activity)) nextStage = "test";
    else if (/\b(test|verify)\b/.test(activity)) nextStage = data.tests_passing ? "deploy" : "build_or_diagnose";
    else if (/\b(deploy|ship)\b/.test(activity)) nextStage = "observe";
    return {
      kind: nextStage ? "DEV_LIFECYCLE_ADVANCE" : "no_op",
      detail: { next_stage: nextStage, requires_verification: true, requires_approval: true },
      evidence_ids: [],
    };
  },
});
registerSpecialist(developmentSpecialist);

// ═══════════════════════════════════════════════════════════════════════
// 4 · INNOVATION SPECIALIST · novel-combination recognition
// ═══════════════════════════════════════════════════════════════════════

const innovationCapabilities: readonly Capability[] = [
  { id: "novel_combination_detection", kind: "study", maturity: "PRIMITIVE", description: "Detect whether a proposal combines existing pieces in a way not previously seen in the corpus." },
  { id: "innovation_flag", kind: "study", maturity: "PRIMITIVE", description: "Flag combinations that cross usual capability boundaries." },
];

export const innovationSpecialist = createSpecialistBrain({
  specialist_id: "innovation_specialist",
  domain: "novel_combination_recognition",
  description: "Recognise novel combinations of existing capabilities. Distinct from creation (new artifact) and building (assembly). Recommend-only.",
  capabilities: innovationCapabilities,
  cognitive_layer: "brain_recovery_specialist",
  safety_level: "RECOMMEND_ONLY_NEVER_EXECUTE",
  onAnalyse: (input): Omit<Analysis, "specialist_id" | "timestamp"> => {
    const data = (input ?? {}) as { combined_capabilities?: readonly string[]; historical_combinations?: readonly string[] };
    const combined = data.combined_capabilities ?? [];
    const historical = new Set(data.historical_combinations ?? []);
    const combinedKey = [...combined].sort().join("+");
    const isNovel = combined.length >= 2 && !historical.has(combinedKey);
    return {
      kind: isNovel ? "novel_combination_detected" : (combined.length < 2 ? "not_a_combination" : "combination_seen_before"),
      findings: {
        combined_key: combinedKey,
        combination_size: combined.length,
        historical_size: historical.size,
        is_novel: isNovel,
      },
      confidence: isNovel ? 0.65 : 0.35,
      evidence_ids: [],
      evidence_kind: "OBSERVED",
    };
  },
  onRecommend: (input): Omit<Recommendation, "specialist_id" | "timestamp" | "action_class" | "requires_approval"> => {
    const data = (input ?? {}) as { combined_capabilities?: readonly string[]; historical_combinations?: readonly string[] };
    const combined = data.combined_capabilities ?? [];
    const historical = new Set(data.historical_combinations ?? []);
    const combinedKey = [...combined].sort().join("+");
    const isNovel = combined.length >= 2 && !historical.has(combinedKey);
    return {
      kind: isNovel ? "INNOVATION_PROPOSAL" : "no_op",
      detail: { combined_key: combinedKey, requires_verification: true, requires_approval: true },
      evidence_ids: [],
    };
  },
});
registerSpecialist(innovationSpecialist);

// ═══════════════════════════════════════════════════════════════════════
// 5 · CREATIVE SPECIALIST · cross-domain synthesis
// ═══════════════════════════════════════════════════════════════════════

const creativeCapabilities: readonly Capability[] = [
  { id: "cross_domain_detection", kind: "study", maturity: "PRIMITIVE", description: "Detect when a request spans multiple distinct domains." },
  { id: "synthesis_proposal", kind: "proposal", maturity: "PRIMITIVE", description: "Recommend synthesis approach when multiple domains are involved." },
];

export const creativeSpecialist = createSpecialistBrain({
  specialist_id: "creative_specialist",
  domain: "cross_domain_creative_synthesis",
  description: "Recognise inputs that require synthesis across multiple domains. Distinct from innovation (novel combination). Recommend-only.",
  capabilities: creativeCapabilities,
  cognitive_layer: "brain_recovery_specialist",
  safety_level: "RECOMMEND_ONLY_NEVER_EXECUTE",
  onAnalyse: (input): Omit<Analysis, "specialist_id" | "timestamp"> => {
    const data = (input ?? {}) as { domains?: readonly string[] };
    const domains = new Set(data.domains ?? []);
    const isCrossDomain = domains.size >= 2;
    return {
      kind: isCrossDomain ? "cross_domain_synthesis_needed" : "single_domain",
      findings: { distinct_domain_count: domains.size, domains: [...domains] },
      confidence: isCrossDomain ? 0.6 : 0.4,
      evidence_ids: [],
      evidence_kind: "OBSERVED",
    };
  },
  onRecommend: (input): Omit<Recommendation, "specialist_id" | "timestamp" | "action_class" | "requires_approval"> => {
    const data = (input ?? {}) as { domains?: readonly string[] };
    const domains = new Set(data.domains ?? []);
    return {
      kind: domains.size >= 2 ? "SYNTHESIS_PROPOSAL" : "no_op",
      detail: { distinct_domain_count: domains.size, requires_verification: true, requires_approval: true },
      evidence_ids: [],
    };
  },
});
registerSpecialist(creativeSpecialist);

// ═══════════════════════════════════════════════════════════════════════
// 6 · TESTING SPECIALIST · proactive verification design
// ═══════════════════════════════════════════════════════════════════════
//
// DISTINCT from `brain_pathology_specialist` (post-failure forensics) and
// `neurologist` (failure diagnosis). This specialist proactively designs
// verification coverage BEFORE a change is applied.

const testingCapabilities: readonly Capability[] = [
  { id: "verification_coverage_analysis", kind: "study", maturity: "PRIMITIVE", description: "Analyse whether a proposed change has verification coverage." },
  { id: "test_proposal", kind: "proposal", maturity: "PRIMITIVE", description: "Recommend tests needed before the change is applied." },
];

export const testingSpecialist = createSpecialistBrain({
  specialist_id: "testing_specialist",
  domain: "verification_test_design",
  description: "Proactively design verification coverage for proposed changes. Distinct from brain_pathology (post-failure) and neurologist (failure diagnosis). Recommend-only.",
  capabilities: testingCapabilities,
  cognitive_layer: "brain_recovery_specialist",
  safety_level: "RECOMMEND_ONLY_NEVER_EXECUTE",
  onAnalyse: (input): Omit<Analysis, "specialist_id" | "timestamp"> => {
    const data = (input ?? {}) as { proposed_change?: { file?: string; before?: string; after?: string }; existing_tests?: readonly string[] };
    const hasChange = typeof data.proposed_change?.after === "string";
    const testCount = data.existing_tests?.length ?? 0;
    return {
      kind: hasChange && testCount === 0 ? "verification_coverage_missing" : (hasChange ? "verification_coverage_present" : "no_change_to_test"),
      findings: { existing_test_count: testCount, target_file: data.proposed_change?.file ?? null },
      confidence: hasChange ? 0.7 : 0.3,
      evidence_ids: [],
      evidence_kind: "OBSERVED",
    };
  },
  onRecommend: (input): Omit<Recommendation, "specialist_id" | "timestamp" | "action_class" | "requires_approval"> => {
    const data = (input ?? {}) as { proposed_change?: { file?: string }; existing_tests?: readonly string[] };
    const hasChange = !!data.proposed_change?.file;
    const testCount = data.existing_tests?.length ?? 0;
    return {
      kind: hasChange && testCount === 0 ? "TEST_COVERAGE_PROPOSAL" : "no_op",
      detail: { target_file: data.proposed_change?.file ?? null, missing_test_coverage: hasChange && testCount === 0, requires_verification: true, requires_approval: true },
      evidence_ids: [],
    };
  },
});
registerSpecialist(testingSpecialist);

// ═══════════════════════════════════════════════════════════════════════
// 7 · COMMUNICATION SPECIALIST · conversation and message shape
// ═══════════════════════════════════════════════════════════════════════

const communicationCapabilities: readonly Capability[] = [
  { id: "message_shape_analysis", kind: "study", maturity: "PRIMITIVE", description: "Classify message shape · question / statement / request / refusal / clarification." },
  { id: "response_strategy", kind: "study", maturity: "PRIMITIVE", description: "Recommend response class based on message shape and turn history." },
];

export const communicationSpecialist = createSpecialistBrain({
  specialist_id: "communication_specialist",
  domain: "communication_and_conversation_shape",
  description: "Analyse conversation-turn shape and recommend response strategy. Complements chat-turn orchestrator without replacing it. Recommend-only.",
  capabilities: communicationCapabilities,
  cognitive_layer: "brain_recovery_specialist",
  safety_level: "RECOMMEND_ONLY_NEVER_EXECUTE",
  onAnalyse: (input): Omit<Analysis, "specialist_id" | "timestamp"> => {
    const data = (input ?? {}) as { message?: string; recent_turn_kinds?: readonly string[] };
    const msg = String(data.message ?? "");
    const hasQuestionMark = msg.includes("?");
    const startsImperative = /^\s*(please\s+)?(build|create|add|make|write|fix|delete|remove|change)\b/i.test(msg);
    const isRefusal = /\b(no|stop|don't|do not|refuse)\b/i.test(msg);
    let shape = "unknown";
    if (isRefusal) shape = "refusal";
    else if (hasQuestionMark) shape = "question";
    else if (startsImperative) shape = "request";
    else shape = "statement";
    return {
      kind: "message_shape_" + shape,
      findings: { shape, message_length: msg.length, recent_kinds_count: data.recent_turn_kinds?.length ?? 0 },
      confidence: shape === "unknown" ? 0.3 : 0.7,
      evidence_ids: [],
      evidence_kind: "OBSERVED",
    };
  },
  onRecommend: (input): Omit<Recommendation, "specialist_id" | "timestamp" | "action_class" | "requires_approval"> => {
    const data = (input ?? {}) as { message?: string };
    const msg = String(data.message ?? "");
    const hasQuestionMark = msg.includes("?");
    const isRequest = /^\s*(please\s+)?(build|create|add|make|write|fix)\b/i.test(msg);
    let strategy: string | null = null;
    if (hasQuestionMark) strategy = "answer_directly";
    else if (isRequest) strategy = "acknowledge_and_authorize";
    else strategy = null;
    return {
      kind: strategy ? "RESPONSE_STRATEGY_PROPOSAL" : "no_op",
      detail: { strategy, requires_verification: true, requires_approval: true },
      evidence_ids: [],
    };
  },
});
registerSpecialist(communicationSpecialist);

// ═══════════════════════════════════════════════════════════════════════
// 8 · AGENT EVALUATOR · fitness evaluation of other agents
// ═══════════════════════════════════════════════════════════════════════
//
// Distinct from `network_reporter` (aggregate status snapshot) — this
// specialist reads an agent's documented purpose vs its actual heartbeat
// activity and recommends a fitness verdict.

const agentEvaluatorCapabilities: readonly Capability[] = [
  { id: "agent_fitness_check", kind: "study", maturity: "PRIMITIVE", description: "Compare agent's documented purpose to its heartbeat activity." },
  { id: "agent_dormancy_flag", kind: "study", maturity: "PRIMITIVE", description: "Flag agents with zero heartbeats after registration." },
];

export const agentEvaluator = createSpecialistBrain({
  specialist_id: "agent_evaluator",
  domain: "agent_fitness_evaluation",
  description: "Evaluate the fitness of registered agents · compare documented purpose to observed heartbeat activity · flag dormancy. Recommend-only.",
  capabilities: agentEvaluatorCapabilities,
  cognitive_layer: "brain_recovery_specialist",
  safety_level: "RECOMMEND_ONLY_NEVER_EXECUTE",
  onAnalyse: (input): Omit<Analysis, "specialist_id" | "timestamp"> => {
    const data = (input ?? {}) as { agents?: readonly { agent_id?: string; total_beats?: number; description?: string }[] };
    const agents = data.agents ?? [];
    const dormant = agents.filter((a) => (a.total_beats ?? 0) === 0);
    const active = agents.filter((a) => (a.total_beats ?? 0) > 0);
    return {
      kind: dormant.length > 0 ? "dormant_agents_present" : "all_agents_active",
      findings: {
        total_agents: agents.length,
        active_count: active.length,
        dormant_count: dormant.length,
        dormant_ids: dormant.map((a) => a.agent_id).filter(Boolean),
      },
      confidence: agents.length > 0 ? 0.75 : 0.3,
      evidence_ids: [],
      evidence_kind: "OBSERVED",
    };
  },
  onRecommend: (input): Omit<Recommendation, "specialist_id" | "timestamp" | "action_class" | "requires_approval"> => {
    const data = (input ?? {}) as { agents?: readonly { agent_id?: string; total_beats?: number }[] };
    const dormant = (data.agents ?? []).filter((a) => (a.total_beats ?? 0) === 0);
    return {
      kind: dormant.length > 0 ? "AGENT_FITNESS_ATTENTION" : "no_op",
      detail: { dormant_ids: dormant.map((a) => a.agent_id).filter(Boolean), requires_verification: true, requires_approval: true },
      evidence_ids: [],
    };
  },
});
registerSpecialist(agentEvaluator);

// ═══════════════════════════════════════════════════════════════════════
// 9 · AGENT ENGINEER · network structure engineering
// ═══════════════════════════════════════════════════════════════════════
//
// Analyses the SHAPE of the agent network itself: gaps, redundancy,
// coverage. Complements agent_evaluator (which grades individual agents)
// and brain_development_specialist (which tracks capability maturity).

const agentEngineerCapabilities: readonly Capability[] = [
  { id: "network_gap_detection", kind: "study", maturity: "PRIMITIVE", description: "Detect capability domains not covered by any specialist." },
  { id: "network_redundancy_detection", kind: "study", maturity: "PRIMITIVE", description: "Detect specialists with overlapping domains." },
  { id: "network_engineering_proposal", kind: "proposal", maturity: "PRIMITIVE", description: "Recommend NEW_SPECIALIST or MERGE_SPECIALISTS based on coverage analysis." },
];

export const agentEngineer = createSpecialistBrain({
  specialist_id: "agent_engineer",
  domain: "agent_network_engineering",
  description: "Analyse the shape of the specialist network · detect coverage gaps and redundancy · recommend structural adjustments. Recommend-only.",
  capabilities: agentEngineerCapabilities,
  cognitive_layer: "brain_recovery_specialist",
  safety_level: "RECOMMEND_ONLY_NEVER_EXECUTE",
  onAnalyse: (input): Omit<Analysis, "specialist_id" | "timestamp"> => {
    const data = (input ?? {}) as { specialists?: readonly { specialist_id?: string; domain?: string }[]; required_domains?: readonly string[] };
    const domains = new Map<string, number>();
    for (const s of data.specialists ?? []) {
      const d = s.domain ?? "";
      domains.set(d, (domains.get(d) ?? 0) + 1);
    }
    const redundant = [...domains.entries()].filter(([, n]) => n > 1).map(([d]) => d);
    const required = new Set(data.required_domains ?? []);
    const covered = new Set([...domains.keys()]);
    const uncovered = [...required].filter((d) => !covered.has(d));
    return {
      kind: (redundant.length > 0 || uncovered.length > 0) ? "network_structural_finding" : "network_structurally_balanced",
      findings: {
        specialist_count: (data.specialists ?? []).length,
        distinct_domain_count: domains.size,
        redundant_domains: redundant,
        uncovered_required_domains: uncovered,
      },
      confidence: 0.7,
      evidence_ids: [],
      evidence_kind: "OBSERVED",
    };
  },
  onRecommend: (input): Omit<Recommendation, "specialist_id" | "timestamp" | "action_class" | "requires_approval"> => {
    const data = (input ?? {}) as { specialists?: readonly { domain?: string }[]; required_domains?: readonly string[] };
    const covered = new Set((data.specialists ?? []).map((s) => s.domain ?? ""));
    const uncovered = (data.required_domains ?? []).filter((d) => !covered.has(d));
    return {
      kind: uncovered.length > 0 ? "NEW_SPECIALIST_PROPOSAL" : "no_op",
      detail: { uncovered_domains: uncovered, requires_verification: true, requires_approval: true },
      evidence_ids: [],
    };
  },
});
registerSpecialist(agentEngineer);

// ═══════════════════════════════════════════════════════════════════════
// 10 · INTELLIGENCE AGENT · qualifies data flowing into NEX Brain
// ═══════════════════════════════════════════════════════════════════════
//
// Founder direction 2026-09-18: "the intelligent agent must have all data
// feed from the system and decide which data has the right to be sent
// into the brain as intelligent data which will give NEX increased
// intelligence."
//
// DESIGN INTENT
//   Aggregates observations from every registered agent (registry
//   snapshot + heartbeat state + specialist analyses passed in). Applies
//   a deterministic QUALIFICATION rulebook to decide which data records
//   have the right to be forwarded as "intelligent data." Emits
//   qualification recommendation · never auto-forwards.
//
// QUALIFICATION CRITERIA (Ledger B · disclosed)
//   A data record qualifies as intelligent data iff:
//     1. It carries an explicit evidence_kind (OBSERVED or INFERRED)
//     2. It has provenance (source specialist_id or agent_id present)
//     3. It has a correlation_id or entry_id (traceability)
//     4. Its source agent is not DORMANT (has emitted at least one beat)
//     5. It does NOT match the R11-B r11b_marker infrastructure-registry
//        pattern (registry telemetry must not enter intelligent-data stream)
//     6. Its consensus label is either UNANIMOUS · MAJORITY · SINGLE_RESPONDER
//        (raw DISAGREEMENT · NO_RESPONSE preserved as-is · not qualified as
//        intelligent data · but reported honestly)
//
// EMISSION
//   The agent EMITS `INTELLIGENT_DATA_QUALIFIED` recommendations for records
//   passing all six criteria. It DOES NOT wire these into any production
//   NEX Brain consumer — production wiring remains Gate 1 (frozen). Its
//   emissions accumulate in its own JSONL store for a future authorised
//   consumer to read.
//
// LEDGER
//   Ledger B · infrastructure only. The qualification rulebook is
//   Claude-authored. The specific records that pass are data-derived
//   from the system state at consult time.

const intelligenceAgentCapabilities: readonly Capability[] = [
  { id: "data_source_aggregation", kind: "study", maturity: "PRIMITIVE", description: "Aggregate observations from every registered agent (registry snapshot + heartbeats + supplied analyses)." },
  { id: "intelligence_qualification", kind: "study", maturity: "PRIMITIVE", description: "Apply six-criterion rulebook to classify each record as qualified/unqualified." },
  { id: "intelligent_data_emission", kind: "proposal", maturity: "PRIMITIVE", description: "Emit INTELLIGENT_DATA_QUALIFIED recommendation. Never forwards autonomously to production NEX Brain (Gate 1 frozen)." },
];

interface IntelligenceCandidateRecord {
  readonly source_agent_id?: string;
  readonly source_specialist_id?: string;
  readonly evidence_kind?: string;
  readonly correlation_id?: string;
  readonly entry_id?: string;
  readonly r11b_marker?: string;
  readonly consensus_label?: string;
  readonly kind?: string;
  readonly [k: string]: unknown;
}

export const intelligenceAgent = createSpecialistBrain({
  specialist_id: "intelligence_agent",
  domain: "data_intelligence_qualification",
  description: "Ingest data records from all system agents · apply deterministic six-criterion qualification rulebook · emit INTELLIGENT_DATA_QUALIFIED recommendations. Curates the candidate stream that could feed NEX Brain if production wiring were authorised. Ledger B infrastructure. Zero LLM. Recommend-only.",
  capabilities: intelligenceAgentCapabilities,
  cognitive_layer: "brain_recovery_specialist",
  safety_level: "RECOMMEND_ONLY_NEVER_EXECUTE",
  onAnalyse: (input): Omit<Analysis, "specialist_id" | "timestamp"> => {
    const data = (input ?? {}) as {
      records?: readonly IntelligenceCandidateRecord[];
      active_agent_ids?: readonly string[];
    };
    const records = data.records ?? [];
    const activeAgents = new Set<string>(data.active_agent_ids ?? []);

    let qualified = 0;
    let unqualified_missing_provenance = 0;
    let unqualified_dormant_source = 0;
    let unqualified_r11b_marker = 0;
    let unqualified_unresolved_consensus = 0;
    const qualifiedIds: string[] = [];

    for (const r of records) {
      const hasKind = typeof r.evidence_kind === "string" && (r.evidence_kind === "OBSERVED" || r.evidence_kind === "INFERRED");
      const hasProvenance = typeof (r.source_agent_id ?? r.source_specialist_id) === "string";
      const hasTrace = typeof (r.correlation_id ?? r.entry_id) === "string";
      const sourceId = r.source_agent_id ?? r.source_specialist_id ?? "";
      const sourceActive = activeAgents.size === 0 ? true : activeAgents.has(sourceId);
      const isR11B = typeof r.r11b_marker === "string" && r.r11b_marker.length > 0;
      const consensusOK = r.consensus_label === undefined
        || r.consensus_label === "UNANIMOUS"
        || r.consensus_label === "MAJORITY"
        || r.consensus_label === "SINGLE_RESPONDER";

      if (!hasKind || !hasProvenance || !hasTrace) { unqualified_missing_provenance++; continue; }
      if (!sourceActive) { unqualified_dormant_source++; continue; }
      if (isR11B) { unqualified_r11b_marker++; continue; }
      if (!consensusOK) { unqualified_unresolved_consensus++; continue; }
      qualified++;
      qualifiedIds.push(sourceId + ":" + (r.correlation_id ?? r.entry_id ?? "no_trace"));
    }

    return {
      kind: qualified > 0 ? "intelligent_data_candidates_present" : "no_intelligent_data_candidates",
      findings: {
        total_records: records.length,
        active_agent_count: activeAgents.size,
        qualified,
        qualified_ids_sample: qualifiedIds.slice(0, 10),
        unqualified_breakdown: {
          missing_provenance: unqualified_missing_provenance,
          dormant_source: unqualified_dormant_source,
          r11b_registry_infrastructure: unqualified_r11b_marker,
          unresolved_consensus: unqualified_unresolved_consensus,
        },
      },
      confidence: records.length > 0 ? 0.7 : 0.3,
      evidence_ids: qualifiedIds.slice(0, 10),
      evidence_kind: "OBSERVED",
    };
  },
  onRecommend: (input): Omit<Recommendation, "specialist_id" | "timestamp" | "action_class" | "requires_approval"> => {
    const data = (input ?? {}) as {
      records?: readonly IntelligenceCandidateRecord[];
      active_agent_ids?: readonly string[];
    };
    const records = data.records ?? [];
    const activeAgents = new Set<string>(data.active_agent_ids ?? []);
    const qualifiedIds: string[] = [];

    for (const r of records) {
      const hasKind = typeof r.evidence_kind === "string" && (r.evidence_kind === "OBSERVED" || r.evidence_kind === "INFERRED");
      const hasProvenance = typeof (r.source_agent_id ?? r.source_specialist_id) === "string";
      const hasTrace = typeof (r.correlation_id ?? r.entry_id) === "string";
      const sourceId = r.source_agent_id ?? r.source_specialist_id ?? "";
      const sourceActive = activeAgents.size === 0 ? true : activeAgents.has(sourceId);
      const isR11B = typeof r.r11b_marker === "string" && r.r11b_marker.length > 0;
      const consensusOK = r.consensus_label === undefined
        || r.consensus_label === "UNANIMOUS"
        || r.consensus_label === "MAJORITY"
        || r.consensus_label === "SINGLE_RESPONDER";
      if (hasKind && hasProvenance && hasTrace && sourceActive && !isR11B && consensusOK) {
        qualifiedIds.push(sourceId + ":" + (r.correlation_id ?? r.entry_id ?? "no_trace"));
      }
    }

    return {
      kind: qualifiedIds.length > 0 ? "INTELLIGENT_DATA_QUALIFIED" : "no_op",
      detail: {
        qualified_count: qualifiedIds.length,
        qualified_ids_sample: qualifiedIds.slice(0, 20),
        production_wiring: "GATE_1_FROZEN__DO_NOT_AUTO_FORWARD",
        requires_verification: true,
        requires_approval: true,
      },
      evidence_ids: qualifiedIds.slice(0, 10),
    };
  },
});
registerSpecialist(intelligenceAgent);

// ═══════════════════════════════════════════════════════════════════════

export const BRB_CREATIVE_SPECIALISTS_VERSION = "brb-creative-specialists.v2";
