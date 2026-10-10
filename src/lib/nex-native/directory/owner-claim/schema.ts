// src/lib/nex-native/directory/owner-claim/schema.ts
//
// NEX Directory · Owner Claim · pure draft validators.
//
// What this module is
//   · A single public entry point `validateClaimDraft(draft)` that
//     dispatches on `draft.kind` and returns either
//       { ok: true }                      · the draft passes
//       { ok: false; errors: FieldError[] } · the draft has one or more
//                                             actionable field errors.
//   · Pure, synchronous, no-DB, no-network, no-filesystem.
//
// What this module is NOT
//   · Not a persistence layer (see draft-storage.ts).
//   · Not a validation of the eventual canonical row (that lives
//     in migration 167 CHECK constraints and the sealed canonical
//     resolver pipeline).
//
// No-fabrication discipline
//   · The validator REJECTS empty critical fields with a clear
//     message. It does NOT auto-fill, auto-correct, or auto-pad
//     missing data. The owner enters the truth about their business
//     or the draft stays red.

import type {
  AccommodationFacility,
  FieldError,
  OpeningHoursInput,
  OwnerClaimDraft,
  VehicleType,
} from "./types";
import {
  ACCOMMODATION_FACILITIES,
  DIETARY_FLAGS,
  SERVICE_PRICE_METHODS,
  TRANSPORT_PRICE_METHODS,
  VEHICLE_TYPES,
} from "./types";

export type ValidateClaimDraftResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly errors: readonly FieldError[] };

// ═════════════════════════════════════════════════════════════════════
// §1 · Small shared primitives
// ═════════════════════════════════════════════════════════════════════

const HHMM_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

function isNonBlankString(x: unknown): x is string {
  return typeof x === "string" && x.trim().length > 0;
}

function isPositiveInteger(x: unknown): x is number {
  return typeof x === "number"
    && Number.isFinite(x)
    && Number.isInteger(x)
    && x > 0;
}

function isNonNegativeInteger(x: unknown): x is number {
  return typeof x === "number"
    && Number.isFinite(x)
    && Number.isInteger(x)
    && x >= 0;
}

function isValidHHMM(x: string): boolean {
  return HHMM_RE.test(x);
}

function validateOpeningHoursRow(
  hr: OpeningHoursInput,
  pathPrefix: string,
  errors: FieldError[],
): void {
  if (hr.closed) {
    // closed-all-day · open/close must be empty, no further checks
    return;
  }
  if (!hr.open || !hr.close) {
    errors.push({
      path: `${pathPrefix}`,
      message: "Enter both open and close times, or mark the day closed.",
    });
    return;
  }
  if (!isValidHHMM(hr.open)) {
    errors.push({
      path: `${pathPrefix}.open`,
      message: `Open time '${hr.open}' is not a valid 24h HH:MM value.`,
    });
  }
  if (!isValidHHMM(hr.close)) {
    errors.push({
      path: `${pathPrefix}.close`,
      message: `Close time '${hr.close}' is not a valid 24h HH:MM value.`,
    });
  }
}

// ═════════════════════════════════════════════════════════════════════
// §2 · Per-kind validators
// ═════════════════════════════════════════════════════════════════════

function validateAccommodation(
  draft: Extract<OwnerClaimDraft, { kind: "accommodation" }>,
): FieldError[] {
  const errors: FieldError[] = [];

  if (!Array.isArray(draft.roomTypes) || draft.roomTypes.length === 0) {
    errors.push({
      path: "roomTypes",
      message: "Add at least one room type.",
    });
  } else {
    const labelled = draft.roomTypes.filter(
      (r) => isNonBlankString(r.label),
    );
    if (labelled.length === 0) {
      errors.push({
        path: "roomTypes",
        message: "At least one room type needs a label.",
      });
    }
    draft.roomTypes.forEach((r, idx) => {
      if (r.label !== undefined && !isNonBlankString(r.label)) {
        errors.push({
          path: `roomTypes[${idx}].label`,
          message: "Room type label cannot be blank.",
        });
      }
      if (r.nightlyRate !== undefined && r.nightlyRate !== null
          && !isPositiveInteger(r.nightlyRate)) {
        errors.push({
          path: `roomTypes[${idx}].nightlyRate`,
          message: "Nightly rate must be a positive number.",
        });
      }
      if (r.count !== undefined && !isNonNegativeInteger(r.count)) {
        errors.push({
          path: `roomTypes[${idx}].count`,
          message: "Room count must be a non-negative whole number.",
        });
      }
      if (r.maxOccupancy !== undefined && r.maxOccupancy !== null
          && !isPositiveInteger(r.maxOccupancy)) {
        errors.push({
          path: `roomTypes[${idx}].maxOccupancy`,
          message: "Max occupancy must be a positive whole number.",
        });
      }
    });
  }

  if (!Array.isArray(draft.facilities)) {
    errors.push({
      path: "facilities",
      message: "Facilities must be a list.",
    });
  } else {
    const sealed: ReadonlySet<AccommodationFacility> =
      new Set(ACCOMMODATION_FACILITIES);
    draft.facilities.forEach((f, idx) => {
      if (!sealed.has(f as AccommodationFacility)) {
        errors.push({
          path: `facilities[${idx}]`,
          message: `Facility '${String(f)}' is not a recognised option.`,
        });
      }
    });
  }

  if (draft.description !== undefined
      && typeof draft.description === "string"
      && draft.description.length > 2000) {
    errors.push({
      path: "description",
      message: "Description must be 2000 characters or fewer.",
    });
  }

  return errors;
}

