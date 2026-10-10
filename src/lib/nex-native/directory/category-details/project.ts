// src/lib/nex-native/directory/category-details/project.ts
//
// NEX Directory · Category Detail Projection · pure function.
//
// What this module is
//   · A pure projection from a `DirectoryListingVM` (the Phase B VM) to
//     a `CategoryDetails` discriminated union. The projector reads only
//     `listing.entityType` and `listing.verticalPayload` — nothing else.
//   · Inline, dependency-free shape validators (zod-lite). Each helper
//     narrows an `unknown` into a typed shape and returns `null` when
//     the value fails validation. No npm dep is added.
//   · An inline OSM `opening_hours` parser that handles the simple
//     subset we actually see in the field today ("Mo-Fr 09:00-17:00",
//     "Sa,Su 10:00-14:00", multiple comma-separated day-time blocks).
//     When the parser can't be sure what the string means, it returns
//     an empty array — zero fabrication of hours we didn't verify.
//
// What this module is NOT
//   · Not an ingestion contract. The shape of
//     `business_canonical.services_products` is owned by the ingestion
//     pipeline. This projector reads whatever shape the pipeline wrote
//     and emits only validated subsets.
//   · Not a defaulting layer. A "mostly-valid" jsonb row produces an
//     empty projection, not a half-fabricated one.
//   · Not a database access path. Pure function. No I/O.
//
// Honest-empty discipline
//   · If `verticalPayload` is null or not an object → the projector
//     still returns a kind-matched shape with empty arrays / null
//     scalars. The consuming UI treats that as "collapse the section".
//   · If a field in the jsonb is present but malformed → it is dropped
//     from the projection. The downstream UI never sees it.
//   · The OSM `cuisine` string (semicolon-separated) is normalised to
//     an array, but a bare empty string yields `[]`.

import type { DirectoryListingVM } from "../types";
import type {
  AccommodationFacility,
  CategoryDetails,
  DietaryFlag,
  MenuItem,
  MenuSection,
  Money,
  OpeningHoursRange,
  RentalTerms,
  RoomType,
  ServicePriceMethod,
  TransportPriceMethod,
  VehicleKind,
  VehicleOffer,
} from "./types";
import {
  ACCOMMODATION_FACILITIES,
  DIETARY_FLAGS,
  SERVICE_PRICE_METHODS,
  TRANSPORT_PRICE_METHODS,
  VEHICLE_KINDS,
} from "./types";

// ═════════════════════════════════════════════════════════════════════
// §1 · Primitive validators
// ═════════════════════════════════════════════════════════════════════

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isFiniteNonNegativeNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0;
}

function asString(v: unknown): string | null {
  return isNonEmptyString(v) ? v : null;
}

function asStringArray(v: unknown): readonly string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    if (isNonEmptyString(item)) {
      out.push(item);
    }
  }
  return out;
}

function asMoney(v: unknown): Money | null {
  if (!isRecord(v)) return null;
  const { amount, currency } = v;
  if (!isFiniteNonNegativeNumber(amount)) return null;
  if (!isNonEmptyString(currency)) return null;
  return { amount, currency };
}

// ═════════════════════════════════════════════════════════════════════
// §2 · OSM opening_hours parser (minimal honest subset)
// ═════════════════════════════════════════════════════════════════════

const DAY_INDEX: Readonly<Record<string, 0 | 1 | 2 | 3 | 4 | 5 | 6>> = {
  Mo: 0,
  Tu: 1,
  We: 2,
  Th: 3,
  Fr: 4,
  Sa: 5,
  Su: 6,
};

const DAY_ORDER: readonly (keyof typeof DAY_INDEX)[] = [
  "Mo",
  "Tu",
  "We",
  "Th",
  "Fr",
  "Sa",
  "Su",
];

