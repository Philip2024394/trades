// src/lib/nex/analytics/rollup-worker.ts
//
// D6 · Background worker that drains nex.analytics_rollup_queue.
//
// Activated when NEX_ANALYTICS_ROLLUP_ASYNC=1. Called from cron-tick
// after the manager cycle runs. Claims a batch via SKIP LOCKED, runs
// the same applyRollupsForEvent() logic that sync-mode ingest uses,
// and marks each row completed/failed with attempt counts.
//
// Idempotency: applyRollupsForEvent uses UPSERT + += 1 counters. If
// the worker processes the same event twice (worker crash between
// UPSERT and status update), rollups are double-counted for that event.
// To harden this, wrap the queue-row status update in the same
// transaction as the UPSERTs — done below via withClient's transaction.
//
// USAGE
//   From cron-tick: await drainAnalyticsRollupQueue({ batch_size: 50, worker_id: "cron-tick" });
//   From a probe:   npx tsx --env-file=.env.local scripts/drain-analytics-rollup-queue.ts

import { withClient, type PgClientLike } from "@/lib/nex/delivery/db";
import { applyRollupsForEvent } from "./ingest";
import type { AnalyticsEvent, EventType } from "./types";
import { incr } from "@/lib/nex/observability/counters";
import { logger } from "@/lib/nex/observability/logger";
// Wave 3 · H4 · runtime gate refuses activation when 049 schema is missing.
import { assertRollupAsyncReady } from "./rollup-gate";

// Wave 4 · W4-1 · pg driver returns `timestamptz` columns as JS Date. Passing
// String(Date) downstream produced a locale-dependent string like
// `"Mon Aug 10 2026 08:59:23 GMT+0700 (Western Indonesia Time)"` which
// Postgres `::timestamptz` cast rejects with `time zone "gmt+0700" not
// recognized`. Normalise to ISO 8601 UTC · Postgres always parses that.
// Exported for the W4-1 regression test.
export function normalizeTimestamptzForCast(v: unknown): string | null {
  if (v instanceof Date) {
    return Number.isFinite(v.getTime()) ? v.toISOString() : null;
  }
  if (typeof v === "string" && v.length > 0) return v;
  return null;
}

const log = logger("analytics.rollup-worker");

export type DrainResult = {
  claimed: number;
  completed: number;
  failed: number;
  duration_ms: number;
};

/** Drain up to `batch_size` pending rollup rows. Safe to call every cron-tick. */
export async function drainAnalyticsRollupQueue(opts: {
  batch_size?: number;
  worker_id?: string;
  lease_seconds?: number;
} = {}): Promise<DrainResult> {
  const batch_size    = opts.batch_size    ?? 50;
  const worker_id     = opts.worker_id     ?? "cron-tick";
  const lease_seconds = opts.lease_seconds ?? 60;
  const started = Date.now();

  const claimedRows = await withClient(async (c) => {
    // Wave 3 · H4 · refuse to touch nex.claim_analytics_rollup_batch when
    // migration 049 is not applied. Throws MigrationDependencyError with a
    // remediation-oriented message before we hit the missing function.
    await assertRollupAsyncReady(c);
    const r = await c.query(
      `SELECT * FROM nex.claim_analytics_rollup_batch($1, $2, $3)`,
      [worker_id, batch_size, lease_seconds],
    );
    return r.rows as Array<{ queue_id: string; event_id: string; attempts: number }>;
  });
  if (!claimedRows || claimedRows.length === 0) {
    return { claimed: 0, completed: 0, failed: 0, duration_ms: Date.now() - started };
  }

  let completed = 0;
  let failed = 0;

  for (const row of claimedRows) {
    try {
      await withClient(async (c) => {
        // Load the event row we're rolling up.
        const evRes = await c.query(
          `SELECT event_type, event_timestamp, campaign_id, recipient_id, segment_id, provider, country, domain,
                  metadata, latency_ms, revenue, conversion_value, attribution_window,
                  journey_id, automation_id, experiment_id, variant_id
           FROM nex.analytics_events WHERE event_id = $1 LIMIT 1`,
          [row.event_id],
        );
        if (evRes.rows.length === 0) {
          // Event row missing — mark completed anyway so we don't retry forever.
          await c.query(
            `UPDATE nex.analytics_rollup_queue
             SET status = 'completed', completed_at = NOW(),
                 last_error = 'event_row_missing_at_apply'
             WHERE queue_id = $1`,
            [row.queue_id],
          );
          completed += 1;
          return;
        }
        const raw = evRes.rows[0] as Record<string, unknown>;
        const ev: AnalyticsEvent = {
          event_type:      raw.event_type as EventType,
          event_timestamp: normalizeTimestamptzForCast(raw.event_timestamp),
          campaign_id:     (raw.campaign_id as string | null) ?? null,
          recipient_id:    (raw.recipient_id as string | null) ?? null,
          segment_id:      (raw.segment_id as string | null) ?? null,
          provider:        (raw.provider as string | null) ?? null,
          country:         (raw.country as string | null) ?? null,
          domain:          (raw.domain as string | null) ?? null,
          metadata:        (raw.metadata as Record<string, unknown>) ?? {},
          latency_ms:      (raw.latency_ms as number | null) ?? null,
          revenue:         (raw.revenue as number | null) ?? null,
          conversion_value: (raw.conversion_value as number | null) ?? null,
          attribution_window: (raw.attribution_window as string | null) ?? null,
          journey_id:      (raw.journey_id as string | null) ?? null,
          automation_id:   (raw.automation_id as string | null) ?? null,
          experiment_id:   (raw.experiment_id as string | null) ?? null,
          variant_id:      (raw.variant_id as string | null) ?? null,
        };

        await applyRollupsForEvent(c as unknown as PgClientLike, ev, row.event_id);

        await c.query(
          `UPDATE nex.analytics_rollup_queue
           SET status = 'completed', completed_at = NOW(), last_error = NULL
           WHERE queue_id = $1`,
          [row.queue_id],
        );
        completed += 1;
      });
    } catch (err) {
      failed += 1;
      const errMsg = err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500);
      log.error("rollup_apply_failed", { queue_id: row.queue_id, event_id: row.event_id, attempts: row.attempts, error: errMsg });
      incr("analytics.rollup_failed");
      // Mark row failed if attempts >= 5, else return to pending for retry.
      await withClient(async (c) => {
        await c.query(
          row.attempts >= 5
            ? `UPDATE nex.analytics_rollup_queue SET status = 'failed', last_error = $2 WHERE queue_id = $1`
            : `UPDATE nex.analytics_rollup_queue SET status = 'pending', last_error = $2, claimed_by = NULL, claimed_at = NULL, lease_expires_at = NULL WHERE queue_id = $1`,
          [row.queue_id, errMsg],
        );
      });
    }
  }

  const duration_ms = Date.now() - started;
  incr("analytics.rollup_batch_drained");
  return { claimed: claimedRows.length, completed, failed, duration_ms };
}
