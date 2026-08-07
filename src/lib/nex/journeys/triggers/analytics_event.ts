// Trigger evaluator · analytics_event
//
// Config: { event_type: EventType; campaign_id?: string; since_seconds?: number }
// Fires when a contact records a matching canonical analytics event.
// Reads only nex.analytics_events. Never mutates anything.

import { withClient } from "@/lib/nex/delivery/db";
import type { EvalContext, JourneyTriggerEvent } from "./types";

export async function evaluateAnalyticsEvent(ctx: EvalContext): Promise<JourneyTriggerEvent[]> {
  const cfg = ctx.trigger.trigger_config as { event_type?: string; campaign_id?: string; since_seconds?: number };
  const event_type = String(cfg.event_type ?? "");
  if (!event_type) return [];
  const window = Math.max(60, Number(cfg.since_seconds ?? 3600));
  const since = new Date(ctx.now.getTime() - window * 1000).toISOString();

  // Only fire for events NEWER than the trigger's last_fired_at (so we
  // don't re-fire for the same historical events after every tick).
  const cutoff = ctx.trigger.last_fired_at && new Date(ctx.trigger.last_fired_at).getTime() > new Date(since).getTime()
    ? ctx.trigger.last_fired_at
    : since;

  const rows = await withClient(async (c) => {
    const params: unknown[] = [event_type, cutoff, ctx.trigger.journey_id];
    const campaignClause = cfg.campaign_id ? `AND ae.campaign_id = $${params.push(cfg.campaign_id)}` : "";
    const res = await c.query(
      `SELECT DISTINCT ON (ae.recipient_id) ae.event_id, ae.recipient_id, ae.event_timestamp, ae.campaign_id
       FROM nex.analytics_events ae
       WHERE ae.event_type = $1
         AND ae.event_timestamp > $2::timestamptz
         AND ae.recipient_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM nex.journey_states js WHERE js.journey_id = $3 AND js.contact_id = ae.recipient_id)
         ${campaignClause}
       ORDER BY ae.recipient_id, ae.event_timestamp DESC
       LIMIT 5000`,
      params,
    );
    return res.rows;
  });

  return (rows ?? []).map((r) => ({
    trigger_id: ctx.trigger.trigger_id,
    trigger_type: "analytics_event" as const,
    journey_id: ctx.trigger.journey_id,
    contact_id: String(r.recipient_id),
    event_time: String(r.event_timestamp),
    payload: { event_type, source_event_id: String(r.event_id), source_campaign_id: r.campaign_id ?? null },
    correlation_id: `analytics:${String(r.event_id)}`,
    causation_id: `analytics_event:${String(r.event_id)}`,
  }));
}
