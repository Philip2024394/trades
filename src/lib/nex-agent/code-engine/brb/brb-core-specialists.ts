// src/lib/nex-agent/code-engine/brb/brb-core-specialists.ts
//
// NEX1 · Brain Recovery Network · Phase 5 · Four core specialists.
//
// Each specialist uses createSpecialistBrain (isolated store namespace + heartbeat)
// and registers with the network router. Role-specific behavior lives in
// onAnalyse / onHypothesise / onRecommend hooks. All recommendations are
// PROPOSAL_ONLY; specialists never execute.
//
// The four core specialists (Section 28 · Phase 5):
//   · brain_surgeon           · controlled structural repair proposals
//   · neurologist             · failure diagnosis
//   · neuroscientist          · representation/learning/transfer study
//   · brain_transplantation   · verified capability transfer proposals

import { createSpecialistBrain, type Capability, type SpecialistContext, type Recommendation, type Hypothesis, type Analysis } from "./capability-specialist-brain";
import { registerSpecialist } from "./capability-brb-network-router";

// ── Brain Surgeon ─────────────────────────────────────────────────────

const brainSurgeonCapabilities: readonly Capability[] = [
  { id: "inspect_proposed_change", kind: "diagnostic", maturity: "DEVELOPING", description: "Inspect a proposed brain change · report scope and risk without executing." },
  { id: "construct_repair_plan", kind: "planning", maturity: "DEVELOPING", description: "Construct an ordered repair plan · before/after state · rollback ready." },
  { id: "prepare_rollback", kind: "safety", maturity: "PRIMITIVE", description: "Emit rollback metadata alongside every repair proposal." },
];

export const brainSurgeon = createSpecialistBrain({
  specialist_id: "brain_surgeon",
  domain: "controlled_structural_repair",
  description: "Inspect proposed brain changes · construct repair plans · maintain before/after state · isolate changes · prepare rollback · never bypass verification.",
  capabilities: brainSurgeonCapabilities,
  cognitive_layer: "brain_recovery_specialist",
  safety_level: "RECOMMEND_ONLY_NEVER_EXECUTE",
  onAnalyse: (input, ctx: SpecialistContext): Omit<Analysis, "specialist_id" | "timestamp"> => {
    const data = (input ?? {}) as { proposed_change?: { file?: string; before?: string; after?: string; reason?: string }; scope?: string };
    const pc = data.proposed_change ?? {};
    const hasBefore = typeof pc.before === "string" && pc.before.length > 0;
    const hasAfter = typeof pc.after === "string" && pc.after.length > 0;
    const diffLen = hasBefore && hasAfter ? Math.abs((pc.after ?? "").length - (pc.before ?? "").length) : null;
    const scope_class = data.scope === "production" ? "PRODUCTION_CHANGE" : "SANDBOX_CHANGE";
    return {
      kind: "surgical_change_inspection",
      findings: {
        file: pc.file ?? null,
        before_state_captured: hasBefore,
        after_state_captured: hasAfter,
        diff_size_chars: diffLen,
        scope_class,
        rollback_ready: hasBefore, // Can only rollback if the before-state was captured
      },
      confidence: hasBefore && hasAfter ? 0.7 : 0.3,
      evidence_ids: [],
      evidence_kind: "OBSERVED",
    };
  },
  onRecommend: (input, ctx): Omit<Recommendation, "specialist_id" | "timestamp" | "action_class" | "requires_approval"> => {
    const data = (input ?? {}) as { proposed_change?: { file?: string; before?: string; after?: string; reason?: string } };
    const pc = data.proposed_change ?? {};
    const canPropose = typeof pc.before === "string" && typeof pc.after === "string" && !!pc.file;
    return {
      kind: canPropose ? "REPAIR_PROPOSAL" : "insufficient_information_for_proposal",
      detail: {
        target_file: pc.file ?? null,
        rollback_metadata: canPropose ? { before_state: pc.before, kind: "revert_string_replace" } : null,
        reason: pc.reason ?? null,
        requires_verification: true,
        requires_approval: true,
      },
      evidence_ids: [],
    };
  },
});
registerSpecialist(brainSurgeon);

// ── Neurologist ───────────────────────────────────────────────────────

const neurologistCapabilities: readonly Capability[] = [
  { id: "failure_pattern_analysis", kind: "diagnostic", maturity: "DEVELOPING", description: "Group failed predictions by observation-cell to expose recurring patterns · does not name a missing feature." },
  { id: "failure_frequency_measurement", kind: "diagnostic", maturity: "DEVELOPING", description: "Measure failure rate across a supplied set of verdict records." },
  { id: "success_vs_failure_comparison", kind: "diagnostic", maturity: "DEVELOPING", description: "Partition verdict records by matched · describe structural differences." },
];

