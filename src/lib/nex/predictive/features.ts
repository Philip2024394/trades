// NEX Predictive · feature extraction · invariant #15
//
// Reads canonical analytics events + attribution outputs + journey/experiment
// state. Never reads or writes to delivery / compliance / provider tables.
// The returned FeatureVector is the frozen input_snapshot for a prediction.

import { withClient } from "@/lib/nex/db";
import type { FeatureVector } from "./types";

const EMPTY: FeatureVector = {
  opens_last_30d: 0,
  opens_last_7d: 0,
  clicks_last_30d: 0,
  clicks_last_7d: 0,
  sends_last_30d: 0,
  days_since_last_engagement: 9999,
  distinct_campaigns_engaged_30d: 0,
  attribution_conversions_ever: 0,
  attributed_value_ever: 0,
  active_experiments: 0,
  in_journey: 0,
  tenure_days: 0,
};

export async function extractContactFeatures(contact_id: string, nowIso?: string): Promise<{
  features: FeatureVector;
  refs: { contact_id: string; last_event_timestamp?: string };
}> {
  const now = nowIso ? new Date(nowIso) : new Date();
  const nowSql = now.toISOString();
  const r = await withClient(async (c) => {
    // Aggregate analytics-event features in one round trip.
    const evAgg = await c.query(
      `SELECT
         COUNT(*) FILTER (WHERE event_type = 'opened'   AND event_timestamp <= $2::timestamptz AND event_timestamp > ($2::timestamptz - INTERVAL '30 days')) AS opens_30d,
         COUNT(*) FILTER (WHERE event_type = 'opened'   AND event_timestamp <= $2::timestamptz AND event_timestamp > ($2::timestamptz - INTERVAL '7 days'))  AS opens_7d,
         COUNT(*) FILTER (WHERE event_type = 'clicked'  AND event_timestamp <= $2::timestamptz AND event_timestamp > ($2::timestamptz - INTERVAL '30 days')) AS clicks_30d,
         COUNT(*) FILTER (WHERE event_type = 'clicked'  AND event_timestamp <= $2::timestamptz AND event_timestamp > ($2::timestamptz - INTERVAL '7 days'))  AS clicks_7d,
         COUNT(*) FILTER (WHERE event_type IN ('queued','delivered') AND event_timestamp <= $2::timestamptz AND event_timestamp > ($2::timestamptz - INTERVAL '30 days')) AS sends_30d,
         COUNT(DISTINCT campaign_id) FILTER (WHERE event_type IN ('opened','clicked') AND event_timestamp <= $2::timestamptz AND event_timestamp > ($2::timestamptz - INTERVAL '30 days')) AS distinct_campaigns_30d,
         MAX(event_timestamp) FILTER (WHERE event_type IN ('opened','clicked') AND event_timestamp <= $2::timestamptz) AS last_engagement,
         MIN(event_timestamp) AS first_seen
       FROM nex.analytics_events
       WHERE recipient_id = $1`,
      [contact_id, nowSql],
    );
    const ev = evAgg.rows[0] ?? {};

    // Attribution history — past conversions credited to this contact
    // across all models (we normalise using the last_touch view to avoid
    // triple-counting linear splits).
    const attr = await c.query(
      `SELECT
         COUNT(DISTINCT conversion_id)                             AS conversions_ever,
         COALESCE(SUM(attributed_value), 0)                        AS attributed_value_ever
       FROM nex.attributions
       WHERE contact_id = $1 AND model = 'last_touch'`,
      [contact_id],
    );

    // Journey state — one row per (journey, contact) — treat as in_journey
    // if there is any active/waiting journey for the contact.
    const jr = await c.query(
      `SELECT COUNT(*)::int AS active
         FROM nex.journey_states
        WHERE contact_id = $1 AND status IN ('active','waiting')`,
      [contact_id],
    );

    // Experiments — count of experiment assignments (past + current).
    const ex = await c.query(
      `SELECT COUNT(*)::int AS active
         FROM nex.experiment_assignments
        WHERE contact_id = $1`,
      [contact_id],
    );

    const num = (v: unknown): number => {
      if (typeof v === "number") return v;
      if (v == null) return 0;
      const n = Number(v);
      return isNaN(n) ? 0 : n;
    };

    const lastEng = ev.last_engagement as unknown;
    const lastEngIso = lastEng instanceof Date ? lastEng.toISOString() : lastEng ? String(lastEng) : undefined;
    const firstSeen = ev.first_seen as unknown;
    const firstSeenDate = firstSeen instanceof Date ? firstSeen : firstSeen ? new Date(String(firstSeen)) : null;

    const daysSince = lastEngIso
      ? Math.max(0, Math.floor((now.getTime() - new Date(lastEngIso).getTime()) / 86_400_000))
      : 9999;
    const tenure = firstSeenDate && !isNaN(firstSeenDate.getTime())
      ? Math.max(0, Math.floor((now.getTime() - firstSeenDate.getTime()) / 86_400_000))
      : 0;

    const features: FeatureVector = {
      opens_last_30d: num(ev.opens_30d),
      opens_last_7d: num(ev.opens_7d),
      clicks_last_30d: num(ev.clicks_30d),
      clicks_last_7d: num(ev.clicks_7d),
      sends_last_30d: num(ev.sends_30d),
      days_since_last_engagement: daysSince,
      distinct_campaigns_engaged_30d: num(ev.distinct_campaigns_30d),
      attribution_conversions_ever: num(attr.rows[0]?.conversions_ever),
      attributed_value_ever: num(attr.rows[0]?.attributed_value_ever),
      active_experiments: num(ex.rows[0]?.active),
      in_journey: num(jr.rows[0]?.active) > 0 ? 1 : 0,
      tenure_days: tenure,
    };
    return { features, refs: { contact_id, last_event_timestamp: lastEngIso } };
  });
  return r ?? { features: { ...EMPTY }, refs: { contact_id } };
}
