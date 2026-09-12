// src/lib/nex/agent-runtime/worker-construction.ts
//
// NEX Construction Specialist · Phase 3 · worker
// Founder BEGIN 2026-09-08 · WAVE-S-5 integration wiring
// General (all countries) · NEX-scoped (not Networkers-scoped)

import { randomUUID } from "node:crypto";
import type { AgentId, Heartbeat } from "./types";
import { AGENT_RUNTIME_VERSION } from "./types";
import { writeHeartbeat } from "./heartbeat";
import { emitEvent } from "./event-bus";
import { cachedInternetState, probeInternet } from "./internet-check";
import { getPosition } from "./registry";
import { CONSTRUCTION_CORPUS_V1 } from "@/lib/nex/agents/nex-construction/corpus";
import { evaluateConstructionCorpus } from "@/lib/nex/agents/nex-construction/evaluator";

const AGENT: AgentId = "construction";

type LoopControl = {
  shouldStop: () => boolean;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
};

let LAST_SUCCESS_ISO: string | null = null;
let LAST_FAILURE_ISO: string | null = null;

function beat(status: Heartbeat["status"], currentTask: string | null, runId: string): void {
  const internet = cachedInternetState();
  writeHeartbeat({
    agent_id: AGENT,
    run_id: runId,
    process_id: process.pid,
    timestamp_iso: new Date().toISOString(),
    status,
    current_task: currentTask,
    last_success_iso: LAST_SUCCESS_ISO,
    last_failure_iso: LAST_FAILURE_ISO,
    internet_state: internet.state,
    runtime_version: AGENT_RUNTIME_VERSION,
  });
}

export function runConstructionBenchmarkOnce(): {
  corpus_version: string;
  case_count: number;
  passed: number;
  failed: number;
  first_failed_case?: string;
  first_failed_check?: string;
} {
  const run = evaluateConstructionCorpus(CONSTRUCTION_CORPUS_V1);
  const failedCase = run.results.find((r) => !r.passed);
  const firstFailedCheck = failedCase?.checks.find((c) => !c.ok)?.check;
  return {
    corpus_version: CONSTRUCTION_CORPUS_V1.version,
    case_count: CONSTRUCTION_CORPUS_V1.cases.length,
    passed: run.passed,
    failed: run.failed,
    first_failed_case: failedCase?.case_id,
    first_failed_check: firstFailedCheck,
  };
}

export async function runConstructionWorker(control: LoopControl): Promise<void> {
  const runId = randomUUID();
  const position = getPosition(AGENT);
  const benchmarkCadenceMs = 60_000;
  const heartbeatCadenceMs = position?.heartbeat_interval_ms ?? 5_000;

  emitEvent({
    kind: "AGENT_STARTED",
    agent_id: AGENT,
    process_id: process.pid,
    attributes: { run_id: runId, runtime_version: AGENT_RUNTIME_VERSION, specialist: "construction" },
  });
  beat("STARTING", "initializing", runId);
  await probeInternet().catch(() => {});
  beat("RUNNING", "idle", runId);

  let lastBenchmark = 0;

  while (!control.shouldStop()) {
    const nowMs = control.now();

    if (nowMs - lastBenchmark >= benchmarkCadenceMs) {
      try {
        beat("RUNNING", "running_self_benchmark", runId);
        const result = runConstructionBenchmarkOnce();
        LAST_SUCCESS_ISO = new Date().toISOString();
        emitEvent({
          kind: "WORK_COMPLETED",
          agent_id: AGENT,
          process_id: process.pid,
          attributes: {
            work: "construction_self_benchmark",
            corpus_version: result.corpus_version,
            case_count: result.case_count,
            passed: result.passed,
            failed: result.failed,
            run_id: runId,
          },
        });
        if (result.failed > 0) {
          LAST_FAILURE_ISO = new Date().toISOString();
          emitEvent({
            kind: "WORK_FAILED",
            agent_id: AGENT,
            process_id: process.pid,
            attributes: {
              work: "construction_self_benchmark",
              corpus_version: result.corpus_version,
              first_failed_case: result.first_failed_case ?? "unknown",
              first_failed_check: result.first_failed_check ?? "unknown",
              reason: `construction_benchmark_failure:${result.first_failed_check ?? "unknown"}`,
            },
          });
        }
      } catch (err) {
        LAST_FAILURE_ISO = new Date().toISOString();
        emitEvent({
          kind: "WORK_FAILED",
          agent_id: AGENT,
          process_id: process.pid,
          attributes: { work: "construction_self_benchmark", error: (err as Error).message.slice(0, 200) },
        });
      }
      lastBenchmark = nowMs;
    }

    beat("RUNNING", "idle", runId);
    await control.sleep(heartbeatCadenceMs);
  }

  beat("STOPPING", "shutting_down", runId);
  emitEvent({
    kind: "AGENT_STOPPED",
    agent_id: AGENT,
    process_id: process.pid,
    attributes: { run_id: runId, reason: "should_stop_signalled" },
  });
}
