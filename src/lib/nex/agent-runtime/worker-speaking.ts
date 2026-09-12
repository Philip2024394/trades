// src/lib/nex/agent-runtime/worker-speaking.ts
//
// NEX Speaking Intelligence Engineer · Phase 3 · worker
// Philip 2026-09-07 · AUTHORIZE Phase 3 · W5-2
//
// Phase 3 scope-locked worker:
//   · Emits heartbeat + AGENT_STARTED / AGENT_STOPPED like every other agent
//   · Every ~60s, evaluates its own frozen safety-inheritance corpus and
//     emits WORK_COMPLETED with pass/fail metrics
//   · If ANY case fails, emits WORK_FAILED so Master AI's failure_intelligence
//     picks it up as a discoverable weakness (proves observation loop closes)
//   · Text-only. No voice. No third-party LLM. No external calls.
//
// Zero coupling to user chat surface — this specialist runs as a self-
// testing observer whose output IS the benchmark result. Real user
// conversation surface would be a separate integration authorized later.

import { randomUUID } from "node:crypto";
import type { AgentId, Heartbeat } from "./types";
import { AGENT_RUNTIME_VERSION } from "./types";
import { writeHeartbeat } from "./heartbeat";
import { emitEvent } from "./event-bus";
import { cachedInternetState, probeInternet } from "./internet-check";
import { getPosition } from "./registry";
import { freezeSpeakingCorpusV1 } from "@/lib/nex/agents/nex-speaking/corpus";
import { evaluateSpeakingCorpus } from "@/lib/nex/agents/nex-speaking/evaluator";

const AGENT: AgentId = "speaking";

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

/** Run one benchmark tick. Returns pass/fail counts. */
export function runSpeakingBenchmarkOnce(): { corpus_version: string; case_count: number; passed: number; failed: number; first_failed_case?: string; first_failed_check?: string } {
  const { corpus } = freezeSpeakingCorpusV1();
  const run = evaluateSpeakingCorpus(corpus);
  const failedCase = run.results.find((r) => r.match_status === "WRONG");
  const firstFailedCheck = failedCase?.rubric_results.find((rr) => !rr.passed)?.check;
  return {
    corpus_version: corpus.version,
    case_count: corpus.case_count,
    passed: run.passed,
    failed: run.failed,
    first_failed_case: failedCase?.case_id,
    first_failed_check: firstFailedCheck,
  };
}

export async function runSpeakingWorker(control: LoopControl): Promise<void> {
  const runId = randomUUID();
  const position = getPosition(AGENT);
  const benchmarkCadenceMs = 60_000;                         // benchmark every minute
  const heartbeatCadenceMs = position?.heartbeat_interval_ms ?? 5_000;

  emitEvent({
    kind: "AGENT_STARTED",
    agent_id: AGENT,
    process_id: process.pid,
    attributes: { run_id: runId, runtime_version: AGENT_RUNTIME_VERSION },
  });
  beat("STARTING", "initializing", runId);
  await probeInternet().catch(() => { /* offline fine · specialist runs local-only */ });
  beat("RUNNING", "idle", runId);

  let lastBenchmark = 0;

  while (!control.shouldStop()) {
    const nowMs = control.now();

    if (nowMs - lastBenchmark >= benchmarkCadenceMs) {
      try {
        beat("RUNNING", "running_self_benchmark", runId);
        const result = runSpeakingBenchmarkOnce();
        LAST_SUCCESS_ISO = new Date().toISOString();
        emitEvent({
          kind: "WORK_COMPLETED",
          agent_id: AGENT,
          process_id: process.pid,
          attributes: {
            work: "speaking_self_benchmark",
            corpus_version: result.corpus_version,
            case_count: result.case_count,
            passed: result.passed,
            failed: result.failed,
            run_id: runId,
          },
        });
        // If ANY case failed, emit a WORK_FAILED event so
        // Master AI's failure_intelligence detects the weakness.
        if (result.failed > 0) {
          LAST_FAILURE_ISO = new Date().toISOString();
          emitEvent({
            kind: "WORK_FAILED",
            agent_id: AGENT,
            process_id: process.pid,
            attributes: {
              work: "speaking_self_benchmark",
              corpus_version: result.corpus_version,
              first_failed_case: result.first_failed_case ?? "unknown",
              first_failed_check: result.first_failed_check ?? "unknown",
              reason: `speaking_benchmark_failure:${result.first_failed_check ?? "unknown"}`,
            },
          });
        }
      } catch (err) {
        LAST_FAILURE_ISO = new Date().toISOString();
        emitEvent({
          kind: "WORK_FAILED",
          agent_id: AGENT,
          process_id: process.pid,
          attributes: { work: "speaking_self_benchmark", error: (err as Error).message.slice(0, 200) },
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
