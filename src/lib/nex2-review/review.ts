// src/lib/nex2-review/review.ts
//
// NEX2 · advisory evidence review orchestrator.
// authored_by = master_ai_engineer · founder-authorised 2026-09-12
//
// This file composes DimensionObservations into a review, resolves the outcome
// per the founder's five-outcome rule (never forcing a winner), and produces
// the provenance chain.
//
// It NEVER executes · NEVER mutates the repository · NEVER writes files.

import { createHash, randomBytes } from "node:crypto";
import type {
  ReviewInput,
  NEX2Review,
  DimensionObservation,
  ReviewOutcome,
  ReviewAttribution,
  ProvenanceChain,
  ProvenanceStep,
  AlternativeCandidate,
} from "./types";
import { evaluateAllDimensions } from "./dimensions";

const SCHEMA_VERSION = "v0.2.0";

// Forbidden vocabulary applies to every string field the review emits.
// Reused from Code Health · extended per founder's Phase 3 spec.
const FORBIDDEN_VOCAB = [
  "bad code","good code","clean code","poor code","optimal code","better code","worse code",
  "maintainable","unmaintainable","recommended","should refactor","should split","should merge",
  "high complexity","low complexity","excessive","insufficient","poorly designed","well designed",
  "code smell","anti-pattern","best practice","worst practice",
  "quality_score","overall_quality","health_score","technical_debt","better_score","winner_score",
  "confidence_percent","superiority_score","confidence_score","code_grade","overall_grade",
];

function sha256Prefix(s: string): string { return createHash("sha256").update(s, "utf8").digest("hex").slice(0, 16); }
function newReviewId(): string { return "N2-REV-" + Date.now().toString(36) + "-" + randomBytes(3).toString("hex"); }
function newProvenanceId(prefix: string): string { return prefix + ":" + randomBytes(3).toString("hex"); }

export function attribution(): ReviewAttribution {
  return {
    external_llm_used: false,
    deterministic: true,
    taught_by: "master_ai_engineer",
    role: "nex2_advisory_review",
    authority: "advisory_review_only",
    produced_by: "nex2_advisory_review",
  };
}

// ─── Outcome resolution ──────────────────────────────────────────
//
// Never forces a winner.
//
//   any regression on correctness or semantic_preservation with evidence         → PROPOSE_ALTERNATIVE or BOTH_NEED_REVISION
//   all decidable dimensions equal or improvement · none regression              → ACCEPT_NEX1
//   any regression AND overall improvements elsewhere with cited evidence        → PROPOSE_ALTERNATIVE
//   decidable evidence is entirely absent on gate dimensions                     → REQUEST_EVIDENCE
//   provenance chain broken · fabricated evidence · fail-fast conditions         → HOLD

interface ResolveArgs {
  readonly observations: readonly DimensionObservation[];
  readonly evidenceIdsAvailable: ReadonlySet<string>;
  readonly llmAttemptFlag: boolean;
  readonly hasAlternative: boolean;
}

