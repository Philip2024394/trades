// WO-AGENT-RUNTIME-01 · signed per-agent performance history.
//
// Every completed mission produces a signed AgentPerformanceRecord that
// is queryable by agent_id. Founder-locked: performance history is
// evidence, not marketing — every record links to real evidence_refs.

import { randomUUID, sign as ed25519Sign } from "node:crypto";
import { canonicalJson, provenanceChainHash } from "@/lib/nex-intelligence/provenance";
import { getStorage } from "@/lib/nex/storage/registry";
import type { AgentIdentity, AgentPerformanceRecord } from "./types";

export const PERFORMANCE_HISTORY_COLLECTION = "nex_agent_performance_history";

function perfSignaturePayload(input: {
  performance_id: string;
  agent_id: string;
  mission_id: string;
  started_at: string;
  finished_at: string;
  outcome: "SUCCESS" | "FAILURE" | "PARTIAL";
  evidence_refs: readonly string[];
  items_processed: number;
  compute_used_ms: number;
}): string {
  return canonicalJson({
    performance_id: input.performance_id,
    agent_id: input.agent_id,
    mission_id: input.mission_id,
    started_at: input.started_at,
    finished_at: input.finished_at,
    outcome: input.outcome,
    evidence_refs: input.evidence_refs,
    items_processed: input.items_processed,
    compute_used_ms: input.compute_used_ms,
  });
}

export interface RecordPerformanceInput {
  readonly identity: AgentIdentity;
  readonly runtime_private_key_hex: string;
  readonly mission_id: string;
  readonly started_at: string;
  readonly finished_at?: string;
  readonly outcome: "SUCCESS" | "FAILURE" | "PARTIAL";
  readonly evidence_refs: readonly string[];
  readonly items_processed: number;
  readonly compute_used_ms: number;
}

export async function recordPerformance(input: RecordPerformanceInput): Promise<AgentPerformanceRecord> {
  const finished_at = input.finished_at ?? new Date().toISOString();
  const performance_id = `agent-perf-${input.identity.agent_id}-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const payload = perfSignaturePayload({
    performance_id,
    agent_id: input.identity.agent_id,
    mission_id: input.mission_id,
    started_at: input.started_at,
    finished_at,
    outcome: input.outcome,
    evidence_refs: input.evidence_refs,
    items_processed: input.items_processed,
    compute_used_ms: input.compute_used_ms,
  });
  const signature = ed25519Sign(null, Buffer.from(payload, "utf8"), {
    key: Buffer.from(input.runtime_private_key_hex, "hex"),
    format: "der", type: "pkcs8",
  });
  const base = {
    record_type: "NEX_AGENT_PERFORMANCE_RECORD" as const,
    performance_id,
    agent_id: input.identity.agent_id,
    mission_id: input.mission_id,
    started_at: input.started_at,
    finished_at,
    outcome: input.outcome,
    evidence_refs: Object.freeze([...input.evidence_refs]) as readonly string[],
    items_processed: input.items_processed,
    compute_used_ms: input.compute_used_ms,
    runtime_signature_hex: signature.toString("hex"),
  };
  const record: AgentPerformanceRecord = { ...base, provenance_chain_hash: provenanceChainHash(base, []) };
  await getStorage().save(PERFORMANCE_HISTORY_COLLECTION, record);
  return record;
}

export interface QueryPerformanceInput {
  readonly agent_id: string;
  readonly since_iso?: string;
  readonly limit?: number;
}

export async function queryPerformance(input: QueryPerformanceInput): Promise<AgentPerformanceRecord[]> {
  const records = await getStorage().query<AgentPerformanceRecord>(
    PERFORMANCE_HISTORY_COLLECTION,
    { limit: input.limit ?? 5000, order_by: "finished_at", order_dir: "desc" },
  );
  return records.filter((r) => {
    if (r.agent_id !== input.agent_id) return false;
    if (input.since_iso && r.finished_at < input.since_iso) return false;
    return true;
  });
}

/**
 * Rollup stats — deterministic, non-fabricated. If no records, returns zero counts.
 */
export interface PerformanceRollup {
  readonly agent_id: string;
  readonly total_missions: number;
  readonly successes: number;
  readonly failures: number;
  readonly partials: number;
  readonly total_items_processed: number;
  readonly total_compute_ms: number;
  readonly last_mission_at: string | null;
}

export async function rollupPerformance(agent_id: string, since_iso?: string): Promise<PerformanceRollup> {
  const records = await queryPerformance({ agent_id, since_iso });
  const successes = records.filter((r) => r.outcome === "SUCCESS").length;
  const failures = records.filter((r) => r.outcome === "FAILURE").length;
  const partials = records.filter((r) => r.outcome === "PARTIAL").length;
  const total_items_processed = records.reduce((s, r) => s + r.items_processed, 0);
  const total_compute_ms = records.reduce((s, r) => s + r.compute_used_ms, 0);
  const last_mission_at = records[0]?.finished_at ?? null;
  return {
    agent_id, total_missions: records.length,
    successes, failures, partials,
    total_items_processed, total_compute_ms,
    last_mission_at,
  };
}
