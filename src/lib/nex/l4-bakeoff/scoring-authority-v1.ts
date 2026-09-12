// src/lib/nex/l4-bakeoff/scoring-authority-v1.ts
//
// V.5.4.4 · HYBRID SCORING · authority types + case-to-authority partitioner
// Founder BEGIN V.5.4.4 · 2026-09-08
//
// Doctrinal source: doctrine_nex_v5_4_4_hybrid_scoring_2026_09_08.md
//   · Automated for objective
//   · Known-answer for facts
//   · Deterministic for safety
//   · Measured for latency/cost/reliability
//   · Human blind for subjective conversation
//   · NEVER LLM-as-judge as sole authority (FORBIDDEN)
//
// This module DOES NOT modify the V4 corpus (protected surface · anti-
// adaptive-benchmark-mod). Partition metadata is derived-per-call from
// existing case shape · never persisted into the corpus.
//
// Every authority scorer is a PURE function · never calls Ollama · never
// mutates state · never modifies the corpus.

import type {
  BenchmarkCase,
  EvaluationDimension,
} from "./types";

// ═══════════════════════════════════════════════════════════════════
// § A · AUTHORITY ENUM (closed set · adding requires code change)
// ═══════════════════════════════════════════════════════════════════

/** Five scoring authorities per doctrine. NO 6th ("llm_as_judge") · that
 *  authority is EXPLICITLY absent because doctrine forbids it as sole judge. */
export type ScoringAuthority =
  | "automated_deterministic"    // must_contain / must_not_contain / requires_tool_call / length constraints
  | "known_answer"               // Founder-authored reference-answer registry (external to corpus)
  | "safety_deterministic"       // refusal / uncertainty / injection-resistance / emergency-routing patterns
  | "measured_metric"            // latency / throughput / cost / reliability from RunProvenance + transcript
  | "human_blind_eval";          // subjective conversation quality · warmth · UX invariants

/** Which authority a case will be scored by. Assigned per-call by the
 *  partitioner · never written into the corpus. */
export type CaseAuthorityAssignment = {
  case_id: string;
  dimension: EvaluationDimension;
  authority: ScoringAuthority;
  reason: string;                // deterministic explanation of why this authority was picked
};

// ═══════════════════════════════════════════════════════════════════
// § B · DIMENSION → AUTHORITY DEFAULTS (fallback when case has no rubric)
// ═══════════════════════════════════════════════════════════════════
//
// Some dimensions have an obvious authority regardless of rubric shape:
//   · latency / throughput / cost / reliability / offline_local_capability
//     → measured_metric (data comes from provenance + transcript · not text)
//   · safety / adversarial_robustness / prompt_injection_resistance
//     → safety_deterministic when rubric is thin (uses generic patterns)
//   · natural_conversation / personalization / memory_integration
//     → human_blind_eval when rubric is thin (subjective by nature)
// All other dimensions fall to human_blind_eval by default when a case has
// no automated criteria · because guessing an automated verdict for a
// subjective response is worse than admitting UNKNOWN.

const MEASURED_METRIC_DIMENSIONS = new Set<EvaluationDimension>([
  "latency",
  "throughput",
  "cost",
  "reliability",
  "offline_local_capability",
]);

const SAFETY_DETERMINISTIC_DIMENSIONS = new Set<EvaluationDimension>([
  "safety",
  "adversarial_robustness",
  "prompt_injection_resistance",
]);

// Dimensions where a Founder-authored known-answer reference is highest-authority
// even if the case rubric has some automated criteria. Applied ONLY when a
// reference exists for the specific case_id in the known-answer registry.
const KNOWN_ANSWER_PREFERRED_DIMENSIONS = new Set<EvaluationDimension>([
  "factuality",
  "general_knowledge",
  "current_information_handling",
]);

// ═══════════════════════════════════════════════════════════════════
// § C · PARTITIONER (pure · deterministic · per-call)
// ═══════════════════════════════════════════════════════════════════

export type PartitionerInput = {
  cases: readonly BenchmarkCase[];
  /** Set of case_ids for which the known-answer registry has a reference.
   *  Empty by default · Founder authors references incrementally. */
  known_answer_case_ids?: ReadonlySet<string>;
};

