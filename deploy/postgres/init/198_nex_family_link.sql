-- 198_nex_family_link.sql
--
-- NEX Family Links · Phase 1 Foundations (schema + services only).
-- (FL · 2026-10-10 estimated.)
--
-- SAFE ON POPULATED DB · idempotent · additive · session-identity gated.
--
-- ═══════════════════════════════════════════════════════════════════
-- WHAT THIS MIGRATION DOES
-- ═══════════════════════════════════════════════════════════════════
--
-- Introduces TWO new tables that together form the Family Links
-- primitive layer:
--
--   1. nex.family_link           · verified guardian ↔ child
--                                   relationship + role tag.
--   2. nex.account_age_attestation · a declared date-of-birth record
--                                   with lightweight attestation
--                                   metadata.
--
-- Phase 1 scope is DELIBERATELY NARROW:
--   · schema + services only · no UI surface in this wave
--   · no permission to read a child's messages is granted here
--   · no alert fan-out is wired here
--   · no vendor identity-verification columns (adapter-agnostic)
--   · no ID-document columns, no biometric columns
--   · simulated=TRUE by default on every row · live-mode activation
--     requires separate founder sign-off (same pattern as the
--     Emergency Help pilot gate · migration 193)
--
-- Doctrine (sealed with this migration):
--   · Default-closed permissions · every permission flag defaults to
--     FALSE except `can_see_emergency_alerts` (which still participates
--     in Emergency Help's own authorization — Family Links does NOT
--     override it; emergency primitives have their own trust envelope).
--   · Dates referenced anywhere are ESTIMATES, not commitments.
--   · Capability ceiling · Family Links establishes relationships +
--     role tags. It does NOT grant message access, trigger alerts, or
--     expose children's data. Higher layers must opt-in via future
--     explicitly-gated phases.
--   · Vendor-agnostic · we do NOT bake Yoti / Jumio / Veriff / any
--     verifier identifier into the schema. When the attestation
--     method matures beyond `declared`, the migration that lands
--     that path will introduce its OWN side table — not a column
--     here.
--   · Append-only revocation · a revoked link stays as a historical
--     row with state=revoked. A new link may be initiated afterwards.
--
-- ═══════════════════════════════════════════════════════════════════
-- TABLES
-- ═══════════════════════════════════════════════════════════════════
--
--   1. nex.family_link
--        · link_id (PK) · guardian_account_id · child_account_id
--        · role (CHECK · one of 4 sealed values)
--        · state (CHECK · one of 4 sealed values · default 'pending')
--        · initiated_by (CHECK · one of 3 sealed values)
--        · timestamps (initiated_at / confirmed_at / revoked_at /
--          expires_at)
--        · revocation metadata (revoked_by / revoked_reason)
--        · 3 permission flags · all default-closed
--        · simulated (default TRUE)
--
--   2. nex.account_age_attestation
--        · attestation_id (PK) · account_id · declared_date_of_birth
--        · attested_by (CHECK · one of 3 sealed values)
--        · attested_by_account_id (NULL when attested_by='system_fallback')
--        · attestation_method (CHECK · one of 3 sealed values ·
--          default 'declared')
--        · attestation_notes (NULL · bounded 1..500 when set)
--        · superseded_by (self-FK) · one active row per account
--        · simulated (default TRUE)
--
-- ═══════════════════════════════════════════════════════════════════
-- IDEMPOTENCE
-- ═══════════════════════════════════════════════════════════════════
--
-- CREATE TABLE IF NOT EXISTS. All CREATE INDEX statements use IF NOT
-- EXISTS. DO $$ … $$ guards the self-FK ALTER so re-runs are no-ops.
-- Zero DML. Safe to re-run.
--
-- ═══════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════
--
--   DROP TABLE IF EXISTS nex.account_age_attestation;
--   DROP TABLE IF EXISTS nex.family_link;
--
-- ═══════════════════════════════════════════════════════════════════
-- DEPLOYMENT PREREQUISITES
-- ═══════════════════════════════════════════════════════════════════
--
-- · nex schema present (000_schema.sql).
-- · pgcrypto · gen_random_uuid().
-- · Zero FK dependency on sealed account model · guardian_account_id
--   and child_account_id are soft text references to the Supabase
--   nex_account.id (same pattern as every other cross-DB reference
--   in nex.*).
--
-- ═══════════════════════════════════════════════════════════════════
-- NOT APPLIED
-- ═══════════════════════════════════════════════════════════════════
--
-- Must only be applied via
-- `scripts/nex-canonical/_apply-migration-198.mjs` with the
-- session-identity gate (current_database() = 'nex_dev').

