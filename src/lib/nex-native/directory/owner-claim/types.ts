// src/lib/nex-native/directory/owner-claim/types.ts
//
// NEX Directory · Owner Claim · typed form input shapes.
//
// What this module is
//   · The INPUT shape of the owner-authored claim draft, discriminated
//     by `kind` which mirrors the sealed Directory classification of
//     the canonical entity_type. One kind per adaptive form.
//   · Pure types + the inert factory `emptyDraft(kind)` which returns
//     a reasonable empty-shaped draft (NO fabricated content — just
//     empty arrays and null/undefined strings).
//
// What this module is NOT
//   · Not a VM. The VM lives in `src/lib/nex-native/directory/types.ts`
//     and is the READ contract.
//   · Not a validator. Validation lives in `./schema.ts`.
//   · Not persistence. SessionStorage access lives in `./draft-storage.ts`.
//   · Not a reflection of a DB column. Owner-authored draft content does
//     NOT land in the DB in this scope — see the honest cross-DB blocker
//     in `./actions.ts`.
//
// Reflection discipline
//   · The 6 `kind` values here map onto the 6 Directory-presentation
//     categories the adaptive form branches on. They are a projection
//     of the sealed 9-value `EntityType` enum into form-shape buckets:
//       accommodation       → kind: "accommodation"
//       food                → kind: "food"
//       vehicle_rental      → kind: "vehicle_rental"
//       service             → kind: "service"
//       transport           → kind: "transport"
//       marketplace_seller  → kind: "marketplace_seller"
//     EntityType `professional`, `community`, `natural_or_cultural_place`
//     do NOT branch into this form (the Directory UI gates them out —
//     persons and places take a different claim path).
//
// No fabrication
//   · Empty draft shapes contain EMPTY arrays, undefined optional strings,
//     and empty strings on REQUIRED strings so the UI's "required" state
//     is honest. The validator in schema.ts refuses to accept drafts
//     that are entirely empty of critical fields.

// ═════════════════════════════════════════════════════════════════════
// §1 · Sealed enum unions · reflections of migration 167 + friends
// ═════════════════════════════════════════════════════════════════════

/**
 * Sealed accommodation facilities · the universe of boolean amenity
 * flags an accommodation owner can tick. This is a Directory-presentation
 * enum (not a DB column yet) · it is deliberately short and uncontroversial.
 */
export const ACCOMMODATION_FACILITIES = [
  "wifi",
  "parking",
  "pool",
  "aircon",
  "breakfast",
  "restaurant",
  "bar",
  "gym",
  "spa",
  "laundry",
  "airport_shuttle",
  "pet_friendly",
  "family_rooms",
  "wheelchair_accessible",
] as const;
export type AccommodationFacility =
  typeof ACCOMMODATION_FACILITIES[number];

/**
 * Sealed dietary flags for food establishments. These describe the
 * establishment's offering · not an individual dish's attribute.
 */
export const DIETARY_FLAGS = [
  "halal",
  "kosher",
  "vegetarian",
  "vegan",
  "gluten_free",
  "dairy_free",
] as const;
export type DietaryFlag = typeof DIETARY_FLAGS[number];

/**
 * Sealed vehicle-rental type universe. Mirrors the shape that the eventual
 * `services_products` jsonb (migration 167) will accept POST-claim.
 */
export const VEHICLE_TYPES = [
  "motorbike",
  "scooter",
  "car",
  "van",
  "bicycle",
  "ebike",
  "truck",
  "boat",
  "jetski",
] as const;
export type VehicleType = typeof VEHICLE_TYPES[number];

/**
 * Service-side price-method enum (for service entity_type).
 */
export const SERVICE_PRICE_METHODS = [
  "fixed",
  "quote",
  "hourly",
  "per_job",
] as const;
export type ServicePriceMethod = typeof SERVICE_PRICE_METHODS[number];

/**
 * Transport-side price-method enum (for transport entity_type).
 */
export const TRANSPORT_PRICE_METHODS = [
  "fixed",
  "metered",
  "quote",
] as const;
export type TransportPriceMethod = typeof TRANSPORT_PRICE_METHODS[number];

