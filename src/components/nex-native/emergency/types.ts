// src/components/nex-native/emergency/types.ts
//
// Local type copies of the sealed F4 contract (see
// `@/lib/nex-native/emergency/types`). This file exists ONLY while
// F4's data layer is landing in parallel so the UI can type-check
// without hard-depending on the module tree. Delete and switch all
// imports to `@/lib/nex-native/emergency/types` once F4 is on disk.

export type IncidentState =
  | "draft"
  | "active"
  | "responders_assigned"
  | "resolved"
  | "cancelled"
  | "expired";

export type IncidentCategory =
  | "general_assistance"
  | "medical_concern"
  | "safety_concern"
  | "other";

export type RecipientLayer =
  | "trusted_contact"
  | "nearby_opted_in"
  | "wider_community";

export type ResponseStatus = "pending" | "accepted" | "declined" | "withdrawn";

export interface EmergencyIncident {
  incidentId: string;
  requesterAccountId: string;
  state: IncidentState;
  category: IncidentCategory;
  locationLat: number | null;
  locationLng: number | null;
  locationAccuracyMeters: number | null;
  locationCapturedAt: string | null;
  simulated: boolean;
  createdAt: string;
  activatedAt: string | null;
  resolvedAt: string | null;
  cancelledAt: string | null;
  expiresAt: string | null;
}

export interface IncidentRecipient {
  recipientId: string;
  incidentId: string;
  recipientAccountId: string;
  layer: RecipientLayer;
  distanceMeters: number | null;
  notifiedAt: string;
  responseStatus: ResponseStatus;
  respondedAt: string | null;
  etaMinutes: number | null;
}

export interface EmergencyResponderOptIn {
  accountId: string;
  optedInAt: string;
  acknowledgedSafetyGuidanceAt: string;
  radiusKm: number;
  simulated: boolean;
}

export interface TrustedContactRow {
  /** Surrogate PK · migration 196. NULL only on pre-196 schema reads. */
  trustedContactId: string | null;
  ownerAccountId: string;
  /** Nullable since migration 196 · trusted contact can be email-only
   *  or phone-only. */
  contactAccountId: string | null;
  /** Multi-channel identifier · migration 196. */
  contactEmail: string | null;
  /** Multi-channel identifier · migration 196. */
  contactPhone: string | null;
  addedAt: string;
  contactLabel: string | null;
}