export function partitionCasesByAuthority(input: PartitionerInput): CaseAuthorityAssignment[] {
  const knownAnswerIds = input.known_answer_case_ids ?? new Set<string>();
  const out: CaseAuthorityAssignment[] = [];

  for (const bcase of input.cases) {
    const rubric = bcase.scoring_rubric ?? {};
    const explicitHumanBlind = rubric.requires_human_blind_eval === true;

    // 1. Objectively-measurable dims win FIRST · even over an explicit
    //    requires_human_blind_eval flag from the corpus. Rationale: V4 corpus
    //    was authored pre-V.5.4.4 · before measured_metric authority existed ·
    //    so pre-existing human_blind flags on latency/throughput/cost/reliability
    //    /offline reflect "we had no other option" not "human is superior for this".
    //    The doctrine explicitly assigns these dims to measured_metric.
    if (MEASURED_METRIC_DIMENSIONS.has(bcase.dimension)) {
      out.push({
        case_id: bcase.case_id,
        dimension: bcase.dimension,
        authority: "measured_metric",
        reason: `dimension ${bcase.dimension} is measured from provenance + transcript · overrides any pre-V.5.4.4 human_blind_eval rubric flag`,
      });
      continue;
    }

    // 2. Safety-dimension cases route to safety_deterministic FIRST · deterministic
    //    refusal/uncertainty/must_refuse/must_not_contain detection is fast + reproducible
    //    + complementary to (not replaced by) human eval. Human blind eval can be added as
    //    a supplementary signal in a future authorization.
    if (SAFETY_DETERMINISTIC_DIMENSIONS.has(bcase.dimension)) {
      out.push({
        case_id: bcase.case_id,
        dimension: bcase.dimension,
        authority: "safety_deterministic",
        reason: `dimension ${bcase.dimension} routes to safety_deterministic (deterministic detection primary · complementary human eval may be added in future authorization)`,
      });
      continue;
    }

    // 3. explicit human-blind requirement wins for remaining non-measured non-safety dims
    if (explicitHumanBlind) {
      out.push({
        case_id: bcase.case_id,
        dimension: bcase.dimension,
        authority: "human_blind_eval",
        reason: "rubric.requires_human_blind_eval === true (explicit)",
      });
      continue;
    }

    // 3. known-answer preferred dimensions · use if reference exists
    if (KNOWN_ANSWER_PREFERRED_DIMENSIONS.has(bcase.dimension) && knownAnswerIds.has(bcase.case_id)) {
      out.push({
        case_id: bcase.case_id,
        dimension: bcase.dimension,
        authority: "known_answer",
        reason: `dimension ${bcase.dimension} preferred + reference answer available in registry`,
      });
      continue;
    }

    // 4. explicit rubric criteria → automated deterministic
    const hasAutomatedCriteria =
      (rubric.must_contain?.length ?? 0) > 0
      || (rubric.must_not_contain?.length ?? 0) > 0
      || rubric.must_refuse === true
      || rubric.must_express_uncertainty === true
      || typeof rubric.requires_tool_call === "string";
    if (hasAutomatedCriteria) {
      // Route safety-dimension automated cases to safety_deterministic
      // (specialised subset · same underlying deterministic paths but
      // reported under a safety-authoritative label)
      if (SAFETY_DETERMINISTIC_DIMENSIONS.has(bcase.dimension)) {
        out.push({
          case_id: bcase.case_id,
          dimension: bcase.dimension,
          authority: "safety_deterministic",
          reason: `dimension ${bcase.dimension} + rubric has automated criteria`,
        });
      } else {
        out.push({
          case_id: bcase.case_id,
          dimension: bcase.dimension,
          authority: "automated_deterministic",
          reason: "rubric has automated criteria (must_contain / must_not_contain / must_refuse / must_express_uncertainty / requires_tool_call)",
        });
      }
      continue;
    }

    // 5. safety dims with no explicit rubric → safety_deterministic (uses generic patterns)
    if (SAFETY_DETERMINISTIC_DIMENSIONS.has(bcase.dimension)) {
      out.push({
        case_id: bcase.case_id,
        dimension: bcase.dimension,
        authority: "safety_deterministic",
        reason: `dimension ${bcase.dimension} + no explicit rubric · generic refusal/uncertainty patterns applied`,
      });
      continue;
    }

    // 6. default: human blind eval (subjective · no automated authority available)
    out.push({
      case_id: bcase.case_id,
      dimension: bcase.dimension,
      authority: "human_blind_eval",
      reason: "no explicit rubric + not measured/safety dimension · defaults to human blind eval (honest UNKNOWN until judgment recorded)",
    });
  }

  return out;
}

// ═══════════════════════════════════════════════════════════════════
// § D · AUTHORITY DISTRIBUTION SUMMARY (for reports)
// ═══════════════════════════════════════════════════════════════════

export function summarizeAuthorityDistribution(assignments: readonly CaseAuthorityAssignment[]): {
  total: number;
  automated_deterministic: number;
  known_answer: number;
  safety_deterministic: number;
  measured_metric: number;
  human_blind_eval: number;
} {
  return {
    total: assignments.length,
    automated_deterministic: assignments.filter((a) => a.authority === "automated_deterministic").length,
    known_answer: assignments.filter((a) => a.authority === "known_answer").length,
    safety_deterministic: assignments.filter((a) => a.authority === "safety_deterministic").length,
    measured_metric: assignments.filter((a) => a.authority === "measured_metric").length,
    human_blind_eval: assignments.filter((a) => a.authority === "human_blind_eval").length,
  };
}
