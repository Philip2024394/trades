# NEX Family Safety · Create-Child Architecture

Authored 2026-10-10 by CC-4 for the create-child + custody + age-transition
wave. Dates are ESTIMATES. The founder authorisation is:

> "no demo all build must be live on the app"
> "this is world class system. to protect children"

This document is the sealed architecture for the Phase 1 create-child +
custody workflow. CC-1 ships the data layer and services; CC-2 ships the
wizard UI; CC-3 ships the age-transition workflow + minor-safechat
enforcer; CC-4 ships the Playwright suites, the regression sweep, and
these doctrine documents.

## 1 · The pivot from invite → create

The sealed FS-2 wave shipped a **guardian-guardian invite** path: an
adult account invites another adult account into a family link. That
path remains, but the next population of users for Family Safety is
**parents of under-16 children who do not yet have a NEX account**. For
that population the "invite" verb is wrong — there is no counterparty
account to invite.

The pivot is a new verb: **create**. A parent-initiated flow that:

1. Collects the child's name + declared date of birth.
2. Collects a government ID document from the parent as evidence that
   the parent is authorised to create the account.
3. Routes the submission through an **ID verifier adapter**.
4. On a successful verification, **creates the child's NEX account**
   and binds the parent as **custodian** until the child turns 16.

This workflow has gated side-effects. The LIVE child-account creation
step is behind a feature flag `NEX_FAMILY_SAFETY_CHILD_CREATE_LIVE_MODE`
that defaults OFF. When the flag is OFF — the only state at the time
this document is sealed — a verified request transitions to the honest
state `awaiting_legal_clearance` rather than materialising a live
`nex_account` row.

## 2 · Data model · migrations 203-207

CC-1 shipped the following migrations. All five are idempotent, additive,
and session-identity gated (`current_database() = 'nex_dev'`).

### 203_nex_child_account_creation_request.sql

One row per parent-initiated child-creation attempt. Columns of note:

- `request_id uuid` PK
- `parent_account_id text` NOT NULL
- `child_display_name text` NOT NULL, length 1-60
- `child_declared_date_of_birth date` NOT NULL, between 1900-01-01 and
  today
- `id_submission_id uuid` NULL, FK to 204 with `ON DELETE SET NULL`
- `state text` CHECK list of 8 states:
  `draft`, `id_pending_verification`, `id_verified`, `id_rejected`,
  `awaiting_legal_clearance`, `account_created`, `cancelled`, `expired`
- `created_child_account_id text` NULL
- `rejection_reason text` + `rejection_reason_code text` with 7
  rejection codes
- `simulated boolean` NOT NULL DEFAULT TRUE
- `expires_at timestamptz` NOT NULL DEFAULT now()+30 days

Index invariants:

- Partial unique index enforces at-most-one ACTIVE request per
  (parent, lower(name), DOB) tuple. "Active" = draft /
  id_pending_verification / id_verified / awaiting_legal_clearance.
  This prevents a parent accidentally spawning parallel requests for
  the same child.

### 204_nex_id_verification_submission.sql + id_document_blob

Two tables intentionally separated:

- `nex.id_verification_submission` — metadata only. Columns of note:
  - `submission_id uuid` PK
  - `submitter_account_id text` NOT NULL (= parent)
  - `document_type text` CHECK list:
    `indonesian_kk`, `indonesian_birth_certificate`, `indonesian_akta`,
    `passport`, `other`
  - `document_storage_ref text` — opaque pointer, never a public URL
  - `document_bytes_sha256 text` CHECK length = 64
  - `idempotency_key text` UNIQUE
  - `verifier_adapter text` DEFAULT `'stub_pending_vendor'`
  - `verification_outcome text` CHECK list: `pending` / `verified` /
    `rejected` / `unknown`
  - `verifier_response_summary_redacted text` — max 500 chars, must not
    contain personal data (service-layer regex strip; doctrine, not
    DB-enforced)
  - `simulated boolean` NOT NULL DEFAULT TRUE
- `nex.id_document_blob` — bytes only. Columns of note:
  - `submission_id uuid` PK, FK to `id_verification_submission` with
    `ON DELETE CASCADE`
  - `document_bytes bytea` NOT NULL
  - `mime_type text` CHECK: `image/jpeg`, `image/png`, `image/webp`,
    `application/pdf`

The separation is doctrinal: routine reads of the submission ledger
NEVER join against the bytes. **The frontend NEVER queries
`id_document_blob`.** The ONLY reader is a sealed admin service
reserved for verifier-adapter polling.

### 205_nex_parent_custody_link.sql

The custodial relationship between a parent and a minor account they
created. Columns of note:

- `custody_id uuid` PK
- `parent_account_id text` + `child_account_id text` (CHECK: distinct)
- `link_type text` CHECK list: `created_minor`, `transferred_at_16`,
  `manual_grant`
- `creation_request_id uuid` FK to 203 with `ON DELETE SET NULL`
- `auto_transfer_at timestamptz` — the 16th-birthday timestamp CC-3's
  age-transition workflow consumes
