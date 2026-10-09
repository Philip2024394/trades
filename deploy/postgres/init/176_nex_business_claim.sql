-- 176_nex_business_claim.sql
--
-- NEX Directory Canonical Spine · migration 11 of 12 · universal claim.
-- Phase 1 of the N=7-primitive architecture (founder-sealed 2026-10-07,
-- Phase-1 build authorised 2026-10-09).
--
-- WHAT THIS MIGRATION DOES
--   Creates `nex.business_claim` · the universal claim-code record keyed
--   on `canonical_business_id`. Generalises `nex.food_claim_code`
--   (migration 058) across every entity_type.
--
--   The sealed claim flow:
--     1. Owner / admin requests a claim · a 6-digit code is generated
--        (plaintext NEVER stored · pgcrypto crypt() hash only).
--     2. Code is delivered via channel (WhatsApp / email / SMS / phone).
--     3. Owner enters the code on the claim page · service verifies
--        against the crypt() hash with the hard-coded 10-minute expiry +
--        5-attempt limit (rules enforced in application code; CHECKs
--        here enforce schema invariants only).
--     4. On successful verify: `state` flips to VERIFIED and
--        `nex.business_canonical.lifecycle_state` transitions to
--        OWNER_CLAIMED (via the sealed canonical-handoff writer,
--        logged in business_canonical_lifecycle_log migration 168).
--
-- COEXISTENCE WITH nex.food_claim_code
--   This migration does NOT drop or ALTER `nex.food_claim_code`.
--   The two tables run side-by-side during the transition period:
--     · Food-vertical owners continue to use the existing claim-code
--       pipeline (058 + food-claim-service.ts).
--     · Non-food verticals (accommodation / service / mp_seller /
--       transport / etc.) use `nex.business_claim` from this migration.
--     · A separately authorised unification wave later cuts over the
--       food vertical to `nex.business_claim` and deprecates 058.
--
-- CROSS-DATABASE OWNER LINK
--   `claimed_by_account_id` is text, intentionally NOT a FK. The
--   `nex_business` / `nex_account` tables live in Supabase (a separate
--   database) · the NEX Postgres instance that holds this table cannot
--   enforce the FK at the DB layer. The sealed cross-DB owner-link ADR
--   (see completion ledger Workstream C-2) describes the application-
--   layer invariant.
--
-- SEALED CLAIM STATES (4-value enum)
--   PENDING     — code issued, not yet verified; counts toward
--                 attempts; expires at expires_at.
--   VERIFIED    — code was entered successfully; terminal success.
--   EXPIRED     — expires_at passed OR attempt_count ≥ 5 OR
--                 superseded by a new claim request. Terminal.
--   REVOKED     — admin cancelled the claim (fraud / mistake / etc.).
--                 Terminal.
--
-- SEALED CHANNEL VALUES (mirrors migration 058)
--   whatsapp | email | sms | phone
--
-- IDEMPOTENCE
--   CREATE TABLE IF NOT EXISTS. CREATE INDEX IF NOT EXISTS.
--   No DML. Safe to re-run.
--
-- ROLLBACK
--   DROP TABLE nex.business_claim;
--   (No FKs point AT this table yet.)
--
-- SAFE ON POPULATED DB
--   Yes. New table. No ALTERs on nex.food_claim_code or any other
--   existing table. No GRANT/REVOKE.
--
-- WHAT THIS TABLE IS NOT
--   · Not a store for owner identity. Owner identity lives in Supabase
--     `nex_account`. This table only records the claim-event lineage
--     + the resulting account_id text.
--   · Not a plaintext code store. `code_hash` holds pgcrypto crypt()
--     output. Plaintext never at rest.
--   · Not a lifecycle promoter. The lifecycle_state transition on
--     `nex.business_canonical` is written by the sealed canonical-
--     handoff path, not by a trigger here.
--   · Not a channel-abstraction layer. Rate limiting, templating, and
--     delivery live in the application layer (claim-service modules).
--
-- APPLICATION-LAYER INVARIANTS (not enforced in SQL)
--   · 6-digit numeric code.
--   · 10-minute expiry.
--   · 5-attempt limit per code.
--   · Requesting a new code SUPERSEDES the previous one · the writer
--     flips the previous row's state to EXPIRED in the same txn as
--     inserting the new PENDING row.
--   · Only lifecycle_state ∈ {VERIFIED, DISCOVERED, ENRICHED} rows
--     may be claimed · OWNER_CLAIMED + OWNER_VERIFIED rejects re-claim
--     unless admin REVOKEs the prior claim first.
--
-- DEPLOYMENT PREREQUISITES
--   · nex.business_canonical: migration 167.
--   · pgcrypto: for code hashing in application code (not referenced
--     in this DDL · pgcrypto is already loaded by migrations 058, 166).
--
-- NOT APPLIED
--   Phase 1 of the sealed architecture. MUST NOT be applied to any
--   live database without an explicit founder authorisation.

