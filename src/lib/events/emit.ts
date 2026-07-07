// The event emit path — the single write entry point for the whole
// pipeline. Every business event that happens in the platform lands
// here.
//
// Flow:
//   1. Insert into business_events (idempotent by merchant + key)
//   2. Look up registered projections for the event_type
//   3. Dispatch each projection handler in sequence
//   4. Persist the projection result row (done/held/failed/skipped)
//   5. Return the event id + summary of projection outcomes

import { projectionsFor } from "./bus";
import { insertEvent, upsertProjection } from "./loader";
import type { BusinessEvent, BusinessEventType } from "./types";
// Ensure projections are registered before we dispatch. Importing
// the index for its side effects.
import "./projections";

export type EmitInput = {
  merchantId: string;
  eventType: BusinessEventType;
  payload?: Record<string, unknown>;
  aiUnderstanding?: Record<string, unknown>;
  occurredAt?: string;
  source?: string;
  idempotencyKey?: string;
};

export type EmitResult = {
  event: BusinessEvent | null;
  projections: Array<{
    projectionType: string;
    status: string;
    reason?: string;
    targetRef?: unknown;
  }>;
  reason?: string;
};

export async function emitEvent(input: EmitInput): Promise<EmitResult> {
  const event = await insertEvent({
    merchantId: input.merchantId,
    eventType: input.eventType,
    eventPayload: input.payload ?? {},
    aiUnderstanding: input.aiUnderstanding,
    occurredAt: input.occurredAt,
    source: input.source,
    idempotencyKey: input.idempotencyKey
  });
  if (!event) {
    return {
      event: null,
      projections: [],
      reason: "database unavailable — event not persisted"
    };
  }

  const registrations = projectionsFor(input.eventType);
  const outcomes: EmitResult["projections"] = [];

  for (const { projectionType, handler } of registrations) {
    try {
      const result = await handler(event);
      await upsertProjection({
        eventId: event.id,
        merchantId: event.merchantId,
        projectionType,
        status: result.status,
        reason: result.reason,
        targetRef: result.targetRef,
        attempts: 1
      });
      outcomes.push({
        projectionType,
        status: result.status,
        reason: result.reason,
        targetRef: result.targetRef
      });
    } catch (e) {
      const reason = (e as Error).message ?? String(e);
      await upsertProjection({
        eventId: event.id,
        merchantId: event.merchantId,
        projectionType,
        status: "failed",
        reason,
        attempts: 1
      });
      outcomes.push({
        projectionType,
        status: "failed",
        reason
      });
    }
  }

  return { event, projections: outcomes };
}