function parseDayToken(tok: string): readonly (0 | 1 | 2 | 3 | 4 | 5 | 6)[] | null {
  // Accepts "Mo", "Mo-Fr", "Sa,Su", "Mo,We,Fr"
  if (!tok) return null;
  const groups = tok.split(",");
  const out: (0 | 1 | 2 | 3 | 4 | 5 | 6)[] = [];
  for (const g of groups) {
    const trimmed = g.trim();
    if (trimmed.length === 0) return null;
    const dashIdx = trimmed.indexOf("-");
    if (dashIdx > 0) {
      const a = trimmed.slice(0, dashIdx);
      const b = trimmed.slice(dashIdx + 1);
      if (!(a in DAY_INDEX) || !(b in DAY_INDEX)) return null;
      const startIdx = DAY_ORDER.indexOf(a as keyof typeof DAY_INDEX);
      const endIdx = DAY_ORDER.indexOf(b as keyof typeof DAY_INDEX);
      if (startIdx < 0 || endIdx < 0 || endIdx < startIdx) return null;
      for (let i = startIdx; i <= endIdx; i++) {
        out.push(DAY_INDEX[DAY_ORDER[i]]);
      }
    } else {
      if (!(trimmed in DAY_INDEX)) return null;
      out.push(DAY_INDEX[trimmed as keyof typeof DAY_INDEX]);
    }
  }
  // dedupe preserving order
  const seen = new Set<number>();
  const unique: (0 | 1 | 2 | 3 | 4 | 5 | 6)[] = [];
  for (const d of out) {
    if (!seen.has(d)) {
      seen.add(d);
      unique.push(d);
    }
  }
  return unique;
}

function parseTimeRange(
  tok: string,
): { open: string; close: string } | null {
  // Accepts "09:00-17:00"
  const m = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/.exec(tok.trim());
  if (!m) return null;
  const openH = Number(m[1]);
  const openM = Number(m[2]);
  const closeH = Number(m[3]);
  const closeM = Number(m[4]);
  if (
    !Number.isInteger(openH) ||
    !Number.isInteger(openM) ||
    !Number.isInteger(closeH) ||
    !Number.isInteger(closeM) ||
    openH < 0 ||
    openH > 23 ||
    closeH < 0 ||
    closeH > 24 || // OSM allows 24:00 as a close
    openM < 0 ||
    openM > 59 ||
    closeM < 0 ||
    closeM > 59
  ) {
    return null;
  }
  const pad = (n: number): string => (n < 10 ? `0${n}` : String(n));
  return {
    open: `${pad(openH)}:${pad(openM)}`,
    close: `${pad(closeH)}:${pad(closeM)}`,
  };
}

/** Parse a (small subset of) OSM `opening_hours` string into typed
 *  ranges. Returns [] on anything we can't parse unambiguously —
 *  honest-empty discipline. "24/7" is explicitly supported and
 *  expands to all 7 days 00:00-24:00. */
function parseOsmOpeningHours(raw: string): readonly OpeningHoursRange[] {
  const s = raw.trim();
  if (s.length === 0) return [];
  if (s === "24/7") {
    const out: OpeningHoursRange[] = [];
    for (let d = 0; d < 7; d++) {
      out.push({
        day: d as 0 | 1 | 2 | 3 | 4 | 5 | 6,
        open: "00:00",
        close: "24:00",
      });
    }
    return out;
  }
  // The grammar we actually parse:  "<daytok> <timerange>(, <daytok> <timerange>)*"
  // Semicolons separate rules in OSM; we parse each independently.
  const rules = s.split(";");
  const out: OpeningHoursRange[] = [];
  for (const rawRule of rules) {
    const rule = rawRule.trim();
    if (rule.length === 0) continue;
    // A rule is "<daytok> <timerange>" or "<timerange>" (no day → all days).
    const parts = rule.split(/\s+/);
    let dayTok: string;
    let timeTok: string;
    if (parts.length === 1) {
      dayTok = "Mo-Su";
      timeTok = parts[0];
    } else if (parts.length === 2) {
      dayTok = parts[0];
      timeTok = parts[1];
    } else {
      // Grammar outside our honest subset.
      return [];
    }
    const days = parseDayToken(dayTok);
    const time = parseTimeRange(timeTok);
    if (days === null || time === null) {
      return [];
    }
    for (const d of days) {
      out.push({ day: d, open: time.open, close: time.close });
    }
  }
  // Sort by (day, open) for deterministic ordering.
  const sorted = [...out].sort((a, b) =>
    a.day !== b.day ? a.day - b.day : a.open.localeCompare(b.open),
  );
  return sorted;
}

