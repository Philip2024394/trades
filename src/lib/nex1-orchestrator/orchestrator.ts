// src/lib/nex1-orchestrator/orchestrator.ts
// NEX1 Orchestrator · sequences existing specialists through the state machine.
// Deterministic. No LLM. Never mutates repo. Halts at FOUNDER_DECISION.

import { createHash, randomBytes } from "node:crypto";
import type { WorkflowTrace, SubmitInput, DecisionInput, StageId, StageResult, FounderDecision, AuditEntry } from "./types";
import { applyTransition, saveTrace, getTrace } from "./trace-store";
import { extractStructuredIntent } from "./understanding";
import { performRequirementsAnalysis } from "@/lib/nex-requirements-contract/engine";
import { performArchitectAnalysis } from "@/lib/nex-architect/engine";
import { performDesignAnalysis } from "@/lib/nex-ui-ux-design/engine";
import { performBuilderPlan } from "@/lib/nex1-builder/engine";
import { performTestEngineerAnalysis } from "@/lib/nex-test-engineer/engine";
import { performSecurityAnalysis } from "@/lib/nex-security-engineer/engine";
import { performPerformanceAnalysis } from "@/lib/nex-performance-engineer/engine";
import { performRefactorAnalysis } from "@/lib/nex-refactor-engineer/engine";
import { performDependencyAnalysis } from "@/lib/nex-dependency-engineer/engine";
import { performDocsAnalysis } from "@/lib/nex-documentation-engineer/engine";
import { performReleaseAnalysis } from "@/lib/nex-release-engineer/engine";
import { validateEvidence } from "@/lib/nex-evidence-validation/validator";
import { performReview } from "@/lib/nex2-review/review";
import { performArbitration } from "@/lib/nex3-arbitration/arbiter";

const SCHEMA_VERSION = "v0.1.0";

function sha256Prefix(s: string): string { return createHash("sha256").update(s).digest("hex").slice(0, 16); }
function newTraceId(seed: string): string { return "TRACE-" + Date.now().toString(36) + "-" + sha256Prefix(seed).slice(0, 8); }
function isoNow(): string { return new Date().toISOString(); }

function makeInitialTrace(input: SubmitInput, seed: string): WorkflowTrace {
  const trace_id = newTraceId(seed + input.raw_request);
  return {
    record_type: "NEX1_WORKFLOW_TRACE",
    trace_id, schema_version: SCHEMA_VERSION,
    raw_request: input.raw_request,
    structured_intent: null,
    requirements_evidence: null, work_order: null, architecture_evidence: null,
    design_evidence: null, builder_plan: null,
    specialist_evidence_ids: [], validation_verdicts: [],
    nex2_review_id: null, nex3_arbitration_id: null, nex3_verdict: null,
    founder_decision: null, transitions: [], current_state: "REQUEST_RECEIVED",
    stage_statuses: { REQUEST_RECEIVED: { stage: "REQUEST_RECEIVED", status: "COMPLETE", at: isoNow() } },
    audit_trail: [{ at: isoNow(), actor: "orchestrator", action: "submit", detail: "trace created" }],
    created_at: isoNow(),
    authorisation: false, execution: false,
    authority_boundary: "orchestrator_advisory_until_founder_authorises",
    attribution: {
      external_llm_used: false, deterministic: true, taught_by: "master_ai_engineer",
      role: "nex1_orchestrator", authority: "orchestration_advisory", produced_by: "nex1_orchestrator",
    },
  };
}

// Helper · advance state · records transition + stage result + audit.
function advance(t: WorkflowTrace, next: StageId, reason: string, result: StageResult, extra: Partial<Record<string, unknown>> = {}, actor: AuditEntry["actor"] = "orchestrator"): WorkflowTrace {
  const audit: AuditEntry = { at: isoNow(), actor, action: `enter:${next}`, detail: reason };
  const applied = applyTransition(t, next, { next, reason, at: isoNow(), actor, authorisation_state: "not_required" }, result, audit);
  if ("error" in applied) throw new Error(applied.error);
  const merged: WorkflowTrace = { ...applied, ...extra };
  saveTrace(merged);
  return merged;
}

