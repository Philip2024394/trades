// src/lib/nex-native/family-safety/child-account-creation/types.ts
//
// NEX Family Safety · Child Account Creation (CC-1 authoritative module).
//
// Supersedes the earlier CC-2 LOCAL STUB types that lived in this file.
// This is now the single source of truth for the state machine, row
// shapes, and server-action input/output tokens consumed by:
//   · CC-2 wizard UI (`src/app/nex-native/family-safety/create-child/**`)
//   · CC-3 dashboard + age-transition
//   · CC-4 e2e tests + regression harness
//
// Doctrine (sealed 2026-10-10 with migrations 203-207):
//   · simulated=TRUE on every v1 write · service layer refuses FALSE.
//   · Live child-account materialisation is GATED behind the feature
//     flag NEX_FAMILY_SAFETY_CHILD_CREATE_LIVE_MODE (defaults FALSE).
//   · ID verifier is a STUB adapter in the current wave (sealed
//     interface in `../id-verifier/types.ts`).
//   · Parent is CUSTODIAN · may request password reset for the child
//     but NEVER sees plaintext credentials. Every parent action
//     against a child account produces a parent_custody_audit_log row.
//   · SafeChat is ALWAYS ON for minor accounts · the
//     account_minor_profile.safechat_always_on flag carries it; CC-3's
//     enforcer reads it.
//   · Dates are ESTIMATES.
//
// Preserved compatibility aliases (do NOT remove without CC-2 sign-off):
//   · ChildCreationState (super-set of CC-2 states · adds 'expired')
//   · GovernmentIdDocumentType (UI radio tokens kk/birth_certificate/akta)
//     map onto IdDocumentType (DB tokens indonesian_kk/..._birth_
//     certificate/indonesian_akta) via `UI_TO_DB_DOCUMENT_TYPE`.
//   · ChildCustodyAuditAction (UI tokens) → CustodyAuditAction (DB
//     tokens) via `UI_TO_DB_CUSTODY_AUDIT_ACTION`.

import "server-only";

// ─────────────────────────────────────────────────────────────────────
// §1 · child_account_creation_request primitives
// ─────────────────────────────────────────────────────────────────────

/**
 * The lifecycle of a child-creation request. Transitions:
 *
 *   draft
 *     → id_pending_verification     (parent submits for review)
 *     → cancelled                   (parent cancels)
 *     → expired                     (service sweeper · 30-day TTL)
 *   id_pending_verification
 *     → id_verified                 (verifier approves)
 *     → id_rejected                 (verifier rejects)
 *     → cancelled                   (parent cancels)
 *   id_verified
 *     → awaiting_legal_clearance    (live-mode flag OFF · held safely)
 *     → account_created             (live-mode flag ON · live create)
 *   awaiting_legal_clearance
 *     → account_created             (operator flips flag + processes queue)
 *     → cancelled                   (parent cancels)
 */
export const CHILD_CREATION_STATES = [
  "draft",
  "id_pending_verification",
  "id_verified",
  "id_rejected",
  "awaiting_legal_clearance",
  "account_created",
  "cancelled",
  "expired",
] as const;
export type ChildCreationState = (typeof CHILD_CREATION_STATES)[number];

export function isChildCreationState(v: unknown): v is ChildCreationState {
  return (
    typeof v === "string" &&
    (CHILD_CREATION_STATES as readonly string[]).includes(v)
  );
}

export const CHILD_CREATION_REJECTION_CODES = [
  "id_unreadable",
  "id_not_matching",
  "not_a_minor",
  "parent_not_authorised",
  "awaiting_legal_clearance",
  "operator_manual_rejection",
  "other",
] as const;
export type ChildCreationRejectionCode =
  (typeof CHILD_CREATION_REJECTION_CODES)[number];

export function isChildCreationRejectionCode(
  v: unknown,
): v is ChildCreationRejectionCode {
  return (
    typeof v === "string" &&
    (CHILD_CREATION_REJECTION_CODES as readonly string[]).includes(v)
  );
}

/** Row shape returned by `child-account-creation-service.ts`. */
export interface ChildCreationRequest {
  readonly requestId: string;
  readonly parentAccountId: string;
  readonly childDisplayName: string;
  /** ISO yyyy-mm-dd. */
  readonly childDeclaredDateOfBirth: string;
  readonly idSubmissionId: string | null;
  readonly state: ChildCreationState;
  readonly createdChildAccountId: string | null;
  readonly rejectionReason: string | null;
  readonly rejectionReasonCode: ChildCreationRejectionCode | null;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly verifiedAt: string | null;
  readonly approvedAt: string | null;
  readonly rejectedAt: string | null;
  readonly cancelledAt: string | null;
  readonly simulated: boolean;
}

// ─────────────────────────────────────────────────────────────────────
// §2 · ID document types (DB + UI tokens)
// ─────────────────────────────────────────────────────────────────────

