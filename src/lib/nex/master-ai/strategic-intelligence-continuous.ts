// src/lib/nex/master-ai/strategic-intelligence-continuous.ts
//
// Phase 11 · Strategic intelligence · continuous operation
// Philip 2026-09-08 · AUTHORIZE Phase 11
//
// Extends Phase 6's one-shot strategic-intelligence with:
//   · classifyRecommendation (opportunity / risk / neutral · deterministic)
//   · fingerprintRecommendation (stable dedup key across cycles)
//   · persistRecommendations (append-only ledger with dedup)
//   · detectTrends (recs appearing across N cycles = trend)
//   · generateWeeklyRollup (aggregated view over trailing 7 days)
//   · runStrategicCycle (compose all · optional dry-run mode)
//
// DISCIPLINE:
//   · Strategic recommendations are OBSERVATIONS · never actions
//   · Persistence is to Master AI's own ledger namespace
//     (data/master-ai/strategic_recommendations.jsonl) · not to any
//     production code path · fully readable by future analysis
//   · Every persisted record still carries requires_founder_approval: true
//   · Dry-run mode for tests · zero side effects
//   · Trend detection is over the RECOMMENDATION ledger · not the source
//     ledgers · so trends reflect stability of Master AI's recommendations
//     not just noise in raw evidence

