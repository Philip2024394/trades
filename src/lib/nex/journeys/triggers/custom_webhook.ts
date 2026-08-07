// Trigger evaluator · custom_webhook
//
// Config: { trigger_key: string }
//   The trigger config's trigger_key matches the URL slug that inbound
//   webhooks POST to. Multiple triggers on multiple journeys can share
//   the same trigger_key — one incoming event fans out to all matches.
//
// This evaluator drains VERIFIED unprocessed inbound events for its
// trigger_key. Unverified events remain in the table as audit rows but
// never fire triggers.

import { withClient } from "@/lib/nex/delivery/db";
import type { EvalContext, JourneyTriggerEvent } from "./types";

export async function evaluateCustomWebhook(ctx: EvalContext): Promise<JourneyTriggerEvent[]> {
  // The trigger's trigger_key column already carries this · pull URL slug
  // from config too for future flexibility (e.g. one trigger key handling
  // multiple URL slugs).
  const cfg = ctx.trigger.trigger_config as { trigger_key?: string };
  const trigger_key = cfg.trigger_key ?? ctx.trigger.trigger_key;
  if (!trigger_key) return [];

  const rows = await withClient(async (c) => {
    const res = await c.query(
      `SELECT ie.inbound_event_id, ie.contact_id, ie.received_at, ie.payload
       FROM nex.journey_inbound_events ie
       WHERE ie.trigger_key = $1
         AND ie.processed_at IS NULL
         AND ie.verified_signature = TRUE
         AND ie.contact_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM nex.journey_states js WHERE js.journey_id = $2 AND js.contact_id = ie.contact_id)
       ORDER BY ie.received_at ASC
       LIMIT 500`,
      [trigger_key, ctx.trigger.journey_id],
    );
    return res.rows;
  });

  return (rows ?? []).map((r) => ({
    trigger_id: ctx.trigger.trigger_id,
    trigger_type: "custom_webhook" as const,
    journey_id: ctx.trigger.journey_id,
    contact_id: String(r.contact_id),
    event_time: String(r.received_at),
    payload: { trigger_key, source_inbound_event_id: String(r.inbound_event_id), body: r.payload },
    correlation_id: `webhook:${String(r.inbound_event_id)}`,
    causation_id: `inbound_event:${String(r.inbound_event_id)}`,
  }));
}
