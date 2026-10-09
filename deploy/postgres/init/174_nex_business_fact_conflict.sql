-- 174_nex_business_fact_conflict.sql
--
-- NEX Directory Canonical Spine · migration 9 of 12 · fact conflicts.
-- Phase 1 of the N=7-primitive architecture (founder-sealed 2026-10-07,
-- Phase-1 build authorised 2026-10-09).
--
-- Primitive 5 of the sealed 7-primitive spine.
--
-- WHAT THIS MIGRATION DOES
--   (1) Creates `nex.business_fact_conflict` · the sealed primitive
--       that holds unresolved contradictions between evidence sources
--       for a single canonical row.
--   (2) RE-CREATES `nex.business_directory_v` (via CREATE OR REPLACE
--       VIEW) with the D-3 "open-conflict predicate" NOT EXISTS clause
--       appended · the sealed hook left by migration 175 + 181.
--
-- SEALED FIELD SHAPE (flat text field_path per founder decision)
--   `field_path text NOT NULL` — the canonical-row field in conflict,
--   e.g. 'phone_e164', 'city', 'coordinates', 'name_canonical',
--   'address.line1', 'address.postal_code'. Flat text, NOT a jsonb
--   pointer, so index + query stays simple.
--
--   `left_value jsonb` / `right_value jsonb` — the two values that
--   disagree. jsonb because the field type varies (text, number,
--   geo coordinate pair, nested object). The conflict record does
--   NOT encode which value is "correct" · resolution is a separate
--   human/admin decision.
--
--   `left_evidence_id` / `right_evidence_id` — FKs into
--   `nex.business_evidence` so each conflict side points at its
--   lineage. Both required · a conflict is always between two
--   attested observations.
--
-- RESOLUTION STATES (sealed 3-value enum)
--   OPEN       — unresolved; the canonical is NOT publishable per 175's D-3.
--   RESOLVED   — admin chose a side (or merged); which side is encoded
--                in `resolution_choice`; `resolved_at` + `resolved_by` set.
--   DISMISSED  — admin determined the two values are compatible
--                (e.g., two valid phone numbers; the row has multiple
--                contact lines). Also sets `resolved_at` + `resolved_by`.
--
-- PUBLICATION PREDICATE (D-3 FROM 175/181)
--   The sealed publication gate `nex.business_directory_v` gains a
--   fourth clause: a canonical is NOT publishable while it has ANY
--   fact_conflict row with `resolution_state = 'OPEN'`. The clause
--   is appended via CREATE OR REPLACE VIEW in part (2) of this
--   migration, preserving the three clauses sealed in 175 + 181 and
--   adding the open-conflict `NOT EXISTS` predicate.
--
-- IDEMPOTENCE
--   CREATE TABLE IF NOT EXISTS. CREATE OR REPLACE VIEW. Safe to re-run.
--
-- ROLLBACK
--   BEGIN;
--     -- To revert the view to migration 181's shape (without the D-3
--     -- clause), re-apply migration 181 after dropping this table:
--     DROP TABLE IF EXISTS nex.business_fact_conflict;
--     -- Then re-apply migration 181 (CREATE OR REPLACE VIEW).
--   COMMIT;
--
-- SAFE ON POPULATED DB
--   Yes. New table + CREATE OR REPLACE VIEW. No ALTERs on existing
--   tables. No DML. No GRANT/REVOKE.
--
-- WHAT THIS TABLE IS NOT
--   · Not a validator. Values are inserted by the resolver when it
--     observes contradictions; the resolver does not decide which
--     value is correct.
--   · Not a merger. Resolution flips `resolution_state` but does NOT
--     automatically update `nex.business_canonical`. A separate admin
--     action writes the chosen value into canonical.
--   · Not a general-purpose data-quality rules engine. field_path is
--     a flat identifier; semantic validation (phone-is-E.164 etc.)
--     lives in migration 167 CHECKs and the resolver.
--
-- DEPLOYMENT PREREQUISITES
--   · nex.business_canonical: migration 167.
--   · nex.business_evidence: migration 170.
--   · nex.business_directory_v: migrations 175 + 181 (this migration
--     re-creates it with the D-3 clause).
--
-- NOT APPLIED
--   Phase 1 of the sealed architecture. MUST NOT be applied to any
--   live database without an explicit founder authorisation.

