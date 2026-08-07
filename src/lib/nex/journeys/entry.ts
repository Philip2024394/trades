// NEX Journey Engine · trigger / entry
//
// MVP trigger: contact joins segment · called manually via API OR
// periodically by the tick cron (5.1.2 will add scheduled sweeps +
// richer triggers).
//
// The entry function is idempotent: (journey_id, contact_id) is unique
// on nex.journey_states so re-entry is a no-op.

import { withClient } from "@/lib/nex/delivery/db";
import { rowToJourney } from "./definition/versioning";
import type { Journey } from "./types";

export type EntryResult = { ok: boolean; entered: number; skipped_existing: number; errors: string[] };

export async function enterSegmentContacts(journey_id: string): Promise<EntryResult> {
  const errors: string[] = [];
  const journey = await withClient(async (c) => {
    const res = await c.query(`SELECT * FROM nex.journeys WHERE journey_id = $1`, [journey_id]);
    return res.rows[0] ? rowToJourney(res.rows[0]) : null;
  });
  if (!journey) return { ok: false, entered: 0, skipped_existing: 0, errors: ["journey_not_found"] };
  if (journey.status !== "active") return { ok: false, entered: 0, skipped_existing: 0, errors: [`journey_not_active · status=${journey.status}`] };
  if (journey.trigger_type !== "segment_join") return { ok: false, entered: 0, skipped_existing: 0, errors: [`trigger_type=${journey.trigger_type} not supported in MVP`] };

  const segment_id = String((journey.trigger_config as Record<string, unknown>).segment_id ?? "");
  if (!segment_id) return { ok: false, entered: 0, skipped_existing: 0, errors: ["trigger_config.segment_id missing"] };

  // Fetch the segment's filter · we intentionally re-use the same
  // matching logic used by campaign expansion so behaviour is identical.
  const segment = await withClient(async (c) => {
    const res = await c.query(`SELECT filter FROM nex.contact_segments WHERE segment_id = $1 AND archived_at IS NULL`, [segment_id]);
    return res.rows[0] ? (res.rows[0].filter as Record<string, unknown>) : null;
  });
  if (!segment) return { ok: false, entered: 0, skipped_existing: 0, errors: [`segment ${segment_id} not found`] };

  const contacts = await matchContactsForFilter(segment);

  let entered = 0, skipped = 0;
  for (const contact of contacts) {
    const inserted = await insertJourneyState(journey, contact.contact_id, contact.snapshot);
    if (inserted) entered++; else skipped++;
  }
  return { ok: true, entered, skipped_existing: skipped, errors };
}

/** Deterministic seed derived from contact_id + journey_id · reproducible without ever calling Math.random inside runtime. Masked to signed 31-bit for Postgres INT compatibility. */
function seedFor(journey_id: string, contact_id: string): number {
  let h = 5381 >>> 0;
  const s = journey_id + ":" + contact_id;
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0;
  return h & 0x7fffffff;                              // top bit off · fits Postgres INT
}

/**
 * Trigger-driven entry (Phase 5.1.2 · charter §11.6): the ONLY way a
 * trigger evaluator is allowed to materialise a journey state. Preserves
 * the "single doorway" invariant · every evaluator (segment_join /
 * analytics_event / compliance_transition / inactivity / custom_webhook
 * / schedule) enters through this function.
 */
export async function insertJourneyStateFromTrigger(
  journey: Journey,
  envelope: { contact_id: string; payload: Record<string, unknown>; correlation_id: string; causation_id: string; trigger_id: string; trigger_type: string },
): Promise<"inserted" | "skipped_existing"> {
  const snapshot = {
    entered_via_trigger_id: envelope.trigger_id,
    entered_via_trigger_type: envelope.trigger_type,
    correlation_id: envelope.correlation_id,
    causation_id: envelope.causation_id,
    trigger_payload: envelope.payload,
  };
  const inserted = await insertJourneyState(journey, envelope.contact_id, snapshot);
  return inserted ? "inserted" : "skipped_existing";
}

async function insertJourneyState(journey: Journey, contact_id: string, snapshot: Record<string, unknown>): Promise<boolean> {
  const seed = seedFor(journey.journey_id, contact_id);
  const r = await withClient(async (c) => {
    const res = await c.query(
      `INSERT INTO nex.journey_states
       (journey_id, journey_slug, journey_version, contact_id, current_node_id, status, entered_at, last_transition_at, random_seed, snapshot)
       VALUES ($1, $2, $3, $4, $5, 'active', NOW(), NOW(), $6, $7::jsonb)
       ON CONFLICT (journey_id, contact_id) DO NOTHING
       RETURNING state_id`,
      [journey.journey_id, journey.slug, journey.version, contact_id, journey.definition.start_node_id, seed, JSON.stringify(snapshot)],
    );
    return (res.rowCount ?? 0) > 0;
  });
  return r === true;
}

// Minimal subset of segments/preview.ts filter → SQL translation ·
// covers the same fields but is read-only and returns contact rows.
async function matchContactsForFilter(filter: Record<string, unknown>): Promise<Array<{ contact_id: string; snapshot: Record<string, unknown> }>> {
  const r = await withClient(async (c) => {
    const wheres: string[] = ["c.deleted_at IS NULL", "c.canonical_email IS NOT NULL", "c.compliance_state = 'allowed'"];
    const params: unknown[] = [];
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
         SELECT DISTINCT ON (contact_id) *
         FROM nex.contacts ORDER BY contact_id, updated_at DESC
       )
       SELECT c.contact_id, c.name, c.company, c.canonical_email AS email, c.country, c.trade_categories
       FROM canonical c
       WHERE ${wheres.join(" AND ")}
       LIMIT 5000`,
      params,
    );
    return res.rows.map((row) => ({
      contact_id: String(row.contact_id),
      snapshot: {
        name: (row.name as string | null) ?? null,
        company: (row.company as string | null) ?? null,
        email: (row.email as string | null) ?? null,
        country: (row.country as string | null) ?? null,
        trade_categories: (row.trade_categories as string[] | null) ?? null,
      },
    }));
  });
  return r ?? [];
}
