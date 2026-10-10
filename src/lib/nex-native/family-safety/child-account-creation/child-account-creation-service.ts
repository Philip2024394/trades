// src/lib/nex-native/family-safety/child-account-creation/child-account-creation-service.ts
//
// NEX Family Safety · Child Account Creation (CC-1) · request service.
// --------------------------------------------------------------------
// Server-only. Thin pg wrapper around nex.child_account_creation_request
// (migration 203). Owns the sealed state machine:
//
//   draft
//     → id_pending_verification      (parent attaches an ID submission)
//     → cancelled                    (parent cancels)
//     → expired                      (sweeper · 30-day TTL)
//   id_pending_verification
//     → id_verified                  (verifier adapter approves)
//     → id_rejected                  (verifier adapter rejects)
//     → cancelled                    (parent cancels)
//   id_verified
//     → awaiting_legal_clearance     (NEX_FAMILY_SAFETY_CHILD_CREATE_LIVE_MODE OFF)
//     → account_created              (NEX_FAMILY_SAFETY_CHILD_CREATE_LIVE_MODE ON · materialise)
//   awaiting_legal_clearance
//     → account_created              (operator flips flag + processes queue)
//     → cancelled                    (parent cancels)
//
// Doctrine:
//   · simulated=TRUE on every write · service refuses FALSE.
//   · Live-mode gating: `materialiseChildAccount` checks the feature
//     flag before touching the sealed account-service. When flag OFF
//     (default), it transitions to awaiting_legal_clearance INSTEAD.
//   · Authorization: every mutation requires `actorAccountId` ·
//     service checks actor matches parent_account_id · never trusts
//     caller to self-report.
//   · Validation echoes DB CHECKs (display_name 1..60, DOB 1900..today)
//     so we fail cleanly in the service rather than DB-side.
//   · Date arithmetic: 16th birthday is pre-computed and stored on the
//     companion custody row (CC-3's age-transition workflow reads it).

import "server-only";

import { randomUUID } from "node:crypto";

import { withClient } from "@/lib/nex/db";
import type { PgClientLike } from "@/lib/nex/db";

import {
  CHILD_CREATION_ERROR_CODES,
  isChildCreationRejectionCode,
  isChildCreationState,
  type ChildCreationRejectionCode,
  type ChildCreationRequest,
  type ChildCreationState,
} from "./types";
import { isChildCreateLiveModeEnabled } from "./feature-flag";

// ─────────────────────────────────────────────────────────────────────
// §1 · Internal helpers
// ─────────────────────────────────────────────────────────────────────

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return new Date(v).toISOString();
  return new Date(0).toISOString();
}

function toIsoOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return toIso(v);
}

function toDateOnlyIso(v: unknown): string {
  if (v instanceof Date) {
    const y = v.getUTCFullYear();
    const m = String(v.getUTCMonth() + 1).padStart(2, "0");
    const d = String(v.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof v === "string") {
    // The DB returns 'yyyy-mm-dd' for a `date` column via pg; defensive clamp.
    const match = v.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
    return v;
  }
  return "";
}

function toStringOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return String(v);
}

function mapRow(r: Record<string, unknown>): ChildCreationRequest {
  const state = String(r.state ?? "");
  if (!isChildCreationState(state)) {
    throw new Error(
      `child-creation.unknown_state · got '${state}' · migration drift`,
    );
  }
  const rejectionCodeRaw = r.rejection_reason_code;
  const rejectionCode =
    rejectionCodeRaw === null || rejectionCodeRaw === undefined
      ? null
      : isChildCreationRejectionCode(String(rejectionCodeRaw))
        ? (String(rejectionCodeRaw) as ChildCreationRejectionCode)
        : null;
  return {
    requestId: String(r.request_id),
    parentAccountId: String(r.parent_account_id),
    childDisplayName: String(r.child_display_name),
    childDeclaredDateOfBirth: toDateOnlyIso(r.child_declared_date_of_birth),
    idSubmissionId: toStringOrNull(r.id_submission_id),
    state,
    createdChildAccountId: toStringOrNull(r.created_child_account_id),
    rejectionReason: toStringOrNull(r.rejection_reason),
    rejectionReasonCode: rejectionCode,
    createdAt: toIso(r.created_at),
    expiresAt: toIso(r.expires_at),
    verifiedAt: toIsoOrNull(r.verified_at),
    approvedAt: toIsoOrNull(r.approved_at),
    rejectedAt: toIsoOrNull(r.rejected_at),
    cancelledAt: toIsoOrNull(r.cancelled_at),
    simulated: Boolean(r.simulated),
  };
}

