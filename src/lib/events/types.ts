// G0 event type taxonomy. Adding new event types = adding to this
// union. The API layer validates against BUSINESS_EVENT_TYPES so we
// reject typos at the boundary.

export const BUSINESS_EVENT_TYPES = [
  // Content-adjacent — the first three we actually ship projections for
  "work_captured",
  "job_completed",
  "review_received",
  // Commercial — deferred projections but events accepted from day one
  "lead_received",
  "quote_sent",
  "quote_won",
  "quote_lost",
  "invoice_paid",
  // Organisational
  "staff_joined",
  "staff_left",
  "certification_earned",
  "service_added",
  "service_area_added",
  "vehicle_wrapped",
  "insurance_renewed",
  "price_updated",
  // Narrative
  "testimonial_recorded",
  "milestone_reached"
] as const;

export type BusinessEventType = (typeof BUSINESS_EVENT_TYPES)[number];

export function isBusinessEventType(v: string): v is BusinessEventType {
  return (BUSINESS_EVENT_TYPES as readonly string[]).includes(v);
}

/** The canonical event row. */
export type BusinessEvent = {
  id: string;
  merchantId: string;
  eventType: BusinessEventType;
  eventPayload: Record<string, unknown>;
  aiUnderstanding: Record<string, unknown> | null;
  occurredAt: string;
  source: string;
  idempotencyKey: string | null;
  createdAt: string;
};

/** Projection types — each is handled by a registered projection
 *  handler in src/lib/events/projections. */
export const PROJECTION_TYPES = [
  "memory_write", // Tier 3 — the durable archive
  "publication", // one publication per channel (G2+)
  "gold_path_task", // insert / update a Gold Path card (G2+)
  "website_update", // rebuild a website block (G1)
  "narrative_update", // extend / close a story arc (G3)
  "follow_up", // schedule a follow-up (G4+)
  "referral_request", // ask for a referral (G4+)
  "maintenance_reminder", // schedule maintenance follow-up (G4+)
  "crm_update" // update CRM state (G4+)
] as const;

export type ProjectionType = (typeof PROJECTION_TYPES)[number];

export type ProjectionStatus =
  | "queued"
  | "running"
  | "done"
  | "held"
  | "failed"
  | "skipped";

export type EventProjection = {
  id: string;
  eventId: string;
  merchantId: string;
  projectionType: ProjectionType;
  targetRef: unknown;
  status: ProjectionStatus;
  reason: string | null;
  attempts: number;
  createdAt: string;
  completedAt: string | null;
};

/** Result returned by a projection handler. Idempotency: handlers
 *  may be re-invoked, so they should be safe to run twice. */
export type ProjectionResult = {
  status: Exclude<ProjectionStatus, "queued" | "running">;
  reason?: string;
  targetRef?: unknown;
};
