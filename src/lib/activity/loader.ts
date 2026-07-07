// Activity loader — joins business_events × event_projections and
// returns a timeline the merchant can scroll to see everything the
// platform did on their behalf and why.
//
// This is the trust bridge. Silent + retroactively visible >
// silent forever.

import { createClient } from "@supabase/supabase-js";
import type {
  BusinessEvent,
  BusinessEventType,
  EventProjection,
  ProjectionStatus,
  ProjectionType
} from "@/lib/events/types";

function client() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export type ActivityEntry = {
  event: BusinessEvent;
  projections: EventProjection[];
};

/** Load the last N activity entries — events + their projection
 *  outcomes — for the merchant, newest first. */
export async function loadActivity(
  merchantId: string,
  limit = 30
): Promise<ActivityEntry[]> {
  const c = client();
  if (!c) return [];
  const { data: eventRows } = await c
    .from("business_events")
    .select("*")
    .eq("merchant_id", merchantId)
    .order("occurred_at", { ascending: false })
    .limit(limit);
  const events = (eventRows ?? []) as Array<{
    id: string;
    merchant_id: string;
    event_type: string;
    event_payload: Record<string, unknown>;
    ai_understanding: Record<string, unknown> | null;
    occurred_at: string;
    source: string;
    idempotency_key: string | null;
    created_at: string;
  }>;
  if (events.length === 0) return [];
  const eventIds = events.map((e) => e.id);
  const { data: projRows } = await c
    .from("event_projections")
    .select("*")
    .in("event_id", eventIds);
  const projByEvent = new Map<string, EventProjection[]>();
  for (const p of projRows ?? []) {
    const row = p as {
      id: string;
      event_id: string;
      merchant_id: string;
      projection_type: string;
      target_ref: unknown;
      status: ProjectionStatus;
      reason: string | null;
      attempts: number;
      created_at: string;
      completed_at: string | null;
    };
    const entry: EventProjection = {
      id: row.id,
      eventId: row.event_id,
      merchantId: row.merchant_id,
      projectionType: row.projection_type as ProjectionType,
      targetRef: row.target_ref,
      status: row.status,
      reason: row.reason,
      attempts: row.attempts,
      createdAt: row.created_at,
      completedAt: row.completed_at
    };
    const list = projByEvent.get(row.event_id) ?? [];
    list.push(entry);
    projByEvent.set(row.event_id, list);
  }
  return events.map((e) => ({
    event: {
      id: e.id,
      merchantId: e.merchant_id,
      eventType: e.event_type as BusinessEventType,
      eventPayload: e.event_payload ?? {},
      aiUnderstanding: e.ai_understanding,
      occurredAt: e.occurred_at,
      source: e.source,
      idempotencyKey: e.idempotency_key,
      createdAt: e.created_at
    },
    projections: projByEvent.get(e.id) ?? []
  }));
}
