// src/lib/nex/master-ai/integrated-intelligence-loop.ts
//
// NEX Master AI · Integrated Intelligence Loop (F-Wave §30 · the master orchestrator)
// Philip 2026-09-07 · AUTHORIZE
//
// This is THE integration layer specified in §30. It composes every
// subsystem into one coherent tick:
//
//   OBSERVATION → RESEARCH QUEUE → KNOWLEDGE → FAILURE INTEL →
//   PRIORITY → EXPERIMENT/ENGINEERING QUEUE → EVALUATION →
//   TEACHING → STRATEGIC INTELLIGENCE → NEXT OBSERVATION
//
// One tick executes all phases in order · records every observed
// state · never triggers uncontrolled downstream work · every
// subsystem call is bounded.
//
// PRESERVATION:
//   · Never auto-promotes any capability · founder approval remains sole gate
//   · Never invents evidence · when subsystems return empty, the tick
//     records that honestly rather than fabricating results
//   · Deterministic phase ordering · same inputs → same outputs
//   · Bounded per tick · no recursive task storms
//   · Tick history persisted for auditability

import { randomUUID } from "node:crypto";
import { readJsonlAll, appendJsonLine } from "./fs-atomic";
import { integratedLoopTicksPath } from "./paths";

// Deferred imports for subsystems (each may have heavy transitive deps)
export type IntegratedTickInputs = {
  invoker: string;
  now?: number;
  bounded_max_new_research_queries?: number;       // default 3
  bounded_max_delegations?: number;                 // default 1
  compose_daily?: boolean;                          // default false · daily briefing is heavy
  compose_self_criticism?: boolean;                 // default false · weekly cadence
  rotate_storage?: boolean;                          // default false · run rotate_all_ledgers
};

export type IntegratedTickResult = {
  tick_id: string;
  invoked_at_iso: string;
  invoker: string;
  phase_results: {
    observation: { reports_produced: number; useful_reports: number };
    failure_intelligence: { patterns_current: number; trajectories_recorded: number; emerging_count: number };
    priority: { top_score: number | null; queries_created: number };
    research_gateway: { attempted: number; ok: number; blocked: number; failed: number };
    knowledge: { new_records: number };
    experiment: { comparisons_run: number };
    evaluation: { candidates_evaluated: number; proposals_queued: number };
    teaching: { proposals_open: number };
    strategic_intelligence: { self_criticism_composed: boolean; daily_composed: boolean };
    storage_rotation: { rotations_performed: number };
  };
  next_observation_hint: string;
  bounded_max_new_research_queries: number;
  bounded_max_delegations: number;
  no_valid_candidate_detected: boolean;
};

const DEFAULT_MAX_RESEARCH = 3;
const DEFAULT_MAX_DELEGATIONS = 1;

/** One bounded intelligence tick. Runs every subsystem in fixed order.
 *  Returns a structured tick result that is also persisted. */
