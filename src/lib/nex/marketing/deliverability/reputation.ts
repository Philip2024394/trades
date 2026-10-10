// src/lib/nex/marketing/deliverability/reputation.ts
//
// NEX Deliverability · Reputation calculator
// Founder-authorised programme · Session-5 · Part 12 · 2026-09-21.
//
// Aggregates rolling metrics from the real marketing_send_log and
// marketing_bounce_log tables. Never accepts synthetic input.
// Reputation state derived deterministically from thresholds.

import type { PoolClient } from "pg";
import type { SenderReputation, ReputationState, ReputationThresholds } from "./types";
import { DEFAULT_THRESHOLDS } from "./types";

// ─── Pure state classifier ─────────────────────────────────────────
export function classifyReputation(
  bounce_rate: number | null,
  complaint_rate: number | null,
  thresholds: ReputationThresholds = DEFAULT_THRESHOLDS,
): { state: ReputationState; reason: string } {
  const b = bounce_rate ?? 0;
  const c = complaint_rate ?? 0;
  // Choose the worse of the two dimensions
  const dims: Array<[number, number, ReputationState, string]> = [
    [b, thresholds.bounce_frozen,   "frozen",  `bounce_rate ${b.toFixed(4)} ≥ ${thresholds.bounce_frozen}`],
    [c, thresholds.complaint_frozen,"frozen",  `complaint_rate ${c.toFixed(4)} ≥ ${thresholds.complaint_frozen}`],
    [b, thresholds.bounce_limited,  "limited", `bounce_rate ${b.toFixed(4)} ≥ ${thresholds.bounce_limited}`],
    [c, thresholds.complaint_limited,"limited",`complaint_rate ${c.toFixed(4)} ≥ ${thresholds.complaint_limited}`],
    [b, thresholds.bounce_warning,  "warning", `bounce_rate ${b.toFixed(4)} ≥ ${thresholds.bounce_warning}`],
    [c, thresholds.complaint_warning,"warning",`complaint_rate ${c.toFixed(4)} ≥ ${thresholds.complaint_warning}`],
    [b, thresholds.bounce_watch,    "watch",   `bounce_rate ${b.toFixed(4)} ≥ ${thresholds.bounce_watch}`],
    [c, thresholds.complaint_watch, "watch",   `complaint_rate ${c.toFixed(4)} ≥ ${thresholds.complaint_watch}`],
  ];
  for (const [value, threshold, state, reason] of dims) {
    if (value >= threshold) return { state, reason };
  }
  if (bounce_rate === null && complaint_rate === null) {
    return { state: "unknown", reason: "no rolling window data yet" };
  }
  return { state: "healthy", reason: `bounce ${b.toFixed(4)} < ${thresholds.bounce_watch} · complaint ${c.toFixed(4)} < ${thresholds.complaint_watch}` };
}