/** Accepts either an array of structured ranges (owner-authored shape)
 *  or an OSM `opening_hours` string. Returns [] on anything we can't
 *  validate. */
function projectOpeningHours(
  structured: unknown,
  osmString: unknown,
): readonly OpeningHoursRange[] {
  if (Array.isArray(structured)) {
    const out: OpeningHoursRange[] = [];
    for (const item of structured) {
      if (!isRecord(item)) continue;
      const { day, open, close } = item;
      if (
        typeof day !== "number" ||
        !Number.isInteger(day) ||
        day < 0 ||
        day > 6
      ) {
        continue;
      }
      if (typeof open !== "string" || typeof close !== "string") continue;
      const parsed = parseTimeRange(`${open}-${close}`);
      if (parsed === null) continue;
      out.push({
        day: day as 0 | 1 | 2 | 3 | 4 | 5 | 6,
        open: parsed.open,
        close: parsed.close,
      });
    }
    return out;
  }
  if (typeof osmString === "string") {
    return parseOsmOpeningHours(osmString);
  }
  return [];
}

// ═════════════════════════════════════════════════════════════════════
// §3 · Food projection
// ═════════════════════════════════════════════════════════════════════

function projectCuisines(payload: Record<string, unknown>): readonly string[] {
  // Accept BOTH owner-authored `cuisines: string[]` AND OSM-shape
  // `cuisine: "indonesian;asian"` (semicolon-separated).
  if (Array.isArray(payload.cuisines)) {
    return asStringArray(payload.cuisines).map((s) => s.trim()).filter(
      (s) => s.length > 0,
    );
  }
  if (typeof payload.cuisine === "string") {
    const parts = payload.cuisine
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    return parts;
  }
  return [];
}

function projectDietary(payload: Record<string, unknown>): readonly DietaryFlag[] {
  if (!Array.isArray(payload.dietary)) return [];
  const flags: DietaryFlag[] = [];
  const seen = new Set<DietaryFlag>();
  for (const item of payload.dietary) {
    if (typeof item !== "string") continue;
    if ((DIETARY_FLAGS as readonly string[]).includes(item)) {
      const flag = item as DietaryFlag;
      if (!seen.has(flag)) {
        seen.add(flag);
        flags.push(flag);
      }
    }
  }
  return flags;
}

function projectMenuItem(v: unknown): MenuItem | null {
  if (!isRecord(v)) return null;
  if (!isNonEmptyString(v.name)) return null;
  const item: {
    name: string;
    priceFrom?: Money;
    description?: string;
    dietary?: readonly DietaryFlag[];
  } = {
    name: v.name,
  };
  const price = asMoney(v.priceFrom);
  if (price !== null) item.priceFrom = price;
  if (isNonEmptyString(v.description)) item.description = v.description;
  if (Array.isArray(v.dietary)) {
    const dietary: DietaryFlag[] = [];
    for (const d of v.dietary) {
      if (
        typeof d === "string" &&
        (DIETARY_FLAGS as readonly string[]).includes(d) &&
        !dietary.includes(d as DietaryFlag)
      ) {
        dietary.push(d as DietaryFlag);
      }
    }
    if (dietary.length > 0) item.dietary = dietary;
  }
  return item;
}

