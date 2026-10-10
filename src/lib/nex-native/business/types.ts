// src/lib/nex-native/business/types.ts
//
// NEX Business Experience · types for Revision 6 (FROZEN · 2026-10-02).
// -----------------------------------------------------------------------------
// Load-bearing principles (never violate):
//
//   1. Classification can influence the starting point. It can never
//      define the boundary of the system.
//   2. Recommendations may influence the starting configuration; they
//      must never become hidden permissions.
//
// Seven kinds of object · none collapsible into another:
//   Capability          · something a business can enable to DO
//   Content             · something a business can create / show / sell
//   DocumentaryEvidence · something that PROVES a claim (epistemic ladder)
//   TrustSignal         · something that DEMONSTRATES credibility (presence)
//   Profile             · identity + recommendation context
//   Theme               · visual identity (universal)
//   Template            · structural presentation (universal)
//
// Theme and Template IDs are defined elsewhere (chat-theme-service +
// cover/layout-ids). They are referenced here only to show the chain
// is complete.

export type BusinessCategory =
  | "food"
  | "accommodation"
  | "property"
  | "products"
  | "services";

// -----------------------------------------------------------------------------
// Subtypes · 30 total · behavioural only (property's inventory type and
// listing mode live on the individual listing, not here).
// -----------------------------------------------------------------------------
export type FoodSubtype =
  | "restaurant"
  | "cafe"
  | "bakery"
  | "food_maker"
  | "catering"
  | "drinks"
  | "food_delivery";

export type AccommodationSubtype =
  | "hotel"
  | "villa"
  | "guesthouse"
  | "homestay"
  | "resort"
  | "short_rental";

export type PropertySubtype =
  | "for_sale"
  | "for_rent"
  | "developer"
  | "agent";

export type ProductsSubtype =
  | "retail"
  | "manufacturer"
  | "wholesale"
  | "local_artisan"
  | "exporter"
  | "motorbike_shop";

export type ServicesSubtype =
  | "beauty"
  | "health_wellness"
  | "home_services"
  | "professional"
  | "trade_construction"
  | "automotive"
  | "events"
  | "creative";

export type BusinessSubtype =
  | FoodSubtype
  | AccommodationSubtype
  | PropertySubtype
  | ProductsSubtype
  | ServicesSubtype;

export interface BusinessProfileEntry {
  category: BusinessCategory;
  subtype: BusinessSubtype;
}

export interface BusinessProfile {
  primary: BusinessProfileEntry;
  secondary: BusinessProfileEntry[];
}

// -----------------------------------------------------------------------------
// Content types · universal catalog · AVAILABLE on every NEX forever.
// -----------------------------------------------------------------------------
export type ContentTypeKey =
  | "menu_item"
  | "product"
  | "service"
  | "accommodation_unit"
  | "property_listing"
  | "portfolio_item"
  | "offer"
  | "testimonial";

// -----------------------------------------------------------------------------
// Capabilities · Day-One operational catalog (~24).
// Fulfilment · Scheduling · Commerce foundations · Location · Communication.
// Trust items are NOT here · they live in DocumentaryEvidence (§6a).
// -----------------------------------------------------------------------------
export type CapabilityKey =
  // Fulfilment / Access
  | "dine_in"
  | "pickup"
  | "local_delivery"
  | "national_shipping"
  | "international_shipping"
  | "at_customer_location"
  | "at_business_location"
  // Scheduling
  | "reservations"
  | "appointments"
  | "room_booking"
  | "availability_calendar"
  | "recurring_service"
  // Commerce foundations
  | "deposit_booking_fee"
  | "moq_wholesale"
  | "quote_request"
  | "enquiry_only"
  | "online_payment"
  // Location
  | "physical_venue"
  | "service_area_radius"
  | "multi_location"
  | "fully_mobile"
  // Communication
  | "enquiry_contact"
  | "site_visit"
  | "virtual_consultation"
  | "request_callback";

