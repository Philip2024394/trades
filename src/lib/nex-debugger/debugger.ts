// src/lib/nex-debugger/debugger.ts
//
// NEX Debugger orchestrator · performDiagnosis().
// Deterministic. No LLM. No network. Never mutates the repository.
//
// Constitutional purpose (locked C-3, C-4, C-5):
//   Find reproducible causal explanations for observed software failures
//   without claiming certainty beyond the evidence.
//
// Six ordinal outcomes only:
//   REPRODUCED · ROOT_CAUSE_SUPPORTED · ROOT_CAUSE_PLAUSIBLE ·
//   ROOT_CAUSE_UNRESOLVED · NOT_REPRODUCIBLE · INSUFFICIENT_EVIDENCE
//
// ROOT_CAUSE_UNRESOLVED and NOT_REPRODUCIBLE are FIRST-CLASS successes.

import { createHash, randomBytes } from "node:crypto";
import type {
  DebuggerEvidence,
  DebuggerOutcome,
  DiagnosisInput,
  RootCauseCandidate,
  DebuggerAttribution,
  ReproducibilityInformation,
  ConfidenceClass,
} from "./types";
import { getFixture, runReproduction, type ReproductionObservation } from "./reproducer";
import { computeSBFL } from "./sbfl";
import { astDiff } from "./ast-diff";
import { buildTimeline } from "./timeline";
import { ddmin } from "./ddmin";

const SCHEMA_VERSION = "v0.1.0";

const FORBIDDEN_VOCAB = [
  "confidence_percent","confidence_score","probably","likely_87","likely_92","0.87 confidence","73% probability",
  "quality_score","overall_quality","health_score","technical_debt","better_score","winner_score",
  "superiority_score","code_grade","overall_grade","aggregate_quality","weighted_total",
  "87% better","92% confidence","root_cause_score",
  "bad code","good code","clean code","poor code","optimal code","better code","worse code",
  "maintainable","unmaintainable","recommended","should refactor","should split","should merge",
  "high complexity","low complexity","excessive","insufficient","poorly designed","well designed",
  "code smell","anti-pattern","best practice","worst practice",
];
const FORBIDDEN_REGEXES = FORBIDDEN_VOCAB.map((w) => {
  const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return { word: w, re: new RegExp(`(?<![a-z0-9_-])${escaped}(?![a-z0-9_-])`, "i") };
});

function sha256Prefix(s: string): string { return createHash("sha256").update(s).digest("hex").slice(0, 16); }

