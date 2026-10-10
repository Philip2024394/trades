// src/lib/nex-agent/code-engine/brb/brb-extended-specialists.ts
//
// NEX1 · Brain Recovery Network · Phase 7 · six remaining specialists + reporter.
//
//   behaviour_specialist         · Section 10 · observable decision behaviour
//   brain_imaging_specialist     · Section 11 · READ-ONLY internal inspection
//   brain_pathology_specialist   · Section 12 · post-failure analysis
//   state_regulation_specialist  · Section 13 · monitor NEX1 operating state
//   brain_development_specialist · Section 14 · capability maturity + lineage
//   boundary_interface_specialist· Section 15 · interface/representation mismatches
//   network_reporter             · founder-authorised addition · aggregates specialist reports
//
// All specialists remain RECOMMEND_ONLY. Network reporter is READ_ONLY.

import { createSpecialistBrain, type Capability, type Analysis, type Recommendation, type Hypothesis } from "./capability-specialist-brain";
import { registerSpecialist, collectHeartbeats, listSpecialists, getSpecialist } from "./capability-brb-network-router";

// ── Behaviour Specialist ────────────────────────────────────────────────
export const behaviourSpecialist = createSpecialistBrain({
  specialist_id: "behaviour_specialist",
  domain: "observable_decision_behaviour",
  description: "Analyse NEX1 system behaviour: prediction, confidence, refusal, uncertainty, repeated errors, behavioural changes after experience, consistency, adaptation. Does not speculate about human psychology.",
  capabilities: [
    { id: "behavioural_summary", kind: "study", maturity: "DEVELOPING", description: "Summarise prediction distribution, refusal rate, unknown rate over supplied records." },
    { id: "consistency_check", kind: "study", maturity: "PRIMITIVE", description: "Measure whether identical inputs produce identical outputs across sessions." },
    { id: "adaptation_signal", kind: "study", maturity: "PRIMITIVE", description: "Report whether behaviour changed between two evidence windows." },
  ],
  cognitive_layer: "brain_recovery_specialist",
  onAnalyse: (input): Omit<Analysis, "specialist_id" | "timestamp"> => {
    const data = (input ?? {}) as { records?: readonly { prediction_label?: unknown; matched?: boolean | null; prediction_confidence?: number }[] };
    const records = data.records ?? [];
    const distinctPredictions = new Set(records.map((r) => JSON.stringify(r.prediction_label)));
    const abstained = records.filter((r) => r.matched === null).length;
    const refused = records.filter((r) => r.prediction_label === "unknown_no_prior_evidence" || r.prediction_label === null).length;
    const avgConfidence = records.length > 0 ? records.reduce((s, r) => s + (r.prediction_confidence ?? 0), 0) / records.length : null;
    return {
      kind: "behavioural_summary",
      findings: {
        total: records.length,
        distinct_prediction_labels: distinctPredictions.size,
        abstained,
        refusal_or_unknown: refused,
        average_confidence: avgConfidence,
      },
      confidence: records.length >= 3 ? 0.65 : 0.3,
      evidence_ids: [],
      evidence_kind: "OBSERVED",
    };
  },
});
registerSpecialist(behaviourSpecialist);

// ── Brain Imaging Specialist · READ ONLY ────────────────────────────────
export const brainImagingSpecialist = createSpecialistBrain({
  specialist_id: "brain_imaging_specialist",
  domain: "internal_architecture_inspection",
  description: "Inspect brain topology, capability relationships, data flow, dependency relationships, specialist connections. READ ONLY. Produces diagnostic snapshots; does NOT repair.",
  capabilities: [
    { id: "topology_snapshot", kind: "inspection", maturity: "DEVELOPING", description: "Read-only snapshot of registered agents, brains, capabilities." },
    { id: "structural_anomaly_detection", kind: "inspection", maturity: "PRIMITIVE", description: "Compare current topology to a prior snapshot; report additions/removals." },
  ],
  cognitive_layer: "brain_recovery_specialist",
  safety_level: "READ_ONLY",
  onAnalyse: (input): Omit<Analysis, "specialist_id" | "timestamp"> => {
    const specialists = listSpecialists();
    const detail: Record<string, { capabilities: number; status: string }> = {};
    for (const sid of specialists) {
      const b = getSpecialist(sid);
      if (b) detail[sid] = { capabilities: b.capabilities().length, status: b.status() };
    }
    return {
      kind: "topology_snapshot",
      findings: {
        registered_specialists: specialists.length,
        specialists: detail,
      },
      confidence: 0.9,
      evidence_ids: [],
      evidence_kind: "OBSERVED",
    };
  },
});
registerSpecialist(brainImagingSpecialist);

