// src/lib/nex/aof/frontier.ts
//
// NEX Discovery Frontier · governed persistent territory queue
// Founder-authorised programme · 2026-09-22.
//
// Fixes the scheduling starvation identified in `docs/nex-throughput-audit-2026-09-22.md`:
// hardcoded rotation was recycling the same 8 countries with 1 term each,
// so Nominatim returned already-persisted businesses. This module maintains
// a persistent (country × region × trade × query_term × source) frontier
// with status/attempts/productivity fields, and selects the next-best
// UNEXPLORED (or refresh-eligible) tuple every cycle.
//
// Doctrine locks preserved:
//   * never fabricate territory data · every tuple comes from Founder-signed
//     term panel + Founder-signed source list + world_country registry
//   * never bypass source policy · cooldown/rate limits enforced upstream
//   * never bypass dedup · cross-source dedup remains authoritative
//   * never invent terminology · term panel is Founder-signed JSON

import type { PgClient } from "./types";

export interface TradeTermPanelEntry {
  readonly term: string;
  readonly language: string;
  readonly countries: readonly string[];
}

export interface TradeTermPanel {
  readonly version: number;
  readonly signed_by: string;
  readonly signed_at: string;
  readonly trades: Record<string, {
    readonly trade_slug: string;
    readonly provenance: string;
    readonly term_panel: readonly TradeTermPanelEntry[];
  }>;
}

export interface FrontierItem {
  readonly territory_id: string;
  readonly programme_id: string;
  readonly country_iso: string;
  readonly region_code: string | null;
  readonly region_name: string | null;
  readonly viewbox: string | null;
  readonly trade_slug: string;
  readonly query_term: string;
  readonly query_language: string | null;
  readonly source_slug: string;
  readonly status: string;
  readonly attempts: number;
  readonly last_attempted_at: string | null;
  readonly last_productive_at: string | null;
  readonly new_candidates: number;
  readonly consecutive_zero_new: number;
}

function rowToItem(r: any): FrontierItem {
  return {
    territory_id: r.territory_id,
    programme_id: r.programme_id,
    country_iso: r.country_iso,
    region_code: r.region_code,
    region_name: r.region_name,
    viewbox: r.viewbox,
    trade_slug: r.trade_slug,
    query_term: r.query_term,
    query_language: r.query_language,
    source_slug: r.source_slug,
    status: r.status,
    attempts: Number(r.attempts),
    last_attempted_at: r.last_attempted_at,
    last_productive_at: r.last_productive_at,
    new_candidates: Number(r.new_candidates),
    consecutive_zero_new: Number(r.consecutive_zero_new),
  };
}

// ─── Seed the frontier from Founder-signed term panel × Founder-signed sources ─
export interface SeedFrontierInput {
  readonly programme_id: string;
  readonly panel: TradeTermPanel;
  readonly trade_slug: string;
  readonly source_slugs: readonly string[];       // must all be Founder-signed
  readonly regions?: ReadonlyArray<{
    country_iso: string;
    region_code: string;
    region_name: string;
    viewbox: string;                              // Nominatim '(x1,y1,x2,y2)'
  }>;
}