// ═════════════════════════════════════════════════════════════════════
// §2 · Shared sub-input shapes
// ═════════════════════════════════════════════════════════════════════

/**
 * Day-of-week ISO numbering · 1=Monday … 7=Sunday (ISO 8601).
 */
export type IsoDayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const ISO_DAYS: readonly IsoDayOfWeek[] = [1, 2, 3, 4, 5, 6, 7];

/**
 * One day's opening-hours entry. `open` and `close` are 24h "HH:MM"
 * strings. `closed: true` means closed-all-day · in which case `open`
 * and `close` are empty strings (the UI greys them out).
 */
export interface OpeningHoursInput {
  readonly day: IsoDayOfWeek;
  readonly closed: boolean;
  readonly open: string;   // "HH:MM" or ""
  readonly close: string;  // "HH:MM" or ""
}

export function emptyOpeningHours(): OpeningHoursInput[] {
  return ISO_DAYS.map((d) => ({
    day: d,
    closed: false,
    open: "",
    close: "",
  }));
}

// ─── Accommodation ───────────────────────────────────────────────────

export interface RoomTypeInput {
  /** Human label · "Deluxe Twin", "Standard King", "Dorm 6-bed", etc. */
  label: string;
  /** Count of rooms of this type offered. 0 is allowed while editing;
   *  the validator rejects a saved draft of 0 if the room-type is the
   *  only one.  (We do NOT fabricate counts.) */
  count: number;
  /** Nightly rate (IDR) · integer, positive once validated. */
  nightlyRate: number | null;
  /** Max occupancy · null when unknown. */
  maxOccupancy: number | null;
}

export function emptyRoomType(): RoomTypeInput {
  return { label: "", count: 0, nightlyRate: null, maxOccupancy: null };
}

// ─── Food ─────────────────────────────────────────────────────────────

export interface MenuItemInput {
  readonly name: string;
  readonly price: number | null;  // IDR · positive integer when non-null
  readonly description?: string;
}

export interface MenuSectionInput {
  /** "Starters", "Mains", "Drinks", etc. */
  readonly label: string;
  readonly items: MenuItemInput[];
}

export function emptyMenuSection(): MenuSectionInput {
  return { label: "", items: [] };
}

// ─── Vehicle rental ──────────────────────────────────────────────────

export interface VehicleInput {
  readonly vehicleType: VehicleType | "";
  readonly model: string;
  readonly dailyRate: number | null;   // IDR
  readonly depositRequired: number | null;  // IDR · null = not required
}

export function emptyVehicle(): VehicleInput {
  return { vehicleType: "", model: "", dailyRate: null, depositRequired: null };
}

// ─── Rental terms (shared across vehicle rental) ─────────────────────

export interface RentalTermsInput {
  readonly minRentalDays: number | null;
  readonly maxRentalDays: number | null;
  readonly licenseRequired: boolean;
  readonly deliveryAvailable: boolean;
}

export function emptyRentalTerms(): RentalTermsInput {
  return {
    minRentalDays: null,
    maxRentalDays: null,
    licenseRequired: false,
    deliveryAvailable: false,
  };
}

// ═════════════════════════════════════════════════════════════════════
// §3 · OwnerClaimDraft · the discriminated union
// ═════════════════════════════════════════════════════════════════════

export type OwnerClaimDraftKind =
  | "accommodation"
  | "food"
  | "vehicle_rental"
  | "service"
  | "transport"
  | "marketplace_seller";

