// src/lib/nex/agent-runtime/paths.ts
//
// NEX Agent Runtime · persistent file paths
// Philip 2026-09-06 · FOUNDER AUTHORIZATION
//
// §23 PERSISTENT STATE: state must survive process restart AND reboot.
// All state lives under data/nex-agent-runtime/ — never inside process
// memory, never inside the Next.js dev-server cache.

import path from "node:path";
import type { AgentId } from "./types";

/** Repo root anchor. Callers may override for tests via
 *  NEX_AGENT_RUNTIME_DATA_ROOT env var — enables in-memory / temp-dir
 *  test isolation without changing production paths. */
export function runtimeDataRoot(): string {
  const override = process.env.NEX_AGENT_RUNTIME_DATA_ROOT;
  if (override && override.length > 0) return override;
  // Default: <cwd>/data/nex-agent-runtime
  return path.join(process.cwd(), "data", "nex-agent-runtime");
}

/** Persistent registry — extends existing workforce/positions.json
 *  semantics with runtime fields (desired_state, restart_policy, etc.).
 *  Kept in a distinct file so we do not clobber the existing
 *  data/workforce/positions.json contract. */
export function positionsPath(): string {
  return path.join(runtimeDataRoot(), "positions.json");
}

/** Founder STOP override sticky flag (§17). Persisted so it survives
 *  reboot — a Founder-issued STOP ALL prevents the watchdog from
 *  restarting the agents until an explicit START. */
export function founderStopOverridePath(): string {
  return path.join(runtimeDataRoot(), "founder-stop-override.json");
}

/** Per-agent heartbeat file. Latest heartbeat only; overwritten on each
 *  emission for atomic reads. */
export function heartbeatPath(agentId: AgentId): string {
  return path.join(runtimeDataRoot(), `heartbeat-${agentId}.json`);
}

/** Per-agent PID + start-metadata file. Written by the daemon at
 *  startup; deleted at graceful shutdown. Presence is one signal used
 *  when deriving runtime state — not the only one. */
export function pidPath(agentId: AgentId): string {
  return path.join(runtimeDataRoot(), `pid-${agentId}.json`);
}

/** Append-only event log (§13). One line per event, JSONL. */
export function eventsPath(): string {
  return path.join(runtimeDataRoot(), "events.jsonl");
}

/** Append-only command audit (§28). */
export function commandsPath(): string {
  return path.join(runtimeDataRoot(), "commands.jsonl");
}

/** Per-agent restart-history JSONL (bounded, tail-only). */
export function restartHistoryPath(agentId: AgentId): string {
  return path.join(runtimeDataRoot(), `restarts-${agentId}.jsonl`);
}

/** The daemon entry point Node.js can execute directly. Used by
 *  control-plane.ts when spawning detached child processes. */
export function daemonEntryScriptPath(): string {
  return path.join(process.cwd(), "scripts", "nex-agent-runtime.mjs");
}