// -----------------------------------------------------------------------------
// Documentary evidence · status machine (unknown → self_declared → verified
// → expired → not_applicable).
// -----------------------------------------------------------------------------
export type EvidenceStatus =
  | "unknown"
  | "self_declared"
  | "verified"
  | "expired"
  | "not_applicable";

export type DocumentaryEvidenceKey =
  | "business_license"
  | "halal_cert"
  | "pirt_bpom"
  | "cppb_hygiene"
  | "insurance"
  | "credentials"
  | "compliance_evidence";

export interface DocumentaryEvidenceEntry {
  status: EvidenceStatus;
  /** Shape differs per key · engine treats as opaque jsonb. */
  data?: Record<string, unknown> | unknown[];
}

export type DocumentaryEvidenceMap = Partial<
  Record<DocumentaryEvidenceKey, DocumentaryEvidenceEntry>
>;

// -----------------------------------------------------------------------------
// Trust signals · presence model · NO status machine.
// Portfolio and testimonials live in content tables; the trust layer
// reads them as presence-model signals. This type lists the signal
// keys the Trust Scan can consult.
// -----------------------------------------------------------------------------
export type TrustSignalKey =
  | "portfolio"
  | "testimonials"
  | "reviews"
  | "business_history"
  | "completed_projects";

// -----------------------------------------------------------------------------
// CTA · intent (never fulfilment).
// -----------------------------------------------------------------------------
export type CtaIntent =
  | "order"
  | "book"
  | "appointment"
  | "reserve"
  | "enquire"
  | "quote"
  | "callback"
  | "buy";

// -----------------------------------------------------------------------------
// Terminology · context + concept.
// -----------------------------------------------------------------------------
export type TerminologyContext =
  | "menu"
  | "restaurant"
  | "accommodation"
  | "service"
  | "appointment"
  | "reservation"
  | "product"
  | "property"
  | "offer"
  | "event"
  | "portfolio"
  | "commerce"
  | "enquiry"
  | "quote"
  | "callback"
  | "site_visit"
  | "consultation";

export type TerminologyConcept =
  | "catalog"
  | "item"
  | "order"
  | "cart"
  | "shop"
  | "action"
  | "session"
  | "booking"
  | "reservation"
  | "appointment"
  | "deal";

export interface LocalizedTerm {
  en: string;
  id: string;
}

export type TerminologyKey = `${TerminologyContext}.${TerminologyConcept}`;

export type TerminologyOverrides = Partial<Record<TerminologyKey, LocalizedTerm>>;

// -----------------------------------------------------------------------------
// Owner-state blob · what the DB stores (matches migration 126 columns).
// -----------------------------------------------------------------------------
export interface BusinessOwnerState {
  profile: BusinessProfile | null;
  capability_overrides: Partial<Record<CapabilityKey, boolean>>;
  content_overrides: Partial<Record<ContentTypeKey, boolean>>;
  terminology_overrides: TerminologyOverrides;
  documentary_evidence: DocumentaryEvidenceMap;
  cta_preference: CtaIntent | null;
}

// -----------------------------------------------------------------------------
// Capability data · optional configuration beside a capability.
// Each capability may carry its own shape. The ready() function per
// capability (Finding #7) consults this to decide whether the capability
// is operationally complete, not merely flagged ON.
// -----------------------------------------------------------------------------
export type CapabilityData = Partial<Record<CapabilityKey, Record<string, unknown>>>;

// -----------------------------------------------------------------------------
// The business row shape the engine consumes · a thin bundle of the
// owner state + any derived content counts needed for feasibility
// checks. The engine never mutates this; it reads and computes.
// -----------------------------------------------------------------------------
export interface BusinessEngineInput {
  owner_state: BusinessOwnerState;
  capability_data: CapabilityData;
  /** How many enabled items of each content type the business has.
   *  Feeds semantic feasibility · an Order CTA requires orderable
   *  content WITH at least one item (Finding #7). */
  content_counts: Partial<Record<ContentTypeKey, number>>;
}
