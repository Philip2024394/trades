// NEX HQ · Reception System Aggregator · Task #72 Step 4
//
// Philip 2026-08-22 constitutional rule:
//   "Reception must be a window into the existing truth, not a new source
//    of truth. Every system status must be derived from the same underlying
//    six-criteria evaluator used by the Workers page."
//
// This file:
//   · Declares the set of SYSTEMS Reception summarises (Acquisition · CLE ·
//     Brain · extendable).
//   · Aggregates verdicts across each system's constituent workers using
//     the SAME evaluateWorker function shipped in Step 3 · never a
//     duplicate evaluation path.
//   · Applies a deterministic precedence rule so the aggregate verdict is
//     testable and reproducible.
//
// Precedence rule (worst-wins over active states · mixed terminal = PARTIAL):
//   1  zero workers in system                                        → NOT_RUNNING
//   2  any worker FAILED                                              → FAILED
//   3  any worker STUCK                                               → STUCK
//   4  any worker PARTIAL                                             → PARTIAL
//   5  any worker UNKNOWN                                             → UNKNOWN
//   6  all workers GREEN                                              → GREEN
//   7  all workers STANDBY                                            → STANDBY    (Bundle B 2026-08-22 · healthy quiet · demand-driven)
//   8  all workers BLOCKED                                            → BLOCKED
//   9  all workers NOT_RUNNING                                        → NOT_RUNNING
//  10  mixed {GREEN, STANDBY, BLOCKED, NOT_RUNNING} in any combo     → PARTIAL
//
// The mix rule (10) is deliberate: a system with 1 GREEN worker and 1 BLOCKED
// worker is NOT fully green · it's partially operational. Reception must be
// honest about that. STANDBY joins the "healthy terminal" set — mixed with
// any other healthy terminal state, we still show PARTIAL to expose the
// heterogeneity honestly.

import type { Pool } from "pg";
import type { SixCriteriaVerdict, WorkerEvaluation } from "./worker-criteria";
import { evaluateWorker, listAllWorkers } from "./evaluate-worker";

export type HqSystemKey = "acquisition" | "cle" | "brain" | "intake" | "social";

export interface HqSystem {
  key: HqSystemKey;
  displayName: string;
  workerTypeFilter: string; // matched against WorkerRef.worker_type
  description: string;
}

// Declared systems for Step 4. Adding a new system = adding an entry here.
// No other code change needed · the aggregator + Reception UI iterate this
// list. Do NOT add data-only systems (Directory, Reliability) here without
// designing their spec first · the current evaluator is worker-based.
export const HQ_SYSTEMS: HqSystem[] = [
  {
    key: "acquisition",
    displayName: "Acquisition · Universal Walker",
    workerTypeFilter: "acquisition",
    description: "Discovers + re-verifies businesses (food · trades · future verticals) via external sources",
  },
  {
    key: "cle",
    displayName: "Conversation Teacher · English + Indonesian",
    workerTypeFilter: "cle",
    description: "Observes real conversations in EN + ID · same six-criteria gates · candidates await admin promotion · never auto-teaches (Task #76 Bundle B 2026-08-22)",
  },
  {
    key: "brain",
    displayName: "Brain workers",
    workerTypeFilter: "brain",
    description: "Six Brain workers: knowledge-context · voice-context · learning-context · knowledge-extractor · image-analyst · quality-checker",
  },
  {
    // Task #77 Bundle C · 2026-08-22 · dedicated spec landed for worker_type='intake'
    key: "intake",
    displayName: "Image Intake",
    workerTypeFilter: "intake",
    description: "Consumes image URL batches via /api/nex-intake/batch · writes knowledge_inbox candidates at status='review' · never auto-teaches · admin promotion via /nex-head-quarters/knowledge-control-centre",
  },
  {
    // Task #77 Bundle C · 2026-08-22 · dedicated spec landed for worker_type='social'
    key: "social",
    displayName: "Post Publishing · Comms Social",
    workerTypeFilter: "social",
    description: "Consumes social_scheduled_posts · 2-phase publish with adapter idempotency · Vercel cron every minute in prod",
  },
];

// ── Pure deterministic aggregation (unit-tested) ───────────────────────

export function aggregateVerdict(verdicts: SixCriteriaVerdict[]): SixCriteriaVerdict {
  if (verdicts.length === 0) return "NOT_RUNNING";
  // Active-state precedence (worst-wins)
  if (verdicts.includes("FAILED"))  return "FAILED";
  if (verdicts.includes("STUCK"))   return "STUCK";
  if (verdicts.includes("PARTIAL")) return "PARTIAL";
  if (verdicts.includes("UNKNOWN")) return "UNKNOWN";
  // All verdicts now in {GREEN, STANDBY, BLOCKED, NOT_RUNNING}
  const allGreen        = verdicts.every((v) => v === "GREEN");
  if (allGreen) return "GREEN";
  const allStandby      = verdicts.every((v) => v === "STANDBY");   // Bundle B 2026-08-22
  if (allStandby) return "STANDBY";
  const allBlocked      = verdicts.every((v) => v === "BLOCKED");
  if (allBlocked) return "BLOCKED";
  const allNotRunning   = verdicts.every((v) => v === "NOT_RUNNING");
  if (allNotRunning) return "NOT_RUNNING";
  // Mixed terminal states = PARTIAL (Rule 10 · honest reporting)
  return "PARTIAL";
}

// ── Reality string (short human-readable summary per system) ───────────

export function realitySummary(evaluations: WorkerEvaluation[]): string {
  if (evaluations.length === 0) return "0 workers registered";
  const counts: Record<string, number> = {};
  for (const e of evaluations) counts[e.verdict] = (counts[e.verdict] ?? 0) + 1;
  const parts = Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([v, n]) => `${n} ${v}`);
  return `${evaluations.length} worker${evaluations.length === 1 ? "" : "s"} · ${parts.join(" · ")}`;
}

// ── Full system evaluation orchestrator ────────────────────────────────

export interface SystemEvaluation {
  system: HqSystem;
  verdict: SixCriteriaVerdict;
  reality: string;
  worker_count: number;
  worker_ids: string[]; // ordered · used for click-through drill into Workers page
  evaluations: WorkerEvaluation[];
  evaluated_at: string;
}

export async function evaluateSystem(
  pool: Pool,
  system: HqSystem,
  allWorkers?: WorkerEvaluation[],
): Promise<SystemEvaluation> {
  // Either use pre-evaluated worker set (avoids double DB work) or evaluate now.
  let workers: WorkerEvaluation[];
  if (allWorkers) {
    workers = allWorkers.filter((w) => w.worker_type === system.workerTypeFilter);
  } else {
    const refs = (await listAllWorkers(pool)).filter((r) => r.worker_type === system.workerTypeFilter);
    workers = await Promise.all(refs.map((r) => evaluateWorker(pool, r)));
  }
  const verdict = aggregateVerdict(workers.map((w) => w.verdict));
  return {
    system,
    verdict,
    reality: realitySummary(workers),
    worker_count: workers.length,
    worker_ids: workers.map((w) => w.worker_id),
    evaluations: workers,
    evaluated_at: new Date().toISOString(),
  };
}

export async function evaluateAllSystems(pool: Pool): Promise<SystemEvaluation[]> {
  // Evaluate all workers ONCE · then bucket into systems · guarantees the
  // Reception view and per-system aggregation use the exact same evaluations.
  const refs = await listAllWorkers(pool);
  const workers = await Promise.all(refs.map((r) => evaluateWorker(pool, r)));
  return Promise.all(HQ_SYSTEMS.map((s) => evaluateSystem(pool, s, workers)));
}