import { existsSync, appendFileSync, readFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import {
  deriveStrategicRecommendations,
  type StrategicRecommendation,
} from "./strategic-intelligence";

// ─── Types ──────────────────────────────────────────────

export type RecommendationClass = "opportunity" | "risk" | "neutral";

export type ClassifiedRecommendation = StrategicRecommendation & {
  classification: RecommendationClass;
  fingerprint: string;              // stable id for dedup + trend detection
  first_seen_iso?: string;          // when this fingerprint first appeared in the ledger
  cycles_observed?: number;         // how many cycles this exact rec has appeared
};

export type WeeklyRollup = {
  generated_at_iso: string;
  window_start_iso: string;
  window_end_iso: string;
  total_recommendations_in_window: number;
  by_classification: Record<RecommendationClass, number>;
  by_confidence: Record<string, number>;
  trending_recommendations: Array<{
    fingerprint: string;
    generator: string;
    hypothesis_excerpt: string;
    cycles_observed: number;
    first_seen_iso: string;
    last_seen_iso: string;
    latest_confidence: string;
    latest_classification: RecommendationClass;
  }>;
  new_this_cycle: number;
  stable_recommendations: number;    // seen in > 1 cycle
};

export type StrategicCycleResult = {
  cycle_id: string;
  cycle_started_iso: string;
  cycle_completed_iso: string;
  recommendations: ClassifiedRecommendation[];
  weekly_rollup: WeeklyRollup;
  persisted: boolean;
  ledger_path: string;
};

// ─── Classification (deterministic keyword-based) ──────

const RISK_KEYWORDS = [
  "failure", "crash", "error", "fault", "broken", "regression",
  "leakage", "vulnerability", "outdated", "stale", "contradiction",
  "block", "exhaust", "cap", "over", "unbounded", "runaway",
];

const OPPORTUNITY_KEYWORDS = [
  "promote", "approve", "activate", "authorize", "start", "close",
  "improve", "extend", "adopt", "accept",
];

export function classifyRecommendation(rec: StrategicRecommendation): RecommendationClass {
  const text = (rec.hypothesis + " " + rec.decision_it_would_change + " " + rec.generator).toLowerCase();
  let riskHits = 0;
  let oppHits = 0;
  for (const k of RISK_KEYWORDS) if (text.includes(k)) riskHits += 1;
  for (const k of OPPORTUNITY_KEYWORDS) if (text.includes(k)) oppHits += 1;
  if (riskHits > oppHits) return "risk";
  if (oppHits > riskHits) return "opportunity";
  return "neutral";
}

// ─── Fingerprint (stable across cycles for the SAME logical rec) ─
//
// Two recs are "the same" when they share:
//   · generator prefix (e.g. "REC-A")
//   · the primary evidence identifier (first evidence_ref.identifier)
//   · the decision they would change (same string)
// The fingerprint is a SHA-256 truncated to 16 hex chars of those 3 fields.
// This intentionally IGNORES timestamps, confidence, and steelman text so
// re-generating on the next cycle produces the same fingerprint for the
// same underlying observation.

export function fingerprintRecommendation(rec: StrategicRecommendation): string {
  const generator = rec.generator.split("·")[0].trim();   // "REC-A" · not the whole label
  const primaryEvidence = rec.evidence_refs[0]?.identifier ?? "no_evidence";
  const decision = rec.decision_it_would_change;
  const composite = `${generator}|${primaryEvidence}|${decision}`;
  return createHash("sha256").update(composite).digest("hex").slice(0, 16);
}

// ─── Persistence ────────────────────────────────────────

function strategicRecommendationsLedgerPath(repoRoot?: string): string {
  const root = repoRoot ?? process.cwd();
  return path.join(root, "data", "master-ai", "strategic_recommendations.jsonl");
}

function ensureLedgerDir(p: string): void {
  const dir = path.dirname(p);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function readPastRecords(ledgerPath: string): ClassifiedRecommendation[] {
  if (!existsSync(ledgerPath)) return [];
  const raw = readFileSync(ledgerPath, "utf8");
  const out: ClassifiedRecommendation[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(JSON.parse(t) as ClassifiedRecommendation); }
    catch { /* skip malformed · never crash caller */ }
  }
  return out;
}

/** Append classified recs to the ledger. Idempotent per fingerprint:
 *  a fingerprint already seen in the last 6h is skipped (dedup window).
 *  Older sightings of the same fingerprint are kept (append-only history
 *  preserves the trend evidence). */
export function persistRecommendations(
  recs: ClassifiedRecommendation[],
  opts: { repoRoot?: string; dedupWindowHours?: number } = {},
): { appended: number; skipped_dedup: number } {
  const ledgerPath = strategicRecommendationsLedgerPath(opts.repoRoot);
  ensureLedgerDir(ledgerPath);
  const dedupWindow = (opts.dedupWindowHours ?? 6) * 60 * 60 * 1000;
  const past = readPastRecords(ledgerPath);
  const nowMs = Date.now();
  const recentByFp = new Map<string, ClassifiedRecommendation>();
  for (const p of past) {
    const ts = new Date(p.created_at_iso).getTime();
    if (!Number.isNaN(ts) && (nowMs - ts) <= dedupWindow) {
      const fp = p.fingerprint ?? "";
      if (!recentByFp.has(fp)) recentByFp.set(fp, p);
    }
  }
  let appended = 0;
  let skipped = 0;
  for (const r of recs) {
    if (recentByFp.has(r.fingerprint)) { skipped += 1; continue; }
    appendFileSync(ledgerPath, JSON.stringify(r) + "\n", "utf8");
    appended += 1;
  }
  return { appended, skipped_dedup: skipped };
}

// ─── Trend detection ────────────────────────────────────

/** For each fingerprint in `current`, count how many times it appears in
 *  `past` (the ledger) · that count = cycles_observed. Sets first_seen_iso. */
export function detectTrends(
  current: ClassifiedRecommendation[],
  past: ClassifiedRecommendation[],
): ClassifiedRecommendation[] {
  const byFp = new Map<string, ClassifiedRecommendation[]>();
  for (const p of past) {
    const fp = p.fingerprint ?? "";
    if (!fp) continue;
    if (!byFp.has(fp)) byFp.set(fp, []);
    byFp.get(fp)!.push(p);
  }
  return current.map((c) => {
    const sightings = byFp.get(c.fingerprint) ?? [];
    const first = sightings.length > 0
      ? sightings.reduce((a, b) => (a.created_at_iso < b.created_at_iso ? a : b))
      : null;
    return {
      ...c,
      cycles_observed: sightings.length + 1,   // include this cycle
      first_seen_iso: first?.created_at_iso ?? c.created_at_iso,
    };
  });
}

// ─── Weekly rollup ──────────────────────────────────────

export function generateWeeklyRollup(
  ledger: ClassifiedRecommendation[],
  now?: Date,
): WeeklyRollup {
  const nowDate = now ?? new Date();
  const nowMs = nowDate.getTime();
  const windowMs = 7 * 24 * 60 * 60 * 1000;
  const windowStartMs = nowMs - windowMs;
  const inWindow = ledger.filter((r) => {
    const t = new Date(r.created_at_iso).getTime();
    return !Number.isNaN(t) && t >= windowStartMs && t <= nowMs;
  });

  const byClass: Record<RecommendationClass, number> = { opportunity: 0, risk: 0, neutral: 0 };
  const byConf: Record<string, number> = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  const fpSeen = new Map<string, ClassifiedRecommendation[]>();
  for (const r of inWindow) {
    byClass[r.classification] = (byClass[r.classification] ?? 0) + 1;
    byConf[r.confidence] = (byConf[r.confidence] ?? 0) + 1;
    const fp = r.fingerprint ?? "";
    if (!fp) continue;
    if (!fpSeen.has(fp)) fpSeen.set(fp, []);
    fpSeen.get(fp)!.push(r);
  }

  const trending: WeeklyRollup["trending_recommendations"] = [];
  for (const [fp, list] of fpSeen) {
    if (list.length < 2) continue;   // trending requires ≥ 2 sightings in the window
    const sorted = list.slice().sort((a, b) => a.created_at_iso.localeCompare(b.created_at_iso));
    const latest = sorted[sorted.length - 1];
    trending.push({
      fingerprint: fp,
      generator: latest.generator,
      hypothesis_excerpt: latest.hypothesis.slice(0, 200),
      cycles_observed: list.length,
      first_seen_iso: sorted[0].created_at_iso,
      last_seen_iso: latest.created_at_iso,
      latest_confidence: latest.confidence,
      latest_classification: latest.classification,
    });
  }
  trending.sort((a, b) => b.cycles_observed - a.cycles_observed);

  const newThis = inWindow.filter((r) => (fpSeen.get(r.fingerprint ?? "")?.length ?? 0) === 1).length;
  const stable = inWindow.filter((r) => (fpSeen.get(r.fingerprint ?? "")?.length ?? 0) > 1).length;

  return {
    generated_at_iso: nowDate.toISOString(),
    window_start_iso: new Date(windowStartMs).toISOString(),
    window_end_iso: nowDate.toISOString(),
    total_recommendations_in_window: inWindow.length,
    by_classification: byClass,
    by_confidence: byConf,
    trending_recommendations: trending,
    new_this_cycle: newThis,
    stable_recommendations: stable,
  };
}

// ─── The full continuous cycle ──────────────────────────

let _cycleId = 0;
function nextCycleId(): string {
  _cycleId += 1;
  return `strat_cycle_${Date.now().toString(36)}_${_cycleId}`;
}

export function runStrategicCycle(opts: { repoRoot?: string; dry_run?: boolean } = {}): StrategicCycleResult {
  const cycle_id = nextCycleId();
  const cycle_started_iso = new Date().toISOString();
  const raw = deriveStrategicRecommendations(opts.repoRoot);
  const ledgerPath = strategicRecommendationsLedgerPath(opts.repoRoot);
  const past = readPastRecords(ledgerPath);

  const classified: ClassifiedRecommendation[] = raw.map((r) => ({
    ...r,
    classification: classifyRecommendation(r),
    fingerprint: fingerprintRecommendation(r),
  }));

  const withTrends = detectTrends(classified, past);

  let persisted = false;
  if (!opts.dry_run) {
    persistRecommendations(withTrends, { repoRoot: opts.repoRoot });
    persisted = true;
  }

  // Rebuild rollup over the ledger PLUS this cycle's persisted recs
  const rollupSource = opts.dry_run
    ? [...past, ...withTrends]
    : readPastRecords(ledgerPath);
  const weekly_rollup = generateWeeklyRollup(rollupSource);

  return {
    cycle_id,
    cycle_started_iso,
    cycle_completed_iso: new Date().toISOString(),
    recommendations: withTrends,
    weekly_rollup,
    persisted,
    ledger_path: ledgerPath,
  };
}