-- ─────────────────────────────────────────────────────────────────────
-- 1. nex.family_link
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nex.family_link (
  link_id                       uuid         PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Soft references to Supabase nex_account.id (never cross-DB FK).
  guardian_account_id           text         NOT NULL,
  child_account_id              text         NOT NULL,

  -- 4 sealed roles. Primary vs secondary is a hard rank; trusted_adult
  -- and mentor are permission-weaker categories reserved for future
  -- phases (no Phase-1 capability attaches to them).
  role                          text         NOT NULL
    CHECK (role IN ('guardian_primary','guardian_secondary','trusted_adult','mentor')),

  -- 4 sealed states. New rows arrive 'pending' and require explicit
  -- confirmation by the opposite party before entering 'active'.
  state                         text         NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending','active','revoked','expired')),

  -- Who initiated the invitation. Required for the confirmation
  -- authorization rule: a guardian-initiated link must be confirmed by
  -- the child account; a child-initiated link must be confirmed by the
  -- guardian account.
  initiated_by                  text         NOT NULL
    CHECK (initiated_by IN ('guardian_invite','child_invite','system_setup')),

  initiated_at                  timestamptz  NOT NULL DEFAULT now(),
  confirmed_at                  timestamptz  NULL,
  revoked_at                    timestamptz  NULL,
  revoked_by                    text         NULL,
  revoked_reason                text         NULL
    CHECK (revoked_reason IS NULL OR length(revoked_reason) BETWEEN 1 AND 200),
  expires_at                    timestamptz  NULL,

  -- Phase-1-safe permission flags · ALL DEFAULT-CLOSED except the
  -- emergency alert bit (which Emergency Help still gates on its own
  -- trust envelope · see migration 196). These are PRIMITIVES · higher
  -- layers consume them as pre-conditions, never override them.
  can_see_emergency_alerts      boolean      NOT NULL DEFAULT TRUE,
  can_see_safety_summaries      boolean      NOT NULL DEFAULT FALSE,
  can_see_location_when_shared  boolean      NOT NULL DEFAULT FALSE,

  -- Phase 1 PILOT gate · every row simulated=TRUE by default; the
  -- service layer rejects attempts to write simulated=false. Flipping
  -- a row to false later requires founder sign-off and a dedicated
  -- live-mode migration.
  simulated                     boolean      NOT NULL DEFAULT TRUE,

  created_at                    timestamptz  NOT NULL DEFAULT now()
);

-- Guardian cannot be the same account as the child. We attach the
-- constraint via ALTER so re-runs that find the constraint already
-- present do not fail (ADD CONSTRAINT IF NOT EXISTS is not available
-- in all supported PG versions).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'nex.family_link'::regclass
       AND conname  = 'family_link_guardian_not_child'
  ) THEN
    ALTER TABLE nex.family_link
      ADD CONSTRAINT family_link_guardian_not_child
      CHECK (guardian_account_id <> child_account_id);
  END IF;
END
$$;

-- One active primary guardian per child at a time.
CREATE UNIQUE INDEX IF NOT EXISTS family_link_primary_guardian_uq
  ON nex.family_link (child_account_id)
  WHERE role = 'guardian_primary' AND state = 'active';

-- A guardian/child pair should not have two active links concurrently.
CREATE UNIQUE INDEX IF NOT EXISTS family_link_pair_active_uq
  ON nex.family_link (guardian_account_id, child_account_id)
  WHERE state = 'active';

-- Hot path · "who are X's guardians and in what state?"
CREATE INDEX IF NOT EXISTS family_link_child_state_idx
  ON nex.family_link (child_account_id, state);

-- Hot path · "who are X's wards and in what state?"
CREATE INDEX IF NOT EXISTS family_link_guardian_state_idx
  ON nex.family_link (guardian_account_id, state);

COMMENT ON TABLE nex.family_link IS
  'NEX Family Links · Phase 1 primitive · verified guardian↔child relationships with role tags. Does NOT grant message access or alert fan-out · higher layers consume these rows as pre-conditions.';

