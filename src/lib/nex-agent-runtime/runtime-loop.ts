// WO-AGENT-RUNTIME-01 · generic per-agent runtime loop.
//
// Founder-locked 2026-09-13: each agent runs a supervisor loop that:
//   1. Loads its own identity + memory + capability manifest + authority manifest
//   2. Emits a signed ALIVE heartbeat (pure liveness, no progress claim)
//   3. Polls the dispatcher for authorised missions (pull model)
//   4. On mission received: emits ALIVE_NO_PROGRESS heartbeat
//   5. Executes via brain(tools, memory, authority)
//   6. Every progress-worthy event: emits signed heartbeat with real evidence_refs
//   7. On mission complete: writes performance record, emits final heartbeat,
//      flushes learning contributions
//   8. On failure: consults recovery-policy, applies bounded action
//
// Central process NEVER emits heartbeats for an agent · always the agent
// itself using its own runtime private key.

import { getStorage } from "@/lib/nex/storage/registry";
import type {
  AgentIdentity,
  AgentHeartbeatEvent,
  AuthorityManifest,
  CapabilityManifest,
} from "./types";
import { emitHeartbeat, type EmitHeartbeatResult } from "./heartbeat-emitter";
import { authorityPermits } from "./authority-manifest";
import { writeAgentMemory, readAgentMemory } from "./memory";
import { recordPerformance } from "./performance-history";
import { emitLearningContribution } from "./learning-contribution";
import { decideAgentRecovery, type AgentFailure, type RecoveryPolicyState } from "./recovery-policy";

export const AGENT_HEARTBEAT_EVENT_COLLECTION = "nex_agent_heartbeat_events";

// ── Brain contract each agent supplies ─────────────────────────────────

export interface Mission {
  readonly mission_id: string;
  readonly kind: string;
  readonly authorised_hosts: readonly string[];
  readonly input: Readonly<Record<string, unknown>>;
  readonly budget_ms: number;
  readonly deadline_iso: string;
}

export interface BrainToolContext {
  readonly identity: AgentIdentity;
  readonly runtime_private_key_hex: string;
  readonly authority: AuthorityManifest;
  /** Founder-signed public keys the brain can trust when verifying
   *  registry manifests, envelopes, etc. */
  readonly trusted_founder_public_keys_hex: readonly string[];
  readonly emitProgress: (input: {
    progress_counter: number;
    last_completed_work: string;
    evidence_refs: readonly string[];
  }) => Promise<AgentHeartbeatEvent>;
  readonly writeMemory: (input: { kind: "MISSION_OUTCOME" | "FAILURE" | "VALIDATED_LESSON" | "LEARNED_PATTERN"; mission_id: string | null; content: Readonly<Record<string, unknown>> }) => Promise<string>;
  readonly readMemory: (input: { kind?: "MISSION_OUTCOME" | "FAILURE" | "VALIDATED_LESSON" | "LEARNED_PATTERN"; limit?: number }) => Promise<Array<{ memory_id: string; content: Readonly<Record<string, unknown>> }>>;
  readonly contributeLearning: (input: { kind: "VALIDATED_LESSON" | "NEW_PATTERN" | "RETRACTED_ASSUMPTION"; content: Readonly<Record<string, unknown>>; evidence_refs: readonly string[] }) => Promise<{ ok: boolean; contribution_id?: string; reason?: string }>;
}

export interface MissionResult {
  readonly outcome: "SUCCESS" | "FAILURE" | "PARTIAL";
  readonly items_processed: number;
  readonly evidence_refs: readonly string[];
  readonly summary: string;
}

export type AgentBrain = (mission: Mission, ctx: BrainToolContext) => Promise<MissionResult>;

// ── Dispatcher contract (pull model · agent asks for work) ─────────────

