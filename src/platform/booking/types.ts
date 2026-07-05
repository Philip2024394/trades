// Booking Registry — types.
//
// Booking flows are stateful, multi-step end-to-end experiences. A
// booking manifest declares the steps, integrations, and policies.
// Concrete availability + services are per-brand data at runtime;
// the manifest owns the FLOW SHAPE.
//
// Distinct from `formRegistry` — a form is a single submission; a
// booking is a multi-step flow with optional payments + calendar
// sync + reminders.
//
// M3 B7: Strategy-aware. Booking manifests declare `consumesFacets`
// so the runtime can adapt CTA labels, service ordering, deposit
// policy, entry gates, and calendar display from ResolvedStrategy.

import type { ComponentType } from "react";

export type BookingFlowKind =
  | "simple"
  | "with-deposit"
  | "wizard-quote"
  | "emergency"
  | "consultation"
  | "quote-only";

export type BookingStepKind =
  | "emergency-gate"
  | "choose-service"
  | "choose-date"
  | "choose-slot"
  | "customer-info"
  | "project-brief"
  | "showroom-appointment"
  | "budget-range"
  | "style-preference"
  | "deposit"
  | "confirm"
  | "quote-request"
  | "merchant-review"
  | "postcode-lookup"
  | "auto-slot";

export type BookingStep = {
  key: BookingStepKind;
  order: number;
  required: boolean;
  /** Optional Form Registry id — customer-info steps typically point
   *  at a `formRegistry` template. */
  formId?: string;
  /** Optional integration adapter this step depends on — e.g.
   *  "stripe-deposit" for the deposit step. */
  requiresIntegration?: string;
  /** Optional facet reference to conditionally include this step —
   *  e.g. deposit step only appears if `booking.depositPolicy` !== "none". */
  visibleWhen?: {
    domain: string;
    field: string;
    equalsAnyOf: readonly string[];
  };
};

export type BookingPolicy = {
  /** Merchant can require customers to confirm N hours before start. */
  minCustomerLeadHours?: number;
  /** Maximum days in advance a customer may book. */
  maxAdvanceDays?: number;
  /** Cancellation allowed until N hours before start. */
  cancellationDeadlineHours?: number;
  /** Reschedule allowed until N hours before start. */
  rescheduleDeadlineHours?: number;
  /** Reminder cadence — hours before start when reminders fire. */
  reminderHours?: readonly number[];
};

/** Facet a booking flow reads from ResolvedStrategy. */
export type BookingFacetRef = {
  kind: string;
  optional?: boolean;
};

export type BookingRendererProps = {
  manifest: FrozenBookingManifest;
  /** Ordered service slugs (may come from strategy.pushServices or
   *  booking.priorityServices facet). */
  services: readonly string[];
  /** Facet-adapted values. */
  primaryCtaLabel: string;
  depositPolicy: "required" | "optional" | "none";
  gate?: "emergency" | "none";
  availabilityDisplay: "calendar" | "next-available" | "callback-only" | "consultation";
  /** Submit handler at final step. */
  onSubmit: (payload: Record<string, unknown>) => Promise<void> | void;
};

export type BookingManifest = {
  manifestVersion: 1;

  slug: string;
  name: string;
  description: string;
  version: string;

  /** Flow shape. */
  flowKind: BookingFlowKind;

  /** Ordered steps in this flow. */
  steps: readonly BookingStep[];

  /** Policies applied at runtime. */
  policy: BookingPolicy;

  /** Whether this flow requires a payment integration. */
  requiresPayment: boolean;

  /** Whether this flow syncs to an external calendar (Google /
   *  Outlook / etc.). */
  requiresCalendarSync: boolean;

  /** Facets this flow consumes from ResolvedStrategy — validated at
   *  registration against facetKindRegistry. */
  consumesFacets: readonly BookingFacetRef[];

  /** Trade slugs this flow is designed for. `["*"]` = any trade. */
  trades?: readonly string[];

  /** Profile flag hints — booking runtime uses this to rank the flow
   *  when selecting from multiple candidates. */
  profileFlags?: readonly string[];

  /** Concrete React renderer. */
  renderer: ComponentType<BookingRendererProps>;

  /** Publisher metadata. */
  publisher?: {
    name: string;
    verified: boolean;
    contactUrl?: string;
  };
};

export type FrozenBookingManifest = Readonly<BookingManifest>;

/** Booking integration adapter — a sibling registry-like slot that
 *  named integrations (Stripe deposit, Google Calendar, Outlook) can
 *  hang off. Kept inline for now — dedicated
 *  `bookingIntegrationRegistry` will land when adapters ship. */
export type BookingIntegrationKind =
  | "stripe-deposit"
  | "google-calendar"
  | "outlook-calendar";