function resolveOutcome(a: ResolveArgs): { outcome: ReviewOutcome; reason: string } {
  if (a.llmAttemptFlag) {
    return { outcome: "HOLD", reason: "external LLM boundary violation flagged by caller · NEX2 refuses to proceed under a compromised evidence pipeline" };
  }

  const obs = a.observations;
  const gate = obs.filter((o) => o.dimension === "correctness" || o.dimension === "semantic_preservation");
  const decidable = obs.filter((o) => o.conclusion === "regression" || o.conclusion === "improvement" || o.conclusion === "equal");
  const regressions = obs.filter((o) => o.conclusion === "regression");
  const improvements = obs.filter((o) => o.conclusion === "improvement");
  const evidenceGaps = obs.filter((o) => o.conclusion === "insufficient_evidence").map((o) => o.dimension);

  // Provenance integrity: every regression / improvement / equal MUST cite ≥1 evidence_id present in the supplied pool.
  for (const o of decidable) {
    if (o.evidence_ids.length === 0) {
      return { outcome: "HOLD", reason: `dimension ${o.dimension} concluded ${o.conclusion} without citing evidence · MUST refuse` };
    }
    for (const eid of o.evidence_ids) {
      if (!a.evidenceIdsAvailable.has(eid)) {
        return { outcome: "HOLD", reason: `dimension ${o.dimension} cited unresolved evidence_id "${eid}" · MUST refuse` };
      }
    }
  }

  const gateRegression = gate.some((o) => o.conclusion === "regression");
  const gateInsufficient = gate.every((o) => o.conclusion === "insufficient_evidence");

  if (gateInsufficient) {
    return { outcome: "REQUEST_EVIDENCE", reason: `gate dimensions (correctness · semantic_preservation) both lack sufficient evidence · missing: ${evidenceGaps.join(", ") || "none"}` };
  }

  if (gateRegression) {
    // NEX1 regresses correctness or semantics. If an alternative is present or constructible → PROPOSE_ALTERNATIVE, otherwise BOTH_NEED_REVISION.
    if (a.hasAlternative) {
      return { outcome: "PROPOSE_ALTERNATIVE", reason: "gate regression on correctness/semantics · alternative candidate proposed for founder / NEX3 disposition" };
    }
    return { outcome: "BOTH_NEED_REVISION", reason: "gate regression on correctness/semantics · no defensible alternative available from current evidence · design must revisit" };
  }

  if (regressions.length > 0 && !gateRegression) {
    // Non-gate regressions (complexity / maintainability / change_risk). Advisory outcome depends on whether NEX2 has an alternative.
    if (a.hasAlternative) {
      return { outcome: "PROPOSE_ALTERNATIVE", reason: `non-gate regression on ${regressions.map((r) => r.dimension).join(", ")} · alternative candidate proposed` };
    }
    return { outcome: "PROPOSE_ALTERNATIVE", reason: `non-gate regression on ${regressions.map((r) => r.dimension).join(", ")} · advisory alternative-candidate scaffold proposed` };
  }

  if (decidable.length === 0) {
    return { outcome: "REQUEST_EVIDENCE", reason: `no dimension has decidable evidence · missing: ${evidenceGaps.join(", ") || "all dimensions"}` };
  }

  // All decidable are equal / improvement · no regressions anywhere.
  const improvementList = improvements.map((i) => i.dimension);
  return {
    outcome: "ACCEPT_NEX1",
    reason: improvementList.length > 0
      ? `all decidable dimensions equal or improvement · improvements in ${improvementList.join(", ")}`
      : "all decidable dimensions equal · no regression observed",
  };
}

// ─── Alternative candidate producer ──────────────────────────────
//
// Emits a CANDIDATE ONLY. Never executed. authorisation=false. execution=false.

function buildAlternative(input: ReviewInput, observations: readonly DimensionObservation[]): AlternativeCandidate | null {
  const regressions = observations.filter((o) => o.conclusion === "regression");
  if (regressions.length === 0) return null;

  const scope = regressions.map((r) => r.dimension).join(", ");
  const requiredEvidence = new Set<string>();
  for (const r of regressions) {
    if (r.dimension === "correctness")           { requiredEvidence.add("evidence_engine.tests"); requiredEvidence.add("evidence_engine.compilation"); }
    if (r.dimension === "semantic_preservation") { requiredEvidence.add("evidence_engine.regression"); }
    if (r.dimension === "complexity")            { requiredEvidence.add("evidence_engine.complexity"); requiredEvidence.add("code_health.cyclomatic_complexity"); }
    if (r.dimension === "maintainability")       { requiredEvidence.add("code_health.duplication"); requiredEvidence.add("code_health.function_size"); }
    if (r.dimension === "change_risk")           { requiredEvidence.add("project_architecture.fan_out"); }
  }
  return {
    candidate_id: "cand_nex2_alt_" + sha256Prefix(input.nex1_candidate_id + ":" + scope).slice(0, 8),
    parent_work_order_id: input.work_order_id,
    parent_candidate_id: input.nex1_candidate_id,
    description: `NEX2 alternative-candidate scaffold to address observed regressions on: ${scope}`,
    scope,
    intended_change: `Preserve baseline behaviour where regressions are observed · scope=${scope}`,
    expected_effect: `Reduce or eliminate regression on ${scope} · retain PASSED state on evidence_engine.tests`,
    known_tradeoffs: "candidate-only scaffold · not a validated implementation · founder / NEX3 must adjudicate",
    required_evidence: Array.from(requiredEvidence),
    status: "candidate_only",
    authorisation: false,
    execution: false,
  };
}

// ─── Provenance chain builder ────────────────────────────────────

