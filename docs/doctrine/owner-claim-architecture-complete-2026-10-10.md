# NEX Directory - Owner Claim - Architecture Completion Runbook

**Agent:** O (Owner-claim) · **Branch:** `nex/directory-work` · **Date:** 2026-10-10

Supersedes the prior ADR `adr-nex-cross-db-owner-link-2026-10-09.md`'s
unresolved blocker for pre-claim draft persistence. The owner-identity
cross-DB write is still deferred to a Supabase-side operator migration,
documented in Section 4 below.

---

## 1 · What landed in this wave

### 1.1 · Migration 190 · `nex.business_claim_draft`

Durable server-side store for pre-claim owner drafts. Applied against
local `nex_dev` on 2026-10-10 via
`scripts/nex-canonical/_apply-migration-190.mjs --apply` with the
session-identity gate (`current_database() = 'nex_dev'`).

- One row per `(canonical_business_id, draft_fingerprint)`.
- `draft_fingerprint` is the same opaque per-browser id Agent C's
  listing-chat flow stamps into the `nex_dir_visitor` httpOnly cookie
  (`anon:<uuid>` for anonymous, Supabase `nex_account.id` for signed-in).
- `draft_json jsonb` holds the owner-authored `OwnerClaimDraft`.
  NEVER holds claim codes, code hashes, or verification secrets. Those
  live in `nex.business_claim` (migration 176) with pgcrypto `crypt()`
  hashing.
- `status text` sealed 7-state lifecycle (CHECK ck_bcd_status):
  `draft -> contact_pending -> code_requested -> verified`;
  `abandoned | rejected | blocked` as terminal off-ramps.
- 30-day TTL via `expires_at`. Retention sweep (admin surface, not
  authored in this wave) deletes expired rows in `{draft,
  contact_pending}` and keeps the rest for audit lineage.
- FK to `nex.business_canonical` ON DELETE CASCADE.
- Indexes: `(status, expires_at)` for the retention sweep,
  `(canonical_business_id, status)` for admin review.

### 1.2 · `src/lib/nex-native/directory/owner-claim/draft-service.ts`

Server-only pg wrapper around migration 190. Exposes:
`loadDraft`, `saveDraft` (UPSERT), `updateContact`, `transitionStatus`,
`listDraftsForCanonical`. Reuses `withClient` from `@/lib/nex/db` -
same pool the Directory service uses. 26 unit tests at
`draft-service.test.ts` cover guards, SQL shape, status machine, and
doctrine 7 (never logs draft_json content).

### 1.3 · `src/lib/nex-native/directory/owner-claim/actions.ts`

Server Actions wired to the sealed subsystems:

| Action | Status | Backing |
|---|---|---|
| `loadDraftAction` | LIVE | `draft-service.loadDraft` + viewer fingerprint |
| `saveDraftAction` | LIVE | `draft-service.saveDraft` (UPSERT) |
| `updateContactAction` | LIVE | `draft-service.updateContact` (status -> contact_pending) |
| `requestClaimCodeAction` (email) | LIVE | sealed `createClaim` + `sendOwnerInviteEmail` |
| `requestClaimCodeAction` (sms/whatsapp/phone) | HONEST BLOCKER | returns `channel_adapter_not_implemented` + draft -> blocked |
| `verifyClaimCodeAction` | LIVE | sealed `verifyClaim` (pgcrypto compare) + status -> verified |

All actions resolve the viewer via the same `nex_dir_visitor` cookie
convention Agent C established; signed-in viewers get their Supabase
`nex_account.id` as the fingerprint.

### 1.4 · `src/components/nex-native/directory/OwnerClaimForm.tsx`

State machine updates:

1. **Mount**: `useEffect` calls `loadDraftAction`. If the server
   returns a draft, hydrate from it (preferred). Fall back to the
   existing sessionStorage draft only when the server has nothing.
2. **details -> contact**: on "Save and continue" the form calls
   `saveDraftAction` (server-side write). On `ok`, transitions to
   the contact view. Honest-blocker surfaces on any failure.
