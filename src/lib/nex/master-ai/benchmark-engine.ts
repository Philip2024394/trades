// src/lib/nex/master-ai/benchmark-engine.ts
//
// NEX Master AI Engineer · M6 · Generalized benchmark / evaluation engine
// Philip 2026-09-07 · AUTHORIZE
//
// PRESERVES the Programmer Phase D anti-adaptive-selection discipline:
//   · Corpora are FROZEN once registered (Object.freeze applied)
//   · Duplicate case_id within a corpus rejected
//   · No case may be added, removed or modified during evaluation
//
// Generalises Phase D shape so each agent can register its own corpora.
// Corpora themselves are stored in-memory (registered by the calling
// code · e.g. by an agent's own bench-suite bootstrap). The ledger
// tracks only registration metadata + runs.

import { randomUUID } from "node:crypto";
import { readJsonlAll, appendJsonLine } from "./fs-atomic";
import { benchmarkRegistryPath, benchmarkRunsPath } from "./paths";
import type {
  BenchmarkCorpus,
  BenchmarkCase,
  BenchmarkRun,
  BenchmarkVerdict,
  MasterAgentId,
} from "./types";

const CORPORA = new Map<string, BenchmarkCorpus>();

export class DuplicateCaseIdError extends Error {
  constructor(id: string) { super(`duplicate_case_id:${id}`); }
}

/** Freeze + register a corpus. Rejects duplicate case_id within cases.
 *  Frozen corpus cannot be modified via TS (Object.freeze applied ·
 *  identical to Phase D). Called by the owning agent's bench-suite
 *  bootstrap, not by Master AI itself. */
export function registerCorpus<TIn, TOut>(input: {
  agent_id: MasterAgentId;
  version: string;
  cases: BenchmarkCase<TIn, TOut>[];
}): BenchmarkCorpus<TIn, TOut> {
  const seen = new Set<string>();
  for (const c of input.cases) {
    if (seen.has(c.case_id)) throw new DuplicateCaseIdError(c.case_id);
    seen.add(c.case_id);
  }
  const corpus: BenchmarkCorpus<TIn, TOut> = Object.freeze({
    corpus_id: randomUUID(),
    agent_id: input.agent_id,
    version: input.version,
    frozen: true as const,
    cases: Object.freeze(input.cases.map((c) => Object.freeze({ ...c }))),
    registered_at_iso: new Date().toISOString(),
  });
  CORPORA.set(corpus.corpus_id, corpus as BenchmarkCorpus);

  // Ledger entry (metadata only · cases NOT persisted here since they
  // are declarative TS code that lives in the owning agent's tree).
  appendJsonLine(benchmarkRegistryPath(), {
    corpus_id: corpus.corpus_id,
    agent_id: corpus.agent_id,
    version: corpus.version,
    case_count: corpus.cases.length,
    registered_at_iso: corpus.registered_at_iso,
  });
  return corpus;
}

export function getCorpus(corpus_id: string): BenchmarkCorpus | null {
  return CORPORA.get(corpus_id) ?? null;
}

export function listRegistrations(): Array<{
  corpus_id: string;
  agent_id: MasterAgentId;
  version: string;
  case_count: number;
  registered_at_iso: string;
}> {
  return readJsonlAll(benchmarkRegistryPath());
}

/** Record a benchmark run · determined verdict against a baseline run.
 *  Verdict rules mirror Phase E `direction` semantics. */
export function recordRun(input: {
  corpus_id: string;
  capability_id: string;
  case_count: number;
  pass_count: number;
  fail_count: number;
  per_class_metrics: Record<string, number>;
  compared_against_run_id: string | null;
  attribution: string | null;
}): BenchmarkRun {
  const previous = input.compared_against_run_id
    ? readAllRuns().find((r) => r.run_id === input.compared_against_run_id) ?? null
    : null;
  const passRate = input.case_count > 0 ? input.pass_count / input.case_count : 0;
  const priorPassRate = previous && previous.case_count > 0 ? previous.pass_count / previous.case_count : null;
  let verdict: BenchmarkVerdict;
  if (priorPassRate === null) {
    verdict = passRate >= 0.5 ? "STABLE" : "FAILED";
  } else if (passRate > priorPassRate + 0.01) {
    verdict = "IMPROVED";
  } else if (passRate < priorPassRate - 0.01) {
    verdict = "DEGRADED";
  } else if (passRate === priorPassRate) {
    verdict = "STABLE";
  } else {
    verdict = "UNEXPLAINED";
  }

  const run: BenchmarkRun = {
    run_id: randomUUID(),
    corpus_id: input.corpus_id,
    capability_id: input.capability_id,
    timestamp_iso: new Date().toISOString(),
    case_count: input.case_count,
    pass_count: input.pass_count,
    fail_count: input.fail_count,
    per_class_metrics: input.per_class_metrics,
    verdict,
    compared_against_run_id: input.compared_against_run_id,
    attribution: input.attribution,
  };
  appendJsonLine(benchmarkRunsPath(), run);
  return run;
}

export function readAllRuns(): BenchmarkRun[] {
  return readJsonlAll<BenchmarkRun>(benchmarkRunsPath());
}

export function _resetBenchmarkEngineForTests(): void {
  const fs = require("node:fs") as typeof import("node:fs");
  CORPORA.clear();
  for (const p of [benchmarkRegistryPath(), benchmarkRunsPath()]) {
    try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch { /* ignore */ }
  }
}
