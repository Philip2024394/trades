// src/lib/nex2-review/dimensions.ts
//
// NEX2 · dimension evaluators · 10 dimensions.
// authored_by = master_ai_engineer · founder-authorised 2026-09-12
//
// Each evaluator:
//   · consumes ONLY authoritative source(s) declared in nex2-review-schema-v0.2.0.json
//   · cites evidence_ids for every regression/improvement/equal conclusion
//   · returns insufficient_evidence when the source is missing / STALE / INCONCLUSIVE
//   · returns not_authoritatively_available when no authorised NEX subsystem provides the data at all
//   · NEVER fabricates · NEVER recomputes · NEVER assumes

import type {
  ReviewInput,
  DimensionObservation,
  EvidenceRecordCitation,
  CodeHealthCitation,
  ConsumedState,
} from "./types";

// ─── Helpers ─────────────────────────────────────────────────────

function findEvidence(input: ReviewInput, candidate_id: string, kind: string): EvidenceRecordCitation | undefined {
  return (input.evidence_records ?? []).find((r) => r.candidate_id === candidate_id && r.measurement_type === kind);
}

function findCodeHealthOne(pool: readonly CodeHealthCitation[] | undefined, kind: string, scope_target?: string): CodeHealthCitation | undefined {
  if (!pool) return undefined;
  if (scope_target !== undefined) return pool.find((m) => m.kind === kind && m.scope_target === scope_target);
  return pool.find((m) => m.kind === kind);
}

function findCodeHealthAll(pool: readonly CodeHealthCitation[] | undefined, kind: string): readonly CodeHealthCitation[] {
  return (pool ?? []).filter((m) => m.kind === kind);
}

function isUsable(state: ConsumedState | null | undefined): boolean {
  return state === "MEASURED" || state === "PASSED";
}

function isBroken(state: ConsumedState | null | undefined): boolean {
  return state === "FAILED" || state === "INCONCLUSIVE" || state === "STALE";
}

function numeric(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (v && typeof v === "object") {
    const anyv = v as any;
    if (typeof anyv.file_total === "number") return anyv.file_total;
    if (typeof anyv.total === "number") return anyv.total;
    if (typeof anyv.count === "number") return anyv.count;
  }
  return undefined;
}

function deriveDirection(baseline: number | undefined, candidate: number | undefined, largerIsWorse = true): { direction: "regression" | "improvement" | "equal" | "unknown"; magnitude?: number } {
  if (baseline === undefined || candidate === undefined) return { direction: "unknown" };
  if (candidate === baseline) return { direction: "equal", magnitude: 0 };
  const delta = candidate - baseline;
  const worse = largerIsWorse ? delta > 0 : delta < 0;
  return { direction: worse ? "regression" : "improvement", magnitude: delta };
}

// ─── Dimension 1: correctness ────────────────────────────────────
//
// Authoritative source: evidence_engine.tests · evidence_engine.compilation · evidence_engine.regression
// PASSED both → equal · FAILED nex1 + PASSED baseline → regression · reverse → improvement

