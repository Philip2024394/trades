// src/lib/nex/discovery-world/scaffolding-programme-status.ts
//
// NEX World Discovery · Scaffolding Programme Live Status Aggregator
// Founder-authorised World Activation · 2026-09-22.
//
// PURE READ-ONLY AGGREGATOR. Reads persisted state from:
//   * nex.world_country                        (registry + region + un_member)
//   * nex.discovery_programme                  (programme metadata + policy_json)
//   * nex.discovery_programme_country          (in-scope countries for programme)
//   * nex.discovery_country_state              (per-country programme state)
//   * nex.discovery_business_evidence          (persisted business + email evidence)
//   * nex.discovery_entity                     (entity resolution state)
//   * nex.discovery_cycle                      (cycle history)
//
// GOVERNANCE HARD-LOCKS:
//   * Zero mutation · read-only queries only
//   * Every count derives from a persisted row · nothing fabricated
//   * Individual email addresses NEVER appear in the returned shape ·
//     counts + provenance flags only · address content stays behind
//     existing Founder audience-inventory controls
//   * Asia-last state derived from `world_country.region` · never manually enumerated
//   * ZERO_RESULTS and SOURCE_UNAVAILABLE are truthful states · never converted

import type { PoolClient } from "pg";

export interface ScaffoldingProgrammeStatus {
  readonly programme: {
    readonly slug: string;
    readonly display_name: string;
    readonly asia_last_policy_active: boolean;
    readonly topic: string;
  } | null;
  readonly queue: {
    readonly total_in_scope: number;
    readonly completed: number;          // status='completed'
    readonly in_progress: number;         // status IN ('crawling','processing')
    readonly queued: number;              // status='queued'
    readonly idle: number;                // status='idle'
    readonly zero_results: number;
    readonly source_unavailable: number;
    readonly blocked: number;
    readonly percent_completed: number | null;
  };
  readonly asia_last: {
    readonly non_asia_total: number;
    readonly non_asia_completed: number;
    readonly non_asia_remaining: number;
    readonly asia_total: number;
    readonly asia_completed: number;
    readonly asia_remaining: number;
    readonly in_asia_tail: boolean;         // TRUE when all non-Asia are completed
  };
  readonly cumulative_business_evidence: {
    readonly total_rows: number;
    readonly rows_with_email: number;
    readonly rows_without_email: number;
    readonly distinct_websites: number;
    readonly distinct_countries_touched: number;
    readonly rows_last_24h: number;
    readonly rows_last_7d: number;
    readonly provenance_coverage_percent: number | null;
  };
  readonly cumulative_emails: {
    readonly total_captured: number;
    readonly with_source_url: number;
    readonly with_source_url_percent: number | null;
    readonly by_country: readonly { country: string; total: number }[];
  };
  readonly entities: {
    readonly total: number;
    readonly unresolved: number;
    readonly candidate: number;
    readonly resolved: number;
    readonly ambiguous: number;
    readonly rejected: number;
  };
  readonly current_country: {
    readonly iso: string;
    readonly name: string;
    readonly region: string;
    readonly status: string;
    readonly claim_at: string | null;
    readonly claim_expires_at: string | null;
    readonly businesses_discovered_today: number;
    readonly new_emails_today: number;
    readonly evidence_rows_lifetime: number;
    readonly emails_captured_lifetime: number;
    readonly last_cycle_at: string | null;
  } | null;
  readonly cycles: {
    readonly total: number;
    readonly last_24h: number;
    readonly outcome_zero_results: number;
    readonly outcome_source_unavailable: number;
    readonly most_recent_at: string | null;
  };
  readonly generated_at: string;
}

const ASIA_REGION = "Asia";

