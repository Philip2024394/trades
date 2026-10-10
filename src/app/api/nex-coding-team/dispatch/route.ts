// POST /api/nex-coding-team/dispatch
// Founder types a coding request in the workstation. This route:
//   1. Validates the prompt (rejects empty · rejects injection).
//   2. Selects a dispatcher based on query params:
//        · ?demo=1        → DEMO_DISPATCHER (stub artefacts · sync)
//        · ?dispatcher=demo|scripted|queue (explicit)
//        · default        → QUEUE_DISPATCHER (fire-and-forget · external executor)
//   3. For demo / scripted: runs the pipeline synchronously end-to-end.
//   4. For queue: kicks off the pipeline in the background so external executors
//      (Claude Code MAI · NEX1 autonomous runtime) can pick up jobs from
//      data/nex-coding-team/queue/inbox. The Founder polls /status for progress.

import { NextResponse } from "next/server";
import { log } from "@/lib/nex-coding-team/logger";
import { startRun, initRun, runPipeline } from "@/lib/nex-coding-team/runtime";
import { DEMO_DISPATCHER } from "@/lib/nex-coding-team/dispatcher-demo";
import { SCRIPTED_DISPATCHER } from "@/lib/nex-coding-team/dispatcher-scripted";
import { QUEUE_DISPATCHER } from "@/lib/nex-coding-team/dispatcher-queue";
import { guardCodingTeamRun } from "@/lib/nex-code-brain/integrations/coding-team-bridge";
import type { AgentDispatcher } from "@/lib/nex-coding-team/runtime";
import type { DispatchRequest, DispatchResponse } from "@/lib/nex-coding-team/types";

export const dynamic = "force-dynamic";

const HOSTILE_PATTERNS = [
  /ignore (all )?(previous )?instructions/i,
  /system prompt/i,
  /you are now/i,
  /disregard governance/i,
  /modify v3_engine_registry/i,
  /apply m-1 migration/i,
  /rewrite historical receipt/i,
];

type DispatcherMode = "demo" | "scripted" | "queue";

function resolveMode(url: URL): DispatcherMode {
  const explicit = url.searchParams.get("dispatcher");
  if (explicit === "demo" || explicit === "scripted" || explicit === "queue") return explicit;
  if (url.searchParams.get("demo") === "1") return "demo";
  return "queue";
}

function dispatcherFor(mode: DispatcherMode): AgentDispatcher {
  if (mode === "demo") return DEMO_DISPATCHER;
  if (mode === "scripted") return SCRIPTED_DISPATCHER;
  return QUEUE_DISPATCHER;
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const mode = resolveMode(url);

  let body: DispatchRequest;
  try {
    body = (await req.json()) as DispatchRequest;
  } catch {
    return jsonErr(400, "invalid JSON body");
  }

  const prompt = (body.founder_prompt ?? "").trim();
  if (prompt.length === 0) return jsonErr(400, "founder_prompt is required and non-empty");
  if (prompt.length > 4000) return jsonErr(400, "founder_prompt exceeds 4000 chars");
  if (HOSTILE_PATTERNS.some((p) => p.test(prompt))) {
    return jsonErr(400, "prompt contains disallowed override language");
  }

  const dispatcher = dispatcherFor(mode);

  // Sync path · demo + scripted run to completion before responding.
  if (mode === "demo" || mode === "scripted") {
    try {
      const m = await startRun({ founder_prompt: prompt, dispatcher });
      return NextResponse.json(makeResp(m.run_id), { status: 200 });
    } catch (err) {
      return jsonErr(500, `${mode} dispatch failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Queue path · fire-and-forget · Founder polls /status.
  // initRun creates the manifest + state synchronously so we can return the
  // run_id immediately. runPipeline then executes against THAT same run_id.
  const manifest = initRun(prompt);

  // F3 wire · Code Brain guards the run before it can execute agents.
  // The brain routes manifest.artifacts_dir to nex-coding-primary lane and
  // acquires an exclusive lease so no other lane (e.g. future Twin NEX)
  // can concurrently modify the same path. Legacy demo/scripted modes above
  // do NOT pass through the guard — they run in-process synchronously and
  // are covered by their own tests.
  const guard = guardCodingTeamRun({
    run_id: manifest.run_id,
    paths: [manifest.artifacts_dir],
    founder_prompt: prompt,
    title: prompt.slice(0, 80),
    ttl_seconds: 3600, // 1 hour · matches expected queue latency
    holder_agent_id: "coding-team-dispatch-route",
    requested_by: "api",
  });
  if (!guard.ok) {
    log(manifest.run_id, {
      kind: "escalation",
      agent_id: "orchestrator",
      summary: `brain guard rejected dispatch: ${guard.reason}`,
      detail: { kind: guard.kind },
    });
    return jsonErr(409, `brain guard: ${guard.reason}`);
  }
  log(manifest.run_id, {
    kind: "governance_check",
    agent_id: "orchestrator",
    summary: `brain lease acquired · lane=${guard.lane} · assignment=${guard.assignment_id}`,
  });

  log(manifest.run_id, {
    kind: "stage_transition",
    agent_id: "orchestrator",
    summary: `dispatch mode=queue · pipeline running in background`,
  });

  // Background pipeline execution · errors are logged, not thrown to the HTTP response.
  // Terminal transitions (success / halt / abort) inside runPipeline call
  // releaseCodingTeamRun which cleans up the lease and (on completion) writes
  // a KnowledgeEntry.
  void runPipeline(manifest.run_id, dispatcher, false).catch((err) => {
    log(manifest.run_id, {
      kind: "escalation",
      agent_id: "orchestrator",
      summary: `background pipeline failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  });

  return NextResponse.json(makeResp(manifest.run_id), { status: 200 });
}

function makeResp(run_id: string): DispatchResponse {
  return {
    ok: true,
    run_id,
    manifest_url: `/api/nex-coding-team/status?run_id=${encodeURIComponent(run_id)}`,
    stream_url: `/api/nex-coding-team/status?run_id=${encodeURIComponent(run_id)}`,
  };
}

function jsonErr(status: number, error: string) {
  const body: DispatchResponse = { ok: false, run_id: "", manifest_url: "", stream_url: "", error };
  return NextResponse.json(body, { status });
}
