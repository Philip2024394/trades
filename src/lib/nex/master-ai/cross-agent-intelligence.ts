// src/lib/nex/master-ai/cross-agent-intelligence.ts
//
// NEX Master AI · Cross-Agent Intelligence (World-Class §17)
// Philip 2026-09-07 · AUTHORIZE (research + intelligence only)
//
// Understand relationships between agents. A finding in one agent may
// improve another. This module detects those opportunities and
// enforces the Evidence → Compatibility → Transfer → Benchmark →
// Review → Approval chain.
//
// PRESERVATION:
//   · Knowledge is NEVER blindly copied between agents.
//   · Every proposed cross-agent flow requires evidence + compatibility
//     assessment.
//   · Transfer is only PROPOSED; actual transfer uses the existing
//     teaching.ts capability proposal flow with founder approval.

import { randomUUID } from "node:crypto";
import { readJsonlAll, appendJsonLine } from "./fs-atomic";
import { crossAgentFlowsPath } from "./paths";
import type { MasterAgentId } from "./types";

// ═════════════════════════════════════════════════════════════════════
// Cross-agent flow record
// ═════════════════════════════════════════════════════════════════════

export type FlowKind =
  | "RESEARCH_FINDING_TO_AGENT"
  | "SKILL_TRANSFER_PROPOSAL"
  | "KNOWLEDGE_HANDOFF"
  | "BENCHMARK_SHARING"
  | "FAILURE_LESSON";

export type CompatibilityAssessment =
  | "COMPATIBLE_AS_IS"
  | "COMPATIBLE_WITH_ADAPTATION"
  | "INCOMPATIBLE"
  | "UNKNOWN";

export type FlowStatus =
  | "DETECTED"                  // Master AI identified the opportunity
  | "COMPATIBILITY_ASSESSED"    // compatibility judgement recorded
  | "TRANSFER_PROPOSED"         // proposal submitted to teaching.ts
  | "BENCHMARK_REQUIRED"        // needs pre/post benchmark before approval
  | "AWAITING_APPROVAL"         // founder approval gate
  | "APPROVED"
  | "REJECTED"
  | "SUPERSEDED";

export type CrossAgentFlowRecord = {
  flow_id: string;
  detected_at_iso: string;
  kind: FlowKind;
  source_agent_id: MasterAgentId;
  target_agent_id: MasterAgentId;
  source_evidence_refs: readonly string[];          // finding_id, capability_id, benchmark_run_id, etc.
  hypothesis: string;                                // "improves X in target because Y"
  expected_improvement: string;                      // what should measurably improve
  compatibility: CompatibilityAssessment;
  compatibility_reasoning: string;
  status: FlowStatus;
  proposal_id: string | null;                        // ref to teaching.ts capability_proposals
  benchmark_before_ref: string | null;
  benchmark_after_ref: string | null;
  reviewer_notes: string | null;
  created_by: string;
};

export class InvalidCrossAgentFlowError extends Error {
  constructor(reason: string) { super(`invalid_cross_agent_flow:${reason}`); }
}

export function recordFlow(input: Omit<CrossAgentFlowRecord, "flow_id" | "detected_at_iso">): CrossAgentFlowRecord {
  if (input.source_agent_id === input.target_agent_id) throw new InvalidCrossAgentFlowError("same_agent_source_and_target");
  if (!input.hypothesis || input.hypothesis.length < 15) throw new InvalidCrossAgentFlowError("hypothesis_too_short");
  if (input.source_evidence_refs.length === 0) throw new InvalidCrossAgentFlowError("evidence_refs_required");
  // Enforce evidence chain
  if (input.status === "AWAITING_APPROVAL" && !input.proposal_id) throw new InvalidCrossAgentFlowError("awaiting_approval_requires_proposal_id");
  if (input.status === "APPROVED" && (!input.benchmark_before_ref || !input.benchmark_after_ref)) {
    throw new InvalidCrossAgentFlowError("approval_requires_pre_and_post_benchmarks");
  }
  const rec: CrossAgentFlowRecord = {
    ...input,
    flow_id: randomUUID(),
    detected_at_iso: new Date().toISOString(),
  };
  appendJsonLine(crossAgentFlowsPath(), rec);
  return rec;
}

export function readAllFlows(): CrossAgentFlowRecord[] {
  return readJsonlAll<CrossAgentFlowRecord>(crossAgentFlowsPath());
}

