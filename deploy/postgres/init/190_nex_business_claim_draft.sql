-- 190_nex_business_claim_draft.sql
--
-- NEX Directory · Owner Claim · pre-claim draft store.
-- Phase 2 of the owner-claim flow (sealed universal claim-service lives
-- at migration 176; draft store authored 2026-10-10 by Agent O).
--
-- WHAT THIS MIGRATION DOES
--   Creates `nex.business_claim_draft` · a durable server-side holding
--   place for owner-authored pre-claim content. Prior to this migration
--   the OwnerClaimForm persisted drafts in browser sessionStorage only,
--   which meant losing drafts on tab close + no cross-device resume + no
--   server-side ability to kick off follow-up (code issue, invite, etc).
--
--   One row per (canonical_business_id, draft_fingerprint). The
--   fingerprint is the SAME opaque per-browser id Agent C's listing-chat
--   flow mints into the `nex_dir_visitor` httpOnly cookie (prefixed
--   `anon:<uuid>` for anonymous viewers, or the signed-in `nex_account.id`
--   for signed-in viewers). The draft is NOT identity-bearing by itself;
--   the sealed claim-service transitions a verified draft into a
--   `nex.business_claim` row at the point of successful code entry.
--
-- SEALED LIFECYCLE (7 states)
--   draft             — owner has started filling in details, no contact yet
--   contact_pending   — owner has saved a contact channel + destination
--   code_requested    — sealed claim-service.createClaim fired; a row
--                       exists in nex.business_claim (state=PENDING)
--   verified          — sealed claim-service.verifyClaim succeeded;
--                       canonical lifecycle flipped to OWNER_CLAIMED
--   abandoned         — expires_at passed with no further activity
--   rejected          — admin or sealed service refused the claim
--   blocked           — downstream path unavailable (e.g. SMS adapter
--                       missing) · owner was told, draft preserved for
--                       later follow-up
--
-- WHAT THIS MIGRATION IS NOT
--   · Not a secret store. draft_json carries business content the owner
--     intends to publish once claimed. It does NOT carry claim codes,
--     code hashes, verification secrets, or anything that moves identity.
--     All code secrets live in nex.business_claim (migration 176) with
--     pgcrypto crypt() hashing.
--   · Not a FK to nex_business / nex_account. Those tables live in
--     Supabase · the cross-DB owner link is modelled in nex.business_claim
--     via the TEXT claimed_by_account_id column.
--   · Not a projection of nex.business_canonical. Draft content is
--     unverified owner input; the resolver pipeline NEVER reads it as
--     evidence. Once verified, the sealed admin-promote-lifecycle path
--     writes the owner-ratified fields through the normal evidence
--     primitive (business_evidence · migration 170).
--   · Not a trigger host. No triggers, no DML, no GRANT/REVOKE in this
--     migration · schema invariants only.
--
-- RETENTION
--   Rows live for 30 days from creation (expires_at default). A
--   housekeeping sweep (admin surface, not authored here) deletes
--   rows past expires_at that are in {draft, contact_pending}. Rows in
--   {code_requested, verified, blocked, rejected} are retained by the
--   sweep to preserve audit lineage; abandoned rows are deleted after
--   expires_at.
--
-- IDEMPOTENCE
--   CREATE TABLE IF NOT EXISTS. CREATE INDEX IF NOT EXISTS. No DML.
--   Safe to re-run.
--
-- ROLLBACK
--   DROP TABLE nex.business_claim_draft;
--   (No FKs point AT this table.)
--
-- SAFE ON POPULATED DB
--   Yes. New table only. No ALTERs on nex.business_canonical, no ALTERs
--   on nex.business_claim, no DML. Zero-risk additive migration.
--
-- DEPLOYMENT PREREQUISITES
--   · nex.business_canonical: migration 167 (REQUIRED — FK target).
--   · pgcrypto: gen_random_uuid() for the PK default (loaded by 058/166).
--
-- NOT APPLIED
--   Owner-claim completion workstream. MUST NOT be applied to any live
--   database without an explicit founder authorisation. The applier
--   script `scripts/nex-canonical/_apply-migration-190.mjs` gates
--   the write with a session-identity check (current_database() =
--   'nex_dev').

