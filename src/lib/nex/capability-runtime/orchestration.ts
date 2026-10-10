// src/lib/nex/capability-runtime/orchestration.ts
//
// NEX Goal / Workflow / Schedule Separation · Stage 13
// Founder-authorised build-lane addition · 2026-09-23.
//
// The orbiting-agent today conflates:
//   · GOAL     — "harvest real scaffolder emails worldwide, no fabrication"
//   · WORKFLOW — discover → resolve → acquire → walk → extract → classify → resolve entity → record evidence
//   · SCHEDULE — cycle cadence + Asia-last + dormancy gate
//
// Stage 13 names these three concepts as separate typed contracts, then
// provides one CONCRETE decomposition of the existing scaffolding harvest
// orbit into all three. The declarations are inert · no runtime behaviour
// changes · orbiting-agent remains authoritative.
//
// HARD RULES:
//   _ORCHESTRATION_TYPES_ARE_DECLARATIVE_ONLY
//   _ORCHESTRATION_NEVER_DISPATCHES_OR_EXECUTES
//   _ORCHESTRATION_STEPS_REFERENCE_KNOWN_CAPABILITIES_ONLY

import type { CapabilityName } from "./contract";
import type { EventDomain } from "./event-contract";
import type { ExecutionLevel } from "./execution-level";

// ═══════════════════════════════════════════════════════════════════════
// GOAL · desired outcome
// ═══════════════════════════════════════════════════════════════════════

export interface Goal {
  readonly goal_id: string;
  readonly outcome: string;
  readonly target_metric: string;
  readonly countries_in_scope: readonly string[];
  readonly categories_in_scope: readonly string[];
  readonly authored_by: "founder" | "nex1" | "human_reviewer";
  readonly authored_at: string;
  readonly execution_level: ExecutionLevel;
}

// ═══════════════════════════════════════════════════════════════════════
// WORKFLOW · ordered execution plan
// ═══════════════════════════════════════════════════════════════════════

export interface WorkflowStep {
  readonly step_id: string;
  readonly capability: CapabilityName;
  readonly rationale: string;
  readonly ordinal: number;
}

export interface Workflow {
  readonly workflow_id: string;
  readonly goal_id: string;
  readonly steps: readonly WorkflowStep[];
  readonly composition_notes: string;
}

// ═══════════════════════════════════════════════════════════════════════
// SCHEDULE · when the workflow runs
// ═══════════════════════════════════════════════════════════════════════

export type ScheduleCadence =
  | { readonly kind: "cron_gated"; readonly interval_seconds: number; readonly env_flag: string }
  | { readonly kind: "manual" }
  | { readonly kind: "event_triggered"; readonly trigger_event_domain: EventDomain };

export interface Schedule {
  readonly schedule_id: string;
  readonly workflow_id: string;
  readonly cadence: ScheduleCadence;
  readonly asia_last: boolean;
  readonly dormancy_env_flag: string | null;
}

// ═══════════════════════════════════════════════════════════════════════
// CONCRETE · the existing scaffolding harvest orbit, decomposed
// ═══════════════════════════════════════════════════════════════════════

export const SCAFFOLDING_HARVEST_GOAL: Goal = {
  goal_id: "goal.scaffolding_harvest.v1",
  outcome:
    "Discover real scaffolder businesses worldwide, verify emails from downloaded public websites with zero fabrication, deduplicate, and record evidence to nex.discovery_business_evidence.",
  target_metric:
    "unique_verified_public_business_emails · directly measured from DB rows, no theoretical multiplier",
  countries_in_scope: [
    "GB", "IE", "DE", "AT", "CH", "FR", "BE", "NL", "IT", "ES", "PT", "PL",
    "SE", "NO", "DK", "FI", "GR",
    "US", "CA",
    "BR", "MX", "AR",
    "JP", "KR", "SG", "IN",
    "AU", "NZ",
    "ZA", "KE",
  ],
  categories_in_scope: ["scaffolding"],
  authored_by: "founder",
  authored_at: "2026-09-22T00:00:00.000Z",
  execution_level: "E4_PRODUCTION_OPERATION",
};