- `transferred_at timestamptz` + `revoked_at timestamptz` NULL
- `simulated boolean` NOT NULL DEFAULT TRUE

Partial unique index enforces **one ACTIVE custody per child** (where
`revoked_at IS NULL AND transferred_at IS NULL`).

### 206_nex_account_minor_profile.sql

One row per account that is a minor. Columns of note:

- `account_id text` PK
- `is_minor boolean` NOT NULL DEFAULT TRUE
- `parent_custody_id uuid` FK to 205 with `ON DELETE SET NULL`
- `auto_transfer_at timestamptz` + `transferred_at timestamptz`
  (mirrors 205 for read-side convenience)
- **`safechat_always_on boolean` NOT NULL DEFAULT TRUE** — founder
  decision D. The parent cannot disable it. This flag is exposed
  read-only to the parent dashboard. CC-3's enforcer owns the write
  path (only the age-transition workflow may flip it, and only when
  `is_minor` goes FALSE at age 16).

### 207_nex_parent_custody_audit_log.sql

Append-only ledger. One row per custodial side-effect. Columns of note:

- `audit_id uuid` PK
- `custody_id uuid` FK to 205 with `ON DELETE CASCADE`
- `parent_account_id text` + `child_account_id text`
- `action text` CHECK list:
  `custody_created`, `password_reset_requested`,
  `password_reset_completed`, `child_viewed_in_dashboard`,
  `safechat_summary_viewed`, `age_transfer_notified`,
  `age_transfer_completed`, `custody_revoked`
- `action_details_redacted text` — service layer enforces no plaintext
  credentials or private content (doctrine, not DB-enforced)
- `simulated boolean` NOT NULL DEFAULT TRUE

APPEND-ONLY. The service layer never offers an UPDATE or DELETE path.
A revoke operation produces a new `custody_revoked` row.

## 3 · Service layer

Scoped by CC-1 and consumed by CC-2's UI:

| Module                                                      | Purpose                                     |
| ----------------------------------------------------------- | ------------------------------------------- |
| `src/lib/nex-native/family-safety/child-account-creation/service.ts` | Server actions for the create-child wizard  |
| `src/lib/nex-native/family-safety/custody/service.ts`       | Parent custody list / detail / password reset / revoke |
| `src/lib/nex-native/family-safety/id-verifier/*`            | Adapter interface + stub + select-adapter   |
| CC-3 — `age-transition-service.ts`                          | Countdown + notify + confirm + sweep        |
| CC-3 — `minor-safechat-enforcer.ts`                         | Reads 206 and locks safechat_always_on      |
| CC-3 — `dashboard-service.ts` extensions                    | Merges parent_custody_link into the result  |

Every mutation is:

- Server-side (`"use server"` or in a route handler).
- Session-gated via `resolveNexAppSessionFromContext()`.
- Ownership-checked (parent_account_id = session.account.id).

## 4 · Legal gate

**`NEX_FAMILY_SAFETY_CHILD_CREATE_LIVE_MODE`** defaults OFF.

Semantics:

- Flag OFF (default):
  - After `id_verified`, the request transitions to
    `awaiting_legal_clearance` INSTEAD of invoking the sealed
    account-creation primitive. No `nex_account` row is created.
    No `parent_custody_link` row is created.
  - UI mounts `<LegalClearancePendingBanner>` (sealed sealed-wave
    component) on every create-child/* surface, including the review
    page and the status page.
  - Rejection reason code `awaiting_legal_clearance` is reserved for
    this path.
- Flag ON (operator flip post Indonesian legal clearance):
  - After `id_verified`, the service writes to `nex_account`,
    `parent_custody_link`, `account_minor_profile`, and emits a
    `custody_created` audit entry — all in a single transaction.
  - `LegalClearancePendingBanner` suppresses itself.

The flag is **server-only** (never read on the client). A server-rendered
`liveModeAuthorised: boolean` prop crosses the server/client boundary.

## 5 · Vendor stub

CC-1 ships `StubPendingVendorAdapter` in
`src/lib/nex-native/family-safety/id-verifier/stub-pending-vendor-adapter.ts`:

- Every submission returns `pending`.
- An operator manual-approval helper
  (`__opManualApprove(submissionId)`) is reserved for dev testing. It
  is NOT reachable from any UI route and refuses to run unless
  `NEX_SESSION_IDENTITY === "nex_dev"`.

Future vendor candidates (TBD per founder decision B):

- Jumio
- Onfido
- Veriff
- Privy ID (Indonesian OJK-licensed, likely favoured)

The adapter interface is sealed in a separate doctrine document.

## 6 · Dates

Dates are **ESTIMATES**. The 30-day expiry on
`child_account_creation_request.expires_at` and the 24-hour expiry on
password-reset tickets are plausible defaults for Phase 1 and may be
adjusted by founder decision without doctrine rewrite.
