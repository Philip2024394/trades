// src/lib/nex-driver/job-type-classifier.ts
//
// JOB TYPE CLASSIFIER · natural-language → structured trip job type.
//
// Doctrine anchors:
//   - Truth Invariant (2026-08-22): the classifier never invents a job type ·
//     ambiguous input returns AMBIGUOUS with disambiguation options.
//   - Traveller Protection Principle: parcel job types require the specific
//     evidence fields the delivery flow needs (recipient · dimensions · weight
//     · prohibited-goods declaration) so a passenger flow is never accidentally
//     used to carry a package.
//   - Legal Boundary First (2026-08-23): large-goods classifications require
//     load evidence — cannot classify a 500 kg shipment as `parcel_motorbike`
//     just because the user said "bike".
//
// Pure. No live services. Callers feed the raw phrase + optional structured
// hints (weight/dimensions) and receive a classification result.

import type { TripJobType } from "./driver-network-types";

export type RequiredField =
  | "pickup"
  | "destination"
  | "passenger_count"
  | "preferred_vehicle"
  | "requested_pickup_time"
  | "accessibility_notes"
  | "recipient_name"
  | "recipient_phone"
  | "parcel_type"
  | "parcel_length_mm"
  | "parcel_width_mm"
  | "parcel_height_mm"
  | "parcel_weight_kg"
  | "parcel_package_count"
  | "parcel_fragile"
  | "parcel_declared_value"
  | "prohibited_goods_declaration"
  | "parcel_photo_optional"
  | "delivery_urgency"
  | "load_description"
  | "loading_assistance_needed"
  | "unloading_assistance_needed"
  | "pickup_access_notes"
  | "destination_access_notes"
  | "special_instructions";

export interface ClassificationHints {
  parcelWeightKg?: number;
  parcelLengthMm?: number;
  parcelWidthMm?: number;
  parcelHeightMm?: number;
}

export interface DisambiguationOption {
  jobType: TripJobType;
  label: string;
  because: string;
}

export interface ClassificationOK {
  status: "OK";
  jobType: TripJobType;
  requiredFields: RequiredField[];
  interpretation: string;
  unknown: string;
}

export interface ClassificationAmbiguous {
  status: "AMBIGUOUS";
  candidates: DisambiguationOption[];
  interpretation: string;
  unknown: string;
}

export interface ClassificationUnknown {
  status: "UNKNOWN";
  interpretation: string;
  unknown: string;
}

export type ClassificationResult = ClassificationOK | ClassificationAmbiguous | ClassificationUnknown;

// ── REQUIRED-FIELD MAP ────────────────────────────────────────────────

const PASSENGER_FIELDS: RequiredField[] = [
  "pickup", "destination", "passenger_count", "preferred_vehicle",
  "requested_pickup_time", "accessibility_notes",
];

const PARCEL_FIELDS: RequiredField[] = [
  "pickup", "destination",
  "recipient_name", "recipient_phone",
  "parcel_type",
  "parcel_length_mm", "parcel_width_mm", "parcel_height_mm",
  "parcel_weight_kg", "parcel_package_count",
  "parcel_fragile", "parcel_declared_value",
  "prohibited_goods_declaration", "parcel_photo_optional",
  "delivery_urgency",
];

const LARGE_GOODS_FIELDS: RequiredField[] = [
  "pickup", "destination",
  "load_description",
  "parcel_length_mm", "parcel_width_mm", "parcel_height_mm",
  "parcel_weight_kg",
  "loading_assistance_needed", "unloading_assistance_needed",
  "pickup_access_notes", "destination_access_notes",
  "delivery_urgency", "special_instructions",
];

export function requiredFieldsFor(jobType: TripJobType): RequiredField[] {
  switch (jobType) {
    case "passenger_car":
    case "passenger_motorbike":
    case "hotel_to_airport":
    case "airport_to_hotel":
    case "family":
    case "tourist_trip":
      return PASSENGER_FIELDS;
    case "parcel_motorbike":
    case "parcel_car":
    case "shopping_pickup":
    case "local_delivery":
    case "luggage":
      return PARCEL_FIELDS;
    case "large_goods_pickup":
    case "large_goods_small_truck":
    case "large_goods_truck":
      return LARGE_GOODS_FIELDS;
  }
}

// ── PARCEL SIZING BOUNDS (matches typical Indonesian benchmarks) ──────
// Motorbike parcel limits: up to ~20 kg · roughly 40×40×40 cm max
// Car parcel limits:       up to ~100 kg · roughly 100×100×80 cm max
// Beyond → large goods (pickup / small_truck / truck)