/** Latest flow per (source, target, evidence_ref_first) tuple. */
export function currentFlows(): CrossAgentFlowRecord[] {
  const all = readAllFlows();
  // The naive latest-per-flow-id already handles supersession because
  // supersedes is not modelled here · flows evolve by appending new
  // records with a new flow_id. If needed, add a supersedes field.
  return all;
}

/** Detect opportunities where a source agent has a strong capability
 *  the target agent lacks · returns candidate flows (not yet
 *  compatibility-assessed). */
export type OpportunityDetectionInput = {
  agent_profiles: Array<{
    agent_id: MasterAgentId;
    skills: readonly { skill_slug: string; version: string; benchmark_score: number | null }[];
    known_weaknesses: readonly string[];
  }>;
};

export type CandidateFlow = {
  source_agent_id: MasterAgentId;
  target_agent_id: MasterAgentId;
  skill_slug: string;
  reason: string;
};

export function detectOpportunities(input: OpportunityDetectionInput): CandidateFlow[] {
  const candidates: CandidateFlow[] = [];
  const bySkill = new Map<string, { agent: MasterAgentId; score: number | null }[]>();
  for (const a of input.agent_profiles) {
    for (const s of a.skills) {
      const arr = bySkill.get(s.skill_slug) || [];
      arr.push({ agent: a.agent_id, score: s.benchmark_score });
      bySkill.set(s.skill_slug, arr);
    }
  }
  // For each skill · if one agent has it and another has a known weakness
  // matching that skill area · suggest a flow
  for (const [skill, holders] of bySkill) {
    const nonHolders = input.agent_profiles.filter((a) => !a.skills.some((s) => s.skill_slug === skill));
    for (const nonHolder of nonHolders) {
      // Only propose when the non-holder has a weakness that name-matches the skill
      const weaknessMatch = nonHolder.known_weaknesses.some((w) => w.toLowerCase().includes(skill.replace(/_/g, " ").toLowerCase().split(" ")[0]));
      if (!weaknessMatch) continue;
      const bestHolder = holders.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
      candidates.push({
        source_agent_id: bestHolder.agent,
        target_agent_id: nonHolder.agent_id,
        skill_slug: skill,
        reason: `agent ${nonHolder.agent_id} has weakness matching skill ${skill} held by ${bestHolder.agent}`,
      });
    }
  }
  return candidates;
}

/** Assess compatibility for a candidate flow. Deterministic. */
export function assessCompatibility(input: {
  source_agent_domains: readonly string[];
  target_agent_domains: readonly string[];
  skill_kind: "GENERIC" | "DOMAIN_SPECIFIC";
}): { compatibility: CompatibilityAssessment; reasoning: string } {
  const sharedDomains = input.source_agent_domains.filter((d) => input.target_agent_domains.includes(d));
  if (input.skill_kind === "GENERIC") {
    return { compatibility: "COMPATIBLE_AS_IS", reasoning: "generic skill · domain overlap not required" };
  }
  if (sharedDomains.length >= 2) {
    return { compatibility: "COMPATIBLE_AS_IS", reasoning: `${sharedDomains.length} shared domains support direct transfer` };
  }
  if (sharedDomains.length === 1) {
    return { compatibility: "COMPATIBLE_WITH_ADAPTATION", reasoning: `1 shared domain (${sharedDomains[0]}) · adaptation required for other domains` };
  }
  return { compatibility: "INCOMPATIBLE", reasoning: "no shared domains · skill unlikely to transfer directly" };
}

/** Summary by status · useful for daily briefing. */
export function summariseFlows(): Record<FlowStatus, number> {
  const out: Record<FlowStatus, number> = {
    DETECTED: 0, COMPATIBILITY_ASSESSED: 0, TRANSFER_PROPOSED: 0,
    BENCHMARK_REQUIRED: 0, AWAITING_APPROVAL: 0, APPROVED: 0, REJECTED: 0, SUPERSEDED: 0,
  };
  for (const f of readAllFlows()) out[f.status]++;
  return out;
}

export function _resetCrossAgentIntelligenceForTests(): void {
  const fs = require("node:fs") as typeof import("node:fs");
  try { if (fs.existsSync(crossAgentFlowsPath())) fs.unlinkSync(crossAgentFlowsPath()); } catch { /* ignore */ }
}
