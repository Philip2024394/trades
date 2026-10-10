// NEX Coding Team · AGENT_STATE.json real-time state helpers
// Every run has its own AGENT_STATE.json under its artifacts directory. The
// executor writes to it after every agent completion; the UI polls it via the
// status API. This is the durable, filesystem-truth of what's happening.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import type { AgentId, AgentResult, CodingRunManifest, PipelineStatus } from "./types";

const REPO_ROOT = process.cwd();

export interface AgentStateFile {
  readonly run_id: string;
  readonly status: PipelineStatus;
  readonly current_agent: AgentId | null;
  readonly stage_name: string | null;
  readonly started_at: string;
  readonly updated_at: string;
  readonly agent_events: readonly AgentStateEvent[];
  readonly governance: {
    readonly v3_registry_frozen: true;
    readonly historical_receipts_intact: true;
    readonly protected_files_touched: readonly string[]; // must be empty
  };
}

export interface AgentStateEvent {
  readonly ts: string;
  readonly agent_id: AgentId | "orchestrator";
  readonly verdict: string; // AgentVerdict or "STARTED" / "STAGE_COMPLETE" etc.
  readonly summary: string;
  readonly artifact_path: string | null; // repo-relative
}

export function stateFilePath(run_id: string): string {
  return path.join(REPO_ROOT, "data", "nex-coding-team", "runs", run_id, "AGENT_STATE.json");
}

export function initState(run_id: string): AgentStateFile {
  const now = new Date().toISOString();
  const s: AgentStateFile = {
    run_id,
    status: "created",
    current_agent: null,
    stage_name: null,
    started_at: now,
    updated_at: now,
    agent_events: [
      { ts: now, agent_id: "orchestrator", verdict: "STARTED", summary: "Run created.", artifact_path: null },
    ],
    governance: {
      v3_registry_frozen: true,
      historical_receipts_intact: true,
      protected_files_touched: [],
    },
  };
  writeFileSync(stateFilePath(run_id), JSON.stringify(s, null, 2), "utf8");
  return s;
}

export function loadState(run_id: string): AgentStateFile | null {
  const p = stateFilePath(run_id);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as AgentStateFile;
}

export function appendEvent(run_id: string, ev: AgentStateEvent, patch: Partial<AgentStateFile> = {}): AgentStateFile {
  const cur = loadState(run_id);
  if (!cur) throw new Error(`state missing for run_id=${run_id}`);
  const next: AgentStateFile = {
    ...cur,
    ...patch,
    updated_at: new Date().toISOString(),
    agent_events: [...cur.agent_events, ev],
  };
  writeFileSync(stateFilePath(run_id), JSON.stringify(next, null, 2), "utf8");
  return next;
}

/** Update state + append event when an agent finishes. Convenience wrapper. */
export function recordAgentFinish(run_id: string, r: AgentResult): AgentStateFile {
  return appendEvent(run_id, {
    ts: new Date().toISOString(),
    agent_id: r.agent_id,
    verdict: r.verdict,
    summary: r.summary,
    artifact_path: r.artifact_path,
  });
}

/** Transition to a new pipeline status. Also emits an event. */
export function transitionStatus(
  run_id: string,
  next: PipelineStatus,
  currentAgent: AgentId | null,
  stageName: string | null,
  summary: string,
): AgentStateFile {
  return appendEvent(
    run_id,
    { ts: new Date().toISOString(), agent_id: "orchestrator", verdict: next.toUpperCase(), summary, artifact_path: null },
    { status: next, current_agent: currentAgent, stage_name: stageName },
  );
}
