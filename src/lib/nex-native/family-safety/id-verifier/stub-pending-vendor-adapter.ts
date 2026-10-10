// src/lib/nex-native/family-safety/id-verifier/stub-pending-vendor-adapter.ts
//
// NEX Family Safety · ID verifier · stub adapter.
// --------------------------------------------------------------------
// Current-wave adapter · ALWAYS returns 'pending' on submit AND on
// pollStatus. The founder has not yet picked a real vendor (Jumio /
// Onfido / Veriff / Privy ID · decision B 2026-10-10). This file
// exposes the contract so the service layer may wire its calls
// without caring which vendor eventually lands.
//
// Operator path to flip an outcome:
//   1. NEX_FAMILY_SAFETY_ID_VERIFIER_MANUAL_OVERRIDE=true (flag OFF
//      by default)
//   2. Call `manualOverrideOutcome({ submissionId, outcome, ... })` ·
//      a reserved internal helper exported from this module.
//   3. Audit entry is appended by the caller (service layer).

import "server-only";

import { randomUUID } from "node:crypto";

import { withClient } from "@/lib/nex/db";
import type { PgClientLike } from "@/lib/nex/db";

import { isChildCreationState } from "../child-account-creation/types";
import { isIdVerifierManualOverrideEnabled } from "../child-account-creation/feature-flag";
import {
  ID_VERIFIER_ERROR_CODES,
  type IdVerifierAdapter,
  type IdVerifierPollResult,
  type IdVerifierSubmitArgs,
  type IdVerifierSubmitResult,
} from "./types";

// Keep this hyper-tight so callers can't smuggle unknown outcomes.
const MANUAL_OVERRIDE_OUTCOMES = ["verified", "rejected"] as const;
export type ManualOverrideOutcome = (typeof MANUAL_OVERRIDE_OUTCOMES)[number];

export class StubPendingVendorAdapter implements IdVerifierAdapter {
  readonly adapterName = "stub_pending_vendor";

  /**
   * The stub never persists bytes (the storage module does that in a
   * separate call). It returns a fresh pending submission id. The
   * service layer is responsible for threading the submission_id into
   * the id_verification_submission row AND the child creation request.
   *
   * Validation: non-empty bytes, non-empty idempotency key.
   */
  async submit(args: IdVerifierSubmitArgs): Promise<IdVerifierSubmitResult> {
    if (!args.submitterAccountId || args.submitterAccountId.trim().length === 0) {
      throw new Error(ID_VERIFIER_ERROR_CODES.INVALID_ARGS);
    }
    if (!args.idempotencyKey || args.idempotencyKey.trim().length === 0) {
      throw new Error(ID_VERIFIER_ERROR_CODES.INVALID_ARGS);
    }
    if (!(args.documentBytes instanceof Uint8Array) || args.documentBytes.length === 0) {
      throw new Error(ID_VERIFIER_ERROR_CODES.BYTES_EMPTY);
    }
    return {
      submissionId: randomUUID(),
      outcome: "pending",
    };
  }

  /**
   * Stub poll · always returns pending. Operators flip the row via
   * `manualOverrideOutcome` (feature-flag gated).
   */
  async pollStatus(submissionId: string): Promise<IdVerifierPollResult> {
    if (!submissionId || submissionId.trim().length === 0) {
      throw new Error(ID_VERIFIER_ERROR_CODES.INVALID_ARGS);
    }
    return { outcome: "pending" };
  }
}

/**
 * Dev-only operator helper. GATED behind
 * NEX_FAMILY_SAFETY_ID_VERIFIER_MANUAL_OVERRIDE=true. Flips a
 * submission's verification_outcome and stamps verified_at /
 * rejected_at. Service layer is responsible for cascading the request
 * state transition and appending an audit row.
 *
 * Returns true when the row was updated · false when the submission
 * was already in a terminal outcome.
 */
export async function manualOverrideOutcome(args: {
  readonly submissionId: string;
  readonly outcome: ManualOverrideOutcome;
  readonly responseSummaryRedacted?: string;
}): Promise<boolean> {
  if (!isIdVerifierManualOverrideEnabled()) {
    throw new Error(ID_VERIFIER_ERROR_CODES.MANUAL_OVERRIDE_DISABLED);
  }
  if (!args.submissionId || args.submissionId.trim().length === 0) {
    throw new Error(ID_VERIFIER_ERROR_CODES.INVALID_ARGS);
  }
  if (!(MANUAL_OVERRIDE_OUTCOMES as readonly string[]).includes(args.outcome)) {
    throw new Error(ID_VERIFIER_ERROR_CODES.INVALID_OVERRIDE_OUTCOME);
  }
  // Response summary bounds enforced by DB CHECK (1..500) · we clamp here.
  const summary = typeof args.responseSummaryRedacted === "string"
    ? args.responseSummaryRedacted.slice(0, 500)
    : null;

  const result = await withClient(async (c: PgClientLike) => {
    const r = await c.query(
      `UPDATE nex.id_verification_submission
          SET verification_outcome = $2,
              verified_at = CASE WHEN $2 = 'verified' THEN now() ELSE verified_at END,
              rejected_at = CASE WHEN $2 = 'rejected' THEN now() ELSE rejected_at END,
              verifier_response_summary_redacted = COALESCE($3, verifier_response_summary_redacted)
        WHERE submission_id = $1::uuid
          AND verification_outcome = 'pending'
        RETURNING submission_id`,
      [args.submissionId, args.outcome, summary],
    );
    return (r.rowCount ?? 0) > 0;
  });

  return Boolean(result);
}

// Silence unused-import warning when consumers only re-export the class.
void isChildCreationState;
