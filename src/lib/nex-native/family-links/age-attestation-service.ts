// src/lib/nex-native/family-links/age-attestation-service.ts
//
// NEX Family Links · Phase 1 · lightweight age attestation service.
//
// Server-only. Thin pg wrapper around nex.account_age_attestation
// (migration 198). Captures a declared date-of-birth + attestation
// metadata. Deliberately does NOT:
//   · accept ID-document uploads
//   · accept biometric capture
//   · integrate a vendor identity verifier
//
// Phase 1 constraints enforced here:
//   · simulated=TRUE always
//   · attestation_method must be in PHASE_1_ACCEPTED_METHODS ·
//     'document_verified_future_phase' is reserved and REJECTED
//   · attested_by='guardian' requires an ACTIVE family_link where the
//     actor is a guardian_primary or guardian_secondary of accountId
//   · attested_by='self' requires actor === accountId
//   · attested_by='system_fallback' is intentionally not exposed via
//     this service · reserved for future server-initiated flows and
//     rejected here with UNAUTHORIZED_ACTOR
//   · exactly one active (non-superseded) attestation per account ·
//     recording a new one supersedes the prior

import "server-only";

import { withClient } from "@/lib/nex/db";
import type { PgClientLike } from "@/lib/nex/db";
import {
  AGE_ATTESTATION_ERROR_CODES,
  isAgeAttestationAttestedBy,
  isAgeAttestationMethod,
  isPhase1AcceptedMethod,
  type AgeAttestationAttestedBy,
  type AgeAttestationMethod,
  type AgeAttestationRow,
} from "./types";

// ═════════════════════════════════════════════════════════════════════
// §1 · Internal helpers
// ═════════════════════════════════════════════════════════════════════

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return new Date(v).toISOString();
  return new Date(0).toISOString();
}

function toIsoDate(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "string") {
    // Date columns from pg come back as 'YYYY-MM-DD' strings.
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(v);
    if (m) return m[1];
    return new Date(v).toISOString().slice(0, 10);
  }
  return "1970-01-01";
}

function toStringOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return String(v);
}

function mapRow(r: Record<string, unknown>): AgeAttestationRow {
  const attestedBy = String(r.attested_by ?? "");
  const method = String(r.attestation_method ?? "");
  if (!isAgeAttestationAttestedBy(attestedBy)) {
    throw new Error(
      `age_attestation.unknown_attested_by · got '${attestedBy}' · migration drift`,
    );
  }
  if (!isAgeAttestationMethod(method)) {
    throw new Error(
      `age_attestation.unknown_method · got '${method}' · migration drift`,
    );
  }
  return {
    attestationId: String(r.attestation_id),
    accountId: String(r.account_id),
    declaredDateOfBirth: toIsoDate(r.declared_date_of_birth),
    attestedBy,
    attestedByAccountId: toStringOrNull(r.attested_by_account_id),
    attestationMethod: method,
    attestationNotes: toStringOrNull(r.attestation_notes),
    supersededBy: toStringOrNull(r.superseded_by),
    simulated: Boolean(r.simulated),
    createdAt: toIso(r.created_at),
  };
}

function requireNonEmptyString(v: unknown, label: string): string {
  if (typeof v !== "string" || v.trim().length === 0) {
    throw new Error(`age_attestation.invalid_${label}`);
  }
  return v;
}

