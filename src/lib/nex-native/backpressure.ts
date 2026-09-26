// src/lib/nex-native/backpressure.ts
//
// NEX-native · backpressure + per-user fairness (server-only).
// ------------------------------------------------------------
// Turns the queue-depth signal into a decision the API layer can act on.
//
// Per the 2026-09-24 Scaling Doctrine:
//   · One user must not consume the entire generation fleet.
//   · Overload must be honest ("busy, come back in a moment"), not
//     fabricated ("here's a fake reply") and not silently routed to a
//     third-party AI.

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import { getQueueDepth } from "./generation-job-service";
import type { NexUuid } from "./types";

export interface BackpressureConfig {
  /** Max jobs a single account may have queued (not counting in-flight). */
  maxQueuedPerAccount: number;
  /** Global queue depth above which backpressure activates. */
  globalQueueSoftCap: number;
  /** Global queue depth above which we hard-reject. */
  globalQueueHardCap: number;
  /** How many seconds of oldest-queued backlog triggers "we're behind". */
  oldestQueuedWarnSeconds: number;
}

const DEFAULTS: BackpressureConfig = {
  maxQueuedPerAccount: Number(process.env.NEX_BACKPRESSURE_MAX_QUEUED_PER_ACCOUNT ?? "3"),
  globalQueueSoftCap: Number(process.env.NEX_BACKPRESSURE_GLOBAL_SOFT_CAP ?? "500"),
  globalQueueHardCap: Number(process.env.NEX_BACKPRESSURE_GLOBAL_HARD_CAP ?? "5000"),
  oldestQueuedWarnSeconds: Number(process.env.NEX_BACKPRESSURE_OLDEST_WARN_SECONDS ?? "60"),
};

export type BackpressureAdmit =
  | { admit: true; reason: "ok"; queuedGlobal: number; queuedForAccount: number }
  | { admit: false; reason: "per_account_limit" | "global_hard_cap"; queuedGlobal: number; queuedForAccount: number; retryAfterSeconds: number };

/**
 * Decide whether a new generation job for this account should be admitted.
 * Called by the API layer BEFORE enqueue. Cheap · one queue-depth query +
 * one per-account count. Returns admit=false with an honest reason when
 * capacity is exhausted.
 */
export async function shouldAdmitGenerationJob(input: {
  account_id: NexUuid | null;
  config?: Partial<BackpressureConfig>;
}): Promise<BackpressureAdmit> {
  const cfg: BackpressureConfig = { ...DEFAULTS, ...(input.config ?? {}) };

  const depth = await getQueueDepth();
  const queuedGlobal = depth.queued;

  // Global hard cap
  if (queuedGlobal >= cfg.globalQueueHardCap) {
    return {
      admit: false,
      reason: "global_hard_cap",
      queuedGlobal,
      queuedForAccount: 0,
      retryAfterSeconds: Math.max(5, Math.round(depth.oldestQueuedSeconds || 30)),
    };
  }

  // Per-account fairness
  let queuedForAccount = 0;
  if (input.account_id) {
    const { count, error } = await nexSupabaseAdmin
      .from("nex_generation_job")
      .select("id", { count: "exact", head: true })
      .eq("requester_account_id", input.account_id)
      .eq("status", "queued");
    if (error) throw new Error(`backpressure.perAccountCount: ${error.message}`);
    queuedForAccount = count ?? 0;
    if (queuedForAccount >= cfg.maxQueuedPerAccount) {
      return {
        admit: false,
        reason: "per_account_limit",
        queuedGlobal,
        queuedForAccount,
        retryAfterSeconds: 10,
      };
    }
  }

  return {
    admit: true,
    reason: "ok",
    queuedGlobal,
    queuedForAccount,
  };
}

export interface CapacitySignal {
  status: "healthy" | "warm" | "hot" | "overloaded";
  queuedGlobal: number;
  leasedGlobal: number;
  oldestQueuedSeconds: number;
  config: BackpressureConfig;
}

/**
 * Snapshot of current pressure · exposed to Founder/HQ engineering
 * surfaces so operators can decide to scale workers or investigate.
 */
export async function getCapacitySignal(): Promise<CapacitySignal> {
  const depth = await getQueueDepth();
  let status: CapacitySignal["status"] = "healthy";
  if (depth.queued >= DEFAULTS.globalQueueHardCap) status = "overloaded";
  else if (depth.queued >= DEFAULTS.globalQueueSoftCap) status = "hot";
  else if (
    depth.queued > DEFAULTS.globalQueueSoftCap / 2 ||
    depth.oldestQueuedSeconds > DEFAULTS.oldestQueuedWarnSeconds
  )
    status = "warm";
  return {
    status,
    queuedGlobal: depth.queued,
    leasedGlobal: depth.leased,
    oldestQueuedSeconds: depth.oldestQueuedSeconds,
    config: DEFAULTS,
  };
}
