// src/lib/nex/programmer-improvement/history.ts
//
// NEX Programmer Agent · Phase F · append-only improvement history
// Philip 2026-09-06 · AUTHORIZE · PHASE F · §16 §17 §22
//
// Every learning attempt (promoted OR rejected OR failed) is preserved.
// Historical records are IMMUTABLE. Corrections require a NEW record
// referencing the old record's id · never in-place edits.
//
// Storage layout under NEX_PROGRAMMER_IMPROVEMENT_DIR (default:
// `data/programmer-improvement/`):
//   improvement_runs.jsonl     · append-only run headers
//   candidates.jsonl           · append-only candidate content records
//   runs/{run_id}.json         · full ImprovementRun body per run

import { existsSync, mkdirSync, readFileSync, appendFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type {
  ImprovementRun,
  ImprovementHistoryEntry,
  LearningCandidate,
} from "./types";

export function programmerImprovementDir(): string {
  const override = process.env.NEX_PROGRAMMER_IMPROVEMENT_DIR;
  if (override && override.trim().length > 0) return override;
  const cwd = process.cwd();
  return path.resolve(cwd, "data", "programmer-improvement");
}

class ForbiddenPhaseFWrite extends Error {
  constructor(target: string) { super(`Phase-F forbidden write to: ${target}`); }
}

function pathFor(filename: string): string {
  const root = programmerImprovementDir();
  const p = path.resolve(root, filename);
  if (!p.startsWith(root + path.sep) && p !== root) {
    throw new ForbiddenPhaseFWrite(p);
  }
  return p;
}

function ensureDir(): void {
  const dir = programmerImprovementDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const runsDir = path.join(dir, "runs");
  if (!existsSync(runsDir)) mkdirSync(runsDir, { recursive: true });
}

const RUNS_INDEX = "improvement_runs.jsonl";
const CANDIDATES_FILE = "candidates.jsonl";

export function generateImprovementRunId(): string {
  return `improve_${randomUUID()}`;
}

// ─── Candidate persistence ──────────────────────────────────────

export function appendCandidate(c: LearningCandidate): void {
  const priors = readCandidates();
  if (priors.some((p) => p.candidate_id === c.candidate_id)) {
    throw new Error(`historical_mutation_rejected: candidate_id ${c.candidate_id} already present`);
  }
  ensureDir();
  appendFileSync(pathFor(CANDIDATES_FILE), JSON.stringify(c) + "\n", "utf8");
}

export function readCandidates(): LearningCandidate[] {
  const p = pathFor(CANDIDATES_FILE);
  if (!existsSync(p)) return [];
  const raw = readFileSync(p, "utf8");
  const out: LearningCandidate[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try { out.push(JSON.parse(trimmed) as LearningCandidate); }
    catch { /* skip malformed · never crash */ }
  }
  return out;
}

// ─── Run persistence (§13 §16) ─────────────────────────────────

/** Persist the full ImprovementRun body to runs/{run_id}.json. */
export function persistFullImprovementRun(run: ImprovementRun): string {
  if (run.final_status !== null) {
    throw new Error("Op-Truth violation: ImprovementRun.final_status must be null in persisted record");
  }
  ensureDir();
  const relPath = path.join("runs", `${run.run_id}.json`);
  const abs = pathFor(relPath);
  writeFileSync(abs, JSON.stringify(run, null, 2) + "\n", "utf8");
  return relPath;
}

/** Append a compact history entry to the append-only index. */
export function appendImprovementHistoryEntry(entry: ImprovementHistoryEntry): void {
  if (entry.final_status !== null) {
    throw new Error("Op-Truth violation: history entry final_status must be null");
  }
  const existing = readImprovementHistory();
  if (existing.some((e) => e.run_id === entry.run_id)) {
    throw new Error(`historical_mutation_rejected: run_id ${entry.run_id} already present · append-only discipline`);
  }
  ensureDir();
  appendFileSync(pathFor(RUNS_INDEX), JSON.stringify(entry) + "\n", "utf8");
}

export function readImprovementHistory(): ImprovementHistoryEntry[] {
  const p = pathFor(RUNS_INDEX);
  if (!existsSync(p)) return [];
  const raw = readFileSync(p, "utf8");
  const out: ImprovementHistoryEntry[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try { out.push(JSON.parse(trimmed) as ImprovementHistoryEntry); }
    catch { /* skip malformed */ }
  }
  return out;
}

export function readFullImprovementRun(runId: string): ImprovementRun | null {
  const relPath = path.join("runs", `${runId}.json`);
  const abs = pathFor(relPath);
  if (!existsSync(abs)) return null;
  try {
    return JSON.parse(readFileSync(abs, "utf8")) as ImprovementRun;
  } catch { return null; }
}

// ─── Version history preservation (§16) ────────────────────────

/** All historical entries for a given candidate_id · in chronological
 *  order · never mutated. Used by the loop to compose the version
 *  chain (v1, v1.1, v1.2 …). */
export function readCandidateVersionChain(candidate_id: string): ImprovementHistoryEntry[] {
  return readImprovementHistory().filter((e) => e.candidate_id === candidate_id);
}

// ─── Test-only reset ──────────────────────────────────────────

/** Test helper · zeroes the store. Never used in production. */
export function _resetImprovementStoreForTests(): void {
  const runs = pathFor(RUNS_INDEX);
  const cands = pathFor(CANDIDATES_FILE);
  if (existsSync(runs)) writeFileSync(runs, "", "utf8");
  if (existsSync(cands)) writeFileSync(cands, "", "utf8");
}

export { ForbiddenPhaseFWrite };