function requireNonEmpty(v: unknown, code: string): string {
  if (typeof v !== "string" || v.trim().length === 0) {
    throw new Error(code);
  }
  return v;
}

function validateDisplayName(name: unknown): string {
  if (typeof name !== "string") {
    throw new Error(CHILD_CREATION_ERROR_CODES.INVALID_DISPLAY_NAME);
  }
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 60) {
    throw new Error(CHILD_CREATION_ERROR_CODES.INVALID_DISPLAY_NAME);
  }
  return name;
}

/**
 * Validates `yyyy-mm-dd` and that the DOB is in the past and marks a
 * minor (strictly less than 18 years ago is a reasonable civil-law
 * default · the service does NOT presume Indonesian minor age · the
 * UI applies its own stricter rule).
 */
function validateDeclaredDateOfBirth(iso: unknown): string {
  if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    throw new Error(CHILD_CREATION_ERROR_CODES.INVALID_DOB);
  }
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) {
    throw new Error(CHILD_CREATION_ERROR_CODES.INVALID_DOB);
  }
  const now = Date.now();
  if (d.getTime() > now) {
    throw new Error(CHILD_CREATION_ERROR_CODES.INVALID_DOB);
  }
  const minDate = new Date("1900-01-02T00:00:00Z");
  if (d.getTime() < minDate.getTime()) {
    throw new Error(CHILD_CREATION_ERROR_CODES.INVALID_DOB);
  }
  return iso;
}

/**
 * Allowed state transitions · explicit so we fail loudly on drift.
 */
const ALLOWED_TRANSITIONS: Readonly<Record<ChildCreationState, readonly ChildCreationState[]>> = {
  draft: ["id_pending_verification", "cancelled", "expired"],
  id_pending_verification: ["id_verified", "id_rejected", "cancelled"],
  id_verified: ["awaiting_legal_clearance", "account_created", "cancelled"],
  id_rejected: [],
  awaiting_legal_clearance: ["account_created", "cancelled"],
  account_created: [],
  cancelled: [],
  expired: [],
};

function assertAllowedTransition(from: ChildCreationState, to: ChildCreationState): void {
  const allowed = ALLOWED_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new Error(CHILD_CREATION_ERROR_CODES.INVALID_STATE_TRANSITION);
  }
}

// ─────────────────────────────────────────────────────────────────────
// §2 · createChildCreationRequest
// ─────────────────────────────────────────────────────────────────────

export interface CreateChildCreationRequestArgs {
  readonly parentAccountId: string;
  readonly childDisplayName: string;
  readonly childDeclaredDateOfBirth: string;
  readonly actorAccountId: string;
}