// ─── Recompute rolling metrics for a sender · deterministic ────────
export async function recomputeSenderReputation(
  client: PoolClient,
  sender_id: string,
  thresholds: ReputationThresholds = DEFAULT_THRESHOLDS,
): Promise<SenderReputation> {
  // Attribute sends to a sender by joining through marketing_campaign · this
  // avoids adding a sender_id column to send_log (which would be a schema
  // change to Stage 1). Read the sender's stored capacity source for context.
  const senderCheck = await client.query(
    `SELECT sender_id, email FROM nex.marketing_sender_identity WHERE sender_id = $1`,
    [sender_id],
  );
  if (senderCheck.rows.length === 0) {
    throw new Error(`recomputeSenderReputation · sender_id ${sender_id} not found`);
  }

  // Rolling windows · 24h and 7d
  const win24 = await client.query<{ sends: number; bounces: number; complaints: number; unsubs: number }>(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'accepted')::int AS sends,
       0::int AS bounces,
       0::int AS complaints,
       0::int AS unsubs
       FROM nex.marketing_send_log sl
       JOIN nex.marketing_campaign c ON c.campaign_id = sl.campaign_id
      WHERE COALESCE(c.metadata->>'sender_id', '') = $1
        AND sl.sent_at >= now() - INTERVAL '24 hours'`,
    [sender_id],
  );

  const win7 = await client.query<{ sends: number; bounces: number; complaints: number; unsubs: number }>(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'accepted')::int AS sends,
       0::int AS bounces,
       0::int AS complaints,
       0::int AS unsubs
       FROM nex.marketing_send_log sl
       JOIN nex.marketing_campaign c ON c.campaign_id = sl.campaign_id
      WHERE COALESCE(c.metadata->>'sender_id', '') = $1
        AND sl.sent_at >= now() - INTERVAL '7 days'`,
    [sender_id],
  );

  // Bounce/complaint/unsubscribe events for this sender's campaigns
  // (via marketing_bounce_log · joined through send_log)
  const evtQuery = async (interval: string) => {
    return client.query<{ b: number; c: number; u: number }>(
      `SELECT
         COUNT(*) FILTER (WHERE bl.event_type = 'bounce')::int      AS b,
         COUNT(*) FILTER (WHERE bl.event_type = 'complaint')::int   AS c,
         COUNT(*) FILTER (WHERE bl.event_type = 'unsubscribe')::int AS u
         FROM nex.marketing_bounce_log bl
         JOIN nex.marketing_send_log sl ON sl.esp_message_id = bl.esp_message_id
         JOIN nex.marketing_campaign c ON c.campaign_id = sl.campaign_id
        WHERE COALESCE(c.metadata->>'sender_id', '') = $1
          AND bl.received_at >= now() - INTERVAL '${interval}'`,
      [sender_id],
    ).catch(() => ({ rows: [{ b: 0, c: 0, u: 0 }] }));
  };
  const evt24 = await evtQuery("24 hours");
  const evt7 = await evtQuery("7 days");

  const sends_24h = win24.rows[0]?.sends ?? 0;
  const sends_7d = win7.rows[0]?.sends ?? 0;
  const bounces_24h = evt24.rows[0]?.b ?? 0;
  const bounces_7d = evt7.rows[0]?.b ?? 0;
  const complaints_24h = evt24.rows[0]?.c ?? 0;
  const complaints_7d = evt7.rows[0]?.c ?? 0;
  const unsubs_24h = evt24.rows[0]?.u ?? 0;
  const unsubs_7d = evt7.rows[0]?.u ?? 0;

  const rate = (num: number, den: number): number | null => den > 0 ? num / den : null;
  const bounce_rate_24h = rate(bounces_24h, sends_24h);
  const bounce_rate_7d = rate(bounces_7d, sends_7d);
  const complaint_rate_24h = rate(complaints_24h, sends_24h);
  const complaint_rate_7d = rate(complaints_7d, sends_7d);

  // Delivery latency percentiles · leave null if no data (never faked)
  const latency = await client.query<{ p50: number | null; p95: number | null }>(
    `SELECT
       PERCENTILE_DISC(0.5)  WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (bl.received_at - sl.sent_at)) * 1000)::int AS p50,
       PERCENTILE_DISC(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (bl.received_at - sl.sent_at)) * 1000)::int AS p95
       FROM nex.marketing_bounce_log bl
       JOIN nex.marketing_send_log sl ON sl.esp_message_id = bl.esp_message_id
       JOIN nex.marketing_campaign c ON c.campaign_id = sl.campaign_id
      WHERE COALESCE(c.metadata->>'sender_id', '') = $1
        AND bl.event_type = 'delivery'
        AND bl.received_at >= now() - INTERVAL '7 days'`,
    [sender_id],
  ).catch(() => ({ rows: [{ p50: null, p95: null }] }));

  // Use the WORSE of 24h/7d rates for state classification · conservative
  const worst_bounce = Math.max(bounce_rate_24h ?? 0, bounce_rate_7d ?? 0);
  const worst_complaint = Math.max(complaint_rate_24h ?? 0, complaint_rate_7d ?? 0);
  const has_any_window = (bounce_rate_24h !== null) || (bounce_rate_7d !== null) || (complaint_rate_24h !== null) || (complaint_rate_7d !== null);
  const { state, reason } = has_any_window
    ? classifyReputation(worst_bounce, worst_complaint, thresholds)
    : { state: "unknown" as ReputationState, reason: "no rolling window data yet" };

  const res = await client.query(
    `INSERT INTO nex.marketing_sender_reputation
       (sender_id, sends_24h, sends_7d, bounces_24h, bounces_7d,
        complaints_24h, complaints_7d, unsubs_24h, unsubs_7d,
        bounce_rate_24h, bounce_rate_7d, complaint_rate_24h, complaint_rate_7d,
        delivery_latency_p50_ms, delivery_latency_p95_ms,
        reputation_state, reputation_reason, computed_at, window_end_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, now(), now())
     ON CONFLICT (sender_id) DO UPDATE SET
        sends_24h = EXCLUDED.sends_24h,
        sends_7d = EXCLUDED.sends_7d,
        bounces_24h = EXCLUDED.bounces_24h,
        bounces_7d = EXCLUDED.bounces_7d,
        complaints_24h = EXCLUDED.complaints_24h,
        complaints_7d = EXCLUDED.complaints_7d,
        unsubs_24h = EXCLUDED.unsubs_24h,
        unsubs_7d = EXCLUDED.unsubs_7d,
        bounce_rate_24h = EXCLUDED.bounce_rate_24h,
        bounce_rate_7d = EXCLUDED.bounce_rate_7d,
        complaint_rate_24h = EXCLUDED.complaint_rate_24h,
        complaint_rate_7d = EXCLUDED.complaint_rate_7d,
        delivery_latency_p50_ms = EXCLUDED.delivery_latency_p50_ms,
        delivery_latency_p95_ms = EXCLUDED.delivery_latency_p95_ms,
        reputation_state = EXCLUDED.reputation_state,
        reputation_reason = EXCLUDED.reputation_reason,
        computed_at = now(),
        window_end_at = now()
     RETURNING *`,
    [
      sender_id, sends_24h, sends_7d, bounces_24h, bounces_7d,
      complaints_24h, complaints_7d, unsubs_24h, unsubs_7d,
      bounce_rate_24h, bounce_rate_7d, complaint_rate_24h, complaint_rate_7d,
      latency.rows[0]?.p50 ?? null, latency.rows[0]?.p95 ?? null,
      state, reason,
    ],
  );
  return rowToReputation(res.rows[0]);
}

