// §36-I-1 · WAVE-I1 · 2026-09-14 · improvement-hypothesis-measurement
//
// Pure function · zero I/O. Converts S4 ImprovementProposals into structured
// testable hypotheses, and (when before + after S1 records are supplied)
// measures categorical capability change deterministically.
//
// Never implements improvements. Never invents causality. Categorical outcomes only.

import { createHash } from "node:crypto";
import type { EvidenceCollectionSuccess } from "../self-diagnostics/evidence-collector-types";
import type { ImprovementProposal, ImprovementProposalKind } from "../self-diagnostics/improvement-intelligence-types";
import {
  I1_MAX_OUTPUT_BYTES,
  I1_MAX_PROPOSALS,
  type HypothesisMeasurementRecord,
  type HypothesisOutcome,
  type ImprovementHypothesis,
  type ImprovementHypothesisMeasurementFailure,
  type ImprovementHypothesisMeasurementRefusalCode,
  type ImprovementHypothesisMeasurementRequest,
  type ImprovementHypothesisMeasurementResult,
  type ImprovementHypothesisMeasurementSuccess,
  type MeasurementRecord,
} from "./improvement-hypothesis-measurement-types";

// ── Helpers ────────────────────────────────────────────────────────────

function fail(
  code: ImprovementHypothesisMeasurementRefusalCode,
  reason: string,
  offendingField?: string,
): ImprovementHypothesisMeasurementFailure {
  return offendingField !== undefined
    ? { ok: false, refusal_code: code, reason, offending_field: offendingField }
    : { ok: false, refusal_code: code, reason };
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function validateS1(rec: EvidenceCollectionSuccess | undefined, code: ImprovementHypothesisMeasurementRefusalCode, label: string): ImprovementHypothesisMeasurementFailure | null {
  if (rec === undefined) return null;
  if (!rec || typeof rec !== "object" || (rec as { ok?: unknown }).ok !== true) {
    return fail(code, `${label}.ok must be true`);
  }
  if (typeof rec.evidence_sha256 !== "string" || !/^[0-9a-f]{64}$/.test(rec.evidence_sha256)) {
    return fail(code, `${label}.evidence_sha256 invalid`);
  }
  return null;
}

// ── Hypothesis derivation (deterministic table) ────────────────────────

interface HypothesisTemplate {
  readonly observed_weakness_summary: string;
  readonly proposed_intervention_summary: string;
  readonly expected_capability_change: ImprovementHypothesis["expected_capability_change"];
  readonly success_threshold: string;
  readonly failure_condition: string;
  readonly rollback_strategy: string;
}

const HYPOTHESIS_TEMPLATES: Readonly<Record<ImprovementProposalKind, HypothesisTemplate>> = Object.freeze({
  amend_locked_pattern: {
    observed_weakness_summary: "locked pattern does not match real-world evidence phrasing",
    proposed_intervention_summary: "AMEND WAVE X PLAN to broaden the locked pattern within its 6-item registry",
    expected_capability_change: "improve_evidence_visibility",
    success_threshold: "test_count_source_span_not_locatable gap_notes for the wave decrease by ≥1",
    failure_condition: "gap_note_count_delta for the wave is 0 or positive",
    rollback_strategy: "revert plan amendment · restore locked pattern to prior form",
  },
  add_missing_marker: {
    observed_weakness_summary: "wave grep marker absent from expected authorised paths",
    proposed_intervention_summary: "add the wave grep marker string to the affected files",
    expected_capability_change: "improve_evidence_visibility",
    success_threshold: "grep_marker_missing_in_expected_path gap_notes for the wave decrease by ≥1",
    failure_condition: "grep marker still absent after change",
    rollback_strategy: "remove the added marker lines · files restored to prior state",
  },
  author_missing_acceptance_report: {
    observed_weakness_summary: "capability_inventory cites a path but the acceptance report is absent",
    proposed_intervention_summary: "author the missing acceptance report at the registry-declared path with `**Verdict:** PASS` phrasing",
    expected_capability_change: "improve_evidence_visibility",
    success_threshold: "acceptance_report_referenced_but_missing gap_note for the wave clears",
    failure_condition: "gap_note persists after new file authored",
    rollback_strategy: "delete the newly authored acceptance report · registry state restored",
  },
  resolve_baseline_conflict: {
    observed_weakness_summary: "multiple rollback-proof files declare conflicting SHAs for the same protected path",
    proposed_intervention_summary: "identify authoritative baseline and record superseded declarations as historical (out of scope · founder authority)",
    expected_capability_change: "reduce_gap_notes",
    success_threshold: "capability_promotion_status_ambiguous gap_note for that path clears",
    failure_condition: "conflict persists · no clear authoritative baseline determinable",
    rollback_strategy: "revert any baseline hash file to previous state",
  },
  capture_governance_evidence: {
    observed_weakness_summary: "§36 amendment cessation state cannot be derived from any acceptance report",
    proposed_intervention_summary: "ensure a corresponding acceptance report contains the wave grep marker AND locked VERDICT_PASS pattern",
    expected_capability_change: "reduce_gap_notes",
    success_threshold: "governance_amendment_state_unknown gap_note for the amendment clears",
    failure_condition: "no acceptance report matches after change",
    rollback_strategy: "revert acceptance-report edits to prior state",
  },
  advance_plan_to_execution: {
    observed_weakness_summary: "capability is plan_only · no execution has occurred",
    proposed_intervention_summary: "founder-authorised execution of the underlying plan (out of scope · requires distinct bare-token)",
    expected_capability_change: "advance_capability_promotion",
    success_threshold: "capability's promotion_status advances beyond plan_only in a future S1 record",
    failure_condition: "capability remains plan_only",
    rollback_strategy: "requires founder authority · not automatic",
  },
  collect_missing_evidence: {
    observed_weakness_summary: "required evidence source is absent",
    proposed_intervention_summary: "collect the missing evidence at the registry-declared path",
    expected_capability_change: "improve_evidence_visibility",
    success_threshold: "corresponding gap_note clears in a future S1 record",
    failure_condition: "gap_note persists after collection attempt",
    rollback_strategy: "no artefact was produced · nothing to roll back",
  },
});

function buildHypothesis(p: ImprovementProposal, index: number): ImprovementHypothesis {
  const tmpl = HYPOTHESIS_TEMPLATES[p.proposal_kind];
  return {
    hypothesis_id: `H-${index.toString().padStart(3, "0")}-${p.wave_slug}-${p.proposal_kind}`,
    derived_from_proposal_kind: p.proposal_kind,
    wave_slug: p.wave_slug,
    observed_weakness_summary: tmpl.observed_weakness_summary,
    evidence_citation: p.evidence_citations.length > 0 ? p.evidence_citations[0] : `s4.proposal[${p.wave_slug}, ${p.proposal_kind}]`,
    proposed_intervention_summary: tmpl.proposed_intervention_summary,
    expected_capability_change: tmpl.expected_capability_change,
    success_threshold: tmpl.success_threshold,
    failure_condition: tmpl.failure_condition,
    rollback_strategy: tmpl.rollback_strategy,
  };
}

// ── Measurement derivation ─────────────────────────────────────────────

function countGapNotesForWave(rec: EvidenceCollectionSuccess | null, waveSlug: string): number {
  if (!rec) return 0;
  return rec.gap_notes.filter((g) => g.wave_slug === waveSlug).length;
}

function countTotalGapNotes(rec: EvidenceCollectionSuccess | null): number {
  return rec ? rec.gap_notes.length : 0;
}

function countVerifiedDimensions(rec: EvidenceCollectionSuccess | null, waveSlug: string): number {
  // Proxy: number of baseline_sha_verification entries with match=true where the path is
  // associated with the wave's rollback proof. This is a rough approximation of "verified dimensions".
  if (!rec) return 0;
  // Count how many baseline entries are match=true (repo-wide since we can't easily filter by wave)
  return rec.baseline_sha_verification.filter((v) => v.match).length;
}

function categoricalDirection(delta: number, expectImprovement: boolean): MeasurementRecord["categorical_direction"] {
  if (delta === 0) return "unchanged";
  if (expectImprovement) {
    return delta < 0 ? "improved" : "regressed";
  }
  return delta > 0 ? "improved" : "regressed";
}

function measureHypothesis(
  hyp: ImprovementHypothesis,
  before: EvidenceCollectionSuccess | null,
  after: EvidenceCollectionSuccess | null,
): HypothesisMeasurementRecord {
  if (before === null || after === null) {
    return {
      hypothesis_id: hyp.hypothesis_id,
      outcome: "untested",
      measurement_records: [],
      outcome_reason_summary: "before or after S1 record not supplied · no measurement possible",
    };
  }
  const records: MeasurementRecord[] = [];

  // Dimension 1: gap_note_count_delta (wave-scoped)
  const gnBefore = countGapNotesForWave(before, hyp.wave_slug);
  const gnAfter = countGapNotesForWave(after, hyp.wave_slug);
  const gnDelta = gnAfter - gnBefore;
  records.push({
    dimension: "gap_note_count_delta",
    before_value: gnBefore,
    after_value: gnAfter,
    delta: gnDelta,
    categorical_direction: categoricalDirection(gnDelta, /*expectImprovement*/ true),
    evidence_summary: `gap notes for wave '${hyp.wave_slug}': ${gnBefore} → ${gnAfter}`,
  });

  // Dimension 2: failure_class_count_delta (total gap notes as proxy)
  const fcBefore = countTotalGapNotes(before);
  const fcAfter = countTotalGapNotes(after);
  const fcDelta = fcAfter - fcBefore;
  records.push({
    dimension: "failure_class_count_delta",
    before_value: fcBefore,
    after_value: fcAfter,
    delta: fcDelta,
    categorical_direction: categoricalDirection(fcDelta, /*expectImprovement*/ true),
    evidence_summary: `total gap notes: ${fcBefore} → ${fcAfter}`,
  });

  // Dimension 3: verified_dimension_count_delta
  const vdBefore = countVerifiedDimensions(before, hyp.wave_slug);
  const vdAfter = countVerifiedDimensions(after, hyp.wave_slug);
  const vdDelta = vdAfter - vdBefore;
  records.push({
    dimension: "verified_dimension_count_delta",
    before_value: vdBefore,
    after_value: vdAfter,
    delta: vdDelta,
    categorical_direction: categoricalDirection(vdDelta, /*expectImprovement*/ false),  // more verified is better
    evidence_summary: `verified baseline entries: ${vdBefore} → ${vdAfter}`,
  });

  // Dimension 4: improvement_proposal_count_delta (n/a in this primitive · placeholder)
  records.push({
    dimension: "improvement_proposal_count_delta",
    before_value: null,
    after_value: null,
    delta: null,
    categorical_direction: "not_measurable",
    evidence_summary: `this dimension requires an S4 record from before + after · not supplied at this layer`,
  });

  // Dimension 5: evidence_sha_stability (categorical only · stable if before !== after)
  records.push({
    dimension: "evidence_sha_stability",
    before_value: null,
    after_value: null,
    delta: null,
    categorical_direction: before.evidence_sha256 !== after.evidence_sha256 ? "improved" : "unchanged",
    evidence_summary: `evidence_sha256 ${before.evidence_sha256 !== after.evidence_sha256 ? "changed" : "unchanged"} between before and after`,
  });

  // Determine outcome from primary dimension (gap_note_count_delta)
  let outcome: HypothesisOutcome;
  let outcomeReason: string;
  if (gnDelta < 0) {
    outcome = "improvement_measured";
    outcomeReason = `wave gap_note count decreased by ${-gnDelta}`;
  } else if (gnDelta > 0) {
    outcome = "regression_measured";
    outcomeReason = `wave gap_note count INCREASED by ${gnDelta} · potential regression`;
  } else if (gnBefore === 0 && gnAfter === 0) {
    outcome = "evidence_insufficient";
    outcomeReason = `no gap notes exist for wave '${hyp.wave_slug}' in either record · hypothesis untestable at this dimension`;
  } else {
    outcome = "no_change_measured";
    outcomeReason = `wave gap_note count unchanged`;
  }

  return {
    hypothesis_id: hyp.hypothesis_id,
    outcome,
    measurement_records: Object.freeze(records),
    outcome_reason_summary: outcomeReason,
  };
}

// ── Main entry point ───────────────────────────────────────────────────

export function deriveHypothesesAndMeasure(request: ImprovementHypothesisMeasurementRequest): ImprovementHypothesisMeasurementResult {
  if (!request || typeof request !== "object") return fail("I1_INVALID_REQUEST", "request must be an object");
  if (!Array.isArray(request.s4_proposals)) return fail("I1_INVALID_PROPOSAL", "s4_proposals must be an array");
  if (request.s4_proposals.length > I1_MAX_PROPOSALS) {
    return fail("I1_INVALID_PROPOSAL", `s4_proposals length ${request.s4_proposals.length} > ${I1_MAX_PROPOSALS}`);
  }
  const beforeCheck = validateS1(request.s1_before, "I1_INVALID_S1_BEFORE", "s1_before");
  if (beforeCheck) return beforeCheck;
  const afterCheck = validateS1(request.s1_after, "I1_INVALID_S1_AFTER", "s1_after");
  if (afterCheck) return afterCheck;
  if (request.s1_before && request.s1_after && request.s1_before.evidence_sha256 === request.s1_after.evidence_sha256) {
    return fail("I1_S1_RECORDS_IDENTICAL", "s1_before and s1_after have identical evidence_sha256 · no measurement possible");
  }

  const clock = request.clock ?? (() => new Date());
  const now = clock();

  // Build hypotheses (sorted by wave_slug + proposal_kind for determinism)
  const sortedProposals = [...request.s4_proposals].sort((a, b) => {
    if (a.wave_slug !== b.wave_slug) return a.wave_slug < b.wave_slug ? -1 : 1;
    return a.proposal_kind < b.proposal_kind ? -1 : a.proposal_kind > b.proposal_kind ? 1 : 0;
  });
  const hypotheses: ImprovementHypothesis[] = sortedProposals.map((p, i) => buildHypothesis(p, i + 1));

  // Measure each hypothesis
  const measurements: HypothesisMeasurementRecord[] = hypotheses.map((h) => measureHypothesis(h, request.s1_before ?? null, request.s1_after ?? null));

  const canonical = JSON.stringify({
    s1_before_sha256_verified: request.s1_before?.evidence_sha256 ?? null,
    s1_after_sha256_verified: request.s1_after?.evidence_sha256 ?? null,
    hypotheses,
    measurements,
  });
  const hmSha = sha256Hex(canonical);

  const success: ImprovementHypothesisMeasurementSuccess = {
    ok: true,
    assessed_at: now.toISOString(),
    s1_before_sha256_verified: request.s1_before?.evidence_sha256 ?? null,
    s1_after_sha256_verified: request.s1_after?.evidence_sha256 ?? null,
    hypotheses: Object.freeze(hypotheses),
    measurements: Object.freeze(measurements),
    hypothesis_measurement_sha256: hmSha,
  };

  const size = Buffer.byteLength(canonical, "utf8") + hmSha.length + 128;
  if (size > I1_MAX_OUTPUT_BYTES) {
    return fail("I1_OUTPUT_TOO_LARGE", `assembled output ${size} bytes > ${I1_MAX_OUTPUT_BYTES}`);
  }

  return success;
}

export type {
  HypothesisMeasurementRecord,
  HypothesisOutcome,
  ImprovementHypothesis,
  ImprovementHypothesisMeasurementFailure,
  ImprovementHypothesisMeasurementRefusalCode,
  ImprovementHypothesisMeasurementRequest,
  ImprovementHypothesisMeasurementResult,
  ImprovementHypothesisMeasurementSuccess,
  MeasurementDimension,
  MeasurementRecord,
} from "./improvement-hypothesis-measurement-types";
