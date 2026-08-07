// Trigger evaluator · compliance_transition
//
// Config: { to_states: ComplianceState[]; since_seconds?: number }
// Fires when a contact's compliance state transitions INTO one of the
// configured states.

import { withClient } from "@/lib/nex/delivery/db";
import type { EvalContext, JourneyTriggerEvent } from "./types";

export async function evaluateComplianceTransition(ctx: EvalContext): Promise<JourneyTriggerEvent[]> {
  const cfg = ctx.trigger.trigger_config as { to_states?: string[]; since_seconds?: number };
  const targets = Array.isArray(cfg.to_states) ? cfg.to_states.map(String) : [];
  if (targets.length === 0) return [];
  const window = Math.max(60, Number(cfg.since_seconds ?? 3600));
  const since = new Date(ctx.now.getTime() - window * 1000).toISOString();
  const cutoff = ctx.trigger.last_fired_at && new Date(ctx.trigger.last_fired_at).getTime() > new Date(since).getTime()
    ? ctx.trigger.last_fired_at
    : since;

  const rows = await withClient(async (c) => {
    const placeholders = targets.map((_, i) => `$${i + 3}`).join(",");
    const res = await c.query(
      `SELECT DISTINCT ON (ce.contact_id) ce.event_id, ce.contact_id, ce.new_state, ce.created_at
       FROM nex.compliance_events ce
       WHERE ce.created_at > $1::timestamptz
         AND ce.new_state = ANY(ARRAY[${placeholders}])
         AND NOT EXISTS (SELECT 1 FROM nex.journey_states js WHERE js.journey_id = $2 AND js.contact_id = ce.contact_id)
       ORDER BY ce.contact_id, ce.created_at DESC
       LIMIT 5000`,
      [cutoff, ctx.trigger.journey_id, ...targets],
    );
    return res.rows;
  });

  return (rows ?? []).map((r) => ({
    trigger_id: ctx.trigger.trigger_id,
    trigger_type: "compliance_transition" as const,
    journey_id: ctx.trigger.journey_id,
    contact_id: String(r.contact_id),
    event_time: String(r.created_at),
    payload: { new_state: String(r.new_state), source_compliance_event_id: String(r.event_id) },
    correlation_id: `compliance:${String(r.event_id)}`,
    causation_id: `compliance_event:${String(r.event_id)}`,
  }));
}
