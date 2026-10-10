// src/lib/nex/aof/lifecycle.ts
//
// NEX Autonomous Operations Framework · Lifecycle event log (append-only)
// Founder-authorised programme · 2026-09-22.

import type { PgClient, AofAgentEvent, EventKind } from "./types";

function rowToEvent(r: any): AofAgentEvent {
  return {
    event_id: Number(r.event_id),
    agent_id: r.agent_id,
    event_kind: r.event_kind,
    event_at: r.event_at,
    worker_id: r.worker_id,
    cycle_id: r.cycle_id,
    payload: r.payload ?? {},
  };
}

export interface LogEventInput {
  readonly agent_id: string;
  readonly event_kind: EventKind;
  readonly worker_id?: string | null;
  readonly cycle_id?: string | null;
  readonly payload?: Record<string, unknown>;
}

export async function logAgentEvent(client: PgClient, input: LogEventInput): Promise<AofAgentEvent> {
  const res = await client.query(
    `INSERT INTO nex.aof_agent_event (agent_id, event_kind, worker_id, cycle_id, payload)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [input.agent_id, input.event_kind, input.worker_id ?? null, input.cycle_id ?? null, JSON.stringify(input.payload ?? {})],
  );
  return rowToEvent(res.rows[0]);
}

export async function loadRecentEvents(client: PgClient, filter?: { agent_id?: string; cycle_id?: string; limit?: number }): Promise<ReadonlyArray<AofAgentEvent>> {
  const wheres: string[] = [];
  const params: any[] = [];
  if (filter?.agent_id) { params.push(filter.agent_id); wheres.push(`agent_id = $${params.length}`); }
  if (filter?.cycle_id) { params.push(filter.cycle_id); wheres.push(`cycle_id = $${params.length}`); }
  const clause = wheres.length ? `WHERE ${wheres.join(" AND ")}` : "";
  const limit = Math.max(1, Math.min(500, filter?.limit ?? 100));
  params.push(limit);
  const res = await client.query(
    `SELECT * FROM nex.aof_agent_event ${clause} ORDER BY event_at DESC LIMIT $${params.length}`,
    params,
  );
  return res.rows.map(rowToEvent);
}

export async function agentHeartbeat(client: PgClient, agent_id: string, worker_id?: string, payload?: Record<string, unknown>): Promise<void> {
  await logAgentEvent(client, { agent_id, event_kind: "heartbeat", worker_id, payload: payload ?? {} });
  await client.query(`UPDATE nex.aof_agent SET last_seen_at = now(), updated_at = now() WHERE agent_id = $1`, [agent_id]);
}