3. **contact -> code**: calls `updateContactAction` to persist channel
   + destination, then `requestClaimCodeAction`. If the channel is
   email the sealed `createClaim` + email adapter dispatch a 6-digit
   code. If the channel is sms/whatsapp/phone we transition the draft
   to `blocked` with reason `channel_adapter_not_implemented:<channel>`
   and show the honest "we can only send codes by email right now"
   message. **No fabricated success.**
4. **code -> verify**: new `verify` view accepts a 6-digit input,
   calls `verifyClaimCodeAction`. On success the sealed `verifyClaim`
   flips `nex.business_canonical.lifecycle_state` to `OWNER_CLAIMED`
   and the UI shows "listing is now yours". On wrong code the UI
   invites a retry. After 5 wrong attempts the sealed service
   auto-expires and the UI transitions to the blocked view with
   `attempts_exhausted`.

The sessionStorage fallback is preserved for anonymous viewers whose
cookie hasn't yet been minted and for dev-offline mode. Doctrine 7
still enforced: `OwnerClaimForm` never logs or echoes the draft content.

---

## 2 · Sealed 7-state claim lifecycle (authorised transitions)

```
                        v
                   +--------+
                   | draft  |<-------- saveDraft (UPSERT)
                   +---+----+
                       | updateContact
                       v
              +----------------+
              | contact_pending|<------- updateContact
              +---+--------+---+
       (email)    |        |   (sms|whatsapp|phone)
                  v        v
         +----------------+    +--------+
         | code_requested |    | blocked|  (channel_adapter_not_implemented)
         +---+--------+---+    +--------+
   verifyOk  |        |   wrong code (<= 5)
             v        |          |
     +-----------+    |          v
     |  verified |    +----> code_requested  (loop)
     +-----------+          |
                            | 5 wrong attempts
                            v
                      +----------+
                      | blocked  |  (attempts_exhausted)
                      +----------+

Terminal off-ramps from ANY state:
  - abandoned (30-day TTL sweep)
  - rejected  (admin review)
  - blocked   (adapter missing / attempts exhausted)
```

Allowed transitions (enforced in `draft-service.transitionStatus`
caller patterns; CHECK ck_bcd_status covers the state values only):

- `draft`           -> `contact_pending`, `abandoned`
- `contact_pending` -> `code_requested`, `blocked`, `abandoned`
- `code_requested`  -> `verified`, `blocked` (attempts exhausted),
                        `code_requested` (re-send supersedes)
- `verified`        -> terminal (admin may `revokeClaim` which
                        transitions `nex.business_claim.state`
                        separately; the draft row stays `verified`
                        as evidence of the original claim)
- `blocked`, `rejected`, `abandoned` are terminal.

---

## 3 · Retention policy (daily sweep, admin surface)

Not authored in this wave. The admin review page is where the sweep
should land. Target behaviour:

```sql
DELETE FROM nex.business_claim_draft
 WHERE expires_at < now()
   AND status IN ('draft', 'contact_pending', 'abandoned');
```

Rows in `{code_requested, verified, blocked, rejected}` are retained
past `expires_at` for audit lineage. The sweep is pure DML, additive-safe,
no FK fallout (CASCADE on canonical delete handles that direction).

**Founder decision required:** confirm 30 days is the right TTL. The
migration default is baked in but can be changed by a follow-up
migration that updates the DEFAULT (existing rows keep their
`expires_at`; new rows adopt the new TTL).

---

## 4 · Supabase side (NOT applied here - operator runbook)

NEX Postgres owns the claim lifecycle. Supabase owns `nex_business`
and `nex_account`. The sealed `nex.business_claim.claimed_by_account_id`
is `text` (cross-DB) and holds either:

- the signed-in viewer's Supabase `nex_account.id` (UUID), OR
- the opaque `anon:<uuid>` fingerprint (for owners who verified before
  creating a Supabase account; admin follow-up links them later).

### 4.1 · Required Supabase migration (owner-authored, NOT in this wave)

