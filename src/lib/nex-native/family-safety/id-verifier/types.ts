// src/lib/nex-native/family-safety/id-verifier/types.ts
//
// NEX Family Safety · ID verifier adapter · sealed interface.
// --------------------------------------------------------------------
// This module defines the TYPES only. Concrete adapters live in
// sibling files. The current wave ships a `StubPendingVendorAdapter`
// that always returns 'pending'; the real vendor (Jumio / Onfido /
// Veriff / Privy ID) is a founder decision deferred to a later wave.
//
// Doctrine:
//   · Adapters NEVER return plaintext document bytes · they consume
//     the opaque reference minted by `id-verification-storage.ts`.
//   · Adapters NEVER return personal data in the response summary · the
//     service layer caps the field at 500 chars + strips email / phone
//     patterns before persisting.
//   · Adapters SHOULD return 'pending' when they genuinely cannot
//     decide; the service layer never silently promotes an unknown
//     outcome to 'verified'.

import "server-only";

import type { IdDocumentType, IdVerificationOutcome } from "../child-account-creation/types";

/**
 * Non-terminal poll outcome: adapter has not yet decided. The service
 * layer may re-poll later OR an operator may flip the submission via
 * the manual-override helper (gated by
 * NEX_FAMILY_SAFETY_ID_VERIFIER_MANUAL_OVERRIDE).
 */
export type IdVerifierPollOutcome = IdVerificationOutcome;

export interface IdVerifierSubmitArgs {
  readonly submitterAccountId: string;
  readonly documentType: IdDocumentType;
  readonly documentBytes: Uint8Array;
  readonly idempotencyKey: string;
}

export interface IdVerifierSubmitResult {
  readonly submissionId: string;
  readonly outcome: "pending";
}

export interface IdVerifierPollResult {
  readonly outcome: IdVerifierPollOutcome;
  readonly responseSummaryRedacted?: string;
}

export interface IdVerifierAdapter {
  readonly adapterName: string;
  submit(args: IdVerifierSubmitArgs): Promise<IdVerifierSubmitResult>;
  pollStatus(submissionId: string): Promise<IdVerifierPollResult>;
}

export const ID_VERIFIER_ERROR_CODES = {
  INVALID_ARGS: "id-verifier.invalid_args",
  SUBMISSION_NOT_FOUND: "id-verifier.submission_not_found",
  BYTES_EMPTY: "id-verifier.bytes_empty",
  MANUAL_OVERRIDE_DISABLED: "id-verifier.manual_override_disabled",
  INVALID_OVERRIDE_OUTCOME: "id-verifier.invalid_override_outcome",
} as const;
