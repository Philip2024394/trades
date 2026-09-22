// src/lib/nex/harvest/controller.ts
//
// NEX 24/7 World Harvest Engine · Wave H5 · Controller
// Founder-authorised programme · 2026-09-22.
//
// H5 IS COMPOSITION · NOT NEW MACHINERY.
//
//   H1 queue + H2 registry + H2→H1 seam + H3 executor + H4 executor
//   + reaper + country scheduler + Asia-last invariant + worker heartbeat
//   = HarvestController tick loop
//
// Everything the tick uses is already built and tested. The tick's job
// is only to compose them into a self-driving loop that keeps NEX
// harvesting through worker death.
//
// GOVERNANCE HARD-LOCKS:
//   * NEVER re-implements H1-H4 logic · always delegates
//   * NEVER bypasses gates · NULL_FETCHER + NULL_OVERPASS_ADAPTER remain
//     the module defaults · Founder must inject production adapters
//   * "HARVESTING ACTIVE" is derived from real harvest_yield rows,
//     NEVER from "endpoint returned 200" or "worker is alive"
//   * A dead worker with a green tick endpoint MUST show STALLED

import type { PoolClient } from "pg";
import type { HarvestJob } from "./types";
import type { OverpassAdapter } from "./overpass-adapter";
import type { PageFetcher } from "@/lib/nex/discovery-world";
import { NULL_OVERPASS_ADAPTER } from "./overpass-adapter";
import { NULL_FETCHER } from "@/lib/nex/discovery-world";
import { claimNextJob, completeJob, failJob, heartbeatJob, loadQueueSummary } from "./queue";
import { registerWorker, workerHeartbeat, bumpWorkerCounters } from "./worker";
import { runHarvestReaper } from "./reaper";
import { scheduleSourceProbes } from "./source-registry";
import { selectNextCountriesForScheduling } from "./country-scheduler";
import { executeSourceProbe } from "./source-probe-executor";
import { executeWebsiteWalk } from "./website-walk-executor";

export interface ControllerTickInput {
  readonly client: PoolClient;
  readonly worker_id: string;
  readonly programme_id: string;
  readonly programme_terms: readonly string[];
  readonly overpass_adapter?: OverpassAdapter;
  readonly page_fetcher?: PageFetcher;
  readonly job_types?: readonly string[];        // default: ["source_probe", "website_walk"]
  readonly lease_seconds?: number;               // default: 60
  readonly max_countries_to_schedule?: number;   // default: 3
  readonly max_jobs_per_source?: number;         // default: 6
  readonly cadence_seconds?: number;             // country scheduling cadence · default 300
  readonly now?: () => Date;
}

export interface ControllerTickResult {
  readonly ok: true;
  readonly tick_at: string;
  readonly duration_ms: number;
  readonly worker_id: string;
  readonly reaper: { expired_leases_released: number; moved_to_dead_letter: number; workers_marked_expired: number };
  readonly scheduling: {
    readonly countries_selected: number;
    readonly countries_selected_asia: number;
    readonly asia_last_enforced: boolean;
    readonly jobs_enqueued: number;
    readonly jobs_duplicate: number;
  };
  readonly claim: {
    readonly claimed: boolean;
    readonly job_type: string | null;
    readonly job_id: string | null;
    readonly outcome_kind: string | null;
  };
  readonly queue_summary: Record<string, number>;
}

/** One bounded tick of the harvest controller. This is what a cron
 *  endpoint calls · what a continuous worker calls in a loop · what
 *  the endurance test calls repeatedly. Deterministic if fed a fake
 *  clock + fixture adapters. */