export async function seedFrontier(client: PgClient, input: SeedFrontierInput): Promise<{ inserted: number; existing: number }> {
  const trade = input.panel.trades[input.trade_slug];
  if (!trade) throw new Error(`trade_slug '${input.trade_slug}' not in term panel`);

  // Verify all sources are Founder-signed
  const sourceCheck = await client.query(
    `SELECT source_slug FROM nex.harvest_source
      WHERE source_slug = ANY($1::text[])
        AND founder_signed_at IS NOT NULL AND enabled = TRUE`,
    [input.source_slugs],
  );
  const validSources = new Set(sourceCheck.rows.map((r: any) => r.source_slug));
  if (validSources.size !== input.source_slugs.length) {
    const missing = input.source_slugs.filter(s => !validSources.has(s));
    throw new Error(`sources not Founder-signed or not enabled: ${missing.join(", ")}`);
  }

  let inserted = 0, existing = 0;
  const regionsByCountry = new Map<string, Array<{ region_code: string; region_name: string; viewbox: string }>>();
  for (const r of input.regions ?? []) {
    const list = regionsByCountry.get(r.country_iso) ?? [];
    list.push({ region_code: r.region_code, region_name: r.region_name, viewbox: r.viewbox });
    regionsByCountry.set(r.country_iso, list);
  }

  for (const entry of trade.term_panel) {
    for (const country of entry.countries) {
      // Only seed for countries actually in the programme scope
      const inScope = await client.query(
        `SELECT 1 FROM nex.discovery_programme_country
          WHERE programme_id = $1 AND iso_alpha_2 = $2 AND included = TRUE LIMIT 1`,
        [input.programme_id, country],
      );
      if (inScope.rowCount === 0) continue;

      for (const source of input.source_slugs) {
        // Country-level territory (no region)
        const res = await client.query(
          `INSERT INTO nex.harvest_territory_state
             (programme_id, country_iso, region_code, region_name, viewbox,
              trade_slug, query_term, query_language, source_slug, status)
           VALUES ($1, $2, NULL, NULL, NULL, $3, $4, $5, $6, 'never_attempted')
           ON CONFLICT (programme_id, country_iso, region_code, trade_slug, query_term, source_slug) DO NOTHING
           RETURNING territory_id`,
          [input.programme_id, country, input.trade_slug, entry.term, entry.language, source],
        );
        if ((res.rowCount ?? 0) > 0) inserted++; else existing++;

        // Region-level territories (if provided)
        const regions = regionsByCountry.get(country) ?? [];
        for (const region of regions) {
          const rres = await client.query(
            `INSERT INTO nex.harvest_territory_state
               (programme_id, country_iso, region_code, region_name, viewbox,
                trade_slug, query_term, query_language, source_slug, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'never_attempted')
             ON CONFLICT (programme_id, country_iso, region_code, trade_slug, query_term, source_slug) DO NOTHING
             RETURNING territory_id`,
            [input.programme_id, country, region.region_code, region.region_name, region.viewbox,
             input.trade_slug, entry.term, entry.language, source],
          );
          if ((rres.rowCount ?? 0) > 0) inserted++; else existing++;
        }
      }
    }
  }
  return { inserted, existing };
}

// ─── Pick next-best frontier item · never_attempted first · then oldest attempted ─
export interface SelectFrontierInput {
  readonly programme_id: string;
  readonly trade_slug: string;
  readonly avoid_source_slugs?: readonly string[];    // e.g. sources currently on cooldown
}

export async function selectNextFrontierItem(client: PgClient, input: SelectFrontierInput): Promise<FrontierItem | null> {
  // Ordering:
  //   1. never_attempted  (fresh territory · highest priority)
  //   2. attempted but productive · not-yet-saturated · sorted by last_attempted_at ASC (oldest revisit first)
  //   3. exhausted/saturated territories eligible for refresh (last_attempted_at older than refresh_after_seconds)
  //   4. never returns 'failing' status (respects prior failure)
  const excludeSources = (input.avoid_source_slugs ?? []).length > 0
    ? `AND source_slug <> ALL($3::text[])`
    : "";
  const params: any[] = [input.programme_id, input.trade_slug];
  if (excludeSources) params.push(input.avoid_source_slugs);

  const res = await client.query(
    `SELECT * FROM nex.harvest_territory_state
      WHERE programme_id = $1 AND trade_slug = $2
        AND status IN ('never_attempted','attempted','productive','saturated')
        AND (status <> 'saturated' OR last_attempted_at < now() - (refresh_after_seconds || ' seconds')::INTERVAL)
        ${excludeSources}
      ORDER BY
        CASE status
          WHEN 'never_attempted' THEN 0
          WHEN 'productive'      THEN 1
          WHEN 'attempted'       THEN 2
          WHEN 'saturated'       THEN 3
        END ASC,
        last_attempted_at ASC NULLS FIRST
      LIMIT 1`,
    params,
  );
  if (res.rowCount === 0) return null;
  return rowToItem(res.rows[0]);
}

// ─── Record attempt outcome ────────────────────────────────────────────────
export interface RecordAttemptInput {
  readonly territory_id: string;
  readonly candidates_returned: number;
  readonly new_candidates: number;
  readonly duplicate_candidates: number;
  readonly websites_found: number;
  readonly walks_completed: number;
  readonly emails_captured: number;
}

