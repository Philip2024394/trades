// src/lib/nex-provider/vehicle-catalogue.ts
//
// VEHICLE CATALOGUE · types + pure representation composer.
//
// Doctrine anchors:
//   - Vehicle catalogue (2026-08-23): driver declares vehicle at registration ·
//     NEX maps to catalogue entry · verification required before customer-facing
//     representation may show brand/model/class.
//   - Legal Boundary First (2026-08-23): vehicle info shown to customers must
//     reflect verified reality.
//   - Reputation Non-Weapon (2026-08-23): unverified vehicles are surfaced
//     honestly as "unverified" · never hidden or silently promoted.
//
// This module returns a VehicleRepresentation that booking cards consume.
// Bright-line: an unverified vehicle NEVER carries brand/model/class in the
// customer-facing shape — the representation is marked `isVerified: false`
// with an explicit `unverifiedNote`. Premium classes require class_confirmed.

export type VehicleClass =
  | "scooter"
  | "motorbike_standard"
  | "motorbike_premium"
  | "car_small"
  | "car_mpv"
  | "car_premium_mpv"
  | "car_premium"
  | "van"
  | "minibus";

export type VehicleVerificationState =
  | "unverified"
  | "documents_submitted"
  | "verified"
  | "rejected"
  | "expired";

export const PREMIUM_VEHICLE_CLASSES: readonly VehicleClass[] = [
  "motorbike_premium",
  "car_premium_mpv",
  "car_premium",
] as const;

export function isPremiumClass(c: VehicleClass): boolean {
  return PREMIUM_VEHICLE_CLASSES.includes(c);
}

export type VehicleKind =
  | "motorcycle"
  | "car"
  | "pickup"
  | "small_truck"
  | "truck"
  | "van"
  | "minibus";

export interface Manufacturer {
  manufacturerId: string;
  name: string;
  homeCountry: string | null;
  discontinuedAt: Date | null;
  notes: string | null;
}

export interface VehicleCatalogueEntry {
  catalogueId: string;
  brand: string;
  model: string;
  vehicleClass: VehicleClass;
  imageRef: string | null;
  introducedAt: Date;
  deprecatedAt: Date | null;
  notes: string | null;
  // New hierarchy + capacity fields (all optional to preserve backward compat)
  manufacturerId?: string | null;
  variant?: string | null;
  vehicleKind?: VehicleKind | null;
  displayName?: string | null;
  passengerCapacity?: number | null;
  luggageCapacityKg?: number | null;
  luggageDimensionsMm?: { length: number; width: number; height: number } | null;
}

/**
 * Compose the human-readable display name for a catalogue entry. Prefers the
 * explicit displayName field · falls back to brand + model + variant.
 */
export function entryDisplayName(entry: VehicleCatalogueEntry): string {
  if (entry.displayName && entry.displayName.trim().length > 0) return entry.displayName;
  return entry.variant ? `${entry.brand} ${entry.model} ${entry.variant}` : `${entry.brand} ${entry.model}`;
}

/**
 * Return the list of manufacturers (deduplicated · sorted alphabetically),
 * derived from a catalogue snapshot. Callers may prefer to query the
 * manufacturer table directly in production; this pure helper is for tests
 * and offline composition.
 */
export function listManufacturersFromEntries(entries: VehicleCatalogueEntry[]): string[] {
  return [...new Set(entries.filter((e) => !e.deprecatedAt).map((e) => e.brand))].sort();
}

export interface ModelSummary {
  brand: string;
  model: string;
  vehicleKind: VehicleKind | null;
  vehicleClass: VehicleClass;
  displayName: string;
  variants: string[];
}

/**
 * List models available for a given manufacturer name. Filters deprecated
 * entries. Groups by (brand, model) and collects variants.
 */
export function listModelsForManufacturer(
  entries: VehicleCatalogueEntry[],
  manufacturerName: string,
): ModelSummary[] {
  const active = entries.filter((e) => !e.deprecatedAt && e.brand === manufacturerName);
  const grouped = new Map<string, ModelSummary>();
  for (const e of active) {
    const key = `${e.brand}::${e.model}`;
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, {
        brand: e.brand,
        model: e.model,
        vehicleKind: e.vehicleKind ?? null,
        vehicleClass: e.vehicleClass,
        displayName: entryDisplayName(e),
        variants: e.variant ? [e.variant] : [],
      });
    } else if (e.variant && !existing.variants.includes(e.variant)) {
      existing.variants.push(e.variant);
    }
  }
  return [...grouped.values()].sort((a, b) => a.model.localeCompare(b.model));
}

/**
 * Filter catalogue entries suitable for a given vehicle kind (e.g. all
 * motorcycles for the motorbike selection screen).
 */
export function listByVehicleKind(
  entries: VehicleCatalogueEntry[],
  kind: VehicleKind,
): VehicleCatalogueEntry[] {
  return entries.filter((e) => !e.deprecatedAt && e.vehicleKind === kind);
}

/**
 * Kinds that can honestly serve a given trip job type. Never a suggestion the
 * driver can force · used by dispatch / booking-card composers to filter.
 */
