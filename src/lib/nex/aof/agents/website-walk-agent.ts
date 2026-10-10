// src/lib/nex/aof/agents/website-walk-agent.ts
//
// NEX Autonomous Operations Framework · Website Walk Agent
// Founder-authorised programme · 2026-09-22.
//
// Wraps the existing executeWebsiteWalk primitive. Adds AOF-level:
//   * capability gate (`website_walk`)
//   * cycle counter updates
//   * decision event log per walk
// Delegates to the proven Model B DB-verified provenance gate; zero
// duplication of walker/extractor/entity logic.

import type { PgClient } from "../types";
import { requireCapability } from "../capability";
import { logAgentEvent } from "../lifecycle";
import { updateCycleCounters } from "../cycle";
import { claimNextJob, completeJob, failJob, executeWebsiteWalk } from "@/lib/nex/harvest";
import type { PageFetcher } from "@/lib/nex/discovery-world";

export interface WebsiteWalkAgentDeps {
  readonly client: PgClient;
  readonly agent_id: string;
  readonly worker_id: string;
  readonly fetcher: PageFetcher;
  readonly cycle_id: string;
}

export interface DrainInput {
  readonly max_walks: number;
  readonly per_walk_lease_seconds?: number;
  readonly between_walks_ms?: number;
}

export interface DrainOutcome {
  readonly processed: number;
  readonly walked_ok: number;
  readonly emails_captured: number;
  readonly outcomes: Record<string, number>;
  readonly walks_by_country: Record<string, { walked: number; emails: number; blocked: number; unavailable: number }>;
}

export async function drainWebsiteWalks(deps: WebsiteWalkAgentDeps, input: DrainInput): Promise<DrainOutcome> {
  await requireCapability(deps.client, deps.agent_id, "website_walk");
  const outcomes: Record<string, number> = {};
  const byCountry: Record<string, { walked: number; emails: number; blocked: number; unavailable: number }> = {};
  let processed = 0, walkedOk = 0, emailsTotal = 0;
  const lease = Math.max(60, input.per_walk_lease_seconds ?? 180);
  const gap = Math.max(0, input.between_walks_ms ?? 500);

  while (processed < input.max_walks) {
    const walkJob = await claimNextJob(deps.client, {
      worker_id: deps.worker_id, job_types: ["website_walk"], lease_seconds: lease,
    });
    if (!walkJob) break;
    processed++;
    const cntry = (walkJob.payload as any).country_iso ?? "??";
    byCountry[cntry] = byCountry[cntry] || { walked: 0, emails: 0, blocked: 0, unavailable: 0 };

    // Bootstrap discovery_cycle row keyed to job_id (walker uses job_id as cycle_id downstream)
    await deps.client.query(
      `INSERT INTO nex.discovery_cycle (cycle_id, cycle_seq, topic, terms_used, countries_touched, sources_attempted)
       VALUES ($1, EXTRACT(EPOCH FROM now())::BIGINT, 'scaffolding',
               ARRAY['scaffolding','gerüstbau','échafaudage','steigerbouw','scaffolder'],
               ARRAY[$2], ARRAY['aof_website_walk'])
       ON CONFLICT (cycle_id) DO NOTHING`,
      [walkJob.job_id, cntry],
    );

    try {
      const r = await executeWebsiteWalk({ client: deps.client, job: walkJob, worker_id: deps.worker_id, fetcher: deps.fetcher });
      outcomes[r.kind] = (outcomes[r.kind] || 0) + 1;
      const em = (r as any).emails_captured || 0;
      emailsTotal += em;
      if (r.kind === "walked") { walkedOk++; byCountry[cntry].walked++; }
      if (r.kind === "blocked_by_governance") byCountry[cntry].blocked++;
      if (r.kind === "unavailable" || r.kind === "robots_denied") byCountry[cntry].unavailable++;
      byCountry[cntry].emails += em;

      await logAgentEvent(deps.client, {
        agent_id: deps.agent_id, event_kind: "decision", cycle_id: deps.cycle_id,
        worker_id: deps.worker_id,
        payload: {
          op: "walk", country: cntry, kind: r.kind,
          pages_fetched: (r as any).pages_fetched ?? null,
          emails_captured: em,
          website_url: (walkJob.payload as any).website_url ?? null,
        },
      });

      if (r.kind === "walked" || r.kind === "not_applicable_no_website" || r.kind === "candidate_not_found") {
        await completeJob(deps.client, { job_id: walkJob.job_id, worker_id: deps.worker_id });
      } else if (r.kind === "unavailable" || r.kind === "robots_denied") {
        await failJob(deps.client, { job_id: walkJob.job_id, worker_id: deps.worker_id, error: r.kind, retryable: true });
      } else {
        await completeJob(deps.client, { job_id: walkJob.job_id, worker_id: deps.worker_id });
      }
    } catch (e: any) {
      outcomes["exec_error"] = (outcomes["exec_error"] || 0) + 1;
      await failJob(deps.client, { job_id: walkJob.job_id, worker_id: deps.worker_id, error: `exec:${(e?.message ?? "").slice(0, 80)}`, retryable: true });
      await logAgentEvent(deps.client, {
        agent_id: deps.agent_id, event_kind: "error", cycle_id: deps.cycle_id, worker_id: deps.worker_id,
        payload: { op: "walk", error: (e?.message ?? "").slice(0, 200) },
      });
    }
    if (gap > 0 && processed < input.max_walks) await new Promise(r => setTimeout(r, gap));
  }

  await updateCycleCounters(deps.client, {
    cycle_id: deps.cycle_id,
    walks_completed_delta: walkedOk,
    emails_captured_delta: emailsTotal,
  });

  return { processed, walked_ok: walkedOk, emails_captured: emailsTotal, outcomes, walks_by_country: byCountry };
}
