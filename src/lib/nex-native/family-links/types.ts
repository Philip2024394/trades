// src/lib/nex-native/family-links/types.ts
//
// NEX Family Links · Phase 1 primitives · types.
//
// Scope · schema + service shapes ONLY. No UI types. No cross-layer
// capability types (future Phase 2+ permission flows attach to these
// primitives but are not expressed here).
//
// Doctrine (sealed with the Phase 1 doctrine doc 2026-10-10):
//   · Default-closed permissions · consumers that read a FamilyLinkRow
//     MUST treat an absent flag as denial.
//   · Dates referenced anywhere are ESTIMATES, not commitments.
//   · Vendor-agnostic · no verifier identifier shapes here. If a
//     future wave onboards an identity-verification adapter it must
//     define its own types in its own module.

import "server-only";

// ─────────────────────────────────────────────────────────────────────
// §1 · family_link primitives
// ─────────────────────────────────────────────────────────────────────

export const FAMILY_ROLES = [
  "guardian_primary",
  "guardian_secondary",
  "trusted_adult",
  "mentor",
] as const;
export type FamilyRole = (typeof FAMILY_ROLES)[number];

export const FAMILY_LINK_STATES = [
  "pending",
  "active",
  "revoked",
  "expired",
] as const;
export type FamilyLinkState = (typeof FAMILY_LINK_STATES)[number];

export const FAMILY_LINK_INITIATED_BY = [
  "guardian_invite",
  "child_invite",
  "system_setup",
] as const;
export type FamilyLinkInitiatedBy = (typeof FAMILY_LINK_INITIATED_BY)[number];

/** Roles that are permission-weighty guardians at the Phase 1 primitive
 *  level. Trusted adults and mentors are reserved categories with no
 *  Phase 1 capability attached. */
export const GUARDIAN_ROLES = [
  "guardian_primary",
  "guardian_secondary",
] as const satisfies readonly FamilyRole[];
export type GuardianRole = (typeof GUARDIAN_ROLES)[number];

export function isFamilyRole(v: unknown): v is FamilyRole {
  return typeof v === "string" && (FAMILY_ROLES as readonly string[]).includes(v);
}
export function isFamilyLinkState(v: unknown): v is FamilyLinkState {
  return (
    typeof v === "string" &&
    (FAMILY_LINK_STATES as readonly string[]).includes(v)
  );
}
export function isFamilyLinkInitiatedBy(
  v: unknown,
): v is FamilyLinkInitiatedBy {
  return (
    typeof v === "string" &&
    (FAMILY_LINK_INITIATED_BY as readonly string[]).includes(v)
  );
}
export function isGuardianRole(v: unknown): v is GuardianRole {
  return typeof v === "string" && (GUARDIAN_ROLES as readonly string[]).includes(v);
}

export interface FamilyLinkRow {
  readonly linkId: string;
  readonly guardianAccountId: string;
  readonly childAccountId: string;
  readonly role: FamilyRole;
  readonly state: FamilyLinkState;
  readonly initiatedBy: FamilyLinkInitiatedBy;
  readonly initiatedAt: string; // ISO 8601 timestamp
  readonly confirmedAt: string | null;
  readonly revokedAt: string | null;
  readonly revokedBy: string | null;
  readonly revokedReason: string | null;
  readonly expiresAt: string | null;
  readonly canSeeEmergencyAlerts: boolean;
  readonly canSeeSafetySummaries: boolean;
  readonly canSeeLocationWhenShared: boolean;
  readonly simulated: boolean;
  readonly createdAt: string;
}

/** Sealed service-layer error codes. Use these as substrings in thrown
 *  Error messages so tests + callers can key off a stable identifier. */
export const FAMILY_LINK_ERROR_CODES = {
  INVALID_ROLE: "family_link.invalid_role",
  INVALID_INITIATED_BY: "family_link.invalid_initiated_by",
  SELF_LINK: "family_link.self_link_forbidden",
  UNAUTHORIZED_ACTOR: "family_link.unauthorized_actor",
  PRIMARY_GUARDIAN_ALREADY_EXISTS: "family_link.primary_guardian_already_exists",
  LINK_NOT_FOUND: "family_link.not_found",
  WRONG_CONFIRMING_PARTY: "family_link.wrong_confirming_party",
  ALREADY_CONFIRMED: "family_link.already_confirmed",
  ALREADY_REVOKED: "family_link.already_revoked",
  SIMULATED_ONLY: "family_link.simulated_only_in_phase_1",
  PERMISSION_FLAGS_LOCKED: "family_link.permission_flags_locked_in_phase_1",
  INVALID_REVOKE_REASON: "family_link.invalid_revoke_reason",
  DB_UNAVAILABLE: "family_link.db_unavailable",
} as const;
export type FamilyLinkErrorCode =
  (typeof FAMILY_LINK_ERROR_CODES)[keyof typeof FAMILY_LINK_ERROR_CODES];

