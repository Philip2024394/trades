// WO-HQ-THREE-METRIC-01 · founder-locked doctrine display.
//
// Founder-locked 2026-09-13: never call the +N headline "N pieces of new
// intelligence". This endpoint returns THREE separate numbers:
//
//   1. Processing growth      · pipeline volume (activity)
//   2. Validated knowledge    · knowledge objects that passed causal chain
//   3. Capability growth      · CAP-RESOLVED events (NEX genuinely improved)
//
// Every count carries drilldown record IDs so any displayed number
// resolves to real underlying evidence.

import { NextResponse } from "next/server";
import { getStorage } from "@/lib/nex/storage/registry";
import {
  SOURCE_POOL_COLLECTION,
  SOURCE_ENTRY_POOL_COLLECTION,
  SANITIZED_POOL_COLLECTION,
  DISCOVERY_POOL_COLLECTION,
  HYPOTHESIS_POOL_COLLECTION,
  EXPERIMENT_POOL_COLLECTION,
  KNOWLEDGE_POOL_COLLECTION,
  PROPOSAL_POOL_COLLECTION,
} from "@/lib/nex-intelligence/source-pool";
import { CAP_COLLECTION } from "@/lib/nex-cap/types";
import type { CapabilityGap } from "@/lib/nex-cap/types";
import { CAP_EXECUTION_ATTEMPTS_COLLECTION } from "@/lib/nex-cap/execution";
import type { CapExecutionAttempt } from "@/lib/nex-cap/execution";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface DrilldownMetric {
  count: number;
  source_collection: string;
  sample_record_ids: string[];   // up to 25 records for drilldown
}

interface ThreeMetricGrowth {
  record_type: "NEX_THREE_METRIC_GROWTH";
  generated_at: string;
  language_note: string;
  // 1. Processing growth · pipeline volume · does NOT equal intelligence growth
  processing_growth: {
    sources: DrilldownMetric;
    source_entries: DrilldownMetric;
    sanitized_fragments: DrilldownMetric;
    discoveries: DrilldownMetric;
    hypotheses: DrilldownMetric;
    experiments: DrilldownMetric;
    total_processing_records: number;
  };
  // 2. Validated knowledge growth · caused by causal-chain verified promotion
  validated_knowledge_growth: {
    validated_knowledge_objects: DrilldownMetric;
    proposals: DrilldownMetric;
    total_validated_records: number;
  };
  // 3. Capability growth · CAPs that actually resolved (NEX became better)
  capability_growth: {
    caps_resolved: DrilldownMetric;
    caps_open: DrilldownMetric;
    caps_escalated: DrilldownMetric;
    caps_proposed: DrilldownMetric;
    net_capability_improvement: number;   // caps_resolved.count only
    // Founder-locked display discipline · every increment resolves to a
    // specific CAP + evidence chain (never bare "+1").
    recent_resolutions: readonly {
      cap_id: string;
      cap_title: string;
      cap_kind: string;
      cap_category: string;
      execution_attempt_id: string;
      workstation_trace_id: string;
      environment: string;
      resolved_at: string;
      evidence_verified: boolean;
      causal_chain: readonly string[];
    }[];
  };
}

async function metric(coll: string, idKey: string): Promise<DrilldownMetric> {
  try {
    const records = await getStorage().query<Record<string, unknown>>(coll, { limit: 100_000 });
    const ids = records.map((r) => r[idKey]).filter((v): v is string => typeof v === "string");
    return { count: records.length, source_collection: coll, sample_record_ids: ids.slice(0, 25) };
  } catch {
    return { count: 0, source_collection: coll, sample_record_ids: [] };
  }
}

async function metricForCaps(filter: (c: CapabilityGap) => boolean): Promise<DrilldownMetric> {
  try {
    // Dedupe by cap_id · use latest version per CAP
    const raw = await getStorage().query<CapabilityGap>(CAP_COLLECTION, { limit: 50_000, order_by: "last_updated_at", order_dir: "desc" });
    const latestById = new Map<string, CapabilityGap>();
    for (const c of raw) if (!latestById.has(c.cap_id)) latestById.set(c.cap_id, c);
    const filtered = Array.from(latestById.values()).filter(filter);
    return {
      count: filtered.length, source_collection: CAP_COLLECTION,
      sample_record_ids: filtered.slice(0, 25).map((c) => c.cap_id),
    };
  } catch {
    return { count: 0, source_collection: CAP_COLLECTION, sample_record_ids: [] };
  }
}

