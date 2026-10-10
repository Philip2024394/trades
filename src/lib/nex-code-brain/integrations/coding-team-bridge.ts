// NEX Code Brain · Coding-Team bridge
// Founder-authorised in Wave 1 (2026-09-15).
//
// Purpose: give the coding-team runtime a way to (optionally) route through
// the Code Brain lease system without changing runtime.ts or dispatch/route.ts.
// Callers explicitly invoke these helpers · legacy callers see zero change.
//
// The assignment_id is stored in a side-car file under the run's own artifacts
// directory (already owned by nex-coding-primary lane) so we do NOT mutate the
// manifest schema and do NOT touch any protected path.
//
// NO NEW ORCHESTRATOR · NO NEW DISPATCHER · NO NEW NEX1.

import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import { requestWork, completeWork } from "../brain";
import type { WorkRequestResult, WorkAcceptance } from "../types";

const REPO_ROOT = process.cwd();
const DEFAULT_QUEUE_TTL_SECONDS = 3600; // 1 hour · covers slow external executors

export interface GuardInput {
  readonly run_id: string;
  readonly paths: readonly string[];
  readonly founder_prompt: string;
  readonly title?: string;
  readonly ttl_seconds?: number;
  readonly holder_agent_id?: string;
  readonly requested_by?: string;
}

export type GuardOutcome =
  | {
      readonly ok: true;
      readonly assignment_id: string;
      readonly lease_id: string;
      readonly lane: string;
      readonly stage_classification: "REAL";
    }
  | {
      readonly ok: false;
      readonly reason: string;
      readonly kind: string;
      readonly stage_classification: "REJECTED";
      readonly details?: unknown;
    };

function sidecarPath(run_id: string): string {
  return path.join(REPO_ROOT, "data", "nex-coding-team", "runs", run_id, "brain-assignment.json");
}

function saveAssignmentSidecar(run_id: string, payload: { assignment_id: string; lease_id: string; lane: string }): void {
  const p = sidecarPath(run_id);
  const dir = path.dirname(p);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const tmp = p + ".tmp";
  writeFileSync(tmp, JSON.stringify({ ...payload, saved_at: new Date().toISOString() }, null, 2), "utf8");
  renameSync(tmp, p);
}

function loadAssignmentSidecar(run_id: string): { assignment_id: string; lease_id: string; lane: string } | null {
  const p = sidecarPath(run_id);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as { assignment_id: string; lease_id: string; lane: string };
  } catch {
    return null;
  }
}

function removeSidecar(run_id: string): void {
  const p = sidecarPath(run_id);
  if (existsSync(p)) {
    try {
      unlinkSync(p);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Called BEFORE a coding-team run starts executing agents.
 * Requests a Code Brain assignment · returns the lease if paths route cleanly.
 * On CROSS_LANE or WRONG_LANE the caller MUST NOT proceed with the run.
 */
export function guardCodingTeamRun(input: GuardInput): GuardOutcome {
  const req = {
    task_id: input.run_id,
    title: input.title ?? input.founder_prompt.slice(0, 80),
    paths: input.paths,
    hint: input.founder_prompt,
    requested_by: input.requested_by ?? "coding-team-bridge",
    ttl_seconds: input.ttl_seconds ?? DEFAULT_QUEUE_TTL_SECONDS,
    holder_agent_id: input.holder_agent_id,
  };
  const result: WorkRequestResult = requestWork(req);
  if (!result.ok) {
    const kind = "kind" in result ? String(result.kind) : "REJECTED";
    return {
      ok: false,
      reason: result.reason,
      kind,
      stage_classification: "REJECTED",
      details: result,
    };
  }
  const acceptance = result as WorkAcceptance;
  saveAssignmentSidecar(input.run_id, {
    assignment_id: acceptance.assignment.assignment_id,
    lease_id: acceptance.lease.lease_id,
    lane: acceptance.lane,
  });
  return {
    ok: true,
    assignment_id: acceptance.assignment.assignment_id,
    lease_id: acceptance.lease.lease_id,
    lane: acceptance.lane,
    stage_classification: "REAL",
  };
}

export type ReleaseOutcome =
  | { readonly ok: true; readonly outcome: "completed" | "abandoned"; readonly stage_classification: "REAL" | "NOT_APPLICABLE" }
  | { readonly ok: false; readonly reason: string; readonly stage_classification: "REJECTED" };

/**
 * Called at every terminal transition of a coding-team run · idempotent.
 * If the run had no brain assignment (legacy run · non-queue mode), returns
 * ok=true with stage_classification=NOT_APPLICABLE so callers can ignore.
 */
export function releaseCodingTeamRun(run_id: string, outcome: "completed" | "abandoned"): ReleaseOutcome {
  const sidecar = loadAssignmentSidecar(run_id);
  if (!sidecar) {
    return { ok: true, outcome, stage_classification: "NOT_APPLICABLE" };
  }
  const r = completeWork(sidecar.assignment_id, outcome);
  if (!r.ok) {
    // Idempotency: if the assignment is already closed, treat as success.
    if (r.reason && /already/.test(r.reason)) {
      removeSidecar(run_id);
      return { ok: true, outcome, stage_classification: "REAL" };
    }
    return { ok: false, reason: r.reason ?? "unknown", stage_classification: "REJECTED" };
  }
  removeSidecar(run_id);
  return { ok: true, outcome, stage_classification: "REAL" };
}

/** Read the assignment side-car (for tests + diagnostic surfaces). */
export function readAssignmentSidecar(run_id: string): { assignment_id: string; lease_id: string; lane: string } | null {
  return loadAssignmentSidecar(run_id);
}
