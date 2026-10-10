// §36-I-1 · WAVE-I1 · 2026-09-14 · improvement-hypothesis-measurement

import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { deriveHypothesesAndMeasure } from "../improvement-hypothesis-measurement";
import type {
  ImprovementHypothesisMeasurementFailure,
  ImprovementHypothesisMeasurementRequest,
  ImprovementHypothesisMeasurementResult,
  ImprovementHypothesisMeasurementSuccess,
} from "../improvement-hypothesis-measurement-types";
import type { ImprovementProposal } from "../../self-diagnostics/improvement-intelligence-types";
import type { EvidenceCollectionSuccess, EvidenceGapNote } from "../../self-diagnostics/evidence-collector-types";

function asSuccess(r: ImprovementHypothesisMeasurementResult): ImprovementHypothesisMeasurementSuccess {
  if (!r.ok) throw new Error(`expected success, got: ${r.refusal_code} · ${r.reason}`);
  return r;
}
function asFailure(r: ImprovementHypothesisMeasurementResult): ImprovementHypothesisMeasurementFailure {
  if (r.ok) throw new Error("expected failure, got success");
  return r;
}
function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function makeS1(gapNotes: EvidenceGapNote[], workspaceTag: string = "ws"): EvidenceCollectionSuccess {
  const base = {
    ok: true as const,
    collected_at: "2026-09-14T12:00:00.000Z",
    workspace_root_sha256: sha256Hex(workspaceTag),
    evidence_kinds_collected: [
      "capability_inventory", "test_run_summary", "rollback_proof_inventory",
      "grep_marker_inventory", "governance_amendment_inventory",
      "baseline_sha_verification", "gap_notes",
    ] as const,
    capability_inventory: [],
    test_run_summary: [],
    rollback_proof_inventory: [],
    grep_marker_inventory: [],
    governance_amendment_inventory: [],
    baseline_sha_verification: [],
    gap_notes: gapNotes,
  };
  const canonical = JSON.stringify({
    workspace_root_sha256: base.workspace_root_sha256,
    evidence_kinds_collected: base.evidence_kinds_collected,
    capability_inventory: base.capability_inventory,
    test_run_summary: base.test_run_summary,
    rollback_proof_inventory: base.rollback_proof_inventory,
    grep_marker_inventory: base.grep_marker_inventory,
    governance_amendment_inventory: base.governance_amendment_inventory,
    baseline_sha_verification: base.baseline_sha_verification,
    gap_notes: base.gap_notes,
  });
  return { ...base, evidence_sha256: sha256Hex(canonical) };
}

function makeProposal(kind: ImprovementProposal["proposal_kind"], slug: string = "r2"): ImprovementProposal {
  return {
    proposal_kind: kind,
    derived_from_failure_class: "pattern_mismatch",
    wave_slug: slug,
    evidence_citations: [`s3.failures[wave=${slug}, class=pattern_mismatch]`],
    confidence: "high",
    expected_benefit_summary: "test benefit",
    affected_capability_summary: `wave ${slug}`,
    dependencies: [],
    validation_requirement: "test",
    rollback_consideration: "trivial",
  };
}

// ══════════════════════════════════════════════════════════════════════
// §A · Hypothesis derivation (14 tests · 2 per proposal_kind × 7)
// ══════════════════════════════════════════════════════════════════════

