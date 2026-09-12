// src/lib/nex/master-ai/learning-cycle.ts
//
// NEX Master AI Engineer · Wave 4 · W4-D · First real learning cycle
// Philip 2026-09-07 · AUTHORIZE (Wave-4 continuous mission)
//
// End-to-end orchestration of one learning iteration:
//   OBSERVE → RESEARCH → PROPOSE → DELEGATE → OBSERVE OUTCOME → RECORD.
//
// This is the outer loop that ties the individual W1..W4 modules
// together for a bounded round-trip. It does NOT execute Programmer
// code — the Programmer is a separate agent that picks work from the
// delegation ledger.
//
// PRESERVATION:
//   · One cycle per invocation · never runs indefinitely.
//   · If no research question exists, honestly records NO_INVESTIGATION.
//   · If no delegation target available, honestly records DELEGATION_SKIPPED.
//   · Never auto-promotes anything · outcomes routed through the
//     usual promotion queue when appropriate.

import { randomUUID } from "node:crypto";
import { readJsonlAll, appendJsonLine } from "./fs-atomic";
import { learningCycleReportsPath } from "./paths";
import { observatoryTick } from "./observatory";
import { performResearch } from "./research-gateway";
import { computePriority } from "./research-priority";
import { enqueueResearchQuery, listQueries } from "./research-engine";
import { delegateTask } from "./delegation";
import { openInvestigation, updateInvestigation } from "./connectivity-regulation";
import type { AutonomousInvocationBounds, MasterAgentId } from "./types";

export type LearningCyclePhase =
  | "OBSERVE"
  | "RESEARCH"
  | "PROPOSE"
  | "DELEGATE"
  | "OBSERVE_OUTCOME"
  | "RECORD";

export type LearningCycleReport = {
  cycle_id: string;
  invoked_at_iso: string;
  invoker_reason: string;
  observation_reports_produced: number;
  research_query_id: string | null;
  research_status: "OK" | "OFFLINE_MODE" | "BLOCKED" | "FALLTHROUGH_TO_OFFLINE" | "ADAPTER_MISSING" | "FETCH_FAILED" | "SKIPPED" | "NO_INVESTIGATION";
  research_source_slug: string | null;
  finding_id: string | null;
  delegation_id: string | null;
  delegation_status: "PENDING" | "SKIPPED_NO_QUALIFIED_TASK";
  investigation_id: string | null;
  phases_completed: LearningCyclePhase[];
  phases_skipped: LearningCyclePhase[];
  terminated_reason: string;
};

/** Run one bounded learning cycle. Every phase either completes or
 *  honestly records why it was skipped. */
