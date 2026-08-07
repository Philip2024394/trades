// Trigger evaluator · segment_join
//
// Config: { segment_id: string }
// Produces one envelope per newly-eligible contact who is NOT already
// in this journey. Idempotent · re-eval always safe.

import { withClient } from "@/lib/nex/delivery/db";
import type { EvalContext, JourneyTriggerEvent } from "./types";

export async function evaluateSegmentJoin(ctx: EvalContext): Promise<JourneyTriggerEvent[]> {
  const segment_id = String((ctx.trigger.trigger_config as { segment_id?: string }).segment_id ?? "");
  if (!segment_id) return [];

  // Load the segment's filter
  const filter = await withClient(async (c) => {
    const res = await c.query(`SELECT filter FROM nex.contact_segments WHERE segment_id = $1 AND archived_at IS NULL`, [segment_id]);
    return res.rows[0] ? (res.rows[0].filter as Record<string, unknown>) : null;
  });
  if (!filter) return [];

  // Read-only match · reuses the same allowed-only filter shape as the
  // Phase 5.1 entry helper. Only returns contacts NOT already in the journey.
  const rows = await withClient(async (c) => {
    const wheres: string[] = ["c.deleted_at IS NULL", "c.canonical_email IS NOT NULL", "c.compliance_state = 'allowed'"];
    const params: unknown[] = [ctx.trigger.journey_id];
    const push = (v: unknown) => { params.push(v); return `$${params.length}`; };

    const countries = filter.countries as string[] | undefined;
    if (Array.isArray(countries) && countries.length > 0) {
      wheres.push(`c.country = ANY(ARRAY[${countries.map((v) => push(v)).join(",")}])`);
    }
    const trades = filter.trades as string[] | undefined;
    if (Array.isArray(trades) && trades.length > 0) {
      wheres.push(`c.trade_categories ?| ARRAY[${trades.map((v) => push(v)).join(",")}]`);
    }
    if (typeof filter.consent_marketing === "boolean") {
      wheres.push(`c.consent_marketing = ${push(filter.consent_marketing)}`);
    }

    const res = await c.query(
      `WITH canonical AS (
         SELECT DISTINCT ON (contact_id) * FROM nex.contacts ORDER BY contact_id, updated_at DESC
       )
       SELECT c.contact_id
       FROM canonical c
       WHERE ${wheres.join(" AND ")}
         AND NOT EXISTS (SELECT 1 FROM nex.journey_states js WHERE js.journey_id = $1 AND js.contact_id = c.contact_id)
       LIMIT 5000`,
      params,
    );
    return res.rows.map((r0) => String(r0.contact_id));
  });

  const now = ctx.now.toISOString();
  return (rows ?? []).map((contact_id) => ({
    trigger_id: ctx.trigger.trigger_id,
    trigger_type: "segment_join" as const,
    journey_id: ctx.trigger.journey_id,
    contact_id,
    event_time: now,
    payload: { segment_id },
    correlation_id: `${ctx.tick_id}:segment_join:${segment_id}`,
    causation_id: `tick:${ctx.tick_id}`,
  }));
}
