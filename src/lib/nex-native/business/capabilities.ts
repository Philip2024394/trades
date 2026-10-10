// src/lib/nex-native/business/capabilities.ts
//
// NEX Business Experience · universal implemented capability catalog +
// per-subtype recommendations + per-capability readiness (Finding #7).
// Rev 6 FROZEN · 2026-10-02.
//
// CRITICAL NAMING DISCIPLINE (Finding #4 · hidden-permission defence):
//   AVAILABLE   · getAvailableCapabilities()    · universal catalog · THE SOURCE OF TRUTH
//   RECOMMENDED · getRecommendedCapabilities()  · subtype-sourced suggestion only
//   ENABLED     · getEffectiveCapability()      · owner_override ?? recommendation ?? false
//   READY       · isCapabilityReady()           · data complete enough to actually serve the customer
//
// A function named "Available" MUST return the universal catalog.
// A function named "Recommended" MUST return subtype-derived suggestions.
// Never alias, swap, or conflate. The engineering test applies:
//   "Is this recommendation, or is this permission?"

import type {
  BusinessEngineInput,
  BusinessSubtype,
  CapabilityKey,
} from "./types";

// -----------------------------------------------------------------------------
// AVAILABLE · universal catalog · every NEX, forever.
// This list IS the universe of implemented capabilities. Future keys land
// here as they ship; nothing else is "available" because nothing else exists.
// -----------------------------------------------------------------------------
export const AVAILABLE_CAPABILITIES: readonly CapabilityKey[] = [
  // Fulfilment / Access
  "dine_in",
  "pickup",
  "local_delivery",
  "national_shipping",
  "international_shipping",
  "at_customer_location",
  "at_business_location",
  // Scheduling
  "reservations",
  "appointments",
  "room_booking",
  "availability_calendar",
  "recurring_service",
  // Commerce foundations
  "deposit_booking_fee",
  "moq_wholesale",
  "quote_request",
  "enquiry_only",
  "online_payment",
  // Location
  "physical_venue",
  "service_area_radius",
  "multi_location",
  "fully_mobile",
  // Communication
  "enquiry_contact",
  "site_visit",
  "virtual_consultation",
  "request_callback",
] as const;

export const CAPABILITY_GROUP: Record<CapabilityKey, string> = {
  dine_in: "Fulfilment",
  pickup: "Fulfilment",
  local_delivery: "Fulfilment",
  national_shipping: "Fulfilment",
  international_shipping: "Fulfilment",
  at_customer_location: "Fulfilment",
  at_business_location: "Fulfilment",
  reservations: "Scheduling",
  appointments: "Scheduling",
  room_booking: "Scheduling",
  availability_calendar: "Scheduling",
  recurring_service: "Scheduling",
  deposit_booking_fee: "Commerce",
  moq_wholesale: "Commerce",
  quote_request: "Commerce",
  enquiry_only: "Commerce",
  online_payment: "Commerce",
  physical_venue: "Location",
  service_area_radius: "Location",
  multi_location: "Location",
  fully_mobile: "Location",
  enquiry_contact: "Communication",
  site_visit: "Communication",
  virtual_consultation: "Communication",
  request_callback: "Communication",
};

export const CAPABILITY_LABEL: Record<CapabilityKey, string> = {
  dine_in: "Dine-in",
  pickup: "Pickup",
  local_delivery: "Local delivery",
  national_shipping: "National shipping",
  international_shipping: "International shipping",
  at_customer_location: "At customer location",
  at_business_location: "At business location",
  reservations: "Reservations",
  appointments: "Appointments",
  room_booking: "Room booking",
  availability_calendar: "Availability calendar",
  recurring_service: "Recurring service",
  deposit_booking_fee: "Deposit / booking fee",
  moq_wholesale: "Wholesale (MOQ)",
  quote_request: "Quote request",
  enquiry_only: "Enquiry only",
  online_payment: "Online payment",
  physical_venue: "Physical venue",
  service_area_radius: "Service area radius",
  multi_location: "Multiple locations",
  fully_mobile: "Fully mobile",
  enquiry_contact: "Enquiry / contact",
  site_visit: "Site visit",
  virtual_consultation: "Virtual consultation",
  request_callback: "Request callback",
};