function validateFood(
  draft: Extract<OwnerClaimDraft, { kind: "food" }>,
): FieldError[] {
  const errors: FieldError[] = [];

  const hasCuisines =
    Array.isArray(draft.cuisines) && draft.cuisines.length > 0;
  const hasMenu =
    Array.isArray(draft.menuSections) && draft.menuSections.length > 0;
  const hasAnyHour =
    Array.isArray(draft.openingHours)
    && draft.openingHours.some((h) => !h.closed && h.open && h.close);

  if (!hasCuisines && !hasMenu && !hasAnyHour) {
    errors.push({
      path: "food",
      message:
        "Add cuisines, a menu section, or opening hours so people can"
        + " find your restaurant.",
    });
  }

  // Menu-item price validation (per entry).
  if (Array.isArray(draft.menuSections)) {
    draft.menuSections.forEach((section, sIdx) => {
      if (!isNonBlankString(section.label)) {
        errors.push({
          path: `menuSections[${sIdx}].label`,
          message: "Menu section needs a title (e.g. 'Mains').",
        });
      }
      if (Array.isArray(section.items)) {
        section.items.forEach((item, iIdx) => {
          if (!isNonBlankString(item.name)) {
            errors.push({
              path: `menuSections[${sIdx}].items[${iIdx}].name`,
              message: "Menu item needs a name.",
            });
          }
          if (item.price !== null && item.price !== undefined
              && !isPositiveInteger(item.price)) {
            errors.push({
              path: `menuSections[${sIdx}].items[${iIdx}].price`,
              message: "Price must be a positive number.",
            });
          }
        });
      }
    });
  }

  // Opening-hours format validation.
  if (Array.isArray(draft.openingHours)) {
    draft.openingHours.forEach((hr, idx) => {
      validateOpeningHoursRow(hr, `openingHours[${idx}]`, errors);
    });
  }

  // Dietary enum sanity.
  if (Array.isArray(draft.dietary)) {
    const sealed: ReadonlySet<string> = new Set(DIETARY_FLAGS);
    draft.dietary.forEach((d, idx) => {
      if (!sealed.has(d)) {
        errors.push({
          path: `dietary[${idx}]`,
          message: `Dietary flag '${String(d)}' is not a recognised option.`,
        });
      }
    });
  }

  if (draft.description !== undefined
      && typeof draft.description === "string"
      && draft.description.length > 2000) {
    errors.push({
      path: "description",
      message: "Description must be 2000 characters or fewer.",
    });
  }

  return errors;
}

function validateVehicleRental(
  draft: Extract<OwnerClaimDraft, { kind: "vehicle_rental" }>,
): FieldError[] {
  const errors: FieldError[] = [];

  if (!Array.isArray(draft.vehicles) || draft.vehicles.length === 0) {
    errors.push({
      path: "vehicles",
      message: "Add at least one vehicle you rent out.",
    });
    return errors;
  }

  const sealed: ReadonlySet<string> = new Set(VEHICLE_TYPES);
  draft.vehicles.forEach((v, idx) => {
    if (!v.vehicleType || !sealed.has(v.vehicleType as VehicleType)) {
      errors.push({
        path: `vehicles[${idx}].vehicleType`,
        message: "Choose a vehicle type.",
      });
    }
    if (!isNonBlankString(v.model)) {
      errors.push({
        path: `vehicles[${idx}].model`,
        message: "Enter the vehicle's model.",
      });
    }
    if (v.dailyRate === null || v.dailyRate === undefined
        || !isPositiveInteger(v.dailyRate)) {
      errors.push({
        path: `vehicles[${idx}].dailyRate`,
        message: "Daily rate must be a positive number.",
      });
    }
    if (v.depositRequired !== null && v.depositRequired !== undefined
        && !isNonNegativeInteger(v.depositRequired)) {
      errors.push({
        path: `vehicles[${idx}].depositRequired`,
        message: "Deposit must be a non-negative number.",
      });
    }
  });

  if (draft.terms) {
    if (draft.terms.minRentalDays !== null
        && draft.terms.minRentalDays !== undefined
        && !isPositiveInteger(draft.terms.minRentalDays)) {
      errors.push({
        path: "terms.minRentalDays",
        message: "Minimum rental days must be a positive whole number.",
      });
    }
    if (draft.terms.maxRentalDays !== null
        && draft.terms.maxRentalDays !== undefined
        && !isPositiveInteger(draft.terms.maxRentalDays)) {
      errors.push({
        path: "terms.maxRentalDays",
        message: "Maximum rental days must be a positive whole number.",
      });
    }
    if (isPositiveInteger(draft.terms.minRentalDays)
        && isPositiveInteger(draft.terms.maxRentalDays)
        && draft.terms.minRentalDays > draft.terms.maxRentalDays) {
      errors.push({
        path: "terms.maxRentalDays",
        message: "Maximum rental days must be greater than or equal to minimum.",
      });
    }
  }

  return errors;
}

