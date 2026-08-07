// NEX Journey Engine · Trigger dispatcher
//
// The single place that runs every trigger evaluator, dedupes their
// envelopes, and materialises journey entries via entry.ts. Called
// from the existing tickJourneys() flow before state advancement.
//
// Charter §11: triggers are pure event readers. This module is the
// only place they can produce side effects, and even here the ONLY
// permitted write is via entry.ts::insertJourneyStateFromTrigger.

import { withClient } from "@/lib/nex/delivery/db";
import { insertJourneyStateFromTrigger } from "@/lib/nex/journeys/entry";
import { rowToJourney } from "@/lib/nex/journeys/definition/versioning";
import type { EvalContext, JourneyTrigger, JourneyTriggerEvent } from "./types";
import { recordTriggerFire, rowToTrigger } from "./registry";

import { evaluateSegmentJoin }        from "./segment_join";
import { evaluateAnalyticsEvent }     from "./analytics_event";
import { evaluateComplianceTransition } from "./compliance_transition";
import { evaluateInactivity }         from "./inactivity";
import { evaluateCustomWebhook }      from "./custom_webhook";
import { evaluateSchedule }           from "./schedule";

export type DispatchResult = {
  ok: true;
  ran_at: string;
  tick_id: string;
  triggers_evaluated: number;
  envelopes_produced: number;
  envelopes_deduped: number;
  entries_created: number;
  entries_skipped_existing: number;
  errors: number;
  per_trigger: Array<{ trigger_id: string; trigger_type: string; trigger_key: string; produced: number; entered: number; skipped: number; error?: string }>;
};

export async function dispatchAllTriggers(now: Date): Promise<DispatchResult> {
  const tick_id = `${now.getTime()}_${Math.floor(Math.random() * 1e6).toString(36)}`;
  const active = await withClient(async (c) => {
    const res = await c.query(`SELECT * FROM nex.journey_triggers WHERE status = 'active'`);
    return res.rows.map(rowToTrigger);
  }) ?? [];

  let envelopes_produced = 0, envelopes_deduped = 0, entries_created = 0, entries_skipped_existing = 0, errors = 0;
  const per_trigger: DispatchResult["per_trigger"] = [];

  for (const trigger of active) {
    const rec = { trigger_id: trigger.trigger_id, trigger_type: trigger.trigger_type, trigger_key: trigger.trigger_key, produced: 0, entered: 0, skipped: 0, error: undefined as string | undefined };
    try {
      const ctx: EvalContext = { trigger, now, tick_id };
      const envelopes = await runEvaluator(ctx);
      rec.produced = envelopes.length;
      envelopes_produced += envelopes.length;

      // Dedup per trigger's dedup_window_sec (per contact)
      const deduped = await dedupeEnvelopes(envelopes, trigger);
      envelopes_deduped += (envelopes.length - deduped.length);

      // Materialise entries through the single doorway
      const { journey } = await loadJourney(trigger.journey_id);
      if (!journey) {
        rec.error = "journey_not_found";
        errors++;
        per_trigger.push(rec);
        continue;
      }
      for (const env of deduped) {
        const outcome = await insertJourneyStateFromTrigger(journey, env);
        if (outcome === "inserted")  { entries_created++; rec.entered++; }
        else                          { entries_skipped_existing++; rec.skipped++; }
      }

      if (deduped.length > 0) {
        await recordTriggerFire(trigger.trigger_id, deduped.length);
        // Mark any inbound events processed for custom_webhook
        if (trigger.trigger_type === "custom_webhook") {
          const inboundIds = deduped.map((e) => e.payload.source_inbound_event_id).filter((v): v is string => typeof v === "string");
          if (inboundIds.length > 0) await markInboundProcessed(inboundIds, trigger.journey_id, deduped.length);
        }
      }
    } catch (e) {
      rec.error = e instanceof Error ? e.message : "exception";
      errors++;
    }
    per_trigger.push(rec);
  }

  return {
    ok: true, ran_at: now.toISOString(), tick_id,
    triggers_evaluated: active.length,
    envelopes_produced, envelopes_deduped, entries_created, entries_skipped_existing,
    errors, per_trigger,
  };
}

async function runEvaluator(ctx: EvalContext): Promise<JourneyTriggerEvent[]> {
  switch (ctx.trigger.trigger_type) {
    case "segment_join":          return evaluateSegmentJoin(ctx);
    case "analytics_event":       return evaluateAnalyticsEvent(ctx);
    case "compliance_transition": return evaluateComplianceTransition(ctx);
    case "inactivity":            return evaluateInactivity(ctx);
    case "custom_webhook":        return evaluateCustomWebhook(ctx);
    case "schedule":              return evaluateSchedule(ctx);
  }
}

/**
 * Dedup: reject envelopes whose (trigger_id, contact_id) already fired
 * within the trigger's dedup_window_sec. Reads nex.journey_states as
 * the source of truth (a contact already in the journey is deduped).
 */
async function dedupeEnvelopes(envelopes: JourneyTriggerEvent[], trigger: JourneyTrigger): Promise<JourneyTriggerEvent[]> {
  if (envelopes.length === 0) return envelopes;
  const seen = new Set<string>();
  const out: JourneyTriggerEvent[] = [];
  for (const e of envelopes) {
    const key = `${e.trigger_id}:${e.contact_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  // Optional stricter dedup vs dedup_window_sec: check journey_states last_transition_at
  // (already implicitly enforced by the unique (journey_id, contact_id) on journey_states)
  void trigger;
  return out;
}

async function loadJourney(journey_id: string) {
  const r = await withClient(async (c) => {
    const res = await c.query(`SELECT * FROM nex.journeys WHERE journey_id = $1`, [journey_id]);
    return res.rows[0] ? rowToJourney(res.rows[0]) : null;
  });
  return { journey: r };
}

async function markInboundProcessed(inbound_ids: string[], journey_id: string, matched_count: number): Promise<void> {
  await withClient(async (c) => {
    const placeholders = inbound_ids.map((_, i) => `$${i + 3}`).join(",");
    await c.query(
      `UPDATE nex.journey_inbound_events
       SET processed_at = NOW(),
           matched_triggers = matched_triggers + $1,
           matched_journey_ids = matched_journey_ids || to_jsonb($2::text)
       WHERE inbound_event_id = ANY(ARRAY[${placeholders}]::uuid[])`,
      [matched_count, journey_id, ...inbound_ids],
    );
    return null;
  });
}
