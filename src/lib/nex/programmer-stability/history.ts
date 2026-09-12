// src/lib/nex/programmer-stability/history.ts
//
// NEX Programmer Agent · Phase E · append-only history store
// Philip 2026-09-05 · AUTHORIZE §11 §22 §25
//
// Historical evaluation records are APPEND-ONLY. Never overwrites a
// prior run. Never mutates a completed run. If a correction is
// necessary, a NEW record is appended referencing the old record's
// id · never in-place edits.
//
// Storage layout under `tests/fixtures/programmer-stability-proof/`
// (default) or NEX_PROGRAMMER_STABILITY_DIR override:
//   runs.jsonl               · append-only StabilityRun headers
//   results/{run_id}.json    · full EvaluationRun body per run

import { existsSync, mkdirSync, readFileSync, appendFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { EvaluationRun } from "@/lib/nex/programmer-benchmark/types";
import type { StabilityRun, StabilityRunBuildInput } from "./types";
import { computeCaseFingerprint } from "./version-manifest";

export function programmerStabilityDir(): string {
  const override = process.env.NEX_PROGRAMMER_STABILITY_DIR;
  if (override && override.trim().length > 0) return override;
  const cwd = process.cwd();
  return path.resolve(cwd, "tests", "fixtures", "programmer-stability-proof", "store");
}

function ensureDir(): void {
  const dir = programmerStabilityDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const resultsDir = path.join(dir, "results");
  if (!existsSync(resultsDir)) mkdirSync(resultsDir, { recursive: true });
}

class ForbiddenPhaseEWrite extends Error {
  constructor(target: string) { super(`Phase-E forbidden write to: ${target}`); }
}

function pathFor(filename: string): string {
  const root = programmerStabilityDir();
  const p = path.resolve(root, filename);
  if (!p.startsWith(root + path.sep) && p !== root) {
    throw new ForbiddenPhaseEWrite(p);
  }
  return p;
}

const RUNS_FILE = "runs.jsonl";

export function generateRunId(): string {
  return `stab_${randomUUID()}`;
}

/** Persist a full EvaluationRun body to results/{run_id}.json and
 *  return the relative pointer for inclusion in the StabilityRun. */
export function persistFullResult(runId: string, evaluation: EvaluationRun): string {
  ensureDir();
  const relPath = path.join("results", `${runId}.json`);
  const abs = pathFor(relPath);
  writeFileSync(abs, JSON.stringify(evaluation, null, 2) + "\n", "utf8");
  return relPath;
}

/** Append a StabilityRun to the append-only log. Enforces
 *  final_status=null (Op-Truth) and refuses to write if a run with
 *  the same id already exists in the log. */
export function appendStabilityRun(run: StabilityRun): void {
  if (run.final_status !== null) {
    throw new Error("Op-Truth violation: StabilityRun.final_status must be null in persisted record");
  }
  const existing = readStabilityRuns();
  if (existing.some((r) => r.run_id === run.run_id)) {
    throw new Error(`historical_mutation_rejected: run_id ${run.run_id} already present · append-only discipline`);
  }
  ensureDir();
  appendFileSync(pathFor(RUNS_FILE), JSON.stringify(run) + "\n", "utf8");
}

/** Read all StabilityRuns · malformed lines skipped · fail-safe. */
export function readStabilityRuns(): StabilityRun[] {
  const p = pathFor(RUNS_FILE);
  if (!existsSync(p)) return [];
  const raw = readFileSync(p, "utf8");
  const out: StabilityRun[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try { out.push(JSON.parse(trimmed) as StabilityRun); }
    catch { /* skip · never crash caller */ }
  }
  return out;
}

/** Read the full EvaluationRun body for a given run_id. Returns null
 *  when the results file is missing (e.g. store was reset). */
export function readFullResult(runId: string): EvaluationRun | null {
  const relPath = path.join("results", `${runId}.json`);
  const abs = pathFor(relPath);
  if (!existsSync(abs)) return null;
  try {
    return JSON.parse(readFileSync(abs, "utf8")) as EvaluationRun;
  } catch { return null; }
}

/** Build a StabilityRun from an EvaluationRun + manifest. Deterministic
 *  fingerprint · caller supplies the run_id (or omits for random). */
export function buildStabilityRun(input: StabilityRunBuildInput): StabilityRun {
  const fingerprint = input.case_fingerprint || computeCaseFingerprint(
    input.evaluation.results.map((r) => ({
      case_id: r.case_id,
      match_status: r.match_status,
      actual_verdict: r.actual_verdict,
      actual_finding_count: r.actual_finding_count,
    })),
  );
  return {
    run_id: input.run_id_override ?? generateRunId(),
    parent_run_id: input.parent_run_id ?? null,
    baseline_run_id: input.baseline_run_id ?? null,
    timestamp: new Date().toISOString(),
    triggered_by: input.triggered_by,
    version_manifest: input.manifest,
    case_fingerprint: fingerprint,
    overall: input.evaluation.overall,
    per_class: input.evaluation.per_class,
    full_result_pointer: input.full_result_pointer,
    notes: input.notes ?? "",
    final_status: null,
  };
}

/** Test helper · deletes the store contents. Never used in production. */
export function _resetStabilityStoreForTests(): void {
  const p = pathFor(RUNS_FILE);
  if (existsSync(p)) writeFileSync(p, "", "utf8");
}

export { ForbiddenPhaseEWrite };
