// NEX Knowledge Control Centre · aggregation library
//
// Single-shot read of every KPE data source so the KCC page can render
// without 8 separate API calls. Also produces derived metrics (rolling
// windows, distribution %, oldest-pending age) so the UI stays presentation-only.

import { promises as fs } from "node:fs";
import path from "node:path";
import type { DecisionRecord, ProcessingRun, TierEligibility } from "./types";
import { listPending, queueStats } from "./human-queue";

const ROOT = path.join(process.cwd(), "data", "nex-kpe");
const DECISIONS_FILE = path.join(ROOT, "decisions.jsonl");
const RUNS_FILE      = path.join(ROOT, "processing_runs.jsonl");
const REVIEWS_FILE   = path.join(ROOT, "human_reviews.jsonl");

type HumanReviewRow = { decision: "approved" | "rejected"; decided_at: string };

async function readJsonl<T>(file: string): Promise<T[]> {
  try {
    const raw = await fs.readFile(file, "utf8");
    const out: T[] = [];
    for (const line of raw.split("\n")) {
      if (!line) continue;
      try { out.push(JSON.parse(line) as T); } catch { /* skip */ }
    }
    return out;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

const TIERS = ["skip", "rule_engine", "no_ai", "local_llm", "frontier_llm", "human_review"] as const;

export type DashboardCounters = {
  received: number;                    // total processing runs today
  skipped: number;                     // duplicates
  rule_engine: number;
  no_ai: number;                       // structured / pass-through
  local_llm: number;
  frontier_llm: number;
  human_review: number;                // routed to human_review this window
  approved_today: number;              // admin approvals today
  rejected_today: number;
  pending: number;                     // currently in the queue
  waiting_over_7d: number;             // pending + age > 7 days
  avg_processing_seconds: number | null;
  ai_calls_saved: number;              // count of decisions that would have gone to LLM but didn't
  ai_call_reduction_pct: number;       // 0-100
  total_ai_cost_gbp: number;           // sum of real cost across all AI decisions
};

export type PendingDecisionRow = {
  chunk_id: string;
  document_title: string | null;
  classifier_label: string | null;
  classifier_confidence: number | null;
  age_hours: number;
  reason: string;
  chunk_excerpt: string;               // first 240 chars
};

export type RecentDecisionRow = {
  chunk_id: string;
  tier: string;
  decided_at: string;
  provider_used: string | null;
  latency_ms: number | null;
  reason: string;                      // WHY the Decision Engine picked this tier
  cost_gbp: number;                    // real cost incurred (0 for non-AI tiers)
  alternatives: TierEligibility[];     // every other tier's verdict at decision time
  cheaper_route_available: boolean;    // was a cheaper eligible tier passed over? (learning signal)
};

function isSameDay(iso: string, ref: Date): boolean {
  return iso.slice(0, 10) === ref.toISOString().slice(0, 10);
}

export async function buildDashboard(): Promise<{
  counters: DashboardCounters;
  distribution: Array<{ tier: string; count: number; pct: number }>;
  pending: PendingDecisionRow[];
  recent_decisions: RecentDecisionRow[];
  generated_at: string;
}> {
  const [decisions, runs, reviews, pending, qStats] = await Promise.all([
    readJsonl<DecisionRecord>(DECISIONS_FILE),
    readJsonl<ProcessingRun>(RUNS_FILE),
    readJsonl<HumanReviewRow>(REVIEWS_FILE),
    listPending(),
    queueStats(),
  ]);

  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const dayMs = 24 * 60 * 60 * 1000;
  const sevenDaysAgoMs = now.getTime() - 7 * dayMs;

  // ── Distribution (all-time · easy to windowise later) ────
  const distCounts: Record<string, number> = {};
  for (const t of TIERS) distCounts[t] = 0;
  for (const d of decisions) distCounts[d.route.tier] = (distCounts[d.route.tier] ?? 0) + 1;
  const totalDecisions = Object.values(distCounts).reduce((n, v) => n + v, 0);
  const distribution = TIERS.map((tier) => ({
    tier,
    count: distCounts[tier] ?? 0,
    pct: totalDecisions > 0 ? Math.round((distCounts[tier] ?? 0) / totalDecisions * 1000) / 10 : 0,
  }));

  // ── Today counters ────
  const runsToday = runs.filter((r) => r.started_at.slice(0, 10) === todayIso);
  const approvedToday = reviews.filter((r) => r.decision === "approved" && isSameDay(r.decided_at, now)).length;
  const rejectedToday = reviews.filter((r) => r.decision === "rejected" && isSameDay(r.decided_at, now)).length;

  // ── Processing latency ────
  const finished = runs.filter((r) => r.finished_at);
  const latencies = finished
    .map((r) => (new Date(r.finished_at as string).getTime() - new Date(r.started_at).getTime()) / 1000)
    .filter((n) => n >= 0 && n < 3600);
  const avgProcSec = latencies.length > 0
    ? Math.round((latencies.reduce((a, b) => a + b, 0) / latencies.length) * 10) / 10
    : null;

  // ── AI-call reduction ────
  // "Saved" = decisions that DIDN'T hit an LLM. Baseline assumes without KPE
  // every decision would have gone to a frontier LLM.
  const aiTouched = (distCounts.local_llm ?? 0) + (distCounts.frontier_llm ?? 0);
  const aiSaved = totalDecisions - aiTouched;
  const aiReductionPct = totalDecisions > 0 ? Math.round((aiSaved / totalDecisions) * 1000) / 10 : 0;

  // ── Pending review rows ────
  const pendingRows: PendingDecisionRow[] = pending.slice(0, 20).map((p) => ({
    chunk_id: p.chunk_id,
    document_title: p.document_title,
    classifier_label: p.classifier_label,
    classifier_confidence: p.classifier_confidence,
    age_hours: Math.round((now.getTime() - new Date(p.decided_at).getTime()) / (60 * 60 * 1000) * 10) / 10,
    reason: p.reason,
    chunk_excerpt: p.chunk_content.slice(0, 240),
  }));
  const waitingOver7d = pending.filter((p) => new Date(p.decided_at).getTime() < sevenDaysAgoMs).length;

  // ── Recent decisions timeline (last 20) ────
  // Cost order (cheap → expensive): rule_engine · no_ai · human_review · local_llm · frontier_llm
  // A "cheaper route available" is any eligible tier that comes earlier in this list than the chosen one.
  const costOrder: Record<string, number> = {
    skip: 0, rule_engine: 1, no_ai: 2, human_review: 3, local_llm: 4, frontier_llm: 5,
  };
  const recent = decisions
    .slice()
    .sort((a, b) => (a.decided_at < b.decided_at ? 1 : -1))
    .slice(0, 20)
    .map((d) => {
      const alternatives = d.alternatives_considered ?? [];
      const chosenCost = costOrder[d.route.tier] ?? 99;
      const cheaperAvailable = alternatives.some(
        (a) => a.eligible && (costOrder[a.tier] ?? 99) < chosenCost && a.tier !== d.route.tier,
      );
      return {
        chunk_id: d.chunk_id,
        tier: d.route.tier,
        decided_at: d.decided_at,
        provider_used: d.provider_used,
        latency_ms: d.latency_ms,
        reason: d.route.reason,
        cost_gbp: d.cost_estimate_gbp ?? 0,
        alternatives,
        cheaper_route_available: cheaperAvailable,
      };
    });

  // ── Real cost incurred ────
  const totalCost = decisions.reduce((n, d) => n + (d.cost_estimate_gbp ?? 0), 0);

  // Also fix the earlier "skipped" bug I flagged — count from runs with 0
  // chunks (short-circuited duplicate detection never writes a decision).
  const skippedFromRuns = runs.filter((r) => r.chunks_created === 0 && r.final_outcome === "success").length;

  const counters: DashboardCounters = {
    received: runsToday.length,
    skipped: skippedFromRuns,             // now counts short-circuited dupes
    rule_engine: (distCounts.rule_engine ?? 0),
    no_ai: (distCounts.no_ai ?? 0),
    local_llm: (distCounts.local_llm ?? 0),
    frontier_llm: (distCounts.frontier_llm ?? 0),
    human_review: (distCounts.human_review ?? 0),
    approved_today: approvedToday,
    rejected_today: rejectedToday,
    pending: qStats.pending,
    waiting_over_7d: waitingOver7d,
    avg_processing_seconds: avgProcSec,
    ai_calls_saved: aiSaved,
    ai_call_reduction_pct: aiReductionPct,
    total_ai_cost_gbp: Math.round(totalCost * 10000) / 10000,   // 4-decimal precision
  };

  return {
    counters,
    distribution,
    pending: pendingRows,
    recent_decisions: recent,
    generated_at: now.toISOString(),
  };
}