export function attribution(): DebuggerAttribution {
  return {
    external_llm_used: false,
    deterministic: true,
    taught_by: "master_ai_engineer",
    role: "nex_debugger_evidence_specialist",
    authority: "descriptive_read_only",
    produced_by: "nex_debugger_evidence_specialist",
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

function makeReproducibility(seed: string): ReproducibilityInformation {
  const parts = ["node=" + process.version, "platform=" + process.platform, "arch=" + process.arch, "seed=" + seed];
  return {
    command: "nex-debugger.diagnose · deterministic",
    cwd: process.cwd(),
    env_fingerprint: sha256Prefix(parts.join("|")),
    node_version: process.version,
    platform: process.platform,
    seed,
  };
}

export function performDiagnosis(input: DiagnosisInput): DebuggerEvidence {
  const session_id = input.session_id ?? "DBG-" + Date.now().toString(36) + "-" + randomBytes(3).toString("hex");
  const seed = input.seed ?? "seed-" + sha256Prefix(JSON.stringify(input.failing_input));

  // C-9: fail-closed on external LLM boundary breach
  if (input.reject_llm_attempt === true) {
    return emit({
      session_id,
      outcome: "INSUFFICIENT_EVIDENCE",
      outcome_reason: "external LLM boundary violation flagged by caller · NEX Debugger refuses to proceed under a compromised evidence pipeline",
      seed,
      reproduction: { attempted: false, reproduced: false, attempts: 0, seed, deterministic: true },
      minimised_repro: null,
      failure_timeline: null,
      sbfl_result: null,
      ast_diff: null,
      root_cause_candidates: [],
      authoritative_top_candidate: null,
      evidence_pool_ids: [],
    });
  }

  const fx = getFixture(input.reproduction_fixture_id);
  if (!fx) {
    return emit({
      session_id,
      outcome: "INSUFFICIENT_EVIDENCE",
      outcome_reason: `reproduction_fixture_id "${input.reproduction_fixture_id}" is not registered · specialist cannot proceed responsibly`,
      seed,
      reproduction: { attempted: false, reproduced: false, attempts: 0, seed, deterministic: true },
      minimised_repro: null, failure_timeline: null, sbfl_result: null, ast_diff: null,
      root_cause_candidates: [], authoritative_top_candidate: null, evidence_pool_ids: [],
    });
  }

  const reproA = runReproduction(input.reproduction_fixture_id, input.failing_input, seed, 3);
  const reproB = runReproduction(input.reproduction_fixture_id, input.failing_input, seed, 1);
  const first_run_hash = sha256Prefix(JSON.stringify(reproA.observation ?? {}));
  const second_run_hash = sha256Prefix(JSON.stringify(reproB.observation ?? {}));

  // NOT_REPRODUCIBLE branch · first-class success
  if (!reproA.reproduced) {
    return emit({
      session_id,
      outcome: "NOT_REPRODUCIBLE",
      outcome_reason: `attempted ${reproA.attempts} deterministic seeded runs of fixture ${input.reproduction_fixture_id} · failure did not occur · this is an honest verdict, not a specialist failure`,
      seed,
      reproduction: { attempted: true, reproduced: false, attempts: reproA.attempts, seed, deterministic: reproA.deterministic },
      minimised_repro: null, failure_timeline: null, sbfl_result: null, ast_diff: null,
      root_cause_candidates: [], authoritative_top_candidate: null, evidence_pool_ids: [],
    });
  }

  // Reproduced · build the timeline
  const timeline = buildTimeline({
    session_id, input: input.failing_input, seed,
    observation: reproA.observation as ReproductionObservation,
    expected_timeline: input.expected_timeline?.steps,
    first_run_hash, second_run_hash,
  });

  // ddmin over the ops (as a demonstration of reduction · optional evidence)
  const ops = reproA.observation?.step_operations ?? [];
  let minimised = null as null | { present: true; size_bytes: number; reduction_ratio: number; ddmin_iterations: number; minimised_input_hash: string };
  if (ops.length >= 2) {
    // Oracle: for a subset of ops, does the fixture still fail?
    const oracle = (candidate: readonly string[]): "FAIL" | "PASS" | "UNRESOLVED" => {
      const run = fx.run({ ops: candidate, base: input.failing_input }, seed);
      if (run.failed) return "FAIL";
      return "PASS";
    };
    const res = ddmin(ops, oracle);
    if (res.deterministic && res.minimised.length > 0 && res.minimised.length < ops.length) {
      const originalSize = JSON.stringify(ops).length;
      const minSize = JSON.stringify(res.minimised).length;
      minimised = {
        present: true,
        size_bytes: minSize,
        reduction_ratio: originalSize === 0 ? 0 : (originalSize - minSize) / originalSize,
        ddmin_iterations: res.iterations,
        minimised_input_hash: sha256Prefix(JSON.stringify(res.minimised)),
      };
    }
  }

  // SBFL if coverage supplied
  const sbfl_result = input.coverage && input.coverage.length > 0 ? computeSBFL(input.coverage, "ochiai") : null;

  // AST-diff if baseline+candidate supplied
  const ast_diff_out = input.baseline_sources && input.candidate_sources ? astDiff(input.baseline_sources, input.candidate_sources) : null;

  // Root-cause candidate resolution — never invents evidence · never uses percentages
  const candidates: RootCauseCandidate[] = [];
  const evidence_pool_ids: string[] = [];
  if (sbfl_result?.evidence_id) evidence_pool_ids.push(sbfl_result.evidence_id);
  if (ast_diff_out?.evidence_id) evidence_pool_ids.push(ast_diff_out.evidence_id);

  const symptomFrame = { file: (timeline.failure.observed_output as any)?.file ?? "<unknown>", line: (timeline.failure.observed_output as any)?.line ?? 0 };

  let outcome: DebuggerOutcome = "REPRODUCED";
  let authoritative_top: RootCauseCandidate | null = null;
  let confidence_class: ConfidenceClass = "insufficient";
  let outcome_reason = "failure reproduced deterministically · root-cause analysis not yet reached a determination";

  if (sbfl_result && sbfl_result.top_candidate && ast_diff_out) {
    // Intersection check: is the SBFL top-ranked line inside any churned AST region for that file?
    const top = sbfl_result.top_candidate;
    const intersect = ast_diff_out.churned_nodes.some((n) =>
      n.path === top.path && n.line_start <= top.line && n.line_end >= top.line
    );
    const candidate: RootCauseCandidate = {
      candidate_id: "RCC-" + sha256Prefix(top.path + ":" + top.line),
      location: { path: top.path, line: top.line },
      evidence_ids: [sbfl_result.evidence_id, ast_diff_out.evidence_id],
      symptom_frame: symptomFrame,
      confidence_class: intersect ? "strong" : "plausible",
    };
    candidates.push(candidate);
    if (intersect) {
      outcome = "ROOT_CAUSE_SUPPORTED";
      authoritative_top = candidate;
      confidence_class = "strong";
      outcome_reason = `SBFL ochiai top candidate (${top.path}:${top.line}) intersects AST-diff churn set · symptom_frame recorded separately at ${symptomFrame.file}:${symptomFrame.line}`;
    } else {
      outcome = "ROOT_CAUSE_PLAUSIBLE";
      authoritative_top = candidate;
      confidence_class = "plausible";
      outcome_reason = `SBFL ochiai has a top candidate at ${top.path}:${top.line} but it does not intersect the AST-diff churn set · plausible tier only`;
    }
  } else if (sbfl_result && sbfl_result.top_candidate) {
    // SBFL alone · PLAUSIBLE
    const top = sbfl_result.top_candidate;
    const candidate: RootCauseCandidate = {
      candidate_id: "RCC-" + sha256Prefix(top.path + ":" + top.line),
      location: { path: top.path, line: top.line },
      evidence_ids: [sbfl_result.evidence_id],
      symptom_frame: symptomFrame,
      confidence_class: "plausible",
    };
    candidates.push(candidate);
    outcome = "ROOT_CAUSE_PLAUSIBLE";
    authoritative_top = candidate;
    outcome_reason = `SBFL ochiai identifies ${top.path}:${top.line} · no AST-diff evidence supplied · plausible tier only`;
  } else if (sbfl_result && !sbfl_result.top_candidate) {
    // Reproduced but SBFL yielded no candidate · UNRESOLVED
    outcome = "ROOT_CAUSE_UNRESOLVED";
    outcome_reason = "failure reproduced · SBFL ochiai produced no suspicious location · candidate causes remain unresolved · this is an honest verdict, not a specialist failure";
  } else {
    // Reproduced but no SBFL supplied
    outcome = "REPRODUCED";
    outcome_reason = "failure reproduced deterministically · no coverage matrix supplied · root-cause not determined";
  }

  return emit({
    session_id,
    outcome,
    outcome_reason,
    seed,
    reproduction: { attempted: true, reproduced: true, attempts: reproA.attempts, seed, deterministic: reproA.deterministic },
    minimised_repro: minimised,
    failure_timeline: timeline,
    sbfl_result,
    ast_diff: ast_diff_out,
    root_cause_candidates: candidates,
    authoritative_top_candidate: authoritative_top,
    evidence_pool_ids,
  });
}

// ─── Emitter ─────────────────────────────────────────────────────

interface EmitArgs {
  session_id: string;
  outcome: DebuggerOutcome;
  outcome_reason: string;
  seed: string;
  reproduction: DebuggerEvidence["reproduction"];
  minimised_repro: DebuggerEvidence["minimised_repro"];
  failure_timeline: DebuggerEvidence["failure_timeline"];
  sbfl_result: DebuggerEvidence["sbfl_result"];
  ast_diff: DebuggerEvidence["ast_diff"];
  root_cause_candidates: readonly RootCauseCandidate[];
  authoritative_top_candidate: RootCauseCandidate | null;
  evidence_pool_ids: readonly string[];
}

function emit(a: EmitArgs): DebuggerEvidence {
  const reproInfo = makeReproducibility(a.seed);

  const detA = a.failure_timeline?.determinism_witness ?? { first_run_hash: "", second_run_hash: "", identical: true };

  const record: DebuggerEvidence = {
    record_type: "DEBUGGER_EVIDENCE",
    session_id: a.session_id,
    schema_version: SCHEMA_VERSION,
    outcome: a.outcome,
    outcome_reason: a.outcome_reason,
    reproduction: a.reproduction,
    minimised_repro: a.minimised_repro,
    failure_timeline: a.failure_timeline,
    sbfl_result: a.sbfl_result,
    ast_diff: a.ast_diff,
    root_cause_candidates: a.root_cause_candidates,
    authoritative_top_candidate: a.authoritative_top_candidate,
    evidence_pool_ids: Array.from(a.evidence_pool_ids),
    reproducibility_information: reproInfo,
    byte_identity_witness: { before_hash: "N/A · input-only", after_hash: "N/A · input-only", drift_count: 0, drifted: [] },
    determinism_witness: detA,
    limitations: "v0.1.0 · fixture-based reproduction · ddmin over ops · SBFL ochiai/tarantula/dstar on supplied coverage · AST-diff via TypeScript compiler API · no runtime execution of arbitrary user code · no git-bisect in-process at v0 (deterministic simulator only) · ROOT_CAUSE_UNRESOLVED and NOT_REPRODUCIBLE are first-class outcomes",
    authorisation: false,
    execution: false,
    authority_boundary: "evidence_producer_only",
    attribution: attribution(),
    at: new Date().toISOString(),
  };

  // Constitutional guard: forbidden vocabulary anywhere → coerce outcome
  const chk = walkForForbiddenVocab(record);
  if (chk.hit) {
    return {
      ...record,
      outcome: "INSUFFICIENT_EVIDENCE",
      outcome_reason: `forbidden vocabulary "${chk.word}" detected in output at ${chk.where} · specialist refuses to publish evidence containing judgement vocabulary`,
    };
  }
  return record;
}