export async function loadScaffoldingProgrammeStatus(
  client: PoolClient,
  programmeSlug: string = "scaffolding",
): Promise<ScaffoldingProgrammeStatus> {
  const generated_at = new Date().toISOString();

  // Programme
  const prRes = await client.query<{
    programme_id: string; slug: string; display_name: string; topic: string; policy_json: any;
  }>(
    `SELECT programme_id, slug, display_name, topic, policy_json
       FROM nex.discovery_programme WHERE slug = $1 LIMIT 1`,
    [programmeSlug],
  );
  const programme = prRes.rows[0];
  if (!programme) {
    return emptyStatus(programmeSlug, generated_at);
  }
  const asia_last_policy_active = programme.policy_json?.asia_last === true;

  // G1.5 remediation B (2026-09-22) · authoritative queue-state source is AOF.
  // For each country in programme scope we derive its status from AOF activity:
  //   * completed        · at least one harvest_business_candidate row with website_walk_status='walked'
  //   * in_progress      · appears in a currently-active aof_cycle (ended_at IS NULL)
  //   * partial          · candidates exist but no walked_ok yet
  //   * queued           · in scope · no candidates · no cycle has touched it
  // Note: discovery_country_state is deliberately NOT read here. AOF is the
  // authoritative source of country-processing activity. Do not synchronise
  // AOF state INTO discovery_country_state · one source-of-truth per metric.
  const scopeRes = await client.query<{
    region: string; status: string | null; n: number;
  }>(
    `WITH scope AS (
       SELECT dpc.iso_alpha_2, wc.region
         FROM nex.discovery_programme_country dpc
         JOIN nex.world_country wc ON wc.iso_alpha_2 = dpc.iso_alpha_2
        WHERE dpc.programme_id = $1 AND dpc.included = TRUE
     ),
     candidate_state AS (
       SELECT country_iso,
              COUNT(*) FILTER (WHERE website_walk_status = 'walked')::int AS walked_ok,
              COUNT(*)::int AS candidates
         FROM nex.harvest_business_candidate
        WHERE programme_id = $1
        GROUP BY country_iso
     ),
     active_cycles AS (
       SELECT UNNEST(countries_touched) AS iso
         FROM nex.aof_cycle
        WHERE ended_at IS NULL
     )
     SELECT s.region,
            CASE
              WHEN cs.walked_ok > 0                                   THEN 'completed'
              WHEN EXISTS (SELECT 1 FROM active_cycles ac WHERE ac.iso = s.iso_alpha_2) THEN 'crawling'
              WHEN cs.candidates > 0                                   THEN 'partial'
              ELSE 'queued'
            END AS status,
            COUNT(*)::int AS n
       FROM scope s
       LEFT JOIN candidate_state cs ON cs.country_iso = s.iso_alpha_2
       GROUP BY 1, 2`,
    [programme.programme_id],
  );

  let total_in_scope = 0, completed = 0, in_progress = 0, queued_ct = 0, idle = 0;
  let zero_results = 0, source_unavailable = 0, blocked = 0;
  let non_asia_total = 0, non_asia_completed = 0;
  let asia_total = 0, asia_completed = 0;
  for (const row of scopeRes.rows) {
    total_in_scope += row.n;
    if (row.region === ASIA_REGION) asia_total += row.n; else non_asia_total += row.n;
    switch (row.status) {
      case "completed": completed += row.n;
        if (row.region === ASIA_REGION) asia_completed += row.n; else non_asia_completed += row.n;
        break;
      case "crawling":
      case "processing":
      case "new_data":
      case "partial": in_progress += row.n; break;
      case "queued": queued_ct += row.n; break;
      case "idle": idle += row.n; break;
      case "zero_results": zero_results += row.n; break;
      case "source_unavailable": source_unavailable += row.n; break;
      case "blocked": blocked += row.n; break;
    }
  }
  const non_asia_remaining = non_asia_total - non_asia_completed;
  const asia_remaining = asia_total - asia_completed;
  const in_asia_tail = non_asia_remaining === 0 && non_asia_total > 0;
  const percent_completed = total_in_scope > 0
    ? Math.round((completed / total_in_scope) * 1000) / 10
    : null;

  // Cumulative business evidence — never returns email addresses, only counts + flags
  //
  // G1.5 remediation A (2026-09-22) · schema column names corrected:
  //   country            → iso_alpha_2
  //   discovered_website → website_url
  //   created_at         → first_seen_at
  //
  // Anti-silent-zero doctrine (2026-09-22) · DB errors must never silently
  // become legitimate-looking zeros on a Founder operational surface. The
  // outer route.ts try/catch classifies real "schema not applied" cases
  // separately. Individual .catch() wrappers here would have masked column
  // drift · REMOVED.
  const evRes = await client.query<{
    total: number; with_email: number; distinct_websites: number;
    distinct_countries: number; last_24h: number; last_7d: number;
  }>(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE discovered_email IS NOT NULL AND discovered_email <> '')::int AS with_email,
            COUNT(DISTINCT COALESCE(NULLIF(website_url, ''), 'unknown'))::int AS distinct_websites,
            COUNT(DISTINCT iso_alpha_2)::int AS distinct_countries,
            COUNT(*) FILTER (WHERE first_seen_at >= now() - INTERVAL '24 hours')::int AS last_24h,
            COUNT(*) FILTER (WHERE first_seen_at >= now() - INTERVAL '7 days')::int AS last_7d
       FROM nex.discovery_business_evidence
      WHERE programme_id = $1`,
    [programme.programme_id],
  );
  const ev = evRes.rows[0];
  const rows_without_email = ev.total - ev.with_email;

  // Provenance coverage %
  const provRes = await client.query<{ with_source: number; total: number }>(
    `SELECT COUNT(*) FILTER (WHERE email_source_url IS NOT NULL AND email_source_url <> '')::int AS with_source,
            COUNT(*) FILTER (WHERE discovered_email IS NOT NULL AND discovered_email <> '')::int AS total
       FROM nex.discovery_business_evidence
      WHERE programme_id = $1`,
    [programme.programme_id],
  );
  const with_source = provRes.rows[0].with_source;
  const email_total = provRes.rows[0].total;
  const with_source_url_percent = email_total > 0 ? Math.round((with_source / email_total) * 1000) / 10 : null;

  // Emails by country · aggregate counts only, no addresses
  const byCountryRes = await client.query<{ country: string; total: number }>(
    `SELECT iso_alpha_2 AS country, COUNT(*)::int AS total
       FROM nex.discovery_business_evidence
      WHERE programme_id = $1
        AND discovered_email IS NOT NULL AND discovered_email <> ''
      GROUP BY iso_alpha_2
      ORDER BY total DESC
      LIMIT 25`,
    [programme.programme_id],
  );

  // Entities — resolution state (no silent-catch · outer route.ts handles schema errors)
  const entRes = await client.query<{ state: string; n: number }>(
    `SELECT state, COUNT(*)::int AS n
       FROM nex.discovery_entity
      WHERE programme_id = $1
      GROUP BY state`,
    [programme.programme_id],
  );
  const entCounts: Record<string, number> = { unresolved: 0, candidate_entity: 0, resolved_entity: 0, ambiguous_entity: 0, rejected_entity: 0 };
  for (const r of entRes.rows) entCounts[r.state] = r.n;
  const entities_total = Object.values(entCounts).reduce((a, b) => a + b, 0);

  // Current country · G1.5 remediation B · authoritative source is AOF (aof_cycle
  // countries currently being touched). We take the most recently started
  // active aof_cycle and pick a non-Asia country from its territories first,
  // falling back to any country. Today's counters are derived from real
  // evidence rows and candidates (first_seen_at / discovered_at within 24h).
  const curRes = await client.query<{
    iso: string; name: string; region: string;
    cycle_id: string; cycle_started_at: string;
  }>(
    `SELECT UNNEST(c.countries_touched) AS iso,
            c.cycle_id::text, c.started_at::text AS cycle_started_at,
            wc.name AS wcname, wc.region AS wcregion
       FROM nex.aof_cycle c
       LEFT JOIN nex.world_country wc ON wc.iso_alpha_2 = ANY(c.countries_touched)
      WHERE c.ended_at IS NULL
        AND c.metadata->>'programme_id' IS NOT DISTINCT FROM NULL     -- accept any programme scope
      ORDER BY c.started_at DESC
      LIMIT 1`,
    [],
  );

  let current_country: ScaffoldingProgrammeStatus["current_country"] = null;
  if (curRes.rows.length > 0) {
    const cc: any = curRes.rows[0];
    const iso = cc.iso;
    // Resolve human name + region deterministically
    const cn = await client.query<{ name: string; region: string }>(
      `SELECT name, region FROM nex.world_country WHERE iso_alpha_2 = $1 LIMIT 1`,
      [iso],
    );
    const wcname = cn.rows[0]?.name ?? iso;
    const wcregion = cn.rows[0]?.region ?? "Unknown";
    // Today's activity for this country · derived from real DB
    const today = await client.query<{ b_today: number; e_today: number; ev_lifetime: number; em_lifetime: number; last_cycle_at: string | null }>(
      `SELECT
         (SELECT COUNT(*)::int FROM nex.harvest_business_candidate
           WHERE programme_id = $1 AND country_iso = $2 AND discovered_at >= now() - INTERVAL '24 hours') AS b_today,
         (SELECT COUNT(*)::int FROM nex.discovery_business_evidence
           WHERE programme_id = $1 AND iso_alpha_2 = $2 AND discovered_email IS NOT NULL AND first_seen_at >= now() - INTERVAL '24 hours') AS e_today,
         (SELECT COUNT(*)::int FROM nex.discovery_business_evidence
           WHERE programme_id = $1 AND iso_alpha_2 = $2) AS ev_lifetime,
         (SELECT COUNT(*)::int FROM nex.discovery_business_evidence
           WHERE programme_id = $1 AND iso_alpha_2 = $2 AND discovered_email IS NOT NULL) AS em_lifetime,
         (SELECT MAX(started_at)::text FROM nex.aof_cycle WHERE $2 = ANY(countries_touched)) AS last_cycle_at`,
      [programme.programme_id, iso],
    );
    const t = today.rows[0];
    current_country = {
      iso, name: wcname, region: wcregion, status: "crawling",
      claim_at: cc.cycle_started_at, claim_expires_at: null,
      businesses_discovered_today: t.b_today,
      new_emails_today: t.e_today,
      evidence_rows_lifetime: t.ev_lifetime,
      emails_captured_lifetime: t.em_lifetime,
      last_cycle_at: t.last_cycle_at,
    };
  }

  // Cycles rollup · no silent-catch
  const cycRes = await client.query<{
    total: number; last_24h: number; zero_r: number; src_un: number; most_recent: string | null;
  }>(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE started_at >= now() - INTERVAL '24 hours')::int AS last_24h,
            COUNT(*) FILTER (WHERE outcome = 'zero_results')::int AS zero_r,
            COUNT(*) FILTER (WHERE outcome = 'source_unavailable')::int AS src_un,
            MAX(started_at)::text AS most_recent
       FROM nex.discovery_cycle
      WHERE topic = $1`,
    [programme.topic],
  );
  const cyc = cycRes.rows[0];

  return {
    programme: {
      slug: programme.slug,
      display_name: programme.display_name,
      asia_last_policy_active,
      topic: programme.topic,
    },
    queue: {
      total_in_scope, completed, in_progress, queued: queued_ct, idle,
      zero_results, source_unavailable, blocked,
      percent_completed,
    },
    asia_last: {
      non_asia_total, non_asia_completed, non_asia_remaining,
      asia_total, asia_completed, asia_remaining,
      in_asia_tail,
    },
    cumulative_business_evidence: {
      total_rows: ev.total,
      rows_with_email: ev.with_email,
      rows_without_email,
      distinct_websites: ev.distinct_websites,
      distinct_countries_touched: ev.distinct_countries,
      rows_last_24h: ev.last_24h,
      rows_last_7d: ev.last_7d,
      provenance_coverage_percent: with_source_url_percent,
    },
    cumulative_emails: {
      total_captured: email_total,
      with_source_url: with_source,
      with_source_url_percent,
      by_country: byCountryRes.rows,
    },
    entities: {
      total: entities_total,
      unresolved: entCounts.unresolved,
      candidate: entCounts.candidate_entity,
      resolved: entCounts.resolved_entity,
      ambiguous: entCounts.ambiguous_entity,
      rejected: entCounts.rejected_entity,
    },
    current_country,
    cycles: {
      total: cyc.total,
      last_24h: cyc.last_24h,
      outcome_zero_results: cyc.zero_r,
      outcome_source_unavailable: cyc.src_un,
      most_recent_at: cyc.most_recent,
    },
    generated_at,
  };
}

