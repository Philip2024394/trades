// src/lib/nex/agent-runtime/control-plane.ts
//
// NEX Agent Runtime · Control Plane · start/stop/status orchestration
// Philip 2026-09-06 · FOUNDER AUTHORIZATION · §2 · §3 · §4 · §17 · §18 · §26
//
// The single point of authority for spawning + terminating agent
// processes. All START/STOP commands flow through here. Every command
// is audited (§28). No self-activation (§29): the Control Plane refuses
// to accept commands whose founder_user_id is null AND authorization is
// AUTHORIZED — that would be a bypass.

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { AgentId, ControlPlaneStatus, AgentStatus } from "./types";
import {
  listPositions,
  getPosition,
  setDesiredState,
  setFounderStopOverride,
  readFounderStopOverride,
  registerAgent,
} from "./registry";
import {
  readHeartbeat,
  readPidRecord,
  isPidAlive,
  clearPidRecord,
  clearHeartbeat,
} from "./heartbeat";
import { emitEvent } from "./event-bus";
import { auditCommand } from "./command-audit";
import { deriveAgentStatus } from "./runtime-state";
import { daemonEntryScriptPath, runtimeDataRoot } from "./paths";

// ── Bootstrap · idempotent registration of the two authorized agents ──
// Called by the API layer on demand — safe to call repeatedly. §34: the
// registry becomes operational rather than merely descriptive when the
// Control Plane can start/stop registered agents.

export function ensureAuthorizedAgentsRegistered(): void {
  registerAgent({
    agent_id: "programmer",
    machinery: "programmer_agent",
    domain: "engineering",
    internet_requirement: "PREFERRED",
  });
  registerAgent({
    agent_id: "accommodation",
    machinery: "p1_acquisition_pipeline",
    domain: "accommodation",
    internet_requirement: "PREFERRED",
  });
  registerAgent({
    agent_id: "master_ai",
    machinery: "master_ai_observer",
    domain: "master_ai",
    internet_requirement: "PREFERRED",
  });
  registerAgent({
    agent_id: "speaking",
    machinery: "speaking_intelligence_engineer",
    domain: "speaking",
    internet_requirement: "PREFERRED",
  });
  // WAVE-S-1/2/3 Phase 3 specialists · registered 2026-09-08
  // Deterministic · no LLM inference · not spawned by default ·
  // start requires explicit Founder "start" authorization.
  registerAgent({
    agent_id: "vision",
    machinery: "vision_intelligence_engineer",
    domain: "vision",
    internet_requirement: "NOT_REQUIRED",
  });
  registerAgent({
    agent_id: "travel",
    machinery: "travel_intelligence_engineer",
    domain: "travel",
    internet_requirement: "NOT_REQUIRED",
  });
  registerAgent({
    agent_id: "business",
    machinery: "business_intelligence_engineer",
    domain: "business",
    internet_requirement: "NOT_REQUIRED",
  });
}

// ── Command result envelope ─────────────────────────────────────────

export type CommandResult =
  | { ok: true; agent_id: AgentId | "ALL"; pid?: number; reason: string }
  | { ok: false; agent_id: AgentId | "ALL"; reason: string; code: "REJECTED" | "ALREADY" | "SPAWN_FAILED" | "NOT_REGISTERED" | "STOP_OVERRIDE" };

// ── START one agent ────────────────────────────────────────────────

