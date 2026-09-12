// src/lib/nex/master-ai/observatory.ts
//
// NEX Master AI Engineer · Observatory · §6
// Philip 2026-09-07 · AUTHORIZE (Wave 2 · continuous mission)
//
// Reads runtime evidence (already gathered by M3 observation.ts) and
// DERIVES multi-dimensional health. Distinguishes RUNNING from HEALTHY
// from USEFUL. Never modifies observed state · read-only.
//
// Cadence must be external (Scheduled Task / CLI). No setInterval.

import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { readJsonlAll, appendJsonLine } from "./fs-atomic";
import { agentHealthReportsPath } from "./paths";
import { listAgents } from "./agent-registry";
import { readHeartbeatSnapshot, tailRuntimeEvents } from "./observation";
import { eventsPath as runtimeEventsPath } from "@/lib/nex/agent-runtime/paths";
import type {
  AgentHealthReport,
  DerivedHealthState,
  MasterAgentId,
} from "./types";

const HEARTBEAT_FRESH_MS = 15_000;               // heartbeat considered fresh if <=15s stale
const HEARTBEAT_DEGRADED_MS = 60_000;            // between 15-60s = DEGRADED
const IDLE_WINDOW_MS = 5 * 60_000;               // window to count work events

type RuntimeEventLike = {
  kind: string;
  agent_id: string;
  timestamp_iso: string;
  attributes?: Record<string, unknown>;
};

function coerceEventList(raw: unknown[]): RuntimeEventLike[] {
  const out: RuntimeEventLike[] = [];
  for (const r of raw) {
    if (r && typeof r === "object" && "kind" in r && "agent_id" in r && "timestamp_iso" in r) {
      out.push(r as RuntimeEventLike);
    }
  }
  return out;
}

/** Read a bounded window of runtime events (from agent-runtime's own
 *  events.jsonl · READ ONLY). Bound: last 2000 lines. */
function readRuntimeEvents(): RuntimeEventLike[] {
  return coerceEventList(tailRuntimeEvents(2000));
}

function withinWindow(iso: string, nowMs: number, windowMs: number): boolean {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return false;
  return (nowMs - t) <= windowMs;
}

/** Derive one agent's health from the current runtime evidence. */
export function deriveAgentHealth(agentId: MasterAgentId, nowMs = Date.now()): AgentHealthReport {
  const runtimeIds: ReadonlySet<string> = new Set(["programmer", "accommodation"]);
  const hb = runtimeIds.has(agentId)
    ? readHeartbeatSnapshot(agentId as "programmer" | "accommodation")
    : null;

  const events = readRuntimeEvents().filter((e) => e.agent_id === agentId);
  const eventsInWindow = events.filter((e) => withinWindow(e.timestamp_iso, nowMs, IDLE_WINDOW_MS));
  const completedInWindow = eventsInWindow.filter((e) => e.kind === "WORK_COMPLETED").length;
  const failedInWindow = eventsInWindow.filter((e) => e.kind === "WORK_FAILED").length;

  let staleMs: number | null = null;
  if (hb?.timestamp_iso) {
    const t = Date.parse(hb.timestamp_iso);
    if (Number.isFinite(t)) staleMs = Math.max(0, nowMs - t);
  }
  const heartbeat_fresh = staleMs !== null && staleMs <= HEARTBEAT_FRESH_MS;
  const running = hb !== null && staleMs !== null;

  let derived: DerivedHealthState;
  const reasons: string[] = [];
  if (!running) {
    derived = "STOPPED";
    reasons.push("no_recent_heartbeat_file_or_missing_pid_evidence");
  } else if (staleMs !== null && staleMs <= HEARTBEAT_FRESH_MS) {
    if (completedInWindow > 0) {
      derived = "HEALTHY";
      reasons.push(`work_completed_in_last_5m=${completedInWindow}`);
    } else {
      derived = "IDLE";
      reasons.push("heartbeat_fresh_but_no_work_events_in_last_5m");
    }
  } else if (staleMs !== null && staleMs <= HEARTBEAT_DEGRADED_MS) {
    derived = "DEGRADED";
    reasons.push(`heartbeat_stale_ms=${staleMs}`);
  } else {
    derived = "CRASHED";
    reasons.push(`heartbeat_stale_beyond_${HEARTBEAT_DEGRADED_MS}ms`);
  }

  const useful = derived === "HEALTHY";

  const report: AgentHealthReport = {
    report_id: randomUUID(),
    timestamp_iso: new Date().toISOString(),
    agent_id: agentId,
    derived_health: derived,
    running,
    heartbeat_fresh,
    heartbeat_stale_ms: staleMs,
    observed_events_since_last_report: eventsInWindow.length,
    work_completed_since_last_report: completedInWindow,
    work_failed_since_last_report: failedInWindow,
    useful,
    reasons,
  };
  appendJsonLine(agentHealthReportsPath(), report);
  return report;
}

/** Compute health for every registered agent. Read-only. */
export function observatoryTick(nowMs = Date.now()): AgentHealthReport[] {
  const registered = listAgents().map((a) => a.agent_id);
  // If the catalogue is empty, fall back to the two known runtime agents
  // so the observatory still produces derived reports.
  const targets: MasterAgentId[] = registered.length > 0
    ? registered
    : ["programmer", "accommodation"];
  return targets.map((id) => deriveAgentHealth(id, nowMs));
}

export function readAllHealthReports(): AgentHealthReport[] {
  return readJsonlAll<AgentHealthReport>(agentHealthReportsPath());
}

export function latestReportForAgent(agentId: MasterAgentId): AgentHealthReport | null {
  let latest: AgentHealthReport | null = null;
  for (const r of readAllHealthReports()) if (r.agent_id === agentId) latest = r;
  return latest;
}

/** Runtime-events source path · exposed for CLI to prove it stayed read-only. */
export const RUNTIME_EVENTS_SOURCE = runtimeEventsPath;

export function _resetObservatoryForTests(): void {
  try { if (fs.existsSync(agentHealthReportsPath())) fs.unlinkSync(agentHealthReportsPath()); } catch { /* ignore */ }
}