// ── Brain Pathology Specialist ──────────────────────────────────────────
export const brainPathologySpecialist = createSpecialistBrain({
  specialist_id: "brain_pathology_specialist",
  domain: "post_failure_analysis",
  description: "Analyse failed experiments; identify recurring failure signatures; determine whether a failure is isolated or recurring; preserve forensic evidence; detect regressions.",
  capabilities: [
    { id: "failure_signature_extraction", kind: "forensics", maturity: "DEVELOPING", description: "Extract a signature from failed prediction records to enable future family-detection." },
    { id: "regression_detection", kind: "forensics", maturity: "PRIMITIVE", description: "Compare current failure rate to prior windows." },
    { id: "recurrence_check", kind: "forensics", maturity: "PRIMITIVE", description: "Check whether a signature has been seen before in stored experience." },
  ],
  cognitive_layer: "brain_recovery_specialist",
  onAnalyse: (input): Omit<Analysis, "specialist_id" | "timestamp"> => {
    const data = (input ?? {}) as { failed_records?: readonly { features?: Record<string, unknown>; prediction_label?: unknown }[] };
    const failures = data.failed_records ?? [];
    const signatureCounts = new Map<string, number>();
    for (const f of failures) {
      const sig = JSON.stringify({ features: f.features ?? {}, pred: f.prediction_label });
      signatureCounts.set(sig, (signatureCounts.get(sig) ?? 0) + 1);
    }
    const recurring = [...signatureCounts.entries()].filter(([, n]) => n >= 2);
    return {
      kind: recurring.length > 0 ? "recurring_failure_signatures_present" : "no_recurring_signatures",
      findings: {
        total_failures: failures.length,
        distinct_signatures: signatureCounts.size,
        recurring_signature_count: recurring.length,
      },
      confidence: failures.length >= 3 ? 0.6 : 0.3,
      evidence_ids: [],
      evidence_kind: "OBSERVED",
    };
  },
});
registerSpecialist(brainPathologySpecialist);

// ── State / Regulation Specialist ───────────────────────────────────────
export const stateRegulationSpecialist = createSpecialistBrain({
  specialist_id: "state_regulation_specialist",
  domain: "internal_operating_state_monitoring",
  description: "Monitor NEX1 operating state: confidence level, uncertainty, overload, conflicting evidence, excessive activation, degraded specialist state, escalation. Does not diagnose humans.",
  capabilities: [
    { id: "conflict_detection", kind: "monitoring", maturity: "DEVELOPING", description: "Detect when specialist recommendations conflict (kind counts on a broadcast result)." },
    { id: "overload_signal", kind: "monitoring", maturity: "PRIMITIVE", description: "Detect degraded specialists via heartbeat collection." },
    { id: "escalation_signal", kind: "monitoring", maturity: "PRIMITIVE", description: "Emit escalation flag when uncertainty exceeds a threshold." },
  ],
  cognitive_layer: "brain_recovery_specialist",
  onAnalyse: (input): Omit<Analysis, "specialist_id" | "timestamp"> => {
    const hbs = collectHeartbeats();
    const degraded = hbs.filter((h) => h.status === "DEGRADED").length;
    const inactive = hbs.filter((h) => h.status !== "ACTIVE").length;
    const data = (input ?? {}) as { recent_disagreement_count?: number };
    return {
      kind: degraded > 0 || inactive > 0 ? "state_requires_attention" : "state_nominal",
      findings: {
        total_specialists: hbs.length,
        degraded_count: degraded,
        non_active_count: inactive,
        recent_disagreement_count: data.recent_disagreement_count ?? null,
      },
      confidence: 0.8,
      evidence_ids: [],
      evidence_kind: "OBSERVED",
    };
  },
});
registerSpecialist(stateRegulationSpecialist);

// ── Brain Development Specialist ────────────────────────────────────────
export const brainDevelopmentSpecialist = createSpecialistBrain({
  specialist_id: "brain_development_specialist",
  domain: "capability_maturity_and_lineage",
  description: "Track capability maturity, lineage, developmental progression, dependencies, regressions; report whether a capability is stable enough for transfer.",
  capabilities: [
    { id: "maturity_report", kind: "study", maturity: "DEVELOPING", description: "Report distribution of capability maturity levels across the network." },
    { id: "transfer_readiness_check", kind: "gate", maturity: "PRIMITIVE", description: "Identify capabilities at MATURE or TRANSFER_READY level." },
  ],
  cognitive_layer: "brain_recovery_specialist",
  onAnalyse: (input): Omit<Analysis, "specialist_id" | "timestamp"> => {
    const byMaturity: Record<string, number> = { PRIMITIVE: 0, DEVELOPING: 0, MATURE: 0, TRANSFER_READY: 0 };
    for (const sid of listSpecialists()) {
      const b = getSpecialist(sid);
      if (!b) continue;
      for (const c of b.capabilities()) byMaturity[c.maturity] = (byMaturity[c.maturity] ?? 0) + 1;
    }
    return {
      kind: "maturity_distribution",
      findings: {
        distribution: byMaturity,
        transfer_ready_or_mature: byMaturity.MATURE + byMaturity.TRANSFER_READY,
      },
      confidence: 0.85,
      evidence_ids: [],
      evidence_kind: "OBSERVED",
    };
  },
});
registerSpecialist(brainDevelopmentSpecialist);

