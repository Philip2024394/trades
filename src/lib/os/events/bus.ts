// OS Event Bus — publish + inline delivery.
//
// publish(input) does three things:
//   1. Idempotency check — if input.dedupKey already exists for the
//      (publisher, eventType) tuple, returns the existing event and
//      does NOT re-fan out.
//   2. INSERTs into os_event_log.
//   3. For every registered subscriber of that eventType, INSERTs an
//      os_event_deliveries row + attempts inline delivery (fast path).
//      Failed inline deliveries stay 'pending' and get retried by the
//      /api/cron/os-event-drain worker.
//
// Publisher never awaits handler success. Publish returns as soon as
// the event log + delivery rows are written. Handler outcomes are the
// worker's responsibility.
//
// Runtime import side-effect: this module imports the app subscription
// registrations by importing @/lib/os/events/subscriptions/index. That
// index is where every app plugs its handlers in at boot.
import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  isKnownEventType,
  nextRetryDelaySeconds,
  type PublishedEvent,
  type PublishEventInput,
  type Subscription
} from "./types";
import { subscribersFor } from "./registry";
import "./subscriptions"; // side-effect: registers all app handlers

export class EventBusError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EventBusError";
  }
}

export async function publish(
  input: PublishEventInput
): Promise<PublishedEvent> {
  if (!isKnownEventType(input.eventType)) {
    throw new EventBusError(`Unknown event type: ${input.eventType}`);
  }

  const occurredAt =
    input.occurredAt instanceof Date
      ? input.occurredAt.toISOString()
      : input.occurredAt ?? new Date().toISOString();

  // Idempotency
  if (input.dedupKey) {
    const { data: existing } = await supabaseAdmin
      .from("os_event_log")
      .select(
        "id, event_type, event_version, publisher_app, actor_party_id, actor_business_id, property_id, project_id, subject_type, subject_id, payload, occurred_at"
      )
      .eq("publisher_app", input.publisherApp)
      .eq("event_type", input.eventType)
      .eq("dedup_key", input.dedupKey)
      .maybeSingle();
    if (existing) return rowToPublished(existing);
  }

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from("os_event_log")
    .insert({
      event_type: input.eventType,
      event_version: 1,
      publisher_app: input.publisherApp,
      dedup_key: input.dedupKey ?? null,
      actor_party_id: input.actorPartyId ?? null,
      actor_business_id: input.actorBusinessId ?? null,
      property_id: input.propertyId ?? null,
      project_id: input.projectId ?? null,
      subject_type: input.subjectType ?? null,
      subject_id: input.subjectId ?? null,
      payload: input.payload ?? {},
      occurred_at: occurredAt
    })
    .select(
      "id, event_type, event_version, publisher_app, actor_party_id, actor_business_id, property_id, project_id, subject_type, subject_id, payload, occurred_at"
    )
    .single();

  if (insertErr || !inserted) {
    // Handle unique-violation race on dedup_key — return the winner.
    if (insertErr?.code === "23505" && input.dedupKey) {
      const { data: winner } = await supabaseAdmin
        .from("os_event_log")
        .select(
          "id, event_type, event_version, publisher_app, actor_party_id, actor_business_id, property_id, project_id, subject_type, subject_id, payload, occurred_at"
        )
        .eq("publisher_app", input.publisherApp)
        .eq("event_type", input.eventType)
        .eq("dedup_key", input.dedupKey)
        .single();
      if (winner) return rowToPublished(winner);
    }
    throw new EventBusError(
      `Failed to persist event: ${insertErr?.message ?? "unknown"}`
    );
  }

  const published = rowToPublished(inserted);
  const subs = subscribersFor(input.eventType);
  if (subs.length === 0) return published;

  // Fanout delivery rows
  const deliveryRows = subs.map((s) => ({
    event_id: published.id,
    subscriber_slug: s.subscriberSlug,
    event_type: published.eventType,
    max_attempts: s.maxAttempts ?? 6,
    next_attempt_at: new Date().toISOString()
  }));
  const { data: deliveries, error: fanoutErr } = await supabaseAdmin
    .from("os_event_deliveries")
    .insert(deliveryRows)
    .select("id, subscriber_slug");
  if (fanoutErr) {
    // The event is persisted; deliveries can be reconstructed by the
    // drain worker doing a "find events without deliveries" scan later
    // if this ever bites us. For v1 we surface the error but don't
    // roll back the publish.
    console.error("[os.events] fanout insert failed", fanoutErr);
    return published;
  }

  // Inline delivery — best-effort. Failures leave the row pending for
  // the drain worker to retry.
  await Promise.allSettled(
    (deliveries ?? []).map((d) =>
      attemptDelivery({
        deliveryId: d.id,
        subscriberSlug: d.subscriber_slug,
        event: published
      })
    )
  );

  return published;
}

