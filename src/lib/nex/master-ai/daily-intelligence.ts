// src/lib/nex/master-ai/daily-intelligence.ts
//
// NEX Master AI Engineer · Daily Intelligence roll-up · §39
// Philip 2026-09-07 · AUTHORIZE (Wave 2 · continuous mission)
//
// Composes a concise Philip briefing from every other engine. Zero
// fabrication · every number pulled from a real ledger. Never
// converts INFERENCE into FACT.

import { randomUUID } from "node:crypto";
import { readJsonlAll, appendJsonLine } from "./fs-atomic";
import { dailyReportsPath } from "./paths";
import { listAgents } from "./agent-registry";
import { readAllHealthReports } from "./observatory";
import { readAllKnowledge } from "./knowledge-ledger";
import { readAllFindings } from "./research-engine";
import { readAllComparisons } from "./experiment-engine";
import { readAllProposalHistory } from "./teaching";
import { readAllClaims } from "./philip-intelligence";
import { readAllUsage, readAllPolicies, usageTodaySoFar } from "./cost-intelligence";
import { readMode } from "./offline-reservoir";
import { readAllSelfCriticism } from "./self-criticism";
import { rankPriorities } from "./research-priority";
import { listCurrentPatterns } from "./failure-intelligence";
import { readAllReservoirDemos } from "./reservoir-refresh";
import { readAllInvocations } from "./autonomous-evolution";
import type { DailyIntelligenceReport, MasterAgentId } from "./types";

