// src/lib/nex/harvest/source-probe-executor.ts
//
// NEX 24/7 World Harvest Engine · Wave H3 · Source-probe executor
// Founder-authorised programme · 2026-09-22.
//
// THE AUDIT-2026-09-22 FIX. Executes a source_probe H1 job by:
//   1. Building the source-specific query from job payload
//   2. Calling the injected adapter (real Overpass or fixture)
//   3. RETAINING every returned business element as a durable
//      harvest_business_candidate row (with provenance)
//   4. For each candidate that has a website_url: enqueuing a
//      website_walk H1 job (idempotent by canonical website)
//   5. Recording yield events + updating source health
//
// GOVERNANCE HARD-LOCKS:
//   * Business elements are NEVER discarded · every element with a
//     business name becomes a candidate row
//   * website_url is NEVER fabricated · missing = NULL in DB
//   * emails are NEVER fabricated at this layer · that is H4 from
//     walked pages
//   * Source zero_results ≠ country zero · the executor reports the
//     source outcome only · country completion is a separate concern
//   * NULL adapter returns adapter_dormant · no fabricated activity

import type { PoolClient } from "pg";
import type { HarvestJob } from "./types";
import {
  buildOverpassQuery,
  extractCandidateFromElement,
  canonicaliseWebsite,
  NULL_OVERPASS_ADAPTER,
  type OverpassAdapter,
} from "./overpass-adapter";
import { insertBusinessCandidate, attachWebsiteWalkJob } from "./business-candidate";
import { recordProbeAttempt } from "./source-registry";
import { enqueueJob } from "./queue";
import { recordYield } from "./yield";

export type SourceProbeExecuteResult =
  | {
      kind: "completed";
      source_results: number;       // raw elements returned by source
      candidates_retained: number;  // rows inserted or already-existing candidates
      candidates_new: number;       // rows newly inserted this run
      websites_found: number;       // candidates with website_url
      website_walks_enqueued: number;  // new website_walk jobs created
      website_walks_duplicate: number; // idempotent hits (same website already queued)
      ms: number;
    }
  | { kind: "zero_results"; ms: number }
  | { kind: "source_unavailable"; note: string; ms: number }
  | { kind: "adapter_dormant"; note: string; ms: number }
  | { kind: "parse_error"; note: string; ms: number }
  | { kind: "rate_limited"; ms: number }
  | { kind: "invalid_payload"; reason: string };

export interface ExecuteSourceProbeInput {
  readonly client: PoolClient;
  readonly job: HarvestJob;
  readonly worker_id: string;
  readonly adapter?: OverpassAdapter;
  readonly now?: () => Date;
}

interface SourceProbePayload {
  source_slug: string;
  source_type?: string;
  host: string;
  url_template?: string | null;
  discovery_method: string;
  per_probe_timeout_ms?: number;
  country_iso: string;
  term: string;
  category?: string | null;
  cycle_id?: string | null;
}

function parsePayload(job: HarvestJob): SourceProbePayload | null {
  const p = job.payload as any;
  if (!p || typeof p !== "object") return null;
  if (typeof p.source_slug !== "string" || typeof p.host !== "string") return null;
  if (typeof p.country_iso !== "string" || typeof p.term !== "string") return null;
  if (typeof p.discovery_method !== "string") return null;
  return {
    source_slug: p.source_slug,
    source_type: p.source_type,
    host: p.host,
    url_template: p.url_template ?? null,
    discovery_method: p.discovery_method,
    per_probe_timeout_ms: p.per_probe_timeout_ms,
    country_iso: p.country_iso,
    term: p.term,
    category: p.category ?? null,
    cycle_id: p.cycle_id ?? null,
  };
}

