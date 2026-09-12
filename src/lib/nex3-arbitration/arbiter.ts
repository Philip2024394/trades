// src/lib/nex3-arbitration/arbiter.ts
//
// NEX3 · engineering arbiter orchestrator.
// authored_by = master_ai_engineer · founder-authorised 2026-09-12
//
// Composes gates + criteria into an ArbitrationRecord.
// Advisory. Deterministic. Never executes.

import { createHash, randomBytes } from "node:crypto";
import type {
  ArbitrationInput,
  ArbitrationRecord,
  ArbitrationVerdict,
  ArbiterAttribution,
  CandidateType,
  GateResult,
  CriterionResult,
  ProvenanceChain,
  ProvenanceStep,
} from "./types";
import {
  gate1_correctness,
  gate2_semanticPreservation,
  gate3_security,
  gate4_userObjective,
  gate5_projectAlignment,
  gate6_tradeoffs,
  composeCriteriaResults,
} from "./hierarchy";

const SCHEMA_VERSION = "v0.3.0";

const FORBIDDEN_VOCAB = [
  "bad code","good code","clean code","poor code","optimal code","better code","worse code",
  "maintainable","unmaintainable","recommended","should refactor","should split","should merge",
  "high complexity","low complexity","excessive","insufficient","poorly designed","well designed",
  "code smell","anti-pattern","best practice","worst practice",
  "quality_score","overall_quality","health_score","technical_debt","better_score","winner_score",
  "confidence_percent","superiority_score","confidence_score","code_grade","overall_grade",
  "aggregate_quality","weighted_total","87% better","92% confidence",
];
const FORBIDDEN_REGEXES = FORBIDDEN_VOCAB.map((w) => {
  const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return { word: w, re: new RegExp(`(?<![a-z0-9_-])${escaped}(?![a-z0-9_-])`, "i") };
});

function sha256Prefix(s: string): string { return createHash("sha256").update(s, "utf8").digest("hex").slice(0, 16); }
function newArbitrationId(): string { return "N3-DEC-" + Date.now().toString(36) + "-" + randomBytes(3).toString("hex"); }

export function attribution(): ArbiterAttribution {
  return {
    external_llm_used: false,
    deterministic: true,
    taught_by: "master_ai_engineer",
    role: "nex3_engineering_arbiter",
    authority: "arbitration_advisory",
    produced_by: "nex3_engineering_arbiter",
  };
}

export function walkForForbiddenVocab(obj: unknown): { hit: boolean; word?: string; where?: string } {
  const seen = new WeakSet<object>();
  const walk = (v: unknown, path: string): { hit: boolean; word?: string; where?: string } => {
    if (typeof v === "string") {
      for (const { word, re } of FORBIDDEN_REGEXES) if (re.test(v)) return { hit: true, word, where: path };
      return { hit: false };
    }
    if (Array.isArray(v)) {
      for (let i = 0; i < v.length; i++) { const r = walk(v[i], path + "[" + i + "]"); if (r.hit) return r; }
      return { hit: false };
    }
    if (v && typeof v === "object") {
      if (seen.has(v as object)) return { hit: false };
      seen.add(v as object);
      for (const [k, val] of Object.entries(v as object)) {
        const r = walk(val, path + "." + k);
        if (r.hit) return r;
      }
      return { hit: false };
    }
    return { hit: false };
  };
  return walk(obj, "$");
}

// ─── Verdict resolution ──────────────────────────────────────────
//
// Never forces a winner. Hierarchy:
//   1. LLM attempt → HOLD_INSUFFICIENT_EVIDENCE
//   2. Broken provenance (fabricated evidence_id) → HOLD_INSUFFICIENT_EVIDENCE
//   3. Unresolved objective choices → USER_CLARIFICATION_REQUIRED
//   4. Security gate elevates hold → HOLD_INSUFFICIENT_EVIDENCE
//   5. Correctness or semantic gates eliminate a candidate → cannot win
//   6. Zero survivors after load-bearing gates:
//        · if baseline_satisfies_objective → EXISTING_CODE_BETTER
//        · else → BOTH_INFERIOR (fits when no candidate + baseline can satisfy the objective)
//   7. Exactly one survivor → that candidate wins (subject to Minimum Necessary Complexity)
//   8. Multiple survivors:
//        · complexity + maintainability criterion advantage a single non-baseline candidate → that candidate wins
//        · baseline preserved via MNC when candidates provide no evidence-supported advantage → EXISTING_CODE_BETTER
//        · tie between two non-baseline candidates → HOLD_INSUFFICIENT_EVIDENCE (do NOT invent tie-breaker)

