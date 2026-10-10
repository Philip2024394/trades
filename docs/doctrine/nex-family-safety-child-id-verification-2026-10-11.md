# NEX Family Safety · Child ID Verification Interface + Legal Gate Contract

Authored 2026-10-10 by CC-4. Dates are ESTIMATES.

This document seals the **ID verifier adapter interface** that CC-1
ships as part of the migration-203..207 wave, and the **legal gate
contract** that bridges the verifier output into the state machine.

## 1 · Why a verifier adapter interface

The question "is this parent authorised to create this child account?"
has no single global answer. In Indonesia the authoritative identity
documents are the Kartu Keluarga (KK), the Akta Kelahiran (birth
certificate), and the national ID (KTP). In other jurisdictions the
authoritative set is different (US passport card, UK passport, EU
national ID, etc). The decision of which vendor NEX uses is a legal +
commercial decision pending founder authorisation (**decision B**).

To defer the vendor choice without delaying the UI + service layer,
CC-1 ships a thin **adapter interface** that the service layer calls
and a **stub implementation** that always returns `pending`. When a
vendor is selected we drop in a new adapter next to the stub and
flip the `verifier_adapter` default on new submissions.

## 2 · Adapter interface

Location: `src/lib/nex-native/family-safety/id-verifier/types.ts`.

```ts
export type IdVerifierAdapterToken =
  | "stub_pending_vendor"
  | "jumio"
  | "onfido"
  | "veriff"
  | "privy_id";

export interface IdVerificationSubmissionDraft {
  readonly submitterAccountId: string;
  readonly documentType:
    | "indonesian_kk"
    | "indonesian_birth_certificate"
    | "indonesian_akta"
    | "passport"
    | "other";
  readonly documentStorageRef: string;    // opaque, resolved by storage
  readonly documentBytesSha256: string;   // integrity only
  readonly idempotencyKey: string;
}

export type IdVerificationOutcome =
  | "pending"
  | "verified"
  | "rejected"
  | "unknown";

export interface IdVerificationResult {
  readonly outcome: IdVerificationOutcome;
  /** Max 500 chars · no personal data · service-layer regex strips. */
  readonly summaryRedacted: string | null;
}

export interface IdVerifierAdapter {
  readonly token: IdVerifierAdapterToken;
  submit(draft: IdVerificationSubmissionDraft): Promise<IdVerificationResult>;
  poll(submissionId: string): Promise<IdVerificationResult>;
}

export interface IdVerificationStorage {
  put(bytes: Uint8Array, mimeType: string): Promise<{
    readonly storageRef: string;
    readonly sha256: string;
  }>;
  // Reader is reserved for the admin + verifier paths only.
  __adminGet(storageRef: string): Promise<Uint8Array | null>;
}
```

## 3 · Current stub

`StubPendingVendorAdapter`:

- `submit()` writes nothing beyond what the service already writes
  (an `id_verification_submission` row with `verification_outcome =
  'pending'`) and returns `{ outcome: "pending", summaryRedacted: null }`.
- `poll()` returns the LAST known outcome from the DB — operator can
  flip the row via the dev-only `__opManualApprove(submissionId)` helper.

The stub is **always** the default. The service layer rejects any
submission that does not have a verifier adapter token resolved on the
server; it never trusts a client-sent adapter token.

## 4 · Future vendor adapters

TBD per **founder decision B**. Candidates:

### Jumio

- OJK-registered in Indonesia (as of 2026).
- Supports KK + Akta + KTP + passport.
- SOC 2 Type II + ISO 27001.
- Priced per verification; volume commitment typical.

### Onfido

- OJK-registered subset.
- Supports KK + passport + driver licence; Akta reliability is
  "best-effort" (TBD at vendor-selection).
- SOC 2 Type II + ISO 27001.

### Veriff

- Supports KK + passport.
- EU-based; data residency considerations if we need to keep IDs
  inside Indonesia or Southeast Asia (TBD).

### Privy ID

- Indonesian company; OJK-registered.
- Strongest fit for Akta Kelahiran handling.
- Lower volume ceiling than the global vendors; may need multi-vendor
  routing.

The adapter interface above supports multi-vendor routing: the service
layer picks an adapter based on document type and submitter geography.
That routing lives in `src/lib/nex-native/family-safety/id-verifier/select-adapter.ts`.

## 5 · Document storage

Storage is implemented by `IdVerificationStorage`. Current implementation
writes bytes into `nex.id_document_blob` with a SHA256 integrity check
and returns a storage ref of the form `nex-id-blob:<submission_id>`.

### Access controls

- **ID bytes NEVER return to any frontend-queryable path.** The only
  reader is `__adminGet(storageRef)` which:
  - Verifies the caller is `NEX_SESSION_IDENTITY === "nex_dev"` for
    dev, or an admin-session JWT for prod.
  - Resolves the submission_id from the storage ref.
  - Reads from `nex.id_document_blob` via a sealed service-role
    client.
- The frontend only ever sees the `document_filename` and
  `document_type` that the parent typed/picked — never the bytes.
- `document_bytes_sha256` is stored on the metadata table so
  operators can integrity-check without opening the file.

### Retention

**TBD · founder + legal review decision.**

Working draft for discussion (NOT sealed):

- Keep bytes for 90 days after `verification_outcome` reaches a
  terminal state (verified / rejected).
- After 90 days, drop the `id_document_blob` row via the sealed
  retention sweep; retain the metadata row indefinitely.
- Honour explicit parent "delete my document" requests at any time
  (adds a `cancelled` state to the submission + deletes the blob).

A migration **208_nex_id_document_blob_retention.sql** is RESERVED but
not shipped. Final retention length is pending Indonesian legal
counsel's review.

### Breach notification

**TBD · defer to Indonesian legal counsel.**

Working draft for discussion:

- Suspected unauthorised access to `nex.id_document_blob` triggers an
  operator alert immediately (SOC-only sweep).
- Parents whose submission bytes were accessed receive a notification
  within 72 hours.
- The regulator (OJK) notification path depends on the final retention
  + classification decision.

This is a legal + reporting process; the technical hook is a sealed
audit entry on `nex.parent_custody_audit_log` with a reserved action
token (NOT YET DEFINED — would require migration 207 ALTER plus the
breach doctrine commit).

## 6 · Legal gate contract

The output of the verifier adapter is converted to a state transition
by the service layer:

| Verifier outcome | Flag OFF (default)              | Flag ON                     |
| ---------------- | ------------------------------- | --------------------------- |
| `pending`        | request stays `id_pending_verification` | same |
| `verified`       | request → `awaiting_legal_clearance` | request → `account_created` + custody + minor-profile |
| `rejected`       | request → `id_rejected` + reason code | same |
| `unknown`        | operator alert; no state transition | same |

The transition is **atomic**: a single DB transaction writes the
request state, the submission outcome, and (if flag ON) the account +
custody + minor-profile rows. Partial failures roll everything back.

The `awaiting_legal_clearance` state is the honest resting state during
Phase 1. The parent is never told "we're sending you an account" when
no account has been created.

## 7 · What CC-4 verifies in Playwright

- The `pending` default of the stub + no `nex_account` created
  (scenario S07 in `nex-family-safety-create-child.spec.ts`).
- The DB rows exist in `id_verification_submission` and
  `id_document_blob` (scenario S06).
- The rejection reason surfaces honestly on the status page
  (scenario S09).

Each is `test.fixme()` until the service layer is shipped.
