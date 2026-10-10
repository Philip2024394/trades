// src/lib/nex/marketing/sender-pool/capacity.ts
//
// NEX Managed Email Marketing · Stage 2 · Capacity engine
// Founder-authorised programme (Clauses 8 + 10 hard-locked).
//
// PURE compute + PostgreSQL persistence. Concurrent-safe via:
//   INSERT ... ON CONFLICT DO UPDATE ... WHERE send_count + 1 <= limit
//   RETURNING send_count
//
// If the conditional UPDATE returns no rows · capacity was exhausted between
// availability check and increment · caller must WAIT / QUEUE · never rotate
// to a different sender specifically to bypass this limit (Clause 8).

import type { PoolClient } from "pg";
import type { SenderCapacity, SenderIdentity } from "./types";
import { CapacityEvasionAttemptError } from "./types";

// ─── Window computation (pure · UTC-based · timezone-independent) ──
export function currentWindowStart(kind: "hour" | "day", now: Date = new Date()): Date {
  const d = new Date(now);
  d.setUTCMinutes(0, 0, 0);
  if (kind === "day") d.setUTCHours(0, 0, 0, 0);
  return d;
}

// ─── Read current capacity view ────────────────────────────────────
export async function loadCapacity(
  client: PoolClient,
  sender: Pick<SenderIdentity, "sender_id" | "hourly_capacity" | "daily_capacity">,
  now: Date = new Date(),
): Promise<SenderCapacity> {
  const hour_start = currentWindowStart("hour", now).toISOString();
  const day_start = currentWindowStart("day", now).toISOString();

  const res = await client.query<{ window_kind: string; send_count: number }>(
    `SELECT window_kind, send_count
       FROM nex.marketing_sender_capacity_window
      WHERE sender_id = $1
        AND (
          (window_kind = 'hour' AND window_start = $2) OR
          (window_kind = 'day'  AND window_start = $3)
        )`,
    [sender.sender_id, hour_start, day_start],
  );

  let hourly_used = 0;
  let daily_used = 0;
  for (const row of res.rows) {
    if (row.window_kind === "hour") hourly_used = row.send_count;
    else if (row.window_kind === "day") daily_used = row.send_count;
  }

  const hourly_remaining = sender.hourly_capacity == null ? null : Math.max(0, sender.hourly_capacity - hourly_used);
  const daily_remaining = sender.daily_capacity == null ? null : Math.max(0, sender.daily_capacity - daily_used);

  const remainings = [hourly_remaining, daily_remaining].filter((v): v is number => v != null);
  const effective_remaining = remainings.length === 0 ? null : Math.min(...remainings);

  return {
    sender_id: sender.sender_id,
    hourly_limit: sender.hourly_capacity,
    hourly_used,
    hourly_remaining,
    daily_limit: sender.daily_capacity,
    daily_used,
    daily_remaining,
    effective_remaining,
  };
}

// ─── Concurrency-safe capacity increment ───────────────────────────
// Returns { ok: true, hourly_used, daily_used } on success · or
// { ok: false, reason } if capacity would be exceeded.

export interface CapacityConsumeResult {
  readonly ok: boolean;
  readonly hourly_used?: number;
  readonly daily_used?: number;
  readonly reason?: string;
}

export async function consumeCapacity(
  client: PoolClient,
  sender: Pick<SenderIdentity, "sender_id" | "hourly_capacity" | "daily_capacity">,
  now: Date = new Date(),
): Promise<CapacityConsumeResult> {
  const hour_start = currentWindowStart("hour", now).toISOString();
  const day_start = currentWindowStart("day", now).toISOString();

  // Increment hour window · conditional UPDATE bounded by limit
  // If hourly_capacity IS NULL · treat as unlimited (still record for observability)
  const hour_res = await client.query<{ send_count: number }>(
    `INSERT INTO nex.marketing_sender_capacity_window (sender_id, window_kind, window_start, send_count, updated_at)
     VALUES ($1, 'hour', $2, 1, now())
     ON CONFLICT (sender_id, window_kind, window_start)
       DO UPDATE SET send_count = nex.marketing_sender_capacity_window.send_count + 1, updated_at = now()
       WHERE $3::integer IS NULL OR nex.marketing_sender_capacity_window.send_count < $3::integer
     RETURNING send_count`,
    [sender.sender_id, hour_start, sender.hourly_capacity],
  );
  if (hour_res.rowCount === 0) {
    return { ok: false, reason: "hourly_capacity_exhausted" };
  }
  const hourly_used = hour_res.rows[0].send_count;

  // Increment day window · same pattern
  const day_res = await client.query<{ send_count: number }>(
    `INSERT INTO nex.marketing_sender_capacity_window (sender_id, window_kind, window_start, send_count, updated_at)
     VALUES ($1, 'day', $2, 1, now())
     ON CONFLICT (sender_id, window_kind, window_start)
       DO UPDATE SET send_count = nex.marketing_sender_capacity_window.send_count + 1, updated_at = now()
       WHERE $3::integer IS NULL OR nex.marketing_sender_capacity_window.send_count < $3::integer
     RETURNING send_count`,
    [sender.sender_id, day_start, sender.daily_capacity],
  );
  if (day_res.rowCount === 0) {
    // Rollback the hour increment · we didn't send · capacity should not be consumed
    await client.query(
      `UPDATE nex.marketing_sender_capacity_window
          SET send_count = GREATEST(0, send_count - 1), updated_at = now()
        WHERE sender_id = $1 AND window_kind = 'hour' AND window_start = $2`,
      [sender.sender_id, hour_start],
    );
    return { ok: false, reason: "daily_capacity_exhausted" };
  }
  const daily_used = day_res.rows[0].send_count;

  return { ok: true, hourly_used, daily_used };
}

// ─── Refund capacity (send failed AFTER increment · rare · used by retry logic) ─
export async function refundCapacity(
  client: PoolClient,
  sender_id: string,
  now: Date = new Date(),
): Promise<void> {
  const hour_start = currentWindowStart("hour", now).toISOString();
  const day_start = currentWindowStart("day", now).toISOString();

  await client.query(
    `UPDATE nex.marketing_sender_capacity_window
        SET send_count = GREATEST(0, send_count - 1), updated_at = now()
      WHERE sender_id = $1 AND window_kind = 'hour' AND window_start = $2`,
    [sender_id, hour_start],
  );
  await client.query(
    `UPDATE nex.marketing_sender_capacity_window
        SET send_count = GREATEST(0, send_count - 1), updated_at = now()
      WHERE sender_id = $1 AND window_kind = 'day' AND window_start = $2`,
    [sender_id, day_start],
  );
}

// ─── Explicit refusal helper · surfaces the no-evasion rule ────────
export function assertNoLimitEvasion(caller: string, exhausted_sender_id: string, would_rotate_to: string | null): void {
  if (would_rotate_to && would_rotate_to !== exhausted_sender_id) {
    throw new CapacityEvasionAttemptError(
      `caller='${caller}' · exhausted sender ${exhausted_sender_id} · would rotate to ${would_rotate_to}. ` +
      `Clause 8: 'A sender pool MUST NOT be used to evade provider limits'. ` +
      `Rotation is only permitted when the alternate sender has legitimate available capacity of its own.`
    );
  }
}