export interface Dispatcher {
  /** Non-blocking check for an authorised mission. Returns null if none available. */
  poll: (agent_id: string) => Promise<Mission | null>;
  /** Called after mission completion (records outcome). */
  report: (agent_id: string, mission_id: string, result: MissionResult) => Promise<void>;
}

// ── Worker instance ────────────────────────────────────────────────────

export interface AgentWorkerOptions {
  readonly identity: AgentIdentity;
  readonly runtime_private_key_hex: string;
  readonly capability_manifest: CapabilityManifest;
  readonly authority_manifest: AuthorityManifest;
  /** Founder-signed public keys the brain trusts for registry/envelope verification. */
  readonly trusted_founder_public_keys_hex?: readonly string[];
  readonly brain: AgentBrain;
  readonly dispatcher: Dispatcher;
  readonly heartbeat_interval_ms?: number;   // pure-liveness cadence (default 30s)
  readonly poll_interval_ms?: number;        // dispatcher poll cadence (default 5s)
}

export interface AgentWorker {
  readonly agent_id: string;
  readonly identity_id: string;
  /** Start the loop. Returns a stop() function. */
  start(): { stop: () => Promise<void> };
  /** Manually trigger a single tick (for tests). */
  tickOnce(): Promise<TickResult>;
}

export interface TickResult {
  readonly kind: "IDLE" | "DISPATCHED" | "SUCCESS" | "FAILURE" | "PARTIAL" | "RECOVERY";
  readonly heartbeat_ids: readonly string[];
  readonly evidence_refs: readonly string[];
  readonly reason: string;
}

interface WorkerState {
  running: boolean;
  recovery: RecoveryPolicyState;
  last_liveness_at: number;
}