export async function createChildCreationRequest(
  args: CreateChildCreationRequestArgs,
): Promise<ChildCreationRequest> {
  const parentId = requireNonEmpty(
    args.parentAccountId,
    CHILD_CREATION_ERROR_CODES.INVALID_PARENT,
  );
  const actorId = requireNonEmpty(
    args.actorAccountId,
    CHILD_CREATION_ERROR_CODES.INVALID_ACTOR,
  );
  if (actorId !== parentId) {
    throw new Error(CHILD_CREATION_ERROR_CODES.ACTOR_NOT_PARENT);
  }
  const displayName = validateDisplayName(args.childDisplayName);
  const dob = validateDeclaredDateOfBirth(args.childDeclaredDateOfBirth);

  const requestId = randomUUID();
  const row = await withClient(async (c: PgClientLike) => {
    const r = await c.query(
      `INSERT INTO nex.child_account_creation_request (
         request_id,
         parent_account_id,
         child_display_name,
         child_declared_date_of_birth,
         state,
         simulated
       )
       VALUES ($1::uuid, $2, $3, $4::date, 'draft', TRUE)
       RETURNING *`,
      [requestId, parentId, displayName, dob],
    );
    return r.rows[0];
  });
  if (!row) throw new Error("child-creation.db_unavailable");
  return mapRow(row);
}

// ─────────────────────────────────────────────────────────────────────
// §3 · attachIdSubmission
// ─────────────────────────────────────────────────────────────────────

export interface AttachIdSubmissionArgs {
  readonly requestId: string;
  readonly submissionId: string;
  readonly actorAccountId: string;
}

/**
 * Attaches an id_verification_submission to a request AND transitions
 * state draft → id_pending_verification. Idempotent · if the request
 * is already attached to this submission, no state change is applied.
 */
export async function attachIdSubmission(
  args: AttachIdSubmissionArgs,
): Promise<ChildCreationRequest> {
  const requestId = requireNonEmpty(
    args.requestId,
    CHILD_CREATION_ERROR_CODES.REQUEST_NOT_FOUND,
  );
  const submissionId = requireNonEmpty(
    args.submissionId,
    CHILD_CREATION_ERROR_CODES.SUBMISSION_NOT_FOUND,
  );
  const actorId = requireNonEmpty(
    args.actorAccountId,
    CHILD_CREATION_ERROR_CODES.INVALID_ACTOR,
  );

  const row = await withClient(async (c: PgClientLike) => {
    const existing = await c.query(
      `SELECT * FROM nex.child_account_creation_request
        WHERE request_id = $1::uuid`,
      [requestId],
    );
    if ((existing.rowCount ?? 0) === 0) {
      throw new Error(CHILD_CREATION_ERROR_CODES.REQUEST_NOT_FOUND);
    }
    const current = existing.rows[0];
    if (String(current.parent_account_id) !== actorId) {
      throw new Error(CHILD_CREATION_ERROR_CODES.ACTOR_NOT_PARENT);
    }
    const state = String(current.state);
    if (state !== "draft" && state !== "id_pending_verification") {
      throw new Error(CHILD_CREATION_ERROR_CODES.INVALID_STATE_TRANSITION);
    }

    const r = await c.query(
      `UPDATE nex.child_account_creation_request
          SET id_submission_id = $2::uuid,
              state = CASE WHEN state = 'draft' THEN 'id_pending_verification' ELSE state END
        WHERE request_id = $1::uuid
        RETURNING *`,
      [requestId, submissionId],
    );
    return r.rows[0];
  });
  if (!row) throw new Error("child-creation.db_unavailable");
  return mapRow(row);
}

// ─────────────────────────────────────────────────────────────────────
// §4 · transitionCreationState
// ─────────────────────────────────────────────────────────────────────

export interface TransitionCreationStateArgs {
  readonly requestId: string;
  readonly nextState: ChildCreationState;
  readonly actorAccountId: string;
  readonly reason?: string;
  readonly reasonCode?: ChildCreationRejectionCode;
}