/** Phase 1 revocation reason tokens are freeform within length bounds.
 *  Exported as a type alias so future phases can tighten the shape. */
export type FamilyLinkRevokeReason = string;

// ─────────────────────────────────────────────────────────────────────
// §2 · account_age_attestation primitives
// ─────────────────────────────────────────────────────────────────────

export const AGE_ATTESTATION_ATTESTED_BY = [
  "self",
  "guardian",
  "system_fallback",
] as const;
export type AgeAttestationAttestedBy =
  (typeof AGE_ATTESTATION_ATTESTED_BY)[number];

export const AGE_ATTESTATION_METHODS = [
  "declared",
  "guardian_declared",
  "document_verified_future_phase",
] as const;
export type AgeAttestationMethod = (typeof AGE_ATTESTATION_METHODS)[number];

/** Methods accepted by the Phase 1 service layer. The
 *  'document_verified_future_phase' value is reserved and rejected. */
export const PHASE_1_ACCEPTED_METHODS = [
  "declared",
  "guardian_declared",
] as const satisfies readonly AgeAttestationMethod[];
export type Phase1AcceptedMethod = (typeof PHASE_1_ACCEPTED_METHODS)[number];

export function isAgeAttestationAttestedBy(
  v: unknown,
): v is AgeAttestationAttestedBy {
  return (
    typeof v === "string" &&
    (AGE_ATTESTATION_ATTESTED_BY as readonly string[]).includes(v)
  );
}
export function isAgeAttestationMethod(v: unknown): v is AgeAttestationMethod {
  return (
    typeof v === "string" &&
    (AGE_ATTESTATION_METHODS as readonly string[]).includes(v)
  );
}
export function isPhase1AcceptedMethod(v: unknown): v is Phase1AcceptedMethod {
  return (
    typeof v === "string" &&
    (PHASE_1_ACCEPTED_METHODS as readonly string[]).includes(v)
  );
}

export interface AgeAttestationRow {
  readonly attestationId: string;
  readonly accountId: string;
  readonly declaredDateOfBirth: string; // ISO 8601 date (YYYY-MM-DD)
  readonly attestedBy: AgeAttestationAttestedBy;
  readonly attestedByAccountId: string | null;
  readonly attestationMethod: AgeAttestationMethod;
  readonly attestationNotes: string | null;
  readonly supersededBy: string | null;
  readonly simulated: boolean;
  readonly createdAt: string;
}

export const AGE_ATTESTATION_ERROR_CODES = {
  INVALID_ACCOUNT_ID: "age_attestation.invalid_account_id",
  INVALID_DOB: "age_attestation.invalid_declared_dob",
  INVALID_ATTESTED_BY: "age_attestation.invalid_attested_by",
  INVALID_METHOD: "age_attestation.invalid_method",
  INVALID_NOTES: "age_attestation.invalid_notes",
  MISSING_ATTESTOR_ID: "age_attestation.missing_attestor_id",
  UNEXPECTED_ATTESTOR_ID: "age_attestation.unexpected_attestor_id",
  UNAUTHORIZED_ACTOR: "age_attestation.unauthorized_actor",
  PRIOR_NOT_FOUND: "age_attestation.prior_attestation_not_found",
  SIMULATED_ONLY: "age_attestation.simulated_only_in_phase_1",
  METHOD_RESERVED: "age_attestation.method_reserved_for_future_phase",
  DB_UNAVAILABLE: "age_attestation.db_unavailable",
} as const;
export type AgeAttestationErrorCode =
  (typeof AGE_ATTESTATION_ERROR_CODES)[keyof typeof AGE_ATTESTATION_ERROR_CODES];

// ─────────────────────────────────────────────────────────────────────
// §3 · family-role-reader primitives
// ─────────────────────────────────────────────────────────────────────

export type FamilyRelationshipKind =
  | "self"
  | "guardian_of_target"
  | "child_of_target"
  | "trusted_adult_of_target"
  | "no_relationship";

export interface GuardianLookupResult {
  readonly isGuardian: boolean;
  readonly role: FamilyRole | null;
  readonly linkId: string | null;
}
