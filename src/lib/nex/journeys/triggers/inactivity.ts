// Trigger evaluator · inactivity
//
// Config: { days: number; segment_id?: string }
// Fires for contacts who have no `opened` OR `clicked` event within the
// past `days` days. Optionally scoped to a segment.

import { withClient } from "@/lib/nex/delivery/db";
import type { EvalContext, JourneyTriggerEvent } from "./types";

export async function evaluateInactivity(ctx: EvalContext): Promise<JourneyTriggerEvent[]> {
  const cfg = ctx.trigger.trigger_config as { days?: number; segment_id?: string };
  const days = Math.max(1, Number(cfg.days ?? 90));
  const cutoff = new Date(ctx.now.getTime() - days * 86400_000).toISOString();

  const rows = await withClient(async (c) => {
    let segmentFilter = "";
    const params: unknown[] = [cutoff, ctx.trigger.journey_id];
    if (cfg.segment_id) {
      params.push(cfg.segment_id);
      segmentFilter = `AND EXISTS (
        SELECT 1 FROM nex.contact_segments cs WHERE cs.segment_id = $${params.length} AND cs.archived_at IS NULL
      )`;
    }
    const res = await c.query(
      `WITH canonical AS (
         SELECT DISTINCT ON (contact_id) * FROM nex.contacts ORDER BY contact_id, updated_at DESC
       )
       SELECT c.contact_id
       FROM canonical c
       WHERE c.deleted_at IS NULL
         AND c.canonical_email IS NOT NULL
         AND c.compliance_state = 'allowed'
         AND NOT EXISTS (
           SELECT 1 FROM nex.analytics_events ae
           WHERE ae.recipient_id = c.contact_id
             AND ae.event_type IN ('opened','clicked')
             AND ae.event_timestamp > $1::timestamptz
         )
         AND NOT EXISTS (SELECT 1 FROM nex.journey_states js WHERE js.journey_id = $2 AND js.contact_id = c.contact_id)
         ${segmentFilter}
       LIMIT 5000`,
      params,
    );
    return res.rows.map((r0) => String(r0.contact_id));
  });

  const now = ctx.now.toISOString();
  return (rows ?? []).map((contact_id) => ({
    trigger_id: ctx.trigger.trigger_id,
    trigger_type: "inactivity" as const,
    journey_id: ctx.trigger.journey_id,
    contact_id,
    event_time: now,
    payload: { inactive_days: days, segment_id: cfg.segment_id ?? null },
    correlation_id: `${ctx.tick_id}:inactivity:${contact_id}`,
    causation_id: `tick:${ctx.tick_id}`,
  }));
}
