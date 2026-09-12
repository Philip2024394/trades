// src/lib/nex/workforce/positions.ts
//
// NEX SPECIALIST WORKFORCE · Position Registry
// (Philip 2026-09-05 · corrective authorization for Indonesian specialist workforce)
//
// A "position" is a named specialist responsibility with owned knowledge,
// bound to existing NEX acquisition machinery (walkers OR the P1 REDIRECT
// pipeline). Positions do NOT create new agents — they map responsibilities
// onto existing machinery per the suitability-audit finding.
//
// COMPOSITION with prior doctrines:
//   · Op-Truth §16: positions NEVER set their own status · status derived from
//     evidence in append-only run history
//   · P1 REDIRECT: acquisition machinery reused as substrate
//   · Slice #7 Founder Identity: positions never make state-changing
//     modifications outside NEX governance
//   · P0 LOCKED hierarchy: positions provide bounded reasoning context ·
//     LLM speaks · NEX verifies
//
// KNOWLEDGE OWNERSHIP: each position declares which acquisition machinery
// it uses + which source registry it draws from. Knowledge acquired under a
// position is tagged with position_id in the promoted-knowledge stream so
// retrieval can filter by active conversational context.
//
// This file is data-shape + registry access only. Actual acquisition
// happens through the existing pipeline (P1) or existing walkers.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ─── Position types ──────────────────────────────────────────────

/** The 6 initial NEX specialist positions per Philip 2026-09-05.
 *  Programmer is included but registered as PHASE_A_PENDING · not
 *  activated in the Indonesian-workforce slice. */
export type PositionId =
  | "programmer"
  | "indonesia_knowledge"
  | "hotel_accommodation"
  | "restaurant_food"
  | "gym_fitness"
  | "travel_transport";

/** Acquisition machinery this position binds to. */
export type MachineryKind =
  | "indonesia_walker"       // existing scripts/walkers/run-indonesia-walkers.mjs
  | "p1_acquisition_pipeline" // src/lib/nex/knowledge-acquisition/pipeline.ts
  | "programmer_agent"       // FUTURE · not yet built · Phase A pending
  | "none";                  // registered but no machinery bound (NEVER PROVEN by default)

/** Source availability check outcome · determined at position-registration time. */
export type SourceAvailability =
  | "sources_available"          // local source material exists · position can attempt acquisition
  | "sources_missing"            // no local source · needs external data before activation
  | "sources_via_supabase"       // sources live in Supabase · need DB read to acquire
  | "sources_partial";           // some sources available · not all domains covered

export type Position = {
  position_id: PositionId;
  mission: string;                    // one-sentence responsibility
  domain: string[];                   // knowledge domains covered
  machinery: MachineryKind;
  source_availability: SourceAvailability;
  source_details: string;             // what source(s) exist or don't
  walker_taxonomy_ids?: string[];     // when machinery=indonesia_walker
  pipeline_source_ids?: string[];     // when machinery=p1_acquisition_pipeline
  activation_notes: string;           // honest note on what's needed to activate
  registered_at: string;              // ISO
};

/** Per-position run record · append-only history for Op-Truth compliance. */
export type PositionRun = {
  run_id: string;
  position_id: PositionId;
  started_at: string;
  last_progress_at: string;
  completed_at: string | null;
  machinery_used: MachineryKind;
  sources_accessed: string[];
  snapshots_created: number;
  claims_extracted: number;
  claims_verified: number;
  claims_rejected: number;
  claims_promoted: number;
  failure_stage: string | null;
  failure_reason: string | null;
  evidence_pointers: string[];
  /** ALWAYS null in the persisted record · derived by deriveStatus per Op-Truth §OP.5. */
  final_status: null;
};

/** Position operational status · evidence-derived · never self-asserted. */
export type PositionStatus =
  | "PROVEN_HEALTHY"     // at least one successful run · recent · verification rate acceptable
  | "DEGRADED"           // ran but with failures/rejections beyond tolerance
  | "FAILED"             // recovery exhausted OR silence exceeds deadline OR last-success stale
  | "NEVER_PROVEN"       // registered but never demonstrated successful acquisition
  | "PHASE_A_PENDING"    // registered but implementation phase not yet authorized (Programmer only for now)
  | "RECOVERING";

// ─── Storage layout ──────────────────────────────────────────────

function workforceDir(): string {
  // Test-isolation override · Slice A0 (2026-09-07 · Philip).
  // Vitest sets `NEX_WORKFORCE_DATA_ROOT` to a per-test temp dir before every
  // test so `workforce.test.ts` can never overwrite production data/workforce/.
  // Production behavior is unchanged when the env var is absent · the default
  // resolves to the repo's data/workforce/ exactly as before.
  //
  // Mirrors the same pattern in src/lib/nex/agent-runtime/paths.ts::runtimeDataRoot().
  const override = process.env.NEX_WORKFORCE_DATA_ROOT;
  if (override && override.length > 0) return override;
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../../../../data/workforce");
}

const P_POSITIONS = () => path.join(workforceDir(), "positions.json");
const P_RUNS = () => path.join(workforceDir(), "runs.json");