export async function recordFrontierAttempt(client: PgClient, input: RecordAttemptInput): Promise<FrontierItem | null> {
  // Update counters and status based on outcome
  // - if new_candidates > 0: status='productive', last_productive_at=now(), reset consecutive_zero_new
  // - if new_candidates == 0: consecutive_zero_new++, status stays or moves to 'saturated' if threshold reached
  const cur = await client.query(`SELECT * FROM nex.harvest_territory_state WHERE territory_id=$1 LIMIT 1`, [input.territory_id]);
  if (cur.rowCount === 0) return null;
  const c = cur.rows[0];

  const newAttempts = Number(c.attempts) + 1;
  const first_at = c.first_attempted_at ?? new Date().toISOString();
  const productive = input.new_candidates > 0;
  const nextConsecZero = productive ? 0 : Number(c.consecutive_zero_new) + 1;
  let nextStatus: string;
  if (productive) nextStatus = "productive";
  else if (nextConsecZero >= Number(c.saturation_threshold)) nextStatus = "saturated";
  else nextStatus = "attempted";

  const res = await client.query(
    `UPDATE nex.harvest_territory_state
        SET status = $2,
            attempts = $3,
            first_attempted_at = COALESCE(first_attempted_at, now()),
            last_attempted_at = now(),
            last_productive_at = CASE WHEN $4 THEN now() ELSE last_productive_at END,
            candidates_returned = candidates_returned + $5,
            new_candidates = new_candidates + $6,
            duplicate_candidates = duplicate_candidates + $7,
            websites_found = websites_found + $8,
            walks_completed = walks_completed + $9,
            emails_captured = emails_captured + $10,
            consecutive_zero_new = $11
      WHERE territory_id = $1
      RETURNING *`,
    [input.territory_id, nextStatus, newAttempts, productive,
     input.candidates_returned, input.new_candidates, input.duplicate_candidates,
     input.websites_found, input.walks_completed, input.emails_captured, nextConsecZero],
  );
  return rowToItem(res.rows[0]);
}

// ─── Frontier summary for reporting ────────────────────────────────────────
export interface FrontierSummary {
  readonly total: number;
  readonly by_status: Record<string, number>;
  readonly by_country: Record<string, number>;
  readonly by_source: Record<string, number>;
  readonly by_language: Record<string, number>;
  readonly total_new_candidates: number;
  readonly total_walks_completed: number;
  readonly total_emails_captured: number;
}

export async function loadFrontierSummary(client: PgClient, programme_id: string, trade_slug: string): Promise<FrontierSummary> {
  const total = await client.query(`SELECT COUNT(*)::int c FROM nex.harvest_territory_state WHERE programme_id=$1 AND trade_slug=$2`, [programme_id, trade_slug]);
  const byStatus = await client.query(`SELECT status, COUNT(*)::int c FROM nex.harvest_territory_state WHERE programme_id=$1 AND trade_slug=$2 GROUP BY status`, [programme_id, trade_slug]);
  const byCountry = await client.query(`SELECT country_iso, COUNT(*)::int c FROM nex.harvest_territory_state WHERE programme_id=$1 AND trade_slug=$2 GROUP BY country_iso ORDER BY country_iso`, [programme_id, trade_slug]);
  const bySource = await client.query(`SELECT source_slug, COUNT(*)::int c FROM nex.harvest_territory_state WHERE programme_id=$1 AND trade_slug=$2 GROUP BY source_slug`, [programme_id, trade_slug]);
  const byLang = await client.query(`SELECT query_language, COUNT(*)::int c FROM nex.harvest_territory_state WHERE programme_id=$1 AND trade_slug=$2 GROUP BY query_language`, [programme_id, trade_slug]);
  const totals = await client.query(`SELECT
    COALESCE(SUM(new_candidates),0)::int nc,
    COALESCE(SUM(walks_completed),0)::int wc,
    COALESCE(SUM(emails_captured),0)::int ec
    FROM nex.harvest_territory_state WHERE programme_id=$1 AND trade_slug=$2`, [programme_id, trade_slug]);
  const out: FrontierSummary = {
    total: Number(total.rows[0].c),
    by_status: Object.fromEntries(byStatus.rows.map((r:any) => [r.status, Number(r.c)])),
    by_country: Object.fromEntries(byCountry.rows.map((r:any) => [r.country_iso, Number(r.c)])),
    by_source: Object.fromEntries(bySource.rows.map((r:any) => [r.source_slug, Number(r.c)])),
    by_language: Object.fromEntries(byLang.rows.map((r:any) => [r.query_language ?? "unknown", Number(r.c)])),
    total_new_candidates: Number(totals.rows[0].nc),
    total_walks_completed: Number(totals.rows[0].wc),
    total_emails_captured: Number(totals.rows[0].ec),
  };
  return out;
}

// ─── Doctrine locks ────────────────────────────────────────────────────────
export const _FRONTIER_TERM_PANEL_FOUNDER_SIGNED =
  "seedFrontier_refuses_terms_not_present_in_founder_signed_panel_json";
export const _FRONTIER_SOURCES_MUST_BE_FOUNDER_SIGNED =
  "seedFrontier_verifies_every_source_slug_has_founder_signed_at_not_null";
export const _FRONTIER_NEVER_FABRICATES_TERRITORY =
  "regions_come_from_caller_supplied_reproducible_data_never_invented";
export const _FRONTIER_SATURATION_SUPPRESSES_REPETITION =
  "consecutive_zero_new_reaches_saturation_threshold_status_becomes_saturated_refresh_only_after_refresh_after_seconds";