interface ResolveArgs {
  readonly gates: readonly GateResult[];
  readonly criteria: readonly CriterionResult[];
  readonly evidencePool: ReadonlySet<string>;
  readonly llmAttempt: boolean;
  readonly baselineSatisfies: boolean;
  readonly nex2Present: boolean;
  readonly unresolvedObjective: readonly string[];
}

function resolveVerdict(a: ResolveArgs): { verdict: ArbitrationVerdict; reason: string } {
  if (a.llmAttempt) {
    return { verdict: "HOLD_INSUFFICIENT_EVIDENCE", reason: "external LLM boundary violation flagged by caller · NEX3 refuses to arbitrate under a compromised evidence pipeline" };
  }

  // Verify all cited evidence_ids resolve in the pool.
  for (const g of a.gates) {
    for (const eid of g.evidence_ids) {
      if (!a.evidencePool.has(eid)) {
        return { verdict: "HOLD_INSUFFICIENT_EVIDENCE", reason: `gate ${g.gate_id} cited unresolved evidence_id "${eid}"` };
      }
    }
  }
  for (const c of a.criteria) {
    if (c.conclusion === "candidate_advantaged" || c.conclusion === "none_advantaged") {
      if (c.evidence_ids.length === 0 && c.conclusion === "candidate_advantaged") {
        return { verdict: "HOLD_INSUFFICIENT_EVIDENCE", reason: `criterion ${c.criterion} concluded candidate_advantaged without citing evidence` };
      }
      for (const eid of c.evidence_ids) {
        if (!a.evidencePool.has(eid)) {
          return { verdict: "HOLD_INSUFFICIENT_EVIDENCE", reason: `criterion ${c.criterion} cited unresolved evidence_id "${eid}"` };
        }
      }
    }
  }

  if (a.unresolvedObjective.length > 0) {
    return { verdict: "USER_CLARIFICATION_REQUIRED", reason: `authorised user objective contains unresolved choice(s): ${a.unresolvedObjective.join(" · ")}` };
  }

  // Load-bearing gates 1-4 · pull survivors from the last load-bearing gate.
  const load = a.gates.filter((g) => g.priority === "load_bearing");
  const last = load[load.length - 1];
  const survivors = last ? last.survivors : [];

  // If security gate returned no survivors from the affects_security_boundary path → HOLD
  const securityGate = a.gates.find((g) => g.gate_id === "security");
  if (securityGate && securityGate.eliminations.length > 0 && securityGate.survivors.length === 0) {
    return { verdict: "HOLD_INSUFFICIENT_EVIDENCE", reason: securityGate.reason };
  }

  if (survivors.length === 0) {
    if (a.baselineSatisfies) {
      return { verdict: "EXISTING_CODE_BETTER", reason: "no candidate survived load-bearing gates · baseline satisfies the authorised objective per work order" };
    }
    return { verdict: "BOTH_INFERIOR", reason: "no candidate survived load-bearing gates AND baseline_satisfies_objective is not asserted · design must be revisited" };
  }

  // Exactly one survivor · that candidate wins.
  if (survivors.length === 1) {
    const winner = survivors[0];
    return { verdict: candidateToVerdict(winner), reason: `only ${winner} survived the load-bearing gates` };
  }

  // Multiple survivors · look at advantage on complexity / maintainability among criteria.
  const advantageCounts: Record<CandidateType, number> = { baseline: 0, nex1: 0, nex2: 0 };
  const tradeoffCriteria = a.criteria.filter((c) => c.criterion === "complexity" || c.criterion === "maintainability");
  for (const c of tradeoffCriteria) {
    if (c.conclusion === "candidate_advantaged" && c.advantaged_candidate && survivors.includes(c.advantaged_candidate)) {
      advantageCounts[c.advantaged_candidate]++;
    }
  }
  const sortedAdvantage = (Object.entries(advantageCounts) as Array<[CandidateType, number]>)
    .filter(([c]) => survivors.includes(c))
    .sort((a, b) => b[1] - a[1]);
  const top = sortedAdvantage[0];
  const second = sortedAdvantage[1];
  if (top && top[1] > 0 && second && second[1] === top[1] && top[0] !== "baseline" && second[0] !== "baseline") {
    // Genuine tie between two non-baseline candidates · do NOT invent a tie-breaker.
    return { verdict: "HOLD_INSUFFICIENT_EVIDENCE", reason: `tradeoff evidence tied between ${top[0]} and ${second[0]} · deterministic tie-breaker is not authorised in Phase 4` };
  }
  if (top && top[1] > 0) {
    // Minimum Necessary Complexity: prefer baseline when it is tied at the top or has no measured disadvantage.
    if (top[0] === "baseline") {
      return { verdict: "EXISTING_CODE_BETTER", reason: "engineering trade-offs advantage baseline · Minimum Necessary Complexity preserved" };
    }
    return { verdict: candidateToVerdict(top[0]), reason: `${top[0]} advantaged on ${tradeoffCriteria.length} decidable trade-off criteria (advantage count=${top[1]})` };
  }

  // No trade-off advantage established · Minimum Necessary Complexity prefers baseline when it survived.
  if (survivors.includes("baseline")) {
    return { verdict: "EXISTING_CODE_BETTER", reason: "no candidate established a trade-off advantage over baseline · Minimum Necessary Complexity preserves existing code" };
  }
  // Only non-baseline survivors with no advantage · HOLD rather than manufacture a winner.
  return { verdict: "HOLD_INSUFFICIENT_EVIDENCE", reason: `surviving candidates ${survivors.join(", ")} did not establish a trade-off advantage on any decidable criterion` };
}

