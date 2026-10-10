// src/lib/nex/discovery-world/programme.ts
//
// Discovery programme registry · Asia-last as per-programme policy.
// Founder-authorised programme · bounded wave · 2026-09-21.

import type { PoolClient } from "pg";
import type { DiscoveryProgramme, Region } from "./types";

export async function upsertProgramme(
  client: PoolClient,
  input: {
    slug: string; display_name: string; topic: string;
    status?: "active" | "paused" | "archived";
    cadence_seconds?: number; policy_json?: Record<string, unknown>;
  },
): Promise<DiscoveryProgramme> {
  const status = input.status ?? "active";
  const cadence = input.cadence_seconds ?? 300;
  const policy = input.policy_json ?? {};
  const existing = await client.query(
    `SELECT programme_id FROM nex.discovery_programme WHERE slug = $1`, [input.slug],
  );
  if (existing.rows.length > 0) {
    const upd = await client.query(
      `UPDATE nex.discovery_programme SET display_name=$1, topic=$2, status=$3, cadence_seconds=$4, policy_json=$5::jsonb, updated_at=now() WHERE slug=$6 RETURNING *`,
      [input.display_name, input.topic, status, cadence, JSON.stringify(policy), input.slug],
    );
    return rowToProgramme(upd.rows[0]);
  }
  const ins = await client.query(
    `INSERT INTO nex.discovery_programme (slug, display_name, topic, status, cadence_seconds, policy_json)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb) RETURNING *`,
    [input.slug, input.display_name, input.topic, status, cadence, JSON.stringify(policy)],
  );
  return rowToProgramme(ins.rows[0]);
}

export async function listProgrammes(client: PoolClient): Promise<ReadonlyArray<DiscoveryProgramme>> {
  const res = await client.query(`SELECT * FROM nex.discovery_programme ORDER BY display_name`);
  return res.rows.map(rowToProgramme);
}

export async function loadProgrammeBySlug(client: PoolClient, slug: string): Promise<DiscoveryProgramme | null> {
  const res = await client.query(`SELECT * FROM nex.discovery_programme WHERE slug = $1`, [slug]);
  if (res.rows.length === 0) return null;
  return rowToProgramme(res.rows[0]);
}

function rowToProgramme(r: any): DiscoveryProgramme {
  return {
    programme_id: r.programme_id, slug: r.slug, display_name: r.display_name,
    topic: r.topic, status: r.status, cadence_seconds: Number(r.cadence_seconds),
    policy_json: r.policy_json ?? {},
  };
}

// ─── Programme × country scope ──────────────────────────────────────
export async function setProgrammeCountryScope(
  client: PoolClient,
  input: {
    programme_id: string;
    countries: ReadonlyArray<{ iso: string; included?: boolean; priority?: number; policy_json?: Record<string, unknown> }>;
  },
): Promise<{ upserted: number }> {
  let upserted = 0;
  for (const c of input.countries) {
    await client.query(
      `INSERT INTO nex.discovery_programme_country (programme_id, iso_alpha_2, included, priority, policy_json)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       ON CONFLICT (programme_id, iso_alpha_2) DO UPDATE SET
         included = EXCLUDED.included,
         priority = EXCLUDED.priority,
         policy_json = EXCLUDED.policy_json`,
      [input.programme_id, c.iso.toUpperCase(), c.included ?? true, c.priority ?? 100, JSON.stringify(c.policy_json ?? {})],
    );
    upserted += 1;
  }
  return { upserted };
}

/** Return the scoped country list for a programme, honouring Asia-last policy.
 *  Countries are returned in priority order · Asia rows appear at the very end
 *  when policy.asia_last === true (per Founder's scaffolding programme rule). */
export async function loadProgrammeCountries(
  client: PoolClient,
  programme_id: string,
): Promise<ReadonlyArray<{ iso: string; name: string; region: Region; priority: number; included: boolean; policy_json: Record<string, unknown> }>> {
  // Read policy for this programme
  const prog = await client.query(`SELECT policy_json FROM nex.discovery_programme WHERE programme_id = $1`, [programme_id]);
  const asia_last = !!(prog.rows[0]?.policy_json?.asia_last);

  const res = await client.query(
    `SELECT pc.iso_alpha_2, wc.name, wc.region, pc.priority, pc.included, pc.policy_json
       FROM nex.discovery_programme_country pc
       JOIN nex.world_country wc ON wc.iso_alpha_2 = pc.iso_alpha_2
      WHERE pc.programme_id = $1 AND pc.included = TRUE
      ORDER BY pc.priority, wc.name`,
    [programme_id],
  );
  const rows = res.rows.map(r => ({
    iso: r.iso_alpha_2 as string,
    name: r.name as string,
    region: r.region as Region,
    priority: Number(r.priority),
    included: r.included,
    policy_json: r.policy_json ?? {},
  }));
  if (!asia_last) return rows;
  const nonAsia = rows.filter(r => r.region !== "Asia");
  const asia = rows.filter(r => r.region === "Asia");
  return [...nonAsia, ...asia];
}
