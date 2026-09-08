// src/app/api/nex/observatory/state/route.ts
//
// NEX Header-Off / Headquarters Agent Observatory · API endpoint
// Founder BEGIN 2026-09-08 · §17-22
//
// GET /api/nex/observatory/state
//
// Returns real per-agent state · never fabricated · always evidence-labelled.
// Reads heartbeat files + Postgres metrics.
//
// Query params:
//   ?agents=accommodation,food     (optional filter)
//
// Response shape: { agents: AgentObservationSnapshot[], collected_at_iso, latency_ms }

import { NextResponse } from "next/server";
import { performance } from "node:perf_hooks";
import {
  collectAgentSnapshot,
  OBSERVATORY_AGENT_ROSTER,
} from "@/lib/nex/intelligence-storage-grid/observatory/collector";
import { AccommodationStorageGridAdapter } from "@/lib/nex/intelligence-storage-grid/accommodation/adapter-postgres";
import type { DomainAgentId } from "@/lib/nex/intelligence-storage-grid/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const t0 = performance.now();
  const url = new URL(request.url);
  const filter = url.searchParams.get("agents");
  const wantedAgents: DomainAgentId[] | null = filter
    ? (filter.split(",").map((s) => s.trim()) as DomainAgentId[])
    : null;

  const roster = wantedAgents
    ? OBSERVATORY_AGENT_ROSTER.filter((r) => wantedAgents.includes(r.agent_id))
    : OBSERVATORY_AGENT_ROSTER;

  // Only Accommodation has an adapter today · other agents get heartbeat-only snapshot
  let pool: any = null;
  let accommodationAdapter: AccommodationStorageGridAdapter | null = null;
  try {
    if (process.env.NEX_POSTGRES_URL) {
      const pg = await import("pg");
      const { Pool } = pg.default ?? pg;
      pool = new Pool({ connectionString: process.env.NEX_POSTGRES_URL, max: 2, connectionTimeoutMillis: 8000 });
      accommodationAdapter = new AccommodationStorageGridAdapter(pool);
    }
  } catch (e) {
    console.error("observatory/state · pg init failed", e);
  }

  const snapshots = await Promise.all(
    roster.map(async ({ agent_id, display_name }) => {
      const adapter = agent_id === "accommodation" ? accommodationAdapter : null;
      try {
        return await collectAgentSnapshot(agent_id, display_name, adapter);
      } catch (e: any) {
        return {
          domain_agent_id: agent_id,
          display_name,
          status: "FAILED" as const,
          status_reason: `collector failed: ${e?.message ?? String(e)}`,
          last_heartbeat_at_iso: null,
          last_successful_collection_at_iso: null,
          pid: null,
          growth: {
            domain_agent_id: agent_id,
            measured_at_iso: new Date().toISOString(),
            entities_total: 0, entities_verified: 0, entities_observed_unverified: 0,
            entities_stale: 0, entities_conflict_flagged: 0, entities_superseded: 0,
            entities_added_today: 0, entities_updated_today: 0,
            entities_added_this_week: 0, entities_added_this_month: 0,
            countries_covered: 0, cities_covered: 0,
            knowledge_gaps_open: 0, knowledge_gaps_resolved_today: 0,
            research_active: 0, research_completed_today: 0, research_failed_today: 0,
            verified_knowledge_growth_pct: 0,
            verified_knowledge_growth_denominator_note: "collector failed",
            evidence_label: "UNKNOWN" as const,
          },
          storage: {
            domain_agent_id: agent_id,
            measured_at_iso: new Date().toISOString(),
            bytes_total: 0, bytes_hot_tier: 0, bytes_canonical: 0, bytes_archive: 0,
            object_count: 0, average_object_size_bytes: 0,
            compression_ratio_measured: null, dedup_ratio_measured: null,
            read_operations_last_hour: 0, write_operations_last_hour: 0,
            cache_hits_last_hour: 0, cache_misses_last_hour: 0,
            retrieval_latency_p50_ms: 0, retrieval_latency_p95_ms: 0, retrieval_latency_p99_ms: 0,
            projected_monthly_growth_bytes: 0, projected_monthly_cost_usd: null,
            evidence_label: "UNKNOWN" as const,
          },
          coverage_by_country: [],
          category_breakdown: {},
          research_metrics: { active_tasks: 0, completed_last_hour: 0, failed_last_hour: 0, unresolved_gaps: 0 },
          quality: { verified_percentage: 0, unresolved_conflicts: 0, provenance_coverage_percentage: 0, source_reliability_average: null },
          evidence_label: "UNKNOWN" as const,
        };
      }
    }),
  );

  if (pool) await pool.end().catch(() => {});

  const latency_ms = Math.round((performance.now() - t0) * 100) / 100;
  return NextResponse.json({
    schema_version: "v1.0",
    collected_at_iso: new Date().toISOString(),
    latency_ms,
    agents: snapshots,
    _discipline: "Every number is MEASURED / DOCUMENTED / MODELED / ESTIMATED / UNKNOWN · Op-Truth §OP.5 · Founder verifier · final_status:null",
  });
}
