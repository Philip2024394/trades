// src/lib/nex-native/directory/category-details/types.ts
//
// NEX Directory · Category Detail Projection · types.
//
// What this module is
//   · Typed shapes for the per-entity_type presentation payload the
//     Directory detail panel renders beneath the identity + CTA block.
//   · A discriminated union keyed by `kind` that mirrors the sealed
//     9-value `entity_type` enum (migration 167 · lines 269-279), with
//     the three transport-related entity_types collapsed into a single
//     "transport" presentation kind, and `professional` folded into
//     the generic kind (professional-specific presentation deferred).
//   · The one typed contract the `projectCategoryDetails` pure function
//     emits and the `<CategoryDetailSections />` component consumes.
//
// What this module is NOT
//   · Not a DB model — these shapes are PROJECTIONS of jsonb columns
//     (`business_canonical.services_products`). No field is written
//     back. No field has a side-channel to the database.
//   · Not a fabrication layer — every field is either a validated
//     projection of a real jsonb value or absent. Null stays null;
//     empty arrays mean "no entries were present or validated".
//   · Not an ingestion contract — ingestion owns the jsonb shape.
//     This module reads whatever shape ingestion published and emits
//     only validated subsets.
//
// Architectural invariants
//   · Discriminated union · `kind` is the sole discriminator.
//   · Every array field is readonly-like at the type level (consumers
//     treat them as immutable projections).
//   · The projector never emits an item that fails validation. The
//     consequence is that an "almost-but-not-quite valid" jsonb row
//     disappears from the UI rather than rendering a half-defaulted
//     card. This is intentional — honest empty > fake content.

// ─────────────────────────────────────────────────────────────────────
// §1 · Shared primitives
// ─────────────────────────────────────────────────────────────────────

/** Money in a specific currency. The projector only accepts
 *  { amount: finite non-negative number, currency: non-empty string }.
 *  Any other shape is dropped from the projection. */
export interface Money {
  readonly amount: number;
  readonly currency: string;
}

/** 24-hour-clock opening-hours range. Days follow ISO 8601 weekday
 *  numbering collapsed to 0-6 (0 = Mon, 6 = Sun) to match OSM's
 *  Mo..Su ordering used by the inline parser. The `open` and `close`
 *  strings are "HH:mm" with the hour zero-padded. The projector only
 *  emits ranges that satisfy that shape. */
export interface OpeningHoursRange {
  readonly day: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  readonly open: string;
  readonly close: string;
}

// ─────────────────────────────────────────────────────────────────────
// §2 · Accommodation
// ─────────────────────────────────────────────────────────────────────

/** A single room type offered by an accommodation listing.
 *  `slug` is a stable id (owner-authored or derived from label);
 *  `label` is the human-readable name. `occupancy` is max guests. */
export interface RoomType {
  readonly slug: string;
  readonly label: string;
  readonly occupancy: number | null;
  readonly bedConfiguration:
    | "single"
    | "double"
    | "twin"
    | "queen"
    | "king"
    | "family"
    | null;
  readonly bathroom: "ensuite" | "shared" | null;
  readonly priceFrom?: Money;
  readonly photos?: readonly string[];
}

/** Sealed accommodation facility vocabulary. The projector drops any
 *  value not in this set rather than fabricating a chip. */
export type AccommodationFacility =
  | "wifi"
  | "pool"
  | "parking"
  | "restaurant"
  | "bar"
  | "laundry"
  | "breakfast"
  | "housekeeping"
  | "airport_pickup"
  | "ac"
  | "spa"
  | "gym"
  | "beach_access"
  | "kitchen"
  | "family_friendly"
  | "pet_friendly";

export const ACCOMMODATION_FACILITIES: readonly AccommodationFacility[] = [
  "wifi",
  "pool",
  "parking",
  "restaurant",
  "bar",
  "laundry",
  "breakfast",
  "housekeeping",
  "airport_pickup",
  "ac",
  "spa",
  "gym",
  "beach_access",
  "kitchen",
  "family_friendly",
  "pet_friendly",
];

