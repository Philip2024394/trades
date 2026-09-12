// src/lib/nex/master-ai/autonomous-cycle.ts
//
// NEX Master AI Engineer · Real bounded autonomous evolution cycle
// §20 §21 §45 · Philip 2026-09-07 · AUTHORIZE
//
// Runs ONE bounded pass:
//   1. Collect real evidence (failure patterns · observation opportunities ·
//      research priorities · Philip claims tagged OPPORTUNITY).
//   2. If NO real evidence → truthfully record NO_VALID_CANDIDATE (§45).
//   3. Otherwise produce a bounded set of candidate proposals (respects
//      max_candidates_per_cycle from bounds).
//   4. Route each candidate through the promotion approval queue —
//      NEVER auto-approves, NEVER auto-promotes (§30).
//   5. Records one AutonomousInvocationRecord for the cycle.
//
// HONEST FAILURE: if there is no real evidence, we do NOT invent candidates
// to look busy · we record NO_VALID_CANDIDATE and stop.

import {
  recordInvocation,
  queuePromotion,
  validateBounds,
  FounderStopOverrideActiveError,
} from "./autonomous-evolution";
import { readFounderStopOverride } from "@/lib/nex/agent-runtime/registry";
import { listCurrentPatterns } from "./failure-intelligence";
import { rankPriorities } from "./research-priority";
import { readAllClaims } from "./philip-intelligence";
import { readAllKnowledge } from "./knowledge-ledger";
import type {
  AutonomousInvocationBounds,
  AutonomousInvocationRecord,
} from "./types";

export type EvolutionCycleOutcome = {
  invocation: AutonomousInvocationRecord;
  candidates_evaluated: number;
  proposals_queued: string[];                     // promotion queue entry_ids
  no_valid_candidate: boolean;
  evidence_summary: {
    unaddressed_failure_patterns: number;
    high_priority_research_scores: number;
    opportunity_claims: number;
    knowledge_opportunity_signals: number;
  };
};

const DEFAULT_BOUNDS: AutonomousInvocationBounds = {
  max_iterations: 8,
  max_runtime_ms: 60_000,
  max_files_changed: 32,
};

/** Run one bounded cycle. Returns full outcome including honest
 *  NO_VALID_CANDIDATE result when no real evidence exists. */
export function runAutonomousEvolutionCycle(input?: {
  bounds?: AutonomousInvocationBounds;
  max_candidates_per_cycle?: number;
  invoker_reason?: string;
  min_priority_score?: number;
  now?: number;
}): EvolutionCycleOutcome {
  const bounds = input?.bounds ?? DEFAULT_BOUNDS;
  validateBounds(bounds);
  if (readFounderStopOverride().active) throw new FounderStopOverrideActiveError();

  const maxCandidates = Math.min(input?.max_candidates_per_cycle ?? 3, bounds.max_files_changed);
  const minScore = input?.min_priority_score ?? 5;

  // Step 1 · Collect real evidence · no fabrication
  const unaddressedPatterns = listCurrentPatterns().filter((p) => !p.candidate_improvement_slug);
  const highPri = rankPriorities().filter((s) => s.score >= minScore);
  const opportunityClaims = readAllClaims().filter((c) => c.category === "OPPORTUNITY");
  const knowledgeOps = readAllKnowledge().filter((k) => k.category === "OPPORTUNITY_SIGNAL");

  const evidenceSummary = {
    unaddressed_failure_patterns: unaddressedPatterns.length,
    high_priority_research_scores: highPri.length,
    opportunity_claims: opportunityClaims.length,
    knowledge_opportunity_signals: knowledgeOps.length,
  };

  const totalEvidence =
    evidenceSummary.unaddressed_failure_patterns +
    evidenceSummary.high_priority_research_scores +
    evidenceSummary.opportunity_claims +
    evidenceSummary.knowledge_opportunity_signals;

  if (totalEvidence === 0) {
    const invocation = recordInvocation({
      invoker_reason: input?.invoker_reason ?? "scheduled_evolution_cycle",
      bounds_applied: bounds,
      candidates_produced: 0,
      proposals_created: 0,
      terminated_reason: "NO_VALID_CANDIDATE · no real evidence in failure/research/opportunity ledgers",
    });
    return {
      invocation,
      candidates_evaluated: 0,
      proposals_queued: [],
      no_valid_candidate: true,
      evidence_summary: evidenceSummary,
    };
  }

  // Step 2 · Produce bounded candidates from real evidence · deterministic ordering
  type Candidate = { source_evidence_ref: string; reason: string; target_agent_id: string };
  const candidates: Candidate[] = [];

  for (const p of unaddressedPatterns.slice(0, maxCandidates)) {
    const agent = p.affected_agents[0] ?? "master_ai";
    candidates.push({
      source_evidence_ref: `failure_pattern:${p.pattern_key}`,
      reason: `Address ${p.occurrence_count}x recurring failure: ${p.representative_reason.slice(0, 100)}`,
      target_agent_id: agent,
    });
    if (candidates.length >= maxCandidates) break;
  }
  for (const s of highPri.slice(0, Math.max(0, maxCandidates - candidates.length))) {
    candidates.push({
      source_evidence_ref: `research_priority:${s.score_id}`,
      reason: `Investigate: ${s.question.slice(0, 100)} (score=${s.score})`,
      target_agent_id: "master_ai",
    });
    if (candidates.length >= maxCandidates) break;
  }
  for (const c of opportunityClaims.slice(0, Math.max(0, maxCandidates - candidates.length))) {
    candidates.push({
      source_evidence_ref: `philip_claim:${c.claim_id}`,
      reason: `Opportunity: ${c.statement.slice(0, 100)}`,
      target_agent_id: "master_ai",
    });
    if (candidates.length >= maxCandidates) break;
  }

  // Step 3 · Route each candidate through the approval queue · NEVER auto-promote
  const queued: string[] = [];
  for (const c of candidates) {
    const entry = queuePromotion({
      proposal_id: `cycle:${c.source_evidence_ref}`,
      capability_id: c.source_evidence_ref,                // placeholder · Programmer produces real capability_id
      target_agent_id: c.target_agent_id,
      reason: c.reason,
    });
    queued.push(entry.entry_id);
  }

  const invocation = recordInvocation({
    invoker_reason: input?.invoker_reason ?? "scheduled_evolution_cycle",
    bounds_applied: bounds,
    candidates_produced: candidates.length,
    proposals_created: queued.length,
    terminated_reason: `bounded_completion · candidates=${candidates.length} queued=${queued.length}`,
  });

  return {
    invocation,
    candidates_evaluated: candidates.length,
    proposals_queued: queued,
    no_valid_candidate: false,
    evidence_summary: evidenceSummary,
  };
}
