// src/lib/nex/harvest/source-registry.ts
//
// NEX 24/7 World Harvest Engine · Wave H2 · Source Registry
// Founder-authorised programme · 2026-09-22.
//
// The registry answers: "what sources is NEX permitted to probe?"
// Every source MUST carry a founder_signed_at + founder_signed_by.
// No runtime function in this module adds a source without those.
// This is the H1→H3 seam via scheduleSourceProbes(): the registry
// PRODUCES source_probe jobs · the anti-registry-only guardrail.

import type { PoolClient } from "pg";
import { enqueueJob, type EnqueueOutcome } from "./queue";

export type SourceType =
  | "public_geographic_data"
  | "public_directory"
  | "open_index"
  | "sitemap_crawler"
  | "structured_json";

export type DiscoveryMethod =
  | "overpass_query"
  | "public_html"
  | "structured_json"
  | "sitemap";

export interface HarvestSource {
  readonly source_id: string;
  readonly source_slug: string;
  readonly source_type: SourceType;
  readonly host: string;
  readonly url_template: string | null;
  readonly discovery_method: DiscoveryMethod;
  readonly country_scope: readonly string[];      // empty = universal
  readonly category_scope: readonly string[];     // empty = universal
  readonly robots_policy_required: boolean;
  readonly rate_limit_per_minute: number;
  readonly max_bytes: number;
  readonly per_probe_timeout_ms: number;
  readonly priority: number;
  readonly enabled: boolean;
  readonly quarantined_until: string | null;
  readonly reliability_score: number;
  readonly consecutive_success: number;
  readonly consecutive_failure: number;
  readonly last_attempt_at: string | null;
  readonly last_success_at: string | null;
  readonly last_failure_at: string | null;
  readonly last_zero_result_at: string | null;
  readonly last_yield_at: string | null;
  readonly lifetime_probes: number;
  readonly lifetime_businesses: number;
  readonly lifetime_emails: number;
  readonly founder_signed_at: string;              // NOT NULL by schema
  readonly founder_signed_by: string;              // NOT NULL by schema
  readonly provenance_note: string;                // NOT NULL by schema
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly created_at: string;
  readonly updated_at: string;
}