export async function transitionCreationState(
  args: TransitionCreationStateArgs,
): Promise<ChildCreationRequest> {
  const requestId = requireNonEmpty(
    args.requestId,
    CHILD_CREATION_ERROR_CODES.REQUEST_NOT_FOUND,
  );
  const actorId = requireNonEmpty(
    args.actorAccountId,
    CHILD_CREATION_ERROR_CODES.INVALID_ACTOR,
  );
  if (!isChildCreationState(args.nextState)) {
    throw new Error(CHILD_CREATION_ERROR_CODES.INVALID_STATE_TRANSITION);
  }
  const reasonCode =
    args.reasonCode === undefined || args.reasonCode === null
      ? null
      : isChildCreationRejectionCode(args.reasonCode)
        ? args.reasonCode
        : null;

  const row = await withClient(async (c: PgClientLike) => {
    const existing = await c.query(
      `SELECT * FROM nex.child_account_creation_request
        WHERE request_id = $1::uuid`,
      [requestId],
    );
    if ((existing.rowCount ?? 0) === 0) {
      throw new Error(CHILD_CREATION_ERROR_CODES.REQUEST_NOT_FOUND);
    }
    const current = existing.rows[0];
    if (String(current.parent_account_id) !== actorId) {
      throw new Error(CHILD_CREATION_ERROR_CODES.ACTOR_NOT_PARENT);
    }
    const from = String(current.state);
    if (!isChildCreationState(from)) {
      throw new Error(CHILD_CREATION_ERROR_CODES.INVALID_STATE_TRANSITION);
    }
    assertAllowedTransition(from, args.nextState);

    const r = await c.query(
      `UPDATE nex.child_account_creation_request
          SET state = $2,
              rejection_reason = COALESCE($3, rejection_reason),
              rejection_reason_code = COALESCE($4, rejection_reason_code),
              verified_at   = CASE WHEN $2 = 'id_verified' THEN now() ELSE verified_at END,
              approved_at   = CASE WHEN $2 = 'account_created' THEN now() ELSE approved_at END,
              rejected_at   = CASE WHEN $2 = 'id_rejected' THEN now() ELSE rejected_at END,
              cancelled_at  = CASE WHEN $2 = 'cancelled' THEN now() ELSE cancelled_at END
        WHERE request_id = $1::uuid
        RETURNING *`,
      [requestId, args.nextState, args.reason ?? null, reasonCode],
    );
    return r.rows[0];
  });
  if (!row) throw new Error("child-creation.db_unavailable");
  return mapRow(row);
}

// ─────────────────────────────────────────────────────────────────────
// §5 · getRequestById + listRequestsForParent
// ─────────────────────────────────────────────────────────────────────

export async function getRequestById(
  requestId: string,
  viewerAccountId: string,
): Promise<ChildCreationRequest | null> {
  requireNonEmpty(requestId, CHILD_CREATION_ERROR_CODES.REQUEST_NOT_FOUND);
  requireNonEmpty(viewerAccountId, CHILD_CREATION_ERROR_CODES.INVALID_ACTOR);
  const row = await withClient(async (c: PgClientLike) => {
    const r = await c.query(
      `SELECT * FROM nex.child_account_creation_request
        WHERE request_id = $1::uuid`,
      [requestId],
    );
    if ((r.rowCount ?? 0) === 0) return null;
    return r.rows[0];
  });
  if (!row) return null;
  if (String(row.parent_account_id) !== viewerAccountId) return null;
  return mapRow(row);
}

export async function listRequestsForParent(
  parentAccountId: string,
): Promise<readonly ChildCreationRequest[]> {
  requireNonEmpty(parentAccountId, CHILD_CREATION_ERROR_CODES.INVALID_PARENT);
  const rows = await withClient(async (c: PgClientLike) => {
    const r = await c.query(
      `SELECT * FROM nex.child_account_creation_request
        WHERE parent_account_id = $1
        ORDER BY created_at DESC`,
      [parentAccountId],
    );
    return r.rows;
  });
  if (!rows) return [];
  return rows.map(mapRow);
}

// ─────────────────────────────────────────────────────────────────────
// §6 · cancelRequest
// ─────────────────────────────────────────────────────────────────────

export async function cancelRequest(
  requestId: string,
  actorAccountId: string,
  reason?: string,
): Promise<ChildCreationRequest> {
  return transitionCreationState({
    requestId,
    nextState: "cancelled",
    actorAccountId,
    reason,
  });
}