// -----------------------------------------------------------------------------
// RECOMMENDED · what each subtype suggests at onboarding and in the
// "Suggested for your business" section of /manage/capabilities.
// Non-exhaustive by design · a short, high-signal list per subtype.
// Not a permission; the owner can enable anything in AVAILABLE.
// -----------------------------------------------------------------------------
const R: Record<BusinessSubtype, readonly CapabilityKey[]> = {
  // Food
  restaurant: [
    "dine_in", "pickup", "local_delivery", "reservations",
    "physical_venue", "enquiry_contact",
  ],
  cafe: [
    "dine_in", "pickup", "local_delivery", "reservations",
    "physical_venue", "enquiry_contact",
  ],
  bakery: [
    "pickup", "local_delivery", "deposit_booking_fee", "enquiry_contact",
  ],
  food_maker: [
    "pickup", "local_delivery", "deposit_booking_fee", "enquiry_contact",
  ],
  catering: [
    "quote_request", "deposit_booking_fee", "at_customer_location",
    "at_business_location", "enquiry_contact",
  ],
  drinks: [
    "dine_in", "pickup", "local_delivery", "physical_venue", "enquiry_contact",
  ],
  food_delivery: [
    "local_delivery", "pickup", "service_area_radius", "enquiry_contact",
  ],
  // Accommodation
  hotel: [
    "room_booking", "availability_calendar", "deposit_booking_fee",
    "physical_venue", "enquiry_contact", "virtual_consultation",
  ],
  villa: [
    "room_booking", "availability_calendar", "deposit_booking_fee",
    "physical_venue", "at_business_location", "enquiry_contact",
    "virtual_consultation",
  ],
  guesthouse: [
    "room_booking", "availability_calendar", "deposit_booking_fee",
    "physical_venue", "enquiry_contact",
  ],
  homestay: [
    "room_booking", "availability_calendar", "physical_venue",
    "enquiry_contact",
  ],
  resort: [
    "room_booking", "availability_calendar", "deposit_booking_fee",
    "physical_venue", "enquiry_contact", "virtual_consultation",
  ],
  short_rental: [
    "room_booking", "availability_calendar", "deposit_booking_fee",
    "enquiry_contact",
  ],
  // Property
  for_sale: [
    "enquiry_only", "enquiry_contact", "site_visit", "virtual_consultation",
    "multi_location",
  ],
  for_rent: [
    "enquiry_only", "enquiry_contact", "site_visit", "virtual_consultation",
    "multi_location",
  ],
  developer: [
    "enquiry_only", "enquiry_contact", "site_visit", "virtual_consultation",
    "multi_location",
  ],
  agent: [
    "enquiry_only", "enquiry_contact", "site_visit", "virtual_consultation",
    "multi_location",
  ],
  // Products
  retail: [
    "pickup", "local_delivery", "national_shipping", "enquiry_contact",
  ],
  manufacturer: [
    "national_shipping", "international_shipping", "moq_wholesale",
    "quote_request", "enquiry_contact", "virtual_consultation",
  ],
  wholesale: [
    "national_shipping", "moq_wholesale", "quote_request", "enquiry_contact",
  ],
  local_artisan: [
    "pickup", "local_delivery", "national_shipping", "enquiry_contact",
  ],
  exporter: [
    "international_shipping", "national_shipping", "moq_wholesale",
    "quote_request", "enquiry_contact", "virtual_consultation",
  ],
  // Services
  beauty: [
    "appointments", "at_customer_location", "at_business_location",
    "service_area_radius", "enquiry_contact",
  ],
  health_wellness: [
    "appointments", "at_business_location", "enquiry_contact",
    "virtual_consultation",
  ],
  home_services: [
    "appointments", "recurring_service", "at_customer_location",
    "service_area_radius", "quote_request", "enquiry_contact",
  ],
  professional: [
    "appointments", "quote_request", "enquiry_contact",
    "virtual_consultation",
  ],
  trade_construction: [
    "quote_request", "site_visit", "at_customer_location",
    "service_area_radius", "enquiry_contact", "virtual_consultation",
  ],
  automotive: [
    "appointments", "at_business_location", "quote_request",
    "enquiry_contact",
  ],
  events: [
    "enquiry_contact", "quote_request", "at_customer_location",
    "at_business_location", "deposit_booking_fee",
  ],
  creative: [
    "appointments", "at_customer_location", "at_business_location",
    "quote_request", "virtual_consultation", "enquiry_contact",
  ],
};

export const CAPABILITY_RECOMMENDATIONS_BY_SUBTYPE: Readonly<
  Record<BusinessSubtype, readonly CapabilityKey[]>
> = R;

// -----------------------------------------------------------------------------
// Public selectors · each named precisely to prevent Finding #4 attacks.
// -----------------------------------------------------------------------------

/** Universal catalog · every implemented capability key. */
export function getAvailableCapabilities(): readonly CapabilityKey[] {
  return AVAILABLE_CAPABILITIES;
}

/** Subtype-sourced recommendations for the business's current primary +
 *  secondary profile. Union across all profile entries. Pure function. */
export function getRecommendedCapabilities(
  subtypes: readonly BusinessSubtype[],
): readonly CapabilityKey[] {
  const seen = new Set<CapabilityKey>();
  for (const s of subtypes) {
    for (const k of R[s] ?? []) seen.add(k);
  }
  return Array.from(seen);
}

/** Effective state · owner_override ?? recommendation ?? false. The owner's
 *  explicit setting wins. Overrides survive subtype changes because they
 *  are stored separately in the DB. */
export function getEffectiveCapability(
  key: CapabilityKey,
  input: BusinessEngineInput,
  subtypes: readonly BusinessSubtype[],
): boolean {
  const override = input.owner_state.capability_overrides[key];
  if (typeof override === "boolean") return override;
  const recommended = new Set(getRecommendedCapabilities(subtypes));
  return recommended.has(key);
}