export function vehicleKindsForJobType(jobType: string): readonly VehicleKind[] {
  switch (jobType) {
    case "passenger_motorbike":       return ["motorcycle"] as const;
    case "passenger_car":             return ["car", "van", "minibus"] as const;
    case "parcel_motorbike":          return ["motorcycle"] as const;
    case "parcel_car":                return ["car", "van", "pickup"] as const;
    case "large_goods_pickup":        return ["pickup"] as const;
    case "large_goods_small_truck":   return ["small_truck"] as const;
    case "large_goods_truck":         return ["truck"] as const;
    case "hotel_to_airport":          return ["car", "van", "minibus"] as const;
    case "airport_to_hotel":          return ["car", "van", "minibus"] as const;
    case "family":                    return ["car", "van", "minibus"] as const;
    case "tourist_trip":              return ["car", "van", "minibus", "motorcycle"] as const;
    case "shopping_pickup":           return ["motorcycle", "car"] as const;
    case "local_delivery":            return ["motorcycle", "car"] as const;
    case "luggage":                   return ["car", "van", "pickup"] as const;
    default:                          return [] as const;
  }
}

export interface DriverVehicleVerification {
  verificationId: string;
  driverId: string;
  catalogueId: string;
  state: VehicleVerificationState;
  submittedAt: Date | null;
  verifiedAt: Date | null;
  verifiedBy: string | null;
  classConfirmed: boolean;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  expiresAt: Date | null;
}

export interface VehicleRepresentation {
  driverId: string;
  isVerified: boolean;
  catalogueId: string | null;
  brand: string | null;
  model: string | null;
  vehicleClass: VehicleClass | null;
  imageRef: string | null;
  isPremiumClass: boolean;
  isDeprecatedEntry: boolean;
  unverifiedNote: string | null;
  provenance: {
    verificationState: VehicleVerificationState | "no_declaration";
    verifiedBy: string | null;
    verifiedAt: Date | null;
    classConfirmed: boolean;
  };
}

export interface ComposeVehicleInput {
  driverId: string;
  declaredCatalogueId: string | null;
  catalogue: VehicleCatalogueEntry[];
  verifications: DriverVehicleVerification[];
  now: Date;
}

const UNVERIFIED_REPR = (driverId: string, note: string, provenance: VehicleRepresentation["provenance"]): VehicleRepresentation => ({
  driverId,
  isVerified: false,
  catalogueId: null,
  brand: null,
  model: null,
  vehicleClass: null,
  imageRef: null,
  isPremiumClass: false,
  isDeprecatedEntry: false,
  unverifiedNote: note,
  provenance,
});

/**
 * Compose the customer-facing vehicle representation for a driver. If the
 * driver's declared vehicle is unverified, expired, rejected, or (for premium
 * classes) not class-confirmed, the representation is marked unverified with
 * an explicit note.
 */
export function composeVehicleRepresentation(input: ComposeVehicleInput): VehicleRepresentation {
  if (!input.declaredCatalogueId) {
    return UNVERIFIED_REPR(input.driverId, "Driver has not declared a vehicle.", {
      verificationState: "no_declaration",
      verifiedBy: null,
      verifiedAt: null,
      classConfirmed: false,
    });
  }
  const entry = input.catalogue.find((c) => c.catalogueId === input.declaredCatalogueId);
  if (!entry) {
    return UNVERIFIED_REPR(input.driverId, "Declared vehicle is not in the current catalogue.", {
      verificationState: "no_declaration",
      verifiedBy: null,
      verifiedAt: null,
      classConfirmed: false,
    });
  }
  const verification = input.verifications.find(
    (v) => v.driverId === input.driverId && v.catalogueId === input.declaredCatalogueId,
  );
  const state = verification?.state ?? "unverified";
  const provenance: VehicleRepresentation["provenance"] = {
    verificationState: state,
    verifiedBy: verification?.verifiedBy ?? null,
    verifiedAt: verification?.verifiedAt ?? null,
    classConfirmed: verification?.classConfirmed ?? false,
  };

  if (state !== "verified") {
    return UNVERIFIED_REPR(input.driverId, `Vehicle verification state is '${state}'.`, provenance);
  }
  if (verification!.expiresAt && verification!.expiresAt.getTime() <= input.now.getTime()) {
    return UNVERIFIED_REPR(input.driverId, "Vehicle verification has expired.", provenance);
  }
  if (isPremiumClass(entry.vehicleClass) && !verification!.classConfirmed) {
    return UNVERIFIED_REPR(
      input.driverId,
      `Premium class '${entry.vehicleClass}' requires class-confirming evidence.`,
      provenance,
    );
  }
  const isDeprecated = entry.deprecatedAt != null && entry.deprecatedAt.getTime() <= input.now.getTime();

  return {
    driverId: input.driverId,
    isVerified: true,
    catalogueId: entry.catalogueId,
    brand: entry.brand,
    model: entry.model,
    vehicleClass: entry.vehicleClass,
    imageRef: entry.imageRef,
    isPremiumClass: isPremiumClass(entry.vehicleClass),
    isDeprecatedEntry: isDeprecated,
    unverifiedNote: isDeprecated ? "This vehicle model is deprecated in the catalogue." : null,
    provenance,
  };
}

/**
 * Human-readable vehicle class label. Used for booking card display.
 */
export function vehicleClassLabel(c: VehicleClass): string {
  switch (c) {
    case "scooter":              return "Scooter";
    case "motorbike_standard":   return "Motorbike";
    case "motorbike_premium":    return "Premium motorbike";
    case "car_small":            return "Small car";
    case "car_mpv":              return "MPV";
    case "car_premium_mpv":      return "Premium MPV";
    case "car_premium":          return "Premium car";
    case "van":                  return "Van";
    case "minibus":              return "Minibus";
  }
}
