// src/lib/nex/master-ai/endurance-report.ts
//
// NEX Master AI · Phase 5 · Endurance report generator
// Philip 2026-09-07 · AUTHORIZE Phase 5 · W5-4
//
// Reads the real agent-runtime + master-ai ledgers and produces a
// rollup answering the six required endurance questions:
//   1. What did the system observe?
//   2. What failures appeared?
//   3. What did the system research?
//   4. What did the system learn?
//   5. What did the system recommend?
//   6. What did the system refuse to do?
//
// Plus:
//   · Uptime per agent (from AGENT_STARTED events)
//   · Storage growth per ledger (bytes + append rate per hour)
//   · 7-day / 30-day forecast projected from current rate
//   · Endurance-readiness verdict
//
// DISCIPLINE:
//   · Never manufactures activity. Reads real ledgers only.
//   · Returns UNKNOWN honestly when a ledger is missing or empty.
//   · Is a pure read · no writes to any production ledger.
//   · Works over ANY time window (default: since earliest agent start).

import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export type LedgerStats = {
  file: string;
  exists: boolean;
  size_bytes: number;
  line_count: number;
  oldest_iso?: string | null;
  newest_iso?: string | null;
};

export type EnduranceReport = {
  generated_at_iso: string;
  window: { start_iso: string | null; end_iso: string; hours_covered: number | null };
  agents: Array<{
    agent_id: string;
    started_at_iso: string | null;
    uptime_hours: number | null;
    heartbeat_fresh_ms: number | null;
    heartbeat_status: string | null;
    restarts_last_hour: number;
  }>;
  observed_events: {
    total: number;
    by_kind: Record<string, number>;
    by_agent: Record<string, number>;
  };
  failures: {
    total_work_failed: number;
    total_agent_crashed: number;
    failure_patterns_count: number;
    top_patterns: Array<{ pattern_key: string; occurrence_count: number; affected_agents: string[]; representative_reason: string }>;
  };
  research: {
    total_findings: number;
    by_authority_tier: Record<string, number>;
    recent_topics: string[];
  };
  learning: {
    candidates_created: number;
    knowledge_items: number;
    learning_cycles: number;
    experiences_recorded: number;
  };
  recommendations: {
    daily_reports_count: number;
    pending_promotion_approvals: number;
    strategic_recommendations: number;
  };
  refusals: {
    decisions_with_refuse: number;
    offline_refuse_action: number;
  };
  storage: {
    ledgers: LedgerStats[];
    total_bytes_now: number;
    bytes_per_hour_estimate: number;
    projection_7d_bytes: number;
    projection_30d_bytes: number;
  };
  endurance_readiness: {
    verdict: "GREEN" | "YELLOW" | "RED" | "UNKNOWN";
    reasons: string[];
  };
};

// ─── Helpers ──────────────────────────────────────────────

function readJsonlLines(file: string): unknown[] {
  if (!existsSync(file)) return [];
  const raw = readFileSync(file, "utf8");
  const out: unknown[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(JSON.parse(t)); } catch { /* skip malformed */ }
  }
  return out;
}

function fileStats(file: string, timeKey: string): LedgerStats {
  if (!existsSync(file)) {
    return { file, exists: false, size_bytes: 0, line_count: 0, oldest_iso: null, newest_iso: null };
  }
  const st = statSync(file);
  const lines = readJsonlLines(file);
  let oldest: string | null = null;
  let newest: string | null = null;
  for (const l of lines) {
    const rec = l as Record<string, unknown>;
    const t = String(rec[timeKey] ?? "");
    if (!t) continue;
    if (!oldest || t < oldest) oldest = t;
    if (!newest || t > newest) newest = t;
  }
  return { file, exists: true, size_bytes: st.size, line_count: lines.length, oldest_iso: oldest, newest_iso: newest };
}

function hoursBetween(a: string, b: string): number {
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  return (tb - ta) / (1000 * 60 * 60);
}

// ─── Public ────────────────────────────────────────────────