/** DB-layer tokens (match the CHECK constraint on migration 204). */
export const ID_DOCUMENT_TYPES = [
  "indonesian_kk",
  "indonesian_birth_certificate",
  "indonesian_akta",
  "passport",
  "other",
] as const;
export type IdDocumentType = (typeof ID_DOCUMENT_TYPES)[number];

export function isIdDocumentType(v: unknown): v is IdDocumentType {
  return (
    typeof v === "string" && (ID_DOCUMENT_TYPES as readonly string[]).includes(v)
  );
}

/**
 * UI-layer tokens (compat with CC-2 wizard radio set). The server
 * actions accept both — a shim normalises UI tokens into DB tokens via
 * `UI_TO_DB_DOCUMENT_TYPE` before persisting.
 */
export type GovernmentIdDocumentType =
  | "kk"
  | "birth_certificate"
  | "akta"
  | "passport"
  | "other";

export const GOVERNMENT_ID_DOCUMENT_TYPES: readonly GovernmentIdDocumentType[] = [
  "kk",
  "birth_certificate",
  "akta",
  "passport",
  "other",
] as const;

export const UI_TO_DB_DOCUMENT_TYPE: Readonly<
  Record<GovernmentIdDocumentType, IdDocumentType>
> = {
  kk: "indonesian_kk",
  birth_certificate: "indonesian_birth_certificate",
  akta: "indonesian_akta",
  passport: "passport",
  other: "other",
};

/** MIME types that the uploader accepts — mirrored in the DB CHECK on
 *  nex.id_document_blob.mime_type. */
export const GOVERNMENT_ID_ALLOWED_MIME_TYPES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

/** Max upload bytes (10 MB) · also enforced server-side. */
export const GOVERNMENT_ID_MAX_BYTES = 10 * 1024 * 1024;

// ─────────────────────────────────────────────────────────────────────
// §3 · id_verification_submission primitives
// ─────────────────────────────────────────────────────────────────────

export const ID_VERIFICATION_OUTCOMES = [
  "pending",
  "verified",
  "rejected",
  "unknown",
] as const;
export type IdVerificationOutcome = (typeof ID_VERIFICATION_OUTCOMES)[number];

export interface IdVerificationSubmission {
  readonly submissionId: string;
  readonly submitterAccountId: string;
  readonly documentType: IdDocumentType;
  /** Opaque pointer · never a URL. Resolved only by the sealed admin reader. */
  readonly documentStorageRef: string;
  readonly submittedAt: string;
  readonly verifierAdapter: string;
  readonly verificationOutcome: IdVerificationOutcome;
  readonly verifiedAt: string | null;
  readonly verifierResponseSummaryRedacted: string | null;
  readonly simulated: boolean;
}

// ─────────────────────────────────────────────────────────────────────
// §4 · parent_custody_link primitives
// ─────────────────────────────────────────────────────────────────────

export const CUSTODY_LINK_TYPES = [
  "created_minor",
  "transferred_at_16",
  "manual_grant",
] as const;
export type CustodyLinkType = (typeof CUSTODY_LINK_TYPES)[number];

export function isCustodyLinkType(v: unknown): v is CustodyLinkType {
  return (
    typeof v === "string" && (CUSTODY_LINK_TYPES as readonly string[]).includes(v)
  );
}

export interface ParentCustodyLink {
  readonly custodyId: string;
  readonly parentAccountId: string;
  readonly childAccountId: string;
  readonly linkType: CustodyLinkType;
  readonly isMinor: boolean;
  readonly createdAt: string;
  readonly autoTransferAt: string | null;
  readonly transferredAt: string | null;
  readonly revokedAt: string | null;
  readonly revokedReason: string | null;
  readonly simulated: boolean;
}

// ─────────────────────────────────────────────────────────────────────
// §5 · account_minor_profile primitives
// ─────────────────────────────────────────────────────────────────────

