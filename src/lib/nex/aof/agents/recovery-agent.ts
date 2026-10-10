// src/lib/nex/aof/agents/recovery-agent.ts
//
// NEX Autonomous Operations Framework · Heartbeat / Recovery Agent
// Founder-authorised programme · 2026-09-22.
//
// Wraps existing runHarvestReaper + adds AOF-level heartbeat.

import type { PgClient } from "../types";
import { requireCapability } from "../capability";
import { logAgentEvent, agentHeartbeat } from "../lifecycle";
import { runHarvestReaper } from "@/lib/nex/harvest";

export interface RecoveryDeps {
  readonly client: PgClient;
  readonly agent_id: string;
  readonly worker_id?: string;
  readonly cycle_id?: string;
}

export async function reapStaleLeases(deps: RecoveryDeps): Promise<{ released: number }> {
  await requireCapability(deps.client, deps.agent_id, "recover_worker");
  const rep = await runHarvestReaper(deps.client, {});
  const released = (rep as any)?.released_leases ?? (rep as any)?.leases_released ?? 0;
  await logAgentEvent(deps.client, {
    agent_id: deps.agent_id, event_kind: "decision", cycle_id: deps.cycle_id ?? null,
    payload: { op: "reap", released, report: rep },
  });
  return { released };
}

export async function heartbeat(deps: RecoveryDeps, payload?: Record<string, unknown>): Promise<void> {
  await requireCapability(deps.client, deps.agent_id, "emit_heartbeat");
  await agentHeartbeat(deps.client, deps.agent_id, deps.worker_id, payload);
}
