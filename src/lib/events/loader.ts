// Server-side reads + writes against business_events and
// event_projections. Every consumer of the events pipeline talks to
// the DB through these helpers so we control the schema surface.

import { createClient } from "@supabase/supabase-js";
import type {
  BusinessEvent,
  BusinessEventType,
  EventProjection,
  ProjectionStatus,
  ProjectionType
} from "./types";

function client() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

type EventRow = {
  id: string;
  merchant_id: string;
  event_type: string;
  event_payload: Record<string, unknown>;
  ai_understanding: Record<string, unknown> | null;
  occurred_at: string;
  source: string;
  idempotency_key: string | null;
  created_at: string;
};

function rowToEvent(row: EventRow): BusinessEvent {
  return {
    id: row.id,
    merchantId: row.merchant_id,
    eventType: row.event_type as BusinessEventType,
    eventPayload: row.event_payload ?? {},
    aiUnderstanding: row.ai_understanding,
    occurredAt: row.occurred_at,
    source: row.source,
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at
  };
}

/** Insert a new event. If idempotencyKey is set and already present
 *  for this merchant, returns the existing event without inserting. */
export async function insertEvent(input: {
  merchantId: string;
  eventType: BusinessEventType;
  eventPayload: Record<string, unknown>;
  aiUnderstanding?: Record<string, unknown>;
  occurredAt?: string;
  source?: string;
  idempotencyKey?: string;
}): Promise<BusinessEvent | null> {
  const c = client();
  if (!c) return null;
  if (input.idempotencyKey) {
    const { data: existing } = await c
      .from("business_events")
      .select("*")
      .eq("merchant_id", input.merchantId)
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();
    if (existing) return rowToEvent(existing as EventRow);
  }
  const { data, error } = await c
    .from("business_events")
    .insert({
      merchant_id: input.merchantId,
      event_type: input.eventType,
      event_payload: input.eventPayload,
      ai_understanding: input.aiUnderstanding ?? null,
      occurred_at: input.occurredAt ?? new Date().toISOString(),
      source: input.source ?? "app",
      idempotency_key: input.idempotencyKey ?? null
    })
    .select("*")
    .maybeSingle();
  if (error || !data) return null;
  return rowToEvent(data as EventRow);
}

export async function loadEvent(
  eventId: string
): Promise<BusinessEvent | null> {
  const c = client();
  if (!c) return null;
  const { data } = await c
    .from("business_events")
    .select("*")
    .eq("id", eventId)
    .maybeSingle();
  if (!data) return null;
  return rowToEvent(data as EventRow);
}

export async function loadEventsForMerchant(
  merchantId: string,
  limit = 50
): Promise<BusinessEvent[]> {
  const c = client();
  if (!c) return [];
  const { data } = await c
    .from("business_events")
    .select("*")
    .eq("merchant_id", merchantId)
    .order("occurred_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r) => rowToEvent(r as EventRow));
}

/** Upsert a projection row. Idempotent on (event_id, projection_type). */
export async function upsertProjection(input: {
  eventId: string;
  merchantId: string;
  projectionType: ProjectionType;
  status: ProjectionStatus;
  reason?: string;
  targetRef?: unknown;
  attempts?: number;
}): Promise<boolean> {
  const c = client();
  if (!c) return false;
  const now = new Date().toISOString();
  const { error } = await c.from("event_projections").upsert(
    {
      event_id: input.eventId,
      merchant_id: input.merchantId,
      projection_type: input.projectionType,
      status: input.status,
      reason: input.reason ?? null,
      target_ref: input.targetRef ?? null,
      attempts: input.attempts ?? 1,
      completed_at:
        input.status === "done" ||
        input.status === "failed" ||
        input.status === "skipped" ||
        input.status === "held"
          ? now
          : null
    },
    { onConflict: "event_id,projection_type" }
  );
  return !error;
}

type ProjectionRow = {
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

export async function loadProjectionsForEvent(
  eventId: string
): Promise<EventProjection[]> {
  const c = client();
  if (!c) return [];
  const { data } = await c
    .from("event_projections")
    .select("*")
    .eq("event_id", eventId);
  return (data ?? []).map((r) => {
    const row = r as ProjectionRow;
    return {
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
  });
}