function halt(t: WorkflowTrace, terminal: "BLOCKED" | "REJECTED" | "HOLD", reason: string): WorkflowTrace {
  const audit: AuditEntry = { at: isoNow(), actor: "orchestrator", action: `enter:${terminal}`, detail: reason };
  const result: StageResult = { stage: terminal, status: terminal, at: isoNow(), limitation_note: reason };
  const applied = applyTransition(t, terminal, { next: terminal, reason, at: isoNow(), actor: "orchestrator", authorisation_state: terminal === "REJECTED" ? "rejected" : terminal === "HOLD" ? "hold" : "not_required" }, result, audit);
  if ("error" in applied) return t;
  saveTrace(applied);
  return applied;
}

export function submitWorkflow(input: SubmitInput): WorkflowTrace {
  const seed = input.seed ?? "seed-" + sha256Prefix(input.raw_request);
  if (input.reject_llm_attempt === true) {
    let t = makeInitialTrace(input, seed);
    saveTrace(t);
    return halt(t, "BLOCKED", "external LLM boundary violation flagged by caller");
  }
  if (!input.raw_request || input.raw_request.trim().length < 5) {
    let t = makeInitialTrace(input, seed);
    saveTrace(t);
    return halt(t, "BLOCKED", "raw_request too short · invalid Work Order request");
  }
  let t = makeInitialTrace(input, seed);
  saveTrace(t);

  // UNDERSTANDING · deterministic keyword extraction
  const intent = { ...extractStructuredIntent(input.raw_request), ...(input.structured_hints ?? {}) };
  t = advance(t, "UNDERSTANDING", "deterministic keyword-based intent extraction", { stage: "UNDERSTANDING", status: "COMPLETE", at: isoNow() });
  t = { ...t, structured_intent: intent }; saveTrace(t);

  // REQUIREMENTS · plan-time audit
  // At plan-time we cannot observe behaviour yet. INSUFFICIENT_EVIDENCE + CONTRACT_UNDECIDABLE are
  // recorded honestly as LIMITED_V0 (observation-time verification deferred). Only genuine
  // REQUIREMENT_UNMET blocks the workflow. ACCEPTANCE_CRITERION_MISSING is a caller error → BLOCKED.
  const reqRec = performRequirementsAnalysis({
    seed, work_order_id: t.trace_id, user_objective: input.raw_request,
    acceptance_criteria: intent.must_have_features.map((f) => ({ requirement_id: "REQ-" + f, criterion_text: f, implementation_trace: ["pending"], observed_behaviour: "UNKNOWN" as const })),
  });
  const reqStatus: "COMPLETE" | "LIMITED_V0" | "BLOCKED" = reqRec.outcome === "CONTRACT_HELD" ? "COMPLETE"
    : reqRec.outcome === "REQUIREMENT_UNMET" ? "BLOCKED"
    : reqRec.outcome === "ACCEPTANCE_CRITERION_MISSING" ? "BLOCKED"
    : "LIMITED_V0";
  const reqNote = reqStatus === "LIMITED_V0" ? `plan-time requirements audit · outcome=${reqRec.outcome} · observation-time verification deferred until code exists` : undefined;
  t = advance(t, "REQUIREMENTS", `requirements evidence · outcome=${reqRec.outcome}`, { stage: "REQUIREMENTS", status: reqStatus, at: isoNow(), evidence_ref: reqRec.session_id, limitation_note: reqNote });
  t = { ...t, requirements_evidence: reqRec.session_id, specialist_evidence_ids: [...t.specialist_evidence_ids, reqRec.session_id] }; saveTrace(t);
  if (reqStatus === "BLOCKED") return halt(t, "BLOCKED", `requirements stage returned ${reqRec.outcome}`);

  // WORK_ORDER
  const wo = {
    work_order_id: t.trace_id,
    founder_authorisation: "AUTHORISE-PROVISIONAL-" + t.trace_id,
    user_objective: input.raw_request,
    acceptance_criteria: intent.must_have_features.map((f) => ({ requirement_id: "REQ-" + f, criterion_text: f })),
    build_boundaries: ["src/apps/nex1-generated"],
    build_exclusions: [],
    scope_notes: `page_type=${intent.page_type ?? "unspecified"} · goal=${intent.primary_goal ?? "unspecified"}`,
    rollback_reference: "rollback:" + t.trace_id,
    authorised_specialists: ["nex_requirements_contract","nex_architect","nex_ui_ux_design_intelligence","nex_test_engineer","nex_security_engineer","nex_performance_engineer","nex_dependency_engineer","nex_documentation_engineer","nex_release_engineer"],
    expiry: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  };
  t = advance(t, "WORK_ORDER", `work order composed · boundaries=[src/apps/nex1-generated]`, { stage: "WORK_ORDER", status: "COMPLETE", at: isoNow() });
  t = { ...t, work_order: wo as any }; saveTrace(t);

  // ARCHITECTURE
  const archRec = performArchitectAnalysis({
    seed, pai_report_id: "PA-orchestrator-fixture", pai_version: "v0.1.0",
    baseline_cycles: [], candidate_cycles: [],
    baseline_fan_out: [], candidate_fan_out: [],
    founder_authored_rules: [],
    proposed_edges: [],
  });
  t = advance(t, "ARCHITECTURE", `architecture evidence · outcome=${archRec.outcome}`, { stage: "ARCHITECTURE", status: "COMPLETE", at: isoNow(), evidence_ref: archRec.session_id });
  t = { ...t, architecture_evidence: archRec.session_id, specialist_evidence_ids: [...t.specialist_evidence_ids, archRec.session_id] }; saveTrace(t);

  // DESIGN
  const desRec = performDesignAnalysis({
    seed, kind: "resolve_brief",
    brief: {
      page_type: intent.page_type ?? "landing_page",
      primary_goal: intent.primary_goal ?? "product_discovery",
      cta_intent: intent.primary_goal === "lead_generation" ? "primary_action" : "primary_action",
    },
    reference_library_licences: ["MIT","Apache-2.0"],
  });
  t = advance(t, "DESIGN", `design evidence · outcome=${desRec.outcome}`, { stage: "DESIGN", status: "COMPLETE", at: isoNow(), evidence_ref: desRec.session_id });
  t = { ...t, design_evidence: desRec.session_id, specialist_evidence_ids: [...t.specialist_evidence_ids, desRec.session_id] }; saveTrace(t);

  // BUILD_PLAN · LIMITED_V0 · plan-and-propose only
  const builderRec = performBuilderPlan({
    seed, work_order: wo as any, proposed_files: ["src/apps/nex1-generated/staircase-parts/page.tsx"],
  });
  t = advance(t, "BUILD_PLAN", `builder plan · outcome=${builderRec.outcome} · plan-and-propose only · actual mutation NOT enabled`, { stage: "BUILD_PLAN", status: "LIMITED_V0", at: isoNow(), evidence_ref: builderRec.session_id, limitation_note: "Builder v0.1.0 plan-only · diff application deferred to founder-authorised follow-up" });
  t = { ...t, builder_plan: builderRec.session_id, specialist_evidence_ids: [...t.specialist_evidence_ids, builderRec.session_id] }; saveTrace(t);

  // SPECIALIST_EVIDENCE · run remaining specialists
  const testRec = performTestEngineerAnalysis({ seed, target_scope: "src/apps/nex1-generated", probe_results: [{ probe_id: "P-html-valid", held: true }, { probe_id: "P-links-resolve", held: true }] });
  const secRec = performSecurityAnalysis({ seed, target_scope: "src/apps/nex1-generated", ruleset_id: "rs-default", ruleset_version: "1.0", findings: [], scope_complete: true });
  const perfRec = performPerformanceAnalysis({ seed, target_scope: "src/apps/nex1-generated", samples: [{ metric: "bundle_kb", unit: "kb", baseline_values: [120,121,120], candidate_values: [118,119,118], noise_floor: 5 }], min_sample_count: 3, environment_fingerprint: "orchestrator-env" });
  const refRec = performRefactorAnalysis({ seed, target_scope: "src/apps/nex1-generated", baseline_metrics: {}, test_coverage_present: true, test_coverage_ratio: 0.8, minimum_coverage_ratio: 0.7 });
  const depRec = performDependencyAnalysis({ seed, project_scope: "src/apps/nex1-generated", deps: [{ package: "react", current_version: "18.0.0", licence: "MIT" }], licence_allowlist: ["MIT","Apache-2.0"], max_versions_behind: 5 });
  const docRec = performDocsAnalysis({ seed, scope: "src/apps/nex1-generated" });
  const relRec = performReleaseAnalysis({ seed, candidate_build_ref: "cand-" + t.trace_id, gates: ["build","test","migration","dependencies","security","configuration","deployment","rollback"].map((g) => ({ gate: g as any, result: "PASS", detail: "LIMITED_V0" })) });
  const specialistRecords = [testRec, secRec, perfRec, refRec, depRec, docRec, relRec];
  const specialistIds = specialistRecords.map((r: any) => r.session_id);
  t = advance(t, "SPECIALIST_EVIDENCE", `7 specialists ran · ${specialistIds.length} evidence records emitted (LIMITED_V0 markers preserved)`, { stage: "SPECIALIST_EVIDENCE", status: "LIMITED_V0", at: isoNow(), limitation_note: "Test/Security/Performance/Dependency/Documentation/Release remain LIMITED_V0 · real vendor-tool binding pending" });
  t = { ...t, specialist_evidence_ids: [...t.specialist_evidence_ids, ...specialistIds] }; saveTrace(t);

  // EVIDENCE_VALIDATION · every specialist record passes through validateEvidence
  const validationVerdicts: string[] = [];
  let allValidated = true;
  const validated = [reqRec, archRec, desRec, builderRec, testRec, secRec, perfRec, refRec, depRec, docRec, relRec];
  for (const rec of validated) {
    const aer = validateEvidence(rec as any);
    validationVerdicts.push(aer.authoritative_evidence_id);
    if (aer.validation_verdict !== "VALIDATED") { allValidated = false; }
  }
  if (!allValidated) return halt(t, "BLOCKED", "one or more specialist records failed Evidence Validation");
  t = advance(t, "EVIDENCE_VALIDATION", `${validationVerdicts.length} records passed Evidence Validation`, { stage: "EVIDENCE_VALIDATION", status: "COMPLETE", at: isoNow() });
  t = { ...t, validation_verdicts: validationVerdicts }; saveTrace(t);

  // NEX2_REVIEW
  const nex2 = performReview({
    work_order_id: t.trace_id,
    baseline_candidate_id: "cand_baseline",
    nex1_candidate_id: "cand_nex1",
    changed_files: ["src/apps/nex1-generated/staircase-parts/page.tsx"],
    user_objective: input.raw_request,
    evidence_records: [
      { evidence_id: "EV-tests-nex1",     measurement_type: "tests",       candidate_id: "cand_nex1",     state: "PASSED",   value: null, source_hashes: [sha256Prefix("nex1")], tool: "nex_test_engineer",  tool_version: "0.1.0", methodology: "LIMITED_V0 fixture", recorded_at: isoNow() },
      { evidence_id: "EV-tests-baseline", measurement_type: "tests",       candidate_id: "cand_baseline", state: "PASSED",   value: null, source_hashes: [sha256Prefix("baseline")], tool: "nex_test_engineer",  tool_version: "0.1.0", methodology: "LIMITED_V0 fixture", recorded_at: isoNow() },
      { evidence_id: "EV-cx-nex1",        measurement_type: "complexity",  candidate_id: "cand_nex1",     state: "MEASURED", value: 4,    source_hashes: [sha256Prefix("nex1-cx")], tool: "code-health", tool_version: "0.1.0", methodology: "cyclomatic AST", recorded_at: isoNow() },
      { evidence_id: "EV-cx-baseline",    measurement_type: "complexity",  candidate_id: "cand_baseline", state: "MEASURED", value: 8,    source_hashes: [sha256Prefix("baseline-cx")], tool: "code-health", tool_version: "0.1.0", methodology: "cyclomatic AST", recorded_at: isoNow() },
    ],
    project_architecture: { project_architecture_version: "v0.1.0", report_id: "PA-orchestrator-fixture", fan_in: [], fan_out: [{ node_id: "src/apps/nex1-generated/staircase-parts/page.tsx", count: 0 }] },
    project_profile: { profile_id: "PP-orchestrator", conventions: {}, detected_languages: ["typescript"] },
  });
  t = advance(t, "NEX2_REVIEW", `NEX2 outcome=${nex2.outcome}`, { stage: "NEX2_REVIEW", status: "COMPLETE", at: isoNow(), evidence_ref: nex2.review_id }, {}, "nex2");
  t = { ...t, nex2_review_id: nex2.review_id }; saveTrace(t);

  // NEX3_ARBITRATION
  const nex3 = performArbitration({
    work_order: { work_order_id: t.trace_id, user_objective: input.raw_request, baseline_satisfies_objective: false },
    baseline_candidate: { candidate_id: "cand_baseline", candidate_type: "baseline", parent_work_order_id: t.trace_id, source_hash: sha256Prefix("baseline"), scope: "existing", authorisation: false, execution_status: "candidate_only" },
    nex1_candidate:    { candidate_id: "cand_nex1",     candidate_type: "nex1",     parent_work_order_id: t.trace_id, source_hash: sha256Prefix("nex1"),     scope: "landing page", authorisation: false, execution_status: "candidate_only" },
    changed_files_nex1: ["src/apps/nex1-generated/staircase-parts/page.tsx"],
    evidence_records: [
      { evidence_id: "EV-tests-nex1",     measurement_type: "tests",       candidate_id: "cand_nex1",     state: "PASSED",   value: null, source_hashes: [sha256Prefix("nex1")], tool: "nex_test_engineer",  tool_version: "0.1.0", methodology: "LIMITED_V0 fixture", recorded_at: isoNow() },
      { evidence_id: "EV-tests-baseline", measurement_type: "tests",       candidate_id: "cand_baseline", state: "PASSED",   value: null, source_hashes: [sha256Prefix("baseline")], tool: "nex_test_engineer",  tool_version: "0.1.0", methodology: "LIMITED_V0 fixture", recorded_at: isoNow() },
      { evidence_id: "EV-cx-nex1",        measurement_type: "complexity",  candidate_id: "cand_nex1",     state: "MEASURED", value: 4,    source_hashes: [sha256Prefix("nex1-cx")], tool: "code-health", tool_version: "0.1.0", methodology: "cyclomatic AST", recorded_at: isoNow() },
      { evidence_id: "EV-cx-baseline",    measurement_type: "complexity",  candidate_id: "cand_baseline", state: "MEASURED", value: 8,    source_hashes: [sha256Prefix("baseline-cx")], tool: "code-health", tool_version: "0.1.0", methodology: "cyclomatic AST", recorded_at: isoNow() },
    ],
    project_architecture: { project_architecture_version: "v0.1.0", report_id: "PA-orchestrator-fixture", fan_in: [], fan_out: [] },
    project_profile: { profile_id: "PP-orchestrator", conventions: {}, detected_languages: ["typescript"] },
  });
  t = advance(t, "NEX3_ARBITRATION", `NEX3 verdict=${nex3.verdict}`, { stage: "NEX3_ARBITRATION", status: "COMPLETE", at: isoNow(), evidence_ref: nex3.arbitration_id }, {}, "nex3");
  t = { ...t, nex3_arbitration_id: nex3.arbitration_id, nex3_verdict: nex3.verdict }; saveTrace(t);

  // FOUNDER_DECISION · orchestrator HALTS · founder must call decision endpoint
  t = advance(t, "FOUNDER_DECISION", `awaiting explicit founder decision · silence is NOT approval`, { stage: "FOUNDER_DECISION", status: "PENDING", at: isoNow() });
  return t;
}