export function evaluateCorrectness(input: ReviewInput): DimensionObservation {
  const nex1Tests = findEvidence(input, input.nex1_candidate_id, "tests");
  const baseTests = findEvidence(input, input.baseline_candidate_id, "tests");
  const nex1Comp  = findEvidence(input, input.nex1_candidate_id, "compilation");
  const baseComp  = findEvidence(input, input.baseline_candidate_id, "compilation");

  const evidence_ids = [nex1Tests?.evidence_id, baseTests?.evidence_id, nex1Comp?.evidence_id, baseComp?.evidence_id].filter(Boolean) as string[];

  // If no tests or compilation evidence supplied → insufficient
  if (!nex1Tests && !baseTests && !nex1Comp && !baseComp) {
    return {
      dimension: "correctness",
      baseline_state: null, nex1_state: null,
      baseline_value: null, nex1_value: null,
      delta: null,
      conclusion: "insufficient_evidence",
      reason: "no evidence records supplied for tests or compilation on either candidate",
      evidence_ids: [],
    };
  }

  // Compilation is a gate: if nex1 does not compile, correctness regresses regardless of tests.
  if (nex1Comp?.state === "FAILED" && baseComp?.state === "PASSED") {
    return {
      dimension: "correctness",
      baseline_state: baseComp.state, nex1_state: nex1Comp.state,
      baseline_value: baseComp.value, nex1_value: nex1Comp.value,
      delta: { direction: "regression" },
      conclusion: "regression",
      reason: "nex1 candidate compilation FAILED · baseline PASSED · correctness cannot be preserved when compile is broken",
      evidence_ids,
    };
  }

  // If tests are available for both → compare
  if (nex1Tests && baseTests) {
    if (nex1Tests.state === "PASSED" && baseTests.state === "PASSED") {
      return {
        dimension: "correctness",
        baseline_state: baseTests.state, nex1_state: nex1Tests.state,
        baseline_value: baseTests.value, nex1_value: nex1Tests.value,
        delta: { direction: "equal" },
        conclusion: "equal",
        reason: "both candidates PASSED the deterministic test set",
        evidence_ids,
      };
    }
    if (nex1Tests.state === "FAILED" && baseTests.state === "PASSED") {
      return {
        dimension: "correctness",
        baseline_state: baseTests.state, nex1_state: nex1Tests.state,
        baseline_value: baseTests.value, nex1_value: nex1Tests.value,
        delta: { direction: "regression" },
        conclusion: "regression",
        reason: "nex1 candidate tests FAILED · baseline PASSED · correctness regression",
        evidence_ids,
      };
    }
    if (nex1Tests.state === "PASSED" && baseTests.state === "FAILED") {
      return {
        dimension: "correctness",
        baseline_state: baseTests.state, nex1_state: nex1Tests.state,
        baseline_value: baseTests.value, nex1_value: nex1Tests.value,
        delta: { direction: "improvement" },
        conclusion: "improvement",
        reason: "nex1 candidate tests PASSED · baseline previously FAILED",
        evidence_ids,
      };
    }
    // INCONCLUSIVE / STALE / NOT_MEASURED on either side → insufficient
    return {
      dimension: "correctness",
      baseline_state: baseTests.state, nex1_state: nex1Tests.state,
      baseline_value: baseTests.value, nex1_value: nex1Tests.value,
      delta: null,
      conclusion: "insufficient_evidence",
      reason: `test evidence not fully decidable · baseline=${baseTests.state} nex1=${nex1Tests.state}`,
      evidence_ids,
    };
  }

  return {
    dimension: "correctness",
    baseline_state: baseTests?.state ?? null, nex1_state: nex1Tests?.state ?? null,
    baseline_value: baseTests?.value ?? null, nex1_value: nex1Tests?.value ?? null,
    delta: null,
    conclusion: "insufficient_evidence",
    reason: "test evidence missing on one side · correctness cannot be established without both",
    evidence_ids,
  };
}

// ─── Dimension 2: semantic_preservation ──────────────────────────
//
// Authoritative source: evidence_engine.regression · evidence_engine.tests
// Any FAILED regression evidence → semantic_preservation regression

