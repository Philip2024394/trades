// src/lib/nex3-arbitration/hierarchy.ts
//
// NEX3 · 6 hierarchical decision gates.
// authored_by = master_ai_engineer · founder-authorised 2026-09-12
//
// Discipline:
//   · every gate returns per-candidate survival + citations
//   · unknown state NEVER becomes positive
//   · no synthetic quality score
//   · load-bearing failures eliminate the candidate before descriptive comparison begins

import type {
  ArbitrationInput,
  GateResult,
  CandidateType,
  EvidenceRecordCitation,
  CodeHealthCitation,
  ConsumedState,
  CriterionResult,
} from "./types";

// ─── Helpers ─────────────────────────────────────────────────────

function findEv(input: ArbitrationInput, candidate_id: string, kind: string): EvidenceRecordCitation | undefined {
  return (input.evidence_records ?? []).find((r) => r.candidate_id === candidate_id && r.measurement_type === kind);
}

function findChAll(pool: readonly CodeHealthCitation[] | undefined, kind: string): readonly CodeHealthCitation[] {
  return (pool ?? []).filter((m) => m.kind === kind);
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

function poolForCandidate(input: ArbitrationInput, c: CandidateType): readonly CodeHealthCitation[] {
  if (c === "baseline") return input.code_health_baseline ?? [];
  if (c === "nex1") return input.code_health_nex1 ?? [];
  return input.code_health_nex2 ?? [];
}

function idForCandidate(input: ArbitrationInput, c: CandidateType): string {
  if (c === "baseline") return input.baseline_candidate.candidate_id;
  if (c === "nex1") return input.nex1_candidate.candidate_id;
  return input.nex2_candidate?.candidate_id ?? "";
}

function candidatePresent(input: ArbitrationInput, c: CandidateType): boolean {
  if (c === "baseline") return true;
  if (c === "nex1") return true;
  return input.nex2_candidate != null;
}

function allCandidates(input: ArbitrationInput): CandidateType[] {
  const out: CandidateType[] = ["baseline", "nex1"];
  if (input.nex2_candidate) out.push("nex2");
  return out;
}

// ─── Gate 1: correctness ─────────────────────────────────────────
//
// Uses evidence_engine.tests + .compilation.
// Any candidate with FAILED compilation OR FAILED tests → eliminated.
// If no correctness evidence exists for ANY candidate → load-bearing hold signal.

export function gate1_correctness(input: ArbitrationInput): GateResult {
  const eliminations: GateResult["eliminations"] = [];
  const evidence_ids: string[] = [];
  const survivors: CandidateType[] = [];

  for (const c of allCandidates(input)) {
    const cid = idForCandidate(input, c);
    const tests = findEv(input, cid, "tests");
    const comp  = findEv(input, cid, "compilation");
    if (tests?.evidence_id) evidence_ids.push(tests.evidence_id);
    if (comp?.evidence_id)  evidence_ids.push(comp.evidence_id);
    if (comp?.state === "FAILED") {
      eliminations.push({ candidate: c, reason: `compilation FAILED for ${c} · candidate cannot win`, evidence_ids: [comp.evidence_id] });
      continue;
    }
    if (tests?.state === "FAILED") {
      eliminations.push({ candidate: c, reason: `tests FAILED for ${c} · candidate cannot win`, evidence_ids: [tests.evidence_id] });
      continue;
    }
    survivors.push(c);
  }

  return {
    gate: 1, gate_id: "correctness", priority: "load_bearing",
    survivors, eliminations, evidence_ids,
    reason: eliminations.length > 0
      ? `${eliminations.length} candidate(s) eliminated at correctness gate`
      : `all ${survivors.length} candidates have no observed correctness failure`,
  };
}

// ─── Gate 2: semantic preservation ───────────────────────────────
//
// Uses evidence_engine.regression.
// Any candidate with FAILED regression → eliminated.

export function gate2_semanticPreservation(input: ArbitrationInput, priorSurvivors: readonly CandidateType[]): GateResult {
  const eliminations: GateResult["eliminations"] = [];
  const evidence_ids: string[] = [];
  const survivors: CandidateType[] = [];

  for (const c of priorSurvivors) {
    const cid = idForCandidate(input, c);
    const reg = findEv(input, cid, "regression");
    if (reg?.evidence_id) evidence_ids.push(reg.evidence_id);
    if (reg?.state === "FAILED") {
      eliminations.push({ candidate: c, reason: `regression FAILED for ${c} · required existing behaviour is not preserved`, evidence_ids: [reg.evidence_id] });
      continue;
    }
    survivors.push(c);
  }

  return {
    gate: 2, gate_id: "semantic_preservation", priority: "load_bearing",
    survivors, eliminations, evidence_ids,
    reason: eliminations.length > 0
      ? `${eliminations.length} candidate(s) eliminated at semantic_preservation gate`
      : `all ${survivors.length} surviving candidates preserve existing behaviour to the extent regression evidence covers`,
  };
}

// ─── Gate 3: security ────────────────────────────────────────────
//
// If work_order.affects_security_boundary=true AND no authoritative security evidence exists
// for any candidate that could win → return special "hold" survivors list containing NO candidates.
// This causes the arbiter to return HOLD_INSUFFICIENT_EVIDENCE.

export function gate3_security(input: ArbitrationInput, priorSurvivors: readonly CandidateType[]): GateResult {
  const wo = input.work_order;
  if (!wo.affects_security_boundary) {
    return {
      gate: 3, gate_id: "security", priority: "load_bearing",
      survivors: [...priorSurvivors], eliminations: [], evidence_ids: [],
      reason: "work_order does not affect a security/authentication/authorisation boundary · security gate does not apply",
    };
  }
  // Security-affecting change · at Phase 4 NEX3 has no authoritative security evidence subsystem.
  // Fail-closed: eliminate every survivor with a security-hold reason.
  const eliminations: GateResult["eliminations"] = priorSurvivors.map((c) => ({
    candidate: c,
    reason: "work_order.affects_security_boundary=true · no authoritative NEX security-evidence subsystem exists at Phase 4 · NEX3 refuses to assume security",
    evidence_ids: [],
  }));
  return {
    gate: 3, gate_id: "security", priority: "load_bearing",
    survivors: [], eliminations, evidence_ids: [],
    reason: "security-affecting change without authoritative security evidence · NEX3 elevates to HOLD_INSUFFICIENT_EVIDENCE",
  };
}

// ─── Gate 4: user_objective ──────────────────────────────────────
//
// If work_order.unresolved_objective_choices is non-empty → all survivors are held for user clarification.
// Otherwise · v0.3.0 records the objective but does not synthesise objective-satisfaction without a
// deterministic adjudicator. Baseline stays eligible if work_order.baseline_satisfies_objective===true.
// Candidates that regress correctness/semantics were already eliminated at gates 1-2.

export function gate4_userObjective(input: ArbitrationInput, priorSurvivors: readonly CandidateType[]): GateResult {
  const wo = input.work_order;
  const unresolved = wo.unresolved_objective_choices ?? [];
  if (unresolved.length > 0) {
    // Signal to arbiter · verdict becomes USER_CLARIFICATION_REQUIRED
    return {
      gate: 4, gate_id: "user_objective", priority: "load_bearing",
      survivors: [], eliminations: priorSurvivors.map((c) => ({
        candidate: c,
        reason: `user objective contains unresolved choice(s): ${unresolved.join(" · ")} · NEX3 does not invent the user's preference`,
        evidence_ids: [],
      })),
      evidence_ids: [],
      reason: "user objective genuinely ambiguous · NEX3 stops rather than manufacture certainty",
    };
  }

  // If work_order explicitly says baseline satisfies the objective · baseline stays.
  // If work_order provides acceptance_criteria that reference specific evidence · use those for elimination.
  // v0.3.0 keeps all prior survivors pass-through when objective is recorded and unambiguous.
  return {
    gate: 4, gate_id: "user_objective", priority: "load_bearing",
    survivors: [...priorSurvivors], eliminations: [], evidence_ids: [],
    reason: wo.user_objective && wo.user_objective.length > 0
      ? "user objective recorded and unambiguous · no candidate eliminated on objective grounds without a deterministic adjudicator"
      : "user_objective absent · treated as no elimination signal · consider USER_CLARIFICATION_REQUIRED at verdict resolution when engineering trade-offs remain unresolved",
  };
}

// ─── Gate 5: project_alignment ───────────────────────────────────
//
// Consults project_profile. v0.3.0 records profile presence but does not perform convention-violation
// elimination without per-file diff signal. Non-eliminating gate at Phase 4 unless the caller
// supplies explicit convention-violation evidence.

export function gate5_projectAlignment(input: ArbitrationInput, priorSurvivors: readonly CandidateType[]): GateResult {
  const pp = input.project_profile;
  const evidence_ids: string[] = pp?.profile_id ? [pp.profile_id] : [];
  return {
    gate: 5, gate_id: "project_alignment", priority: "load_bearing",
    survivors: [...priorSurvivors], eliminations: [], evidence_ids,
    reason: pp
      ? "project profile consulted · v0.3.0 does not eliminate candidates for convention deviation without an explicit convention-violation evidence record"
      : "project profile not supplied · alignment observation deferred",
  };
}

// ─── Gate 6: engineering trade-offs ──────────────────────────────
//
// Compare complexity / maintainability / change_risk across survivors.
// Returns per-candidate "score direction" as raw evidence · NEVER as a synthetic total.

export function gate6_tradeoffs(input: ArbitrationInput, priorSurvivors: readonly CandidateType[]): GateResult {
  const evidence_ids: string[] = [];
  // Descriptive gate · never eliminates. Feeds criteria_results for verdict resolution.
  // Collect evidence_ids so provenance chain can walk them.
  for (const c of priorSurvivors) {
    const cid = idForCandidate(input, c);
    const cxEv = findEv(input, cid, "complexity");
    if (cxEv?.evidence_id) evidence_ids.push(cxEv.evidence_id);
    const chC = findChAll(poolForCandidate(input, c), "cyclomatic_complexity");
    for (const m of chC) evidence_ids.push(m.metric_id);
    const chDup = findChAll(poolForCandidate(input, c), "duplication");
    for (const m of chDup) evidence_ids.push(m.metric_id);
    const chFn = findChAll(poolForCandidate(input, c), "function_size");
    for (const m of chFn) evidence_ids.push(m.metric_id);
  }
  return {
    gate: 6, gate_id: "engineering_tradeoffs", priority: "descriptive",
    survivors: [...priorSurvivors], eliminations: [], evidence_ids,
    reason: "engineering trade-offs recorded as per-candidate raw evidence · never aggregated into a synthetic score",
  };
}

// ─── Criteria composer ───────────────────────────────────────────
//
// Produces one CriterionResult per criterion. Each result is inspectable in isolation.

export function composeCriteriaResults(input: ArbitrationInput): readonly CriterionResult[] {
  const results: CriterionResult[] = [];

  // correctness
  results.push(criterion_tests_or_compilation(input));

  // semantic_preservation
  results.push(criterion_regression(input));

  // security
  results.push({
    criterion: "security",
    baseline_state: null, nex1_state: null, nex2_state: null,
    baseline_value: null, nex1_value: null, nex2_value: null,
    conclusion: "not_authoritatively_available",
    advantaged_candidate: null,
    reason: "no authorised NEX security-evidence subsystem exists at Phase 4",
    evidence_ids: [],
  });

  // user_objective_alignment
  results.push(criterion_user_objective(input));

  // project_alignment
  results.push(criterion_project_alignment(input));

  // complexity
  results.push(criterion_complexity(input));

  // maintainability
  results.push(criterion_maintainability(input));

  // testability · code_health.test_relationship is NOT_MEASURED at Phase 2C · NEX3 mirrors that
  results.push({
    criterion: "testability",
    baseline_state: null, nex1_state: null, nex2_state: null,
    baseline_value: null, nex1_value: null, nex2_value: null,
    conclusion: "not_authoritatively_available",
    advantaged_candidate: null,
    reason: "code_health.test_relationship is NOT_MEASURED at Phase 2C · NEX3 refuses to infer testability",
    evidence_ids: [],
  });

  // performance
  results.push({
    criterion: "performance",
    baseline_state: null, nex1_state: null, nex2_state: null,
    baseline_value: null, nex1_value: null, nex2_value: null,
    conclusion: "not_authoritatively_available",
    advantaged_candidate: null,
    reason: "no authorised NEX performance-evidence subsystem exists at Phase 4",
    evidence_ids: [],
  });

  // change_risk
  results.push(criterion_change_risk(input));

  return results;
}

function criterion_tests_or_compilation(input: ArbitrationInput): CriterionResult {
  const bT = findEv(input, input.baseline_candidate.candidate_id, "tests");
  const nT = findEv(input, input.nex1_candidate.candidate_id, "tests");
  const n2T = input.nex2_candidate ? findEv(input, input.nex2_candidate.candidate_id, "tests") : undefined;
  const evidence_ids = [bT?.evidence_id, nT?.evidence_id, n2T?.evidence_id].filter(Boolean) as string[];

  if (!bT && !nT && !n2T) {
    return {
      criterion: "correctness",
      baseline_state: null, nex1_state: null, nex2_state: input.nex2_candidate ? null : null,
      baseline_value: null, nex1_value: null, nex2_value: null,
      conclusion: "insufficient_evidence",
      advantaged_candidate: null,
      reason: "no test evidence supplied for any candidate",
      evidence_ids: [],
    };
  }
  // Determine who has PASSED and who has FAILED
  const states: Record<string, ConsumedState | null> = {
    baseline: bT?.state ?? null,
    nex1: nT?.state ?? null,
    nex2: n2T?.state ?? null,
  };
  const passing = Object.entries(states).filter(([, s]) => s === "PASSED").map(([k]) => k);
  const failing = Object.entries(states).filter(([, s]) => s === "FAILED").map(([k]) => k);
  if (failing.length > 0 && passing.length > 0) {
    return {
      criterion: "correctness",
      baseline_state: states.baseline, nex1_state: states.nex1, nex2_state: states.nex2,
      baseline_value: bT?.value ?? null, nex1_value: nT?.value ?? null, nex2_value: n2T?.value ?? null,
      conclusion: "candidate_advantaged",
      advantaged_candidate: passing[0] as any,
      reason: `passing: ${passing.join(", ")} · failing: ${failing.join(", ")}`,
      evidence_ids,
    };
  }
  if (passing.length > 0 && failing.length === 0) {
    return {
      criterion: "correctness",
      baseline_state: states.baseline, nex1_state: states.nex1, nex2_state: states.nex2,
      baseline_value: bT?.value ?? null, nex1_value: nT?.value ?? null, nex2_value: n2T?.value ?? null,
      conclusion: "none_advantaged",
      advantaged_candidate: null,
      reason: "all decidable candidates PASSED tests",
      evidence_ids,
    };
  }
  return {
    criterion: "correctness",
    baseline_state: states.baseline, nex1_state: states.nex1, nex2_state: states.nex2,
    baseline_value: bT?.value ?? null, nex1_value: nT?.value ?? null, nex2_value: n2T?.value ?? null,
    conclusion: "insufficient_evidence",
    advantaged_candidate: null,
    reason: `no PASSED evidence · states: baseline=${states.baseline} nex1=${states.nex1} nex2=${states.nex2}`,
    evidence_ids,
  };
}

function criterion_regression(input: ArbitrationInput): CriterionResult {
  const b = findEv(input, input.baseline_candidate.candidate_id, "regression");
  const n = findEv(input, input.nex1_candidate.candidate_id, "regression");
  const n2 = input.nex2_candidate ? findEv(input, input.nex2_candidate.candidate_id, "regression") : undefined;
  const evidence_ids = [b?.evidence_id, n?.evidence_id, n2?.evidence_id].filter(Boolean) as string[];

  const failed: string[] = [];
  if (b?.state === "FAILED") failed.push("baseline");
  if (n?.state === "FAILED") failed.push("nex1");
  if (n2?.state === "FAILED") failed.push("nex2");

  const passed: string[] = [];
  if (b?.state === "PASSED") passed.push("baseline");
  if (n?.state === "PASSED") passed.push("nex1");
  if (n2?.state === "PASSED") passed.push("nex2");

  if (failed.length > 0 && passed.length > 0) {
    return {
      criterion: "semantic_preservation",
      baseline_state: b?.state ?? null, nex1_state: n?.state ?? null, nex2_state: n2?.state ?? null,
      baseline_value: b?.value ?? null, nex1_value: n?.value ?? null, nex2_value: n2?.value ?? null,
      conclusion: "candidate_advantaged",
      advantaged_candidate: passed[0] as any,
      reason: `regression PASSED: ${passed.join(", ")} · FAILED: ${failed.join(", ")}`,
      evidence_ids,
    };
  }
  if (passed.length > 0) {
    return {
      criterion: "semantic_preservation",
      baseline_state: b?.state ?? null, nex1_state: n?.state ?? null, nex2_state: n2?.state ?? null,
      baseline_value: b?.value ?? null, nex1_value: n?.value ?? null, nex2_value: n2?.value ?? null,
      conclusion: "none_advantaged",
      advantaged_candidate: null,
      reason: "all decidable candidates preserve behaviour to the extent regression evidence covers",
      evidence_ids,
    };
  }
  return {
    criterion: "semantic_preservation",
    baseline_state: b?.state ?? null, nex1_state: n?.state ?? null, nex2_state: n2?.state ?? null,
    baseline_value: b?.value ?? null, nex1_value: n?.value ?? null, nex2_value: n2?.value ?? null,
    conclusion: "insufficient_evidence",
    advantaged_candidate: null,
    reason: "no regression evidence in decidable state on any candidate",
    evidence_ids: [],
  };
}

function criterion_user_objective(input: ArbitrationInput): CriterionResult {
  const wo = input.work_order;
  const unresolved = wo.unresolved_objective_choices ?? [];
  if (unresolved.length > 0) {
    return {
      criterion: "user_objective_alignment",
      baseline_state: null, nex1_state: null, nex2_state: null,
      baseline_value: null, nex1_value: null, nex2_value: null,
      conclusion: "contradictory",
      advantaged_candidate: null,
      reason: `user objective contains unresolved choice(s): ${unresolved.join(" · ")}`,
      evidence_ids: [],
    };
  }
  return {
    criterion: "user_objective_alignment",
    baseline_state: null, nex1_state: null, nex2_state: null,
    baseline_value: wo.user_objective ? { user_objective: wo.user_objective.slice(0, 200) } : null,
    nex1_value: null, nex2_value: null,
    conclusion: wo.user_objective ? "not_authoritatively_available" : "insufficient_evidence",
    advantaged_candidate: null,
    reason: wo.user_objective
      ? "user_objective recorded · no authorised NEX user-objective adjudicator exists at Phase 4 · NEX3 does not fabricate alignment"
      : "user_objective absent · alignment cannot be evaluated",
    evidence_ids: [],
  };
}

function criterion_project_alignment(input: ArbitrationInput): CriterionResult {
  const pp = input.project_profile;
  if (!pp) {
    return {
      criterion: "project_alignment",
      baseline_state: null, nex1_state: null, nex2_state: null,
      baseline_value: null, nex1_value: null, nex2_value: null,
      conclusion: "insufficient_evidence",
      advantaged_candidate: null,
      reason: "project profile not supplied",
      evidence_ids: [],
    };
  }
  return {
    criterion: "project_alignment",
    baseline_state: "MEASURED", nex1_state: "MEASURED", nex2_state: input.nex2_candidate ? "MEASURED" : null,
    baseline_value: { profile_id: pp.profile_id, conventions_count: Object.keys(pp.conventions ?? {}).length },
    nex1_value: { profile_id: pp.profile_id, conventions_count: Object.keys(pp.conventions ?? {}).length },
    nex2_value: input.nex2_candidate ? { profile_id: pp.profile_id, conventions_count: Object.keys(pp.conventions ?? {}).length } : null,
    conclusion: "none_advantaged",
    advantaged_candidate: null,
    reason: "project profile observed · v0.3.0 does not synthesize per-candidate convention judgements without diff-level signal",
    evidence_ids: [pp.profile_id],
  };
}

function criterion_complexity(input: ArbitrationInput): CriterionResult {
  const b = findEv(input, input.baseline_candidate.candidate_id, "complexity");
  const n = findEv(input, input.nex1_candidate.candidate_id, "complexity");
  const n2 = input.nex2_candidate ? findEv(input, input.nex2_candidate.candidate_id, "complexity") : undefined;
  const evidence_ids = [b?.evidence_id, n?.evidence_id, n2?.evidence_id].filter(Boolean) as string[];

  const bv = numeric(b?.value);
  const nv = numeric(n?.value);
  const n2v = numeric(n2?.value);
  const decidable = [
    { c: "baseline" as const, v: bv, state: b?.state },
    { c: "nex1" as const,     v: nv, state: n?.state },
    { c: "nex2" as const,     v: n2v, state: n2?.state },
  ].filter((x) => typeof x.v === "number" && (x.state === "MEASURED" || x.state === "PASSED"));

  if (decidable.length < 2) {
    return {
      criterion: "complexity",
      baseline_state: b?.state ?? null, nex1_state: n?.state ?? null, nex2_state: n2?.state ?? null,
      baseline_value: b?.value ?? null, nex1_value: n?.value ?? null, nex2_value: n2?.value ?? null,
      conclusion: "insufficient_evidence",
      advantaged_candidate: null,
      reason: "fewer than two candidates have decidable complexity evidence",
      evidence_ids,
    };
  }
  const lowest = decidable.reduce((a, x) => (x.v! < a.v! ? x : a));
  const highest = decidable.reduce((a, x) => (x.v! > a.v! ? x : a));
  if (lowest.v === highest.v) {
    return {
      criterion: "complexity",
      baseline_state: b?.state ?? null, nex1_state: n?.state ?? null, nex2_state: n2?.state ?? null,
      baseline_value: b?.value ?? null, nex1_value: n?.value ?? null, nex2_value: n2?.value ?? null,
      conclusion: "none_advantaged",
      advantaged_candidate: null,
      reason: `all decidable complexity values equal (${lowest.v})`,
      evidence_ids,
    };
  }
  return {
    criterion: "complexity",
    baseline_state: b?.state ?? null, nex1_state: n?.state ?? null, nex2_state: n2?.state ?? null,
    baseline_value: b?.value ?? null, nex1_value: n?.value ?? null, nex2_value: n2?.value ?? null,
    conclusion: "candidate_advantaged",
    advantaged_candidate: lowest.c,
    reason: `evidence_engine.complexity lowest on ${lowest.c} (=${lowest.v}) vs highest ${highest.c} (=${highest.v})`,
    evidence_ids,
  };
}

function criterion_maintainability(input: ArbitrationInput): CriterionResult {
  const kinds = ["duplication", "function_size", "nesting_depth", "api_surface"];
  const evidence_ids: string[] = [];
  const perCandidate: Record<CandidateType, number | null> = { baseline: null, nex1: null, nex2: null };
  const candidateList: CandidateType[] = allCandidates(input);
  for (const c of candidateList) {
    const pool = poolForCandidate(input, c);
    let total = 0; let anyMeasured = false;
    for (const k of kinds) {
      for (const m of findChAll(pool, k)) {
        if (m.state === "MEASURED" || m.state === "PASSED") {
          const v = numeric(m.value);
          if (typeof v === "number") { total += v; anyMeasured = true; evidence_ids.push(m.metric_id); }
        }
      }
    }
    perCandidate[c] = anyMeasured ? total : null;
  }
  const decidable = Object.entries(perCandidate).filter(([, v]) => typeof v === "number") as Array<[CandidateType, number]>;
  if (decidable.length < 2) {
    return {
      criterion: "maintainability",
      baseline_state: perCandidate.baseline !== null ? "MEASURED" : null,
      nex1_state: perCandidate.nex1 !== null ? "MEASURED" : null,
      nex2_state: perCandidate.nex2 !== null ? "MEASURED" : null,
      baseline_value: perCandidate.baseline, nex1_value: perCandidate.nex1, nex2_value: perCandidate.nex2,
      conclusion: "insufficient_evidence",
      advantaged_candidate: null,
      reason: "fewer than two candidates have decidable code-health composite evidence",
      evidence_ids,
    };
  }
  const lowest = decidable.reduce((a, [c, v]) => (v < a[1] ? [c, v] as [CandidateType, number] : a));
  const highest = decidable.reduce((a, [c, v]) => (v > a[1] ? [c, v] as [CandidateType, number] : a));
  if (lowest[1] === highest[1]) {
    return {
      criterion: "maintainability",
      baseline_state: "MEASURED", nex1_state: "MEASURED", nex2_state: input.nex2_candidate ? "MEASURED" : null,
      baseline_value: perCandidate.baseline, nex1_value: perCandidate.nex1, nex2_value: perCandidate.nex2,
      conclusion: "none_advantaged",
      advantaged_candidate: null,
      reason: "code-health composite equal across decidable candidates",
      evidence_ids,
    };
  }
  return {
    criterion: "maintainability",
    baseline_state: "MEASURED", nex1_state: "MEASURED", nex2_state: input.nex2_candidate ? "MEASURED" : null,
    baseline_value: perCandidate.baseline, nex1_value: perCandidate.nex1, nex2_value: perCandidate.nex2,
    conclusion: "candidate_advantaged",
    advantaged_candidate: lowest[0],
    reason: `code-health composite (duplication + function_size + nesting_depth + api_surface) lowest on ${lowest[0]} (=${lowest[1]}) vs highest ${highest[0]} (=${highest[1]}) · per-criterion inspection retained · no synthetic score`,
    evidence_ids,
  };
}

function criterion_change_risk(input: ArbitrationInput): CriterionResult {
  const pa = input.project_architecture;
  if (!pa) {
    return {
      criterion: "change_risk",
      baseline_state: null, nex1_state: null, nex2_state: null,
      baseline_value: null, nex1_value: null, nex2_value: null,
      conclusion: "insufficient_evidence",
      advantaged_candidate: null,
      reason: "project_architecture not supplied",
      evidence_ids: [],
    };
  }
  const foMap = new Map(pa.fan_out.map((r) => [r.node_id, r.count]));
  const spanFor = (files?: readonly string[]) => (files ?? []).reduce((a, f) => a + (foMap.get(f) ?? 0), 0);
  const nex1Span = spanFor(input.changed_files_nex1);
  const nex2Span = spanFor(input.changed_files_nex2);
  return {
    criterion: "change_risk",
    baseline_state: "MEASURED", nex1_state: "MEASURED", nex2_state: input.nex2_candidate ? "MEASURED" : null,
    baseline_value: { total_fan_out_span: 0 },
    nex1_value: { total_fan_out_span: nex1Span, changed_files: input.changed_files_nex1 ?? [] },
    nex2_value: input.nex2_candidate ? { total_fan_out_span: nex2Span, changed_files: input.changed_files_nex2 ?? [] } : null,
    conclusion: "not_authoritatively_available",
    advantaged_candidate: null,
    reason: `raw fan_out span reported (nex1=${nex1Span}${input.nex2_candidate ? ", nex2=" + nex2Span : ""}) · v0.3.0 does not convert single-sided fan_out into a threshold verdict without founder-authorised thresholds`,
    evidence_ids: [pa.report_id ?? "project_architecture"],
  };
}