function buildProvenance(review_id: string, input: ReviewInput, observations: readonly DimensionObservation[]): ProvenanceChain {
  const steps: ProvenanceStep[] = [];
  const broken: string[] = [];

  const evidenceById = new Map((input.evidence_records ?? []).map((r) => [r.evidence_id, r]));
  const chIndex = new Map<string, { pool: "baseline" | "nex1" | "alternative"; rec: any }>();
  for (const m of input.code_health_baseline ?? []) chIndex.set(m.metric_id, { pool: "baseline", rec: m });
  for (const m of input.code_health_nex1     ?? []) chIndex.set(m.metric_id, { pool: "nex1",     rec: m });
  for (const m of input.code_health_alternative ?? []) chIndex.set(m.metric_id, { pool: "alternative", rec: m });

  // Step: review
  steps.push({
    step_kind: "review",
    step_id: "review:" + review_id,
    detail: { review_id, work_order_id: input.work_order_id },
    next_step_id: "claim:" + review_id,
  });

  // For each observation with cited evidence, add claim + evidence_pointer + evidence_record + source_hash + tool + methodology + reproducibility
  let nextId: string | null = "claim:" + review_id;
  for (const o of observations) {
    if (o.conclusion !== "regression" && o.conclusion !== "improvement" && o.conclusion !== "equal") continue;
    const claim_id = "claim:" + review_id + ":" + o.dimension;
    if (steps[steps.length - 1]) (steps[steps.length - 1] as any).next_step_id = claim_id;
    steps.push({
      step_kind: "claim",
      step_id: claim_id,
      detail: { dimension: o.dimension, conclusion: o.conclusion, reason: o.reason, evidence_ids: o.evidence_ids },
      next_step_id: null,
    });
    for (const eid of o.evidence_ids) {
      const evPtr = "evidence_pointer:" + eid;
      (steps[steps.length - 1] as any).next_step_id = evPtr;
      steps.push({
        step_kind: "evidence_pointer",
        step_id: evPtr,
        detail: { evidence_id: eid, dimension: o.dimension },
        next_step_id: null,
      });
      // Resolve evidence
      const evRec = evidenceById.get(eid);
      const chRec = chIndex.get(eid);
      if (evRec) {
        const evStep = "evidence_record:" + eid;
        (steps[steps.length - 1] as any).next_step_id = evStep;
        steps.push({
          step_kind: "evidence_record",
          step_id: evStep,
          detail: { evidence_id: eid, measurement_type: evRec.measurement_type, state: evRec.state, candidate_id: evRec.candidate_id },
          next_step_id: null,
        });
        if (evRec.source_hashes.length > 0) {
          const shStep = "source_hash:" + evRec.source_hashes[0];
          (steps[steps.length - 1] as any).next_step_id = shStep;
          steps.push({
            step_kind: "source_hash",
            step_id: shStep,
            detail: { source_hashes: evRec.source_hashes },
            next_step_id: null,
          });
        }
        if (evRec.tool) {
          const toolStep = "tool:" + evRec.tool + "@" + (evRec.tool_version ?? "?");
          (steps[steps.length - 1] as any).next_step_id = toolStep;
          steps.push({
            step_kind: "tool",
            step_id: toolStep,
            detail: { tool: evRec.tool, tool_version: evRec.tool_version },
            next_step_id: null,
          });
        }
        if (evRec.methodology) {
          const mStep = "methodology:" + sha256Prefix(evRec.methodology);
          (steps[steps.length - 1] as any).next_step_id = mStep;
          steps.push({
            step_kind: "methodology",
            step_id: mStep,
            detail: { methodology: evRec.methodology },
            next_step_id: null,
          });
        }
        const rStep = "reproducibility:" + eid;
        (steps[steps.length - 1] as any).next_step_id = rStep;
        steps.push({
          step_kind: "reproducibility",
          step_id: rStep,
          detail: { deterministic: true, external_llm_used: false, recorded_at: evRec.recorded_at ?? null },
          next_step_id: null,
        });
      } else if (chRec) {
        const evStep = "evidence_record:" + eid;
        (steps[steps.length - 1] as any).next_step_id = evStep;
        steps.push({
          step_kind: "evidence_record",
          step_id: evStep,
          detail: { code_health_metric_id: eid, kind: chRec.rec.kind, state: chRec.rec.state, pool: chRec.pool },
          next_step_id: null,
        });
        const shStep = "source_hash:" + chRec.rec.source_hash;
        (steps[steps.length - 1] as any).next_step_id = shStep;
        steps.push({
          step_kind: "source_hash",
          step_id: shStep,
          detail: { source_hash: chRec.rec.source_hash, source_path: chRec.rec.source_path },
          next_step_id: null,
        });
      } else if (input.project_architecture && (eid === input.project_architecture.report_id || eid === "project_architecture")) {
        const evStep = "evidence_record:" + eid;
        (steps[steps.length - 1] as any).next_step_id = evStep;
        steps.push({
          step_kind: "evidence_record",
          step_id: evStep,
          detail: { source: "project_architecture", version: input.project_architecture.project_architecture_version, report_id: input.project_architecture.report_id },
          next_step_id: null,
        });
      } else if (input.project_profile && eid === input.project_profile.profile_id) {
        const evStep = "evidence_record:" + eid;
        (steps[steps.length - 1] as any).next_step_id = evStep;
        steps.push({
          step_kind: "evidence_record",
          step_id: evStep,
          detail: { source: "project_profile", profile_id: input.project_profile.profile_id },
          next_step_id: null,
        });
      } else {
        broken.push(`evidence_pointer → evidence_record · evidence_id "${eid}" not found in supplied pool`);
      }
    }
  }
  const integrity = sha256Prefix(steps.map((s) => s.step_kind + "|" + s.step_id).join("→"));
  return {
    requested_id: review_id,
    steps,
    fully_resolvable: broken.length === 0,
    broken_links: broken,
    chain_integrity_hash: integrity,
  };
}