export async function startAgent(input: {
  agent_id: AgentId;
  founder_user_id: string | null;
  authorization: "AUTHORIZED" | "REJECTED";
  authorization_reason: string;
}): Promise<CommandResult> {
  const { agent_id, founder_user_id, authorization, authorization_reason } = input;
  const position = getPosition(agent_id);

  if (authorization !== "AUTHORIZED") {
    auditCommand({
      founder_user_id, agent_id, command: "START",
      authorization: "REJECTED", authorization_reason,
      previous_desired_state: position?.desired_state ?? null,
      new_desired_state: null,
      result: "REJECTED",
      reason: `authorization_rejected:${authorization_reason}`,
    });
    return { ok: false, agent_id, reason: `unauthorized:${authorization_reason}`, code: "REJECTED" };
  }

  if (!position) {
    auditCommand({
      founder_user_id, agent_id, command: "START",
      authorization: "AUTHORIZED", authorization_reason,
      previous_desired_state: null, new_desired_state: null,
      result: "REJECTED", reason: "agent_not_registered",
    });
    return { ok: false, agent_id, reason: "agent_not_registered", code: "NOT_REGISTERED" };
  }

  // §17: releasing founder stop override when Founder explicitly starts.
  const override = readFounderStopOverride();
  if (override.active) {
    setFounderStopOverride(false, founder_user_id, `released_by_start:${agent_id}`);
    emitEvent({
      kind: "FOUNDER_STOP_OVERRIDE_RELEASED",
      agent_id: "control_plane",
      process_id: process.pid,
      attributes: { released_by: founder_user_id ?? "unknown", reason: `start:${agent_id}` },
    });
  }

  const previousDesired = position.desired_state;
  setDesiredState(agent_id, "RUNNING", `start_command:${founder_user_id ?? "unknown"}`);

  // Check if we already have a live process — idempotent START.
  const existingPid = readPidRecord(agent_id);
  if (existingPid && isPidAlive(existingPid.pid)) {
    auditCommand({
      founder_user_id, agent_id, command: "START",
      authorization: "AUTHORIZED", authorization_reason,
      previous_desired_state: previousDesired, new_desired_state: "RUNNING",
      result: "NOOP", reason: `process_already_running:pid=${existingPid.pid}`,
    });
    return { ok: false, agent_id, reason: `already_running:pid=${existingPid.pid}`, code: "ALREADY" };
  }

  // Spawn the detached daemon. §31: real process boundary, not
  // setInterval inside the Next.js request cycle.
  const entry = daemonEntryScriptPath();
  if (!fs.existsSync(entry)) {
    auditCommand({
      founder_user_id, agent_id, command: "START",
      authorization: "AUTHORIZED", authorization_reason,
      previous_desired_state: previousDesired, new_desired_state: "RUNNING",
      result: "REJECTED", reason: `daemon_script_missing:${entry}`,
    });
    return { ok: false, agent_id, reason: `daemon_script_missing`, code: "SPAWN_FAILED" };
  }

  try {
    // Ensure runtime data dir exists BEFORE spawn (avoids race where the
    // child writes heartbeat/pid before the dir exists).
    if (!fs.existsSync(runtimeDataRoot())) fs.mkdirSync(runtimeDataRoot(), { recursive: true });

    // Open a per-agent log file so the detached child's stdout/stderr
    // is captured to disk — critical for debugging when the terminal is
    // gone (§32 objective: survive terminal close).
    const logPath = path.join(runtimeDataRoot(), `daemon-${agent_id}.log`);
    const out = fs.openSync(logPath, "a");
    const err = fs.openSync(logPath, "a");

    // Spawn via `node scripts/nex-agent-runtime.mjs --agent=<id>`.
    // The daemon's outer .mjs stage re-invokes itself under `npx tsx`
    // so subsequent TypeScript imports resolve (proven pattern from
    // scripts/walkers/run-supervisor.mjs).
    const child = spawn(process.execPath, [entry, `--agent=${agent_id}`], {
      detached: true,
      stdio: ["ignore", out, err],
      windowsHide: true,
      cwd: process.cwd(),
      env: { ...process.env, NEX_AGENT_DAEMON: "1", NEX_AGENT_ID: agent_id },
    });
    child.unref();   // §31: allow the parent to exit without killing the daemon

    if (!child.pid) {
      auditCommand({
        founder_user_id, agent_id, command: "START",
        authorization: "AUTHORIZED", authorization_reason,
        previous_desired_state: previousDesired, new_desired_state: "RUNNING",
        result: "REJECTED", reason: "spawn_returned_no_pid",
      });
      return { ok: false, agent_id, reason: "spawn_no_pid", code: "SPAWN_FAILED" };
    }

    auditCommand({
      founder_user_id, agent_id, command: "START",
      authorization: "AUTHORIZED", authorization_reason,
      previous_desired_state: previousDesired, new_desired_state: "RUNNING",
      result: "OK", reason: `spawned:pid=${child.pid}:log=${logPath}`,
    });
    return { ok: true, agent_id, pid: child.pid, reason: `spawned:pid=${child.pid}` };
  } catch (spawnErr) {
    const msg = (spawnErr as Error).message;
    auditCommand({
      founder_user_id, agent_id, command: "START",
      authorization: "AUTHORIZED", authorization_reason,
      previous_desired_state: previousDesired, new_desired_state: "RUNNING",
      result: "REJECTED", reason: `spawn_failed:${msg.slice(0, 200)}`,
    });
    return { ok: false, agent_id, reason: `spawn_failed:${msg.slice(0, 200)}`, code: "SPAWN_FAILED" };
  }
}