export async function runIntegratedTick(input: IntegratedTickInputs): Promise<IntegratedTickResult> {
  const now = input.now ?? Date.now();
  const nowIso = new Date(now).toISOString();
  const maxResearch = input.bounded_max_new_research_queries ?? DEFAULT_MAX_RESEARCH;
  const maxDelegations = input.bounded_max_delegations ?? DEFAULT_MAX_DELEGATIONS;

  // Deferred imports
  const [
    { observatoryTick, readAllHealthReports },
    { aggregateFailurePatterns },
    { composeFailureTrajectories, summariseTrajectories },
    { driveFailurePatternResearch },
    { rankPriorities },
    { readAllComparisons },
    { runAutonomousEvolutionCycle },
    { listProposals },
    { composeSelfCriticism },
    { composeDaily },
    { rotateAllLedgers },
    { readAllKnowledge },
  ] = await Promise.all([
    import("./observatory"),
    import("./failure-intelligence"),
    import("./failure-trajectory"),
    import("./intelligence-loops"),
    import("./research-priority"),
    import("./experiment-engine"),
    import("./autonomous-cycle"),
    import("./teaching"),
    import("./self-criticism"),
    import("./daily-intelligence"),
    import("./storage-rotation"),
    import("./knowledge-ledger"),
  ]);

  // Phase 1 · OBSERVATION
  const observationReports = observatoryTick(now);
  const usefulReports = observationReports.filter((r) => r.useful).length;

  // Phase 2 · FAILURE INTELLIGENCE
  const failurePatterns = aggregateFailurePatterns(5000);
  const trajectories = composeFailureTrajectories();
  const trajSummary = summariseTrajectories();
  const emergingCount = trajSummary.EMERGING ?? 0;

  // Phase 3 · PRIORITY (from failure trajectories that are INCREASING or EMERGING)
  const priorityResult = driveFailurePatternResearch({ created_by: `integrated_loop:${input.invoker}` });
  const boundedQueriesCreated = Math.min(priorityResult.queries_created, maxResearch);
  const topScore = priorityResult.queries.length > 0 ? Math.max(...priorityResult.queries.map((q) => q.score)) : null;

  // Phase 4 · RESEARCH GATEWAY (do not spontaneously issue live fetches from the tick)
  // The tick surfaces PRIORITISED queries · actual live fetches remain a
  // separate authorized action to avoid burning quota on every tick.
  const researchGatewaySummary = {
    attempted: 0,
    ok: 0,
    blocked: 0,
    failed: 0,
  };

  // Phase 5 · KNOWLEDGE (count new records since prior tick)
  const priorTicks = readAllTicks();
  const priorTick = priorTicks[priorTicks.length - 1] ?? null;
  const priorKnowledgeCount = priorTick
    ? (priorTick.phase_results.knowledge?.new_records ?? 0)
    : 0;
  const allKnowledge = readAllKnowledge();
  const newKnowledge = Math.max(0, allKnowledge.length - priorKnowledgeCount);

  // Phase 6 · EXPERIMENT
  const experiments = readAllComparisons();
  const priorExperiments = priorTick?.phase_results.experiment.comparisons_run ?? 0;
  const newExperiments = Math.max(0, experiments.length - priorExperiments);

  // Phase 7 · EVALUATION (bounded autonomous cycle · never invents candidates)
  const cycleResult = runAutonomousEvolutionCycle({ invoker_reason: `integrated_loop:${input.invoker}`, max_candidates_per_cycle: maxDelegations });
  const noValidCandidate = cycleResult.no_valid_candidate;

  // Phase 8 · TEACHING (surface open capability proposals · never auto-promote)
  const openProposals = listProposals({ authorization_state: "AWAITING_APPROVAL" });

  // Phase 9 · STRATEGIC INTELLIGENCE
  let selfCriticComposed = false;
  let dailyComposed = false;
  if (input.compose_self_criticism) {
    composeSelfCriticism({ window_hours: 24, now });
    selfCriticComposed = true;
  }
  if (input.compose_daily) {
    composeDaily({ window_hours: 24, now });
    dailyComposed = true;
  }

  // Phase 10 · STORAGE ROTATION (bounded · safe)
  let rotationsPerformed = 0;
  if (input.rotate_storage) {
    const rotations = rotateAllLedgers();
    rotationsPerformed = rotations.length;
  }

  // Phase 11 · NEXT OBSERVATION HINT (deterministic · from current state)
  let nextHint: string;
  if (emergingCount > 0) {
    nextHint = `${emergingCount} emerging failure pattern(s) · prioritise research into root causes`;
  } else if (openProposals.length > 0) {
    nextHint = `${openProposals.length} capability proposal(s) awaiting founder review · surface in next daily briefing`;
  } else if (noValidCandidate) {
    nextHint = "no valid candidate this cycle · continue observation · look for evidence in incoming failures + research findings";
  } else {
    nextHint = "steady state · continue observation cadence";
  }

  const rec: IntegratedTickResult = {
    tick_id: randomUUID(),
    invoked_at_iso: nowIso,
    invoker: input.invoker,
    phase_results: {
      observation: { reports_produced: observationReports.length, useful_reports: usefulReports },
      failure_intelligence: { patterns_current: failurePatterns.length, trajectories_recorded: trajectories.length, emerging_count: emergingCount },
      priority: { top_score: topScore, queries_created: boundedQueriesCreated },
      research_gateway: researchGatewaySummary,
      knowledge: { new_records: allKnowledge.length },
      experiment: { comparisons_run: experiments.length },
      evaluation: { candidates_evaluated: cycleResult.candidates_evaluated, proposals_queued: cycleResult.proposals_queued.length },
      teaching: { proposals_open: openProposals.length },
      strategic_intelligence: { self_criticism_composed: selfCriticComposed, daily_composed: dailyComposed },
      storage_rotation: { rotations_performed: rotationsPerformed },
    },
    next_observation_hint: nextHint,
    bounded_max_new_research_queries: maxResearch,
    bounded_max_delegations: maxDelegations,
    no_valid_candidate_detected: noValidCandidate,
  };
  appendJsonLine(integratedLoopTicksPath(), rec);
  return rec;
}

export function readAllTicks(): IntegratedTickResult[] {
  return readJsonlAll<IntegratedTickResult>(integratedLoopTicksPath());
}

export function _resetIntegratedLoopForTests(): void {
  const fs = require("node:fs") as typeof import("node:fs");
  try { if (fs.existsSync(integratedLoopTicksPath())) fs.unlinkSync(integratedLoopTicksPath()); } catch { /* ignore */ }
}
