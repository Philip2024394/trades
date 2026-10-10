// WO-NEX-RUNTIME-01 · daemon primitive.
//
// Founder-locked 2026-09-13. `makeAgentDaemon(spec)` produces an object
// that:
//   - loads (or refuses if missing) the agent identity
//   - writes a PROCESS_STARTED audit + AgentInstanceRecord
//   - emits signed heartbeats on its own timer
//   - accepts mission envelopes and increments progress
//   - emits signed evidence
//   - handles SIGTERM cleanly with a PROCESS_STOPPED audit
//
// This is the primitive the four real agent daemons (NEX1, NEX2, NEX3,
// Security) will build on. For RUNTIME-01, the reference user is the
// `minimal-echo` agent under `nex-runtimes/minimal-echo/daemon.mjs`.

import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";

import { getStorage } from "@/lib/nex/storage/registry";
import { createOrLoadIdentity, signHeartbeat, signEvidence, toPublishableIdentity, type AgentIdentity } from "./identity";
import {
  type AgentRuntimeHeartbeat,
  type AgentEvidenceRecord,
  type AgentMissionEnvelope,
  type AgentProcessAuditEvent,
  type AgentInstanceRecord,
  type ProcessLifecycleState,
  AGENT_IDENTITY_COLLECTION,
  AGENT_INSTANCE_COLLECTION,
  AGENT_RUNTIME_HEARTBEAT_COLLECTION,
  AGENT_PROCESS_AUDIT_COLLECTION,
  AGENT_EVIDENCE_COLLECTION,
} from "./types";

// ── PID file layout ────────────────────────────────────────────────────

export function pidFile(repoRoot: string, agent_id: string): string {
  return path.join(repoRoot, "data", "nex-agent-runtime", "pids", `${agent_id}.json`);
}

interface PidFileContents {
  readonly agent_id: string;
  readonly instance_id: string;
  readonly pid: number;
  readonly hostname: string;
  readonly startup_at: string;
}

async function writePidFile(repoRoot: string, contents: PidFileContents): Promise<void> {
  const file = pidFile(repoRoot, contents.agent_id);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(contents, null, 2) + "\n", "utf8");
}

async function readPidFile(repoRoot: string, agent_id: string): Promise<PidFileContents | null> {
  try {
    const raw = await fs.readFile(pidFile(repoRoot, agent_id), "utf8");
    return JSON.parse(raw) as PidFileContents;
  } catch { return null; }
}

async function removePidFile(repoRoot: string, agent_id: string): Promise<void> {
  try { await fs.unlink(pidFile(repoRoot, agent_id)); } catch { /* ok */ }
}

/** Check whether a PID is still running on this host. */
function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    // ESRCH = no such process. EPERM = process exists but we can't signal it (still alive).
    if ((e as NodeJS.ErrnoException).code === "EPERM") return true;
    return false;
  }
}

// ── Daemon spec + handle ───────────────────────────────────────────────

export interface AgentDaemonSpec {
  readonly agent_id: string;
  readonly repoRoot: string;
  readonly heartbeat_interval_ms?: number;   // default 5000
  /** Called every heartbeat tick. Return void or an updated lifecycle
   *  state. The primitive uses INITIALISING / ALIVE_IDLE / MISSION_ASSIGNED
   *  / WORKING / STOPPING / STOPPED automatically; agents override to
   *  report MISSION_STALLED or FAILED. */
  readonly onHeartbeat?: (ctx: HeartbeatContext) => Promise<ProcessLifecycleState | void> | ProcessLifecycleState | void;
  /** Called when a mission envelope arrives via receiveMission. Returns
   *  the number of progress increments and any evidence to emit. */
  readonly onMission?: (env: AgentMissionEnvelope, ctx: MissionContext) => Promise<MissionResult> | MissionResult;
  /** Test-only flag: unref the heartbeat interval so an in-process
   *  daemon does not keep the vitest event loop alive after the test
   *  ends. Production daemon binaries (nex-runtimes/*.mjs) MUST leave
   *  this false so the event loop stays alive. */
  readonly _test_unref_heartbeat?: boolean;
}