export interface MinorProfile {
  readonly accountId: string;
  readonly isMinor: boolean;
  readonly parentCustodyId: string | null;
  readonly autoTransferAt: string | null;
  readonly transferredAt: string | null;
  readonly safechatAlwaysOn: boolean;
  readonly simulated: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────
// §6 · parent_custody_audit_log primitives
// ─────────────────────────────────────────────────────────────────────

/** DB-layer tokens (match CHECK on migration 207). */
export const CUSTODY_AUDIT_ACTIONS = [
  "custody_created",
  "password_reset_requested",
  "password_reset_completed",
  "child_viewed_in_dashboard",
  "safechat_summary_viewed",
  "age_transfer_notified",
  "age_transfer_completed",
  "custody_revoked",
] as const;
export type CustodyAuditAction = (typeof CUSTODY_AUDIT_ACTIONS)[number];

export function isCustodyAuditAction(v: unknown): v is CustodyAuditAction {
  return (
    typeof v === "string" &&
    (CUSTODY_AUDIT_ACTIONS as readonly string[]).includes(v)
  );
}

/** UI-layer tokens (compat with CC-2 wizard). Map via
 *  `UI_TO_DB_CUSTODY_AUDIT_ACTION` into the DB tokens before writing. */
export type ChildCustodyAuditAction =
  | "custody_created"
  | "password_reset_issued"
  | "custody_revoked"
  | "safechat_default_updated"
  | "age_transfer_scheduled"
  | "age_transfer_completed";

export const UI_TO_DB_CUSTODY_AUDIT_ACTION: Readonly<
  Record<ChildCustodyAuditAction, CustodyAuditAction>
> = {
  custody_created: "custody_created",
  password_reset_issued: "password_reset_requested",
  custody_revoked: "custody_revoked",
  // CC-2 did not model safechat_summary_viewed in its stub · we fall
  // back to the closest existing audit action.
  safechat_default_updated: "safechat_summary_viewed",
  age_transfer_scheduled: "age_transfer_notified",
  age_transfer_completed: "age_transfer_completed",
};

export interface ParentCustodyAuditEntry {
  readonly auditId: string;
  readonly custodyId: string;
  readonly parentAccountId: string;
  readonly childAccountId: string;
  readonly action: CustodyAuditAction;
  readonly actionDetailsRedacted: string | null;
  readonly simulated: boolean;
  readonly performedAt: string;
}

// ─────────────────────────────────────────────────────────────────────
// §6b · CC-2 UI compat row shape
// ─────────────────────────────────────────────────────────────────────

/** Row shape surfaced to the CC-2 wizard UI. Lightly denormalised:
 *  the UI consumes `createdAt` + `updatedAt` where the DB tracks finer-
 *  grained timestamps (verified_at / approved_at / rejected_at /
 *  cancelled_at). The service maps the latest-wins timestamp into
 *  `updatedAt` so the chip-tone selector in CC-2 can render without a
 *  second query. */
export interface ChildCreationRequestRow {
  readonly requestId: string;
  readonly parentAccountId: string;
  readonly childDisplayName: string;
  /** ISO yyyy-mm-dd. */
  readonly childDeclaredDateOfBirth: string;
  readonly state: ChildCreationState;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly submissionId: string | null;
  readonly documentFilename: string | null;
  readonly documentType: GovernmentIdDocumentType | null;
  readonly rejectionReason: string | null;
  readonly custodyId: string | null;
  readonly heldForLegalClearance: boolean;
}

// ─────────────────────────────────────────────────────────────────────
// §7 · Password reset ticket (parent NEVER sees plaintext)
// ─────────────────────────────────────────────────────────────────────

export interface ChildPasswordResetTicket {
  /**
   * Opaque reference to a server-held reset token. The parent sees this
   * ref only to track lifecycle · the plaintext token travels via a
   * sealed channel (email / in-app notification) to the child's own
   * device. The parent cannot resolve it to plaintext.
   */
  readonly resetTokenRefOpaque: string;
  readonly expiresAt: string;
  /** Short friendly line to show the parent. */
  readonly displayHint: string;
}

// ─────────────────────────────────────────────────────────────────────
// §8 · Error codes
// ─────────────────────────────────────────────────────────────────────

export const CHILD_CREATION_ERROR_CODES = {
  SIMULATED_ONLY: "child-creation.simulated_only",
  INVALID_PARENT: "child-creation.invalid_parent",
  INVALID_ACTOR: "child-creation.invalid_actor",
  INVALID_DISPLAY_NAME: "child-creation.invalid_display_name",
  INVALID_DOB: "child-creation.invalid_dob",
  NOT_A_MINOR: "child-creation.not_a_minor",
  INVALID_STATE_TRANSITION: "child-creation.invalid_state_transition",
  REQUEST_NOT_FOUND: "child-creation.request_not_found",
  ACTOR_NOT_PARENT: "child-creation.actor_not_parent",
  LIVE_MODE_DISABLED: "child-creation.live_mode_disabled",
  ID_NOT_VERIFIED: "child-creation.id_not_verified",
  ALREADY_MATERIALISED: "child-creation.already_materialised",
  SELF_CUSTODY: "child-creation.self_custody",
  DUPLICATE_ACTIVE_CUSTODY: "child-creation.duplicate_active_custody",
  CUSTODY_NOT_FOUND: "child-creation.custody_not_found",
  CUSTODY_NOT_ACTIVE: "child-creation.custody_not_active",
  SUBMISSION_NOT_FOUND: "child-creation.submission_not_found",
  SHA256_MISMATCH: "child-creation.sha256_mismatch",
  INVALID_SHA256: "child-creation.invalid_sha256",
  INVALID_MIME: "child-creation.invalid_mime",
  INVALID_SUMMARY_LENGTH: "child-creation.invalid_summary_length",
  INVALID_IDEMPOTENCY_KEY: "child-creation.invalid_idempotency_key",
  BYTES_EMPTY: "child-creation.bytes_empty",
  BLOB_NOT_FOUND: "child-creation.blob_not_found",
  ADMIN_READER_REQUIRED: "child-creation.admin_reader_required",
  BYTES_TOO_LARGE: "child-creation.bytes_too_large",
} as const;
