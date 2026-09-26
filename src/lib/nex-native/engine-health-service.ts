// src/lib/nex-native/engine-health-service.ts
//
// NEX-native · aggregated engine health service (server-only).
// ------------------------------------------------------------
// Single call that returns everything a Founder/HQ operator needs to
// see about the NEX Generation Engine + horizontal-worker fleet:
//
//   · which model is active (id, licence, runtime)
//   · registered model fleet
//   · in-process engine telemetry summary
//   · durable-queue depth + capacity signal
//   · recent job counts (completed / failed / expired last hour)
//   · process memory (RSS / heap)
//
// Reserved for operational surfaces (Founder console, HQ diagnostics,
// ops autoscaler). Never surfaced to end users.

import "server-only";
import { getNexEngineHealth } from "./intelligence/nex-engine-provider";
import { getCapacitySignal } from "./backpressure";
import { nexSupabaseAdmin } from "./supabase-admin";

// In-memory snapshot cache · protects the queue table from a high call
// rate on the health endpoint. Ten-second TTL keeps the snapshot fresh
// enough for operators while collapsing many concurrent reads into one
// underlying set of queries.
const CACHE_TTL_MS = Number(process.env.NEX_ENGINE_HEALTH_CACHE_TTL_MS ?? "10000");
let cached: { at: number; value: Promise<EngineHealthAggregate> } | null = null;

export interface EngineHealthAggregate {
  observed_at: string;
  engine: ReturnType<typeof getNexEngineHealth>;
  capacity: Awaited<ReturnType<typeof getCapacitySignal>>;
  fleet_recent: {
    window_seconds: number;
    completed: number;
    failed: number;
    expired: number;
    requeued_currently: number;
    mean_completed_latency_ms: number | null;
  };
}

const RECENT_WINDOW_SECONDS = 3600; // 1 hour

export async function getEngineHealthAggregate(force = false): Promise<EngineHealthAggregate> {
  const now = Date.now();
  if (!force && cached && now - cached.at < CACHE_TTL_MS) {
    return cached.value;
  }
  const promise = buildEngineHealthAggregate();
  cached = { at: now, value: promise };
  return promise;
}

async function buildEngineHealthAggregate(): Promise<EngineHealthAggregate> {
  const engine = getNexEngineHealth();
  const capacity = await getCapacitySignal();

  const sinceIso = new Date(Date.now() - RECENT_WINDOW_SECONDS * 1000).toISOString();

  // Recent terminal counts (completed / failed / expired)
  const [completedRes, failedRes, expiredRes, requeuedRes, latencyRes] = await Promise.all([
    nexSupabaseAdmin
      .from("nex_generation_job")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed")
      .gte("completed_at", sinceIso),
    nexSupabaseAdmin
      .from("nex_generation_job")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("failed_at", sinceIso),
    nexSupabaseAdmin
      .from("nex_generation_job")
      .select("id", { count: "exact", head: true })
      .eq("status", "expired")
      .gte("failed_at", sinceIso),
    nexSupabaseAdmin
      .from("nex_generation_job")
      .select("id", { count: "exact", head: true })
      .eq("status", "queued")
      .gt("attempts", 0),
    nexSupabaseAdmin
      .from("nex_generation_job")
      .select("result_latency_ms")
      .eq("status", "completed")
      .gte("completed_at", sinceIso)
      .not("result_latency_ms", "is", null)
      .limit(200),
  ]);

  const latencies = ((latencyRes.data as Array<{ result_latency_ms: number | null }> | null) ?? [])
    .map((r) => r.result_latency_ms)
    .filter((n): n is number => typeof n === "number" && n > 0);
  const mean_completed_latency_ms = latencies.length > 0
    ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
    : null;

  return {
    observed_at: new Date().toISOString(),
    engine,
    capacity,
    fleet_recent: {
      window_seconds: RECENT_WINDOW_SECONDS,
      completed: completedRes.count ?? 0,
      failed: failedRes.count ?? 0,
      expired: expiredRes.count ?? 0,
      requeued_currently: requeuedRes.count ?? 0,
      mean_completed_latency_ms,
    },
  };
}