function validateService(
  draft: Extract<OwnerClaimDraft, { kind: "service" }>,
): FieldError[] {
  const errors: FieldError[] = [];

  if (!isNonBlankString(draft.description)) {
    errors.push({
      path: "description",
      message: "Describe your service in a few sentences.",
    });
  } else {
    const len = draft.description.trim().length;
    if (len < 10) {
      errors.push({
        path: "description",
        message: "Description is too short (at least 10 characters).",
      });
    }
    if (len > 2000) {
      errors.push({
        path: "description",
        message: "Description must be 2000 characters or fewer.",
      });
    }
  }

  if (draft.priceMethod !== undefined
      && !SERVICE_PRICE_METHODS.includes(draft.priceMethod)) {
    errors.push({
      path: "priceMethod",
      message: `Price method '${String(draft.priceMethod)}' is not recognised.`,
    });
  }

  if (Array.isArray(draft.operatingHours)) {
    draft.operatingHours.forEach((hr, idx) => {
      validateOpeningHoursRow(hr, `operatingHours[${idx}]`, errors);
    });
  }

  return errors;
}

function validateTransport(
  draft: Extract<OwnerClaimDraft, { kind: "transport" }>,
): FieldError[] {
  const errors: FieldError[] = [];

  if (!Array.isArray(draft.serviceTypes) || draft.serviceTypes.length === 0) {
    errors.push({
      path: "serviceTypes",
      message: "Add at least one service type you offer.",
    });
  } else {
    draft.serviceTypes.forEach((s, idx) => {
      if (!isNonBlankString(s)) {
        errors.push({
          path: `serviceTypes[${idx}]`,
          message: "Service type cannot be blank.",
        });
      }
    });
  }

  if (draft.priceMethod !== undefined
      && !TRANSPORT_PRICE_METHODS.includes(draft.priceMethod)) {
    errors.push({
      path: "priceMethod",
      message: `Price method '${String(draft.priceMethod)}' is not recognised.`,
    });
  }

  return errors;
}

function validateMarketplaceSeller(
  draft: Extract<OwnerClaimDraft, { kind: "marketplace_seller" }>,
): FieldError[] {
  const errors: FieldError[] = [];

  if (!Array.isArray(draft.productCategories)
      || draft.productCategories.length === 0) {
    errors.push({
      path: "productCategories",
      message: "Add at least one product category you sell.",
    });
  } else {
    draft.productCategories.forEach((c, idx) => {
      if (!isNonBlankString(c)) {
        errors.push({
          path: `productCategories[${idx}]`,
          message: "Product category cannot be blank.",
        });
      }
    });
  }

  if (draft.description !== undefined
      && typeof draft.description === "string"
      && draft.description.length > 2000) {
    errors.push({
      path: "description",
      message: "Description must be 2000 characters or fewer.",
    });
  }

  return errors;
}

// ═════════════════════════════════════════════════════════════════════
// §3 · Public entry point
// ═════════════════════════════════════════════════════════════════════

/**
 * Pure, deterministic validation of an owner claim draft.
 *
 * Returns `{ ok: true }` when the draft is complete enough to be
 * submitted alongside a contact-channel for code issuance. Returns
 * `{ ok: false, errors }` with ONE or MORE actionable field errors
 * when the draft is incomplete or has invalid values.
 *
 * The validator does NOT:
 *   · fabricate missing fields,
 *   · auto-correct values,
 *   · touch the DB or network,
 *   · depend on `now` or any ambient state.
 */
export function validateClaimDraft(
  draft: OwnerClaimDraft,
): ValidateClaimDraftResult {
  if (!draft || typeof draft !== "object" || typeof draft.kind !== "string") {
    return {
      ok: false,
      errors: [{ path: "", message: "Draft shape is invalid." }],
    };
  }

  let errors: FieldError[] = [];
  switch (draft.kind) {
    case "accommodation":
      errors = validateAccommodation(draft);
      break;
    case "food":
      errors = validateFood(draft);
      break;
    case "vehicle_rental":
      errors = validateVehicleRental(draft);
      break;
    case "service":
      errors = validateService(draft);
      break;
    case "transport":
      errors = validateTransport(draft);
      break;
    case "marketplace_seller":
      errors = validateMarketplaceSeller(draft);
      break;
    default:
      return {
        ok: false,
        errors: [{
          path: "kind",
          message: `Unknown draft kind '${String((draft as { kind: string }).kind)}'.`,
        }],
      };
  }

  return errors.length === 0
    ? { ok: true }
    : { ok: false, errors };
}
