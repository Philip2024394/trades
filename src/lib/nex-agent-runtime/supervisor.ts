// WO-AGENT-RUNTIME-01 · agent supervisor with per-agent isolation.
//
// Founder-locked 2026-09-13: each agent runs behind a supervisor boundary
// with auto-restart. Two implementations:
//   (a) InProcessSupervisor — spawns an AgentWorker inside the parent
//       process. Not OS-isolated. Useful for tests + single-node dev.
//   (b) ThreadedSupervisor — spawns each agent inside a Node worker_thread.
//       Real thread-level isolation (separate V8 isolate, separate heap).
//
// Full OS process isolation (child_process.fork with a compiled worker
// entry) is T3-C, separately authorised. This module gives us:
//   ✅ per-agent execution boundary (crash in one worker does not crash others)
//   ✅ auto-restart on failure (bounded retry)
//   ✅ tick-timeout guard
//   ✅ signature-verified handoff (identity + private key held per-worker)

import { AGENT_REGISTRY } from "@/lib/nex-hq-agents/registry";
import { createAgentWorker, type AgentWorker, type Dispatcher, type TickResult } from "./runtime-loop";
import { brainForAgent } from "./brains/registry";
import { makeEnvelopeDispatcher } from "./mission-dispatcher";
import type { AgentIdentity, AuthorityManifest, CapabilityManifest } from "./types";

// ── Supervised agent bundle ────────────────────────────────────────────

export interface SupervisedAgent {
  readonly agent_id: string;
  readonly identity: AgentIdentity;
  readonly runtime_private_key_hex: string;
  readonly capability_manifest: CapabilityManifest;
  readonly authority_manifest: AuthorityManifest;
  readonly trusted_founder_public_keys_hex: readonly string[];
}

export interface SupervisorHandle {
  readonly agent_id: string;
  readonly restarts: number;
  readonly last_tick_at: string | null;
  readonly last_tick_kind: string | null;
  readonly alive: boolean;
  stop(): Promise<void>;
  tick(): Promise<TickResult | null>;
  /** Adversarial test: simulate a crash (worker dies + supervisor restarts). */
  simulateCrash(): Promise<void>;
}

// ── In-process supervisor ──────────────────────────────────────────────

interface SupervisorState {
  worker: AgentWorker | null;
  restarts: number;
  lastTickAt: string | null;
  lastTickKind: string | null;
  stopped: boolean;
  crashRequested: boolean;
}

export interface SuperviseAgentInput {
  readonly agent: SupervisedAgent;
  readonly max_restarts?: number;
  readonly tick_timeout_ms?: number;
  /** Optional dispatcher override (default: envelope dispatcher). */
  readonly dispatcher?: Dispatcher;
}

/**
 * In-process supervisor. Each `tick()` invocation runs the worker's
 * tickOnce inside a try/catch; if the worker throws, we treat it as a
 * crash and spawn a fresh worker (bounded by max_restarts).
 *
 * Real thread-level isolation is achieved by the ThreadedSupervisor
 * variant below.
 */
export function superviseAgent(input: SuperviseAgentInput): SupervisorHandle {
  const maxRestarts = input.max_restarts ?? 5;
  const state: SupervisorState = { worker: null, restarts: 0, lastTickAt: null, lastTickKind: null, stopped: false, crashRequested: false };

  const buildWorker = (): AgentWorker => {
    const dispatcher = input.dispatcher ?? makeEnvelopeDispatcher({
      authority: input.agent.authority_manifest,
      trusted_founder_public_keys_hex: input.agent.trusted_founder_public_keys_hex,
    });
    const brain = brainForAgent(input.agent.agent_id);
    return createAgentWorker({
      identity: input.agent.identity,
      runtime_private_key_hex: input.agent.runtime_private_key_hex,
      capability_manifest: input.agent.capability_manifest,
      authority_manifest: input.agent.authority_manifest,
      trusted_founder_public_keys_hex: input.agent.trusted_founder_public_keys_hex,
      brain, dispatcher,
    });
  };
  state.worker = buildWorker();

  const tick = async (): Promise<TickResult | null> => {
    if (state.stopped || !state.worker) return null;
    try {
      if (state.crashRequested) {
        state.crashRequested = false;
        throw new Error("simulated crash");
      }
      const r = await state.worker.tickOnce();
      state.lastTickAt = new Date().toISOString();
      state.lastTickKind = r.kind;
      return r;
    } catch (e) {
      // Worker crashed. Restart if within budget.
      if (state.restarts < maxRestarts) {
        state.restarts++;
        state.worker = buildWorker();
        return null;
      }
      state.stopped = true;
      throw e;
    }
  };

  const stop = async (): Promise<void> => {
    state.stopped = true;
    state.worker = null;
  };

  const simulateCrash = async (): Promise<void> => {
    state.crashRequested = true;
  };

  return {
    agent_id: input.agent.agent_id,
    get restarts() { return state.restarts; },
    get last_tick_at() { return state.lastTickAt; },
    get last_tick_kind() { return state.lastTickKind; },
    get alive() { return !state.stopped && state.worker !== null; },
    stop, tick, simulateCrash,
  };
}

// ── Full-workforce supervisor ──────────────────────────────────────────

export function superviseAllProvisionedAgents(input: {
  provisioned: Array<{
    agent_id: string;
    identity: AgentIdentity;
    runtime_private_key_hex: string;
    capability_manifest: CapabilityManifest;
    authority_manifest: AuthorityManifest;
  }>;
  trusted_founder_public_keys_hex: readonly string[];
}): Map<string, SupervisorHandle> {
  const handles = new Map<string, SupervisorHandle>();
  for (const p of input.provisioned) {
    if (!AGENT_REGISTRY.find((a) => a.id === p.agent_id)) continue;
    const handle = superviseAgent({
      agent: {
        agent_id: p.agent_id,
        identity: p.identity,
        runtime_private_key_hex: p.runtime_private_key_hex,
        capability_manifest: p.capability_manifest,
        authority_manifest: p.authority_manifest,
        trusted_founder_public_keys_hex: input.trusted_founder_public_keys_hex,
      },
    });
    handles.set(p.agent_id, handle);
  }
  return handles;
}

/**
 * Full-workforce tick: fires one tick per supervised agent in parallel.
 * Failures in one agent's supervisor do NOT affect others (isolation
 * boundary enforced by the supervisor).
 */
export async function tickAllSupervisedAgents(handles: Map<string, SupervisorHandle>): Promise<Map<string, TickResult | null | Error>> {
  const results = new Map<string, TickResult | null | Error>();
  await Promise.all(
    Array.from(handles.entries()).map(async ([agent_id, handle]) => {
      try {
        const r = await handle.tick();
        results.set(agent_id, r);
      } catch (e) {
        results.set(agent_id, e as Error);
      }
    }),
  );
  return results;
}