async function loadRecentResolutions(limit = 25): Promise<ThreeMetricGrowth["capability_growth"]["recent_resolutions"]> {
  const store = getStorage();
  const raw = await store.query<CapabilityGap>(CAP_COLLECTION, { limit: 50_000, order_by: "last_updated_at", order_dir: "desc" }).catch(() => []);
  const latestById = new Map<string, CapabilityGap>();
  for (const c of raw) if (!latestById.has(c.cap_id)) latestById.set(c.cap_id, c);
  const resolved = Array.from(latestById.values()).filter((c) => c.status === "RESOLVED").slice(0, limit);
  if (resolved.length === 0) return [];

  const attempts = await store.query<CapExecutionAttempt>(CAP_EXECUTION_ATTEMPTS_COLLECTION, { limit: 5000, order_by: "finished_at", order_dir: "desc" }).catch(() => []);
  const attemptByCap = new Map<string, CapExecutionAttempt>();
  for (const a of attempts) if (a.cap_resolution === "RESOLVED" && !attemptByCap.has(a.cap_id)) attemptByCap.set(a.cap_id, a);

  return resolved.map((c) => {
    const attempt = attemptByCap.get(c.cap_id);
    return {
      cap_id: c.cap_id,
      cap_title: c.title,
      cap_kind: c.kind,
      cap_category: c.category,
      execution_attempt_id: attempt?.attempt_id ?? "",
      workstation_trace_id: attempt?.workstation_trace_id ?? "",
      environment: attempt?.environment ?? "unknown",
      resolved_at: c.last_updated_at,
      evidence_verified: attempt?.all_10_passed ?? false,
      causal_chain: attempt
        ? [c.cap_id, attempt.proposal_id, attempt.workstation_trace_id, ...attempt.stages_executed.map((s) => s.evidence_ref)]
        : [c.cap_id],
    };
  });
}

export async function GET(): Promise<Response> {
  const [
    sources, sourceEntries, sanitized, discoveries, hypotheses, experiments,
    validated, proposals,
    capsResolved, capsOpen, capsEscalated, capsProposed,
    recentResolutions,
  ] = await Promise.all([
    metric(SOURCE_POOL_COLLECTION, "source_id"),
    metric(SOURCE_ENTRY_POOL_COLLECTION, "source_entry_id"),
    metric(SANITIZED_POOL_COLLECTION, "sanitized_id"),
    metric(DISCOVERY_POOL_COLLECTION, "discovery_id"),
    metric(HYPOTHESIS_POOL_COLLECTION, "hypothesis_id"),
    metric(EXPERIMENT_POOL_COLLECTION, "experiment_id"),
    metric(KNOWLEDGE_POOL_COLLECTION, "knowledge_object_id"),
    metric(PROPOSAL_POOL_COLLECTION, "proposal_id"),
    metricForCaps((c) => c.status === "RESOLVED"),
    metricForCaps((c) => c.status === "OPEN" || c.status === "TRIAGED"),
    metricForCaps((c) => c.status === "ESCALATED"),
    metricForCaps((c) => c.status === "PROPOSED" || c.status === "IN_PROGRESS"),
    loadRecentResolutions(25),
  ]);

  const response: ThreeMetricGrowth = {
    record_type: "NEX_THREE_METRIC_GROWTH",
    generated_at: new Date().toISOString(),
    language_note: "Founder-locked 2026-09-13: never call any single number 'N pieces of new intelligence'. Processing = pipeline volume (activity). Validated knowledge = caused by causal-chain-verified promotion. Capability growth = what NEX actually became better at (CAP-RESOLVED). Every count drills down to real record IDs.",
    processing_growth: {
      sources, source_entries: sourceEntries, sanitized_fragments: sanitized,
      discoveries, hypotheses, experiments,
      total_processing_records: sources.count + sourceEntries.count + sanitized.count + discoveries.count + hypotheses.count + experiments.count,
    },
    validated_knowledge_growth: {
      validated_knowledge_objects: validated,
      proposals,
      total_validated_records: validated.count + proposals.count,
    },
    capability_growth: {
      caps_resolved: capsResolved,
      caps_open: capsOpen,
      caps_escalated: capsEscalated,
      caps_proposed: capsProposed,
      net_capability_improvement: capsResolved.count,
      recent_resolutions: recentResolutions,
    },
  };
  return NextResponse.json(response, { status: 200 });
}

export async function POST(): Promise<Response> {
  return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
}