/** Validate an ISO date string and bounds [1900-01-02, today]. */
function validateDeclaredDob(input: string): string {
  if (typeof input !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    throw new Error(AGE_ATTESTATION_ERROR_CODES.INVALID_DOB);
  }
  const parsed = new Date(`${input}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime())) {
    throw new Error(AGE_ATTESTATION_ERROR_CODES.INVALID_DOB);
  }
  const nowUtc = Date.now();
  const minMs = Date.parse("1900-01-02T00:00:00Z");
  if (parsed.getTime() < minMs || parsed.getTime() > nowUtc) {
    throw new Error(AGE_ATTESTATION_ERROR_CODES.INVALID_DOB);
  }
  return input;
}

function validateNotes(notes: string | undefined): string | null {
  if (notes === undefined || notes === null) return null;
  if (typeof notes !== "string" || notes.length < 1 || notes.length > 500) {
    throw new Error(AGE_ATTESTATION_ERROR_CODES.INVALID_NOTES);
  }
  return notes;
}

/** Confirm that the actor holds an active guardian role over the target. */
async function actorIsActiveGuardianOf(
  client: PgClientLike,
  actorAccountId: string,
  targetAccountId: string,
): Promise<boolean> {
  const res = await client.query(
    `SELECT 1 FROM nex.family_link
       WHERE guardian_account_id = $1
         AND child_account_id    = $2
         AND state               = 'active'
         AND role                IN ('guardian_primary','guardian_secondary')
       LIMIT 1`,
    [actorAccountId, targetAccountId],
  );
  return (res.rowCount ?? 0) > 0;
}

// ═════════════════════════════════════════════════════════════════════
// §2 · recordAttestation
// ═════════════════════════════════════════════════════════════════════

export interface RecordAttestationArgs {
  readonly accountId: string;
  readonly declaredDateOfBirth: string;
  readonly attestedBy: AgeAttestationAttestedBy;
  readonly attestedByAccountId: string | null;
  readonly attestationNotes?: string;
  readonly actorAccountId: string;
}

export async function recordAttestation(
  args: RecordAttestationArgs,
): Promise<AgeAttestationRow> {
  const accountId = requireNonEmptyString(args.accountId, "account_id");
  const actorId = requireNonEmptyString(args.actorAccountId, "actor_account_id");
  const dob = validateDeclaredDob(args.declaredDateOfBirth);
  const notes = validateNotes(args.attestationNotes);

  if (!isAgeAttestationAttestedBy(args.attestedBy)) {
    throw new Error(AGE_ATTESTATION_ERROR_CODES.INVALID_ATTESTED_BY);
  }

  // 'system_fallback' is reserved for future server-initiated flows
  // and not exposed via this service entry point.
  if (args.attestedBy === "system_fallback") {
    throw new Error(AGE_ATTESTATION_ERROR_CODES.UNAUTHORIZED_ACTOR);
  }

  // Attestor-id shape:
  //   self      → must equal accountId
  //   guardian  → required, must equal actor; actor must be guardian of accountId
  if (args.attestedBy === "self") {
    if (actorId !== accountId) {
      throw new Error(AGE_ATTESTATION_ERROR_CODES.UNAUTHORIZED_ACTOR);
    }
    if (args.attestedByAccountId !== accountId) {
      throw new Error(AGE_ATTESTATION_ERROR_CODES.MISSING_ATTESTOR_ID);
    }
  }
  if (args.attestedBy === "guardian") {
    if (args.attestedByAccountId == null) {
      throw new Error(AGE_ATTESTATION_ERROR_CODES.MISSING_ATTESTOR_ID);
    }
    if (args.attestedByAccountId !== actorId) {
      throw new Error(AGE_ATTESTATION_ERROR_CODES.UNAUTHORIZED_ACTOR);
    }
    if (actorId === accountId) {
      // Prevent self-elevation: a child cannot "guardian-attest" for self.
      throw new Error(AGE_ATTESTATION_ERROR_CODES.UNAUTHORIZED_ACTOR);
    }
  }

  // Infer the method from attestedBy (always one of the Phase 1
  // accepted values · never the reserved document-verified method).
  const method: AgeAttestationMethod =
    args.attestedBy === "guardian" ? "guardian_declared" : "declared";
  if (!isPhase1AcceptedMethod(method)) {
    // Defence-in-depth · unreachable given the branch above.
    throw new Error(AGE_ATTESTATION_ERROR_CODES.METHOD_RESERVED);
  }

  const result = await withClient(async (client) => {
    // Guardian attestation requires an ACTIVE link.
    if (args.attestedBy === "guardian") {
      const ok = await actorIsActiveGuardianOf(client, actorId, accountId);
      if (!ok) {
        throw new Error(AGE_ATTESTATION_ERROR_CODES.UNAUTHORIZED_ACTOR);
      }
    }

    const ins = await client.query(
      `INSERT INTO nex.account_age_attestation (
         account_id,
         declared_date_of_birth,
         attested_by,
         attested_by_account_id,
         attestation_method,
         attestation_notes,
         simulated
       ) VALUES ($1, $2, $3, $4, $5, $6, TRUE)
       RETURNING *`,
      [
        accountId,
        dob,
        args.attestedBy,
        args.attestedByAccountId,
        method,
        notes,
      ],
    );
    if (ins.rowCount !== 1 || !ins.rows[0]) {
      throw new Error("age_attestation.insert_failed");
    }
    return mapRow(ins.rows[0]);
  });

  if (result === null) {
    throw new Error(AGE_ATTESTATION_ERROR_CODES.DB_UNAVAILABLE);
  }
  return result;
}

// ═════════════════════════════════════════════════════════════════════
// §3 · readActiveAttestation
// ═════════════════════════════════════════════════════════════════════

export async function readActiveAttestation(
  accountId: string,
): Promise<AgeAttestationRow | null> {
  const id = requireNonEmptyString(accountId, "account_id");
  const result = await withClient(async (client) => {
    const res = await client.query(
      `SELECT * FROM nex.account_age_attestation
         WHERE account_id    = $1
           AND superseded_by IS NULL
         ORDER BY created_at DESC
         LIMIT 1`,
      [id],
    );
    if (res.rowCount !== 1 || !res.rows[0]) return null;
    return mapRow(res.rows[0]);
  });
  if (result === null) return null;
  return result;
}

// ═════════════════════════════════════════════════════════════════════
// §4 · supersedeAttestation
// ═════════════════════════════════════════════════════════════════════

export interface SupersedeAttestationArgs {
  readonly priorAttestationId: string;
  readonly newAttestation: RecordAttestationArgs;
}

/**
 * Record a new attestation and mark the prior one as superseded in a
 * single logical operation. Partial-unique index enforces one active
 * row per account; we flip the prior AFTER inserting the new one so
 * mid-flow failures leave the prior intact.
 */
export async function supersedeAttestation(
  args: SupersedeAttestationArgs,
): Promise<AgeAttestationRow> {
  const priorId = requireNonEmptyString(args.priorAttestationId, "prior_attestation_id");

  // Validate the new attestation first (fail fast on bad input).
  // recordAttestation will re-validate inside its own body, but we
  // want to reject before we commit the supersession write.
  if (
    args.newAttestation.accountId == null ||
    args.newAttestation.accountId.trim() === ""
  ) {
    throw new Error(AGE_ATTESTATION_ERROR_CODES.INVALID_ACCOUNT_ID);
  }

  // Phase 1: we implement supersession by recording the new row then
  // marking the prior one superseded_by=new_row.id. If the prior row
  // does not exist, we throw PRIOR_NOT_FOUND; the new row is NOT
  // recorded.
  const inserted = await recordAttestation(args.newAttestation);

  const result = await withClient(async (client) => {
    const upd = await client.query(
      `UPDATE nex.account_age_attestation
          SET superseded_by = $1
        WHERE attestation_id = $2
          AND superseded_by IS NULL
          AND account_id     = $3
      RETURNING attestation_id`,
      [inserted.attestationId, priorId, inserted.accountId],
    );
    if ((upd.rowCount ?? 0) !== 1) {
      throw new Error(AGE_ATTESTATION_ERROR_CODES.PRIOR_NOT_FOUND);
    }
    return inserted;
  });

  if (result === null) {
    throw new Error(AGE_ATTESTATION_ERROR_CODES.DB_UNAVAILABLE);
  }
  return result;
}

// ═════════════════════════════════════════════════════════════════════
// §5 · readAttestationHistory
// ═════════════════════════════════════════════════════════════════════

export async function readAttestationHistory(
  accountId: string,
): Promise<readonly AgeAttestationRow[]> {
  const id = requireNonEmptyString(accountId, "account_id");
  const rows = await withClient(async (client) => {
    const res = await client.query(
      `SELECT * FROM nex.account_age_attestation
         WHERE account_id = $1
         ORDER BY created_at DESC`,
      [id],
    );
    return res.rows;
  });
  if (rows === null) return [];
  return rows.map(mapRow);
}
