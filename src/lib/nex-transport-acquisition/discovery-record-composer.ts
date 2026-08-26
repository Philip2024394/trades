// src/lib/nex-transport-acquisition/discovery-record-composer.ts
//
// DISCOVERY RECORD COMPOSER · assembles a Transport Acquisition Record from
// raw source input · pure · with full provenance chain.
//
// Doctrine anchors:
//   - Public-Contact-Only rule (2026-08-23): source_kind must pass source
//     classification; otherwise composer refuses.
//   - Truth Invariant: every field traces back to a source snapshot.
//   - Two Universes doctrine: discovery record enters `discovered` stage · never
//     later stages automatically.

import type {
  TransportAcquisitionRecord,
  TransportAcquisitionSourceSnapshot,
  TransportProviderKind,
  TransportSourceKind,
  TransportVehicleOntology,
  PublicVehicleModelClaim,
} from "./types";
import { classifyTransportSource } from "./source-classification";
import { normaliseIndonesianPhone, buildCanonicalWhatsappLink } from "./phone-normalisation";
import { detectReviewFlags } from "./review-flags";

export interface ComposeDiscoveryInput {
  sourceUrl: string;
  operatorSourceHint?: TransportSourceKind;
  publicEvidenceNote?: string;
  businessName?: string | null;
  contactPersonName?: string | null;
  rawPhone?: string | null;
  publicEmail?: string | null;
  website?: string | null;
  homeJurisdiction?: string | null;
  city?: string | null;
  province?: string | null;
  serviceAreas?: string[];
  vehicleTypes?: TransportVehicleOntology[];
  vehicleModelsPublic?: PublicVehicleModelClaim[];
  providerKindHint?: TransportProviderKind;
  supportsAirport?: boolean;
  supportsParcel?: boolean;
  supportsPassenger?: boolean;
  supportsTourist?: boolean;
  supportsLogistics?: boolean;
  publicRegistrationInfo?: string | null;
  ingestedBy?: string;
  cycleRunId?: string;
  distinctBusinessesUsingSamePhoneAcrossUniverse?: number;
  rawPayload?: Record<string, unknown>;
}

export interface ComposeDiscoveryOK {
  status: "OK";
  record: TransportAcquisitionRecord;
  snapshot: TransportAcquisitionSourceSnapshot;
}

export interface ComposeDiscoveryRefused {
  status: "REFUSED";
  reason:
    | "SOURCE_REJECTED"
    | "PHONE_REJECTED"
    | "NO_DEDUPE_KEY"
    | "NO_JURISDICTION";
  detail: string;
}

export type ComposeDiscoveryResult = ComposeDiscoveryOK | ComposeDiscoveryRefused;

function newId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function composeDiscoveryRecord(input: ComposeDiscoveryInput): ComposeDiscoveryResult {
  // 1. Source classification (rejects private/leaked/closed-group/etc.)
  const src = classifyTransportSource({
    sourceUrl: input.sourceUrl,
    operatorHint: input.operatorSourceHint,
    publicEvidenceNote: input.publicEvidenceNote,
  });
  if (src.status === "REJECTED") {
    return { status: "REFUSED", reason: "SOURCE_REJECTED", detail: `${src.reason}: ${src.detail}` };
  }

  // 2. Phone normalisation (only if a phone was supplied)
  let canonicalPhone: string | null = null;
  if (input.rawPhone && input.rawPhone.trim().length > 0) {
    const phone = normaliseIndonesianPhone(input.rawPhone);
    if (phone.status === "OK") {
      canonicalPhone = phone.canonicalE164;
    } else {
      // Non-fatal · phone rejection surfaces as review flag · other identifiers may still allow the record
      canonicalPhone = null;
    }
  }

  // 3. Dedupe key requirement
  const businessNameTrimmed = input.businessName?.trim() || null;
  if (!canonicalPhone && !businessNameTrimmed) {
    return {
      status: "REFUSED",
      reason: "NO_DEDUPE_KEY",
      detail: "Discovery record requires at least a canonical phone OR a business name.",
    };
  }

  if (!input.homeJurisdiction || input.homeJurisdiction.trim().length === 0) {
    return {
      status: "REFUSED",
      reason: "NO_JURISDICTION",
      detail: "Discovery record requires a homeJurisdiction (e.g. 'ID/DIY/Yogyakarta').",
    };
  }

  const providerId = newId();
  const now = new Date();

  // 4. Build WhatsApp link from canonical phone if none supplied
  const publicWhatsappLink = canonicalPhone ? buildCanonicalWhatsappLink(canonicalPhone) : null;

  // 5. Review flags
  const reviewFlags = detectReviewFlags({
    providerId,
    businessName: businessNameTrimmed,
    canonicalPhoneE164: canonicalPhone,
    rawPhoneInput: input.rawPhone,
    vehicleTypes: input.vehicleTypes ?? [],
    sourceSnapshotCount: 1,
    distinctBusinessesUsingSamePhoneAcrossUniverse:
      input.distinctBusinessesUsingSamePhoneAcrossUniverse,
  });

  const record: TransportAcquisitionRecord = {
    providerId,
    providerKind: input.providerKindHint ?? "unknown",
    businessName: businessNameTrimmed,
    contactPersonName: input.contactPersonName ?? null,
    canonicalPhoneE164: canonicalPhone,
    publicWhatsappLink,
    publicEmail: input.publicEmail ?? null,
    website: input.website ?? null,
    homeJurisdiction: input.homeJurisdiction,
    city: input.city ?? null,
    province: input.province ?? null,
    serviceAreas: input.serviceAreas ?? [],
    vehicleTypes: input.vehicleTypes ?? [],
    vehicleModelsPublic: input.vehicleModelsPublic ?? [],
    supportsAirport: input.supportsAirport ?? false,
    supportsParcel: input.supportsParcel ?? false,
    supportsPassenger: input.supportsPassenger ?? false,
    supportsTourist: input.supportsTourist ?? false,
    supportsLogistics: input.supportsLogistics ?? false,
    publicRegistrationInfo: input.publicRegistrationInfo ?? null,
    // Always enters at 'discovered' stage · Two Universes doctrine
    discoveryStage: "discovered",
    contactability: canonicalPhone ? "contactable" : (input.rawPhone ? "invalid" : "unknown"),
    reviewFlags,
    firstDiscoveredAt: now,
    lastSeenAt: now,
    cycleRunId: input.cycleRunId ?? null,
    provenance: {
      composerVersion: "0.1.0",
      sourceUrl: input.sourceUrl,
      sourceClassificationReason: src.reason,
    },
  };

  const snapshot: TransportAcquisitionSourceSnapshot = {
    snapshotId: newId(),
    providerId,
    sourceUrl: input.sourceUrl,
    sourceKind: src.sourceKind,
    sourceCapturedAt: now,
    sourceLicenceTerms: null,
    rawPayload: input.rawPayload ?? {},
    publicEvidenceNote: input.publicEvidenceNote ?? null,
    ingestedBy: input.ingestedBy ?? "composer:0.1.0",
    cycleRunId: input.cycleRunId ?? null,
  };

  return { status: "OK", record, snapshot };
}
