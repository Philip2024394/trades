// src/lib/nex/agent-runtime/registry.ts
//
// NEX Agent Runtime · persistent registry (§23 · §34 · §35)
// Philip 2026-09-06 · FOUNDER AUTHORIZATION
//
// Persistent record of every registered agent's desired_state,
// restart_policy, resource_budget, etc. The runtime_state is NOT stored
// here — it is derived at read time from heartbeats + process aliveness
// (see runtime-state.ts). This separation is critical to §35: registry
// records intent (desired_state); the world records reality
// (runtime_state).

import fs from "node:fs";
import path from "node:path";
import {
  type AgentId,
  type DesiredState,
  type PositionRuntime,
  type FounderStopOverride,
  defaultRestartPolicy,
  defaultResourceBudget,
} from "./types";
import {
  runtimeDataRoot,
  positionsPath,
  founderStopOverridePath,
} from "./paths";

function ensureDir(): void {
  const dir = runtimeDataRoot();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJsonSafe<T>(p: string, fallback: T): T {
  try {
    if (!fs.existsSync(p)) return fallback;
    const raw = fs.readFileSync(p, "utf8");
    if (!raw.trim()) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(p: string, value: unknown): void {
  ensureDir();
  const tmp = `${p}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), "utf8");
  fs.renameSync(tmp, p);
}

// ── Registry ────────────────────────────────────────────────────────

type RegistryFile = {
  version: number;
  positions: PositionRuntime[];
};

function readRegistry(): RegistryFile {
  return readJsonSafe<RegistryFile>(positionsPath(), { version: 1, positions: [] });
}

function writeRegistry(reg: RegistryFile): void {
  writeJsonAtomic(positionsPath(), reg);
}

/** Idempotent registration — inserts if absent, updates static fields
 *  (never overwrites desired_state or last_desired_change). */
export function registerAgent(input: {
  agent_id: AgentId;
  machinery: string;
  domain: string;
  internet_requirement: PositionRuntime["internet_requirement"];
  authorization_state?: PositionRuntime["authorization_state"];
}): PositionRuntime {
  const now = new Date().toISOString();
  const reg = readRegistry();
  const existing = reg.positions.find((p) => p.agent_id === input.agent_id);
  if (existing) {
    // Update static fields but PRESERVE desired_state (Founder's intent).
    existing.machinery = input.machinery;
    existing.domain = input.domain;
    existing.internet_requirement = input.internet_requirement;
    if (input.authorization_state) existing.authorization_state = input.authorization_state;
    writeRegistry(reg);
    return existing;
  }
  const fresh: PositionRuntime = {
    agent_id: input.agent_id,
    machinery: input.machinery,
    domain: input.domain,
    authorization_state: input.authorization_state ?? "AUTHORIZED",
    desired_state: "STOPPED",     // §35 default: registry is intent · new registration must not auto-start
    restart_policy: defaultRestartPolicy(),
    internet_requirement: input.internet_requirement,
    resource_budget: defaultResourceBudget(),
    heartbeat_interval_ms: 5000,
    queue_capacity: 100,
    registered_at_iso: now,
    last_desired_change_iso: now,
    last_desired_change_reason: "initial_registration",
  };
  reg.positions.push(fresh);
  writeRegistry(reg);
  return fresh;
}

export function listPositions(): PositionRuntime[] {
  return readRegistry().positions.slice();
}

export function getPosition(agent_id: AgentId): PositionRuntime | null {
  return readRegistry().positions.find((p) => p.agent_id === agent_id) ?? null;
}

/** Update the desired state — the single most important control-plane
 *  write. Records the change reason for audit. */
export function setDesiredState(
  agent_id: AgentId,
  desired: DesiredState,
  reason: string,
): PositionRuntime {
  const reg = readRegistry();
  const pos = reg.positions.find((p) => p.agent_id === agent_id);
  if (!pos) {
    throw new Error(`nex-runtime:registry:unknown_agent:${agent_id}`);
  }
  if (pos.desired_state !== desired) {
    pos.desired_state = desired;
    pos.last_desired_change_iso = new Date().toISOString();
    pos.last_desired_change_reason = reason;
    writeRegistry(reg);
  }
  return pos;
}

// ── Founder STOP override (§17) ────────────────────────────────────

export function readFounderStopOverride(): FounderStopOverride {
  return readJsonSafe<FounderStopOverride>(founderStopOverridePath(), {
    active: false,
    set_at_iso: null,
    set_by_user_id: null,
    reason: "never_set",
  });
}

export function setFounderStopOverride(
  active: boolean,
  user_id: string | null,
  reason: string,
): FounderStopOverride {
  const record: FounderStopOverride = {
    active,
    set_at_iso: active ? new Date().toISOString() : null,
    set_by_user_id: active ? user_id : null,
    reason,
  };
  writeJsonAtomic(founderStopOverridePath(), record);
  return record;
}