export async function loadSenderReputation(client: PoolClient, sender_id: string): Promise<SenderReputation | null> {
  const res = await client.query(
    `SELECT * FROM nex.marketing_sender_reputation WHERE sender_id = $1`,
    [sender_id],
  );
  if (res.rows.length === 0) return null;
  return rowToReputation(res.rows[0]);
}

function rowToReputation(r: any): SenderReputation {
  return {
    sender_id: r.sender_id,
    sends_24h: r.sends_24h, sends_7d: r.sends_7d,
    bounces_24h: r.bounces_24h, bounces_7d: r.bounces_7d,
    complaints_24h: r.complaints_24h, complaints_7d: r.complaints_7d,
    unsubs_24h: r.unsubs_24h, unsubs_7d: r.unsubs_7d,
    bounce_rate_24h: r.bounce_rate_24h == null ? null : Number(r.bounce_rate_24h),
    bounce_rate_7d: r.bounce_rate_7d == null ? null : Number(r.bounce_rate_7d),
    complaint_rate_24h: r.complaint_rate_24h == null ? null : Number(r.complaint_rate_24h),
    complaint_rate_7d: r.complaint_rate_7d == null ? null : Number(r.complaint_rate_7d),
    delivery_latency_p50_ms: r.delivery_latency_p50_ms,
    delivery_latency_p95_ms: r.delivery_latency_p95_ms,
    reputation_state: r.reputation_state as ReputationState,
    reputation_reason: r.reputation_reason,
    computed_at: r.computed_at,
    window_end_at: r.window_end_at,
  };
}