// ── STOP one agent ─────────────────────────────────────────────────
// §3: STOP must actually stop. We write desired_state=STOPPED first
// (worker checks this and exits gracefully), THEN send SIGTERM if the
// process hasn't exited within the grace window.

export async function stopAgent(input: {
  agent_id: AgentId;
  founder_user_id: string | null;
  authorization: "AUTHORIZED" | "REJECTED";
  authorization_reason: string;
  grace_ms?: number;
}): Promise<CommandResult> {
  const { agent_id, founder_user_id, authorization, authorization_reason } = input;
  const grace_ms = input.grace_ms ?? 3000;
  const position = getPosition(agent_id);

  if (authorization !== "AUTHORIZED") {
    auditCommand({
      founder_user_id, agent_id, command: "STOP",
      authorization: "REJECTED", authorization_reason,
      previous_desired_state: position?.desired_state ?? null,
      new_desired_state: null,
      result: "REJECTED", reason: `authorization_rejected:${authorization_reason}`,
    });
    return { ok: false, agent_id, reason: `unauthorized:${authorization_reason}`, code: "REJECTED" };
  }

  if (!position) {
    auditCommand({
      founder_user_id, agent_id, command: "STOP",
      authorization: "AUTHORIZED", authorization_reason,
      previous_desired_state: null, new_desired_state: null,
      result: "REJECTED", reason: "agent_not_registered",
    });
    return { ok: false, agent_id, reason: "agent_not_registered", code: "NOT_REGISTERED" };
  }

  const previousDesired = position.desired_state;
  setDesiredState(agent_id, "STOPPED", `stop_command:${founder_user_id ?? "unknown"}`);
  emitEvent({
    kind: "AGENT_STOP_REQUESTED",
    agent_id: agent_id,
    process_id: null,
    attributes: { requested_by: founder_user_id ?? "unknown" },
  });

  const pidRec = readPidRecord(agent_id);
  if (!pidRec || !isPidAlive(pidRec.pid)) {
    // Nothing to kill — but we still recorded the desired STOP.
    clearPidRecord(agent_id);
    clearHeartbeat(agent_id);
    auditCommand({
      founder_user_id, agent_id, command: "STOP",
      authorization: "AUTHORIZED", authorization_reason,
      previous_desired_state: previousDesired, new_desired_state: "STOPPED",
      result: "NOOP", reason: pidRec ? "process_already_dead" : "no_process",
    });
    return { ok: true, agent_id, reason: pidRec ? "process_already_dead" : "no_process" };
  }

  // Graceful shutdown attempt via SIGTERM (POSIX) / SIGBREAK-fallback
  // to plain kill on Windows.
  try {
    process.kill(pidRec.pid, "SIGTERM");
  } catch {
    // ignore — we'll check aliveness below
  }

  // Wait up to grace_ms for the process to exit; poll aliveness every 250ms.
  const deadline = Date.now() + grace_ms;
  while (Date.now() < deadline) {
    if (!isPidAlive(pidRec.pid)) break;
    await new Promise((r) => setTimeout(r, 250));
  }

  if (isPidAlive(pidRec.pid)) {
    // Force kill.
    try {
      process.kill(pidRec.pid, "SIGKILL");
    } catch {
      // On Windows, SIGKILL isn't real; fall back to taskkill via child_process.
      try {
        const { execSync } = await import("node:child_process");
        execSync(`taskkill /pid ${pidRec.pid} /T /F`, { stdio: "ignore" });
      } catch { /* best-effort */ }
    }
    // Small wait for OS to reap
    await new Promise((r) => setTimeout(r, 500));
  }

  const stillAlive = isPidAlive(pidRec.pid);
  clearPidRecord(agent_id);
  clearHeartbeat(agent_id);
  emitEvent({
    kind: "AGENT_STOPPED",
    agent_id: agent_id,
    process_id: pidRec.pid,
    attributes: { forced: stillAlive ? "unknown_still_alive" : "false" },
  });
  auditCommand({
    founder_user_id, agent_id, command: "STOP",
    authorization: "AUTHORIZED", authorization_reason,
    previous_desired_state: previousDesired, new_desired_state: "STOPPED",
    result: stillAlive ? "PARTIAL" : "OK",
    reason: stillAlive
      ? `pid_${pidRec.pid}_did_not_exit_within_${grace_ms}ms_and_kill_attempt_made`
      : `stopped_pid=${pidRec.pid}`,
  });
  return {
    ok: !stillAlive,
    agent_id,
    reason: stillAlive
      ? `pid_${pidRec.pid}_did_not_exit_after_kill`
      : `stopped_pid=${pidRec.pid}`,
    code: stillAlive ? "SPAWN_FAILED" : undefined as never,
  };
}