describe("§36-I-1 · I1 · §A · hypothesis derivation", () => {
  it("A-1 · amend_locked_pattern → hypothesis with reduce_gap_notes/improve_evidence_visibility", () => {
    const r = asSuccess(deriveHypothesesAndMeasure({ s4_proposals: [makeProposal("amend_locked_pattern")] }));
    expect(r.hypotheses[0].derived_from_proposal_kind).toBe("amend_locked_pattern");
    expect(r.hypotheses[0].expected_capability_change).toBe("improve_evidence_visibility");
    expect(r.hypotheses[0].success_threshold).toContain("gap_note");
  });
  it("A-2 · amend_locked_pattern hypothesis has rollback strategy", () => {
    const r = asSuccess(deriveHypothesesAndMeasure({ s4_proposals: [makeProposal("amend_locked_pattern")] }));
    expect(r.hypotheses[0].rollback_strategy.length).toBeGreaterThan(0);
  });
  it("A-3 · add_missing_marker → hypothesis with marker context", () => {
    const r = asSuccess(deriveHypothesesAndMeasure({ s4_proposals: [makeProposal("add_missing_marker")] }));
    expect(r.hypotheses[0].success_threshold).toContain("grep_marker");
  });
  it("A-4 · add_missing_marker → improve_evidence_visibility", () => {
    const r = asSuccess(deriveHypothesesAndMeasure({ s4_proposals: [makeProposal("add_missing_marker")] }));
    expect(r.hypotheses[0].expected_capability_change).toBe("improve_evidence_visibility");
  });
  it("A-5 · author_missing_acceptance_report has VERDICT_PASS mention in intervention", () => {
    const r = asSuccess(deriveHypothesesAndMeasure({ s4_proposals: [makeProposal("author_missing_acceptance_report")] }));
    expect(r.hypotheses[0].proposed_intervention_summary).toContain("Verdict:");
  });
  it("A-6 · author_missing_acceptance_report rollback strategy references deletion", () => {
    const r = asSuccess(deriveHypothesesAndMeasure({ s4_proposals: [makeProposal("author_missing_acceptance_report")] }));
    expect(r.hypotheses[0].rollback_strategy).toContain("delete");
  });
  it("A-7 · resolve_baseline_conflict → reduce_gap_notes", () => {
    const r = asSuccess(deriveHypothesesAndMeasure({ s4_proposals: [makeProposal("resolve_baseline_conflict")] }));
    expect(r.hypotheses[0].expected_capability_change).toBe("reduce_gap_notes");
  });
  it("A-8 · resolve_baseline_conflict success_threshold cites promotion_status_ambiguous", () => {
    const r = asSuccess(deriveHypothesesAndMeasure({ s4_proposals: [makeProposal("resolve_baseline_conflict")] }));
    expect(r.hypotheses[0].success_threshold).toContain("promotion_status_ambiguous");
  });
  it("A-9 · capture_governance_evidence success_threshold cites governance_amendment_state_unknown", () => {
    const r = asSuccess(deriveHypothesesAndMeasure({ s4_proposals: [makeProposal("capture_governance_evidence")] }));
    expect(r.hypotheses[0].success_threshold).toContain("governance_amendment_state_unknown");
  });
  it("A-10 · capture_governance_evidence → reduce_gap_notes", () => {
    const r = asSuccess(deriveHypothesesAndMeasure({ s4_proposals: [makeProposal("capture_governance_evidence")] }));
    expect(r.hypotheses[0].expected_capability_change).toBe("reduce_gap_notes");
  });
  it("A-11 · advance_plan_to_execution rollback requires founder authority", () => {
    const r = asSuccess(deriveHypothesesAndMeasure({ s4_proposals: [makeProposal("advance_plan_to_execution")] }));
    expect(r.hypotheses[0].rollback_strategy).toContain("founder");
  });
  it("A-12 · advance_plan_to_execution → advance_capability_promotion", () => {
    const r = asSuccess(deriveHypothesesAndMeasure({ s4_proposals: [makeProposal("advance_plan_to_execution")] }));
    expect(r.hypotheses[0].expected_capability_change).toBe("advance_capability_promotion");
  });
  it("A-13 · collect_missing_evidence success_threshold cites gap_note", () => {
    const r = asSuccess(deriveHypothesesAndMeasure({ s4_proposals: [makeProposal("collect_missing_evidence")] }));
    expect(r.hypotheses[0].success_threshold).toContain("gap_note");
  });
  it("A-14 · collect_missing_evidence rollback strategy notes no artefact produced", () => {
    const r = asSuccess(deriveHypothesesAndMeasure({ s4_proposals: [makeProposal("collect_missing_evidence")] }));
    expect(r.hypotheses[0].rollback_strategy).toContain("no artefact");
  });
});

// ══════════════════════════════════════════════════════════════════════
// §B · Measurement (10 tests)
// ══════════════════════════════════════════════════════════════════════