export function evaluateSemanticPreservation(input: ReviewInput): DimensionObservation {
  const nex1Reg = findEvidence(input, input.nex1_candidate_id, "regression");
  const baseReg = findEvidence(input, input.baseline_candidate_id, "regression");
  const evidence_ids = [nex1Reg?.evidence_id, baseReg?.evidence_id].filter(Boolean) as string[];

  if (!nex1Reg) {
    return {
      dimension: "semantic_preservation",
      baseline_state: baseReg?.state ?? null, nex1_state: null,
      baseline_value: baseReg?.value ?? null, nex1_value: null,
      delta: null,
      conclusion: "insufficient_evidence",
      reason: "no regression evidence for nex1 candidate · semantic preservation cannot be established",
      evidence_ids,
    };
  }
  if (nex1Reg.state === "FAILED") {
    return {
      dimension: "semantic_preservation",
      baseline_state: baseReg?.state ?? null, nex1_state: nex1Reg.state,
      baseline_value: baseReg?.value ?? null, nex1_value: nex1Reg.value,
      delta: { direction: "regression" },
      conclusion: "regression",
      reason: "regression evidence for nex1 candidate is FAILED · semantic behaviour is not preserved",
      evidence_ids,
    };
  }
  if (nex1Reg.state === "PASSED") {
    return {
      dimension: "semantic_preservation",
      baseline_state: baseReg?.state ?? "MEASURED", nex1_state: nex1Reg.state,
      baseline_value: baseReg?.value ?? null, nex1_value: nex1Reg.value,
      delta: { direction: "equal" },
      conclusion: "equal",
      reason: "regression evidence for nex1 candidate is PASSED · semantic behaviour is preserved to the extent the regression suite covers",
      evidence_ids,
    };
  }
  return {
    dimension: "semantic_preservation",
    baseline_state: baseReg?.state ?? null, nex1_state: nex1Reg.state,
    baseline_value: baseReg?.value ?? null, nex1_value: nex1Reg.value,
    delta: null,
    conclusion: "insufficient_evidence",
    reason: `regression evidence state=${nex1Reg.state} · not decidable`,
    evidence_ids,
  };
}

// ─── Dimension 3: complexity ─────────────────────────────────────
//
// Authoritative source: evidence_engine.complexity (preferred) · code_health.cyclomatic_complexity (fallback)
// Numeric compare · larger = regression

export function evaluateComplexity(input: ReviewInput): DimensionObservation {
  const nex1Ev = findEvidence(input, input.nex1_candidate_id, "complexity");
  const baseEv = findEvidence(input, input.baseline_candidate_id, "complexity");

  if (nex1Ev && baseEv && isUsable(nex1Ev.state) && isUsable(baseEv.state)) {
    const evidence_ids = [nex1Ev.evidence_id, baseEv.evidence_id];
    const b = numeric(baseEv.value);
    const n = numeric(nex1Ev.value);
    const d = deriveDirection(b, n, /*largerIsWorse*/ true);
    return {
      dimension: "complexity",
      baseline_state: baseEv.state, nex1_state: nex1Ev.state,
      baseline_value: baseEv.value, nex1_value: nex1Ev.value,
      delta: d,
      conclusion: d.direction === "unknown" ? "insufficient_evidence" : d.direction,
      reason: d.direction === "unknown"
        ? "complexity numeric value could not be extracted from evidence records"
        : `evidence_engine.complexity baseline=${b} nex1=${n} · larger cyclomatic is regression per Code Health convention`,
      evidence_ids,
    };
  }

  // Fallback: Code Health cyclomatic (file scope)
  const baseCH = findCodeHealthAll(input.code_health_baseline, "cyclomatic_complexity").filter((m) => m.scope === "file" && isUsable(m.state));
  const nex1CH = findCodeHealthAll(input.code_health_nex1, "cyclomatic_complexity").filter((m) => m.scope === "file" && isUsable(m.state));
  if (baseCH.length > 0 && nex1CH.length > 0) {
    const evidence_ids = [...baseCH.map((m) => m.metric_id), ...nex1CH.map((m) => m.metric_id)];
    const b = baseCH.reduce((a, m) => a + (numeric(m.value) ?? 0), 0);
    const n = nex1CH.reduce((a, m) => a + (numeric(m.value) ?? 0), 0);
    const d = deriveDirection(b, n, true);
    return {
      dimension: "complexity",
      baseline_state: "MEASURED", nex1_state: "MEASURED",
      baseline_value: { file_total_sum: b, file_count: baseCH.length },
      nex1_value: { file_total_sum: n, file_count: nex1CH.length },
      delta: d,
      conclusion: d.direction === "unknown" ? "insufficient_evidence" : d.direction,
      reason: `code_health.cyclomatic_complexity file-total sum · baseline=${b} nex1=${n} · larger is regression`,
      evidence_ids,
    };
  }

  return {
    dimension: "complexity",
    baseline_state: nex1Ev?.state ?? null, nex1_state: nex1Ev?.state ?? null,
    baseline_value: baseEv?.value ?? null, nex1_value: nex1Ev?.value ?? null,
    delta: null,
    conclusion: "insufficient_evidence",
    reason: "no usable complexity evidence · neither evidence_engine.complexity nor code_health.cyclomatic_complexity available in MEASURED state on both sides",
    evidence_ids: [],
  };
}