function rowToSource(r: any): HarvestSource {
  return {
    source_id: r.source_id,
    source_slug: r.source_slug,
    source_type: r.source_type,
    host: r.host,
    url_template: r.url_template ?? null,
    discovery_method: r.discovery_method,
    country_scope: r.country_scope ?? [],
    category_scope: r.category_scope ?? [],
    robots_policy_required: r.robots_policy_required,
    rate_limit_per_minute: Number(r.rate_limit_per_minute),
    max_bytes: Number(r.max_bytes),
    per_probe_timeout_ms: Number(r.per_probe_timeout_ms),
    priority: Number(r.priority),
    enabled: r.enabled,
    quarantined_until: r.quarantined_until ?? null,
    reliability_score: Number(r.reliability_score),
    consecutive_success: Number(r.consecutive_success),
    consecutive_failure: Number(r.consecutive_failure),
    last_attempt_at: r.last_attempt_at ?? null,
    last_success_at: r.last_success_at ?? null,
    last_failure_at: r.last_failure_at ?? null,
    last_zero_result_at: r.last_zero_result_at ?? null,
    last_yield_at: r.last_yield_at ?? null,
    lifetime_probes: Number(r.lifetime_probes),
    lifetime_businesses: Number(r.lifetime_businesses),
    lifetime_emails: Number(r.lifetime_emails),
    founder_signed_at: r.founder_signed_at,
    founder_signed_by: r.founder_signed_by,
    provenance_note: r.provenance_note,
    metadata: r.metadata ?? {},
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

// ─── Read operations ────────────────────────────────────────────────
export async function listAllSources(client: PoolClient): Promise<readonly HarvestSource[]> {
  const r = await client.query<any>(`SELECT * FROM nex.harvest_source ORDER BY priority DESC, source_slug`);
  return r.rows.map(rowToSource);
}

export async function loadSourceBySlug(client: PoolClient, slug: string): Promise<HarvestSource | null> {
  const r = await client.query<any>(`SELECT * FROM nex.harvest_source WHERE source_slug = $1`, [slug]);
  return r.rowCount === 0 ? null : rowToSource(r.rows[0]);
}

export interface SourceFilter {
  readonly country_iso?: string;
  readonly category?: string;
  readonly include_disabled?: boolean;
  readonly include_quarantined?: boolean;
  readonly now?: () => Date;
}

/** Load sources matching a (country, category) scope. Empty scope arrays
 *  in a source row mean "universal" (match any country / any category). */
export async function loadSourcesForScope(client: PoolClient, filter: SourceFilter): Promise<readonly HarvestSource[]> {
  const now = (filter.now ?? (() => new Date()))().toISOString();
  const conds: string[] = [];
  const params: any[] = [];
  if (!filter.include_disabled) conds.push("enabled = TRUE");
  if (!filter.include_quarantined) {
    params.push(now);
    conds.push(`(quarantined_until IS NULL OR quarantined_until < $${params.length})`);
  }
  if (filter.country_iso) {
    params.push(filter.country_iso.toUpperCase());
    conds.push(`(country_scope = '{}' OR $${params.length} = ANY(country_scope))`);
  }
  if (filter.category) {
    params.push(filter.category);
    conds.push(`(category_scope = '{}' OR $${params.length} = ANY(category_scope))`);
  }
  const where = conds.length > 0 ? `WHERE ${conds.join(" AND ")}` : "";
  const r = await client.query<any>(
    `SELECT * FROM nex.harvest_source ${where} ORDER BY priority DESC, source_slug`,
    params,
  );
  return r.rows.map(rowToSource);
}

// ─── State transitions ─────────────────────────────────────────────
export async function disableSource(
  client: PoolClient,
  input: { source_slug: string; reason: string; founder_signed_by: string },
): Promise<HarvestSource | null> {
  const r = await client.query<any>(
    `UPDATE nex.harvest_source
        SET enabled = FALSE,
            metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
              'last_disable_reason', $2::text,
              'last_disable_by', $3::text,
              'last_disable_at', now()::text
            )
      WHERE source_slug = $1
      RETURNING *`,
    [input.source_slug, input.reason, input.founder_signed_by],
  );
  return r.rowCount === 0 ? null : rowToSource(r.rows[0]);
}

export async function enableSource(
  client: PoolClient,
  input: { source_slug: string; founder_signed_by: string },
): Promise<HarvestSource | null> {
  const r = await client.query<any>(
    `UPDATE nex.harvest_source
        SET enabled = TRUE,
            quarantined_until = NULL,
            metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
              'last_enable_by', $2::text,
              'last_enable_at', now()::text
            )
      WHERE source_slug = $1
      RETURNING *`,
    [input.source_slug, input.founder_signed_by],
  );
  return r.rowCount === 0 ? null : rowToSource(r.rows[0]);
}

export async function quarantineSource(
  client: PoolClient,
  input: { source_slug: string; until_iso: string; reason: string; founder_signed_by: string },
): Promise<HarvestSource | null> {
  const r = await client.query<any>(
    `UPDATE nex.harvest_source
        SET quarantined_until = $2::timestamptz,
            metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
              'last_quarantine_reason', $3::text,
              'last_quarantine_by', $4::text,
              'last_quarantine_at', now()::text
            )
      WHERE source_slug = $1
      RETURNING *`,
    [input.source_slug, input.until_iso, input.reason, input.founder_signed_by],
  );
  return r.rowCount === 0 ? null : rowToSource(r.rows[0]);
}

// ─── Health updates (called by executor · never fabricated) ────────
export type ProbeAttemptResult =
  | { kind: "success"; businesses: number; emails: number }
  | { kind: "zero_result" }
  | { kind: "source_unavailable" }
  | { kind: "failure"; error: string };

export async function recordProbeAttempt(
  client: PoolClient,
  input: { source_slug: string; result: ProbeAttemptResult },
): Promise<HarvestSource | null> {
  // Reliability adjusted deterministically:
  //   success       → +0.05 (capped at 1.000) · consecutive_success++ · consecutive_failure = 0
  //   zero_result   → unchanged reliability · consecutive_success++ · consecutive_failure = 0
  //   source_unavailable → -0.10 · consecutive_failure++ · consecutive_success = 0
  //   failure       → -0.15 · consecutive_failure++ · consecutive_success = 0
  const now_iso = new Date().toISOString();
  let delta = 0;
  let bump_success = 0;
  let reset_success = false;
  let bump_failure = 0;
  let reset_failure = false;
  const setters: string[] = [];
  const params: any[] = [input.source_slug];

  switch (input.result.kind) {
    case "success":
      delta = 0.05; bump_success = 1; reset_failure = true;
      params.push(input.result.businesses, input.result.emails);
      setters.push(
        "last_success_at = $" + (params.push(now_iso), params.length),
        "last_yield_at = CASE WHEN $" + (params.push(input.result.businesses > 0 || input.result.emails > 0), params.length) + " THEN $" + (params.push(now_iso), params.length) + " ELSE last_yield_at END",
        "lifetime_businesses = lifetime_businesses + $2",
        "lifetime_emails = lifetime_emails + $3",
      );
      break;
    case "zero_result":
      delta = 0; bump_success = 1; reset_failure = true;
      setters.push("last_zero_result_at = $" + (params.push(now_iso), params.length));
      break;
    case "source_unavailable":
      delta = -0.10; bump_failure = 1; reset_success = true;
      setters.push("last_failure_at = $" + (params.push(now_iso), params.length));
      break;
    case "failure":
      delta = -0.15; bump_failure = 1; reset_success = true;
      params.push(input.result.error);
      setters.push(
        "last_failure_at = $" + (params.push(now_iso), params.length),
        "metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('last_error', $" + (params.length - 1) + "::text, 'last_error_at', $" + params.length + "::text)",
      );
      break;
  }

  const success_expr = reset_success ? "0" : `consecutive_success + ${bump_success}`;
  const failure_expr = reset_failure ? "0" : `consecutive_failure + ${bump_failure}`;

  const q = `
    UPDATE nex.harvest_source
       SET reliability_score = GREATEST(0.000, LEAST(1.000, reliability_score + ${delta})),
           consecutive_success = ${success_expr},
           consecutive_failure = ${failure_expr},
           last_attempt_at = $${params.push(now_iso), params.length},
           lifetime_probes = lifetime_probes + 1
           ${setters.length > 0 ? "," + setters.join(",") : ""}
     WHERE source_slug = $1
     RETURNING *`;
  const r = await client.query<any>(q, params);
  return r.rowCount === 0 ? null : rowToSource(r.rows[0]);
}

// ─── H2 → H1 SEAM · The anti-registry-only guardrail ───────────────
/** Reads enabled sources matching a (country, category, terms) scope
 *  and enqueues one `source_probe` harvest_job per (source × term).
 *  Idempotency key ensures running the scheduler twice = same jobs. */
export interface ScheduleSourceProbesInput {
  readonly programme_id: string;
  readonly country_iso: string;
  readonly terms: readonly string[];
  readonly category?: string;
  readonly cycle_id?: string;                  // optional · for provenance
  readonly max_jobs_per_source?: number;
  readonly job_max_attempts?: number;
  readonly job_priority?: number;
  readonly now?: () => Date;
}

export interface ScheduleSourceProbesReport {
  readonly enqueued: number;
  readonly duplicates: number;
  readonly sources_considered: number;
  readonly per_source: readonly { source_slug: string; enqueued: number; duplicates: number }[];
}

export async function scheduleSourceProbes(
  client: PoolClient,
  input: ScheduleSourceProbesInput,
): Promise<ScheduleSourceProbesReport> {
  const sources = await loadSourcesForScope(client, {
    country_iso: input.country_iso,
    category: input.category,
    now: input.now,
  });
  const now_fn = input.now ?? (() => new Date());
  const now_iso = now_fn().toISOString();
  const max_per_source = input.max_jobs_per_source ?? 6;
  const per_source: { source_slug: string; enqueued: number; duplicates: number }[] = [];
  let total_enqueued = 0;
  let total_dup = 0;

  for (const source of sources) {
    let source_enq = 0;
    let source_dup = 0;
    const terms = input.terms.slice(0, max_per_source);
    for (const term of terms) {
      // Deterministic idempotency: same source × country × term × cycle produces
      // the same key. Cycle omitted → per-day bucket to avoid dogpiling on retry.
      const bucket = input.cycle_id ?? now_iso.slice(0, 10);
      const key = `probe:${source.source_slug}:${input.country_iso}:${term}:${bucket}`;
      const outcome: EnqueueOutcome = await enqueueJob(client, {
        job_type: "source_probe",
        programme_id: input.programme_id,
        country_iso: input.country_iso,
        source_id: source.source_slug,
        payload: {
          source_slug: source.source_slug,
          source_type: source.source_type,
          host: source.host,
          url_template: source.url_template,
          discovery_method: source.discovery_method,
          rate_limit_per_minute: source.rate_limit_per_minute,
          per_probe_timeout_ms: source.per_probe_timeout_ms,
          country_iso: input.country_iso,
          term,
          category: input.category ?? null,
          cycle_id: input.cycle_id ?? null,
        },
        idempotency_key: key,
        priority: input.job_priority ?? source.priority,
        max_attempts: input.job_max_attempts ?? 3,
        next_attempt_at: now_iso,
      });
      if (outcome.kind === "enqueued") { source_enq++; total_enqueued++; }
      else                              { source_dup++; total_dup++; }
    }
    per_source.push({ source_slug: source.source_slug, enqueued: source_enq, duplicates: source_dup });
  }

  return {
    enqueued: total_enqueued,
    duplicates: total_dup,
    sources_considered: sources.length,
    per_source,
  };
}

// ─── Structural boundary markers (asserted in acceptance) ──────────
export const _REGISTRY_FOUNDER_SIGNATURE_REQUIRED =
  "founder_signed_at_and_founder_signed_by_and_provenance_note_are_NOT_NULL_at_DB_level";
export const _REGISTRY_NEVER_RUNTIME_ADDS =
  "no_exported_function_inserts_a_new_source_at_runtime_migration_required";
export const _REGISTRY_FEEDS_QUEUE =
  "scheduleSourceProbes_is_the_H2_to_H1_seam_the_anti_registry_only_guardrail";
export const _REGISTRY_HEALTH_FROM_EXECUTOR_ONLY =
  "reliability_and_lifetime_counters_only_move_via_recordProbeAttempt_never_fabricated";