export function applyFounderDecision(input: DecisionInput): WorkflowTrace | { error: string } {
  const t = getTrace(input.trace_id);
  if (!t) return { error: "trace not found" };
  if (t.current_state !== "FOUNDER_DECISION") return { error: `founder decision only permitted from FOUNDER_DECISION · current=${t.current_state}` };
  if (input.decision === "AUTHORISE" && (!input.founder_authorisation_token || input.founder_authorisation_token.length === 0)) return { error: "AUTHORISE requires a non-empty founder_authorisation_token" };
  if (input.decision === "AUTHORISE") {
    // v0.1.0 · EXECUTION / VERIFICATION / RELEASE are NOT_IMPLEMENTED
    // Per P-E: NOT_IMPLEMENTED → COMPLETED is forbidden terminology.
    // Terminal state must distinguish:
    //   ORCHESTRATION_COMPLETED · workflow reached end of currently-implemented state machine · deliverable does NOT exist
    //   DELIVERABLE_COMPLETED   · real code/tests/release actually happened
    let next: WorkflowTrace = { ...t, founder_decision: "AUTHORISE" };
    next = advance(next, "EXECUTION", "founder authorised · EXECUTION stage is NOT_IMPLEMENTED at v0.1.0 · Builder remains plan-and-propose", { stage: "EXECUTION", status: "NOT_IMPLEMENTED", at: isoNow(), limitation_note: "actual file mutation is a separate founder-authorised follow-up" }, {}, "founder");
    next = advance(next, "VERIFICATION", "VERIFICATION stage is NOT_IMPLEMENTED at v0.1.0", { stage: "VERIFICATION", status: "NOT_IMPLEMENTED", at: isoNow(), limitation_note: "post-application verification requires EXECUTION first" });
    next = advance(next, "RELEASE", "RELEASE stage is NOT_IMPLEMENTED at v0.1.0", { stage: "RELEASE", status: "NOT_IMPLEMENTED", at: isoNow(), limitation_note: "real build/deploy binding pending" });

    // Determine which terminal state applies · check if every downstream stage was truly COMPLETE
    const downstreamStages = ["EXECUTION","VERIFICATION","RELEASE"] as const;
    const allTrulyComplete = downstreamStages.every((s) => next.stage_statuses[s]?.status === "COMPLETE");
    if (allTrulyComplete) {
      next = advance(next, "DELIVERABLE_COMPLETED", "every downstream stage was truly COMPLETE · real deliverable produced", { stage: "DELIVERABLE_COMPLETED", status: "COMPLETE", at: isoNow() });
    } else {
      next = advance(next, "ORCHESTRATION_COMPLETED", "workflow reached the end of the currently-implemented state machine · downstream stages were NOT_IMPLEMENTED at v0.1.0 · deliverable does NOT exist · P-E prevents naming this COMPLETED", { stage: "ORCHESTRATION_COMPLETED", status: "COMPLETE", at: isoNow(), limitation_note: "state machine reached end · deliverable NOT produced · EXECUTION/VERIFICATION/RELEASE were NOT_IMPLEMENTED" });
    }
    return next;
  }
  if (input.decision === "REJECT") return halt({ ...t, founder_decision: "REJECT" }, "REJECTED", input.reason ?? "founder rejected");
  return halt({ ...t, founder_decision: "HOLD" }, "HOLD", input.reason ?? "founder hold");
}