// ── Boundary / Interface Specialist ─────────────────────────────────────
export const boundaryInterfaceSpecialist = createSpecialistBrain({
  specialist_id: "boundary_interface_specialist",
  domain: "interface_and_representation_mismatches",
  description: "Detect when information available to one brain does not align with information required by another. Reports BOUNDARY_OBSERVED with evidence; does NOT invent missing features.",
  capabilities: [
    { id: "interface_mismatch_detection", kind: "diagnostic", maturity: "DEVELOPING", description: "Compare fields expected vs fields provided in an inter-brain payload." },
    { id: "boundary_observed_signal", kind: "diagnostic", maturity: "PRIMITIVE", description: "Emit BOUNDARY_OBSERVED with evidence when mismatches are found." },
  ],
  cognitive_layer: "brain_recovery_specialist",
  onAnalyse: (input): Omit<Analysis, "specialist_id" | "timestamp"> => {
    const data = (input ?? {}) as { expected_fields?: readonly string[]; provided_fields?: readonly string[]; source?: string; target?: string };
    const expected = new Set(data.expected_fields ?? []);
    const provided = new Set(data.provided_fields ?? []);
    const missing = [...expected].filter((f) => !provided.has(f));
    const extra = [...provided].filter((f) => !expected.has(f));
    const mismatch = missing.length > 0 || extra.length > 0;
    return {
      kind: mismatch ? "BOUNDARY_OBSERVED" : "no_boundary_observed",
      findings: {
        source: data.source ?? null,
        target: data.target ?? null,
        missing_fields: missing,
        unexpected_fields: extra,
        // NOTE · we deliberately do NOT propose which field to add.
      },
      confidence: 0.7,
      evidence_ids: [],
      evidence_kind: "OBSERVED",
    };
  },
});
registerSpecialist(boundaryInterfaceSpecialist);

// ── Network Reporter (founder-authorised addition) ─────────────────────
export const networkReporter = createSpecialistBrain({
  specialist_id: "network_reporter",
  domain: "network_aggregate_reporting",
  description: "Aggregate reports from all BRB specialists into a compact status summary. READ ONLY. Emits STATUS_SNAPSHOT with per-specialist heartbeat, capability, and recent-activity data. Runs after each successful NEX test to summarise what specialists changed.",
  capabilities: [
    { id: "status_snapshot", kind: "reporting", maturity: "DEVELOPING", description: "Snapshot of all specialists' heartbeats + capability maturity distribution + agent-registry health." },
    { id: "activity_delta", kind: "reporting", maturity: "PRIMITIVE", description: "Compute what changed between two snapshots (per-specialist experience/outcome counts)." },
    { id: "post_test_report", kind: "reporting", maturity: "DEVELOPING", description: "Emit a per-test summary suitable for the founder's Section 29 report." },
  ],
  cognitive_layer: "brain_recovery_specialist",
  safety_level: "READ_ONLY",
  onAnalyse: (input): Omit<Analysis, "specialist_id" | "timestamp"> => {
    const hbs = collectHeartbeats();
    const perSpec: Record<string, { status: string; capabilities: number; last_success: string | null; last_failure: string | null; experience_count: number; outcomes_count: number }> = {};
    for (const sid of listSpecialists()) {
      const b = getSpecialist(sid);
      if (!b) continue;
      const hb = hbs.find((h) => h.specialist_id === sid);
      perSpec[sid] = {
        status: hb?.status ?? "unknown",
        capabilities: b.capabilities().length,
        last_success: hb?.last_success ?? null,
        last_failure: hb?.last_failure ?? null,
        experience_count: b.readOwnStore("experience").length,
        outcomes_count: b.readOwnStore("outcomes").length,
      };
    }
    return {
      kind: "STATUS_SNAPSHOT",
      findings: {
        total_specialists: listSpecialists().length,
        per_specialist: perSpec,
        summary_generated_at: new Date().toISOString(),
      },
      confidence: 0.95,
      evidence_ids: [],
      evidence_kind: "OBSERVED",
    };
  },
});
registerSpecialist(networkReporter);

export const BRB_EXTENDED_SPECIALISTS_VERSION = "brb-extended-specialists.v1";