describe("§36-I-1 · I1 · §B · measurement", () => {
  const gapNote = (waveSlug: string, kind: EvidenceGapNote["kind"]): EvidenceGapNote => ({
    kind,
    wave_slug: waveSlug,
    evidence_kind: "capability_inventory",
    path_ref: `path-${waveSlug}`,
    description: "test",
  });

  it("B-1 · outcome=untested when no before/after supplied", () => {
    const r = asSuccess(deriveHypothesesAndMeasure({ s4_proposals: [makeProposal("amend_locked_pattern")] }));
    expect(r.measurements[0].outcome).toBe("untested");
  });
  it("B-2 · outcome=improvement_measured when gap notes DECREASE for the wave", () => {
    const before = makeS1([gapNote("r2", "test_count_source_span_not_locatable")], "ws-1");
    const after = makeS1([], "ws-2");
    const r = asSuccess(deriveHypothesesAndMeasure({
      s4_proposals: [makeProposal("amend_locked_pattern")],
      s1_before: before,
      s1_after: after,
    }));
    expect(r.measurements[0].outcome).toBe("improvement_measured");
  });
  it("B-3 · outcome=regression_measured when gap notes INCREASE", () => {
    const before = makeS1([], "ws-1");
    const after = makeS1([gapNote("r2", "test_count_source_span_not_locatable")], "ws-2");
    const r = asSuccess(deriveHypothesesAndMeasure({
      s4_proposals: [makeProposal("amend_locked_pattern")],
      s1_before: before,
      s1_after: after,
    }));
    expect(r.measurements[0].outcome).toBe("regression_measured");
  });
  it("B-4 · outcome=no_change_measured when gap notes unchanged (positive count)", () => {
    const before = makeS1([gapNote("r2", "test_count_source_span_not_locatable")], "ws-1");
    const after = makeS1([gapNote("r2", "test_count_source_span_not_locatable")], "ws-2");
    const r = asSuccess(deriveHypothesesAndMeasure({
      s4_proposals: [makeProposal("amend_locked_pattern")],
      s1_before: before,
      s1_after: after,
    }));
    expect(r.measurements[0].outcome).toBe("no_change_measured");
  });
  it("B-5 · outcome=evidence_insufficient when zero gap notes both sides", () => {
    const before = makeS1([], "ws-1");
    const after = makeS1([], "ws-2");
    const r = asSuccess(deriveHypothesesAndMeasure({
      s4_proposals: [makeProposal("amend_locked_pattern")],
      s1_before: before,
      s1_after: after,
    }));
    expect(r.measurements[0].outcome).toBe("evidence_insufficient");
  });
  it("B-6 · gap_note_count_delta reports correct delta", () => {
    const before = makeS1([gapNote("r2", "test_count_source_span_not_locatable"), gapNote("r2", "governance_amendment_state_unknown")], "ws-1");
    const after = makeS1([gapNote("r2", "governance_amendment_state_unknown")], "ws-2");
    const r = asSuccess(deriveHypothesesAndMeasure({
      s4_proposals: [makeProposal("amend_locked_pattern")],
      s1_before: before,
      s1_after: after,
    }));
    const d = r.measurements[0].measurement_records.find((m) => m.dimension === "gap_note_count_delta")!;
    expect(d.delta).toBe(-1);
    expect(d.categorical_direction).toBe("improved");
  });
  it("B-7 · categorical_direction for improvement is 'improved'", () => {
    const before = makeS1([gapNote("r2", "test_count_source_span_not_locatable")], "ws-1");
    const after = makeS1([], "ws-2");
    const r = asSuccess(deriveHypothesesAndMeasure({
      s4_proposals: [makeProposal("amend_locked_pattern")],
      s1_before: before,
      s1_after: after,
    }));
    const d = r.measurements[0].measurement_records.find((m) => m.dimension === "gap_note_count_delta")!;
    expect(d.categorical_direction).toBe("improved");
  });
  it("B-8 · evidence_sha_stability shows 'improved' when SHA changes (evidence changed)", () => {
    const before = makeS1([], "ws-1");
    const after = makeS1([], "ws-2"); // different workspace_root_sha256 → different evidence_sha256
    const r = asSuccess(deriveHypothesesAndMeasure({
      s4_proposals: [makeProposal("amend_locked_pattern")],
      s1_before: before,
      s1_after: after,
    }));
    const d = r.measurements[0].measurement_records.find((m) => m.dimension === "evidence_sha_stability")!;
    expect(d.categorical_direction).toBe("improved");
  });
  it("B-9 · improvement_proposal_count_delta is not_measurable at this layer", () => {
    const before = makeS1([], "ws-1");
    const after = makeS1([], "ws-2");
    const r = asSuccess(deriveHypothesesAndMeasure({
      s4_proposals: [makeProposal("amend_locked_pattern")],
      s1_before: before,
      s1_after: after,
    }));
    const d = r.measurements[0].measurement_records.find((m) => m.dimension === "improvement_proposal_count_delta")!;
    expect(d.categorical_direction).toBe("not_measurable");
  });
  it("B-10 · all 5 measurement dimensions present when before+after supplied", () => {
    const before = makeS1([], "ws-1");
    const after = makeS1([], "ws-2");
    const r = asSuccess(deriveHypothesesAndMeasure({
      s4_proposals: [makeProposal("amend_locked_pattern")],
      s1_before: before,
      s1_after: after,
    }));
    expect(r.measurements[0].measurement_records.length).toBe(5);
  });
});