export async function executeSourceProbe(input: ExecuteSourceProbeInput): Promise<SourceProbeExecuteResult> {
  const { client, job } = input;
  const now_fn = input.now ?? (() => new Date());
  const adapter = input.adapter ?? NULL_OVERPASS_ADAPTER;

  const payload = parsePayload(job);
  if (!payload) return { kind: "invalid_payload", reason: "source_probe payload missing required fields" };

  const t0 = now_fn().getTime();
  const query = buildOverpassQuery(payload.term, payload.country_iso);
  const probe = await adapter.probe({
    host: payload.host,
    query,
    timeout_ms: payload.per_probe_timeout_ms ?? 15_000,
  });
  const ms = now_fn().getTime() - t0;

  // Fast-path outcomes
  if (probe.kind === "adapter_dormant") {
    await recordYield(client, {
      job_id: job.job_id, worker_id: input.worker_id,
      yield_kind: "source_probe_adapter_dormant", yield_count: 0,
      yield_meta: { source_slug: payload.source_slug, country: payload.country_iso, term: payload.term, note: probe.note ?? null },
    }).catch(() => { /* soft */ });
    return { kind: "adapter_dormant", note: probe.note ?? "adapter dormant", ms };
  }
  if (probe.kind === "unavailable") {
    await recordProbeAttempt(client, {
      source_slug: payload.source_slug, result: { kind: "source_unavailable" },
    }).catch(() => { /* soft */ });
    return { kind: "source_unavailable", note: probe.note ?? "unavailable", ms };
  }
  if (probe.kind === "rate_limited") {
    await recordProbeAttempt(client, {
      source_slug: payload.source_slug, result: { kind: "failure", error: "rate_limited" },
    }).catch(() => { /* soft */ });
    return { kind: "rate_limited", ms };
  }
  if (probe.kind === "parse_error") {
    await recordProbeAttempt(client, {
      source_slug: payload.source_slug, result: { kind: "failure", error: probe.note ?? "parse_error" },
    }).catch(() => { /* soft */ });
    return { kind: "parse_error", note: probe.note ?? "parse_error", ms };
  }
  if (probe.kind === "responded_zero") {
    await recordProbeAttempt(client, {
      source_slug: payload.source_slug, result: { kind: "zero_result" },
    }).catch(() => { /* soft */ });
    await recordYield(client, {
      job_id: job.job_id, worker_id: input.worker_id,
      yield_kind: "source_probe_zero_result", yield_count: 0,
      yield_meta: { source_slug: payload.source_slug, country: payload.country_iso, term: payload.term },
    }).catch(() => { /* soft */ });
    return { kind: "zero_results", ms };
  }

  // probe.kind === "responded" — retain every element with a business name
  const provenance_url = probe.endpoint_used || `https://${payload.host}/api/interpreter`;
  let candidates_new = 0;
  let candidates_retained = 0;
  let websites_found = 0;
  let websites_enqueued = 0;
  let websites_duplicate = 0;

  for (const el of probe.elements) {
    const extracted = extractCandidateFromElement(el);
    if (!extracted) continue;  // no business name · skip (never fabricate a name)

    const outcome = await insertBusinessCandidate(client, {
      source_slug: payload.source_slug,
      source_probe_job_id: job.job_id,
      programme_id: job.programme_id ?? null,
      country_iso: payload.country_iso,
      term: payload.term,
      external_ref: extracted.external_ref,
      business_name: extracted.business_name,
      website_url: extracted.website_url,   // null preserved · never fabricated
      phone: extracted.phone,
      address: extracted.address,
      latitude: extracted.latitude,
      longitude: extracted.longitude,
      raw_tags: extracted.raw_tags as Record<string, string>,
      provenance_url,
      provenance_note: `source_probe_job=${job.job_id} · term=${payload.term}`,
    });
    candidates_retained++;
    if (outcome.kind === "inserted") candidates_new++;

    // If website present, enqueue a website_walk job (H4 will execute)
    const canonical = canonicaliseWebsite(extracted.website_url);
    if (canonical) {
      websites_found++;
      const day_bucket = new Date().toISOString().slice(0, 10);
      const walk_key = `walk:${canonical}:${day_bucket}`;
      const enqOutcome = await enqueueJob(client, {
        job_type: "website_walk",
        programme_id: job.programme_id ?? null,
        country_iso: payload.country_iso,
        source_id: payload.source_slug,
        payload: {
          candidate_id: outcome.kind === "inserted" ? outcome.candidate.candidate_id : outcome.existing.candidate_id,
          website_url: extracted.website_url,
          canonical_website: canonical,
          business_name: extracted.business_name,
          country_iso: payload.country_iso,
          discovered_from_source_slug: payload.source_slug,
          discovered_from_probe_job_id: job.job_id,
        },
        idempotency_key: walk_key,
        priority: 80,   // slightly below source_probe · walks are secondary
        max_attempts: 3,
        parent_job_id: job.job_id,
      });
      if (enqOutcome.kind === "enqueued") {
        websites_enqueued++;
        // Attach the walk job to the candidate for provenance
        await attachWebsiteWalkJob(client, {
          candidate_id: outcome.kind === "inserted" ? outcome.candidate.candidate_id : outcome.existing.candidate_id,
          website_walk_job_id: enqOutcome.job.job_id,
        }).catch(() => { /* soft */ });
      } else {
        websites_duplicate++;
      }
    }
  }

  // Record yield + source health
  await recordYield(client, {
    job_id: job.job_id, worker_id: input.worker_id,
    yield_kind: "source_probe_completed", yield_count: candidates_retained,
    yield_meta: {
      source_slug: payload.source_slug,
      country: payload.country_iso,
      term: payload.term,
      source_results: probe.elements.length,
      candidates_new,
      websites_found,
      websites_enqueued,
    },
  }).catch(() => { /* soft */ });

  await recordProbeAttempt(client, {
    source_slug: payload.source_slug,
    result: { kind: "success", businesses: candidates_new, emails: 0 },
  }).catch(() => { /* soft */ });

  return {
    kind: "completed",
    source_results: probe.elements.length,
    candidates_retained,
    candidates_new,
    websites_found,
    website_walks_enqueued: websites_enqueued,
    website_walks_duplicate: websites_duplicate,
    ms,
  };
}

// ─── Structural boundary markers ───────────────────────────────────
export const _EXECUTOR_RETAINS_EVERY_BUSINESS_ELEMENT =
  "no_discard_path_every_element_with_business_name_becomes_a_row_this_is_the_audit_2026_09_22_fix";
export const _EXECUTOR_NEVER_FABRICATES_WEBSITE =
  "website_url_stays_null_when_source_did_not_provide_one";
export const _EXECUTOR_NEVER_FABRICATES_EMAIL =
  "no_email_creation_at_this_layer_emails_only_from_H4_walked_pages";
export const _EXECUTOR_SOURCE_ZERO_NOT_COUNTRY_ZERO =
  "responded_zero_updates_source_health_never_marks_country_complete";
export const _EXECUTOR_WEBSITE_JOBS_ARE_DURABLE =
  "website_walk_jobs_go_through_enqueueJob_idempotent_by_canonical_website_and_date_bucket";
