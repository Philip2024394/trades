// OS Event Bus — types.
//
// The event type union is CLOSED. Adding a new event type is a code
// change (this file + a subscriber handler). The runtime rejects
// publishes with an unknown type so a typo can never silently succeed.
import "server-only";

// -------------------------------------------------------------------
// Event type registry — the canonical topic tree
// -------------------------------------------------------------------
export const OS_EVENT_TYPES = [
  // Property lifecycle
  "property.created",
  "property.claimed",
  "property.verified",

  // Project lifecycle
  "project.opened",
  "project.specced",
  "project.quoted",
  "project.accepted",
  "project.installed",
  "project.signed_off",
  "project.closed",

  // AI Visualiser + specifications
  "render.completed",
  "lead.captured",
  "spec.drafted",
  "spec.updated",

  // Quote Workspace
  "quote.drafted",
  "quote.sent",
  "quote.viewed",
  "quote.accepted",
  "quote.rejected",
  "quote.expired",

  // Notebook (Quote Me flow — trade-initiated multi-merchant quote)
  "notebook.basket.item_added",
  "notebook.basket.item_removed",
  "notebook.quote_request.sent",
  "notebook.quote_request.quoted",
  "notebook.quote_request.won",
  "notebook.quote_request.expired",
  "notebook.site_project.created",

  // Job Diary
  "job.opened",
  "job.checked_in",
  "job.photo_added",
  "job.milestone_hit",
  "job.snag_raised",
  "job.signed_off",

  // Warranty + orders
  "warranty.registered",
  "order.placed",
  "order.delivered",

  // Reviews
  "review.requested",
  "review.posted",
  "review.responded",
  "review.disputed",

  // CRM
  "contact.created",
  "contact.stage_changed",
  "task.due",
  "follow_up.due",

  // Products
  "product.published",
  "product.updated",
  "product.withdrawn",
  "product.price_changed",
  "product.stock_low",

  // Billing (Stripe subscription events reflected on our bus)
  "billing.subscription.created",
  "billing.subscription.updated",
  "billing.subscription.cancelled",
  "billing.payment.succeeded",
  "billing.payment.failed"
] as const;

export type OsEventType = (typeof OS_EVENT_TYPES)[number];

const EVENT_TYPE_SET = new Set<string>(OS_EVENT_TYPES);
export function isKnownEventType(t: string): t is OsEventType {
  return EVENT_TYPE_SET.has(t);
}

// -------------------------------------------------------------------
// Publish input — payload is typed loosely at the bus level so any
// app can publish. Consumers cast/validate at their own boundary.
// -------------------------------------------------------------------
export type EventContext = {
  actorPartyId?: string | null;
  actorBusinessId?: string | null;
  propertyId?: string | null;
  projectId?: string | null;
  subjectType?: string | null;
  subjectId?: string | null;
};

export type PublishEventInput = EventContext & {
  eventType: OsEventType;
  publisherApp: string;
  payload?: Record<string, unknown>;
  /** Idempotency key — when supplied, republish with the same
   *  (publisherApp, eventType, dedupKey) returns the existing event
   *  and does NOT re-fan out to subscribers. */
  dedupKey?: string;
  /** Timestamp override — defaults to now(). */
  occurredAt?: Date | string;
};

export type PublishedEvent = {
  id: string;
  eventType: OsEventType;
  eventVersion: number;
  publisherApp: string;
  actorPartyId: string | null;
  actorBusinessId: string | null;
  propertyId: string | null;
  projectId: string | null;
  subjectType: string | null;
  subjectId: string | null;
  payload: Record<string, unknown>;
  occurredAt: string;
};

// -------------------------------------------------------------------
// Handler contract
// -------------------------------------------------------------------
export type HandlerResult =
  | { ok: true }
  | { ok: false; error: string; retryable?: boolean };

export type EventHandler = (event: PublishedEvent) => Promise<HandlerResult>;

export type Subscription = {
  /** Unique — usually `<app-slug>.<handler-name>`. */
  subscriberSlug: string;
  eventType: OsEventType;
  handler: EventHandler;
  /** Retries beyond this count go to dead-letter. Default 6. */
  maxAttempts?: number;
};

// -------------------------------------------------------------------
// Retry policy
// -------------------------------------------------------------------
export function nextRetryDelaySeconds(attemptCount: number): number {
  // Exponential backoff: 30s, 2m, 8m, 30m, 2h, 8h
  const table = [30, 120, 480, 1800, 7200, 28800];
  const idx = Math.min(attemptCount, table.length - 1);
  return table[idx];
}
