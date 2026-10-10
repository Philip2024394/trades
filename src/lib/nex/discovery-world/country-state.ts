// src/lib/nex/discovery-world/country-state.ts
//
// Live per-country crawler state. Real activity only · no fake pulse.
// Founder-authorised programme · bounded wave · 2026-09-21.

import type { PoolClient } from "pg";
import type { CountryState, CountryStatus, WorldOverview, Region } from "./types";
import { ACTIVE_STATUSES, ACTIVITY_TTL_SECONDS } from "./types";

// ─── Claim a country for active crawling (real work only) ────────────
export async function claimCountry(
  client: PoolClient,
  input: { programme_id: string; iso: string; cycle_id: string; worker_id: string },
): Promise<{ claimed: boolean; state: CountryState | null }> {
  const expires_iso = new Date(Date.now() + ACTIVITY_TTL_SECONDS * 1000).toISOString();
  const res = await client.query(
    `INSERT INTO nex.discovery_country_state
        (programme_id, iso_alpha_2, status, current_cycle_id, claimed_at, claimed_by, activity_expires_at)
     VALUES ($1, $2, 'crawling', $3, now(), $4, $5)
     ON CONFLICT (programme_id, iso_alpha_2) DO UPDATE SET
        status = 'crawling',
        current_cycle_id = EXCLUDED.current_cycle_id,
        claimed_at = now(),
        claimed_by = EXCLUDED.claimed_by,
        activity_expires_at = EXCLUDED.activity_expires_at,
        updated_at = now()
     WHERE nex.discovery_country_state.status <> 'crawling'
        OR nex.discovery_country_state.activity_expires_at < now()
     RETURNING *`,
    [input.programme_id, input.iso.toUpperCase(), input.cycle_id, input.worker_id, expires_iso],
  );
  if (res.rowCount === 0) return { claimed: false, state: null };
  return { claimed: true, state: rowToState(res.rows[0]) };
}

// ─── Complete a country claim with real cycle outcome ────────────────
export async function completeCountryCycle(
  client: PoolClient,
  input: {
    programme_id: string;
    iso: string;
    cycle_id: string;
    status: CountryStatus;
    businesses_discovered?: number;
    new_emails?: number;
    existing_matched?: number;
    rejected?: number;
    websites_resolved?: number;
    sources_responded?: number;
    sources_unavailable?: number;
    next_scheduled_at?: string | null;
  },
): Promise<CountryState> {
  // Reset daily counters on day rollover.
  const today = new Date().toISOString().slice(0, 10);
  const res = await client.query(
    `INSERT INTO nex.discovery_country_state
        (programme_id, iso_alpha_2, status, current_cycle_id, last_cycle_id,
         claimed_at, claimed_by, activity_expires_at,
         last_completed_at, next_scheduled_at,
         businesses_discovered_today, new_emails_today, existing_matched_today,
         rejected_today, websites_resolved_today, sources_responded_today,
         sources_unavailable_today, metrics_day)
     VALUES ($1, $2, $3, NULL, $4, NULL, NULL, NULL, now(), $5,
             $6, $7, $8, $9, $10, $11, $12, $13::date)
     ON CONFLICT (programme_id, iso_alpha_2) DO UPDATE SET
        status = EXCLUDED.status,
        current_cycle_id = NULL,
        last_cycle_id = EXCLUDED.last_cycle_id,
        claimed_at = NULL,
        claimed_by = NULL,
        activity_expires_at = NULL,
        last_completed_at = now(),
        next_scheduled_at = EXCLUDED.next_scheduled_at,
        businesses_discovered_today = CASE WHEN nex.discovery_country_state.metrics_day = EXCLUDED.metrics_day
                                            THEN nex.discovery_country_state.businesses_discovered_today + EXCLUDED.businesses_discovered_today
                                            ELSE EXCLUDED.businesses_discovered_today END,
        new_emails_today = CASE WHEN nex.discovery_country_state.metrics_day = EXCLUDED.metrics_day
                                 THEN nex.discovery_country_state.new_emails_today + EXCLUDED.new_emails_today
                                 ELSE EXCLUDED.new_emails_today END,
        existing_matched_today = CASE WHEN nex.discovery_country_state.metrics_day = EXCLUDED.metrics_day
                                       THEN nex.discovery_country_state.existing_matched_today + EXCLUDED.existing_matched_today
                                       ELSE EXCLUDED.existing_matched_today END,
        rejected_today = CASE WHEN nex.discovery_country_state.metrics_day = EXCLUDED.metrics_day
                               THEN nex.discovery_country_state.rejected_today + EXCLUDED.rejected_today
                               ELSE EXCLUDED.rejected_today END,
        websites_resolved_today = CASE WHEN nex.discovery_country_state.metrics_day = EXCLUDED.metrics_day
                                        THEN nex.discovery_country_state.websites_resolved_today + EXCLUDED.websites_resolved_today
                                        ELSE EXCLUDED.websites_resolved_today END,
        sources_responded_today = CASE WHEN nex.discovery_country_state.metrics_day = EXCLUDED.metrics_day
                                        THEN nex.discovery_country_state.sources_responded_today + EXCLUDED.sources_responded_today
                                        ELSE EXCLUDED.sources_responded_today END,
        sources_unavailable_today = CASE WHEN nex.discovery_country_state.metrics_day = EXCLUDED.metrics_day
                                          THEN nex.discovery_country_state.sources_unavailable_today + EXCLUDED.sources_unavailable_today
                                          ELSE EXCLUDED.sources_unavailable_today END,
        metrics_day = EXCLUDED.metrics_day,
        updated_at = now()
     RETURNING *`,
    [
      input.programme_id, input.iso.toUpperCase(), input.status, input.cycle_id, input.next_scheduled_at ?? null,
      input.businesses_discovered ?? 0, input.new_emails ?? 0, input.existing_matched ?? 0,
      input.rejected ?? 0, input.websites_resolved ?? 0, input.sources_responded ?? 0,
      input.sources_unavailable ?? 0, today,
    ],
  );
  return rowToState(res.rows[0]);
}