COMMENT ON COLUMN nex.family_link.can_see_emergency_alerts IS
  'Phase 1 default-TRUE flag · Emergency Help still gates fan-out on its own trust envelope (migration 196 · trusted contact channels). Family Links does NOT override Emergency Help primitives.';

COMMENT ON COLUMN nex.family_link.can_see_safety_summaries IS
  'Phase 3+ feature gate · reserved · defaults FALSE and is NOT settable from Phase 1 services.';

COMMENT ON COLUMN nex.family_link.can_see_location_when_shared IS
  'Phase 2+ feature gate · requires explicit child AND guardian opt-in in a later wave · defaults FALSE.';

COMMENT ON COLUMN nex.family_link.simulated IS
  'Phase 1 PILOT flag · live-mode activation requires separate founder sign-off and a dedicated live-mode migration.';

-- ─────────────────────────────────────────────────────────────────────
-- 2. nex.account_age_attestation
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nex.account_age_attestation (
  attestation_id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Soft reference to Supabase nex_account.id (never cross-DB FK).
  account_id                 text         NOT NULL,

  -- Declared DOB · bounded [1900-01-01, CURRENT_DATE]. Legal reality
  -- always wins over this field; the attestation is NOT a legal
  -- document and may be revised at any time via supersede.
  declared_date_of_birth     date         NOT NULL
    CHECK (declared_date_of_birth > DATE '1900-01-01'
       AND declared_date_of_birth <= CURRENT_DATE),

  -- Who declared the age. 3 sealed values · never a verifier vendor.
  attested_by                text         NOT NULL
    CHECK (attested_by IN ('self','guardian','system_fallback')),

  -- Which account recorded the attestation.
  --   · attested_by='self'            → attested_by_account_id = account_id
  --   · attested_by='guardian'        → attested_by_account_id = guardian's account_id
  --   · attested_by='system_fallback' → attested_by_account_id = NULL
  attested_by_account_id     text         NULL,

  -- 3 sealed methods · 'document_verified_future_phase' is RESERVED
  -- and NOT accepted by the Phase 1 service layer. It exists only so
  -- that a future wave can insert rows with that value without a
  -- schema migration.
  attestation_method         text         NOT NULL DEFAULT 'declared'
    CHECK (attestation_method IN ('declared','guardian_declared','document_verified_future_phase')),

  attestation_notes          text         NULL
    CHECK (attestation_notes IS NULL OR length(attestation_notes) BETWEEN 1 AND 500),

  -- Append-only supersession · each new attestation points at the one
  -- it replaced. The partial-unique index below enforces exactly one
  -- active (non-superseded) row per account.
  superseded_by              uuid         NULL
    REFERENCES nex.account_age_attestation (attestation_id),

  simulated                  boolean      NOT NULL DEFAULT TRUE,
  created_at                 timestamptz  NOT NULL DEFAULT now()
);

-- Hot path · "the full attestation history for one account".
CREATE INDEX IF NOT EXISTS account_age_attestation_account_time_idx
  ON nex.account_age_attestation (account_id, created_at DESC);

-- One active (non-superseded) attestation per account.
CREATE UNIQUE INDEX IF NOT EXISTS account_age_attestation_active_uq
  ON nex.account_age_attestation (account_id)
  WHERE superseded_by IS NULL;

COMMENT ON TABLE nex.account_age_attestation IS
  'NEX Family Links · Phase 1 primitive · lightweight age attestation (declared DOB + metadata). No ID-document, no biometric, no vendor fields. Dates are ESTIMATES, not commitments.';

COMMENT ON COLUMN nex.account_age_attestation.attestation_method IS
  'Phase 1 accepts declared | guardian_declared only. document_verified_future_phase is reserved for a later wave with its own authorisation.';

COMMENT ON COLUMN nex.account_age_attestation.simulated IS
  'Phase 1 PILOT flag · live-mode activation requires separate founder sign-off.';

-- ═══════════════════════════════════════════════════════════════════
-- End of migration 198.
-- Downstream:
--   · src/lib/nex-native/family-links/types.ts
--   · src/lib/nex-native/family-links/family-link-service.ts
--   · src/lib/nex-native/family-links/age-attestation-service.ts
--   · src/lib/nex-native/family-links/family-role-reader.ts
-- ═══════════════════════════════════════════════════════════════════