export type OwnerClaimDraft =
  | {
      readonly kind: "accommodation";
      readonly roomTypes: Partial<RoomTypeInput>[];
      readonly facilities: AccommodationFacility[];
      readonly description?: string;
      readonly airportDistance?: string;
    }
  | {
      readonly kind: "food";
      readonly cuisines: string[];
      readonly dietary: DietaryFlag[];
      readonly menuSections: MenuSectionInput[];
      readonly openingHours: OpeningHoursInput[];
      readonly description?: string;
    }
  | {
      readonly kind: "vehicle_rental";
      readonly vehicles: VehicleInput[];
      readonly terms?: Partial<RentalTermsInput>;
      readonly description?: string;
    }
  | {
      readonly kind: "service";
      readonly description: string;
      readonly serviceArea?: string;
      readonly priceMethod?: ServicePriceMethod;
      readonly operatingHours: OpeningHoursInput[];
    }
  | {
      readonly kind: "transport";
      readonly serviceTypes: string[];
      readonly coverage?: string;
      readonly priceMethod?: TransportPriceMethod;
    }
  | {
      readonly kind: "marketplace_seller";
      readonly productCategories: string[];
      readonly shippingScope?: string;
      readonly description?: string;
    };

// ═════════════════════════════════════════════════════════════════════
// §4 · Empty-draft factory · reasonable defaults · no fabrication
// ═════════════════════════════════════════════════════════════════════

/**
 * Returns a brand-new empty draft for the given kind. "Empty" means:
 *   · arrays start as `[]`
 *   · optional strings are `undefined`
 *   · required strings on `service` are `""`
 *   · `openingHours` / `operatingHours` are the 7-day skeleton with
 *     every day marked `closed:false, open:"", close:""` so the UI can
 *     show every day row at once.
 *
 * This factory NEVER fabricates content. The validator in schema.ts
 * will refuse to approve a draft that is still in this "empty" state.
 */
export function emptyDraft(kind: OwnerClaimDraftKind): OwnerClaimDraft {
  switch (kind) {
    case "accommodation":
      return {
        kind: "accommodation",
        roomTypes: [],
        facilities: [],
        description: undefined,
        airportDistance: undefined,
      };
    case "food":
      return {
        kind: "food",
        cuisines: [],
        dietary: [],
        menuSections: [],
        openingHours: emptyOpeningHours(),
        description: undefined,
      };
    case "vehicle_rental":
      return {
        kind: "vehicle_rental",
        vehicles: [],
        terms: undefined,
        description: undefined,
      };
    case "service":
      return {
        kind: "service",
        description: "",
        serviceArea: undefined,
        priceMethod: undefined,
        operatingHours: emptyOpeningHours(),
      };
    case "transport":
      return {
        kind: "transport",
        serviceTypes: [],
        coverage: undefined,
        priceMethod: undefined,
      };
    case "marketplace_seller":
      return {
        kind: "marketplace_seller",
        productCategories: [],
        shippingScope: undefined,
        description: undefined,
      };
  }
}

// ═════════════════════════════════════════════════════════════════════
// §5 · Preset vocabularies the UI consumes
// ═════════════════════════════════════════════════════════════════════

/**
 * Preset cuisine chips the food form offers. Owners can type their own
 * (the field is a free-text chip picker) but these are the quick picks.
 */
export const CUISINE_PRESETS = [
  "Indonesian",
  "Padang",
  "Chinese",
  "Japanese",
  "Western",
  "Fusion",
  "Vegetarian",
  "Halal",
  "Street Food",
  "Cafe",
] as const;

/**
 * Preset transport service-type chips.
 */
export const TRANSPORT_SERVICE_PRESETS = [
  "City ride",
  "Airport transfer",
  "Hourly hire",
  "Long distance",
  "Tour",
  "Delivery",
] as const;

// ═════════════════════════════════════════════════════════════════════
// §6 · Field error shape · consumed by schema.ts and the form UI
// ═════════════════════════════════════════════════════════════════════

/**
 * A single validation error. `path` is a human-oriented string pointing
 * at the field (e.g. "roomTypes[0].label"), `message` is an actionable
 * sentence the UI shows directly.
 */
export interface FieldError {
  readonly path: string;
  readonly message: string;
}

/**
 * Contact-channel enum · mirrors migration 176's `claim_channel` CHECK.
 */
export const CLAIM_CONTACT_CHANNELS = [
  "whatsapp",
  "email",
  "sms",
  "phone",
] as const;
export type ClaimContactChannel = typeof CLAIM_CONTACT_CHANNELS[number];
