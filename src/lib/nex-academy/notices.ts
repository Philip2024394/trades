// WO-ACADEMY-01 · Notice discipline (three-strike system).
//
// Notices are issued deterministically based on measured evidence. An
// agent NEVER receives a notice from self-assessment — only from measured
// underperformance against founder-locked thresholds.
//
// Notice 1 → recorded, retraining path recommended (state unchanged)
// Notice 2 → career state → RESTRICTED (training-scope tasks only)
// Notice 3 → KnowledgeHarvest required BEFORE state → DECOMMISSIONED

import { randomUUID } from "node:crypto";
import { getStorage } from "@/lib/nex/storage/registry";
import { COLLECTIONS } from "@/lib/nex/storage/types";
import { provenanceChainHash, sha256Hex } from "@/lib/nex-intelligence/provenance";
import { PERFORMANCE_FLOORS } from "./career-state";
import type { CareerState, NoticeKind, NoticeRecord } from "./types";

// ── Founder-locked measurement thresholds ──────────────────────────────

export interface NoticeAssessmentInput {
  readonly agent_id: string;
  readonly current_career_state: CareerState;
  readonly task_completion_score: number;
  readonly regression_score: number;
  readonly regressions_introduced_in_last_run: number;
  readonly existing_notice_1_count: number;
  readonly existing_notice_2_count: number;
  readonly existing_notice_3_count: number;
  readonly evidence_pointers: readonly string[];
}

export type NoticeDecision =
  | { readonly kind: "ISSUE_NOTICE"; readonly notice_kind: NoticeKind; readonly reason: string; readonly measured_metric: string; readonly measured_value: number; readonly threshold: number; readonly retraining_path: string | null; readonly resulting_career_state: CareerState }
  | { readonly kind: "NO_ACTION"; readonly reason: string };

/**
 * Decide the notice action from scores. Pure function of inputs.
 *
 * Rules:
 *   - Regression introduced (regressions_introduced_in_last_run > 0) → Notice 1 always (§M8)
 *   - task_completion_score < floor(current_career_state) → Notice 1
 *     - If already had 2+ Notice-1s → Notice 2 (RESTRICTED)
 *     - If already had 2+ Notice-2s → Notice 3 (path to DECOMMISSIONED)
 */
export function decideNotice(input: NoticeAssessmentInput): NoticeDecision {
  const floor = PERFORMANCE_FLOORS[input.current_career_state];
  const belowFloor = input.task_completion_score < floor;
  const regressed = input.regressions_introduced_in_last_run > 0;

  if (!belowFloor && !regressed) {
    return { kind: "NO_ACTION", reason: "task_completion_score at or above floor AND no regressions detected" };
  }

  // Determine notice kind based on prior notice history.
  //   0..1 prior Notice-1 → issue Notice 1
  //   ≥2 prior Notice-1  → escalate to Notice 2
  //   ≥2 prior Notice-2  → escalate to Notice 3
  let noticeKind: NoticeKind;
  let resultingState: CareerState;
  if (input.existing_notice_2_count >= 2) {
    noticeKind = "NOTICE_3";
    resultingState = "RESTRICTED";     // stays RESTRICTED until Knowledge Harvest completes → DECOMMISSIONED
  } else if (input.existing_notice_1_count >= 2) {
    noticeKind = "NOTICE_2";
    resultingState = "RESTRICTED";
  } else {
    noticeKind = "NOTICE_1";
    resultingState = input.current_career_state;   // state unchanged
  }

  const measured_metric = regressed ? "regressions_introduced_in_last_run" : "task_completion_score";
  const measured_value = regressed ? input.regressions_introduced_in_last_run : input.task_completion_score;
  const threshold = regressed ? 0 : floor;
  const reason = regressed
    ? `regression penalty: ${input.regressions_introduced_in_last_run} regression(s) introduced`
    : `task_completion_score ${input.task_completion_score.toFixed(2)} below floor ${floor.toFixed(2)} for state ${input.current_career_state}`;
  const retraining_path = noticeKind === "NOTICE_3"
    ? "Knowledge Harvest → replacement agent training"
    : noticeKind === "NOTICE_2"
      ? "RESTRICTED assignment: training-scope tasks only until success_rate returns above floor"
      : "corrective retraining recommended";

  return { kind: "ISSUE_NOTICE", notice_kind: noticeKind, reason, measured_metric, measured_value, threshold, retraining_path, resulting_career_state: resultingState };
}

// ── Notice record builder + persistence ────────────────────────────────

export function buildNoticeRecord(input: {
  readonly agent_id: string;
  readonly decision: Extract<NoticeDecision, { kind: "ISSUE_NOTICE" }>;
  readonly evidence_pointers: readonly string[];
  readonly antecedent_provenance_hashes: readonly string[];
}): NoticeRecord {
  const notice_id = `academy-notice-${sha256Hex(input.agent_id + input.decision.notice_kind + Date.now().toString()).slice(0, 16)}`;
  const base = {
    record_type: "NEX_ACADEMY_NOTICE" as const,
    notice_id,
    agent_id: input.agent_id,
    kind: input.decision.notice_kind,
    issued_at: new Date().toISOString(),
    reason: input.decision.reason,
    measured_metric: input.decision.measured_metric,
    measured_value: input.decision.measured_value,
    threshold: input.decision.threshold,
    evidence_pointers: Object.freeze([...input.evidence_pointers]) as readonly string[],
    retraining_path: input.decision.retraining_path,
    resulting_career_state: input.decision.resulting_career_state,
  };
  return { ...base, provenance_chain_hash: provenanceChainHash(base, input.antecedent_provenance_hashes) };
}

export async function persistNotice(n: NoticeRecord): Promise<void> {
  await getStorage().save(COLLECTIONS.nex_academy_notices, n);
}