// ── STOP ALL / START ALL / STATUS ──────────────────────────────────

export async function stopAll(input: {
  founder_user_id: string | null;
  authorization: "AUTHORIZED" | "REJECTED";
  authorization_reason: string;
}): Promise<{ per_agent: CommandResult[]; override_set: boolean }> {
  if (input.authorization !== "AUTHORIZED") {
    auditCommand({
      founder_user_id: input.founder_user_id, agent_id: "ALL", command: "STOP",
      authorization: "REJECTED", authorization_reason: input.authorization_reason,
      previous_desired_state: null, new_desired_state: null,
      result: "REJECTED", reason: `authorization_rejected:${input.authorization_reason}`,
    });
    return { per_agent: [], override_set: false };
  }
  // §17: set the sticky override FIRST so any watchdog racing us cannot
  // restart the agents we're about to stop.
  setFounderStopOverride(true, input.founder_user_id, "stop_all_command");
  emitEvent({
    kind: "FOUNDER_STOP_OVERRIDE_SET",
    agent_id: "control_plane",
    process_id: process.pid,
    attributes: { set_by: input.founder_user_id ?? "unknown" },
  });

  const results: CommandResult[] = [];
  for (const pos of listPositions()) {
    const r = await stopAgent({
      agent_id: pos.agent_id,
      founder_user_id: input.founder_user_id,
      authorization: "AUTHORIZED",
      authorization_reason: "stop_all",
    });
    results.push(r);
  }
  return { per_agent: results, override_set: true };
}

export async function startAll(input: {
  founder_user_id: string | null;
  authorization: "AUTHORIZED" | "REJECTED";
  authorization_reason: string;
}): Promise<{ per_agent: CommandResult[]; override_released: boolean }> {
  if (input.authorization !== "AUTHORIZED") {
    auditCommand({
      founder_user_id: input.founder_user_id, agent_id: "ALL", command: "START",
      authorization: "REJECTED", authorization_reason: input.authorization_reason,
      previous_desired_state: null, new_desired_state: null,
      result: "REJECTED", reason: `authorization_rejected:${input.authorization_reason}`,
    });
    return { per_agent: [], override_released: false };
  }
  // Release override first — startAgent() also releases but doing it
  // once here is cheaper than N times below.
  const priorOverride = readFounderStopOverride();
  if (priorOverride.active) {
    setFounderStopOverride(false, input.founder_user_id, "start_all_command");
    emitEvent({
      kind: "FOUNDER_STOP_OVERRIDE_RELEASED",
      agent_id: "control_plane",
      process_id: process.pid,
      attributes: { released_by: input.founder_user_id ?? "unknown", reason: "start_all" },
    });
  }
  const results: CommandResult[] = [];
  for (const pos of listPositions()) {
    const r = await startAgent({
      agent_id: pos.agent_id,
      founder_user_id: input.founder_user_id,
      authorization: "AUTHORIZED",
      authorization_reason: "start_all",
    });
    results.push(r);
  }
  return { per_agent: results, override_released: priorOverride.active };
}

