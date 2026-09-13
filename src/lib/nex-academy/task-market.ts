// WO-ACADEMY-01 · Task Market matching engine.
//
// Given a TaskRequirement + a set of AcademyRecords + their
// CapabilityProfiles, produce a Match record with ranked candidates.
// Pure function of inputs — same inputs → same ranked output.
//
// Discipline (spec §7):
//   1. Filter: career_state ≥ minimum, capability_scope ⊇ required,
//      qualified_tools ⊇ required_qualified_tools,
//      NOT RESTRICTED (unless task is training-scope),
//      NOT DECOMMISSIONED.
//   2. Score remaining candidates by weighted composite.
//   3. Return ranked list; select highest score.

import { randomUUID } from "node:crypto";
import { getStorage } from "@/lib/nex/storage/registry";
import { COLLECTIONS } from "@/lib/nex/storage/types";
import { CAREER_RANK } from "./types";
import { sha256Hex } from "@/lib/nex-intelligence/provenance";
import type {
  AcademyRecord,
  CapabilityProfile,
  CareerState,
  Match,
  MatchCandidate,
  TaskRequirement,
} from "./types";

// ── Weights (spec §7 — frozen constants) ───────────────────────────────

export const MATCH_WEIGHTS = Object.freeze({
  success_rate_in_domain: 0.30,
  knowledge_contribution: 0.20,
  regression_score:       0.20,
  career_state_rank:      0.15,
  current_workload_penalty: 0.10,
  recency_of_evidence:    0.05,
});

// ── Input bundle ───────────────────────────────────────────────────────

export interface MarketAgent {
  readonly record: AcademyRecord;
  readonly profile: CapabilityProfile;
  /** For recency, the latest evidence timestamp (ISO) — 0 if none. */
  readonly latest_evidence_at_ms: number;
}

export interface MatchInput {
  readonly task: TaskRequirement;
  readonly agents: readonly MarketAgent[];
  readonly is_training_scope: boolean;
  readonly at_time_ms: number;
}

// ── Ranking (pure) ─────────────────────────────────────────────────────

export function rankCandidates(input: MatchInput): { ranked: MatchCandidate[]; filtered_out: { agent_id: string; reason: string }[] } {
  const filtered_out: { agent_id: string; reason: string }[] = [];
  const candidates: MatchCandidate[] = [];

  for (const a of input.agents) {
    const filter = passesFilter(a, input.task, input.is_training_scope);
    if (!filter.ok) {
      filtered_out.push({ agent_id: a.record.agent_id, reason: filter.reason });
      continue;
    }
    const { score, reasons } = scoreCandidate(a, input);
    candidates.push({ agent_id: a.record.agent_id, qualification_score: score, reasons: Object.freeze(reasons) as readonly string[] });
  }

  // Sort by score DESC, then agent_id ASC for stable determinism
  candidates.sort((x, y) => (y.qualification_score - x.qualification_score) || x.agent_id.localeCompare(y.agent_id));
  return { ranked: candidates, filtered_out };
}

function passesFilter(a: MarketAgent, task: TaskRequirement, isTraining: boolean): { ok: true } | { ok: false; reason: string } {
  const state = a.record.career_state;
  if (state === "DECOMMISSIONED") return { ok: false, reason: "DECOMMISSIONED · never assignable" };
  if (state === "RESTRICTED" && !isTraining) return { ok: false, reason: "RESTRICTED · training-scope tasks only" };
  // RESTRICTED + training scope skips the minimum-career-state check —
  // training-scope tasks are precisely the scope RESTRICTED agents work in.
  if (!(state === "RESTRICTED" && isTraining)) {
    if (CAREER_RANK[state] < CAREER_RANK[task.minimum_career_state]) {
      return { ok: false, reason: `career_state=${state} below minimum=${task.minimum_career_state}` };
    }
  }
  // capability_scope ⊇ required_capability_scope
  const agentScope = new Set(a.profile.capability_scope);
  for (const s of task.required_capability_scope) {
    if (!agentScope.has(s)) return { ok: false, reason: `capability_scope missing "${s}"` };
  }
  // qualified_tools ⊇ required_qualified_tools
  const agentTools = new Set(a.profile.qualified_tools);
  for (const t of task.required_qualified_tools) {
    if (!agentTools.has(t)) return { ok: false, reason: `qualified_tools missing "${t}"` };
  }
  return { ok: true };
}

function scoreCandidate(a: MarketAgent, input: MatchInput): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  const w = MATCH_WEIGHTS;

  // 1. success_rate in domain — proxy: task_completion_score if task.domain == profile.specialist_domain
  const inDomain = a.profile.specialist_domain === input.task.domain;
  const successComponent = inDomain ? a.record.task_completion_score : a.record.task_completion_score * 0.75;
  reasons.push(`success_rate_in_domain=${successComponent.toFixed(2)} (in_domain=${inDomain})`);

  // 2. knowledge_contribution
  const knowledgeComponent = a.record.knowledge_contribution_score;
  reasons.push(`knowledge_contribution=${knowledgeComponent.toFixed(2)}`);

  // 3. regression_score
  const regressionComponent = a.record.regression_score;
  reasons.push(`regression_score=${regressionComponent.toFixed(2)}`);

  // 4. career_state_rank (0..6 → 0..1)
  const rankComponent = CAREER_RANK[a.record.career_state] / 6;
  reasons.push(`career_state=${a.record.career_state} (${rankComponent.toFixed(2)})`);

  // 5. current_workload_penalty (higher workload = lower score)
  const wl = a.profile.current_workload;
  const workloadComponent = 1 / (1 + wl);
  reasons.push(`workload=${wl} penalty=${workloadComponent.toFixed(2)}`);

  // 6. recency (24h window)
  const ageMs = input.at_time_ms - a.latest_evidence_at_ms;
  const dayMs = 24 * 3600 * 1000;
  const recencyComponent = ageMs <= 0 ? 1 : Math.max(0, 1 - ageMs / (7 * dayMs));   // 0 after a week
  reasons.push(`recency=${recencyComponent.toFixed(2)}`);

  const score =
    w.success_rate_in_domain * successComponent +
    w.knowledge_contribution * knowledgeComponent +
    w.regression_score       * regressionComponent +
    w.career_state_rank      * rankComponent +
    w.current_workload_penalty * workloadComponent +
    w.recency_of_evidence    * recencyComponent;

  return { score: Math.max(0, Math.min(1, score)), reasons };
}

// ── Build + persist Match ──────────────────────────────────────────────

export function buildMatch(input: MatchInput): Match {
  const { ranked, filtered_out } = rankCandidates(input);
  const match_id = `academy-match-${sha256Hex(input.task.task_id + Date.now().toString()).slice(0, 16)}`;
  const selected = ranked.length > 0 ? ranked[0].agent_id : null;
  const reason_no_selection = selected === null
    ? `no eligible candidate · ${filtered_out.length} filtered out (${filtered_out.slice(0, 3).map((f) => `${f.agent_id}: ${f.reason}`).join(" · ")})`
    : null;

  return {
    record_type: "NEX_ACADEMY_MATCH",
    match_id,
    task_id: input.task.task_id,
    ranked_candidates: Object.freeze(ranked) as readonly MatchCandidate[],
    selected_agent_id: selected,
    reason_no_selection,
    created_at: new Date().toISOString(),
  };
}

export async function persistMatch(m: Match): Promise<void> {
  await getStorage().save(COLLECTIONS.nex_academy_matches, m);
}