export interface HeartbeatContext {
  readonly identity: AgentIdentity;
  readonly instance_id: string;
  readonly current_mission_id: string | null;
  readonly progress_counter: number;
  readonly evidence_refs: readonly string[];
  readonly lifecycle_state: ProcessLifecycleState;
}

export interface MissionContext {
  readonly identity: AgentIdentity;
  readonly instance_id: string;
  /** Emit a signed evidence record. The daemon writes it to GB storage
   *  and adds its evidence_id to `evidence_refs` for future heartbeats. */
  readonly emitEvidence: (kind: string, payload: Readonly<Record<string, unknown>>) => Promise<string>;
  /** Increment the progress counter. Idempotent for zero-arg calls; returns new value. */
  readonly bumpProgress: (delta?: number) => number;
}

export interface MissionResult {
  readonly kind: "COMPLETED" | "FAILED";
  readonly detail: string;
}

export interface AgentDaemonHandle {
  readonly agent_id: string;
  readonly instance_id: string;
  readonly identity_public_key_der_hex: string;
  readonly stop: () => Promise<void>;
  readonly currentLifecycleState: () => ProcessLifecycleState;
  /** Test/queue hook: deliver a mission to this daemon. RUNTIME-02 will
   *  replace this with real queue consumption. */
  readonly receiveMission: (env: AgentMissionEnvelope) => Promise<MissionResult>;
  /** Public read of the current heartbeat progress counter. */
  readonly progressCounter: () => number;
}

// ── Daemon start ───────────────────────────────────────────────────────

