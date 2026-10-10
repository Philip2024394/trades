// src/lib/nex/aof/agents/live-streaming-agent.ts
//
// NEX Autonomous Operations Framework · Live Streaming Agent
// Founder-authorised programme · 2026-09-22.
//
// Publishes a compact operational snapshot into aof_agent_event so the
// Operations Centre can render live state. Consumers query recent
// events. This agent doesn't open external streams · it makes the
// state observable inside the governed event log.

import type { PgClient } from "../types";
import { requireCapability } from "../capability";
import { logAgentEvent } from "../lifecycle";

export interface StreamDeps {
  readonly client: PgClient;
  readonly agent_id: string;
  readonly cycle_id?: string;
}

export interface OperationalSnapshot {
  readonly at: string;
  readonly queue: { queued: number; claimed: number; completed: number; failed: number };
  readonly workers_active: number;
  readonly cycles_active: number;
  readonly sources_cooled_down: number;
  readonly agents_active: number;
}

export async function streamOperationalSnapshot(deps: StreamDeps): Promise<OperationalSnapshot> {
  await requireCapability(deps.client, deps.agent_id, "stream_events");
  const q = await deps.client.query(`SELECT status, COUNT(*)::int c FROM nex.harvest_job GROUP BY status`);
  const queue = { queued: 0, claimed: 0, completed: 0, failed: 0 };
  for (const r of q.rows) if (r.status in queue) (queue as any)[r.status] = Number(r.c);
  const w = await deps.client.query(`SELECT COUNT(*)::int c FROM nex.harvest_worker WHERE last_heartbeat_at > now() - INTERVAL '2 minutes'`);
  const cyc = await deps.client.query(`SELECT COUNT(*)::int c FROM nex.aof_cycle WHERE ended_at IS NULL`);
  const cd = await deps.client.query(`SELECT COUNT(*)::int c FROM nex.aof_source_cooldown WHERE cooldown_until > now()`);
  const ag = await deps.client.query(`SELECT COUNT(*)::int c FROM nex.aof_agent WHERE status = 'active'`);
  const snap: OperationalSnapshot = {
    at: new Date().toISOString(),
    queue,
    workers_active: Number(w.rows[0].c),
    cycles_active: Number(cyc.rows[0].c),
    sources_cooled_down: Number(cd.rows[0].c),
    agents_active: Number(ag.rows[0].c),
  };
  await logAgentEvent(deps.client, {
    agent_id: deps.agent_id, event_kind: "heartbeat", cycle_id: deps.cycle_id ?? null,
    payload: { op: "operational_snapshot", snap },
  });
  return snap;
}
