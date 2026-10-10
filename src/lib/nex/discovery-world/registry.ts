// src/lib/nex/discovery-world/registry.ts
//
// Canonical country registry loader + seeder.
// Founder-authorised programme · bounded wave · 2026-09-21.

import type { PoolClient } from "pg";
import { ISO_3166_1, type Iso3166Country } from "./iso-3166-1";
import type { WorldCountry, Region } from "./types";

/** Idempotent seed of nex.world_country from the deterministic ISO 3166-1 constant.
 *  Never overwrites an existing row's Founder-set active_in_nex toggle. */
export async function seedWorldCountryRegistry(
  client: PoolClient,
  source: ReadonlyArray<Iso3166Country> = ISO_3166_1,
): Promise<{ inserted: number; already_present: number }> {
  let inserted = 0, already_present = 0;
  for (const c of source) {
    const ex = await client.query(
      `SELECT iso_alpha_2 FROM nex.world_country WHERE iso_alpha_2 = $1`,
      [c.iso_alpha_2],
    );
    if (ex.rows.length > 0) { already_present += 1; continue; }
    await client.query(
      `INSERT INTO nex.world_country
         (iso_alpha_2, iso_alpha_3, numeric_code, name, region, subregion,
          un_member, sovereign, active_in_nex)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)`,
      [c.iso_alpha_2, c.iso_alpha_3, c.numeric_code, c.name, c.region, c.subregion, c.un_member, c.sovereign],
    );
    inserted += 1;
  }
  return { inserted, already_present };
}

export async function loadWorldCountries(client: PoolClient, opts: { region?: Region; un_only?: boolean; active_only?: boolean } = {}): Promise<ReadonlyArray<WorldCountry>> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.region) { params.push(opts.region); where.push(`region = $${params.length}`); }
  if (opts.un_only) { where.push(`un_member = TRUE`); }
  if (opts.active_only) { where.push(`active_in_nex = TRUE`); }
  const res = await client.query(
    `SELECT iso_alpha_2, iso_alpha_3, numeric_code, name, region, subregion,
            un_member, sovereign, active_in_nex
       FROM nex.world_country
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY region, subregion, name`,
    params,
  );
  return res.rows.map(r => ({
    iso_alpha_2: r.iso_alpha_2, iso_alpha_3: r.iso_alpha_3, numeric_code: r.numeric_code,
    name: r.name, region: r.region as Region, subregion: r.subregion,
    un_member: r.un_member, sovereign: r.sovereign, active_in_nex: r.active_in_nex,
  }));
}

export async function loadCountryByIso(client: PoolClient, iso: string): Promise<WorldCountry | null> {
  const res = await client.query(
    `SELECT iso_alpha_2, iso_alpha_3, numeric_code, name, region, subregion,
            un_member, sovereign, active_in_nex
       FROM nex.world_country WHERE iso_alpha_2 = $1`,
    [iso.toUpperCase()],
  );
  if (res.rows.length === 0) return null;
  const r = res.rows[0];
  return {
    iso_alpha_2: r.iso_alpha_2, iso_alpha_3: r.iso_alpha_3, numeric_code: r.numeric_code,
    name: r.name, region: r.region as Region, subregion: r.subregion,
    un_member: r.un_member, sovereign: r.sovereign, active_in_nex: r.active_in_nex,
  };
}