// ─── Forbidden vocabulary guard ──────────────────────────────────

// Compiled word-boundary regexes · a bare word like "insufficient" MUST NOT match
// inside a legitimate technical identifier like "insufficient_evidence".
const FORBIDDEN_REGEXES = FORBIDDEN_VOCAB.map((w) => {
  const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Boundary chars: anything NOT [a-z0-9_-] on either side.
  return { word: w, re: new RegExp(`(?<![a-z0-9_-])${escaped}(?![a-z0-9_-])`, "i") };
});

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

// ─── Public: performReview ───────────────────────────────────────

export function performReview(input: ReviewInput): NEX2Review {
  const observations = evaluateAllDimensions(input);

  // Compose available evidence-id pool (Evidence Engine + Code Health + PA + PP)
  const pool = new Set<string>();
  for (const r of input.evidence_records ?? []) pool.add(r.evidence_id);
  for (const m of input.code_health_baseline ?? []) pool.add(m.metric_id);
  for (const m of input.code_health_nex1     ?? []) pool.add(m.metric_id);
  for (const m of input.code_health_alternative ?? []) pool.add(m.metric_id);
  if (input.project_architecture?.report_id) pool.add(input.project_architecture.report_id);
  pool.add("project_architecture"); // fallback token permitted when no report_id
  if (input.project_profile?.profile_id) pool.add(input.project_profile.profile_id);

  const alternative = buildAlternative(input, observations);
  const outcomeResolution = resolveOutcome({
    observations,
    evidenceIdsAvailable: pool,
    llmAttemptFlag: input.reject_llm_attempt === true,
    hasAlternative: alternative !== null || input.alternative_candidate !== undefined,
  });

  const review_id = newReviewId();
  const provenance_chain = buildProvenance(review_id, input, observations);
  // Provenance broken → coerce outcome to HOLD (unless already HOLD/REQUEST_EVIDENCE)
  let outcome = outcomeResolution.outcome;
  let outcome_reason = outcomeResolution.reason;
  if (!provenance_chain.fully_resolvable && outcome !== "HOLD" && outcome !== "REQUEST_EVIDENCE") {
    outcome = "HOLD";
    outcome_reason = "provenance chain broken · " + provenance_chain.broken_links.join(" · ");
  }

  const cited_evidence_ids = Array.from(new Set(observations.flatMap((o) => o.evidence_ids)));

  const review: NEX2Review = {
    record_type: "NEX2_REVIEW",
    review_id,
    schema_version: SCHEMA_VERSION,
    work_order_id: input.work_order_id,
    baseline_candidate_id: input.baseline_candidate_id,
    nex1_candidate_id: input.nex1_candidate_id,
    alternative_candidate: input.alternative_candidate ?? alternative,
    user_objective: input.user_objective ?? null,
    at: new Date().toISOString(),
    dimension_observations: observations,
    cited_evidence_ids,
    provenance_chain,
    outcome,
    outcome_reason,
    authority_boundary: "advisory_review_only",
    limitations: "NEX2 v0.2.0 · advisory only · testability requires code_health.test_relationship (NOT_MEASURED at Phase 3) · security and performance have no authoritative NEX evidence subsystem · user_objective_alignment adjudicator not yet built · NEX2 does not execute · does not mutate · does not merge",
    attribution: attribution(),
  };

  // Constitutional guard: no forbidden vocabulary anywhere in the review output.
  const chk = walkForForbiddenVocab(review);
  if (chk.hit) {
    return {
      ...review,
      outcome: "HOLD",
      outcome_reason: `forbidden vocabulary "${chk.word}" detected in output at ${chk.where} · NEX2 refuses to publish a review containing judgement vocabulary`,
    };
  }
  return review;
}
