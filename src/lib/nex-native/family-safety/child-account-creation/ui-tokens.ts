// src/lib/nex-native/family-safety/child-account-creation/ui-tokens.ts
//
// NEX Family Safety · UI-safe tokens for the child-account-creation
// wizard. Authored by CC-2 2026-10-10.
// -----------------------------------------------------------------
// This file is SAFE to import from client components. The sealed
// `types.ts` next door is `server-only` (CC-1 marked it so to prevent
// clients from reading the full DB-shape primitives). The client only
// needs a small set of enum tokens + input shapes to drive the
// wizard · we re-export them here.
//
// If CC-1 later makes types.ts client-safe, this file becomes a thin
// re-export and all consumers continue to work. Until then, this is
// the single UI-safe entry point.
//
// Load-bearing anti-patterns:
//   · Do NOT import from `./types` in this file. Clients would then
//     pull in the server-only guard transitively.
//   · Do NOT add server-only logic here · this file is intentionally
//     plain data.

// ─────────────────────────────────────────────────────────────────────
// Child-creation state (mirror of `ChildCreationState` in types.ts).
// Keep this list exactly in sync.
// ─────────────────────────────────────────────────────────────────────

export const CHILD_CREATION_STATES_UI = [
  "draft",
  "id_pending_verification",
  "id_verified",
  "id_rejected",
  "awaiting_legal_clearance",
  "account_created",
  "cancelled",
  "expired",
] as const;
export type ChildCreationStateUi = (typeof CHILD_CREATION_STATES_UI)[number];

// ─────────────────────────────────────────────────────────────────────
// Document type radio set (mirror of `GovernmentIdDocumentType`).
// ─────────────────────────────────────────────────────────────────────

export const GOVERNMENT_ID_DOCUMENT_TYPES_UI = [
  "kk",
  "birth_certificate",
  "akta",
  "passport",
  "other",
] as const;
export type GovernmentIdDocumentTypeUi =
  (typeof GOVERNMENT_ID_DOCUMENT_TYPES_UI)[number];

/** MIME types the uploader accepts · also enforced server-side. */
export const GOVERNMENT_ID_ALLOWED_MIME_TYPES_UI: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

/** Max upload bytes (10 MB) · also enforced server-side. */
export const GOVERNMENT_ID_MAX_BYTES_UI = 10 * 1024 * 1024;

// ─────────────────────────────────────────────────────────────────────
// Audit action tokens for the opaque labelled rows.
// ─────────────────────────────────────────────────────────────────────

export type ChildCustodyAuditActionUi =
  | "custody_created"
  | "password_reset_issued"
  | "custody_revoked"
  | "safechat_default_updated"
  | "age_transfer_scheduled"
  | "age_transfer_completed";

// ─────────────────────────────────────────────────────────────────────
// UI-safe row shape consumed by the review panel + status poll.
// Mirrors `ChildCreationRequestRow` in types.ts.
// ─────────────────────────────────────────────────────────────────────

export interface ChildCreationRequestRowUi {
  readonly requestId: string;
  readonly parentAccountId: string;
  readonly childDisplayName: string;
  readonly childDeclaredDateOfBirth: string;
  readonly state: ChildCreationStateUi;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly submissionId: string | null;
  readonly documentFilename: string | null;
  readonly documentType: GovernmentIdDocumentTypeUi | null;
  readonly rejectionReason: string | null;
  readonly custodyId: string | null;
  readonly heldForLegalClearance: boolean;
}

// ─────────────────────────────────────────────────────────────────────
// Parent custody row (UI shape).
// ─────────────────────────────────────────────────────────────────────

export interface ParentCustodyRowUi {
  readonly custodyId: string;
  readonly parentAccountId: string;
  readonly childAccountId: string;
  readonly childDisplayName: string;
  readonly childDateOfBirth: string;
  readonly createdAt: string;
  readonly autoTransferAt: string;
  readonly isActive: boolean;
  readonly auditEntryCount: number;
}

// ─────────────────────────────────────────────────────────────────────
// Audit entry (UI shape).
// ─────────────────────────────────────────────────────────────────────

export interface ChildCustodyAuditEntryUi {
  readonly auditEntryId: string;
  readonly custodyId: string;
  readonly action: ChildCustodyAuditActionUi;
  readonly actorAccountId: string;
  readonly occurredAt: string;
  readonly summary: string;
}

// ─────────────────────────────────────────────────────────────────────
// Password reset ticket (UI shape).
// ─────────────────────────────────────────────────────────────────────

export interface ChildPasswordResetTicketUi {
  readonly resetTokenRefOpaque: string;
  readonly expiresAt: string;
  readonly displayHint: string;
}

// ─────────────────────────────────────────────────────────────────────
// Server-action input shapes (client-safe · passed over the RPC wire).
// ─────────────────────────────────────────────────────────────────────

export interface CreateChildCreationRequestInputUi {
  readonly childDisplayName: string;
  readonly childDeclaredDateOfBirth: string;
}

export interface CreateChildCreationRequestResultUi {
  readonly requestId: string;
}

export interface UploadIdDocumentInputUi {
  readonly requestId: string;
  readonly documentType: GovernmentIdDocumentTypeUi;
  readonly documentFilename: string;
  readonly documentMimeType: string;
  readonly documentByteLength: number;
  readonly documentBytesBase64: string;
  readonly idempotencyKey: string;
}

export interface UploadIdDocumentResultUi {
  readonly submissionId: string;
}

export interface TransitionCreationStateInputUi {
  readonly requestId: string;
  readonly nextState: ChildCreationStateUi;
}

export interface CancelRequestInputUi {
  readonly requestId: string;
  readonly reason: string;
}

export interface RequestPasswordResetForChildInputUi {
  readonly custodyId: string;
}