const MOTORBIKE_PARCEL_MAX_KG = 20;
const MOTORBIKE_PARCEL_MAX_DIM_MM = 400;
const CAR_PARCEL_MAX_KG = 100;
const CAR_PARCEL_MAX_DIM_MM_LONG = 1000;
const CAR_PARCEL_MAX_DIM_MM_HEIGHT = 800;
const LARGE_GOODS_PICKUP_MAX_KG = 1000;
const LARGE_GOODS_SMALL_TRUCK_MAX_KG = 3000;

/** Recommend the smallest capable vehicle-scoped job type for a parcel. */
export function recommendParcelJobType(hints: ClassificationHints): TripJobType | null {
  const w = hints.parcelWeightKg;
  const longest = Math.max(hints.parcelLengthMm ?? 0, hints.parcelWidthMm ?? 0);
  const height = hints.parcelHeightMm ?? 0;
  if (w == null) return null; // no weight → cannot recommend safely
  if (w <= MOTORBIKE_PARCEL_MAX_KG && longest <= MOTORBIKE_PARCEL_MAX_DIM_MM && height <= MOTORBIKE_PARCEL_MAX_DIM_MM) {
    return "parcel_motorbike";
  }
  if (w <= CAR_PARCEL_MAX_KG && longest <= CAR_PARCEL_MAX_DIM_MM_LONG && height <= CAR_PARCEL_MAX_DIM_MM_HEIGHT) {
    return "parcel_car";
  }
  if (w <= LARGE_GOODS_PICKUP_MAX_KG) return "large_goods_pickup";
  if (w <= LARGE_GOODS_SMALL_TRUCK_MAX_KG) return "large_goods_small_truck";
  return "large_goods_truck";
}

// ── NL CLASSIFIER ─────────────────────────────────────────────────────

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

const BIKE_WORDS = ["bike", "motorbike", "motorcycle", "scooter", "ojek", "ojol", "motor"];
const CAR_WORDS = ["car", "mpv", "sedan", "van"];
const PARCEL_WORDS = ["parcel", "package", "box", "send", "delivery", "kirim", "paket", "deliver"];
const PASSENGER_WORDS = ["ride", "taxi", "trip", "travel", "passenger"];
const LARGE_WORDS = ["truck", "pickup", "goods", "furniture", "kulkas", "lemari"];
const AIRPORT_WORDS = ["airport", "yia", "bandara"];
const HOTEL_WORDS = ["hotel"];

function hasAny(tokens: string[], set: string[]): boolean {
  return tokens.some((t) => set.includes(t));
}

/**
 * Classify a natural-language input into a structured job type.
 * `hints` may include weight/dimensions that influence parcel-size recommendation.
 */
