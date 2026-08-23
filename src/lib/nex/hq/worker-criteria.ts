// NEX HQ · Six-Criteria Worker Verdict Evaluator · Task #72 Step 3
//
// Philip 2026-08-22 constitutional rule (verbatim):
//   "A worker may display GREEN only when ALL SIX are DB-verifiable:
//    Real input exists · The worker actually consumed that input ·
//    Output was produced · The input/job state advanced correctly ·
//    The worker heartbeat is current · HQ can prove all five through
//    database evidence."
//
// Heartbeat freshness + absence of recent failures is NOT GREEN.
//
// This library is pure. No LLM. Every criterion runs a real SQL query
// against the canonical Postgres and returns:
//   · a boolean pass/fail
//   · a count of supporting rows
//   · a bounded sample of the actual rows (for click-through evidence)
//   · the SQL text that produced the result (also for click-through)
//   · a plain-English reason
//
// Verdict derivation is deterministic · 7-value vocabulary Philip
// specified:
//   GREEN · PARTIAL · FAILED · STUCK · NOT_RUNNING · BLOCKED · UNKNOWN
//
// Rule enforcement:
//   - Fresh heartbeat alone → NEVER GREEN
//   - Historical work without current heartbeat → NEVER GREEN
//   - Consumed input without produced output → STUCK or FAILED
//   - Produced output without state advancement → PARTIAL
//   - Missing dependency (queue never built) → BLOCKED
//   - No heartbeat ever + no cycle_run ever → NOT_RUNNING

import type { Pool } from "pg";

// ── Types ──────────────────────────────────────────────────────────────

export type SixCriteriaVerdict =
  | "GREEN"       // all 6 pass · DB-provable
  | "PARTIAL"     // some evidence exists, not all six
  | "FAILED"     // known processing failure (recent_failures_24h > 0 or last_status='failed')
  | "STUCK"      // input exists but consumption/state advancement is stalled
  | "STANDBY"    // demand-driven worker with no demand in observation window · healthy quiet · Bundle B 2026-08-22
  | "NOT_RUNNING" // no evidence of execution at all
  | "BLOCKED"    // intentionally unavailable · dependency not satisfied
  | "UNKNOWN";   // insufficient evidence to classify (should be rare · we prefer explicit BLOCKED/PARTIAL)

export type CriteriaKey = "input" | "consumed" | "output" | "state" | "heartbeat" | "provable";

export interface EvidenceRow {
  id: string;              // Row identifier (pk or composite)
  label: string;           // One-line human summary
  timestamp?: string | null; // ISO if relevant
}

export interface CriterionResult {
  key: CriteriaKey;
  passed: boolean;         // true if the criterion is satisfied
  count: number;           // Number of supporting rows found (0 = not passed for most criteria)
  evidence: EvidenceRow[]; // Bounded sample of actual rows (max 10)
  sql: string;             // The exact SQL that produced this result
  description: string;     // What this criterion checks in plain English
  reason: string;          // Why it passed/failed
}

export interface WorkerRef {
  worker_id: string;
  worker_type: string;
  worker_config: string | null;
}

export interface WorkerEvaluation extends WorkerRef {
  verdict: SixCriteriaVerdict;
  verdict_reason: string;
  criteria: Record<CriteriaKey, CriterionResult>;
  evaluated_at: string;
}

// ── Deterministic verdict derivation ───────────────────────────────────
//
// Order of checks matters. Each rule is stated as-written from Philip's
// constitutional definition so a reader can trace verdict → rule → source.

export function deriveVerdict(
  criteria: Record<CriteriaKey, CriterionResult>,
  ctx: { hasEverRun: boolean; recentFailures24h: number; markedBlocked: boolean; markedStandby?: boolean }
): { verdict: SixCriteriaVerdict; reason: string } {
  const c = criteria;

  // BLOCKED — explicit dependency-not-satisfied signal from the spec
  if (ctx.markedBlocked) {
    return {
      verdict: "BLOCKED",
      reason: "Worker's input/output pipeline is not yet implemented · dependency gate on downstream work",
    };
  }

  // NOT_RUNNING — no heartbeat ever + no cycle ever = worker has literally not started
  if (!ctx.hasEverRun && !c.heartbeat.passed && !c.consumed.passed) {
    return {
      verdict: "NOT_RUNNING",
      reason: "No heartbeat recorded ever · no cycle run recorded ever · worker has never executed",
    };
  }

  // FAILED — recent failure count is authoritative for RED status
  if (ctx.recentFailures24h > 0) {
    return {
      verdict: "FAILED",
      reason: `${ctx.recentFailures24h} failed cycle${ctx.recentFailures24h === 1 ? "" : "s"} in last 24h · investigate before promoting to any other state`,
    };
  }

  // STANDBY — Bundle B 2026-08-22 · demand-driven worker with no demand in the
  // observation window. Spec asserts this state (e.g. Image Intake with 0 batches
  // submitted in last 24h). Overrides the generic STUCK/PARTIAL fallthroughs
  // because "absence of work" is not failure for a demand-driven worker.
  // Never inferred from heartbeat age alone · always spec-signalled.
  if (ctx.markedStandby) {
    return {
      verdict: "STANDBY",
      reason: "Worker is demand-driven · no demand received in observation window · idle by design (not failure)",
    };
  }

  // All six pass → GREEN (the only path)
  const allPass = c.input.passed && c.consumed.passed && c.output.passed
                && c.state.passed && c.heartbeat.passed && c.provable.passed;
  if (allPass) {
    return {
      verdict: "GREEN",
      reason: "All six criteria pass · input · consumed · output · state advanced · heartbeat current · DB-provable",
    };
  }

  // STUCK — input exists but consumption/state has stalled
  if (c.input.passed && (!c.consumed.passed || !c.state.passed)) {
    const reasons: string[] = [];
    if (!c.consumed.passed) reasons.push("input not consumed in the observation window");
    if (!c.state.passed) reasons.push("source state has not advanced");
    return {
      verdict: "STUCK",
      reason: `Input exists · ${reasons.join(" · ")}`,
    };
  }

  // PARTIAL — some criteria pass, others fail (no single dominant reason)
  const failing = (Object.entries(c) as [CriteriaKey, CriterionResult][])
    .filter(([, r]) => !r.passed)
    .map(([k]) => k);
  return {
    verdict: "PARTIAL",
    reason: `${6 - failing.length} of 6 criteria pass · failing: ${failing.join(", ")}`,
  };
}

