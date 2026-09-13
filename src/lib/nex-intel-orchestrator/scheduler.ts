// WO-INTEL-ORCHESTRATOR-01 · deterministic mission scheduler.
//
// Pure function. Same inputs → same decision, always. Envelope caps
// enforced. Never expands the mandate at runtime.

import type { IntelligenceOperatingMandate, IntelligenceMission, IntelligenceWorkClass } from "./types";

export interface SchedulerInput {
  readonly mandate: IntelligenceOperatingMandate;
  readonly active_missions_count: number;
  readonly missions_in_last_24h_count: number;
  readonly stale_knowledge_count: number;
  readonly unresolved_contradictions_count: number;
  readonly hypotheses_awaiting_experiment_count: number;
  readonly crawler_quota_remaining_today: number;
  readonly at_time_ms: number;
}

export type SchedulerDecision =
  | { readonly kind: "DISPATCH"; readonly work_class: IntelligenceWorkClass; readonly reason: string }
  | { readonly kind: "NO_MISSION"; readonly reason: string };

/**
 * Deterministic scheduler. Rules in order.
 */
export function decideNextMission(input: SchedulerInput): SchedulerDecision {
  const { mandate, active_missions_count, missions_in_last_24h_count } = input;

  // Rule 1 · envelope-cap check
  if (active_missions_count >= mandate.max_concurrent_missions) {
    return { kind: "NO_MISSION", reason: `envelope full · ${active_missions_count}/${mandate.max_concurrent_missions} concurrent` };
  }

  // Rule 2 · mandate expiry
  if (input.at_time_ms > Date.parse(mandate.expires_at)) {
    return { kind: "NO_MISSION", reason: "mandate expired · re-authorise" };
  }

  // Rule 3 · daily cap
  if (missions_in_last_24h_count >= mandate.max_daily_missions) {
    return { kind: "NO_MISSION", reason: `daily cap reached · ${missions_in_last_24h_count}/${mandate.max_daily_missions}` };
  }

  const authorised = new Set(mandate.authorised_work_classes);

  // Rule 4 · work selection (in order · founder-locked priorities)
  if (authorised.has("revisit_stale_knowledge") && input.stale_knowledge_count > 0) {
    return { kind: "DISPATCH", work_class: "revisit_stale_knowledge", reason: `${input.stale_knowledge_count} stale objects awaiting revisit` };
  }
  if (authorised.has("resolve_contradiction") && input.unresolved_contradictions_count > 0) {
    return { kind: "DISPATCH", work_class: "resolve_contradiction", reason: `${input.unresolved_contradictions_count} unresolved contradictions` };
  }
  if (authorised.has("test_promising_hypothesis") && input.hypotheses_awaiting_experiment_count > 0) {
    return { kind: "DISPATCH", work_class: "test_promising_hypothesis", reason: `${input.hypotheses_awaiting_experiment_count} hypotheses awaiting experiment` };
  }
  if (authorised.has("crawl_new_authorised_source") && input.crawler_quota_remaining_today > 0) {
    return { kind: "DISPATCH", work_class: "crawl_new_authorised_source", reason: `crawler quota available: ${input.crawler_quota_remaining_today} remaining today` };
  }

  return { kind: "NO_MISSION", reason: "no eligible work under current mandate" };
}

/**
 * Envelope pre-check: does this proposed mission match the mandate?
 * Rejects with a specific reason if any constraint fails.
 */
export function preCheckMissionAgainstMandate(mission: IntelligenceMission, mandate: IntelligenceOperatingMandate): { ok: true } | { ok: false; reason: string } {
  if (!mandate.authorised_work_classes.includes(mission.kind)) {
    return { ok: false, reason: `work class "${mission.kind}" not in mandate` };
  }
  if (mission.compute_budget_ms > mandate.max_experiment_budget_ms) {
    return { ok: false, reason: `compute_budget ${mission.compute_budget_ms}ms > mandate max ${mandate.max_experiment_budget_ms}ms` };
  }
  if (mission.scope.source_class_ids) {
    const authorised = new Set(mandate.authorised_source_class_ids);
    for (const s of mission.scope.source_class_ids) {
      if (!authorised.has(s)) return { ok: false, reason: `source class "${s}" not in mandate` };
    }
  }
  return { ok: true };
}
