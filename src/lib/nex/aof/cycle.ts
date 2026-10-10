// src/lib/nex/aof/cycle.ts
//
// NEX Autonomous Operations Framework · Cycle correlation anchor
// Founder-authorised programme · 2026-09-22.
//
// A cycle is one orbit of the OrbitingAgent through Founder-authorised
// territories. Every cycle rows carries what was attempted, what succeeded,
// what cooled down, and the aggregate real-world results (candidates,
// walks, evidence, emails). Cycles are joined by cycle_id to
// aof_agent_event rows so the full timeline is reconstructible.

import type { PgClient, AofCycle } from "./types";

function rowToCycle(r: any): AofCycle {
  return {
    cycle_id: r.cycle_id,
    cycle_seq: Number(r.cycle_seq),
    started_at: r.started_at,
    ended_at: r.ended_at,
    ended_kind: r.ended_kind,
    triggered_by: r.triggered_by,
    programme_id: r.programme_id,
    countries_touched: r.countries_touched ?? [],
    sources_attempted: r.sources_attempted ?? [],
    sources_succeeded: r.sources_succeeded ?? [],
    sources_cooled_down: r.sources_cooled_down ?? [],
    candidates_added: Number(r.candidates_added),
    walks_completed: Number(r.walks_completed),
    evidence_added: Number(r.evidence_added),
    emails_captured: Number(r.emails_captured),
    metadata: r.metadata ?? {},
  };
}

export interface StartCycleInput {
  readonly triggered_by: string;
  readonly programme_id?: string | null;
  readonly metadata?: Record<string, unknown>;
}

export async function startCycle(client: PgClient, input: StartCycleInput): Promise<AofCycle> {
  const seqRes = await client.query(`SELECT nextval('nex.aof_cycle_seq_seq') AS n`);
  const seq = Number(seqRes.rows[0].n);
  const res = await client.query(
    `INSERT INTO nex.aof_cycle (cycle_seq, triggered_by, programme_id, metadata)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [seq, input.triggered_by, input.programme_id ?? null, JSON.stringify(input.metadata ?? {})],
  );
  return rowToCycle(res.rows[0]);
}

export interface UpdateCycleCountersInput {
  readonly cycle_id: string;
  readonly countries_touched?: readonly string[];
  readonly sources_attempted?: readonly string[];
  readonly sources_succeeded?: readonly string[];
  readonly sources_cooled_down?: readonly string[];
  readonly candidates_added_delta?: number;
  readonly walks_completed_delta?: number;
  readonly evidence_added_delta?: number;
  readonly emails_captured_delta?: number;
}

export async function updateCycleCounters(client: PgClient, input: UpdateCycleCountersInput): Promise<AofCycle | null> {
  const sets: string[] = [];
  const params: any[] = [input.cycle_id];
  const addArr = (col: string, arr: readonly string[] | undefined) => {
    if (!arr || arr.length === 0) return;
    params.push(arr);
    sets.push(`${col} = (SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(${col}, ARRAY[]::text[]) || $${params.length})))`);
  };
  addArr("countries_touched", input.countries_touched);
  addArr("sources_attempted", input.sources_attempted);
  addArr("sources_succeeded", input.sources_succeeded);
  addArr("sources_cooled_down", input.sources_cooled_down);
  const addNum = (col: string, delta: number | undefined) => {
    if (typeof delta !== "number" || delta === 0) return;
    params.push(delta);
    sets.push(`${col} = ${col} + $${params.length}`);
  };
  addNum("candidates_added", input.candidates_added_delta);
  addNum("walks_completed", input.walks_completed_delta);
  addNum("evidence_added", input.evidence_added_delta);
  addNum("emails_captured", input.emails_captured_delta);
  if (sets.length === 0) return loadCycle(client, input.cycle_id);
  const res = await client.query(
    `UPDATE nex.aof_cycle SET ${sets.join(", ")} WHERE cycle_id = $1 RETURNING *`,
    params,
  );
  return res.rowCount === 0 ? null : rowToCycle(res.rows[0]);
}

export interface EndCycleInput {
  readonly cycle_id: string;
  readonly ended_kind: "completed" | "aborted" | "interrupted";
  readonly metadata_merge?: Record<string, unknown>;
}

export async function endCycle(client: PgClient, input: EndCycleInput): Promise<AofCycle | null> {
  const res = await client.query(
    `UPDATE nex.aof_cycle
        SET ended_at = now(), ended_kind = $2,
            metadata = metadata || $3::jsonb
      WHERE cycle_id = $1 RETURNING *`,
    [input.cycle_id, input.ended_kind, JSON.stringify(input.metadata_merge ?? {})],
  );
  return res.rowCount === 0 ? null : rowToCycle(res.rows[0]);
}

export async function loadCycle(client: PgClient, cycle_id: string): Promise<AofCycle | null> {
  const res = await client.query(`SELECT * FROM nex.aof_cycle WHERE cycle_id = $1 LIMIT 1`, [cycle_id]);
  return res.rowCount === 0 ? null : rowToCycle(res.rows[0]);
}

export async function loadRecentCycles(client: PgClient, limit: number = 20): Promise<ReadonlyArray<AofCycle>> {
  const res = await client.query(`SELECT * FROM nex.aof_cycle ORDER BY started_at DESC LIMIT $1`, [Math.max(1, Math.min(200, limit))]);
  return res.rows.map(rowToCycle);
}
