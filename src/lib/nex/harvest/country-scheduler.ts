// src/lib/nex/harvest/country-scheduler.ts
//
// NEX 24/7 World Harvest Engine · Wave H5 · Country scheduler
// Founder-authorised programme · 2026-09-22.
//
// Selects the next countries eligible for source-probe scheduling.
//
// ASIA-LAST is enforced IN THE SCHEDULER, not merely displayed.
//   The scheduler REFUSES to return any Asia country while
//   non_asia_remaining > 0. This is a runtime invariant, not a
//   UI comment. Violating it would require modifying this file.
//
// GOVERNANCE HARD-LOCKS:
//   * Asia-last: no Asia country returned while non-Asia has work
//   * Cadence-respecting: countries recently probed are not returned
//     (definition of "recent": harvest_yield.yielded_at within cadence)
//   * Reads existing tables · does NOT rebuild the country registry

import type { PoolClient } from "pg";

export interface CountryEligibility {
  readonly iso_alpha_2: string;
  readonly name: string;
  readonly region: string;
  readonly is_asia: boolean;
  readonly last_yield_at: string | null;
  readonly eligible: boolean;
  readonly reason: string;
}

export interface SelectCountriesInput {
  readonly programme_id: string;
  readonly max_countries: number;
  readonly cadence_seconds?: number;            // default 300 (5 min)
  readonly now?: () => Date;
}

export interface SelectCountriesReport {
  readonly selected: readonly CountryEligibility[];
  readonly asia_last_enforced: boolean;         // true if scheduler enforced non-Asia-first
  readonly non_asia_remaining: number;          // countries with work remaining outside Asia
  readonly asia_countries_in_scope: number;
  readonly generated_at: string;
}

const ASIA_REGION = "Asia";

export async function selectNextCountriesForScheduling(
  client: PoolClient,
  input: SelectCountriesInput,
): Promise<SelectCountriesReport> {
  const now_fn = input.now ?? (() => new Date());
  const now = now_fn();
  const cadence = input.cadence_seconds ?? 300;
  const cadence_cutoff = new Date(now.getTime() - cadence * 1000).toISOString();

  // Load programme scope with region + last-yield-per-country
  const rows = await client.query<{
    iso_alpha_2: string;
    name: string;
    region: string;
    last_yield_at: string | null;
  }>(
    `SELECT wc.iso_alpha_2,
            wc.name,
            wc.region,
            (
              SELECT MAX(hy.yielded_at)
                FROM nex.harvest_yield hy
                JOIN nex.harvest_job hj ON hj.job_id = hy.job_id
               WHERE hj.programme_id = $1
                 AND hj.country_iso = wc.iso_alpha_2
            )::text AS last_yield_at
       FROM nex.discovery_programme_country dpc
       JOIN nex.world_country wc ON wc.iso_alpha_2 = dpc.iso_alpha_2
      WHERE dpc.programme_id = $1
      ORDER BY wc.iso_alpha_2`,
    [input.programme_id],
  );

  // Classify eligibility
  const classified: CountryEligibility[] = rows.rows.map(r => {
    const is_asia = r.region === ASIA_REGION;
    let eligible = false;
    let reason = "";
    if (!r.last_yield_at) {
      eligible = true;
      reason = "never probed";
    } else if (r.last_yield_at < cadence_cutoff) {
      eligible = true;
      reason = `last probed ${r.last_yield_at} · older than cadence`;
    } else {
      eligible = false;
      reason = `recently probed ${r.last_yield_at} · within cadence`;
    }
    return {
      iso_alpha_2: r.iso_alpha_2, name: r.name, region: r.region,
      is_asia, last_yield_at: r.last_yield_at, eligible, reason,
    };
  });

  const non_asia_eligible = classified.filter(c => c.eligible && !c.is_asia);
  const asia_eligible = classified.filter(c => c.eligible && c.is_asia);
  const asia_in_scope = classified.filter(c => c.is_asia).length;
  const asia_last_enforced = non_asia_eligible.length > 0;

  // Asia-last enforcement: only return Asia when non_asia_eligible is empty
  let pool: CountryEligibility[];
  if (asia_last_enforced) {
    pool = non_asia_eligible;
  } else {
    pool = asia_eligible;
  }

  return {
    selected: pool.slice(0, input.max_countries),
    asia_last_enforced,
    non_asia_remaining: non_asia_eligible.length,
    asia_countries_in_scope: asia_in_scope,
    generated_at: now.toISOString(),
  };
}

// ─── Structural boundary markers ───────────────────────────────────
export const _SCHEDULER_ASIA_LAST_ENFORCED_AT_RUNTIME =
  "asia_countries_never_returned_while_non_asia_eligible_pool_is_non_empty_this_is_a_scheduler_invariant_not_a_UI_comment";
export const _SCHEDULER_CADENCE_RESPECTED =
  "recently_probed_countries_within_cadence_seconds_are_never_returned_even_if_no_other_work_exists";
export const _SCHEDULER_READS_EXISTING_TABLES_ONLY =
  "no_new_country_state_table_reads_discovery_programme_country_world_country_harvest_yield";
