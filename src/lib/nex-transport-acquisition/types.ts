// src/lib/nex-transport-acquisition/types.ts
//
// Shared types for the Transport Driver Acquisition Universe.
// Mirrors the enums in migration 093.

export type TransportVehicleOntology =
  | "motorcycle"
  | "car"
  | "taxi"
  | "van"
  | "mpv"
  | "pickup"
  | "small_truck"
  | "truck"
  | "lorry"
  | "bus"
  | "minibus"
  | "courier"
  | "airport_transfer"
  | "tourist_driver"
  | "logistics_operator"
  | "unknown";

export type TransportProviderKind =
  | "individual_driver"
  | "driver_operator"
  | "fleet_operator"
  | "transport_business"
  | "courier_operator"
  | "logistics_operator"
  | "unknown";

export type TransportRecruitmentStage =
  | "discovered"
  | "public_contact_verified"
  | "invitable"
  | "invited"
  | "interested"
  | "registration_started"
  | "registered"
  | "kyc_pending"
  | "vehicle_pending"
  | "insurance_pending"
  | "legal_review"
  | "verified"
  | "active"
  | "declined"
  | "unreachable"
  | "opted_out";

export type TransportSourceKind =
  | "public_business_website"
  | "public_maps_listing"
  | "public_business_directory"
  | "public_transport_service_listing"
  | "public_driver_service_website"
  | "public_facebook_business_page"
  | "public_instagram_business_profile"
  | "public_whatsapp_business_link"
  | "public_marketplace_listing"
  | "public_recruitment_advertisement"
  | "other_public_business_source"
  | "unknown_or_disallowed";

export type TransportReviewFlag =
  | "duplicate_phone_across_unrelated"
  | "impossible_vehicle_claims"
  | "source_disappeared"
  | "source_conflict"
  | "generic_directory_number"
  | "incompatible_vehicle_types"
  | "copied_business_identity"
  | "phone_used_by_unrelated_names"
  | "invalid_phone_format"
  | "source_evidence_insufficient";

export type TransportContactability = "contactable" | "unknown" | "invalid";

export interface PublicVehicleModelClaim {
  brand: string;
  model: string;
  variant?: string | null;
  sourceUrl: string;
}

export interface TransportAcquisitionRecord {
  providerId: string;
  providerKind: TransportProviderKind;
  businessName: string | null;
  contactPersonName: string | null;
  canonicalPhoneE164: string | null;
  publicWhatsappLink: string | null;
  publicEmail: string | null;
  website: string | null;
  homeJurisdiction: string | null;
  city: string | null;
  province: string | null;
  serviceAreas: string[];
  vehicleTypes: TransportVehicleOntology[];
  vehicleModelsPublic: PublicVehicleModelClaim[];
  supportsAirport: boolean;
  supportsParcel: boolean;
  supportsPassenger: boolean;
  supportsTourist: boolean;
  supportsLogistics: boolean;
  publicRegistrationInfo: string | null;
  discoveryStage: TransportRecruitmentStage;
  contactability: TransportContactability;
  reviewFlags: TransportReviewFlag[];
  firstDiscoveredAt: Date;
  lastSeenAt: Date;
  cycleRunId: string | null;
  provenance: Record<string, unknown>;
}

export interface TransportAcquisitionSourceSnapshot {
  snapshotId: string;
  providerId: string;
  sourceUrl: string;
  sourceKind: TransportSourceKind;
  sourceCapturedAt: Date;
  sourceLicenceTerms: string | null;
  rawPayload: Record<string, unknown>;
  publicEvidenceNote: string | null;
  ingestedBy: string | null;
  cycleRunId: string | null;
}