-- ═══════════════════════════════════════════════════════════════════
-- business_claim_draft — one row per (canonical × browser) draft
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS nex.business_claim_draft (
  draft_id                  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),

  canonical_business_id     uuid         NOT NULL,

  -- Opaque per-browser id. Same shape as the `nex_dir_visitor` cookie
  -- value Agent C's listing-chat flow uses:
  --   · signed-in: nex_account.id (UUID)
  --   · anonymous: "anon:<uuid>"
  -- Length-constrained 8..128 so a malformed cookie cannot blow up
  -- the UNIQUE index.
  draft_fingerprint         text         NOT NULL,

  -- Owner-authored business content. Shape: OwnerClaimDraft discriminated
  -- union from src/lib/nex-native/directory/owner-claim/types.ts.
  draft_json                jsonb        NOT NULL,

  -- Contact channel + destination · NULL until the owner commits a
  -- contact step. CHECK enforces the sealed 4-value channel enum
  -- (mirrors nex.business_claim).
  contact_channel           text         NULL,
  contact_destination       text         NULL,

  -- Lifecycle · 7 sealed states. Default 'draft' at insert.
  status                    text         NOT NULL DEFAULT 'draft',

  -- Rejection / block context for admin review. Short free-form string
  -- (300-char cap). Not a secret · never logs draft content.
  status_reason             text         NULL,

  -- Timings.
  last_touched_at           timestamptz  NOT NULL DEFAULT now(),
  expires_at                timestamptz  NOT NULL DEFAULT (now() + interval '30 days'),
  created_at                timestamptz  NOT NULL DEFAULT now(),

  -- ─────────────── CHECKs ────────────────────────────────────────

  CONSTRAINT ck_bcd_fingerprint_len CHECK (
    length(draft_fingerprint) BETWEEN 8 AND 128
  ),

  CONSTRAINT ck_bcd_contact_channel CHECK (
    contact_channel IS NULL
    OR contact_channel IN ('whatsapp', 'email', 'sms', 'phone')
  ),

  CONSTRAINT ck_bcd_contact_destination_nonblank CHECK (
    contact_destination IS NULL
    OR length(trim(contact_destination)) > 0
  ),

  CONSTRAINT ck_bcd_contact_destination_len CHECK (
    contact_destination IS NULL
    OR length(contact_destination) <= 160
  ),

  CONSTRAINT ck_bcd_status CHECK (status IN (
    'draft',
    'contact_pending',
    'code_requested',
    'verified',
    'abandoned',
    'rejected',
    'blocked'
  )),

  CONSTRAINT ck_bcd_status_reason_len CHECK (
    status_reason IS NULL
    OR length(status_reason) <= 300
  ),

  CONSTRAINT ck_bcd_expires_after_created CHECK (
    expires_at > created_at
  ),

  -- ─────────────── Uniqueness ────────────────────────────────────

  CONSTRAINT uq_bcd_canonical_fingerprint
    UNIQUE (canonical_business_id, draft_fingerprint),

  -- ─────────────── FKs ──────────────────────────────────────────

  CONSTRAINT fk_bcd_canonical_business
    FOREIGN KEY (canonical_business_id)
    REFERENCES nex.business_canonical (canonical_business_id)
    ON DELETE CASCADE
);

-- ─────────────── Indexes ──────────────────────────────────────

-- Retention sweep: "which rows have expired in draft/contact_pending?".
CREATE INDEX IF NOT EXISTS idx_bcd_status_expires
  ON nex.business_claim_draft (status, expires_at);

-- Per-listing admin review: "show me all drafts for this canonical".
CREATE INDEX IF NOT EXISTS idx_bcd_canonical_status
  ON nex.business_claim_draft (canonical_business_id, status);

-- ─────────────── Documentation ──────────────────────────────────

COMMENT ON TABLE nex.business_claim_draft IS
  'Pre-claim owner draft store · 30-day TTL · one row per (canonical × browser fingerprint). Content is owner-authored and NOT evidence until the claim verifies; the sealed claim-service transitions a verified draft into nex.business_claim at the point of code entry.';

COMMENT ON COLUMN nex.business_claim_draft.draft_fingerprint IS
  'Opaque per-browser id · same shape as nex_dir_visitor cookie (anon:<uuid> for anonymous, nex_account.id for signed-in). NOT identity-bearing on its own.';

COMMENT ON COLUMN nex.business_claim_draft.draft_json IS
  'Owner-authored business content · OwnerClaimDraft discriminated union. NEVER contains claim codes or verification secrets · those live in nex.business_claim.';

COMMENT ON COLUMN nex.business_claim_draft.status IS
  'draft | contact_pending | code_requested | verified | abandoned | rejected | blocked. See migration header for sealed lifecycle.';

-- ═══════════════════════════════════════════════════════════════════
-- End of migration 190.
--
-- Downstream (190 does NOT ship these):
--   · src/lib/nex-native/directory/owner-claim/draft-service.ts
--   · OwnerClaimForm server-side draft rehydration
--   · 30-day retention sweep (admin surface)
-- ═══════════════════════════════════════════════════════════════════