export function generateEnduranceReport(repoRoot?: string): EnduranceReport {
  const root = repoRoot ?? process.cwd();
  const runtimeDir = path.join(root, "data", "nex-agent-runtime");
  const masterDir = path.join(root, "data", "master-ai");
  const learningDir = path.join(root, "data", "programmer-learning");
  const improvementDir = path.join(root, "data", "programmer-improvement");
  const now = new Date().toISOString();

  // ─── Events ───────────────────────────────────────────
  const eventsFile = path.join(runtimeDir, "events.jsonl");
  const events = readJsonlLines(eventsFile) as Array<{ kind?: string; agent_id?: string; timestamp_iso?: string; attributes?: Record<string, unknown> }>;
  const byKind: Record<string, number> = {};
  const byAgent: Record<string, number> = {};
  let oldestEvent: string | null = null;
  for (const e of events) {
    const k = e.kind ?? "UNKNOWN";
    byKind[k] = (byKind[k] ?? 0) + 1;
    const a = e.agent_id ?? "unknown";
    byAgent[a] = (byAgent[a] ?? 0) + 1;
    const t = e.timestamp_iso ?? "";
    if (t && (!oldestEvent || t < oldestEvent)) oldestEvent = t;
  }

  // ─── Agent uptime ─────────────────────────────────────
  // 2026-09-08: extended with vision/travel/business specialists so Master AI's
  // endurance report reflects every registered agent · not only the historical
  // four. Agents that are STOPPED-registered will show hb=null · uptime=null ·
  // that is honest evidence rather than a silent omission.
  const agentIds = ["programmer", "accommodation", "master_ai", "speaking", "vision", "travel", "business", "food", "construction", "healthcare", "transport"];
  const agents = agentIds.map((agentId) => {
    const hbFile = path.join(runtimeDir, `heartbeat-${agentId}.json`);
    let hb: Record<string, unknown> | null = null;
    if (existsSync(hbFile)) {
      try { hb = JSON.parse(readFileSync(hbFile, "utf8")) as Record<string, unknown>; }
      catch { hb = null; }
    }
    // Find the AGENT_STARTED event for this agent's current run
    const started = [...events].reverse().find((e) =>
      e.kind === "AGENT_STARTED" && e.agent_id === agentId,
    );
    const startedAt = started?.timestamp_iso ?? null;
    const uptime = startedAt ? hoursBetween(startedAt, now) : null;
    // Restart count in last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const restartsLastHour = events.filter((e) =>
      e.kind === "AGENT_RESTARTED" && e.agent_id === agentId && (e.timestamp_iso ?? "") > oneHourAgo,
    ).length;
    const hbTsIso = hb ? String(hb.timestamp_iso ?? "") : "";
    const hbFreshMs = hbTsIso ? Date.now() - new Date(hbTsIso).getTime() : null;
    return {
      agent_id: agentId,
      started_at_iso: startedAt,
      uptime_hours: uptime,
      heartbeat_fresh_ms: hbFreshMs,
      heartbeat_status: hb ? String(hb.status ?? "unknown") : null,
      restarts_last_hour: restartsLastHour,
    };
  });

  const windowStart = oldestEvent;
  const windowHours = windowStart ? hoursBetween(windowStart, now) : null;

  // ─── Failures ────────────────────────────────────────
  const failurePatterns = readJsonlLines(path.join(masterDir, "failure_patterns.jsonl")) as Array<{
    pattern_key?: string;
    occurrence_count?: number;
    affected_agents?: string[];
    representative_reason?: string;
    last_seen_iso?: string;
  }>;
  // Latest snapshot per pattern_key
  const latestByKey = new Map<string, typeof failurePatterns[number]>();
  for (const p of failurePatterns) {
    const k = String(p.pattern_key ?? "");
    if (!k) continue;
    const existing = latestByKey.get(k);
    if (!existing || String(p.last_seen_iso ?? "") > String(existing.last_seen_iso ?? "")) {
      latestByKey.set(k, p);
    }
  }
  const topPatterns = Array.from(latestByKey.values())
    .sort((a, b) => (b.occurrence_count ?? 0) - (a.occurrence_count ?? 0))
    .slice(0, 5)
    .map((p) => ({
      pattern_key: String(p.pattern_key ?? ""),
      occurrence_count: Number(p.occurrence_count ?? 0),
      affected_agents: p.affected_agents ?? [],
      representative_reason: String(p.representative_reason ?? ""),
    }));

  // ─── Research ────────────────────────────────────────
  const findings = readJsonlLines(path.join(masterDir, "research_findings.jsonl")) as Array<{
    topic?: string;
    provenance?: { authority_tier?: string };
    retrieved_at?: string;
  }>;
  const byTier: Record<string, number> = {};
  for (const f of findings) {
    const t = String(f.provenance?.authority_tier ?? "UNKNOWN");
    byTier[t] = (byTier[t] ?? 0) + 1;
  }
  const recentTopics = [...findings]
    .sort((a, b) => String(b.retrieved_at ?? "").localeCompare(String(a.retrieved_at ?? "")))
    .slice(0, 5)
    .map((f) => String(f.topic ?? "unknown"));

  // ─── Learning ────────────────────────────────────────
  const candidates = readJsonlLines(path.join(improvementDir, "candidates.jsonl"));
  const knowledgeItems = readJsonlLines(path.join(learningDir, "knowledge.jsonl"));
  const learningCycles = readJsonlLines(path.join(masterDir, "learning_cycle_reports.jsonl"));
  const experiences = readJsonlLines(path.join(learningDir, "experiences.jsonl"));

  // ─── Recommendations ─────────────────────────────────
  const dailyReports = readJsonlLines(path.join(masterDir, "daily_reports.jsonl"));
  const promoQueue = readJsonlLines(path.join(masterDir, "promotion_approval_queue.jsonl"));
  const strategicRecs = readJsonlLines(path.join(masterDir, "strategic_recommendations.jsonl"));

  // ─── Refusals ────────────────────────────────────────
  const decisions = readJsonlLines(path.join(masterDir, "decisions.jsonl")) as Array<{ outcome?: string; decision?: string }>;
  const refuseOutcomes = new Set(["ASK_FOUNDER", "REFUSE", "REFUSE_ACTION", "DEFER", "ESCALATE"]);
  const refusalDecisions = decisions.filter((d) => refuseOutcomes.has(String(d.outcome ?? d.decision ?? "")));
  const offlineStates = readJsonlLines(path.join(masterDir, "offline_resilience_states.jsonl")) as Array<{ decision_mode?: string }>;
  const offlineRefuse = offlineStates.filter((s) => s.decision_mode === "REFUSE_ACTION").length;

  // ─── Storage ─────────────────────────────────────────
  const trackedLedgers = [
    { file: eventsFile, timeKey: "timestamp_iso" },
    { file: path.join(masterDir, "failure_patterns.jsonl"), timeKey: "last_seen_iso" },
    { file: path.join(masterDir, "research_findings.jsonl"), timeKey: "retrieved_at" },
    { file: path.join(masterDir, "agent_health_reports.jsonl"), timeKey: "timestamp_iso" },
    { file: path.join(masterDir, "observations.jsonl"), timeKey: "observed_at" },
    { file: path.join(masterDir, "integrated_loop_ticks.jsonl"), timeKey: "tick_at" },
    { file: path.join(masterDir, "connectivity_findings.jsonl"), timeKey: "retrieved_at" },
    { file: path.join(improvementDir, "candidates.jsonl"), timeKey: "created_at" },
    { file: path.join(learningDir, "knowledge.jsonl"), timeKey: "created_at" },
    { file: path.join(learningDir, "experiences.jsonl"), timeKey: "timestamp" },
  ];
  const ledgerStats: LedgerStats[] = trackedLedgers.map((l) => fileStats(l.file, l.timeKey));
  const totalBytesNow = ledgerStats.reduce((s, x) => s + x.size_bytes, 0);
  const bytesPerHourEstimate = windowHours && windowHours > 0 ? totalBytesNow / windowHours : 0;
  const projection7dBytes = Math.round(bytesPerHourEstimate * 24 * 7);
  const projection30dBytes = Math.round(bytesPerHourEstimate * 24 * 30);

  // ─── Endurance readiness verdict ─────────────────────
  const reasons: string[] = [];
  let verdict: "GREEN" | "YELLOW" | "RED" | "UNKNOWN" = "GREEN";
  // Any crashed agent?
  const crashed = events.filter((e) => e.kind === "AGENT_CRASHED").length;
  if (crashed > 0) { verdict = "YELLOW"; reasons.push(`${crashed} AGENT_CRASHED events observed in window`); }
  // Any restart storms?
  const restartsLastHourTotal = agents.reduce((s, a) => s + a.restarts_last_hour, 0);
  if (restartsLastHourTotal > 5) { verdict = "YELLOW"; reasons.push(`${restartsLastHourTotal} restarts in last hour across agents`); }
  // Heartbeats stale?
  for (const a of agents) {
    if (a.agent_id === "speaking") continue; // may be legitimately STOPPED per doctrine
    if (a.heartbeat_fresh_ms !== null && a.heartbeat_fresh_ms > 60_000) {
      verdict = verdict === "GREEN" ? "YELLOW" : verdict;
      reasons.push(`${a.agent_id} heartbeat stale ${a.heartbeat_fresh_ms}ms`);
    }
  }
  // Projected 7-day storage > 500MB?
  if (projection7dBytes > 500 * 1024 * 1024) {
    verdict = verdict === "GREEN" ? "YELLOW" : verdict;
    reasons.push(`7-day storage projection ${(projection7dBytes / (1024 * 1024)).toFixed(1)} MB exceeds 500 MB soft cap`);
  }
  if (verdict === "GREEN" && reasons.length === 0) reasons.push("all agents healthy · no crashes · heartbeats fresh · storage bounded");

  return {
    generated_at_iso: now,
    window: { start_iso: windowStart, end_iso: now, hours_covered: windowHours },
    agents,
    observed_events: {
      total: events.length,
      by_kind: byKind,
      by_agent: byAgent,
    },
    failures: {
      total_work_failed: byKind["WORK_FAILED"] ?? 0,
      total_agent_crashed: crashed,
      failure_patterns_count: latestByKey.size,
      top_patterns: topPatterns,
    },
    research: {
      total_findings: findings.length,
      by_authority_tier: byTier,
      recent_topics: recentTopics,
    },
    learning: {
      candidates_created: candidates.length,
      knowledge_items: knowledgeItems.length,
      learning_cycles: learningCycles.length,
      experiences_recorded: experiences.length,
    },
    recommendations: {
      daily_reports_count: dailyReports.length,
      pending_promotion_approvals: promoQueue.length,
      strategic_recommendations: strategicRecs.length,
    },
    refusals: {
      decisions_with_refuse: refusalDecisions.length,
      offline_refuse_action: offlineRefuse,
    },
    storage: {
      ledgers: ledgerStats,
      total_bytes_now: totalBytesNow,
      bytes_per_hour_estimate: Math.round(bytesPerHourEstimate),
      projection_7d_bytes: projection7dBytes,
      projection_30d_bytes: projection30dBytes,
    },
    endurance_readiness: { verdict, reasons },
  };
}
