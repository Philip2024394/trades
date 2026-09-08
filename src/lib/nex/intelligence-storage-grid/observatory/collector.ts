// src/lib/nex/intelligence-storage-grid/observatory/collector.ts
//
// NEX Header-Off / Headquarters Agent Observatory · collector
// Founder BEGIN 2026-09-08 · §17-22
//
// Reads REAL agent state from:
//   - data/agent-runtime/heartbeats/{agent}.json  (existing pattern per agent-runtime paths)
//   - data/master-ai/agent_health_reports.jsonl   (existing observatory ledger)
//   - Postgres (per-domain metrics via adapter)
//
// Never fabricates activity. Never claims ACTIVE without recent heartbeat.
// Aligned with existing master-ai/observatory.ts thresholds:
//   HEARTBEAT_FRESH_MS = 15_000  → ACTIVE
//   HEARTBEAT_DEGRADED_MS = 60_000 → DEGRADED
//   > 60s → CRASHED (mapped to FAILED)
//   no file → STOPPED

import fs from "node:fs";
import path from "node:path";
import type {
  AgentActiveStatus,
  AgentObservationSnapshot,
  DomainAgentId,
  DomainStorageAdapter,
} from "../types.js";

const HEARTBEAT_FRESH_MS = 15_000;
const HEARTBEAT_DEGRADED_MS = 60_000;

// Default heartbeat directory · matches existing convention.
function heartbeatDir(): string {
  return process.env.NEX_AGENT_RUNTIME_DATA_ROOT
    ?? path.join(process.cwd(), "data", "agent-runtime", "heartbeats");
}

/**
 * Read a heartbeat file for an agent. Returns null if missing.
 * Format is defined by agent-runtime/heartbeat.ts (existing).
 */
function readHeartbeat(agent_id: DomainAgentId): {
  last_heartbeat_at_iso: string;
  last_heartbeat_at_epoch_ms: number;
  status_reported: string;
  pid: number | null;
  current_task: string | null;
  work_events_last_5min: number;
} | null {
  const file = path.join(heartbeatDir(), `${agent_id}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    const raw = fs.readFileSync(file, "utf8");
    const j = JSON.parse(raw);
    return {
      last_heartbeat_at_iso: j.last_heartbeat_at_iso ?? j.updated_at_iso ?? j.timestamp ?? new Date(0).toISOString(),
      last_heartbeat_at_epoch_ms: j.last_heartbeat_at_epoch_ms ?? Date.parse(j.last_heartbeat_at_iso ?? j.updated_at_iso ?? j.timestamp ?? "1970-01-01T00:00:00Z"),
      status_reported: j.status ?? "unknown",
      pid: j.pid ?? null,
      current_task: j.current_task ?? j.task ?? null,
      work_events_last_5min: j.work_events_last_5min ?? j.recent_work_count ?? 0,
    };
  } catch {
    return null;
  }
}

/**
 * Derive live status from heartbeat freshness. Deterministic · aligned with
 * master-ai/observatory.ts.
 */
export function deriveStatus(
  heartbeat: ReturnType<typeof readHeartbeat>,
): { status: AgentActiveStatus; reason: string } {
  if (!heartbeat) return { status: "STOPPED", reason: "no heartbeat file present" };
  const ageMs = Date.now() - heartbeat.last_heartbeat_at_epoch_ms;
  if (ageMs <= HEARTBEAT_FRESH_MS && heartbeat.work_events_last_5min > 0) {
    return { status: "ACTIVE", reason: `heartbeat ${ageMs}ms · work_events_5min=${heartbeat.work_events_last_5min}` };
  }
  if (ageMs <= HEARTBEAT_FRESH_MS && heartbeat.work_events_last_5min === 0) {
    // Idle but alive — treat as RESEARCHING if agent reports active task
    if (heartbeat.current_task) {
      return { status: "RESEARCHING", reason: `alive · task=${heartbeat.current_task}` };
    }
    return { status: "ACTIVE", reason: `alive · idle · ${ageMs}ms` };
  }
  if (ageMs <= HEARTBEAT_DEGRADED_MS) return { status: "DEGRADED", reason: `stale heartbeat ${ageMs}ms` };
  return { status: "FAILED", reason: `heartbeat expired ${Math.floor(ageMs/1000)}s ago` };
}

/**
 * Collect a full snapshot for one agent · combines heartbeat status + adapter metrics.
 * Adapter is optional · when null the snapshot has empty metrics but honest status.
 */
export async function collectAgentSnapshot(
  agent_id: DomainAgentId,
  display_name: string,
  adapter: DomainStorageAdapter | null,
): Promise<AgentObservationSnapshot> {
  const hb = readHeartbeat(agent_id);
  const { status, reason } = deriveStatus(hb);

  if (adapter) {
    const snap = await adapter.currentObservationSnapshot();
    snap.status = status;
    snap.status_reason = reason;
    snap.last_heartbeat_at_iso = hb?.last_heartbeat_at_iso ?? null;
    snap.pid = hb?.pid ?? null;
    return snap;
  }

  // No adapter · minimal snapshot with real status from heartbeat only
  return {
    domain_agent_id: agent_id,
    display_name,
    status,
    status_reason: reason,
    last_heartbeat_at_iso: hb?.last_heartbeat_at_iso ?? null,
    last_successful_collection_at_iso: null,
    pid: hb?.pid ?? null,
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
      verified_knowledge_growth_denominator_note: "no adapter",
      evidence_label: "UNKNOWN",
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
      evidence_label: "UNKNOWN",
    },
    coverage_by_country: [],
    category_breakdown: {},
    research_metrics: {
      active_tasks: 0,
      completed_last_hour: 0,
      failed_last_hour: 0,
      unresolved_gaps: 0,
    },
    quality: {
      verified_percentage: 0,
      unresolved_conflicts: 0,
      provenance_coverage_percentage: 0,
      source_reliability_average: null,
    },
    evidence_label: "UNKNOWN",
  };
}

/** Enumerate all agents known to the observatory. */
export const OBSERVATORY_AGENT_ROSTER: Array<{ agent_id: DomainAgentId; display_name: string }> = [
  { agent_id: "accommodation",  display_name: "Accommodation Intelligence Agent" },
  { agent_id: "food",           display_name: "Food Intelligence Agent" },
  { agent_id: "construction",   display_name: "Construction Intelligence Agent" },
  { agent_id: "healthcare",     display_name: "Healthcare Intelligence Agent" },
  { agent_id: "transport",      display_name: "Transport Intelligence Agent" },
  { agent_id: "business",       display_name: "Business Intelligence Agent" },
  { agent_id: "vision",         display_name: "Vision Intelligence Agent" },
  { agent_id: "speaking",       display_name: "Speaking Intelligence Agent" },
  { agent_id: "travel",         display_name: "Travel Intelligence Agent" },
  { agent_id: "legal",          display_name: "Legal Intelligence Agent (built · not runtime-integrated)" },
  { agent_id: "master_ai",      display_name: "Master AI Engineer" },
  { agent_id: "programmer",     display_name: "Programmer Agent" },
];
