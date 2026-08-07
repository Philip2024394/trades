// NEX Journey Engine · event persistence helpers
//
// Every state transition · every command · every branch decision writes
// a row to nex.journey_events. INSERT-only · never mutated.

import { withClient } from "@/lib/nex/delivery/db";
import type { Journey, JourneyEvent, JourneyState, TickOutput } from "../types";

export async function recordEvents(journey: Journey, state: JourneyState, events: TickOutput["events"]): Promise<void> {
  if (events.length === 0) return;
  await withClient(async (c) => {
    for (const ev of events) {
      await c.query(
        `INSERT INTO nex.journey_events
         (journey_id, journey_slug, journey_version, state_id, contact_id, event_type,
          from_node_id, to_node_id, emitted_command, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb)`,
        [
          journey.journey_id, journey.slug, journey.version,
          state.state_id, state.contact_id, ev.event_type,
          ev.from_node_id, ev.to_node_id,
          ev.emitted_command ? JSON.stringify(ev.emitted_command) : null,
          JSON.stringify(ev.metadata ?? {}),
        ],
      );
    }
    return null;
  });
}

export async function listEventsForContact(journey_id: string, contact_id: string, limit = 200): Promise<JourneyEvent[]> {
  const r = await withClient(async (c) => {
    const res = await c.query(
      `SELECT * FROM nex.journey_events WHERE journey_id = $1 AND contact_id = $2 ORDER BY occurred_at ASC LIMIT ${Math.max(1, Math.min(500, limit))}`,
      [journey_id, contact_id],
    );
    return res.rows.map(rowToEvent);
  });
  return r ?? [];
}

export async function listEventsForState(state_id: string, limit = 200): Promise<JourneyEvent[]> {
  const r = await withClient(async (c) => {
    const res = await c.query(
      `SELECT * FROM nex.journey_events WHERE state_id = $1 ORDER BY occurred_at ASC LIMIT ${Math.max(1, Math.min(500, limit))}`,
      [state_id],
    );
    return res.rows.map(rowToEvent);
  });
  return r ?? [];
}

function rowToEvent(r: Record<string, unknown>): JourneyEvent {
  return {
    event_id: String(r.event_id),
    journey_id: String(r.journey_id),
    journey_slug: String(r.journey_slug),
    journey_version: Number(r.journey_version),
    state_id: (r.state_id as string | null) ?? null,
    contact_id: (r.contact_id as string | null) ?? null,
    event_type: r.event_type as JourneyEvent["event_type"],
    from_node_id: (r.from_node_id as string | null) ?? null,
    to_node_id:   (r.to_node_id   as string | null) ?? null,
    emitted_command: (r.emitted_command as JourneyEvent["emitted_command"]) ?? null,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    occurred_at: String(r.occurred_at),
  };
}
