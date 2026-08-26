// src/lib/nex-transport-acquisition/review-flags.ts
//
// REVIEW FLAGS · fraud/scam signal detector.
//
// Doctrine: never accuse. Return REVIEW_REQUIRED flags an operator can inspect.
// Signal, not verdict.

import type { TransportReviewFlag, TransportVehicleOntology } from "./types";
import { normaliseIndonesianPhone } from "./phone-normalisation";

export interface ProviderReviewInput {
  providerId: string;
  businessName: string | null;
  canonicalPhoneE164: string | null;
  rawPhoneInput?: string | null;
  vehicleTypes: TransportVehicleOntology[];
  sourceSnapshotCount: number;
  distinctBusinessesUsingSamePhoneAcrossUniverse?: number;
}

// Vehicle-type combinations that a single individual driver is unlikely to
// operate. Not accusatory · used only to raise REVIEW_REQUIRED.
const INCOMPATIBLE_KIND_PAIRS: [TransportVehicleOntology, TransportVehicleOntology][] = [
  ["motorcycle", "truck"],
  ["motorcycle", "small_truck"],
  ["motorcycle", "lorry"],
  ["motorcycle", "bus"],
  ["motorcycle", "minibus"],
  ["car", "truck"],
  ["car", "lorry"],
  ["car", "bus"],
];

// Numbers commonly used by generic aggregator directories (hotlines, call centres).
// This list is intentionally short and conservative · caller may extend.
const GENERIC_DIRECTORY_NUMBERS = new Set<string>([
  "+62811111111",
  "+62800000000",
]);

export function detectReviewFlags(input: ProviderReviewInput): TransportReviewFlag[] {
  const flags = new Set<TransportReviewFlag>();

  // Invalid phone format
  if (input.rawPhoneInput != null) {
    const norm = normaliseIndonesianPhone(input.rawPhoneInput);
    if (norm.status === "REJECTED") flags.add("invalid_phone_format");
  }

  // Insufficient source evidence
  if (input.sourceSnapshotCount === 0) flags.add("source_evidence_insufficient");

  // Duplicate phone across unrelated businesses
  if (
    input.canonicalPhoneE164 != null &&
    (input.distinctBusinessesUsingSamePhoneAcrossUniverse ?? 0) > 1
  ) {
    flags.add("duplicate_phone_across_unrelated");
  }

  // Generic directory number
  if (input.canonicalPhoneE164 && GENERIC_DIRECTORY_NUMBERS.has(input.canonicalPhoneE164)) {
    flags.add("generic_directory_number");
  }

  // Impossible / incompatible vehicle claims
  for (const [a, b] of INCOMPATIBLE_KIND_PAIRS) {
    if (input.vehicleTypes.includes(a) && input.vehicleTypes.includes(b)) {
      flags.add("incompatible_vehicle_types");
      break;
    }
  }

  return [...flags];
}
