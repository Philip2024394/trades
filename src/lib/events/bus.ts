// The event bus — registers projection handlers per event type and
// dispatches events to them.
//
// Registration happens at import time (see projections/index.ts).
// Dispatch is synchronous-inline for MVP; every handler runs in
// sequence, failures are caught and logged as failed projection rows
// so they don't block sibling handlers.
//
// Later phases will replace inline dispatch with a queued worker
// (Supabase Edge Function / dedicated Node worker) without changing
// the handler interface.

import type {
  BusinessEvent,
  BusinessEventType,
  ProjectionResult,
  ProjectionType
} from "./types";

export type ProjectionHandler = (
  event: BusinessEvent
) => Promise<ProjectionResult>;

type Registration = {
  projectionType: ProjectionType;
  handler: ProjectionHandler;
};

const registry = new Map<BusinessEventType, Registration[]>();

/** Register a projection handler for one or more event types. Idempotent
 *  — re-registering the same (eventType, projectionType) pair replaces
 *  the previous handler. */
export function registerProjection(
  eventTypes: BusinessEventType | BusinessEventType[],
  projectionType: ProjectionType,
  handler: ProjectionHandler
): void {
  const types = Array.isArray(eventTypes) ? eventTypes : [eventTypes];
  for (const et of types) {
    const existing = registry.get(et) ?? [];
    const filtered = existing.filter(
      (r) => r.projectionType !== projectionType
    );
    filtered.push({ projectionType, handler });
    registry.set(et, filtered);
  }
}

/** Return the projections registered for an event type. */
export function projectionsFor(
  eventType: BusinessEventType
): Registration[] {
  return registry.get(eventType) ?? [];
}

/** Diagnostic — used by the /api/events/introspect route in later
 *  phases to expose the registration table to admin users. */
export function allRegistrations(): Record<string, ProjectionType[]> {
  const out: Record<string, ProjectionType[]> = {};
  for (const [eventType, regs] of registry.entries()) {
    out[eventType] = regs.map((r) => r.projectionType);
  }
  return out;
}