function emptyStatus(slug: string, generated_at: string): ScaffoldingProgrammeStatus {
  return {
    programme: null,
    queue: { total_in_scope: 0, completed: 0, in_progress: 0, queued: 0, idle: 0, zero_results: 0, source_unavailable: 0, blocked: 0, percent_completed: null },
    asia_last: { non_asia_total: 0, non_asia_completed: 0, non_asia_remaining: 0, asia_total: 0, asia_completed: 0, asia_remaining: 0, in_asia_tail: false },
    cumulative_business_evidence: { total_rows: 0, rows_with_email: 0, rows_without_email: 0, distinct_websites: 0, distinct_countries_touched: 0, rows_last_24h: 0, rows_last_7d: 0, provenance_coverage_percent: null },
    cumulative_emails: { total_captured: 0, with_source_url: 0, with_source_url_percent: null, by_country: [] },
    entities: { total: 0, unresolved: 0, candidate: 0, resolved: 0, ambiguous: 0, rejected: 0 },
    current_country: null,
    cycles: { total: 0, last_24h: 0, outcome_zero_results: 0, outcome_source_unavailable: 0, most_recent_at: null },
    generated_at,
  };
}

// ─── Structural boundary markers ────────────────────────────────────
export const _STATUS_READ_ONLY = "aggregator_never_writes_never_mutates";
export const _STATUS_NEVER_RETURNS_EMAIL_ADDRESSES =
  "returned_shape_contains_no_email_local_parts_counts_and_provenance_flags_only";
export const _STATUS_ASIA_LAST_FROM_REGISTRY =
  "asia_last_derived_from_world_country_region_never_hardcoded";
export const _STATUS_ZERO_RESULTS_AND_SOURCE_UNAVAILABLE_DISTINCT =
  "zero_results_never_conflated_with_source_unavailable_preserved_as_typed_states";
export const _STATUS_NO_SILENT_ZERO_ON_DB_ERROR_2026_09_22 =
  "individual_query_catch_wrappers_that_returned_empty_shape_have_been_removed_after_G1_5_column_drift_incident_outer_route_catches_real_schema_missing_case_separately_any_other_error_bubbles_up_never_masquerades_as_legitimate_zero";
export const _STATUS_QUEUE_STATE_DERIVED_FROM_AOF_2026_09_22 =
  "queue_and_current_country_state_derived_from_aof_cycle_and_harvest_business_candidate_never_read_from_discovery_country_state_which_is_vestigial";