function projectMenu(payload: Record<string, unknown>): readonly MenuSection[] {
  if (!Array.isArray(payload.menu)) return [];
  const sections: MenuSection[] = [];
  for (const sec of payload.menu) {
    if (!isRecord(sec)) continue;
    if (!isNonEmptyString(sec.label)) continue;
    if (!Array.isArray(sec.items)) continue;
    const items: MenuItem[] = [];
    for (const raw of sec.items) {
      const projected = projectMenuItem(raw);
      if (projected !== null) items.push(projected);
    }
    if (items.length === 0) continue; // honest-empty: no items → drop section
    sections.push({ label: sec.label, items });
  }
  return sections;
}

function projectFood(payload: Record<string, unknown> | null): CategoryDetails {
  if (payload === null) {
    return {
      kind: "food",
      menu: [],
      cuisines: [],
      openingHours: [],
      dietary: [],
    };
  }
  return {
    kind: "food",
    menu: projectMenu(payload),
    cuisines: projectCuisines(payload),
    openingHours: projectOpeningHours(payload.opening_hours_ranges, payload.opening_hours),
    dietary: projectDietary(payload),
  };
}

// ═════════════════════════════════════════════════════════════════════
// §4 · Accommodation projection
// ═════════════════════════════════════════════════════════════════════

const BED_CONFIGS = [
  "single",
  "double",
  "twin",
  "queen",
  "king",
  "family",
] as const;
type BedConfig = (typeof BED_CONFIGS)[number];

function projectRoomType(v: unknown): RoomType | null {
  if (!isRecord(v)) return null;
  if (!isNonEmptyString(v.slug)) return null;
  if (!isNonEmptyString(v.label)) return null;
  const room: {
    slug: string;
    label: string;
    occupancy: number | null;
    bedConfiguration: BedConfig | null;
    bathroom: "ensuite" | "shared" | null;
    priceFrom?: Money;
    photos?: readonly string[];
  } = {
    slug: v.slug,
    label: v.label,
    occupancy:
      typeof v.occupancy === "number" &&
      Number.isInteger(v.occupancy) &&
      v.occupancy > 0
        ? v.occupancy
        : null,
    bedConfiguration:
      typeof v.bedConfiguration === "string" &&
      (BED_CONFIGS as readonly string[]).includes(v.bedConfiguration)
        ? (v.bedConfiguration as BedConfig)
        : null,
    bathroom:
      v.bathroom === "ensuite" || v.bathroom === "shared" ? v.bathroom : null,
  };
  const price = asMoney(v.priceFrom);
  if (price !== null) room.priceFrom = price;
  if (Array.isArray(v.photos)) {
    const photos = asStringArray(v.photos);
    if (photos.length > 0) room.photos = photos;
  }
  return room;
}

function projectFacilities(
  payload: Record<string, unknown>,
): readonly AccommodationFacility[] {
  if (!Array.isArray(payload.facilities)) return [];
  const out: AccommodationFacility[] = [];
  const seen = new Set<AccommodationFacility>();
  for (const item of payload.facilities) {
    if (
      typeof item === "string" &&
      (ACCOMMODATION_FACILITIES as readonly string[]).includes(item)
    ) {
      const facility = item as AccommodationFacility;
      if (!seen.has(facility)) {
        seen.add(facility);
        out.push(facility);
      }
    }
  }
  return out;
}

function projectAccommodation(
  payload: Record<string, unknown> | null,
): CategoryDetails {
  if (payload === null) {
    return { kind: "accommodation", roomTypes: [], facilities: [] };
  }
  const roomTypes: RoomType[] = [];
  if (Array.isArray(payload.roomTypes)) {
    for (const raw of payload.roomTypes) {
      const r = projectRoomType(raw);
      if (r !== null) roomTypes.push(r);
    }
  }
  return {
    kind: "accommodation",
    roomTypes,
    facilities: projectFacilities(payload),
  };
}

// ═════════════════════════════════════════════════════════════════════
// §5 · Vehicle rental projection
// ═════════════════════════════════════════════════════════════════════