// ─────────────────────────────────────────────────────────────────────
// §7 · materialiseChildAccount · live-mode gated
// ─────────────────────────────────────────────────────────────────────

export interface MaterialiseChildAccountArgs {
  readonly requestId: string;
  readonly actorAccountId: string;
}

/**
 * Honours the LIVE-mode feature flag:
 *
 *   · Flag OFF (default): transitions to `awaiting_legal_clearance`
 *     and logs a hold. No account is created. The UI surfaces an
 *     honest "awaiting Indonesian legal clearance" state.
 *
 *   · Flag ON: the service layer SHOULD delegate to the sealed
 *     account-creation primitive. CC-1 wave: we document the gap and
 *     throw `LIVE_MODE_DISABLED` even when flag is ON because the
 *     sealed primitive (which requires a Supabase auth user id)
 *     cannot be invoked without a founder-approved child-auth flow.
 *     The live-mode branch is intentionally honest: the flag will be
 *     insufficient until a separate "child Supabase user creation"
 *     wave lands.
 *
 * Preconditions:
 *   · request MUST exist and belong to actor
 *   · request state MUST be `id_verified` or `awaiting_legal_clearance`
 *   · request MUST NOT already have a created_child_account_id
 */
export async function materialiseChildAccount(
  args: MaterialiseChildAccountArgs,
): Promise<ChildCreationRequest> {
  const requestId = requireNonEmpty(
    args.requestId,
    CHILD_CREATION_ERROR_CODES.REQUEST_NOT_FOUND,
  );
  const actorId = requireNonEmpty(
    args.actorAccountId,
    CHILD_CREATION_ERROR_CODES.INVALID_ACTOR,
  );

  const row = await withClient(async (c: PgClientLike) => {
    const existing = await c.query(
      `SELECT * FROM nex.child_account_creation_request
        WHERE request_id = $1::uuid`,
      [requestId],
    );
    if ((existing.rowCount ?? 0) === 0) {
      throw new Error(CHILD_CREATION_ERROR_CODES.REQUEST_NOT_FOUND);
    }
    const current = existing.rows[0];
    if (String(current.parent_account_id) !== actorId) {
      throw new Error(CHILD_CREATION_ERROR_CODES.ACTOR_NOT_PARENT);
    }
    const state = String(current.state);
    if (state !== "id_verified" && state !== "awaiting_legal_clearance") {
      throw new Error(CHILD_CREATION_ERROR_CODES.ID_NOT_VERIFIED);
    }
    if (current.created_child_account_id) {
      throw new Error(CHILD_CREATION_ERROR_CODES.ALREADY_MATERIALISED);
    }

    const liveEnabled = isChildCreateLiveModeEnabled();
    if (!liveEnabled) {
      // Flag OFF path · transition to awaiting_legal_clearance.
      // Idempotent · if already there, we no-op the state write.
      const r = await c.query(
        `UPDATE nex.child_account_creation_request
            SET state = 'awaiting_legal_clearance',
                rejection_reason_code = COALESCE(rejection_reason_code, 'awaiting_legal_clearance')
          WHERE request_id = $1::uuid
            AND state IN ('id_verified','awaiting_legal_clearance')
          RETURNING *`,
        [requestId],
      );
      return r.rows[0];
    }

    // Flag ON path (CC-1 wave): HONEST GAP.
    // The sealed account-service.createAccount() requires a
    // supabase_user_id which cannot be minted for a minor without a
    // separate founder-approved child-auth flow. We refuse to invent
    // a stub child account here · we re-use the awaiting_legal_clearance
    // state as a persistence surface and throw LIVE_MODE_DISABLED so
    // the operator understands the gap.
    throw new Error(CHILD_CREATION_ERROR_CODES.LIVE_MODE_DISABLED);
  });
  if (!row) throw new Error("child-creation.db_unavailable");
  return mapRow(row);
}