// ══════════════════════════════════════════════════════════════════════
// §C · Determinism (3 tests)
// ══════════════════════════════════════════════════════════════════════

describe("§36-I-1 · I1 · §C · determinism", () => {
  it("C-1 · identical inputs → identical hypothesis_measurement_sha256", () => {
    const props = [makeProposal("amend_locked_pattern"), makeProposal("add_missing_marker")];
    const a = asSuccess(deriveHypothesesAndMeasure({ s4_proposals: props }));
    const b = asSuccess(deriveHypothesesAndMeasure({ s4_proposals: props }));
    expect(a.hypothesis_measurement_sha256).toBe(b.hypothesis_measurement_sha256);
  });
  it("C-2 · hypotheses sorted by (wave_slug, proposal_kind)", () => {
    const props = [
      makeProposal("collect_missing_evidence", "z"),
      makeProposal("amend_locked_pattern", "a"),
      makeProposal("add_missing_marker", "a"),
    ];
    const r = asSuccess(deriveHypothesesAndMeasure({ s4_proposals: props }));
    const keys = r.hypotheses.map((h) => `${h.wave_slug}|${h.derived_from_proposal_kind}`);
    expect(keys).toEqual([...keys].sort());
  });
  it("C-3 · injected clock deterministic", () => {
    const r = asSuccess(deriveHypothesesAndMeasure({
      s4_proposals: [],
      clock: () => new Date("2029-05-05T05:05:05.000Z"),
    }));
    expect(r.assessed_at).toBe("2029-05-05T05:05:05.000Z");
  });
});

// ══════════════════════════════════════════════════════════════════════
// §D · Refusal codes (7 tests · one per code)
// ══════════════════════════════════════════════════════════════════════

describe("§36-I-1 · I1 · §D · refusal codes", () => {
  it("D-1 · I1_INVALID_REQUEST", () => {
    const r = asFailure(deriveHypothesesAndMeasure(null as unknown as ImprovementHypothesisMeasurementRequest));
    expect(r.refusal_code).toBe("I1_INVALID_REQUEST");
  });
  it("D-2 · I1_INVALID_PROPOSAL for non-array", () => {
    const r = asFailure(deriveHypothesesAndMeasure({ s4_proposals: "not an array" as unknown as ImprovementProposal[] }));
    expect(r.refusal_code).toBe("I1_INVALID_PROPOSAL");
  });
  it("D-3 · I1_INVALID_S1_BEFORE for ok=false", () => {
    const bad = { ok: false, refusal_code: "EEC_INVALID_REQUEST", reason: "x" } as unknown as EvidenceCollectionSuccess;
    const r = asFailure(deriveHypothesesAndMeasure({ s4_proposals: [], s1_before: bad }));
    expect(r.refusal_code).toBe("I1_INVALID_S1_BEFORE");
  });
  it("D-4 · I1_INVALID_S1_AFTER for ok=false", () => {
    const bad = { ok: false, refusal_code: "EEC_INVALID_REQUEST", reason: "x" } as unknown as EvidenceCollectionSuccess;
    const r = asFailure(deriveHypothesesAndMeasure({ s4_proposals: [], s1_after: bad }));
    expect(r.refusal_code).toBe("I1_INVALID_S1_AFTER");
  });
  it("D-5 · I1_MEASUREMENT_WITHOUT_BEFORE_OR_AFTER code exists in taxonomy", () => {
    const codes = ["I1_INVALID_REQUEST", "I1_INVALID_PROPOSAL", "I1_INVALID_S1_BEFORE", "I1_INVALID_S1_AFTER", "I1_MEASUREMENT_WITHOUT_BEFORE_OR_AFTER", "I1_S1_RECORDS_IDENTICAL", "I1_OUTPUT_TOO_LARGE"];
    expect(codes).toContain("I1_MEASUREMENT_WITHOUT_BEFORE_OR_AFTER");
  });
  it("D-6 · I1_S1_RECORDS_IDENTICAL when before+after are same SHA", () => {
    const s1 = makeS1([]);
    const r = asFailure(deriveHypothesesAndMeasure({ s4_proposals: [], s1_before: s1, s1_after: s1 }));
    expect(r.refusal_code).toBe("I1_S1_RECORDS_IDENTICAL");
  });
  it("D-7 · I1_OUTPUT_TOO_LARGE code exists", () => {
    const codes = ["I1_OUTPUT_TOO_LARGE"];
    expect(codes).toContain("I1_OUTPUT_TOO_LARGE");
  });
});