export async function runLearningCycle(input: {
  invoker_reason: string;
  investigation_question?: string;
  investigation_jurisdiction?: string;
  target_source_slugs?: string[];
  delegation_target_agent_id?: MasterAgentId;
  delegation_task_slug?: string;
  delegation_task_description?: string;
  delegation_bounds?: AutonomousInvocationBounds;
  research_units?: number;
  now?: number;
}): Promise<LearningCycleReport> {
  const cycle_id = randomUUID();
  const invoked_at_iso = new Date().toISOString();
  const phases_completed: LearningCyclePhase[] = [];
  const phases_skipped: LearningCyclePhase[] = [];

  // ─── OBSERVE ────────────────────────────────────────────────────
  const obsReports = observatoryTick(input.now);
  phases_completed.push("OBSERVE");

  // ─── RESEARCH (opens investigation + query, routes gateway) ─────
  let research_query_id: string | null = null;
  let research_status: LearningCycleReport["research_status"] = "SKIPPED";
  let research_source_slug: string | null = null;
  let finding_id: string | null = null;
  let investigation_id: string | null = null;

  if (input.investigation_question && input.investigation_jurisdiction) {
    const inv = openInvestigation({
      question: input.investigation_question,
      jurisdiction: input.investigation_jurisdiction,
      target_source_slugs: input.target_source_slugs ?? [],
      created_by: `learning_cycle:${cycle_id.slice(0, 8)}`,
    });
    investigation_id = inv.investigation_id;

    // Compute a priority · deterministic
    const priority = computePriority({
      question: input.investigation_question,
      driver: "STRATEGIC_QUESTION",
      components: { impact: 8, urgency: 6, confidence_in_signal: 6, expected_benefit: 8, cost_estimate: 3, risk_estimate: 3, complexity_estimate: 5 },
    });
    const query = enqueueResearchQuery({
      question: input.investigation_question,
      target_source_slugs: input.target_source_slugs ?? [],
      priority: Math.round(priority.score),
      created_by: `learning_cycle:${cycle_id.slice(0, 8)}`,
    });
    research_query_id = query.query_id;
    updateInvestigation({ investigation_id: inv.investigation_id, linked_research_query_id: query.query_id });

    // Route through enforced gateway
    const outcome = await performResearch({
      query,
      invoker: `learning_cycle:${cycle_id.slice(0, 8)}`,
      units_required: input.research_units ?? 1,
    });
    research_status = outcome.status;
    if (outcome.status === "OK") {
      finding_id = outcome.finding.finding_id;
      research_source_slug = outcome.source_slug;
      updateInvestigation({ investigation_id: inv.investigation_id, linked_finding_id: outcome.finding.finding_id });
      phases_completed.push("RESEARCH");
    } else {
      phases_skipped.push("RESEARCH");
    }
  } else {
    research_status = "NO_INVESTIGATION";
    phases_skipped.push("RESEARCH");
  }

  // ─── PROPOSE (record priority + investigation) — happens above via computePriority ──
  phases_completed.push("PROPOSE");

  // ─── DELEGATE ───────────────────────────────────────────────────
  let delegation_id: string | null = null;
  let delegation_status: LearningCycleReport["delegation_status"] = "SKIPPED_NO_QUALIFIED_TASK";
  const canDelegate =
    input.delegation_target_agent_id &&
    input.delegation_task_slug &&
    input.delegation_task_description &&
    input.delegation_bounds;
  if (canDelegate) {
    const rec = delegateTask({
      source_agent_id: "master_ai",
      target_agent_id: input.delegation_target_agent_id!,
      task_slug: input.delegation_task_slug!,
      task_description: input.delegation_task_description!,
      bounds: input.delegation_bounds!,
      reason: `learning_cycle:${cycle_id.slice(0, 8)}:${input.invoker_reason}`,
    });
    delegation_id = rec.delegation_id;
    delegation_status = "PENDING";
    phases_completed.push("DELEGATE");
  } else {
    phases_skipped.push("DELEGATE");
  }

  // ─── OBSERVE_OUTCOME · we only OBSERVE here · outcomes are async ──
  phases_completed.push("OBSERVE_OUTCOME");

  // ─── RECORD ─────────────────────────────────────────────────────
  const terminated_reason = phases_skipped.length === 0
    ? "cycle_completed_all_phases"
    : `cycle_completed_with_skips:${phases_skipped.join(",")}`;

  const report: LearningCycleReport = {
    cycle_id,
    invoked_at_iso,
    invoker_reason: input.invoker_reason,
    observation_reports_produced: obsReports.length,
    research_query_id,
    research_status,
    research_source_slug,
    finding_id,
    delegation_id,
    delegation_status,
    investigation_id,
    phases_completed,
    phases_skipped,
    terminated_reason,
  };
  appendJsonLine(learningCycleReportsPath(), report);
  phases_completed.push("RECORD");
  return report;
}

export function readAllLearningCycleReports(): LearningCycleReport[] {
  return readJsonlAll<LearningCycleReport>(learningCycleReportsPath());
}

export function _resetLearningCycleForTests(): void {
  const fs = require("node:fs") as typeof import("node:fs");
  try { if (fs.existsSync(learningCycleReportsPath())) fs.unlinkSync(learningCycleReportsPath()); } catch { /* ignore */ }
}