```sql
-- Adds the cross-DB owner link column to the Supabase nex_business
-- row. Idempotent, additive, safe on populated DB.
ALTER TABLE public.nex_business
  ADD COLUMN IF NOT EXISTS canonical_business_id uuid NULL;

CREATE INDEX IF NOT EXISTS idx_nb_canonical
  ON public.nex_business (canonical_business_id)
  WHERE canonical_business_id IS NOT NULL;

COMMENT ON COLUMN public.nex_business.canonical_business_id IS
  'Cross-DB link to nex.business_canonical.canonical_business_id in NEX Postgres. NOT an FK (databases are separate). Application-layer invariant written on successful owner claim.';
```

### 4.2 · Reconciler (runs on claim verify, operator-authored)

On successful `verifyClaimCodeAction`:

1. NEX Postgres: sealed `verifyClaim` flips
   `nex.business_canonical.lifecycle_state -> OWNER_CLAIMED` and
   records `nex.business_claim.claimed_by_account_id`.
2. Supabase (deferred): a reconciler (cron OR webhook) UPSERTs a
   `nex_business` row with the claimed `canonical_business_id` and
   links it to the Supabase account.

Because Supabase has its own auth and session, the reconciler cannot
depend on pgcrypto. It consumes the already-verified
`claimed_by_account_id` text as the trust boundary; the NEX side has
already enforced the 6-digit code + 5-attempt rules.

### 4.3 · Email adapter

Already live via `sealed sendOwnerInviteEmail` in
`src/lib/nex/listing-chat/owner-invite.ts`. Uses the same SMTP enqueue
Agent C's listing-chat flow uses. **No additional Supabase work needed.**

---

## 5 · Deferred channel adapters

| Channel | Status | What's missing |
|---|---|---|
| `email` | LIVE | nothing - sealed path works end-to-end |
| `sms` | DEFERRED | no SMS send adapter. Requires: Twilio/Vonage/etc. account, send module in `src/lib/nex-native/claims/`, env config |
| `whatsapp` | DEFERRED | no WhatsApp Business API adapter. Requires: WABA account, template approval, send module |
| `phone` | DEFERRED | no outbound-call provider. Requires: voice provider, TTS code reader module |

**Founder decision required:** which adapter (if any) to prioritise
after the email path proves out. If none, the UX should default to
email-only in the contact-channel chip selector and hide the other
three until a provider is signed up.

---

## 6 · Idempotent-retry guarantees

- A verify-code click twice does NOT double-promote the canonical.
  The sealed `verifyClaim` runs under `BEGIN ... FOR UPDATE` and
  returns the same `ok: true` result if the canonical is already
  OWNER_CLAIMED (the second call becomes a benign re-check).
- A request-code click twice SUPERSEDES the prior PENDING code
  (sealed `createClaim` flips the previous row to `EXPIRED` in the
  same txn as inserting the new PENDING row). The draft stays in
  `code_requested`; the owner's inbox now has two codes but only the
  latest verifies.
- Saving the same draft twice is a benign UPSERT (ON CONFLICT updates
  `draft_json` + `last_touched_at`; status is preserved via COALESCE).

---

## 7 · Hard constraints honoured

- Branch `nex/directory-work`, no git commits.
- No new npm deps.
- Session identity gate on the applier: `SELECT current_database() = 'nex_dev'`.
- Sealed claim-service NOT bypassed; sealed email adapter NOT bypassed.
- No Supabase-side migrations applied here.
- No touching of S1 / V / R scopes (verified at close-out).
- Doctrine 7 preserved: `draft-service.ts` never logs `draft_json`.
- No fabrication: `channel_adapter_not_implemented` is returned as an
  honest reason for sms/whatsapp/phone; the owner sees the real block
  rather than a fake success.

---

## 8 · Open founder decisions

1. **SMS / WhatsApp / phone adapter**: ship one? Which provider?
   Preferred option is Twilio for both SMS and WhatsApp (shared SDK,
   shared billing).
2. **Retention TTL**: confirm 30 days or change via follow-up migration.
3. **Public naming**: the sealed status enum uses lowercase snake_case
   values (`contact_pending`, `code_requested`). The admin UI will
   render human-oriented labels; founder should sign off on the labels
   when the admin review surface lands.
4. **Supabase migration timing**: when to run the operator migration
   that adds `nex_business.canonical_business_id`. The NEX side is
   fully functional without it; the reconciler + admin UX gain is
   downstream.