/** Set of all effectively-enabled capabilities on the business. */
export function getEnabledCapabilities(
  input: BusinessEngineInput,
  subtypes: readonly BusinessSubtype[],
): Set<CapabilityKey> {
  const out = new Set<CapabilityKey>();
  for (const key of AVAILABLE_CAPABILITIES) {
    if (getEffectiveCapability(key, input, subtypes)) out.add(key);
  }
  return out;
}

// -----------------------------------------------------------------------------
// READY · per-capability data-sufficiency check (Finding #7 · two-tier
// feasibility). An ENABLED capability is not necessarily READY: an
// `online_payment` flag with no payment provider configured cannot complete
// a transaction; `local_delivery` with no zones configured cannot quote a
// price. The CTA resolver consults isCapabilityReady() in addition to
// getEffectiveCapability().
//
// Readiness checks are intentionally generous for Day One (presence of
// obvious fields), and tighten as each capability's edit UI lands.
// -----------------------------------------------------------------------------

type ReadyFn = (data: Record<string, unknown> | undefined) => boolean;

const nonEmpty = (v: unknown) =>
  v !== null && v !== undefined && (Array.isArray(v) ? v.length > 0 : v !== "" && v !== false);

const CAPABILITY_READY: Record<CapabilityKey, ReadyFn> = {
  // Fulfilment · all of these are action-shaped. For most, enabled alone
  // is sufficient to be ready (pickup = you'll pick up at the venue;
  // dine-in = you'll eat at the venue). Delivery variants need zones/fees
  // before a customer can actually complete an order.
  dine_in:                () => true,
  pickup:                 () => true,
  local_delivery:         (d) => nonEmpty(d?.["delivery_zones"]),
  national_shipping:      (d) => nonEmpty(d?.["shipping_rates"]) || nonEmpty(d?.["base_fee"]),
  international_shipping: (d) => nonEmpty(d?.["countries_served"]),
  at_customer_location:   () => true,
  at_business_location:   () => true,
  // Scheduling · booking surfaces need a bookable window to produce a
  // completable journey; a bare flag is not enough.
  reservations:           (d) => nonEmpty(d?.["booking_window"]) || nonEmpty(d?.["opening_hours"]),
  appointments:           (d) => nonEmpty(d?.["duration"]) && nonEmpty(d?.["booking_window"]),
  room_booking:           (d) => nonEmpty(d?.["check_in_time"]) && nonEmpty(d?.["check_out_time"]),
  availability_calendar:  (d) => nonEmpty(d?.["calendar_source"]),
  recurring_service:      (d) => nonEmpty(d?.["frequency_options"]),
  // Commerce · each has a minimum data shape required to actually quote /
  // charge / request. Flag alone is not enough.
  deposit_booking_fee:    (d) => nonEmpty(d?.["deposit_pct"]) || nonEmpty(d?.["deposit_amount"]),
  moq_wholesale:          (d) => nonEmpty(d?.["minimum_order"]) || nonEmpty(d?.["wholesale_tiers"]),
  quote_request:          () => true,
  enquiry_only:           () => true,
  online_payment:         (d) => nonEmpty(d?.["provider"]) || nonEmpty(d?.["qris_image_url"]),
  // Location · informational; presence of the flag + any address/radius is
  // sufficient for the cover to render the module.
  physical_venue:         (d) => nonEmpty(d?.["address"]) || nonEmpty(d?.["coords"]),
  service_area_radius:    (d) => nonEmpty(d?.["radius_km"]) || nonEmpty(d?.["zones"]),
  multi_location:         (d) => nonEmpty(d?.["locations"]),
  fully_mobile:           () => true,
  // Communication · each needs a reachable channel.
  enquiry_contact:        () => true,
  site_visit:             () => true,
  virtual_consultation:   () => true,
  request_callback:       (d) => nonEmpty(d?.["callback_hours"]) || nonEmpty(d?.["phone"]),
};

/** READY · does this capability have enough data to actually serve the
 *  customer action it represents? Called by the CTA resolver (Finding #7)
 *  on top of getEffectiveCapability(). ENABLED-but-not-READY surfaces as
 *  a visible warning in /manage/capabilities but never auto-disables the
 *  capability (owner intent is respected). */
export function isCapabilityReady(
  key: CapabilityKey,
  input: BusinessEngineInput,
): boolean {
  const check = CAPABILITY_READY[key];
  const data = input.capability_data[key];
  return check(data as Record<string, unknown> | undefined);
}

/** The set of capabilities that are BOTH enabled AND ready. The CTA
 *  resolver consults this for semantic feasibility (Rev 6 §12). */
export function getFeasibleCapabilities(
  input: BusinessEngineInput,
  subtypes: readonly BusinessSubtype[],
): Set<CapabilityKey> {
  const enabled = getEnabledCapabilities(input, subtypes);
  const out = new Set<CapabilityKey>();
  for (const key of enabled) {
    if (isCapabilityReady(key, input)) out.add(key);
  }
  return out;
}
