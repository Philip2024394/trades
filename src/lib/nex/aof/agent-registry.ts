// src/lib/nex/aof/agent-registry.ts
//
// NEX Autonomous Operations Framework · Agent registry
// Founder-authorised programme · 2026-09-22.
//
// registerAgent · signAgent (Founder-only) · setStatus · loadAgent · listAgents
// Enforces status transition rules and the founder-signed gate.

import type { PgClient, AofAgent, AgentRole, AgentStatus } from "./types";

function rowToAgent(r: any): AofAgent {
  return {
    agent_id: r.agent_id,
    agent_name: r.agent_name,
    agent_role: r.agent_role,
    description: r.description,
    status: r.status,
    founder_signed: r.founder_signed,
    founder_signed_at: r.founder_signed_at,
    founder_signed_by: r.founder_signed_by,
    last_seen_at: r.last_seen_at,
    created_at: r.created_at,
    updated_at: r.updated_at,
    metadata: r.metadata ?? {},
  };
}

export interface RegisterAgentInput {
  readonly agent_name: string;              // unique
  readonly agent_role: AgentRole;
  readonly description?: string;
  readonly metadata?: Record<string, unknown>;
}

export async function registerAgent(client: PgClient, input: RegisterAgentInput): Promise<AofAgent> {
  const res = await client.query(
    `INSERT INTO nex.aof_agent (agent_name, agent_role, description, metadata)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (agent_name) DO UPDATE
       SET agent_role = EXCLUDED.agent_role,
           description = EXCLUDED.description,
           metadata = EXCLUDED.metadata,
           updated_at = now()
     RETURNING *`,
    [input.agent_name, input.agent_role, input.description ?? null, JSON.stringify(input.metadata ?? {})],
  );
  return rowToAgent(res.rows[0]);
}

export interface SignAgentInput {
  readonly agent_id: string;
  readonly signed_by: string;               // 'founder'
  readonly signed_at?: string;              // ISO · defaults to now
}

export async function signAgent(client: PgClient, input: SignAgentInput): Promise<AofAgent> {
  if (input.signed_by !== "founder") throw new Error("only 'founder' may sign an agent");
  const at = input.signed_at ?? new Date().toISOString();
  const res = await client.query(
    `UPDATE nex.aof_agent
        SET founder_signed = TRUE,
            founder_signed_at = $2,
            founder_signed_by = $3,
            updated_at = now()
      WHERE agent_id = $1
      RETURNING *`,
    [input.agent_id, at, input.signed_by],
  );
  if (res.rowCount === 0) throw new Error(`agent ${input.agent_id} not found`);
  return rowToAgent(res.rows[0]);
}

// Allowed status transitions
const ALLOWED_TRANSITIONS: Record<AgentStatus, ReadonlyArray<AgentStatus>> = {
  registered: ["active", "stopped", "error"],
  active:     ["paused", "stopped", "error"],
  paused:     ["active", "stopped", "error"],
  stopped:    ["registered"],                     // hard reset
  error:      ["registered", "stopped"],
};

export interface SetStatusInput {
  readonly agent_id: string;
  readonly new_status: AgentStatus;
  readonly reason?: string;
}

export async function setAgentStatus(client: PgClient, input: SetStatusInput): Promise<AofAgent> {
  const cur = await loadAgent(client, input.agent_id);
  if (!cur) throw new Error(`agent ${input.agent_id} not found`);
  const allowed = ALLOWED_TRANSITIONS[cur.status] ?? [];
  if (!allowed.includes(input.new_status)) {
    throw new Error(`illegal status transition ${cur.status} → ${input.new_status}`);
  }
  // Doctrine lock · agent cannot transition to active unless founder_signed
  if (input.new_status === "active" && !cur.founder_signed) {
    throw new Error("agent must be founder_signed before status can be 'active'");
  }
  const res = await client.query(
    `UPDATE nex.aof_agent SET status = $2, updated_at = now() WHERE agent_id = $1 RETURNING *`,
    [input.agent_id, input.new_status],
  );
  return rowToAgent(res.rows[0]);
}

export async function loadAgent(client: PgClient, agent_id: string): Promise<AofAgent | null> {
  const res = await client.query(`SELECT * FROM nex.aof_agent WHERE agent_id = $1 LIMIT 1`, [agent_id]);
  return res.rowCount === 0 ? null : rowToAgent(res.rows[0]);
}

export async function loadAgentByName(client: PgClient, agent_name: string): Promise<AofAgent | null> {
  const res = await client.query(`SELECT * FROM nex.aof_agent WHERE agent_name = $1 LIMIT 1`, [agent_name]);
  return res.rowCount === 0 ? null : rowToAgent(res.rows[0]);
}

export async function listAgents(client: PgClient, filter?: { role?: AgentRole; status?: AgentStatus }): Promise<ReadonlyArray<AofAgent>> {
  const wheres: string[] = [];
  const params: any[] = [];
  if (filter?.role) { params.push(filter.role); wheres.push(`agent_role = $${params.length}`); }
  if (filter?.status) { params.push(filter.status); wheres.push(`status = $${params.length}`); }
  const clause = wheres.length ? `WHERE ${wheres.join(" AND ")}` : "";
  const res = await client.query(`SELECT * FROM nex.aof_agent ${clause} ORDER BY agent_role, agent_name`, params);
  return res.rows.map(rowToAgent);
}

export async function touchAgentLastSeen(client: PgClient, agent_id: string): Promise<void> {
  await client.query(`UPDATE nex.aof_agent SET last_seen_at = now(), updated_at = now() WHERE agent_id = $1`, [agent_id]);
}