// -------------------------------------------------------------------
// Delivery attempt — used both inline (in publish) and by the drain
// worker cron.
// -------------------------------------------------------------------
export async function attemptDelivery(input: {
  deliveryId: string;
  subscriberSlug: string;
  event: PublishedEvent;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: locked, error: lockErr } = await supabaseAdmin
    .from("os_event_deliveries")
    .update({
      status: "running",
      last_attempted_at: new Date().toISOString(),
      attempt_count: 0 // will be re-incremented in outcome update
    })
    .eq("id", input.deliveryId)
    .in("status", ["pending", "failed"])
    .select("id, attempt_count, max_attempts")
    .maybeSingle();

  if (!locked) {
    return { ok: false, error: "delivery-not-lockable" };
  }

  const subs = subscribersFor(input.event.eventType);
  const sub = subs.find((s) => s.subscriberSlug === input.subscriberSlug);
  if (!sub) {
    await markDeadLetter(input.deliveryId, "handler-not-registered", input.event);
    return { ok: false, error: "handler-not-registered" };
  }

  try {
    const result = await sub.handler(input.event);
    if (result.ok) {
      await supabaseAdmin
        .from("os_event_deliveries")
        .update({
          status: "delivered",
          delivered_at: new Date().toISOString()
        })
        .eq("id", input.deliveryId);
      return { ok: true };
    }
    return await handleFailure({
      deliveryId: input.deliveryId,
      event: input.event,
      sub,
      error: result.error,
      retryable: result.retryable !== false
    });
  } catch (err) {
    return await handleFailure({
      deliveryId: input.deliveryId,
      event: input.event,
      sub,
      error: String(err),
      retryable: true
    });
  }
}

async function handleFailure(input: {
  deliveryId: string;
  event: PublishedEvent;
  sub: Subscription;
  error: string;
  retryable: boolean;
}): Promise<{ ok: false; error: string }> {
  const { data: current } = await supabaseAdmin
    .from("os_event_deliveries")
    .select("attempt_count, max_attempts")
    .eq("id", input.deliveryId)
    .single();

  const nextCount = (current?.attempt_count ?? 0) + 1;
  const maxAttempts = current?.max_attempts ?? input.sub.maxAttempts ?? 6;
  const deadLetter = !input.retryable || nextCount >= maxAttempts;

  if (deadLetter) {
    await markDeadLetter(input.deliveryId, input.error, input.event, nextCount);
    return { ok: false, error: input.error };
  }

  const delaySeconds = nextRetryDelaySeconds(nextCount);
  await supabaseAdmin
    .from("os_event_deliveries")
    .update({
      status: "failed",
      attempt_count: nextCount,
      last_error: input.error.slice(0, 1024),
      next_attempt_at: new Date(Date.now() + delaySeconds * 1000).toISOString()
    })
    .eq("id", input.deliveryId);
  return { ok: false, error: input.error };
}

async function markDeadLetter(
  deliveryId: string,
  error: string,
  event: PublishedEvent,
  attemptCount: number = 1
): Promise<void> {
  await supabaseAdmin
    .from("os_event_deliveries")
    .update({
      status: "dead_lettered",
      attempt_count: attemptCount,
      last_error: error.slice(0, 1024)
    })
    .eq("id", deliveryId);
  // Idempotent insert — the FK is on delivery_id which is unique on
  // the dead-letter table.
  await supabaseAdmin.from("os_event_dead_letter").insert({
    delivery_id: deliveryId,
    event_id: event.id,
    subscriber_slug: (
      await supabaseAdmin
        .from("os_event_deliveries")
        .select("subscriber_slug")
        .eq("id", deliveryId)
        .single()
    ).data?.subscriber_slug,
    event_type: event.eventType,
    final_error: error.slice(0, 1024),
    attempt_count: attemptCount
  });
}

function rowToPublished(row: Record<string, unknown>): PublishedEvent {
  return {
    id: row.id as string,
    eventType: row.event_type as PublishedEvent["eventType"],
    eventVersion: (row.event_version as number) ?? 1,
    publisherApp: row.publisher_app as string,
    actorPartyId: (row.actor_party_id as string) ?? null,
    actorBusinessId: (row.actor_business_id as string) ?? null,
    propertyId: (row.property_id as string) ?? null,
    projectId: (row.project_id as string) ?? null,
    subjectType: (row.subject_type as string) ?? null,
    subjectId: (row.subject_id as string) ?? null,
    payload: (row.payload as Record<string, unknown>) ?? {},
    occurredAt: row.occurred_at as string
  };
}