// ─────────────────────────────────────────────────────────────────────
// §3 · Food
// ─────────────────────────────────────────────────────────────────────

/** Sealed dietary vocabulary. */
export type DietaryFlag =
  | "halal"
  | "vegetarian"
  | "vegan"
  | "gluten_free"
  | "pork_free"
  | "alcohol_free";

export const DIETARY_FLAGS: readonly DietaryFlag[] = [
  "halal",
  "vegetarian",
  "vegan",
  "gluten_free",
  "pork_free",
  "alcohol_free",
];

export interface MenuItem {
  readonly name: string;
  readonly priceFrom?: Money;
  readonly description?: string;
  readonly dietary?: readonly DietaryFlag[];
}

export interface MenuSection {
  readonly label: string;
  readonly items: readonly MenuItem[];
}

// ─────────────────────────────────────────────────────────────────────
// §4 · Vehicle rental
// ─────────────────────────────────────────────────────────────────────

export type VehicleKind =
  | "motorbike"
  | "scooter"
  | "car"
  | "bicycle"
  | "van"
  | "boat";

export const VEHICLE_KINDS: readonly VehicleKind[] = [
  "motorbike",
  "scooter",
  "car",
  "bicycle",
  "van",
  "boat",
];

export interface VehicleOffer {
  readonly vehicleType: VehicleKind;
  readonly model?: string;
  readonly transmission?: "manual" | "automatic";
  readonly capacity?: number;
  readonly dailyRate?: Money;
  readonly depositRequired?: Money;
  readonly includedEquipment?: readonly string[];
  readonly licenceRequired?: string | null;
}

export interface RentalTerms {
  readonly minHours?: number;
  readonly maxDays?: number;
  readonly delivery: boolean | null;
  readonly cancellation?: string;
}

// ─────────────────────────────────────────────────────────────────────
// §5 · Service / Transport / Marketplace price methods
// ─────────────────────────────────────────────────────────────────────

export type ServicePriceMethod = "fixed" | "quote" | "hourly" | "per_job";
export type TransportPriceMethod = "fixed" | "metered" | "quote";

export const SERVICE_PRICE_METHODS: readonly ServicePriceMethod[] = [
  "fixed",
  "quote",
  "hourly",
  "per_job",
];
export const TRANSPORT_PRICE_METHODS: readonly TransportPriceMethod[] = [
  "fixed",
  "metered",
  "quote",
];

// ─────────────────────────────────────────────────────────────────────
// §6 · Discriminated union · the projector's output
// ─────────────────────────────────────────────────────────────────────

export type CategoryDetails =
  | {
      readonly kind: "accommodation";
      readonly roomTypes: readonly RoomType[];
      readonly facilities: readonly AccommodationFacility[];
    }
  | {
      readonly kind: "food";
      readonly menu: readonly MenuSection[];
      readonly cuisines: readonly string[];
      readonly openingHours: readonly OpeningHoursRange[];
      readonly dietary: readonly DietaryFlag[];
    }
  | {
      readonly kind: "vehicle_rental";
      readonly vehicles: readonly VehicleOffer[];
      readonly terms: RentalTerms | null;
    }
  | {
      readonly kind: "service";
      readonly description: string | null;
      readonly serviceArea: string | null;
      readonly priceMethod: ServicePriceMethod | null;
      readonly operatingHours: readonly OpeningHoursRange[];
    }
  | {
      readonly kind: "transport";
      readonly serviceTypes: readonly string[];
      readonly coverage: string | null;
      readonly priceMethod: TransportPriceMethod | null;
    }
  | {
      readonly kind: "marketplace_seller";
      readonly productCategories: readonly string[];
      readonly shippingScope: string | null;
    }
  | {
      readonly kind: "generic";
    };

/** The seven kinds this projection emits · deliberately a value-level
 *  const so tests can exhaustively iterate. */
export const CATEGORY_DETAIL_KINDS: readonly CategoryDetails["kind"][] = [
  "accommodation",
  "food",
  "vehicle_rental",
  "service",
  "transport",
  "marketplace_seller",
  "generic",
];