export const neurologist = createSpecialistBrain({
  specialist_id: "neurologist",
  domain: "failure_diagnosis",
  description: "Analyse repeated prediction failures · compare successful/unsuccessful outcomes · identify recurring failure patterns and frequency. Does NOT emit any missing-feature name.",
  capabilities: neurologistCapabilities,
  cognitive_layer: "brain_recovery_specialist",
  safety_level: "RECOMMEND_ONLY_NEVER_EXECUTE",
  onAnalyse: (input, ctx): Omit<Analysis, "specialist_id" | "timestamp"> => {
    const records = ((input ?? {}) as { verdict_records?: readonly { matched?: boolean | null; features?: Record<string, unknown> }[] }).verdict_records ?? [];
    let matched = 0, failed = 0, unknown = 0;
    const cellCounter = new Map<string, { m: number; f: number }>();
    for (const r of records) {
      const cellKey = JSON.stringify(r.features ?? {});
      const c = cellCounter.get(cellKey) ?? { m: 0, f: 0 };
      if (r.matched === true) { matched++; c.m++; }
      else if (r.matched === false) { failed++; c.f++; }
      else { unknown++; }
      cellCounter.set(cellKey, c);
    }
    const nonUniform = [...cellCounter.entries()].filter(([, v]) => v.m > 0 && v.f > 0);
    const failureFrequency = (matched + failed) > 0 ? failed / (matched + failed) : null;
    return {
      kind: nonUniform.length > 0 ? "recurring_failure_pattern_observed" : (failed > 0 ? "isolated_failures_observed" : "no_failures_observed"),
      findings: {
        total_records: records.length,
        matched, failed, unknown,
        failure_frequency: failureFrequency,
        cells_with_mixed_outcomes: nonUniform.length,
        // Note · we deliberately do NOT identify what feature is missing.
        // The evidence is exposed; the conclusion is not authored.
      },
      confidence: records.length >= 5 ? 0.75 : 0.4,
      evidence_ids: [],
      evidence_kind: "OBSERVED",
    };
  },
  onHypothesise: (input, ctx): readonly Omit<Hypothesis, "specialist_id" | "timestamp">[] => {
    const records = ((input ?? {}) as { verdict_records?: readonly { matched?: boolean | null; features?: Record<string, unknown> }[] }).verdict_records ?? [];
    const cellCounter = new Map<string, { m: number; f: number }>();
    for (const r of records) {
      const cellKey = JSON.stringify(r.features ?? {});
      const c = cellCounter.get(cellKey) ?? { m: 0, f: 0 };
      if (r.matched === true) c.m++;
      else if (r.matched === false) c.f++;
      cellCounter.set(cellKey, c);
    }
    const nonUniform = [...cellCounter.entries()].filter(([, v]) => v.m > 0 && v.f > 0);
    if (nonUniform.length === 0) return [];
    // Evidence-based statement — no missing-feature name.
    return [{
      kind: "same_observed_representation_different_outcomes",
      statement: "At least one observation-cell contains both matched and unmatched outcomes for the same feature-vector the brain saw at prediction time.",
      evidence_ids: [],
      confidence: 0.6,
    }];
  },
});
registerSpecialist(neurologist);

// ── Neuroscientist ────────────────────────────────────────────────────

const neuroscientistCapabilities: readonly Capability[] = [
  { id: "representation_analysis", kind: "study", maturity: "DEVELOPING", description: "Measure distinctness of observation-cells across a corpus." },
  { id: "learning_pattern_analysis", kind: "study", maturity: "DEVELOPING", description: "Detect whether accumulated experience is changing brain outputs on similar inputs." },
  { id: "generalisation_analysis", kind: "study", maturity: "DEVELOPING", description: "Report whether prediction accuracy improves or degrades as corpus grows." },
  { id: "transfer_analysis", kind: "study", maturity: "PRIMITIVE", description: "Compare a capability's behaviour across contexts." },
];

