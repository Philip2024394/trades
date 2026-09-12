// src/lib/nex/live-chat-completion/governors.ts
//
// Founder BEGIN Phase 2 · Storage & Generation governors.
//
// §17 · Storage discipline. §18 · Generation control.
//
// Every worker consults these before it decides "generate more" or
// "verify more". Rulebook thresholds are read from nex.master_rulebook.
// A governor NEVER writes to storage · it just returns pause/proceed.

import type { Pool } from "pg";

export interface StorageBudget {
  pause_generation: boolean;
  reason: string;
  db_size_bytes: number;
  db_size_bytes_delta_since_last_check: number | null;
  ms: number;
}

/**
 * Cheap: read pg_database_size once per call. Compare to previous reading
 * held in a module-local. If growth in the interval exceeds the rulebook
 * bytes/hour threshold, return pause.
 */
let _lastReading: { bytes: number; at: number } | null = null;

export async function checkStorageBudget(
  kfPool: Pool,
  domain: string,
): Promise<StorageBudget> {
  const t0 = performance.now();
  const nowMs = Date.now();
  try {
    const sizeRes = await kfPool.query(`SELECT pg_database_size(current_database())::bigint AS n`);
    const bytes = Number(sizeRes.rows[0].n);
    const rulebook = await kfPool.query(
      `SELECT storage_growth_bytes_per_hour_threshold::bigint AS thresh FROM nex.master_rulebook WHERE domain = $1`,
      [domain],
    );
    const thresh = rulebook.rowCount > 0
      ? Number(rulebook.rows[0].thresh)
      : 104_857_600;

    let delta: number | null = null;
    let pause = false;
    let reason = "ok";
    if (_lastReading) {
      const hoursElapsed = (nowMs - _lastReading.at) / (3600 * 1000);
      const growth = bytes - _lastReading.bytes;
      delta = growth;
      if (hoursElapsed > 0.01) {
        const growthPerHour = growth / hoursElapsed;
        if (growthPerHour > thresh) {
          pause = true;
          reason = `storage_growth ${Math.round(growthPerHour / 1024)} KB/hr > threshold ${Math.round(thresh / 1024)} KB/hr`;
        }
      }
    }
    _lastReading = { bytes, at: nowMs };
    return {
      pause_generation: pause,
      reason,
      db_size_bytes: bytes,
      db_size_bytes_delta_since_last_check: delta,
      ms: Math.round(performance.now() - t0),
    };
  } catch (e) {
    return {
      pause_generation: false,
      reason: `storage_check_failed:${e instanceof Error ? e.message : String(e)}`,
      db_size_bytes: -1,
      db_size_bytes_delta_since_last_check: null,
      ms: Math.round(performance.now() - t0),
    };
  }
}

export interface GenerationBudget {
  pause_generation: boolean;
  reason: string;
  duplicate_rate_pct: number;
}

/**
 * If the LAST batch's dedup rate (updated / total) exceeds the rulebook
 * threshold, pause generation. Signals that we're re-generating the same
 * variants and should broaden phrasing templates instead of grinding.
 */
export function checkGenerationBudget(input: {
  batch_inserted: number;
  batch_updated: number;
  rulebook_threshold_pct: number;
}): GenerationBudget {
  const total = input.batch_inserted + input.batch_updated;
  const dupPct = total === 0 ? 0 : (input.batch_updated / total) * 100;
  if (dupPct > input.rulebook_threshold_pct) {
    return {
      pause_generation: true,
      reason: `duplicate_rate ${dupPct.toFixed(1)}% > threshold ${input.rulebook_threshold_pct}%`,
      duplicate_rate_pct: dupPct,
    };
  }
  return {
    pause_generation: false,
    reason: "ok",
    duplicate_rate_pct: dupPct,
  };
}