-- ═══════════════════════════════════════════════════════════════════
-- (1) · business_fact_conflict table
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS nex.business_fact_conflict (
  conflict_id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),

  canonical_business_id  uuid         NOT NULL,

  -- Flat field identifier (not a jsonb path expression).
  field_path             text         NOT NULL,

  -- The two disagreeing values. jsonb because the field type varies.
  left_value             jsonb        NOT NULL,
  right_value            jsonb        NOT NULL,

  -- Evidence lineage · each side points at the evidence row that
  -- attested the value.
  left_evidence_id       uuid         NOT NULL,
  right_evidence_id      uuid         NOT NULL,

  -- Lifecycle of the conflict record.
  resolution_state       text         NOT NULL DEFAULT 'OPEN',

  -- When RESOLVED, which side did the admin choose?
  --   'left'      — left_value is correct, right_value discarded
  --   'right'     — right_value is correct, left_value discarded
  --   'merge'     — both correct (admin merged into canonical somehow)
  --   NULL        — resolution_state is OPEN or DISMISSED
  resolution_choice      text         NULL,

  -- Discovery metadata.
  discovered_at          timestamptz  NOT NULL DEFAULT now(),
  discovered_by          text         NOT NULL,

  -- Resolution metadata (set when state leaves OPEN).
  resolved_at            timestamptz  NULL,
  resolved_by            text         NULL,
  resolution_note        text         NULL,

  -- ─────────────── CHECKs ────────────────────────────────────────

  CONSTRAINT ck_bfc_resolution_state CHECK (resolution_state IN (
    'OPEN', 'RESOLVED', 'DISMISSED'
  )),

  CONSTRAINT ck_bfc_resolution_choice CHECK (
    resolution_choice IS NULL
    OR resolution_choice IN ('left', 'right', 'merge')
  ),

  CONSTRAINT ck_bfc_field_path_nonblank CHECK (
    length(trim(field_path)) > 0
  ),

  CONSTRAINT ck_bfc_discovered_by_nonblank CHECK (
    length(trim(discovered_by)) > 0
  ),

  -- OPEN rows must not have resolution_choice / resolved_at / resolved_by.
  -- RESOLVED rows must have resolution_choice + resolved_at + resolved_by.
  -- DISMISSED rows must have resolved_at + resolved_by; resolution_choice
  -- stays NULL (DISMISSED = "no choice; values compatible").
  CONSTRAINT ck_bfc_state_fields_consistency CHECK (
    (resolution_state = 'OPEN'
      AND resolution_choice IS NULL
      AND resolved_at IS NULL
      AND resolved_by IS NULL)
    OR
    (resolution_state = 'RESOLVED'
      AND resolution_choice IS NOT NULL
      AND resolved_at IS NOT NULL
      AND resolved_by IS NOT NULL)
    OR
    (resolution_state = 'DISMISSED'
      AND resolution_choice IS NULL
      AND resolved_at IS NOT NULL
      AND resolved_by IS NOT NULL)
  ),

  -- Guard: the two evidence sides must differ (otherwise it's not a conflict).
  CONSTRAINT ck_bfc_evidence_sides_differ CHECK (
    left_evidence_id <> right_evidence_id
  ),

  -- ─────────────── FKs ──────────────────────────────────────────

  CONSTRAINT fk_bfc_canonical_business
    FOREIGN KEY (canonical_business_id)
    REFERENCES nex.business_canonical (canonical_business_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_bfc_left_evidence
    FOREIGN KEY (left_evidence_id)
    REFERENCES nex.business_evidence (evidence_id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_bfc_right_evidence
    FOREIGN KEY (right_evidence_id)
    REFERENCES nex.business_evidence (evidence_id)
    ON DELETE RESTRICT
);

-- ─────────────── Indexes ──────────────────────────────────────

-- Publication-gate predicate hot read path: "does canonical X have any
-- OPEN conflicts?" · consumed by business_directory_v's D-3 NOT EXISTS.
CREATE INDEX IF NOT EXISTS idx_bfc_canonical_open
  ON nex.business_fact_conflict (canonical_business_id)
  WHERE resolution_state = 'OPEN';

-- Admin queue: "which conflicts need review?" · most recent first.
CREATE INDEX IF NOT EXISTS idx_bfc_open_queue
  ON nex.business_fact_conflict (discovered_at DESC)
  WHERE resolution_state = 'OPEN';

-- Per-field audit: "which fields conflict most?" · observability.
CREATE INDEX IF NOT EXISTS idx_bfc_field_path
  ON nex.business_fact_conflict (field_path);

-- ─────────────── Documentation ──────────────────────────────────

COMMENT ON TABLE nex.business_fact_conflict IS
  'Sealed primitive 5 of the NEX Directory canonical spine. One row per unresolved contradiction between two evidence sources for a single canonical. OPEN rows block publication via business_directory_v D-3 predicate.';

COMMENT ON COLUMN nex.business_fact_conflict.field_path IS
  'Flat text identifier for the conflicting field · e.g. phone_e164, city, address.line1. Not a jsonb path expression.';

COMMENT ON COLUMN nex.business_fact_conflict.resolution_state IS
  'OPEN (default) blocks publication. RESOLVED carries a resolution_choice. DISMISSED means admin determined values are compatible (no choice needed).';

-- ═══════════════════════════════════════════════════════════════════
-- (2) · business_directory_v · append D-3 open-conflict predicate
-- ═══════════════════════════════════════════════════════════════════
--
-- Re-creates the view with the sealed 4-clause publication gate:
--   D-1  lifecycle_state ∈ L1
--   D-2  chain-resolved source has can_display = TRUE
--   D-3  NO open fact_conflict (THIS WAVE)
--   D-5  attribution-template-present for every attribution_required source
--
-- Preserves the exact column list + three existing clauses from
-- migration 175 + 181.

CREATE OR REPLACE VIEW nex.business_directory_v AS
SELECT
  bc.canonical_business_id,
  bc.entity_type,
  bc.country,
  bc.lifecycle_state,
  bc.name_canonical,
  bc.name_norm,
  bc.aliases,
  bc.phone_e164,
  bc.website_apex,
  bc.osm_id,
  bc.wikidata_qid,
  bc.city,
  bc.district,
  bc.street_line,
  bc.neighbourhood,
  bc.address,
  bc.coordinates,
  bc.category_ids,
  bc.services_products,
  bc.supersedes_business_id,
  bc.superseded_by_business_id,
  bc.last_verified_at,
  bc.created_at,
  bc.updated_at
FROM nex.business_canonical bc
WHERE
  -- D-1 · publishable lifecycle set L1 (sealed by migration 175)
  bc.lifecycle_state IN ('VERIFIED', 'OWNER_CLAIMED', 'OWNER_VERIFIED')
  -- Supersession guard (sealed by migration 175)
  AND bc.superseded_by_business_id IS NULL
  -- D-2 · chain-resolved source can_display = TRUE (sealed by 181, one-hop)
  AND EXISTS (
    SELECT 1
    FROM nex.business_evidence be
    JOIN nex.source_registry sr_direct
      ON sr_direct.source_id = be.source_id
    JOIN nex.source_registry sr_origin
      ON sr_origin.source_id = COALESCE(
           sr_direct.derived_from_source_id,
           be.source_id
         )
    WHERE be.canonical_business_id = bc.canonical_business_id
      AND sr_origin.can_display = TRUE
  )
  -- D-3 · NO open fact_conflict for this canonical (THIS WAVE)
  AND NOT EXISTS (
    SELECT 1
    FROM nex.business_fact_conflict bfc
    WHERE bfc.canonical_business_id = bc.canonical_business_id
      AND bfc.resolution_state = 'OPEN'
  )
  -- D-5 · fail-closed attribution-template-present (sealed by 181)
  AND NOT EXISTS (
    SELECT 1
    FROM nex.business_evidence be
    JOIN nex.source_registry sr_direct
      ON sr_direct.source_id = be.source_id
    JOIN nex.source_registry sr_origin
      ON sr_origin.source_id = COALESCE(
           sr_direct.derived_from_source_id,
           be.source_id
         )
    WHERE be.canonical_business_id = bc.canonical_business_id
      AND sr_origin.attribution_required = TRUE
      AND (
        sr_origin.attribution_template IS NULL
        OR length(trim(sr_origin.attribution_template)) = 0
      )
  );

COMMENT ON VIEW nex.business_directory_v IS
  'Sealed Directory publication gate (migrations 175 + 181 + 174). Four-clause gate: D-1 lifecycle L1, D-2 chain-resolved can_display, D-3 no OPEN fact_conflict, D-5 attribution-template-present. DP-3 adds the GRANT/REVOKE lockdown (separate wave).';

-- ═══════════════════════════════════════════════════════════════════
-- End of migration 174.
-- ═══════════════════════════════════════════════════════════════════