export const SCAFFOLDING_HARVEST_WORKFLOW: Workflow = {
  workflow_id: "workflow.scaffolding_harvest.v1",
  goal_id: "goal.scaffolding_harvest.v1",
  composition_notes:
    "Mirrors the orbiting-agent dispatch order. Each step names the Stage 2 capability. Orbiting runs the workflow · this declaration does not.",
  steps: [
    {
      step_id: "s1.schedule_country",
      capability: "schedule_country",
      rationale: "Select next territory (Asia-last enforced at scheduler)",
      ordinal: 1,
    },
    {
      step_id: "s2.source_probe",
      capability: "source_probe",
      rationale: "Query a Founder-signed source for candidate businesses",
      ordinal: 2,
    },
    {
      step_id: "s3.connect_adapter",
      capability: "connect_adapter",
      rationale: "Resolve concrete adapter through AdapterRegistry",
      ordinal: 3,
    },
    {
      step_id: "s4.website_walk",
      capability: "website_walk",
      rationale: "Fetch permitted public pages via BehaviorWalkFetcher / ProductionPageFetcher",
      ordinal: 4,
    },
    {
      step_id: "s5.publish_evidence",
      capability: "publish_evidence",
      rationale: "Record verified email evidence into nex.discovery_business_evidence",
      ordinal: 5,
    },
    {
      step_id: "s6.audit_evidence",
      capability: "audit_evidence",
      rationale: "Run R1-R6 integrity checks on captured evidence",
      ordinal: 6,
    },
    {
      step_id: "s7.stream_events",
      capability: "stream_events",
      rationale: "Publish per-cycle operational snapshot for HQ Operations Centre",
      ordinal: 7,
    },
  ],
};

export const SCAFFOLDING_HARVEST_SCHEDULE: Schedule = {
  schedule_id: "schedule.scaffolding_harvest.v1",
  workflow_id: "workflow.scaffolding_harvest.v1",
  cadence: {
    kind: "cron_gated",
    interval_seconds: 300,
    env_flag: "NEX_DISCOVERY_CRON_ACTIVATION",
  },
  asia_last: true,
  dormancy_env_flag: "NEX_DISCOVERY_CRON_ACTIVATION",
};

// ═══════════════════════════════════════════════════════════════════════
// VALIDATORS · pure, no side effects
// ═══════════════════════════════════════════════════════════════════════

export interface OrchestrationValidationResult {
  readonly ok: boolean;
  readonly problems: readonly string[];
}

/**
 * Validate that a Workflow's steps reference only KNOWN_CAPABILITIES
 * and have strictly increasing ordinals starting at 1.
 */
export function validateWorkflow(
  workflow: Workflow,
  known: readonly CapabilityName[],
): OrchestrationValidationResult {
  const problems: string[] = [];
  if (workflow.steps.length === 0) problems.push("workflow_has_no_steps");
  for (let i = 0; i < workflow.steps.length; i++) {
    const s = workflow.steps[i];
    if (!known.includes(s.capability)) {
      problems.push(`step ${s.step_id} references unknown capability ${s.capability}`);
    }
    if (s.ordinal !== i + 1) {
      problems.push(`step ${s.step_id} ordinal ${s.ordinal} does not match position ${i + 1}`);
    }
  }
  return { ok: problems.length === 0, problems };
}

/**
 * Validate that a Schedule references a real workflow_id and cadence shape.
 */
export function validateSchedule(schedule: Schedule): OrchestrationValidationResult {
  const problems: string[] = [];
  if (!schedule.schedule_id) problems.push("schedule_id_missing");
  if (!schedule.workflow_id) problems.push("workflow_id_missing");
  if (schedule.cadence.kind === "cron_gated") {
    if (schedule.cadence.interval_seconds <= 0) problems.push("interval_seconds_must_be_positive");
    if (!schedule.cadence.env_flag) problems.push("cron_gated_cadence_requires_env_flag");
  }
  return { ok: problems.length === 0, problems };
}

/**
 * Validate that a Goal has non-empty countries + categories.
 */
export function validateGoal(goal: Goal): OrchestrationValidationResult {
  const problems: string[] = [];
  if (!goal.goal_id) problems.push("goal_id_missing");
  if (goal.countries_in_scope.length === 0) problems.push("countries_in_scope_empty");
  if (goal.categories_in_scope.length === 0) problems.push("categories_in_scope_empty");
  if (goal.outcome.length < 20) problems.push("outcome_description_too_short");
  return { ok: problems.length === 0, problems };
}

// ═══════════════════════════════════════════════════════════════════════
// DOCTRINE LOCKS (Stage 13)
// ═══════════════════════════════════════════════════════════════════════

export const _ORCHESTRATION_TYPES_ARE_DECLARATIVE_ONLY =
  "Goal_Workflow_Schedule_are_inert_data_no_runner_no_dispatcher_exported";

export const _ORCHESTRATION_NEVER_DISPATCHES_OR_EXECUTES =
  "orbiting_agent_remains_authoritative_no_function_here_calls_it";

export const _ORCHESTRATION_STEPS_REFERENCE_KNOWN_CAPABILITIES_ONLY =
  "every_WorkflowStep_capability_is_a_CapabilityName_from_Stage_2_no_free_form_strings";