function candidateToVerdict(c: CandidateType): ArbitrationVerdict {
  if (c === "baseline") return "EXISTING_CODE_BETTER";
  if (c === "nex1") return "NEX1_BETTER";
  return "NEX2_BETTER";
}

// ─── Provenance chain ────────────────────────────────────────────

function buildProvenance(arbitration_id: string, input: ArbitrationInput, gates: readonly GateResult[], criteria: readonly CriterionResult[]): ProvenanceChain {
  const steps: ProvenanceStep[] = [];
  const broken: string[] = [];

  const evById = new Map((input.evidence_records ?? []).map((r) => [r.evidence_id, r]));
  const chById = new Map<string, any>();
  for (const m of input.code_health_baseline ?? []) chById.set(m.metric_id, m);
  for (const m of input.code_health_nex1     ?? []) chById.set(m.metric_id, m);
  for (const m of input.code_health_nex2     ?? []) chById.set(m.metric_id, m);

  // arbitration root
  steps.push({
    step_kind: "arbitration",
    step_id: "arbitration:" + arbitration_id,
    detail: { arbitration_id, work_order_id: input.work_order.work_order_id },
    next_step_id: "verdict:" + arbitration_id,
  });
  steps.push({
    step_kind: "verdict",
    step_id: "verdict:" + arbitration_id,
    detail: { deferred_until_resolution: true },
    next_step_id: null,
  });

  const addEvidenceStepsFor = (eid: string, parentId: string) => {
    const evPtr = "evidence_pointer:" + eid;
    (steps[steps.length - 1] as any).next_step_id = evPtr;
    steps.push({ step_kind: "evidence_pointer", step_id: evPtr, detail: { evidence_id: eid, from: parentId }, next_step_id: null });
    const evRec = evById.get(eid);
    const chRec = chById.get(eid);
    if (evRec) {
      const evStep = "evidence_record:" + eid;
      (steps[steps.length - 1] as any).next_step_id = evStep;
      steps.push({ step_kind: "evidence_record", step_id: evStep, detail: { evidence_id: eid, measurement_type: evRec.measurement_type, state: evRec.state, candidate_id: evRec.candidate_id }, next_step_id: null });
      if (evRec.source_hashes.length > 0) {
        const shStep = "source_hash:" + evRec.source_hashes[0];
        (steps[steps.length - 1] as any).next_step_id = shStep;
        steps.push({ step_kind: "source_hash", step_id: shStep, detail: { source_hashes: evRec.source_hashes }, next_step_id: null });
      }
      if (evRec.tool) {
        const toolStep = "tool:" + evRec.tool + "@" + (evRec.tool_version ?? "?");
        (steps[steps.length - 1] as any).next_step_id = toolStep;
        steps.push({ step_kind: "tool", step_id: toolStep, detail: { tool: evRec.tool, tool_version: evRec.tool_version }, next_step_id: null });
      }
      if (evRec.methodology) {
        const mStep = "methodology:" + sha256Prefix(evRec.methodology);
        (steps[steps.length - 1] as any).next_step_id = mStep;
        steps.push({ step_kind: "methodology", step_id: mStep, detail: { methodology: evRec.methodology }, next_step_id: null });
      }
      const rStep = "reproducibility:" + eid;
      (steps[steps.length - 1] as any).next_step_id = rStep;
      steps.push({ step_kind: "reproducibility", step_id: rStep, detail: { deterministic: true, external_llm_used: false, recorded_at: evRec.recorded_at ?? null }, next_step_id: null });
    } else if (chRec) {
      const evStep = "evidence_record:" + eid;
      (steps[steps.length - 1] as any).next_step_id = evStep;
      steps.push({ step_kind: "evidence_record", step_id: evStep, detail: { code_health_metric_id: eid, kind: chRec.kind, state: chRec.state }, next_step_id: null });
      const shStep = "source_hash:" + chRec.source_hash;
      (steps[steps.length - 1] as any).next_step_id = shStep;
      steps.push({ step_kind: "source_hash", step_id: shStep, detail: { source_hash: chRec.source_hash, source_path: chRec.source_path }, next_step_id: null });
    } else if (input.project_architecture && (eid === input.project_architecture.report_id || eid === "project_architecture")) {
      const evStep = "evidence_record:" + eid;
      (steps[steps.length - 1] as any).next_step_id = evStep;
      steps.push({ step_kind: "evidence_record", step_id: evStep, detail: { source: "project_architecture", version: input.project_architecture.project_architecture_version, report_id: input.project_architecture.report_id }, next_step_id: null });
    } else if (input.project_profile && eid === input.project_profile.profile_id) {
      const evStep = "evidence_record:" + eid;
      (steps[steps.length - 1] as any).next_step_id = evStep;
      steps.push({ step_kind: "evidence_record", step_id: evStep, detail: { source: "project_profile", profile_id: input.project_profile.profile_id }, next_step_id: null });
    } else {
      broken.push(`evidence_pointer → evidence_record · evidence_id "${eid}" not found in supplied pool`);
    }
  };

  for (const g of gates) {
    if (g.evidence_ids.length === 0 && g.eliminations.length === 0) continue;
    const cStep = "claim:" + arbitration_id + ":gate:" + g.gate_id;
    steps.push({ step_kind: "claim", step_id: cStep, detail: { gate: g.gate_id, priority: g.priority, reason: g.reason, survivors: g.survivors }, next_step_id: null });
    for (const eid of g.evidence_ids) addEvidenceStepsFor(eid, cStep);
  }
  for (const c of criteria) {
    if (c.conclusion !== "candidate_advantaged" && c.conclusion !== "none_advantaged") continue;
    const cStep = "criterion:" + arbitration_id + ":" + c.criterion;
    steps.push({ step_kind: "criterion", step_id: cStep, detail: { criterion: c.criterion, conclusion: c.conclusion, advantaged_candidate: c.advantaged_candidate, reason: c.reason }, next_step_id: null });
    for (const eid of c.evidence_ids) addEvidenceStepsFor(eid, cStep);
  }
  const integrity = sha256Prefix(steps.map((s) => s.step_kind + "|" + s.step_id).join("→"));
  return {
    requested_id: arbitration_id,
    steps,
    fully_resolvable: broken.length === 0,
    broken_links: broken,
    chain_integrity_hash: integrity,
  };
}