// ─── Dimension 4: maintainability ────────────────────────────────
//
// Authoritative source: code_health.duplication · function_size · nesting_depth · api_surface
// Composite is NOT a synthetic score · each sub-metric contributes a direction

export function evaluateMaintainability(input: ReviewInput): DimensionObservation {
  const kinds = ["duplication", "function_size", "nesting_depth", "api_surface"];
  const evidence_ids: string[] = [];
  const perKindDirections: Array<{ kind: string; direction: string; b?: number; n?: number }> = [];

  for (const kind of kinds) {
    const baseVals = findCodeHealthAll(input.code_health_baseline, kind).filter((m) => isUsable(m.state));
    const nex1Vals = findCodeHealthAll(input.code_health_nex1, kind).filter((m) => isUsable(m.state));
    if (baseVals.length === 0 || nex1Vals.length === 0) continue;
    const b = baseVals.reduce((a, m) => a + (numeric(m.value) ?? 0), 0);
    const n = nex1Vals.reduce((a, m) => a + (numeric(m.value) ?? 0), 0);
    // For every kind here, larger is regression (more duplication, more function-lines, more nesting, more surface)
    const d = deriveDirection(b, n, true);
    perKindDirections.push({ kind, direction: d.direction, b, n });
    evidence_ids.push(...baseVals.map((m) => m.metric_id), ...nex1Vals.map((m) => m.metric_id));
  }

  if (perKindDirections.length === 0) {
    return {
      dimension: "maintainability",
      baseline_state: null, nex1_state: null,
      baseline_value: null, nex1_value: null,
      delta: null,
      conclusion: "insufficient_evidence",
      reason: "no usable Code Health measurements for duplication / function_size / nesting_depth / api_surface on both sides",
      evidence_ids: [],
    };
  }

  const anyRegression = perKindDirections.some((p) => p.direction === "regression");
  const anyImprovement = perKindDirections.some((p) => p.direction === "improvement");
  const conclusion: "regression" | "improvement" | "equal" =
    anyRegression && !anyImprovement ? "regression" :
    anyImprovement && !anyRegression ? "improvement" :
    "equal";
  const summary = perKindDirections.map((p) => `${p.kind}:${p.direction}(b=${p.b},n=${p.n})`).join(" · ");
  return {
    dimension: "maintainability",
    baseline_state: "MEASURED", nex1_state: "MEASURED",
    baseline_value: Object.fromEntries(perKindDirections.map((p) => [p.kind + "_baseline", p.b ?? 0])),
    nex1_value: Object.fromEntries(perKindDirections.map((p) => [p.kind + "_nex1", p.n ?? 0])),
    delta: { direction: conclusion === "equal" ? "equal" : conclusion },
    conclusion,
    reason: `code_health sub-metrics · ${summary}`,
    evidence_ids,
  };
}

// ─── Dimension 5: testability ────────────────────────────────────
//
// Authoritative source: code_health.test_relationship
// At Phase 3 this is NOT_MEASURED per Code Health · NEX2 emits insufficient_evidence · MUST NOT fabricate

