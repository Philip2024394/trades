// src/lib/nex/aof/capability.ts
//
// NEX Autonomous Operations Framework · Capability grants
// Founder-authorised programme · 2026-09-22.
//
// Explicit grant/revoke model. Callers assert hasCapability() before any
// governed action. Agents have no ambient authority: an ungranted call
// throws CapabilityDenied · this is a governance rule not an optimisation.

import type { PgClient, AofCapabilityGrant, Capability } from "./types";

export class CapabilityDenied extends Error {
  constructor(agent_id: string, capability: Capability) {
    super(`capability '${capability}' not granted to agent ${agent_id}`);
    this.name = "CapabilityDenied";
  }
}

function rowToGrant(r: any): AofCapabilityGrant {
  return {
    agent_id: r.agent_id,
    capability: r.capability,
    scope: r.scope ?? {},
    granted_by: r.granted_by,
    granted_at: r.granted_at,
    revoked_at: r.revoked_at,
  };
}

export interface GrantCapabilityInput {
  readonly agent_id: string;
  readonly capability: Capability;
  readonly granted_by: "founder" | "system";
  readonly scope?: Record<string, unknown>;
}

export async function grantCapability(client: PgClient, input: GrantCapabilityInput): Promise<AofCapabilityGrant> {
  const res = await client.query(
    `INSERT INTO nex.aof_agent_capability (agent_id, capability, scope, granted_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (agent_id, capability) DO UPDATE
       SET scope = EXCLUDED.scope,
           granted_by = EXCLUDED.granted_by,
           granted_at = now(),
           revoked_at = NULL
     RETURNING *`,
    [input.agent_id, input.capability, JSON.stringify(input.scope ?? {}), input.granted_by],
  );
  return rowToGrant(res.rows[0]);
}

export async function revokeCapability(client: PgClient, agent_id: string, capability: Capability): Promise<void> {
  await client.query(
    `UPDATE nex.aof_agent_capability SET revoked_at = now() WHERE agent_id = $1 AND capability = $2 AND revoked_at IS NULL`,
    [agent_id, capability],
  );
}

export async function hasCapability(client: PgClient, agent_id: string, capability: Capability): Promise<boolean> {
  const res = await client.query(
    `SELECT 1 FROM nex.aof_agent_capability WHERE agent_id = $1 AND capability = $2 AND revoked_at IS NULL LIMIT 1`,
    [agent_id, capability],
  );
  return (res.rowCount ?? 0) > 0;
}

export async function requireCapability(client: PgClient, agent_id: string, capability: Capability): Promise<void> {
  if (!(await hasCapability(client, agent_id, capability))) {
    throw new CapabilityDenied(agent_id, capability);
  }
}

export async function listCapabilities(client: PgClient, agent_id: string): Promise<ReadonlyArray<AofCapabilityGrant>> {
  const res = await client.query(
    `SELECT * FROM nex.aof_agent_capability WHERE agent_id = $1 AND revoked_at IS NULL ORDER BY capability`,
    [agent_id],
  );
  return res.rows.map(rowToGrant);
}