-- ═══════════════════════════════════════════════════════════════════
-- business_claim — one row per claim request lifecycle
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS nex.business_claim (
  claim_id                  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),

  canonical_business_id     uuid         NOT NULL,

  -- Claim secret · pgcrypto crypt() hash. Plaintext never at rest.
  code_hash                 text         NOT NULL,

  -- Delivery metadata.
  claim_channel             text         NOT NULL,
  destination               text         NOT NULL,  -- channel-specific (phone/email/etc.)

  -- Lifecycle.
  state                     text         NOT NULL DEFAULT 'PENDING',

  -- Timing + rate limiting.
  requested_at              timestamptz  NOT NULL DEFAULT now(),
  expires_at                timestamptz  NOT NULL,
  attempt_count             integer      NOT NULL DEFAULT 0,

  -- Terminal metadata.
  verified_at               timestamptz  NULL,
  claimed_by_account_id     text         NULL,          -- cross-DB · Supabase nex_account.id
  expired_at                timestamptz  NULL,
  revoked_at                timestamptz  NULL,
  revoked_by                text         NULL,
  revoke_reason             text         NULL,

  -- Who initiated the claim request (admin / self-service).
  requested_by              text         NOT NULL,

  -- ─────────────── CHECKs ────────────────────────────────────────

  CONSTRAINT ck_bcl_state CHECK (state IN (
    'PENDING', 'VERIFIED', 'EXPIRED', 'REVOKED'
  )),

  CONSTRAINT ck_bcl_channel CHECK (claim_channel IN (
    'whatsapp', 'email', 'sms', 'phone'
  )),

  CONSTRAINT ck_bcl_destination_nonblank CHECK (
    length(trim(destination)) > 0
  ),

  CONSTRAINT ck_bcl_requested_by_nonblank CHECK (
    length(trim(requested_by)) > 0
  ),

  CONSTRAINT ck_bcl_code_hash_nonblank CHECK (
    length(trim(code_hash)) > 0
  ),

  CONSTRAINT ck_bcl_attempt_count_nonneg CHECK (
    attempt_count >= 0
  ),

  CONSTRAINT ck_bcl_expires_after_requested CHECK (
    expires_at > requested_at
  ),

  -- PENDING must leave terminal fields NULL.
  -- VERIFIED must have verified_at + claimed_by_account_id.
  -- EXPIRED must have expired_at.
  -- REVOKED must have revoked_at + revoked_by.
  CONSTRAINT ck_bcl_state_fields_consistency CHECK (
    (state = 'PENDING'
      AND verified_at IS NULL
      AND claimed_by_account_id IS NULL
      AND expired_at IS NULL
      AND revoked_at IS NULL
      AND revoked_by IS NULL)
    OR
    (state = 'VERIFIED'
      AND verified_at IS NOT NULL
      AND claimed_by_account_id IS NOT NULL
      AND revoked_at IS NULL
      AND revoked_by IS NULL)
    OR
    (state = 'EXPIRED'
      AND expired_at IS NOT NULL
      AND verified_at IS NULL
      AND revoked_at IS NULL)
    OR
    (state = 'REVOKED'
      AND revoked_at IS NOT NULL
      AND revoked_by IS NOT NULL)
  ),

  -- ─────────────── FKs ──────────────────────────────────────────

  CONSTRAINT fk_bcl_canonical_business
    FOREIGN KEY (canonical_business_id)
    REFERENCES nex.business_canonical (canonical_business_id)
    ON DELETE CASCADE
);

-- ─────────────── Indexes ──────────────────────────────────────

-- "Which claims are PENDING for this canonical?" · verify hot path.
-- Partial index on PENDING state keeps it tight.
CREATE INDEX IF NOT EXISTS idx_bcl_canonical_pending
  ON nex.business_claim (canonical_business_id, requested_at DESC)
  WHERE state = 'PENDING';

-- "Which claims are expiring soon?" · housekeeping sweep.
CREATE INDEX IF NOT EXISTS idx_bcl_pending_expires
  ON nex.business_claim (expires_at)
  WHERE state = 'PENDING';

-- "Which canonicals are owned by account X?" · verified claims lookup.
CREATE INDEX IF NOT EXISTS idx_bcl_claimed_by_account
  ON nex.business_claim (claimed_by_account_id)
  WHERE state = 'VERIFIED' AND claimed_by_account_id IS NOT NULL;

-- ─────────────── Documentation ──────────────────────────────────

COMMENT ON TABLE nex.business_claim IS
  'Universal owner-claim record · generalises nex.food_claim_code (migration 058) across every entity_type. One row per claim-request lifecycle. Plaintext code never stored · code_hash holds pgcrypto crypt() output. Successful verify writes OWNER_CLAIMED via the sealed canonical-handoff path.';

COMMENT ON COLUMN nex.business_claim.claimed_by_account_id IS
  'Cross-DB · references Supabase nex_account.id. NOT a DB-level FK · the two tables live in different databases. Application-layer invariant per the sealed cross-DB owner-link ADR.';

COMMENT ON COLUMN nex.business_claim.state IS
  'PENDING | VERIFIED | EXPIRED | REVOKED. Terminal states (VERIFIED / EXPIRED / REVOKED) are immutable once set.';

-- ═══════════════════════════════════════════════════════════════════
-- End of migration 176.
--
-- Downstream (176 does NOT ship these):
--   · src/lib/nex-native/claims/ · universal claim service module.
--   · Food-vertical cutover from nex.food_claim_code to
--     nex.business_claim (separately authorised).
--   · Admin claim-review surface (consolidation of /claim-review page).
-- ═══════════════════════════════════════════════════════════════════