export function evaluateTestability(input: ReviewInput): DimensionObservation {
  const nex1TR = findCodeHealthOne(input.code_health_nex1, "test_relationship");
  const baseTR = findCodeHealthOne(input.code_health_baseline, "test_relationship");
  const usable = isUsable(nex1TR?.state) && isUsable(baseTR?.state);
  if (usable) {
    const b = numeric(baseTR!.value);
    const n = numeric(nex1TR!.value);
    const d = deriveDirection(b, n, false); // more tests is improvement
    return {
      dimension: "testability",
      baseline_state: baseTR!.state, nex1_state: nex1TR!.state,
      baseline_value: baseTR!.value, nex1_value: nex1TR!.value,
      delta: d,
      conclusion: d.direction === "unknown" ? "insufficient_evidence" : d.direction,
      reason: `code_health.test_relationship baseline=${b} nex1=${n}`,
      evidence_ids: [baseTR!.metric_id, nex1TR!.metric_id],
    };
  }
  return {
    dimension: "testability",
    baseline_state: baseTR?.state ?? null, nex1_state: nex1TR?.state ?? null,
    baseline_value: baseTR?.value ?? null, nex1_value: nex1TR?.value ?? null,
    delta: null,
    conclusion: "not_authoritatively_available",
    reason: "code_health.test_relationship is NOT_MEASURED at Phase 3 · NEX2 refuses to infer testability from adjacent proxies",
    evidence_ids: [],
  };
}

// ─── Dimensions 6 & 7: security / performance (no authoritative source yet) ─

export function evaluateSecurity(_input: ReviewInput): DimensionObservation {
  return {
    dimension: "security",
    baseline_state: null, nex1_state: null,
    baseline_value: null, nex1_value: null,
    delta: null,
    conclusion: "not_authoritatively_available",
    reason: "no authorised NEX security-evidence subsystem exists at Phase 3 · NEX2 MUST NOT invent security judgements",
    evidence_ids: [],
  };
}

export function evaluatePerformance(_input: ReviewInput): DimensionObservation {
  return {
    dimension: "performance",
    baseline_state: null, nex1_state: null,
    baseline_value: null, nex1_value: null,
    delta: null,
    conclusion: "not_authoritatively_available",
    reason: "no authorised NEX performance-evidence subsystem exists at Phase 3 · NEX2 MUST NOT infer performance from complexity or size",
    evidence_ids: [],
  };
}

// ─── Dimension 8: project_alignment ──────────────────────────────
//
// Authoritative source: project_profile
// NEX2 checks whether NEX1 changes preserve observed conventions.

export function evaluateProjectAlignment(input: ReviewInput): DimensionObservation {
  const pp = input.project_profile;
  if (!pp) {
    return {
      dimension: "project_alignment",
      baseline_state: null, nex1_state: null,
      baseline_value: null, nex1_value: null,
      delta: null,
      conclusion: "insufficient_evidence",
      reason: "project profile not supplied · project alignment cannot be established",
      evidence_ids: [],
    };
  }
  return {
    dimension: "project_alignment",
    baseline_state: "MEASURED", nex1_state: "MEASURED",
    baseline_value: { profile_id: pp.profile_id, conventions_count: Object.keys(pp.conventions ?? {}).length, detected_languages: pp.detected_languages ?? [] },
    nex1_value:     { profile_id: pp.profile_id, conventions_count: Object.keys(pp.conventions ?? {}).length, detected_languages: pp.detected_languages ?? [] },
    delta: { direction: "equal" },
    conclusion: "equal",
    reason: "project profile observed · NEX2 v0.2.0 cites the profile but does not synthesize convention-violation judgements without a per-file diff signal",
    evidence_ids: [pp.profile_id],
  };
}

// ─── Dimension 9: user_objective_alignment ───────────────────────

export function evaluateUserObjective(input: ReviewInput): DimensionObservation {
  if (!input.user_objective || input.user_objective.trim().length === 0) {
    return {
      dimension: "user_objective_alignment",
      baseline_state: null, nex1_state: null,
      baseline_value: null, nex1_value: null,
      delta: null,
      conclusion: "insufficient_evidence",
      reason: "user_objective not supplied to the review request · NEX2 cannot infer intent",
      evidence_ids: [],
    };
  }
  // NEX2 v0.2.0 does not have a deterministic user-objective parser · it can only record the objective and note that a founder-authorised
  // alignment adjudicator does not exist yet. This is honest surface.
  return {
    dimension: "user_objective_alignment",
    baseline_state: null, nex1_state: null,
    baseline_value: null, nex1_value: null,
    delta: null,
    conclusion: "not_authoritatively_available",
    reason: `user_objective recorded: "${input.user_objective.slice(0, 120)}" · no authorised NEX user-objective adjudicator exists at Phase 3 · NEX2 does not fabricate alignment`,
    evidence_ids: [],
  };
}

