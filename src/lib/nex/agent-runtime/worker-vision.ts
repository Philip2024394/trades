// src/lib/nex/agent-runtime/worker-vision.ts
//
// NEX Vision Intelligence Engineer · Phase 3 · worker
// Founder BEGIN 2026-09-08 · continue-signal · WAVE-S-1 integration wiring
//
// Phase 3 scope-locked worker (mirrors worker-speaking.ts template):
//   · Emits heartbeat + AGENT_STARTED / AGENT_STOPPED
//   · Every ~60s evaluates its own frozen ADR-0028-aligned corpus and
//     emits WORK_COMPLETED with pass/fail counts
//   · Any failure → WORK_FAILED so Master AI failure_intelligence picks
//     it up (proves observation loop closes for Vision)
//   · Text-only · deterministic · no vision-model inference in Phase 3
//   · Phase 4 gains real vision model · routes through LLM gateway per
//     Self-Sustainment doctrine §8 (single-choke-point invariant)

import { randomUUID } from "node:crypto";
import type { AgentId, Heartbeat } from "./types";
import { AGENT_RUNTIME_VERSION } from "./types";
import { writeHeartbeat } from "./heartbeat";
import { emitEvent } from "./event-bus";
import { cachedInternetState, probeInternet } from "./internet-check";
import { getPosition } from "./registry";
import { VISION_CORPUS_V1 } from "@/lib/nex/agents/nex-vision/corpus";
import { evaluateVisionCorpus } from "@/lib/nex/agents/nex-vision/evaluator";

const AGENT: AgentId = "vision";

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

export function runVisionBenchmarkOnce(): {
  corpus_version: string;
  case_count: number;
  passed: number;
  failed: number;
  first_failed_case?: string;
  first_failed_check?: string;
} {
  const run = evaluateVisionCorpus(VISION_CORPUS_V1);
  const failedCase = run.results.find((r) => !r.passed);
  const firstFailedCheck = failedCase?.checks.find((c) => !c.ok)?.check;
  return {
    corpus_version: VISION_CORPUS_V1.version,
    case_count: VISION_CORPUS_V1.cases.length,
    passed: run.passed,
    failed: run.failed,
    first_failed_case: failedCase?.case_id,
    first_failed_check: firstFailedCheck,
  };
}

export async function runVisionWorker(control: LoopControl): Promise<void> {
  const runId = randomUUID();
  const position = getPosition(AGENT);
  const benchmarkCadenceMs = 60_000;
  const heartbeatCadenceMs = position?.heartbeat_interval_ms ?? 5_000;

  emitEvent({
    kind: "AGENT_STARTED",
    agent_id: AGENT,
    process_id: process.pid,
    attributes: { run_id: runId, runtime_version: AGENT_RUNTIME_VERSION, specialist: "vision" },
  });
  beat("STARTING", "initializing", runId);
  await probeInternet().catch(() => { /* offline OK · specialist runs local-only */ });
  beat("RUNNING", "idle", runId);

  let lastBenchmark = 0;

  while (!control.shouldStop()) {
    const nowMs = control.now();

    if (nowMs - lastBenchmark >= benchmarkCadenceMs) {
      try {
        beat("RUNNING", "running_self_benchmark", runId);
        const result = runVisionBenchmarkOnce();
        LAST_SUCCESS_ISO = new Date().toISOString();
        emitEvent({
          kind: "WORK_COMPLETED",
          agent_id: AGENT,
          process_id: process.pid,
          attributes: {
            work: "vision_self_benchmark",
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
              work: "vision_self_benchmark",
              corpus_version: result.corpus_version,
              first_failed_case: result.first_failed_case ?? "unknown",
              first_failed_check: result.first_failed_check ?? "unknown",
              reason: `vision_benchmark_failure:${result.first_failed_check ?? "unknown"}`,
            },
          });
        }
      } catch (err) {
        LAST_FAILURE_ISO = new Date().toISOString();
        emitEvent({
          kind: "WORK_FAILED",
          agent_id: AGENT,
          process_id: process.pid,
          attributes: { work: "vision_self_benchmark", error: (err as Error).message.slice(0, 200) },
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
