// src/lib/nex/master-ai/self-criticism.ts
//
// NEX Master AI Engineer · Self-Criticism (§23)
// Philip 2026-09-07 · AUTHORIZE
//
// Master AI evaluates its own performance against real ledger evidence.
// Read-only. Cannot approve its own promotions (§30 · §22 anti-self-
// reinforcement). Answers the 13 §23 questions from evidence, never
// from optimism.

import { randomUUID } from "node:crypto";
import { readJsonlAll, appendJsonLine } from "./fs-atomic";
import { selfCriticismReportsPath } from "./paths";
import { readAllHealthReports } from "./observatory";
import { listCurrentPatterns } from "./failure-intelligence";
import { readAllFindings, readAllQueryHistory } from "./research-engine";
import { readAllComparisons } from "./experiment-engine";
import { readAllKnowledge } from "./knowledge-ledger";
import { readAllUsage, readAllPolicies } from "./cost-intelligence";
import { readAllHealth as readSourceHealthAll } from "./source-federation";
import type { SelfCriticismReport } from "./types";

/** Compose a self-criticism report over the last `window_hours` (default 24). */
export function composeSelfCriticism(input?: { window_hours?: number; now?: number }): SelfCriticismReport {
  const now = input?.now ?? Date.now();
  const windowHours = input?.window_hours ?? 24;
  const winStart = now - windowHours * 60 * 60 * 1000;
  const winIso = new Date(winStart).toISOString();

  // What did I learn? (new knowledge records + new findings)
  const knowledgeNew = readAllKnowledge().filter((k) => k.created_at_iso >= winIso).length;
  const findingsNew = readAllFindings().filter((f) => f.retrieved_at_iso >= winIso).length;
  const what_i_learned = knowledgeNew === 0 && findingsNew === 0
    ? `no_new_knowledge_or_findings_in_last_${windowHours}h · master_ai_has_not_yet_generated_learning`
    : `knowledge_records=${knowledgeNew}_new_findings=${findingsNew}_new_in_last_${windowHours}h`;

  // What changed? (agents whose derived_health flipped in window)
  const reportsInWindow = readAllHealthReports().filter((r) => r.timestamp_iso >= winIso);
  const byAgent = new Map<string, { states: Set<string>; latest: string }>();
  for (const r of reportsInWindow) {
    const b = byAgent.get(r.agent_id) ?? { states: new Set<string>(), latest: "" };
    b.states.add(r.derived_health);
    if (r.timestamp_iso > b.latest) b.latest = r.timestamp_iso;
    byAgent.set(r.agent_id, b);
  }
  const changes: string[] = [];
  for (const [agent, b] of byAgent) if (b.states.size > 1) changes.push(`${agent}:${Array.from(b.states).join("→")}`);
  const what_changed = changes.length === 0
    ? "no_agent_health_state_transitions_observed"
    : `state_transitions:${changes.join("|")}`;

  // What did I miss? (failure patterns without candidate improvements)
  const patterns = listCurrentPatterns();
  const patternsUnaddressed = patterns.filter((p) => !p.candidate_improvement_slug);
  const what_i_missed = patternsUnaddressed.length === 0
    ? "no_unaddressed_failure_patterns"
    : `${patternsUnaddressed.length}_failure_pattern(s)_without_improvement_candidate`;

  // Weak sources (source_health records with UNAVAILABLE / DEGRADED / QUOTA_EXHAUSTED · latest per source)
  const sourceHealthLatest = new Map<string, string>();
  for (const s of readSourceHealthAll()) sourceHealthLatest.set(s.source_slug, s.health);
  const weak_sources: string[] = [];
  for (const [slug, health] of sourceHealthLatest) {
    if (health === "UNAVAILABLE" || health === "DEGRADED" || health === "QUOTA_EXHAUSTED") {
      weak_sources.push(`${slug}:${health}`);
    }
  }

  // Stagnating agents (IDLE across every window report)
  const stagnating_agents: string[] = [];
  for (const [agent, b] of byAgent) {
    if (b.states.size === 1 && b.states.has("IDLE")) stagnating_agents.push(agent);
  }

  // Repeated failures (top patterns by occurrence)
  const repeated_failures = patterns
    .slice(0, 5)
    .map((p) => `${p.pattern_key.slice(0, 8)}(x${p.occurrence_count}):${p.representative_reason.slice(0, 60)}`);

  // Useless research (queries that produced 0 findings)
  const queriesInWindow = readAllQueryHistory().filter((q) => q.created_at_iso >= winIso);
  const findings = readAllFindings();
  const useless_research: string[] = [];
  for (const q of queriesInWindow) {
    const has = findings.some((f) => f.query_id === q.query_id);
    if (!has && q.status === "COMPLETED") useless_research.push(`${q.query_id.slice(0, 8)}:${q.question.slice(0, 60)}`);
  }

  // Improved capabilities (experiment verdicts=SUPERIOR in window)
  const experimentsWin = readAllComparisons().filter((c) => c.performed_at_iso >= winIso);
  const improved_capabilities = experimentsWin
    .filter((c) => c.verdict === "SUPERIOR")
    .map((c) => `${c.candidate_capability_id.slice(0, 8)}:${c.reasoning.slice(0, 60)}`);

  // Wrong predictions (experiments with UNEXPLAINED verdict signal noise/wrong expectation)
  const wrong_predictions = experimentsWin
    .filter((c) => c.verdict === "UNEXPLAINED")
    .map((c) => `${c.candidate_capability_id.slice(0, 8)}:${c.reasoning.slice(0, 60)}`);

  // Insufficient evidence topics
  const insufficient_evidence_topics = experimentsWin
    .filter((c) => c.verdict === "INSUFFICIENT_EVIDENCE")
    .map((c) => `${c.candidate_capability_id.slice(0, 8)}`);

  // Going stale (research findings older than freshness_expires_at_iso)
  const nowIso = new Date(now).toISOString();
  const going_stale = findings
    .filter((f) => f.freshness_expires_at_iso && f.freshness_expires_at_iso < nowIso)
    .map((f) => `${f.source_slug}:${f.finding_id.slice(0, 8)}`);

  // Costing too much (sources at >75% quota)
  const policies = readAllPolicies();
  const usage = readAllUsage();
  const costing_too_much: string[] = [];
  const seen = new Set(policies.map((p) => `${p.source_slug}::${p.metric}`));
  for (const key of seen) {
    const [slug, metric] = key.split("::");
    const policy = policies.filter((p) => p.source_slug === slug && p.metric === metric).slice(-1)[0];
    if (!policy) continue;
    const cap = (policy.free_allowance_per_day ?? 0) + (policy.paid_allowance_per_day ?? 0);
    if (cap === 0) continue;
    const used = usage
      .filter((u) => u.source_slug === slug && u.metric === metric && u.status === "OK")
      .reduce((a, u) => a + u.units, 0);
    if (used / cap > 0.75) costing_too_much.push(`${slug}:${Math.round((used / cap) * 100)}%`);
  }

  // What to investigate next (unaddressed failure patterns + weak sources + stagnation)
  const investigate_next: string[] = [];
  for (const p of patternsUnaddressed.slice(0, 3))   investigate_next.push(`failure_pattern:${p.pattern_key.slice(0, 8)}:${p.representative_reason.slice(0, 40)}`);
  for (const s of weak_sources.slice(0, 3))          investigate_next.push(`source_health:${s}`);
  for (const a of stagnating_agents.slice(0, 3))     investigate_next.push(`agent_stagnation:${a}`);

  const report: SelfCriticismReport = {
    report_id: randomUUID(),
    composed_at_iso: new Date().toISOString(),
    window_hours: windowHours,
    answers: {
      what_i_learned,
      what_changed,
      what_i_missed,
      weak_sources,
      stagnating_agents,
      repeated_failures,
      useless_research,
      improved_capabilities,
      wrong_predictions,
      insufficient_evidence_topics,
      going_stale,
      costing_too_much,
      investigate_next,
    },
  };
  appendJsonLine(selfCriticismReportsPath(), report);
  return report;
}

export function readAllSelfCriticism(): SelfCriticismReport[] {
  return readJsonlAll<SelfCriticismReport>(selfCriticismReportsPath());
}

export function _resetSelfCriticismForTests(): void {
  const fs = require("node:fs") as typeof import("node:fs");
  try { if (fs.existsSync(selfCriticismReportsPath())) fs.unlinkSync(selfCriticismReportsPath()); } catch { /* ignore */ }
}