export async function runHarvestControllerTick(input: ControllerTickInput): Promise<ControllerTickResult> {
  const now_fn = input.now ?? (() => new Date());
  const t0 = now_fn().getTime();
  const job_types = input.job_types ?? ["source_probe", "website_walk"];
  const lease_seconds = input.lease_seconds ?? 60;

  // 1 · Worker heartbeat / registration
  await registerWorker(input.client, {
    worker_id: input.worker_id,
    job_type_scope: job_types,
    heartbeat_interval_seconds: 30,
    now: now_fn,
  }).catch(() => { /* soft */ });
  await workerHeartbeat(input.client, { worker_id: input.worker_id, now: now_fn }).catch(() => { /* soft */ });

  // 2 · Reaper · releases expired leases before any new claim
  const reaper = await runHarvestReaper(input.client, { now: now_fn });

  // 3 · Country scheduling · Asia-last enforced structurally
  const country_pick = await selectNextCountriesForScheduling(input.client, {
    programme_id: input.programme_id,
    max_countries: input.max_countries_to_schedule ?? 3,
    cadence_seconds: input.cadence_seconds ?? 300,
    now: now_fn,
  }).catch(() => ({
    selected: [] as any[], asia_last_enforced: false, non_asia_remaining: 0,
    asia_countries_in_scope: 0, generated_at: now_fn().toISOString(),
  }));

  let jobs_enqueued_total = 0;
  let jobs_duplicate_total = 0;
  let asia_count_in_selection = 0;
  for (const country of country_pick.selected) {
    if (country.is_asia) asia_count_in_selection++;
    const report = await scheduleSourceProbes(input.client, {
      programme_id: input.programme_id,
      country_iso: country.iso_alpha_2,
      terms: input.programme_terms,
      max_jobs_per_source: input.max_jobs_per_source ?? 6,
      now: now_fn,
    }).catch(() => ({ enqueued: 0, duplicates: 0, sources_considered: 0, per_source: [] }));
    jobs_enqueued_total += report.enqueued;
    jobs_duplicate_total += report.duplicates;
  }

  // 4 · Claim next job · dispatch based on job_type
  let claimed_job: HarvestJob | null = null;
  let outcome_kind: string | null = null;
  claimed_job = await claimNextJob(input.client, {
    worker_id: input.worker_id,
    job_types,
    lease_seconds,
    now: now_fn,
  });

  if (claimed_job) {
    try {
      if (claimed_job.job_type === "source_probe") {
        const result = await executeSourceProbe({
          client: input.client, job: claimed_job, worker_id: input.worker_id,
          adapter: input.overpass_adapter ?? NULL_OVERPASS_ADAPTER, now: now_fn,
        });
        outcome_kind = result.kind;
        if (result.kind === "completed" || result.kind === "zero_results" || result.kind === "adapter_dormant") {
          await completeJob(input.client, { job_id: claimed_job.job_id, worker_id: input.worker_id, now: now_fn }).catch(() => { /* soft */ });
          await bumpWorkerCounters(input.client, { worker_id: input.worker_id, completed: 1 }).catch(() => { /* soft */ });
        } else if (result.kind === "source_unavailable" || result.kind === "rate_limited") {
          await failJob(input.client, { job_id: claimed_job.job_id, worker_id: input.worker_id, error: result.kind, retryable: true, now: now_fn }).catch(() => { /* soft */ });
          await bumpWorkerCounters(input.client, { worker_id: input.worker_id, failed: 1 }).catch(() => { /* soft */ });
        } else {
          await failJob(input.client, { job_id: claimed_job.job_id, worker_id: input.worker_id, error: result.kind, retryable: false, now: now_fn }).catch(() => { /* soft */ });
          await bumpWorkerCounters(input.client, { worker_id: input.worker_id, failed: 1 }).catch(() => { /* soft */ });
        }
      } else if (claimed_job.job_type === "website_walk") {
        const result = await executeWebsiteWalk({
          client: input.client, job: claimed_job, worker_id: input.worker_id,
          fetcher: input.page_fetcher ?? NULL_FETCHER, now: now_fn,
        });
        outcome_kind = result.kind;
        if (result.kind === "walked" || result.kind === "not_applicable_no_website" || result.kind === "candidate_not_found") {
          await completeJob(input.client, { job_id: claimed_job.job_id, worker_id: input.worker_id, now: now_fn }).catch(() => { /* soft */ });
          await bumpWorkerCounters(input.client, { worker_id: input.worker_id, completed: 1 }).catch(() => { /* soft */ });
        } else if (result.kind === "unavailable" || result.kind === "robots_denied") {
          await failJob(input.client, { job_id: claimed_job.job_id, worker_id: input.worker_id, error: result.kind, retryable: true, now: now_fn }).catch(() => { /* soft */ });
          await bumpWorkerCounters(input.client, { worker_id: input.worker_id, failed: 1 }).catch(() => { /* soft */ });
        } else {
          // blocked_by_governance is not retryable · fetcher governance is authoritative
          await completeJob(input.client, { job_id: claimed_job.job_id, worker_id: input.worker_id, now: now_fn }).catch(() => { /* soft */ });
          await bumpWorkerCounters(input.client, { worker_id: input.worker_id, completed: 1 }).catch(() => { /* soft */ });
        }
      } else {
        // Unknown job type · fail without retry
        outcome_kind = "unknown_job_type";
        await failJob(input.client, { job_id: claimed_job.job_id, worker_id: input.worker_id, error: `unknown_job_type:${claimed_job.job_type}`, retryable: false, now: now_fn }).catch(() => { /* soft */ });
      }
      await bumpWorkerCounters(input.client, { worker_id: input.worker_id, claimed: 1 }).catch(() => { /* soft */ });
    } catch (e) {
      outcome_kind = "controller_exception";
      await failJob(input.client, { job_id: claimed_job.job_id, worker_id: input.worker_id, error: (e as Error).message, retryable: true, now: now_fn }).catch(() => { /* soft */ });
    }
  }

  const queue_summary = await loadQueueSummary(input.client).catch(() => ({ queued: 0, claimed: 0, processing: 0, completed: 0, failed: 0, dead_letter: 0 } as Record<string, number>));

  return {
    ok: true,
    tick_at: new Date(t0).toISOString(),
    duration_ms: now_fn().getTime() - t0,
    worker_id: input.worker_id,
    reaper: {
      expired_leases_released: reaper.expired_leases_released,
      moved_to_dead_letter: reaper.moved_to_dead_letter,
      workers_marked_expired: reaper.workers_marked_expired,
    },
    scheduling: {
      countries_selected: country_pick.selected.length,
      countries_selected_asia: asia_count_in_selection,
      asia_last_enforced: country_pick.asia_last_enforced,
      jobs_enqueued: jobs_enqueued_total,
      jobs_duplicate: jobs_duplicate_total,
    },
    claim: {
      claimed: claimed_job !== null,
      job_type: claimed_job?.job_type ?? null,
      job_id: claimed_job?.job_id ?? null,
      outcome_kind,
    },
    queue_summary,
  };
}

// ─── Structural boundary markers ───────────────────────────────────
export const _CONTROLLER_PURE_COMPOSITION =
  "H5_never_reimplements_H1_H2_H3_H4_only_composes_them_all_execution_delegates";
export const _CONTROLLER_ADAPTERS_INJECTABLE_NULL_DEFAULTS =
  "NULL_FETCHER_and_NULL_OVERPASS_ADAPTER_remain_module_defaults_production_adapters_are_founder_opt_in";
export const _CONTROLLER_ASIA_LAST_ENFORCED_AT_SCHEDULER =
  "controller_delegates_to_selectNextCountriesForScheduling_which_refuses_asia_while_non_asia_eligible";
export const _CONTROLLER_ACTIVE_MEANS_YIELD_NOT_HEARTBEAT =
  "harvest_yield_rows_are_the_definition_of_active_worker_heartbeat_alone_is_never_active";