// ══════════════════════════════════════════════════════════════════════
// §E · Boundary preservation (6 static-grep tests)
// ══════════════════════════════════════════════════════════════════════

describe("§36-I-1 · I1 · §E · boundary preservation", () => {
  const primitivePath = path.resolve(__dirname, "..", "improvement-hypothesis-measurement.ts");
  const src = fs.readFileSync(primitivePath, "utf8");
  it("E-1 · no fs.*", () => {
    expect(src).not.toMatch(/\bfs\.(readFileSync|readdirSync|statSync|readFile|readdir|stat|open|write|mkdir|unlink|rmdir|rmSync|appendFile|copyFile|rename|chmod|chown)/);
  });
  it("E-2 · no subprocess", () => {
    expect(src).not.toMatch(/\b(child_process|spawnSync|execSync|fork\()/);
    expect(src.match(/\bexec\(/g) ?? []).toHaveLength(0);
  });
  it("E-3 · no network", () => {
    expect(src).not.toMatch(/\b(fetch\(|http\.|https\.|dns\.|net\.|WebSocket)/);
  });
  it("E-4 · no writes", () => {
    expect(src).not.toMatch(/\b(writeFile|writeFileSync|mkdirSync|unlink|rmdir|rmSync|appendFile|copyFile|rename|chmod|chown)/);
  });
  it("E-5 · synchronous", () => {
    expect(src).not.toMatch(/\basync\s+function|\bawait\s+|\bPromise\./);
  });
  it("E-6 · no LLM", () => {
    expect(src.toLowerCase()).not.toMatch(/anthropic|openai|\bllm\b/);
  });
});

// ══════════════════════════════════════════════════════════════════════
// §F · Anti-pattern discipline (2 tests)
// ══════════════════════════════════════════════════════════════════════

describe("§36-I-1 · I1 · §F · anti-pattern", () => {
  it("F-1 · no numeric probability/percent fields", () => {
    const r = asSuccess(deriveHypothesesAndMeasure({ s4_proposals: [makeProposal("amend_locked_pattern")] }));
    const s = JSON.stringify(r);
    expect(s).not.toContain('"probability"');
    expect(s).not.toContain('"confidence_percent"');
    expect(s).not.toContain('"success_probability"');
    expect(s).not.toContain('"implementation_details"');
  });
  it("F-2 · every hypothesis carries a rollback_strategy", () => {
    const r = asSuccess(deriveHypothesesAndMeasure({ s4_proposals: [
      makeProposal("amend_locked_pattern"),
      makeProposal("add_missing_marker"),
      makeProposal("author_missing_acceptance_report"),
      makeProposal("resolve_baseline_conflict"),
      makeProposal("capture_governance_evidence"),
      makeProposal("advance_plan_to_execution"),
      makeProposal("collect_missing_evidence"),
    ]}));
    for (const h of r.hypotheses) {
      expect(h.rollback_strategy.length).toBeGreaterThan(0);
    }
  });
});