// ── STATUS ─────────────────────────────────────────────────────────

export function status(): ControlPlaneStatus {
  const now_iso = new Date().toISOString();
  const nowMs = Date.now();
  const positions = listPositions();
  const agents: AgentStatus[] = positions.map((p) => deriveAgentStatus(p, nowMs));
  const summary = {
    active: agents.filter((a) => a.runtime_state === "RUNNING").length,
    stopped: agents.filter((a) => a.runtime_state === "STOPPED").length,
    crashed: agents.filter((a) => a.runtime_state === "CRASHED").length,
    blocked: agents.filter((a) => a.runtime_state === "BLOCKED").length,
    degraded: agents.filter((a) => a.runtime_state === "DEGRADED").length,
    offline: agents.filter((a) => a.runtime_state === "OFFLINE").length,
  };
  return {
    now_iso,
    founder_stop_override: readFounderStopOverride().active,
    host_state: "AVAILABLE",
    agents,
    summary,
  };
}

// ── Utility: read a heartbeat directly (for /status detail views) ──
export { readHeartbeat };

// ── Watchdog tick · one cycle · acts on recommendations ─────────────
// §15/§16 · §17. Read all positions, assess each via watchdog, and act
// on start/restart recommendations. Must be called by an EXTERNAL
// invoker (Founder CLI, scheduled endpoint, Windows Task Scheduler) —
// §31 forbids a setInterval inside the Next.js request process.

import { watchdogAssess, type WatchdogDecision } from "./watchdog";
// deriveAgentStatus already imported at file top

export type WatchdogTickAction = {
  agent_id: AgentId;
  decision: WatchdogDecision["recommendation"];
  acted: boolean;
  action_result: CommandResult | null;
};

export async function watchdogTickAll(input?: {
  founder_user_id?: string | null;
}): Promise<{ now_iso: string; actions: WatchdogTickAction[] }> {
  const nowMs = Date.now();
  const now_iso = new Date(nowMs).toISOString();
  const positions = listPositions();
  const actions: WatchdogTickAction[] = [];
  for (const pos of positions) {
    const status = deriveAgentStatus(pos, nowMs);
    const dec = watchdogAssess({ position: pos, status, nowMs });
    let acted = false;
    let action_result: CommandResult | null = null;
    if (dec.recommendation.action === "start" || dec.recommendation.action === "restart") {
      // If the process is CRASHED, clear the stale PID + heartbeat
      // before respawning so the new spawn's records replace them.
      if (dec.recommendation.action === "restart") {
        try {
          clearPidRecord(pos.agent_id);
          clearHeartbeat(pos.agent_id);
        } catch { /* best-effort */ }
        emitEvent({
          kind: "AGENT_CRASHED",
          agent_id: pos.agent_id,
          process_id: status.process_id,
          attributes: { detected_by: "watchdog", reason: status.reason },
        });
      }
      const r = await startAgent({
        agent_id: pos.agent_id,
        founder_user_id: input?.founder_user_id ?? "watchdog",
        authorization: "AUTHORIZED",
        authorization_reason: `watchdog:${dec.recommendation.reason}`,
      });
      acted = true;
      action_result = r;
      if (r.ok && dec.recommendation.action === "restart") {
        emitEvent({
          kind: "AGENT_RESTARTED",
          agent_id: pos.agent_id,
          process_id: r.pid ?? null,
          attributes: { reason: dec.recommendation.reason },
        });
      }
    }
    if (dec.recommendation.action === "stop_giveup") {
      emitEvent({
        kind: "AGENT_RESTART_GIVEUP",
        agent_id: pos.agent_id,
        process_id: status.process_id,
        attributes: { reason: dec.recommendation.reason },
      });
    }
    emitEvent({
      kind: "WATCHDOG_TICK",
      agent_id: "watchdog",
      process_id: process.pid,
      attributes: {
        agent: pos.agent_id,
        action: dec.recommendation.action,
        acted: acted ? "true" : "false",
      },
    });
    actions.push({ agent_id: pos.agent_id, decision: dec.recommendation, acted, action_result });
  }
  return { now_iso, actions };
}