export function classifyJobType(input: string, hints: ClassificationHints = {}): ClassificationResult {
  const normalised = normalise(input);
  const tokens = normalised.split(" ").filter(Boolean);

  const bike = hasAny(tokens, BIKE_WORDS);
  const car = hasAny(tokens, CAR_WORDS);
  const parcel = hasAny(tokens, PARCEL_WORDS);
  const passenger = hasAny(tokens, PASSENGER_WORDS);
  const large = hasAny(tokens, LARGE_WORDS);
  const airport = hasAny(tokens, AIRPORT_WORDS);
  const hotel = hasAny(tokens, HOTEL_WORDS);

  const commonUnknown = "This classification is based on the words used. Confirm the details before dispatch.";

  // Large-goods trumps · always require load evidence
  if (large || (hints.parcelWeightKg != null && hints.parcelWeightKg > CAR_PARCEL_MAX_KG)) {
    const recommended = recommendParcelJobType(hints) ?? "large_goods_pickup";
    if (recommended.startsWith("large_goods_")) {
      return {
        status: "OK",
        jobType: recommended,
        requiredFields: requiredFieldsFor(recommended),
        interpretation: `Classified as ${recommended.replace(/_/g, " ")} based on the words and any size/weight hints supplied.`,
        unknown: commonUnknown,
      };
    }
  }

  // Airport transfer hints (hotel↔airport specialisation)
  if (airport && (hotel || car || passenger)) {
    const jt: TripJobType = tokens.indexOf("hotel") < tokens.indexOf("airport")
      ? "hotel_to_airport"
      : tokens.indexOf("airport") < tokens.indexOf("hotel") && tokens.indexOf("hotel") !== -1
        ? "airport_to_hotel"
        : "hotel_to_airport";
    return {
      status: "OK",
      jobType: jt,
      requiredFields: requiredFieldsFor(jt),
      interpretation: `Classified as ${jt.replace(/_/g, " ")} because the request mentions an airport and a hotel.`,
      unknown: commonUnknown,
    };
  }

  // Parcel + vehicle
  if (parcel) {
    if (bike && !car) {
      // If weight/dimensions exceed motorbike bounds, escalate.
      const recommended = recommendParcelJobType(hints);
      if (recommended && recommended !== "parcel_motorbike") {
        return {
          status: "OK",
          jobType: recommended,
          requiredFields: requiredFieldsFor(recommended),
          interpretation: `Requested bike parcel · but the weight/dimensions exceed motorbike limits · recommended ${recommended.replace(/_/g, " ")}.`,
          unknown: commonUnknown,
        };
      }
      return {
        status: "OK",
        jobType: "parcel_motorbike",
        requiredFields: requiredFieldsFor("parcel_motorbike"),
        interpretation: "Classified as parcel · motorbike.",
        unknown: commonUnknown,
      };
    }
    if (car && !bike) {
      const recommended = recommendParcelJobType(hints);
      if (recommended && recommended !== "parcel_car" && recommended.startsWith("large_goods_")) {
        return {
          status: "OK",
          jobType: recommended,
          requiredFields: requiredFieldsFor(recommended),
          interpretation: `Requested car parcel · but the weight/dimensions exceed car limits · recommended ${recommended.replace(/_/g, " ")}.`,
          unknown: commonUnknown,
        };
      }
      return {
        status: "OK",
        jobType: "parcel_car",
        requiredFields: requiredFieldsFor("parcel_car"),
        interpretation: "Classified as parcel · car.",
        unknown: commonUnknown,
      };
    }
    // Parcel but vehicle not specified → recommend from size / fall back to bike
    const recommended = recommendParcelJobType(hints);
    if (recommended) {
      return {
        status: "OK",
        jobType: recommended,
        requiredFields: requiredFieldsFor(recommended),
        interpretation: `Classified from parcel weight/dimensions as ${recommended.replace(/_/g, " ")}.`,
        unknown: commonUnknown,
      };
    }
    return {
      status: "AMBIGUOUS",
      candidates: [
        { jobType: "parcel_motorbike", label: "Bike parcel", because: "Cheapest · limited to ~20 kg" },
        { jobType: "parcel_car",       label: "Car parcel",  because: "Handles up to ~100 kg" },
        { jobType: "large_goods_pickup", label: "Pickup", because: "Larger loads · furniture · appliances" },
      ],
      interpretation: "The request mentions a parcel but does not specify the vehicle. Ask the traveller what to send so NEX can recommend the right size.",
      unknown: commonUnknown,
    };
  }

  // Passenger + vehicle
  if (bike && !car) {
    return {
      status: "OK",
      jobType: "passenger_motorbike",
      requiredFields: requiredFieldsFor("passenger_motorbike"),
      interpretation: "Classified as passenger · motorbike.",
      unknown: commonUnknown,
    };
  }
  if (car && !bike) {
    // Ambiguous between passenger and parcel · ask
    return {
      status: "AMBIGUOUS",
      candidates: [
        { jobType: "passenger_car", label: "Car ride", because: "For a person travelling" },
        { jobType: "parcel_car",    label: "Car parcel", because: "For an item being sent" },
      ],
      interpretation: "The request mentions a car but does not specify passenger or parcel. Ask which.",
      unknown: commonUnknown,
    };
  }
  if (bike && car) {
    return {
      status: "AMBIGUOUS",
      candidates: [
        { jobType: "passenger_motorbike", label: "Motorbike ride", because: "Fast in traffic · single passenger" },
        { jobType: "passenger_car",       label: "Car ride",       because: "More comfortable · multiple passengers" },
      ],
      interpretation: "The request mentions both bike and car. Ask which the traveller prefers.",
      unknown: commonUnknown,
    };
  }
  if (passenger) {
    return {
      status: "AMBIGUOUS",
      candidates: [
        { jobType: "passenger_motorbike", label: "Motorbike ride", because: "Fast · limited to one passenger" },
        { jobType: "passenger_car",       label: "Car ride",       because: "Comfortable · multiple passengers" },
      ],
      interpretation: "The request is a passenger ride but the vehicle is not specified. Ask.",
      unknown: commonUnknown,
    };
  }

  return {
    status: "UNKNOWN",
    interpretation: "NEX could not classify this request confidently.",
    unknown: "Ask the traveller to describe what they are travelling with · what they want to send · or the destination + purpose.",
  };
}