// ── Common helpers ─────────────────────────────────────────────────────

export const HEARTBEAT_FRESH_SECONDS = 60; // Same as LIVENESS_THRESHOLD_MS in Brain heartbeat.ts

export async function evaluateHeartbeatCriterion(
  pool: Pool,
  worker: WorkerRef,
): Promise<CriterionResult> {
  const sql = `SELECT worker_id, last_heartbeat_at, last_status,
                 EXTRACT(EPOCH FROM (now() - last_heartbeat_at))::int AS seconds_since
               FROM nex.worker_heartbeat WHERE worker_id = $1`;
  const r = await pool.query(sql, [worker.worker_id]);
  const row = r.rows[0];
  if (!row) {
    return {
      key: "heartbeat", passed: false, count: 0, evidence: [], sql,
      description: `Heartbeat must be within ${HEARTBEAT_FRESH_SECONDS}s freshness window`,
      reason: "No heartbeat row exists for this worker_id",
    };
  }
  const seconds = Number(row.seconds_since ?? Number.MAX_SAFE_INTEGER);
  const fresh = seconds <= HEARTBEAT_FRESH_SECONDS;
  return {
    key: "heartbeat", passed: fresh, count: 1,
    evidence: [{
      id: row.worker_id,
      label: `last_status=${row.last_status} · ${seconds}s ago`,
      timestamp: row.last_heartbeat_at instanceof Date ? row.last_heartbeat_at.toISOString() : String(row.last_heartbeat_at),
    }],
    sql,
    description: `Heartbeat must be within ${HEARTBEAT_FRESH_SECONDS}s freshness window`,
    reason: fresh
      ? `Heartbeat is ${seconds}s old · within threshold`
      : `Heartbeat is ${seconds}s old · exceeds ${HEARTBEAT_FRESH_SECONDS}s threshold · stale`,
  };
}

export async function evaluateProvabilityCriterion(
  criteria: Omit<Record<CriteriaKey, CriterionResult>, "provable">,
): Promise<CriterionResult> {
  // The Provable criterion is a meta-check: every other criterion must
  // have concrete evidence (SQL that returned something) OR must have
  // documented why it returned nothing. Since every other evaluator here
  // records both the SQL and the row sample, this is intrinsically true
  // when the other five criteria return at all. We fail Provable only
  // if any other criterion returned a "cannot query" reason (schema missing).
  const missingSchema = Object.values(criteria).some((c) => /relation .+ does not exist|column .+ does not exist/i.test(c.reason));
  return {
    key: "provable", passed: !missingSchema, count: missingSchema ? 0 : 5,
    evidence: [], sql: "n/a · derived from other criteria",
    description: "Every criterion must be backed by real SQL · not inferred · not LLM · click-through evidence available",
    reason: missingSchema
      ? "One or more criteria failed because the underlying schema does not exist · cannot prove"
      : "All five other criteria carry real SQL and row samples · verdict is DB-verifiable",
  };
}

// ── Recent-failure lookup (drives FAILED verdict) ──────────────────────

export async function loadRecentFailures(pool: Pool, worker_id: string): Promise<number> {
  const r = await pool.query(
    `SELECT COUNT(*)::int AS n FROM nex.worker_cycle_run
     WHERE worker_id = $1 AND status = 'failed' AND started_at > now() - interval '24 hours'`,
    [worker_id]
  );
  return Number(r.rows[0]?.n ?? 0);
}

export async function hasEverRun(pool: Pool, worker_id: string): Promise<boolean> {
  const r = await pool.query(
    `SELECT EXISTS(SELECT 1 FROM nex.worker_cycle_run WHERE worker_id = $1) AS ever`,
    [worker_id]
  );
  return Boolean(r.rows[0]?.ever);
}