export function createAgentWorker(opts: AgentWorkerOptions): AgentWorker {
  const state: WorkerState = {
    running: false,
    recovery: { consecutive_failures: 0, total_failures_24h: 0, last_success_at: null },
    last_liveness_at: 0,
  };
  const heartbeatIntervalMs = opts.heartbeat_interval_ms ?? 30_000;
  const pollIntervalMs = opts.poll_interval_ms ?? 5_000;

  async function persistHeartbeat(h: AgentHeartbeatEvent): Promise<void> {
    await getStorage().save(AGENT_HEARTBEAT_EVENT_COLLECTION, h);
  }

  async function emitLiveness(): Promise<AgentHeartbeatEvent> {
    const r = emitHeartbeat({
      identity: opts.identity,
      runtime_private_key_hex: opts.runtime_private_key_hex,
      mission_id: null,
      progress_counter: 0,
      last_completed_work: null,
      evidence_refs: [],
    });
    if (!r.ok) throw new Error(`unexpected heartbeat rejection: ${r.reason}`);
    await persistHeartbeat(r.heartbeat);
    state.last_liveness_at = Date.now();
    return r.heartbeat;
  }

  async function emitAliveNoProgress(mission_id: string): Promise<AgentHeartbeatEvent> {
    const r = emitHeartbeat({
      identity: opts.identity,
      runtime_private_key_hex: opts.runtime_private_key_hex,
      mission_id, progress_counter: 0, last_completed_work: "mission received · runtime started", evidence_refs: [],
    });
    if (!r.ok) throw new Error(`unexpected heartbeat rejection: ${r.reason}`);
    await persistHeartbeat(r.heartbeat);
    return r.heartbeat;
  }

  function buildBrainContext(mission_id_ref: { current: string | null }, evidence_accum: string[], heartbeat_accum: string[], progress_counter_ref: { value: number }): BrainToolContext {
    return {
      identity: opts.identity,
      runtime_private_key_hex: opts.runtime_private_key_hex,
      authority: opts.authority_manifest,
      trusted_founder_public_keys_hex: opts.trusted_founder_public_keys_hex ?? [],
      emitProgress: async ({ progress_counter, last_completed_work, evidence_refs }) => {
        const r = emitHeartbeat({
          identity: opts.identity,
          runtime_private_key_hex: opts.runtime_private_key_hex,
          mission_id: mission_id_ref.current,
          progress_counter,
          last_completed_work,
          evidence_refs,
        });
        if (!r.ok) throw new Error(`heartbeat rejected: ${r.rejection} · ${r.reason}`);
        await persistHeartbeat(r.heartbeat);
        heartbeat_accum.push(r.heartbeat.heartbeat_id);
        for (const e of evidence_refs) if (!evidence_accum.includes(e)) evidence_accum.push(e);
        progress_counter_ref.value = Math.max(progress_counter_ref.value, progress_counter);
        return r.heartbeat;
      },
      writeMemory: async ({ kind, mission_id, content }) => {
        const rec = await writeAgentMemory({
          identity: opts.identity,
          runtime_private_key_hex: opts.runtime_private_key_hex,
          kind, mission_id, content,
        });
        return rec.memory_id;
      },
      readMemory: async ({ kind, limit }) => {
        const rs = await readAgentMemory({ agent_id: opts.identity.agent_id, kind, limit });
        return rs.map((r) => ({ memory_id: r.memory_id, content: r.content }));
      },
      contributeLearning: async ({ kind, content, evidence_refs }) => {
        const r = await emitLearningContribution({
          identity: opts.identity,
          runtime_private_key_hex: opts.runtime_private_key_hex,
          mission_id: mission_id_ref.current ?? "unknown",
          kind, content, evidence_refs,
        });
        if (!r.ok) return { ok: false, reason: r.reason };
        return { ok: true, contribution_id: r.contribution.contribution_id };
      },
    };
  }

  async function executeOneMission(mission: Mission): Promise<TickResult> {
    const started_at = new Date().toISOString();
    const startedMs = Date.now();
    const heartbeat_ids: string[] = [];
    const evidence_refs: string[] = [];
    const progressRef = { value: 0 };
    const missionRef = { current: mission.mission_id as string | null };

    // Enforce authority envelope: mission's authorised_hosts must be a subset of the agent's authorised_hosts.
    for (const host of mission.authorised_hosts) {
      const p = authorityPermits({ manifest: opts.authority_manifest, action: { kind: "host", value: host } });
      if (!p.permitted) {
        const failure: AgentFailure = { kind: "AUTHORITY_DENIED", at: new Date().toISOString(), mission_id: mission.mission_id, reason: p.reason };
        state.recovery = { ...state.recovery, consecutive_failures: state.recovery.consecutive_failures + 1, total_failures_24h: state.recovery.total_failures_24h + 1 };
        const decision = decideAgentRecovery({ identity: opts.identity, failure, state: state.recovery });
        return { kind: "FAILURE", heartbeat_ids, evidence_refs, reason: `authority denied on host "${host}" · recovery decision: ${decision.action}` };
      }
    }

    try {
      const hb0 = await emitAliveNoProgress(mission.mission_id);
      heartbeat_ids.push(hb0.heartbeat_id);

      const ctx = buildBrainContext(missionRef, evidence_refs, heartbeat_ids, progressRef);
      const result = await opts.brain(mission, ctx);

      // Final heartbeat with the full evidence_refs list. Only sign if there is real progress.
      if (result.evidence_refs.length > 0) {
        const rFinal = emitHeartbeat({
          identity: opts.identity,
          runtime_private_key_hex: opts.runtime_private_key_hex,
          mission_id: mission.mission_id,
          progress_counter: progressRef.value + 1,
          last_completed_work: `mission complete · ${result.summary}`,
          evidence_refs: result.evidence_refs,
        });
        if (rFinal.ok) { await persistHeartbeat(rFinal.heartbeat); heartbeat_ids.push(rFinal.heartbeat.heartbeat_id); }
      }

      // Record performance
      await recordPerformance({
        identity: opts.identity,
        runtime_private_key_hex: opts.runtime_private_key_hex,
        mission_id: mission.mission_id,
        started_at,
        outcome: result.outcome,
        evidence_refs: result.evidence_refs,
        items_processed: result.items_processed,
        compute_used_ms: Date.now() - startedMs,
      });

      // Write mission outcome memory
      await writeAgentMemory({
        identity: opts.identity,
        runtime_private_key_hex: opts.runtime_private_key_hex,
        kind: "MISSION_OUTCOME", mission_id: mission.mission_id,
        content: { outcome: result.outcome, items_processed: result.items_processed, summary: result.summary },
      });

      await opts.dispatcher.report(opts.identity.agent_id, mission.mission_id, result);

      state.recovery = { consecutive_failures: 0, total_failures_24h: state.recovery.total_failures_24h, last_success_at: new Date().toISOString() };

      return {
        kind: result.outcome === "SUCCESS" ? "SUCCESS" : result.outcome === "PARTIAL" ? "PARTIAL" : "FAILURE",
        heartbeat_ids: Object.freeze([...heartbeat_ids]) as readonly string[],
        evidence_refs: Object.freeze([...evidence_refs, ...result.evidence_refs.filter((e) => !evidence_refs.includes(e))]) as readonly string[],
        reason: result.summary,
      };
    } catch (e) {
      const failure: AgentFailure = { kind: "UNKNOWN", at: new Date().toISOString(), mission_id: mission.mission_id, reason: (e as Error).message };
      state.recovery = { ...state.recovery, consecutive_failures: state.recovery.consecutive_failures + 1, total_failures_24h: state.recovery.total_failures_24h + 1 };
      const decision = decideAgentRecovery({ identity: opts.identity, failure, state: state.recovery });
      await writeAgentMemory({
        identity: opts.identity,
        runtime_private_key_hex: opts.runtime_private_key_hex,
        kind: "FAILURE", mission_id: mission.mission_id,
        content: { reason: failure.reason, recovery_action: decision.action },
      });
      await recordPerformance({
        identity: opts.identity,
        runtime_private_key_hex: opts.runtime_private_key_hex,
        mission_id: mission.mission_id,
        started_at,
        outcome: "FAILURE",
        evidence_refs: evidence_refs,
        items_processed: 0,
        compute_used_ms: Date.now() - startedMs,
      });
      return { kind: "FAILURE", heartbeat_ids, evidence_refs, reason: `${failure.reason} · recovery: ${decision.action}` };
    }
  }

  async function tickOnce(): Promise<TickResult> {
    // Pure liveness first if beyond cadence
    if (Date.now() - state.last_liveness_at > heartbeatIntervalMs) {
      const hb = await emitLiveness();
      // Non-blocking heartbeat_ids record — the poll may still find a mission
      const mission = await opts.dispatcher.poll(opts.identity.agent_id);
      if (!mission) return { kind: "IDLE", heartbeat_ids: [hb.heartbeat_id], evidence_refs: [], reason: "no eligible mission" };
      return await executeOneMission(mission);
    }
    const mission = await opts.dispatcher.poll(opts.identity.agent_id);
    if (!mission) return { kind: "IDLE", heartbeat_ids: [], evidence_refs: [], reason: "no eligible mission (within heartbeat interval)" };
    return await executeOneMission(mission);
  }

  function start(): { stop: () => Promise<void> } {
    if (state.running) throw new Error(`worker for ${opts.identity.agent_id} already running`);
    state.running = true;
    let stopped = false;
    const loop = async (): Promise<void> => {
      while (!stopped) {
        try { await tickOnce(); } catch { /* recovery is inside tickOnce */ }
        await new Promise((r) => setTimeout(r, pollIntervalMs));
      }
    };
    loop().catch(() => {});
    return {
      stop: async () => { stopped = true; state.running = false; },
    };
  }

  return { agent_id: opts.identity.agent_id, identity_id: opts.identity.identity_id, start, tickOnce };
}