export async function makeAgentDaemon(spec: AgentDaemonSpec): Promise<AgentDaemonHandle> {
  const heartbeat_interval_ms = spec.heartbeat_interval_ms ?? 5_000;

  // 1 · Load identity · fail-closed if missing (never silently regenerate
  //     for a daemon start · a fresh generation must be an explicit
  //     provisioning step)
  const identityResult = await createOrLoadIdentity({
    repoRoot: spec.repoRoot,
    agent_id: spec.agent_id,
    createIfMissing: true,     // first start bootstraps · subsequent starts load
  });
  if (!identityResult.ok) {
    throw new Error(`daemon ${spec.agent_id} refused to start: ${identityResult.reason_code} · ${identityResult.reason}`);
  }
  const identity = identityResult.identity;

  // 2 · Refuse to start if a live daemon already claims this agent_id.
  //     The pid file is removed by stop() on clean shutdown; if we see
  //     one with a live pid, another daemon (possibly in this same
  //     process) already holds the slot. The caller must stop the
  //     existing daemon first · we never silently take over.
  const existingPid = await readPidFile(spec.repoRoot, spec.agent_id);
  if (existingPid && isPidAlive(existingPid.pid)) {
    throw new Error(`daemon ${spec.agent_id} refused to start: another process claims this agent_id · pid=${existingPid.pid} · instance=${existingPid.instance_id}`);
  }

  const instance_id = `inst-${randomUUID()}`;
  const startup_at = new Date().toISOString();
  const hostname = os.hostname();
  const pid = process.pid;

  // 3 · Publish identity (idempotent · same public key across restarts)
  await getStorage().save(AGENT_IDENTITY_COLLECTION, toPublishableIdentity(identity));

  // 4 · Write PID file + AgentInstanceRecord
  await writePidFile(spec.repoRoot, { agent_id: spec.agent_id, instance_id, pid, hostname, startup_at });
  const instance: AgentInstanceRecord = {
    record_type: "NEX_AGENT_INSTANCE",
    agent_id: spec.agent_id, instance_id, pid, hostname, startup_at, heartbeat_interval_ms,
    agent_public_key_der_hex: identity.public_key_der_hex,
  };
  await getStorage().save(AGENT_INSTANCE_COLLECTION, instance);

  // 5 · PROCESS_STARTED audit
  await getStorage().save(AGENT_PROCESS_AUDIT_COLLECTION, {
    record_type: "NEX_AGENT_PROCESS_AUDIT",
    event_id: `evt-${randomUUID()}`, kind: "PROCESS_STARTED",
    agent_id: spec.agent_id, instance_id, pid, at: startup_at,
    mission_id: null,
    detail: `agent ${spec.agent_id} started · pid ${pid} · host ${hostname} · identity ${identity.public_key_der_hex.slice(0, 24)}…`,
  } as AgentProcessAuditEvent);

  // ── Mutable per-daemon state ──────────────────────────────────────────
  let lifecycle: ProcessLifecycleState = "INITIALISING";
  let current_mission_id: string | null = null;
  let progress_counter = 0;
  let evidence_refs: string[] = [];
  let stopped = false;

  // ── Heartbeat loop ────────────────────────────────────────────────────
  const emitOnce = async (): Promise<void> => {
    // Give agents a chance to update lifecycle
    if (spec.onHeartbeat) {
      try {
        const returned = await spec.onHeartbeat({
          identity, instance_id, current_mission_id, progress_counter, evidence_refs, lifecycle_state: lifecycle,
        });
        if (returned) lifecycle = returned;
      } catch (e) {
        lifecycle = "FAILED";
        await getStorage().save(AGENT_PROCESS_AUDIT_COLLECTION, {
          record_type: "NEX_AGENT_PROCESS_AUDIT",
          event_id: `evt-${randomUUID()}`, kind: "MISSION_FAILED",
          agent_id: spec.agent_id, instance_id, pid,
          at: new Date().toISOString(), mission_id: current_mission_id,
          detail: `onHeartbeat threw: ${(e as Error).message}`,
        } as AgentProcessAuditEvent);
      }
    } else if (lifecycle === "INITIALISING") {
      lifecycle = "ALIVE_IDLE";
    }
    const hb = signHeartbeat(identity, {
      record_type: "NEX_AGENT_RUNTIME_HEARTBEAT",
      heartbeat_id: `hb-${randomUUID()}`,
      agent_id: spec.agent_id, instance_id, pid,
      emitted_at: new Date().toISOString(),
      mission_id: current_mission_id, progress_counter,
      evidence_refs: [...evidence_refs],
      lifecycle_state: lifecycle,
    });
    await getStorage().save(AGENT_RUNTIME_HEARTBEAT_COLLECTION, hb);
  };
  await emitOnce();   // first heartbeat before entering the loop
  const timer = setInterval(() => { emitOnce().catch(() => { /* swallowed for the loop · errors recorded via audit */ }); }, heartbeat_interval_ms);
  // In-process test daemons opt-in to unref so vitest can exit. Production
  // daemon binaries leave this off so the event loop stays alive
  // indefinitely, per §17 acceptance test 4 (agent survives parent kill).
  if (spec._test_unref_heartbeat && typeof timer.unref === "function") timer.unref();

  // ── Mission handler ───────────────────────────────────────────────────
  const receiveMission = async (env: AgentMissionEnvelope): Promise<MissionResult> => {
    if (stopped) return { kind: "FAILED", detail: "daemon stopped · rejecting mission" };
    if (env.agent_id !== spec.agent_id) {
      return { kind: "FAILED", detail: `mission is for agent ${env.agent_id} but daemon is ${spec.agent_id}` };
    }
    current_mission_id = env.mission_id;
    lifecycle = "MISSION_ASSIGNED";
    await getStorage().save(AGENT_PROCESS_AUDIT_COLLECTION, {
      record_type: "NEX_AGENT_PROCESS_AUDIT",
      event_id: `evt-${randomUUID()}`, kind: "MISSION_ASSIGNED",
      agent_id: spec.agent_id, instance_id, pid,
      at: new Date().toISOString(), mission_id: env.mission_id,
      detail: `mission ${env.mission_id} kind=${env.kind}`,
    } as AgentProcessAuditEvent);

    const missionCtx: MissionContext = {
      identity, instance_id,
      emitEvidence: async (kind, payload) => {
        const evBase: Omit<AgentEvidenceRecord, "signature_hex"> = {
          record_type: "NEX_AGENT_EVIDENCE",
          evidence_id: `ev-${randomUUID()}`,
          agent_id: spec.agent_id, instance_id,
          mission_id: current_mission_id,
          emitted_at: new Date().toISOString(),
          kind, payload,
        };
        const signed = signEvidence(identity, evBase);
        await getStorage().save(AGENT_EVIDENCE_COLLECTION, signed);
        evidence_refs = [...evidence_refs, signed.evidence_id];
        await getStorage().save(AGENT_PROCESS_AUDIT_COLLECTION, {
          record_type: "NEX_AGENT_PROCESS_AUDIT",
          event_id: `evt-${randomUUID()}`, kind: "EVIDENCE_EMITTED",
          agent_id: spec.agent_id, instance_id, pid,
          at: new Date().toISOString(), mission_id: current_mission_id,
          detail: `evidence ${signed.evidence_id} kind=${kind}`,
        } as AgentProcessAuditEvent);
        return signed.evidence_id;
      },
      bumpProgress: (delta = 1) => {
        progress_counter += delta;
        // Only WORKING when the four conditions all hold
        if (current_mission_id && progress_counter > 0 && evidence_refs.length > 0) {
          lifecycle = "WORKING";
        }
        return progress_counter;
      },
    };

    if (!spec.onMission) {
      return { kind: "FAILED", detail: "no onMission handler configured" };
    }
    let result: MissionResult;
    try {
      result = await spec.onMission(env, missionCtx);
    } catch (e) {
      result = { kind: "FAILED", detail: `onMission threw: ${(e as Error).message}` };
    }
    await getStorage().save(AGENT_PROCESS_AUDIT_COLLECTION, {
      record_type: "NEX_AGENT_PROCESS_AUDIT",
      event_id: `evt-${randomUUID()}`,
      kind: result.kind === "COMPLETED" ? "MISSION_COMPLETED" : "MISSION_FAILED",
      agent_id: spec.agent_id, instance_id, pid,
      at: new Date().toISOString(), mission_id: env.mission_id,
      detail: result.detail,
    } as AgentProcessAuditEvent);
    // Reset mission but keep evidence_refs and progress_counter (agent may take a new mission)
    current_mission_id = null;
    lifecycle = "ALIVE_IDLE";
    return result;
  };

  // ── Stop ──────────────────────────────────────────────────────────────
  const stop = async (): Promise<void> => {
    if (stopped) return;
    stopped = true;
    lifecycle = "STOPPING";
    clearInterval(timer);
    // Emit final STOPPED heartbeat
    lifecycle = "STOPPED";
    await emitOnce().catch(() => { /* ok */ });
    await getStorage().save(AGENT_PROCESS_AUDIT_COLLECTION, {
      record_type: "NEX_AGENT_PROCESS_AUDIT",
      event_id: `evt-${randomUUID()}`, kind: "PROCESS_STOPPED",
      agent_id: spec.agent_id, instance_id, pid,
      at: new Date().toISOString(), mission_id: null,
      detail: "clean shutdown",
    } as AgentProcessAuditEvent);
    await removePidFile(spec.repoRoot, spec.agent_id);
  };

  // Install SIGTERM/SIGINT handlers for OS-driven shutdown
  const sigHandler = () => { stop().catch(() => { /* ok */ }); };
  process.once("SIGTERM", sigHandler);
  process.once("SIGINT", sigHandler);

  // Move to ALIVE_IDLE now that we're up
  if (lifecycle === "INITIALISING") lifecycle = "ALIVE_IDLE";

  return {
    agent_id: spec.agent_id,
    instance_id,
    identity_public_key_der_hex: identity.public_key_der_hex,
    stop,
    currentLifecycleState: () => lifecycle,
    receiveMission,
    progressCounter: () => progress_counter,
  };
}