// ─── Load per-country state for a programme ─────────────────────────
export async function loadCountryStates(
  client: PoolClient,
  programme_id: string,
): Promise<ReadonlyArray<CountryState>> {
  // Sweep expired claims first · never faked activity
  await client.query(
    `UPDATE nex.discovery_country_state
        SET status = 'idle', current_cycle_id = NULL, claimed_at = NULL, claimed_by = NULL, activity_expires_at = NULL, updated_at = now()
      WHERE programme_id = $1
        AND activity_expires_at IS NOT NULL
        AND activity_expires_at < now()`,
    [programme_id],
  );
  const res = await client.query(
    `SELECT * FROM nex.discovery_country_state WHERE programme_id = $1 ORDER BY iso_alpha_2`,
    [programme_id],
  );
  return res.rows.map(rowToState);
}

export async function loadCountryState(
  client: PoolClient,
  programme_id: string,
  iso: string,
): Promise<CountryState | null> {
  const res = await client.query(
    `SELECT * FROM nex.discovery_country_state WHERE programme_id = $1 AND iso_alpha_2 = $2`,
    [programme_id, iso.toUpperCase()],
  );
  if (res.rows.length === 0) return null;
  return rowToState(res.rows[0]);
}

// ─── World overview aggregate ────────────────────────────────────────
export async function loadWorldOverview(client: PoolClient): Promise<WorldOverview> {
  const wc = await client.query(`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE un_member = TRUE)::int AS un_member,
           COUNT(*) FILTER (WHERE active_in_nex = TRUE)::int AS active_in_nex
      FROM nex.world_country
  `);
  const pr = await client.query(`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status = 'active')::int AS active
      FROM nex.discovery_programme
  `);
  const perStatus = await client.query(`
    SELECT status, COUNT(*)::int AS n FROM nex.discovery_country_state GROUP BY 1
  `);
  const perRegion = await client.query(`
    SELECT wc.region,
           COUNT(DISTINCT wc.iso_alpha_2)::int AS total_countries,
           COUNT(DISTINCT cs.iso_alpha_2) FILTER (WHERE cs.status = ANY($1))::int AS active_countries,
           COALESCE(SUM(cs.businesses_discovered_today), 0)::int AS businesses_today
      FROM nex.world_country wc
      LEFT JOIN nex.discovery_country_state cs ON cs.iso_alpha_2 = wc.iso_alpha_2
      GROUP BY wc.region
      ORDER BY wc.region
  `, [ACTIVE_STATUSES]);
  const totals = await client.query(`
    SELECT COALESCE(SUM(businesses_discovered_today),0)::int AS b,
           COALESCE(SUM(new_emails_today),0)::int AS ne,
           COALESCE(SUM(existing_matched_today),0)::int AS em,
           COALESCE(SUM(rejected_today),0)::int AS r,
           COALESCE(SUM(websites_resolved_today),0)::int AS wr,
           COALESCE(SUM(sources_responded_today),0)::int AS sr,
           COALESCE(SUM(sources_unavailable_today),0)::int AS su
      FROM nex.discovery_country_state
     WHERE metrics_day = current_date
  `);

  const statusCounts: Record<string, number> = {
    idle: 0, queued: 0, crawling: 0, processing: 0, new_data: 0,
    partial: 0, zero_results: 0, source_unavailable: 0, blocked: 0, completed: 0,
  };
  for (const row of perStatus.rows) statusCounts[row.status] = row.n;

  const t = totals.rows[0];
  return {
    countries_total: wc.rows[0].total,
    countries_un_member: wc.rows[0].un_member,
    countries_active_in_nex: wc.rows[0].active_in_nex,
    programmes_active: pr.rows[0].active,
    programmes_total: pr.rows[0].total,
    per_status: statusCounts as any,
    per_region: perRegion.rows.map(r => ({
      region: r.region as Region,
      total_countries: r.total_countries,
      active_countries: r.active_countries,
      businesses_today: r.businesses_today,
    })),
    totals_today: {
      businesses_discovered: t.b, new_emails: t.ne, existing_matched: t.em, rejected: t.r,
      websites_resolved: t.wr, sources_responded: t.sr, sources_unavailable: t.su,
    },
    computed_at: new Date().toISOString(),
  };
}

// ─── Row mapping ────────────────────────────────────────────────────
function rowToState(r: any): CountryState {
  return {
    programme_id: r.programme_id, iso_alpha_2: r.iso_alpha_2, status: r.status as CountryStatus,
    current_cycle_id: r.current_cycle_id, last_cycle_id: r.last_cycle_id,
    claimed_at: r.claimed_at, claimed_by: r.claimed_by, activity_expires_at: r.activity_expires_at,
    last_completed_at: r.last_completed_at, next_scheduled_at: r.next_scheduled_at,
    businesses_discovered_today: r.businesses_discovered_today,
    new_emails_today: r.new_emails_today,
    existing_matched_today: r.existing_matched_today,
    rejected_today: r.rejected_today,
    websites_resolved_today: r.websites_resolved_today,
    sources_responded_today: r.sources_responded_today,
    sources_unavailable_today: r.sources_unavailable_today,
    metrics_day: r.metrics_day, updated_at: r.updated_at,
  };
}
