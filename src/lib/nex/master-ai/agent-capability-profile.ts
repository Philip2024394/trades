// src/lib/nex/master-ai/agent-capability-profile.ts
//
// NEX Master AI · Agent Capability Profile (F-Wave §7)
// Philip 2026-09-07 · AUTHORIZE
//
// Each agent in the Master AI catalogue must have a capability profile.
// This module extends agent-registry.ts (which stores basic catalogue
// entries) with the richer per-agent profile the directive specifies:
//
//   · mission
//   · domains
//   · skills + skill versions
//   · evidence
//   · benchmark performance
//   · known weaknesses
//   · reliability
//   · recent failures
//   · learning trajectory
//   · knowledge dependencies
//   · current state
//   · resource/cost profile
//
// Do NOT hardcode around today's agents · future agents must register
// cleanly. Profiles are versioned append-only records with supersedes
// chain.

import { randomUUID } from "node:crypto";
import { readJsonlAll, appendJsonLine } from "./fs-atomic";
import { agentCapabilityProfilesPath } from "./paths";
import type { MasterAgentId } from "./types";

export type SkillEntry = {
  skill_slug: string;
  version: string;
  evidence_ref: string | null;
  benchmark_score: number | null;                  // 0-100 · null when unmeasured
};

export type AgentReliability = "UNKNOWN" | "LOW" | "MEDIUM" | "HIGH";

export type LearningTrajectorySlope = "IMPROVING" | "STABLE" | "REGRESSING" | "UNKNOWN";

export type AgentCapabilityProfile = {
  profile_id: string;
  recorded_at_iso: string;
  agent_id: MasterAgentId;
  mission: string;                                 // required ≥ 10 chars
  domains: readonly string[];
  skills: readonly SkillEntry[];
  evidence_refs: readonly string[];
  benchmark_performance_summary: string;            // free-form summary or "no benchmarks yet"
  known_weaknesses: readonly string[];
  reliability: AgentReliability;
  recent_failure_refs: readonly string[];           // pointers to failure_patterns or failure_trajectories
  learning_trajectory: LearningTrajectorySlope;
  knowledge_dependencies: readonly string[];
  current_state: "REGISTERED" | "ACTIVE" | "DEGRADED" | "STOPPED" | "PROPOSED" | "RETIRED";
  resource_cost_profile: {
    approximate_monthly_compute_hours: number | null;
    approximate_monthly_storage_mb: number | null;
    approximate_monthly_research_requests: number | null;
    approximate_monthly_cost_idr: number | null;
  };
  supersedes: string | null;
  created_by: string;
};

export class InvalidCapabilityProfileError extends Error {
  constructor(reason: string) { super(`invalid_capability_profile:${reason}`); }
}

export function recordCapabilityProfile(input: Omit<AgentCapabilityProfile, "profile_id" | "recorded_at_iso">): AgentCapabilityProfile {
  if (!input.agent_id || input.agent_id.length < 2) throw new InvalidCapabilityProfileError("agent_id");
  if (!input.mission || input.mission.trim().length < 10) throw new InvalidCapabilityProfileError("mission_too_short");
  if (!input.current_state) throw new InvalidCapabilityProfileError("current_state");
  if (!input.reliability) throw new InvalidCapabilityProfileError("reliability");
  if (!input.learning_trajectory) throw new InvalidCapabilityProfileError("learning_trajectory");
  const rec: AgentCapabilityProfile = {
    ...input,
    profile_id: randomUUID(),
    recorded_at_iso: new Date().toISOString(),
  };
  appendJsonLine(agentCapabilityProfilesPath(), rec);
  return rec;
}

export function readAllProfiles(): AgentCapabilityProfile[] {
  return readJsonlAll<AgentCapabilityProfile>(agentCapabilityProfilesPath());
}

/** Return the latest non-superseded profile per agent. */
export function currentProfiles(): AgentCapabilityProfile[] {
  const all = readAllProfiles();
  const superseded = new Set<string>();
  for (const p of all) if (p.supersedes) superseded.add(p.supersedes);
  const latestPerAgent = new Map<MasterAgentId, AgentCapabilityProfile>();
  for (const p of all) {
    if (superseded.has(p.profile_id)) continue;
    latestPerAgent.set(p.agent_id, p);
  }
  return Array.from(latestPerAgent.values());
}

export function getCurrentProfile(agent_id: MasterAgentId): AgentCapabilityProfile | null {
  return currentProfiles().find((p) => p.agent_id === agent_id) ?? null;
}

export function _resetCapabilityProfilesForTests(): void {
  const fs = require("node:fs") as typeof import("node:fs");
  try { if (fs.existsSync(agentCapabilityProfilesPath())) fs.unlinkSync(agentCapabilityProfilesPath()); } catch { /* ignore */ }
}