/** Compose a daily intelligence report over a rolling 24h window. */
export function composeDaily(input?: { window_hours?: number; now?: number }): DailyIntelligenceReport {
  const now = input?.now ?? Date.now();
  const windowMs = (input?.window_hours ?? 24) * 60 * 60 * 1000;
  const winStart = now - windowMs;
  const winStartIso = new Date(winStart).toISOString();
  const winEndIso = new Date(now).toISOString();

  const agents = listAgents();
  const healthReports = readAllHealthReports();
  const latestByAgent = new Map<MasterAgentId, ReturnType<typeof readAllHealthReports>[number]>();
  for (const r of healthReports) latestByAgent.set(r.agent_id, r);

  let healthy = 0, idle = 0, degraded = 0, stopped = 0;
  const weaknesses: DailyIntelligenceReport["agent_weaknesses"] = [];
  for (const a of agents) {
    const rep = latestByAgent.get(a.agent_id);
    if (!rep) { stopped++; weaknesses.push({ agent_id: a.agent_id, reason: "no_health_report_yet" }); continue; }
    switch (rep.derived_health) {
      case "HEALTHY":   healthy++; break;
      case "IDLE":      idle++;    weaknesses.push({ agent_id: a.agent_id, reason: "idle_no_work_events_in_last_5m" }); break;
      case "DEGRADED":  degraded++; weaknesses.push({ agent_id: a.agent_id, reason: rep.reasons.join(";") }); break;
      case "STOPPED":
      case "CRASHED":   stopped++;  weaknesses.push({ agent_id: a.agent_id, reason: rep.reasons.join(";") }); break;
      default: break;
    }
  }

  const knowledgeNew = readAllKnowledge().filter((k) => k.created_at_iso >= winStartIso).length;
  const findingsNew = readAllFindings().filter((f) => f.retrieved_at_iso >= winStartIso).length;
  const experimentsRun = readAllComparisons().filter((e) => e.performed_at_iso >= winStartIso).length;
  const proposals = readAllProposalHistory().filter((p) => p.created_at_iso >= winStartIso);
  const proposalsCreated = new Set(proposals.map((p) => p.proposal_id)).size;
  const claimsInWindow = readAllClaims().filter((c) => c.created_at_iso >= winStartIso).map((c) => c.claim_id);

  // Cost intelligence
  const usage = readAllUsage();
  const usageOk = usage.filter((u) => u.status === "OK" && u.observed_at_iso >= winStartIso);
  const totalRequests = usageOk.filter((u) => u.metric === "REQUEST").reduce((a, u) => a + u.units, 0);
  const totalCost = usageOk.reduce((a, u) => a + (u.cost_estimate_idr ?? 0), 0);
  const policies = readAllPolicies();
  const sourcesOver50: string[] = [];
  const seenSources = new Set(policies.map((p) => `${p.source_slug}::${p.metric}`));
  for (const key of seenSources) {
    const [slug, metric] = key.split("::") as [string, "REQUEST" | "TOKEN" | "BYTE" | "SECOND" | "ROW"];
    const policy = policies.filter((p) => p.source_slug === slug && p.metric === metric).slice(-1)[0];
    if (!policy) continue;
    const cap = (policy.free_allowance_per_day ?? 0) + (policy.paid_allowance_per_day ?? 0);
    if (cap <= 0) continue;
    const used = usageTodaySoFar(slug, metric, now);
    if (used / cap >= 0.5) sourcesOver50.push(slug);
  }

  const mode = readMode();

  // Opportunities + risks: derived from weaknesses + patterns (deterministic)
  const opportunities: string[] = [];
  const risks: string[] = [];
  if (idle > 0) opportunities.push(`${idle}_agent(s)_idle_could_receive_work`);
  if (degraded > 0) risks.push(`${degraded}_agent(s)_degraded`);
  if (stopped > 0) risks.push(`${stopped}_agent(s)_stopped_or_crashed`);
  if (sourcesOver50.length > 0) risks.push(`${sourcesOver50.length}_source(s)_over_50pct_quota`);
  if (!mode.online) risks.push("offline_mode_active");
  if (proposalsCreated > 0) opportunities.push(`${proposalsCreated}_capability_proposal(s)_pending_founder_review`);

  // Wave-3 enrichment · self-criticism + priorities + patterns + reservoir + cycles
  const selfCriticismInWindow = readAllSelfCriticism().filter((r) => r.composed_at_iso >= winStartIso);
  const latestSelfCrit = selfCriticismInWindow.slice(-1)[0] ?? null;
  if (latestSelfCrit) {
    for (const s of latestSelfCrit.answers.stagnating_agents.slice(0, 3)) opportunities.push(`stagnation:${s}`);
    for (const s of latestSelfCrit.answers.weak_sources.slice(0, 3)) risks.push(`weak_source:${s}`);
    for (const s of latestSelfCrit.answers.repeated_failures.slice(0, 3)) risks.push(`recurring_failure:${s}`);
  }
  const topPatterns = listCurrentPatterns().slice(0, 3);
  for (const p of topPatterns) risks.push(`failure_pattern:${p.pattern_key.slice(0, 8)}(x${p.occurrence_count})`);
  const cyclesInWindow = readAllInvocations().filter((i) => i.invoked_at_iso >= winStartIso);
  const cyclesNoCandidate = cyclesInWindow.filter((i) => i.candidates_produced === 0).length;
  if (cyclesInWindow.length > 0) opportunities.push(`autonomous_cycles=${cyclesInWindow.length}_no_candidate=${cyclesNoCandidate}`);
  const reservoirDemos = readAllReservoirDemos().filter((r) => r.performed_at_iso >= winStartIso);
  if (reservoirDemos.length > 0) opportunities.push(`reservoir_demos=${reservoirDemos.length}`);

  const topPri = rankPriorities().slice(0, 3);
  const nextResearch = topPri.length > 0
    ? topPri.map((s) => `${s.question} (score=${s.score} · driver=${s.driver})`)
    : (latestSelfCrit?.answers.investigate_next.slice(0, 3) ?? [
        "Which legitimate Indonesian accommodation data sources have permissive terms?",
        "What Programmer Phase F/G improvements would strengthen Accommodation A4 entity resolution?",
        "What patterns emerged from failure intelligence this window?",
      ]);

  const report: DailyIntelligenceReport = {
    report_id: randomUUID(),
    window_start_iso: winStartIso,
    window_end_iso: winEndIso,
    system_status: {
      agents_monitored: agents.length,
      agents_healthy: healthy,
      agents_idle: idle,
      agents_degraded: degraded,
      agents_stopped: stopped,
    },
    new_knowledge_count: knowledgeNew,
    new_research_findings_count: findingsNew,
    agent_weaknesses: weaknesses,
    experiments_run: experimentsRun,
    improvements_proposed: proposalsCreated,
    cost_intelligence: {
      total_requests: totalRequests,
      total_estimated_cost_idr: totalCost,
      sources_over_50_pct_quota: sourcesOver50,
    },
    offline_intelligence: {
      mode: mode.online ? "ONLINE" : "OFFLINE",
      last_online_iso: mode.last_online_iso,
    },
    philip_intel_claim_ids: claimsInWindow,
    future_opportunities: opportunities,
    risks,
    next_research_targets: nextResearch,
    composed_at_iso: new Date().toISOString(),
  };
  appendJsonLine(dailyReportsPath(), report);
  return report;
}

export function readAllDailyReports(): DailyIntelligenceReport[] {
  return readJsonlAll<DailyIntelligenceReport>(dailyReportsPath());
}

export function _resetDailyForTests(): void {
  const fs = require("node:fs") as typeof import("node:fs");
  try { if (fs.existsSync(dailyReportsPath())) fs.unlinkSync(dailyReportsPath()); } catch { /* ignore */ }
}