function ensureDir(): void {
  const dir = workforceDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function readJson<T>(p: string, fallback: T): T {
  try {
    if (!existsSync(p)) return fallback;
    return JSON.parse(readFileSync(p, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(p: string, data: unknown): void {
  ensureDir();
  writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf8");
}

// ─── Registry API ────────────────────────────────────────────────

export function listPositions(): Position[] {
  return readJson<Position[]>(P_POSITIONS(), []);
}

export function getPosition(id: PositionId): Position | null {
  return listPositions().find((p) => p.position_id === id) ?? null;
}

export function registerPosition(position: Position): void {
  const existing = listPositions();
  const idx = existing.findIndex((p) => p.position_id === position.position_id);
  if (idx >= 0) existing[idx] = position;
  else existing.push(position);
  writeJson(P_POSITIONS(), existing);
}

export function readRuns(): PositionRun[] {
  return readJson<PositionRun[]>(P_RUNS(), []);
}

export function persistRun(run: PositionRun): void {
  const existing = readRuns();
  const idx = existing.findIndex((r) => r.run_id === run.run_id);
  if (idx >= 0) existing[idx] = run;
  else existing.push(run);
  writeJson(P_RUNS(), existing);
}

export function readRunsForPosition(id: PositionId): PositionRun[] {
  return readRuns().filter((r) => r.position_id === id);
}

// ─── Status derivation (Op-Truth compliant · never self-asserted) ─

export type StatusResult = {
  position_id: PositionId;
  status: PositionStatus;
  reason: string;
  evidence: {
    total_runs: number;
    last_run_at: string | null;
    last_successful_run_at: string | null;
    verification_rate: number | null;
    claims_promoted_total: number;
  };
};

/** Derive status per position from the append-only run history.
 *  Pure function · no I/O beyond loading persisted evidence. */
export function derivePositionStatus(positionId: PositionId, nowMs = Date.now()): StatusResult {
  const position = getPosition(positionId);
  const runs = readRunsForPosition(positionId);

  const evidence = {
    total_runs: runs.length,
    last_run_at: runs.length > 0 ? runs[runs.length - 1].started_at : null,
    last_successful_run_at: null as string | null,
    verification_rate: null as number | null,
    claims_promoted_total: 0,
  };

  // Programmer Agent registered as PHASE_A_PENDING · not activated yet
  if (position?.machinery === "programmer_agent") {
    return {
      position_id: positionId,
      status: "PHASE_A_PENDING",
      reason: "Programmer Agent registered · formal spec accepted · Phase A implementation requires its own AUTHORIZE literal · not activated in Indonesian-workforce slice",
      evidence,
    };
  }

  // No runs ever
  if (runs.length === 0) {
    return {
      position_id: positionId,
      status: "NEVER_PROVEN",
      reason: position
        ? `position registered but no acquisition runs recorded · ${position.activation_notes}`
        : "position not registered",
      evidence,
    };
  }

  // Compute signals
  const successful = runs.filter((r) => r.completed_at !== null && r.failure_stage === null);
  evidence.last_successful_run_at = successful.length > 0 ? successful[successful.length - 1].completed_at : null;
  evidence.claims_promoted_total = runs.reduce((s, r) => s + r.claims_promoted, 0);
  const totalClaims = runs.reduce((s, r) => s + r.claims_extracted, 0);
  const verified = runs.reduce((s, r) => s + r.claims_verified, 0);
  evidence.verification_rate = totalClaims > 0 ? verified / totalClaims : null;

  const staleProgressMs = 24 * 60 * 60 * 1000; // 24h
  const workDeadlineMs = 30 * 24 * 60 * 60 * 1000; // 30 days

  // Stale progress detection
  const staleRuns = runs.filter((r) => {
    if (r.completed_at) return false;
    const progressAt = Date.parse(r.last_progress_at);
    return Number.isFinite(progressAt) && nowMs - progressAt > staleProgressMs;
  });
  if (staleRuns.length > 0) {
    return {
      position_id: positionId,
      status: "FAILED",
      reason: `${staleRuns.length} stale run(s) · silence detected beyond ${staleProgressMs / 60000}min threshold`,
      evidence,
    };
  }

  // No successful runs yet
  if (successful.length === 0) {
    return {
      position_id: positionId,
      status: "NEVER_PROVEN",
      reason: `${runs.length} run attempts · zero successful completions`,
      evidence,
    };
  }

  // Work deadline check
  const lastSuccessMs = Date.parse(evidence.last_successful_run_at!);
  if (Number.isFinite(lastSuccessMs) && nowMs - lastSuccessMs > workDeadlineMs) {
    return {
      position_id: positionId,
      status: "FAILED",
      reason: `last successful run ${Math.round((nowMs - lastSuccessMs) / (24 * 60 * 60 * 1000))} days ago · exceeds 30-day work deadline`,
      evidence,
    };
  }

  // Verification-rate check
  const minRate = 0.5;
  if (evidence.verification_rate !== null && evidence.verification_rate < minRate) {
    return {
      position_id: positionId,
      status: "DEGRADED",
      reason: `verification rate ${(evidence.verification_rate * 100).toFixed(0)}% below ${(minRate * 100).toFixed(0)}% threshold`,
      evidence,
    };
  }

  return {
    position_id: positionId,
    status: "PROVEN_HEALTHY",
    reason: `last successful run at ${evidence.last_successful_run_at} · verification rate ${evidence.verification_rate !== null ? (evidence.verification_rate * 100).toFixed(0) + "%" : "n/a"} · ${evidence.claims_promoted_total} claims promoted total`,
    evidence,
  };
}

export function deriveAllPositionStatuses(nowMs = Date.now()): StatusResult[] {
  const positions = listPositions();
  return positions.map((p) => derivePositionStatus(p.position_id, nowMs));
}

// ─── Test hook ───────────────────────────────────────────────────

export function _resetWorkforceStateForTests(): void {
  writeJson(P_POSITIONS(), []);
  writeJson(P_RUNS(), []);
}
