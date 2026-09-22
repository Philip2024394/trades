// src/lib/nex/harvest/website-walk-executor.ts
//
// NEX 24/7 World Harvest Engine · Wave H4 · Website-walk executor
// Founder-authorised programme · 2026-09-22.
//
// Consumes a `website_walk` H1 job and wires the existing (Session-2 ·
// thoroughly tested but 0 runtime callers) walker/extractor/entity/evidence
// chain into a real runtime executor.
//
// This is the wave that turns NEX from a business-discovery engine into
// an email-harvesting engine.
//
// GOVERNANCE HARD-LOCKS:
//   * PUBLICLY FOUND EMAIL ≠ GENERATED EMAIL
//     - Never construct info@domain
//     - Never derive email from business name
//     - Never MX-invent an address
//     - Emails only from the existing 6-method extractor on real pages
//   * Fetcher governance is the fetcher's concern · NULL_FETCHER refuses every URL
//   * Preserve distinct counters: pages_fetched / emails_found / evidence_written
//   * Session-2's processEntityCandidate is authoritative · this executor
//     wires it into the H1 queue and post-processes only

import type { PoolClient } from "pg";
import type { HarvestJob } from "./types";
import {
  processEntityCandidate,
  NULL_FETCHER,
  type PageFetcher,
  type EntityCandidate,
  type AdaptedResult,
  type AdapterConfig,
} from "@/lib/nex/discovery-world";
import { recordYield } from "./yield";

// Type of the underlying walker function (Session-2 · already tested)
export type WalkerFn = (
  client: PoolClient,
  candidate: EntityCandidate,
  config: AdapterConfig,
) => Promise<AdaptedResult>;

export type WebsiteWalkExecuteResult =
  | {
      kind: "walked";
      pages_fetched: number;
      pages_blocked_by_governance: number;
      pages_robots_denied: number;
      pages_not_found: number;
      pages_unavailable: number;
      emails_captured: number;
      entity_id: string | null;
      evidence_ids: readonly string[];
      website_walk_status: "walked" | "walked_zero_pages";
      ms: number;
    }
  | { kind: "blocked_by_governance"; reason: string; ms: number }
  | { kind: "robots_denied"; ms: number }
  | { kind: "not_applicable_no_website"; ms: number }
  | { kind: "fetcher_dormant"; ms: number }
  | { kind: "unavailable"; note: string; ms: number }
  | { kind: "invalid_payload"; reason: string }
  | { kind: "candidate_not_found"; candidate_id: string };

export interface ExecuteWebsiteWalkInput {
  readonly client: PoolClient;
  readonly job: HarvestJob;
  readonly worker_id: string;
  /** Injectable · defaults to processEntityCandidate (Session-2 tested chain). */
  readonly walker?: WalkerFn;
  /** Injectable · defaults to NULL_FETCHER (refuses every URL by design). */
  readonly fetcher?: PageFetcher;
  readonly now?: () => Date;
  readonly max_emails_per_entity?: number;
}

interface WebsiteWalkPayload {
  candidate_id: string;
  website_url: string | null;
  canonical_website?: string | null;
  business_name: string;
  country_iso: string;
  discovered_from_source_slug: string;
  discovered_from_probe_job_id: string;
}

function parsePayload(job: HarvestJob): WebsiteWalkPayload | null {
  const p = job.payload as any;
  if (!p || typeof p !== "object") return null;
  if (typeof p.candidate_id !== "string") return null;
  if (typeof p.business_name !== "string" || p.business_name.length === 0) return null;
  if (typeof p.country_iso !== "string") return null;
  return {
    candidate_id: p.candidate_id,
    website_url: p.website_url ?? null,
    canonical_website: p.canonical_website ?? null,
    business_name: p.business_name,
    country_iso: p.country_iso,
    discovered_from_source_slug: p.discovered_from_source_slug ?? "unknown",
    discovered_from_probe_job_id: p.discovered_from_probe_job_id ?? "",
  };
}