function projectVehicleOffer(v: unknown): VehicleOffer | null {
  if (!isRecord(v)) return null;
  if (
    typeof v.vehicleType !== "string" ||
    !(VEHICLE_KINDS as readonly string[]).includes(v.vehicleType)
  ) {
    return null;
  }
  const offer: {
    vehicleType: VehicleKind;
    model?: string;
    transmission?: "manual" | "automatic";
    capacity?: number;
    dailyRate?: Money;
    depositRequired?: Money;
    includedEquipment?: readonly string[];
    licenceRequired?: string | null;
  } = {
    vehicleType: v.vehicleType as VehicleKind,
  };
  if (isNonEmptyString(v.model)) offer.model = v.model;
  if (v.transmission === "manual" || v.transmission === "automatic") {
    offer.transmission = v.transmission;
  }
  if (
    typeof v.capacity === "number" &&
    Number.isInteger(v.capacity) &&
    v.capacity > 0
  ) {
    offer.capacity = v.capacity;
  }
  const daily = asMoney(v.dailyRate);
  if (daily !== null) offer.dailyRate = daily;
  const dep = asMoney(v.depositRequired);
  if (dep !== null) offer.depositRequired = dep;
  if (Array.isArray(v.includedEquipment)) {
    const eq = asStringArray(v.includedEquipment);
    if (eq.length > 0) offer.includedEquipment = eq;
  }
  if (v.licenceRequired === null) {
    offer.licenceRequired = null;
  } else if (isNonEmptyString(v.licenceRequired)) {
    offer.licenceRequired = v.licenceRequired;
  }
  return offer;
}

function projectRentalTerms(v: unknown): RentalTerms | null {
  if (!isRecord(v)) return null;
  // At least one meaningful field must be present AND the `delivery`
  // field must be explicitly boolean or null. Otherwise → honest-null.
  const hasAnyField =
    v.minHours !== undefined ||
    v.maxDays !== undefined ||
    v.delivery !== undefined ||
    v.cancellation !== undefined;
  if (!hasAnyField) return null;
  const terms: {
    minHours?: number;
    maxDays?: number;
    delivery: boolean | null;
    cancellation?: string;
  } = {
    delivery:
      typeof v.delivery === "boolean"
        ? v.delivery
        : v.delivery === null
          ? null
          : null,
  };
  if (
    typeof v.minHours === "number" &&
    Number.isInteger(v.minHours) &&
    v.minHours > 0
  ) {
    terms.minHours = v.minHours;
  }
  if (
    typeof v.maxDays === "number" &&
    Number.isInteger(v.maxDays) &&
    v.maxDays > 0
  ) {
    terms.maxDays = v.maxDays;
  }
  if (isNonEmptyString(v.cancellation)) terms.cancellation = v.cancellation;
  return terms;
}

function projectVehicleRental(
  payload: Record<string, unknown> | null,
): CategoryDetails {
  if (payload === null) {
    return { kind: "vehicle_rental", vehicles: [], terms: null };
  }
  const vehicles: VehicleOffer[] = [];
  if (Array.isArray(payload.vehicles)) {
    for (const raw of payload.vehicles) {
      const projected = projectVehicleOffer(raw);
      if (projected !== null) vehicles.push(projected);
    }
  }
  return {
    kind: "vehicle_rental",
    vehicles,
    terms: projectRentalTerms(payload.terms),
  };
}

// ═════════════════════════════════════════════════════════════════════
// §6 · Service projection
// ═════════════════════════════════════════════════════════════════════

function projectServicePriceMethod(v: unknown): ServicePriceMethod | null {
  if (typeof v !== "string") return null;
  if ((SERVICE_PRICE_METHODS as readonly string[]).includes(v)) {
    return v as ServicePriceMethod;
  }
  return null;
}