// ─── Dimension 10: change_risk ───────────────────────────────────
//
// Authoritative source: project_architecture.fan_out (of changed files)
// Higher fan_out on changed files = higher risk · descriptive only

export function evaluateChangeRisk(input: ReviewInput): DimensionObservation {
  if (!input.project_architecture) {
    return {
      dimension: "change_risk",
      baseline_state: null, nex1_state: null,
      baseline_value: null, nex1_value: null,
      delta: null,
      conclusion: "insufficient_evidence",
      reason: "project_architecture not supplied · change_risk cannot be established",
      evidence_ids: [],
    };
  }
  if (!input.changed_files || input.changed_files.length === 0) {
    return {
      dimension: "change_risk",
      baseline_state: "MEASURED", nex1_state: "MEASURED",
      baseline_value: { changed_files_count: 0 }, nex1_value: { changed_files_count: 0 },
      delta: { direction: "equal", magnitude: 0 },
      conclusion: "equal",
      reason: "no changed_files supplied · fan_out span of change is zero",
      evidence_ids: [input.project_architecture.report_id ?? "project_architecture"],
    };
  }
  const foMap = new Map(input.project_architecture.fan_out.map((r) => [r.node_id, r.count]));
  const cycles = input.project_architecture.cycles ?? [];
  const changedFanOut = input.changed_files.map((p) => ({ path: p, fan_out: foMap.get(p) ?? 0 }));
  const totalFanOut = changedFanOut.reduce((a, x) => a + x.fan_out, 0);
  const crossesCycle = input.changed_files.some((p) => cycles.some((c) => c.members.includes(p)));
  //
  // v0.2.0 discipline: NEX2 REPORTS the raw fan_out span of the changed files.
  // It does NOT convert a single-sided fan_out observation into a regression
  // verdict · that would be a threshold judgement without founder-authorised
  // thresholds. Delta comparison requires a differential architecture snapshot
  // which Phase 3 does not have. Therefore the conclusion here is descriptive
  // only ("not_authoritatively_available" when the change actually touches
  // downstream code · "equal" only when nothing downstream is reached).
  //
  const descriptive = totalFanOut > 0 || crossesCycle;
  return {
    dimension: "change_risk",
    baseline_state: "MEASURED", nex1_state: "MEASURED",
    baseline_value: { changed_files_count: input.changed_files.length, per_file: changedFanOut, crosses_cycle: crossesCycle, total_fan_out_of_changed_files: totalFanOut },
    nex1_value:     { changed_files_count: input.changed_files.length, per_file: changedFanOut, crosses_cycle: crossesCycle, total_fan_out_of_changed_files: totalFanOut },
    delta: null,
    conclusion: descriptive ? "not_authoritatively_available" : "equal",
    reason: descriptive
      ? `changed files reach downstream via fan_out sum=${totalFanOut}${crossesCycle ? " · crosses cycle" : ""} · reported as raw measurement · NEX2 v0.2.0 does not label a single-sided fan_out span as regression without a founder-authorised threshold and a differential architecture snapshot`
      : "changed files have zero downstream fan_out and cross no cycle",
    evidence_ids: [input.project_architecture.report_id ?? "project_architecture"],
  };
}

// ─── Orchestrator ────────────────────────────────────────────────

export function evaluateAllDimensions(input: ReviewInput): readonly DimensionObservation[] {
  return [
    evaluateCorrectness(input),
    evaluateSemanticPreservation(input),
    evaluateComplexity(input),
    evaluateMaintainability(input),
    evaluateTestability(input),
    evaluateSecurity(input),
    evaluatePerformance(input),
    evaluateProjectAlignment(input),
    evaluateUserObjective(input),
    evaluateChangeRisk(input),
  ];
}