export const neuroscientist = createSpecialistBrain({
  specialist_id: "neuroscientist",
  domain: "brain_learning_and_generalisation_study",
  description: "Analyse how NEX1 brains represent, learn and generalise. Ask what changed, what stayed stable, whether new behaviour depends on accumulated experience, whether behaviour transfers.",
  capabilities: neuroscientistCapabilities,
  cognitive_layer: "brain_recovery_specialist",
  safety_level: "RECOMMEND_ONLY_NEVER_EXECUTE",
  onAnalyse: (input, ctx): Omit<Analysis, "specialist_id" | "timestamp"> => {
    const data = (input ?? {}) as { records?: readonly Record<string, unknown>[]; timespan_start?: string | null; timespan_end?: string | null };
    const records = data.records ?? [];
    const cellSet = new Set<string>();
    for (const r of records) cellSet.add(JSON.stringify((r as { features?: Record<string, unknown> }).features ?? {}));
    // Split records temporally in half; compare match rate across halves.
    const sorted = [...records].sort((a, b) => String((a as { timestamp?: unknown }).timestamp ?? "").localeCompare(String((b as { timestamp?: unknown }).timestamp ?? "")));
    const half = Math.floor(sorted.length / 2);
    const rateHalf = (arr: readonly Record<string, unknown>[]) => {
      const decided = arr.filter((r) => (r as { matched?: unknown }).matched !== null);
      const m = decided.filter((r) => (r as { matched?: unknown }).matched === true).length;
      return decided.length > 0 ? m / decided.length : null;
    };
    const earlyRate = rateHalf(sorted.slice(0, half));
    const lateRate = rateHalf(sorted.slice(half));
    const stability = earlyRate !== null && lateRate !== null ? Math.abs(lateRate - earlyRate) : null;
    return {
      kind: "representation_and_learning_summary",
      findings: {
        total_records: records.length,
        distinct_observation_cells: cellSet.size,
        early_match_rate: earlyRate,
        late_match_rate: lateRate,
        rate_delta_between_halves: stability,
      },
      confidence: records.length >= 10 ? 0.7 : 0.35,
      evidence_ids: [],
      evidence_kind: "OBSERVED",
    };
  },
});
registerSpecialist(neuroscientist);

// ── Brain Transplantation ──────────────────────────────────────────────

const brainTransplantationCapabilities: readonly Capability[] = [
  { id: "maturity_check", kind: "gate", maturity: "DEVELOPING", description: "Check whether a source capability is TRANSFER_READY." },
  { id: "provenance_check", kind: "gate", maturity: "DEVELOPING", description: "Check that the source capability has traceable provenance." },
  { id: "compatibility_check", kind: "gate", maturity: "PRIMITIVE", description: "Check whether the receiving brain can host the capability." },
  { id: "transplant_proposal", kind: "planning", maturity: "PRIMITIVE", description: "Emit a controlled-transfer proposal · never executes." },
];

export const brainTransplantation = createSpecialistBrain({
  specialist_id: "brain_transplantation",
  domain: "controlled_capability_transfer",
  description: "Verify maturity/provenance/compatibility · propose controlled transfer of a capability between brains · post-transfer verification required in the receiving brain.",
  capabilities: brainTransplantationCapabilities,
  cognitive_layer: "brain_recovery_specialist",
  safety_level: "RECOMMEND_ONLY_NEVER_EXECUTE",
  onAnalyse: (input, ctx): Omit<Analysis, "specialist_id" | "timestamp"> => {
    const data = (input ?? {}) as {
      source_brain_id?: string;
      target_brain_id?: string;
      capability?: { id?: string; maturity?: string; provenance?: unknown };
    };
    const cap = data.capability ?? {};
    const maturityOk = cap.maturity === "MATURE" || cap.maturity === "TRANSFER_READY";
    const provenanceOk = !!cap.provenance;
    const compatibility_placeholder = !!(data.source_brain_id && data.target_brain_id && data.source_brain_id !== data.target_brain_id);
    return {
      kind: "transplant_eligibility_check",
      findings: {
        source_brain_id: data.source_brain_id ?? null,
        target_brain_id: data.target_brain_id ?? null,
        capability_id: cap.id ?? null,
        maturity_ok: maturityOk,
        provenance_ok: provenanceOk,
        compatibility_ok: compatibility_placeholder,
        all_gates_ok: maturityOk && provenanceOk && compatibility_placeholder,
      },
      confidence: maturityOk && provenanceOk && compatibility_placeholder ? 0.75 : 0.35,
      evidence_ids: [],
      evidence_kind: "OBSERVED",
    };
  },
  onRecommend: (input, ctx): Omit<Recommendation, "specialist_id" | "timestamp" | "action_class" | "requires_approval"> => {
    const analysis = brainTransplantation.analyse(input);
    const gatesOk = (analysis.findings as { all_gates_ok?: boolean }).all_gates_ok === true;
    return {
      kind: gatesOk ? "TRANSPLANT_PROPOSAL" : "TRANSPLANT_BLOCKED_MISSING_GATES",
      detail: {
        gates: analysis.findings,
        recipe: gatesOk ? { step_1: "capture source capability provenance", step_2: "instantiate target brain container", step_3: "materialise capability in target", step_4: "run independent verification in target", step_5: "record outcome" } : null,
        requires_verification_in_receiving_brain: true,
        requires_approval: true,
      },
      evidence_ids: [],
    };
  },
});
registerSpecialist(brainTransplantation);

export const BRB_CORE_SPECIALISTS_VERSION = "brb-core-specialists.v1";