function projectService(
  payload: Record<string, unknown> | null,
): CategoryDetails {
  if (payload === null) {
    return {
      kind: "service",
      description: null,
      serviceArea: null,
      priceMethod: null,
      operatingHours: [],
    };
  }
  return {
    kind: "service",
    description: asString(payload.description),
    serviceArea: asString(payload.serviceArea),
    priceMethod: projectServicePriceMethod(payload.priceMethod),
    operatingHours: projectOpeningHours(
      payload.operating_hours_ranges ?? payload.operatingHoursRanges,
      payload.opening_hours ?? payload.operating_hours,
    ),
  };
}

// ═════════════════════════════════════════════════════════════════════
// §7 · Transport projection
// ═════════════════════════════════════════════════════════════════════

function projectTransportPriceMethod(
  v: unknown,
): TransportPriceMethod | null {
  if (typeof v !== "string") return null;
  if ((TRANSPORT_PRICE_METHODS as readonly string[]).includes(v)) {
    return v as TransportPriceMethod;
  }
  return null;
}

function projectTransport(
  payload: Record<string, unknown> | null,
): CategoryDetails {
  if (payload === null) {
    return {
      kind: "transport",
      serviceTypes: [],
      coverage: null,
      priceMethod: null,
    };
  }
  return {
    kind: "transport",
    serviceTypes: Array.isArray(payload.serviceTypes)
      ? asStringArray(payload.serviceTypes)
      : [],
    coverage: asString(payload.coverage),
    priceMethod: projectTransportPriceMethod(payload.priceMethod),
  };
}

// ═════════════════════════════════════════════════════════════════════
// §8 · Marketplace seller projection
// ═════════════════════════════════════════════════════════════════════

function projectMarketplaceSeller(
  payload: Record<string, unknown> | null,
): CategoryDetails {
  if (payload === null) {
    return {
      kind: "marketplace_seller",
      productCategories: [],
      shippingScope: null,
    };
  }
  return {
    kind: "marketplace_seller",
    productCategories: Array.isArray(payload.productCategories)
      ? asStringArray(payload.productCategories)
      : [],
    shippingScope: asString(payload.shippingScope),
  };
}

// ═════════════════════════════════════════════════════════════════════
// §9 · Public entry point · dispatch on entity_type
// ═════════════════════════════════════════════════════════════════════

/**
 * Pure projection from a Directory VM to a typed category details
 * shape. Dispatches on `listing.entityType` and reads only
 * `listing.verticalPayload`. The function:
 *
 *   · returns `{ kind: "generic" }` for `place`, `professional`, or
 *     any future entity_type that this projection doesn't yet cover;
 *   · returns a kind-matched shape with empty arrays / null scalars
 *     when the jsonb payload is null or not an object;
 *   · only emits per-field values that pass inline validators —
 *     malformed or unexpected shapes are silently dropped from the
 *     projection rather than coerced into fabricated defaults.
 *
 * The function is deterministic: identical input → identical output.
 * No clock reads, no random, no I/O.
 */
export function projectCategoryDetails(
  listing: DirectoryListingVM,
): CategoryDetails {
  const payload: Record<string, unknown> | null = isRecord(
    listing.verticalPayload,
  )
    ? (listing.verticalPayload as Record<string, unknown>)
    : null;

  switch (listing.entityType) {
    case "food":
      return projectFood(payload);
    case "accommodation":
      return projectAccommodation(payload);
    case "vehicle_rental":
      return projectVehicleRental(payload);
    case "service":
      return projectService(payload);
    case "transport_driver":
    case "transport_operator":
      return projectTransport(payload);
    case "marketplace_seller":
      return projectMarketplaceSeller(payload);
    case "place":
    case "professional":
      return { kind: "generic" };
    default: {
      // Exhaustiveness: any new sealed entity_type (future wave) lands
      // here as `never` at type-check time. Runtime fallback is
      // "generic" (collapse the section).
      const _exhaustive: never = listing.entityType;
      void _exhaustive;
      return { kind: "generic" };
    }
  }
}