async function loadCandidateForWalk(client: PoolClient, candidate_id: string) {
  const r = await client.query<{
    candidate_id: string; source_slug: string; programme_id: string | null;
    country_iso: string; term: string | null; business_name: string;
    website_url: string | null;
  }>(
    `SELECT candidate_id, source_slug, programme_id, country_iso, term, business_name, website_url
       FROM nex.harvest_business_candidate WHERE candidate_id = $1`,
    [candidate_id],
  );
  return r.rowCount === 0 ? null : r.rows[0];
}

export type WebsiteWalkStatus =
  | "not_applicable" | "walked" | "walked_zero_pages"
  | "blocked_by_robots" | "blocked_by_governance" | "unavailable";

async function updateWebsiteWalkOutcome(
  client: PoolClient,
  input: { candidate_id: string; status: WebsiteWalkStatus; emails_count: number; walked_at?: string | null },
) {
  await client.query(
    `UPDATE nex.harvest_business_candidate
        SET website_walk_status = $2,
            emails_discovered_count = $3,
            website_walked_at = COALESCE($4::timestamptz, website_walked_at)
      WHERE candidate_id = $1`,
    [input.candidate_id, input.status, input.emails_count, input.walked_at ?? null],
  );
}

export async function executeWebsiteWalk(input: ExecuteWebsiteWalkInput): Promise<WebsiteWalkExecuteResult> {
  const { client, job } = input;
  const now_fn = input.now ?? (() => new Date());
  const t0 = now_fn().getTime();
  const walker = input.walker ?? processEntityCandidate;
  const fetcher = input.fetcher ?? NULL_FETCHER;

  const payload = parsePayload(job);
  if (!payload) return { kind: "invalid_payload", reason: "website_walk payload missing required fields" };

  // Load the candidate to get programme_id + validate identity
  const candidate = await loadCandidateForWalk(client, payload.candidate_id);
  if (!candidate) return { kind: "candidate_not_found", candidate_id: payload.candidate_id };

  // No website → mark not_applicable (never fabricate a URL)
  if (!candidate.website_url) {
    await updateWebsiteWalkOutcome(client, {
      candidate_id: candidate.candidate_id,
      status: "not_applicable",
      emails_count: 0,
    }).catch(() => { /* soft */ });
    const ms = now_fn().getTime() - t0;
    return { kind: "not_applicable_no_website", ms };
  }

  // Delegate to Session-2's processEntityCandidate · that runs:
  //   walkEntityWebsite → extractEmails (6 methods) → classifyEmail →
  //   recordEntityObservation → recordBusinessEvidence
  const entity_candidate: EntityCandidate = {
    programme_id: candidate.programme_id ?? "",
    iso: candidate.country_iso,
    business_name: candidate.business_name,
    website_url: candidate.website_url,
    discovery_term: candidate.term ?? "",
    cycle_id: job.job_id,
    directory_source: payload.discovered_from_source_slug,
  };
  const result: AdaptedResult = await walker(client, entity_candidate, {
    fetcher,
    max_emails_per_entity: input.max_emails_per_entity ?? 12,
  });

  const emails_captured = result.emails.length;
  const evidence_ids = result.persisted.evidence_ids;
  const entity_id = result.persisted.entity_id;

  // Map walk outcome → candidate status
  let status: WebsiteWalkStatus;
  let result_kind: WebsiteWalkExecuteResult["kind"];
  const walked_at = now_fn().toISOString();

  switch (result.outcome) {
    case "no_website":
      // Should have been caught above · defensive
      status = "not_applicable";
      result_kind = "not_applicable_no_website";
      break;
    case "walker_blocked_by_governance":
      status = "blocked_by_governance";
      result_kind = "blocked_by_governance";
      break;
    case "walker_no_pages_fetched":
      // Distinguish robots-denied from unavailable using walk counters
      if (result.walk.pages_robots_denied === result.walk.pages_attempted && result.walk.pages_attempted > 0) {
        status = "blocked_by_robots";
        result_kind = "robots_denied";
      } else if (result.walk.pages_unavailable === result.walk.pages_attempted && result.walk.pages_attempted > 0) {
        status = "unavailable";
        result_kind = "unavailable";
      } else if (result.walk.pages_blocked_by_governance > 0) {
        status = "blocked_by_governance";
        result_kind = "blocked_by_governance";
      } else {
        status = "walked_zero_pages";
        result_kind = "walked";
      }
      break;
    case "walker_completed_no_emails":
    case "walker_completed_with_emails":
      status = "walked";
      result_kind = "walked";
      break;
    case "error":
      status = "unavailable";
      result_kind = "unavailable";
      break;
    default:
      status = "unavailable";
      result_kind = "unavailable";
  }

  await updateWebsiteWalkOutcome(client, {
    candidate_id: candidate.candidate_id,
    status,
    emails_count: emails_captured,
    walked_at: result.walk.pages_fetched > 0 ? walked_at : null,
  }).catch(() => { /* soft */ });

  // Record yield events with distinct counters
  await recordYield(client, {
    job_id: job.job_id, worker_id: input.worker_id,
    yield_kind: "website_walk_completed", yield_count: 1,
    yield_meta: {
      candidate_id: candidate.candidate_id,
      website_url: candidate.website_url,
      pages_fetched: result.walk.pages_fetched,
      pages_robots_denied: result.walk.pages_robots_denied,
      pages_blocked_by_governance: result.walk.pages_blocked_by_governance,
      pages_not_found: result.walk.pages_not_found,
      pages_unavailable: result.walk.pages_unavailable,
      emails_captured,
      evidence_ids_count: evidence_ids.length,
      website_walk_status: status,
    },
  }).catch(() => { /* soft */ });

  // Per-page yields distinguish "pages walked" from "emails captured" in analytics
  if (result.walk.pages_fetched > 0) {
    await recordYield(client, {
      job_id: job.job_id, worker_id: input.worker_id,
      yield_kind: "website_pages_walked", yield_count: result.walk.pages_fetched,
      yield_meta: { candidate_id: candidate.candidate_id, website_url: candidate.website_url },
    }).catch(() => { /* soft */ });
  }
  if (emails_captured > 0) {
    await recordYield(client, {
      job_id: job.job_id, worker_id: input.worker_id,
      yield_kind: "email_captured", yield_count: emails_captured,
      yield_meta: {
        candidate_id: candidate.candidate_id,
        business_name: candidate.business_name,
        // Never include the email addresses themselves in yield_meta
      },
    }).catch(() => { /* soft */ });
  }

  const ms = now_fn().getTime() - t0;

  // Return typed result
  if (result_kind === "walked") {
    return {
      kind: "walked",
      pages_fetched: result.walk.pages_fetched,
      pages_blocked_by_governance: result.walk.pages_blocked_by_governance,
      pages_robots_denied: result.walk.pages_robots_denied,
      pages_not_found: result.walk.pages_not_found,
      pages_unavailable: result.walk.pages_unavailable,
      emails_captured,
      entity_id,
      evidence_ids,
      website_walk_status: status === "walked_zero_pages" ? "walked_zero_pages" : "walked",
      ms,
    };
  }
  if (result_kind === "blocked_by_governance") return { kind: "blocked_by_governance", reason: result.note ?? "blocked_by_governance", ms };
  if (result_kind === "robots_denied") return { kind: "robots_denied", ms };
  if (result_kind === "unavailable") return { kind: "unavailable", note: result.note ?? "unavailable", ms };
  if (result_kind === "not_applicable_no_website") return { kind: "not_applicable_no_website", ms };
  return { kind: "unavailable", note: "unmapped_outcome", ms };
}

// ─── Structural boundary markers ───────────────────────────────────
export const _WEBSITE_WALK_NEVER_GENERATES_EMAIL =
  "publicly_found_email_not_equal_generated_email_no_info_at_domain_no_name_based_construction_no_MX_invention";
export const _WEBSITE_WALK_USES_SESSION_2_EXTRACTOR =
  "six_method_extractor_is_authoritative_never_a_second_email_extractor";
export const _WEBSITE_WALK_PRESERVES_DISTINCT_COUNTERS =
  "pages_fetched_pages_robots_denied_emails_captured_evidence_ids_all_reported_separately";
export const _WEBSITE_WALK_NULL_FETCHER_DEFAULT =
  "NULL_FETCHER_is_default_production_fetcher_is_founder_opt_in";
export const _WEBSITE_WALK_STATUS_TRUTHFUL =
  "not_applicable_walked_walked_zero_pages_blocked_by_robots_blocked_by_governance_unavailable_all_distinct";