// ─── Public API ──────────────────────────────────────────────────

export function performArbitration(input: ArbitrationInput): ArbitrationRecord {
  // Build the gate chain in order.
  const g1 = gate1_correctness(input);
  const g2 = gate2_semanticPreservation(input, g1.survivors);
  const g3 = gate3_security(input, g2.survivors);
  const g4 = gate4_userObjective(input, g3.survivors);
  const g5 = gate5_projectAlignment(input, g4.survivors);
  const g6 = gate6_tradeoffs(input, g5.survivors);
  const gates = [g1, g2, g3, g4, g5, g6];

  const criteria = composeCriteriaResults(input);

  // Available evidence pool
  const pool = new Set<string>();
  for (const r of input.evidence_records ?? []) pool.add(r.evidence_id);
  for (const m of input.code_health_baseline ?? []) pool.add(m.metric_id);
  for (const m of input.code_health_nex1     ?? []) pool.add(m.metric_id);
  for (const m of input.code_health_nex2     ?? []) pool.add(m.metric_id);
  if (input.project_architecture?.report_id) pool.add(input.project_architecture.report_id);
  pool.add("project_architecture");
  if (input.project_profile?.profile_id) pool.add(input.project_profile.profile_id);

  const resolved = resolveVerdict({
    gates,
    criteria,
    evidencePool: pool,
    llmAttempt: input.reject_llm_attempt === true,
    baselineSatisfies: input.work_order.baseline_satisfies_objective === true,
    nex2Present: input.nex2_candidate != null,
    unresolvedObjective: input.work_order.unresolved_objective_choices ?? [],
  });

  const arbitration_id = newArbitrationId();
  const provenance_chain = buildProvenance(arbitration_id, input, gates, criteria);

  let verdict = resolved.verdict;
  let verdict_reason = resolved.reason;
  if (!provenance_chain.fully_resolvable && verdict !== "HOLD_INSUFFICIENT_EVIDENCE" && verdict !== "USER_CLARIFICATION_REQUIRED") {
    verdict = "HOLD_INSUFFICIENT_EVIDENCE";
    verdict_reason = "provenance chain broken · " + provenance_chain.broken_links.join(" · ");
  }

  const cited_evidence_ids = Array.from(new Set([
    ...gates.flatMap((g) => g.evidence_ids),
    ...criteria.flatMap((c) => c.evidence_ids),
  ]));

  const surviving_candidates = gates.filter((g) => g.priority === "load_bearing").slice(-1)[0]?.survivors ?? [];
  const eliminated_candidates = gates.flatMap((g) => g.eliminations.map((e) => ({
    candidate: e.candidate,
    gate_id: g.gate_id,
    reason: e.reason,
    evidence_ids: e.evidence_ids,
  })));

  const candidates = [input.baseline_candidate, input.nex1_candidate];
  if (input.nex2_candidate) candidates.push(input.nex2_candidate);

  const wo = input.work_order;
  const record: ArbitrationRecord = {
    record_type: "NEX3_ARBITRATION",
    arbitration_id,
    schema_version: SCHEMA_VERSION,
    work_order_id: wo.work_order_id,
    baseline_candidate_id: input.baseline_candidate.candidate_id,
    nex1_candidate_id: input.nex1_candidate.candidate_id,
    nex2_candidate_id: input.nex2_candidate?.candidate_id ?? null,
    candidates,
    gates_evaluated: gates,
    surviving_candidates,
    eliminated_candidates,
    criteria_results: criteria,
    cited_evidence_ids,
    tradeoffs: [],  // v0.3.0 emits an empty list · trade-offs are captured per-criterion and are consumable from criteria_results
    unresolved_questions: [
      ...(criteria.find((c) => c.criterion === "user_objective_alignment")?.conclusion === "insufficient_evidence" ? ["user_objective was not supplied"] : []),
      ...(criteria.find((c) => c.criterion === "security")?.conclusion === "not_authoritatively_available" ? ["security evidence subsystem does not yet exist"] : []),
      ...(criteria.find((c) => c.criterion === "performance")?.conclusion === "not_authoritatively_available" ? ["performance evidence subsystem does not yet exist"] : []),
      ...(criteria.find((c) => c.criterion === "testability")?.conclusion === "not_authoritatively_available" ? ["code_health.test_relationship remains NOT_MEASURED at Phase 2C"] : []),
    ],
    objective_alignment: {
      user_objective: wo.user_objective ?? "",
      unresolved_objective_choices: wo.unresolved_objective_choices ?? [],
      deterministic_outcome: (wo.unresolved_objective_choices?.length ?? 0) > 0
        ? "unresolved_choice_present"
        : wo.user_objective ? "objective_recorded" : "objective_absent",
    },
    verdict,
    verdict_reason,
    provenance_chain,
    authorisation: false,
    execution: false,
    authority_boundary: "arbitration_advisory_until_founder_authorises",
    limitations: "NEX3 v0.3.0 · advisory only · does not modify · does not execute · does not merge · does not authorise · security and performance criteria are not_authoritatively_available at Phase 4 · testability requires code_health.test_relationship which is NOT_MEASURED · user_objective adjudicator not yet built · change_risk reports raw fan_out span only · Minimum Necessary Complexity preserved · LAB and Standards Feed remain HOLD",
    at: new Date().toISOString(),
    attribution: attribution(),
  };

  // Constitutional guard: forbidden vocabulary anywhere → HOLD
  const chk = walkForForbiddenVocab(record);
  if (chk.hit) {
    return {
      ...record,
      verdict: "HOLD_INSUFFICIENT_EVIDENCE",
      verdict_reason: `forbidden vocabulary "${chk.word}" detected in output at ${chk.where} · NEX3 refuses to publish an arbitration containing judgement vocabulary`,
    };
  }
  return record;
}
