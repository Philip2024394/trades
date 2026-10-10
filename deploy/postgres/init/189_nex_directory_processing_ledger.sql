-- 189_nex_directory_processing_ledger.sql
--
-- NEX Directory · Per-source-row processing ledger.
--
-- WHAT THIS MIGRATION DOES
--   Creates `nex.directory_processing_ledger` · a per-legacy-row state
--   table that records the processing OUTCOME of every row that enters
--   the Directory ingestion pipeline from the 5 legacy vertical tables:
--
--     nex.food_business          (migration 054)
--     nex.accommodation_business (migration 078)
--     nex.service_business       (migration 110)
--     nex.mp_seller              (migration 096)
--     nex.bike_rental_listing    (migration 132)
--
--   Every legacy row MUST end up in exactly one of 7 processing states:
--     PENDING                      — not yet processed
--     RESOLVED                     — mapped to a canonical row + evidence
--     EXCLUDED                     — legitimately excluded (reason recorded)
--     AWAITING_ENRICHMENT          — waiting on enrichment evidence
--     AWAITING_SOURCE_PERMISSION   — waiting on registry can_derive flip
--     AWAITING_OWNER_VERIFICATION  — pending owner-claim adjudication
--     FAILED_RETRYABLE             — transient failure · retry
--
-- WHY THIS TABLE EXISTS
--   The sealed canonical spine (migrations 166-183) tracks what IS in
--   the canonical layer. It does NOT track what came in from the legacy
--   verticals and where each legacy row ended up. The master-prompt
--   requirement is that every one of ~59,596 legacy rows has a known
--   processing outcome · this table is the ledger that answers
--   "where is legacy row X right now?" per source-table + source-id.
--
-- RELATIONSHIP TO THE SEALED SPINE
--   · One row per (source_table, source_internal_id) · UNIQUE.
--   · When processing_state = 'RESOLVED', canonical_business_id FKs
--     into nex.business_canonical. ON DELETE SET NULL · if the
--     canonical row is ever purged (admin review), the ledger row
--     survives with its historical outcome intact.
--   · evidence_count mirrors how many `nex.business_evidence` rows
--     cite this legacy row. The sealed canonical-handoff path is
--     responsible for incrementing it in the same transaction as the
--     evidence insert · this migration does NOT add a trigger.
--
-- NOT APPEND-ONLY
--   Unlike business_canonical_lifecycle_log (migration 168) and
--   business_evidence (migration 170), this table IS updated as rows
--   progress through the pipeline. A row's state advances from PENDING
--   to one of the 6 terminal/waiting states, and may re-enter PENDING
--   from FAILED_RETRYABLE after a retry. The service module in
--   `src/lib/nex-canonical/directory-processing-ledger.ts` is the ONLY
--   authorised writer · it maintains `updated_at = now()` on every
--   write (app-level discipline, matching the convention of the sealed
--   spine migrations 167-183 which deliberately do NOT install
--   triggers).
--
-- IDEMPOTENCE
--   CREATE TABLE IF NOT EXISTS. CREATE INDEX IF NOT EXISTS. No DML.
--   Safe to re-run.
--
-- ROLLBACK
--   DROP TABLE nex.directory_processing_ledger;
--   (No FKs point AT this table.)
--
-- SAFE ON POPULATED DB
--   Yes. New table. No ALTERs to existing tables. No GRANT/REVOKE on
--   existing tables. Zero impact on current readers or writers of
--   `nex.business_canonical` or the 5 legacy vertical tables.
--
-- WHAT THIS TABLE IS NOT
--   · Not a replacement for `nex.business_canonical_lifecycle_log`.
--     That log records CANONICAL state transitions. This ledger records
--     LEGACY-ROW processing outcomes.
--   · Not a replacement for `nex.business_evidence`. Evidence attests
--     to a derivation; this ledger records whether a legacy row has
--     been ingested at all.
--   · Not a retry queue in itself. retry_count is a counter, not a
--     scheduler · the retry policy lives in the directory-ingestion
--     runner.
--   · Not a trigger host. The populate script + the service module
--     write every row explicitly; no CREATE TRIGGER appears in this
--     migration.
--
-- DEPLOYMENT PREREQUISITES
--   · nex.business_canonical:          migration 167.
--   · nex.food_business:               migration 054.
--   · nex.accommodation_business:      migration 078.
--   · nex.service_business:            migration 110.
--   · nex.mp_seller:                   migration 096.
--   · nex.bike_rental_listing:         migration 132.
--   · gen_random_uuid():               PG 13+ pg_catalog.
--
-- NOT APPLIED
--   Follow the sealed-spine convention · this migration MUST NOT be
--   applied to any live database without an explicit founder
--   authorisation of the deployment window. The populate script
--   `scripts/nex-canonical/populate-processing-ledger.ts` can only run
--   after this migration is applied.

-- ═══════════════════════════════════════════════════════════════════
-- directory_processing_ledger — per-legacy-row processing state
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS nex.directory_processing_ledger (
  ledger_id                 uuid         PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Fully-qualified legacy source table name · one of the 5 sealed
  -- vertical table names. Matched by ck_dpl_source_table.
  source_table              text         NOT NULL,

  -- The legacy row's primary-key value as text (uuid PK stringified).
  -- Text, not uuid, so this ledger can accommodate any future vertical
  -- whose PK is not a uuid (e.g. the owner-side nex_business table on
  -- Supabase uses a different id shape).
  source_internal_id        text         NOT NULL,

  -- Current processing state · one of the sealed 7 values.
  processing_state          text         NOT NULL DEFAULT 'PENDING',

  -- Set when processing_state = 'RESOLVED'. NULL in every other state.
  -- ON DELETE SET NULL preserves the historical outcome even if a
  -- canonical row is admin-purged downstream.
  canonical_business_id     uuid         NULL,

  -- How many nex.business_evidence rows cite this legacy row. Starts
  -- at 0. The sealed canonical-handoff path (NOT a trigger here)
  -- maintains this counter in the same transaction as evidence inserts.
  evidence_count            integer      NOT NULL DEFAULT 0,

  -- Wall-clock stamp of the last state-changing write. NULL until the
  -- first state transition; set thereafter.
  last_processed_at         timestamptz  NULL,

  -- Next action for the ingestion runner · one of the sealed 7 values.
  -- 'INGEST'      — new row · waiting on first candidate generation
  -- 'RESOLVE'     — candidate generated · waiting on resolver + approval
  -- 'ENRICH'      — resolved but needs more evidence
  -- 'PROMOTE'     — enough evidence · waiting on lifecycle promotion
  -- 'OWNER_CLAIM' — owner-claim adjudication required
  -- 'LEGAL_REVIEW'— blocked by legal / registry can_derive = false
  -- 'NONE'        — terminal · nothing further to do
  next_action               text         NOT NULL DEFAULT 'INGEST',

  -- Human-readable text when processing_state = 'EXCLUDED'. NULL in
  -- every other state. Non-blank when provided.
  exclusion_reason          text         NULL,

  -- Monotonically-increasing retry counter · reset to 0 only on a
  -- successful state transition out of FAILED_RETRYABLE.
  retry_count               integer      NOT NULL DEFAULT 0,

  -- Standard timestamps · app-level discipline (no trigger).
  created_at                timestamptz  NOT NULL DEFAULT now(),
  updated_at                timestamptz  NOT NULL DEFAULT now(),

  -- ─────────────── CHECKs ────────────────────────────────────────

  CONSTRAINT ck_dpl_source_table CHECK (source_table IN (
    'nex.food_business',
    'nex.accommodation_business',
    'nex.service_business',
    'nex.mp_seller',
    'nex.bike_rental_listing'
  )),

  CONSTRAINT ck_dpl_source_internal_id_nonblank CHECK (
    length(trim(source_internal_id)) > 0
  ),

  CONSTRAINT ck_dpl_processing_state CHECK (processing_state IN (
    'PENDING',
    'RESOLVED',
    'EXCLUDED',
    'AWAITING_ENRICHMENT',
    'AWAITING_SOURCE_PERMISSION',
    'AWAITING_OWNER_VERIFICATION',
    'FAILED_RETRYABLE'
  )),

  CONSTRAINT ck_dpl_next_action CHECK (next_action IN (
    'INGEST',
    'RESOLVE',
    'ENRICH',
    'PROMOTE',
    'OWNER_CLAIM',
    'LEGAL_REVIEW',
    'NONE'
  )),

  -- Resolved rows MUST carry a canonical_business_id. All other states
  -- MUST leave it NULL. Protects against a half-written RESOLVED row.
  CONSTRAINT ck_dpl_resolved_consistency CHECK (
    (processing_state = 'RESOLVED' AND canonical_business_id IS NOT NULL)
    OR
    (processing_state <> 'RESOLVED' AND canonical_business_id IS NULL)
  ),

  -- Excluded rows MUST carry a non-blank exclusion_reason. All other
  -- states MUST leave it NULL. Prevents silent exclusion.
  CONSTRAINT ck_dpl_excluded_consistency CHECK (
    (processing_state = 'EXCLUDED'
      AND exclusion_reason IS NOT NULL
      AND length(trim(exclusion_reason)) > 0)
    OR
    (processing_state <> 'EXCLUDED' AND exclusion_reason IS NULL)
  ),

  -- evidence_count must be non-negative.
  CONSTRAINT ck_dpl_evidence_count_nonneg CHECK (evidence_count >= 0),

  -- retry_count must be non-negative.
  CONSTRAINT ck_dpl_retry_count_nonneg CHECK (retry_count >= 0),

  -- One ledger row per (source_table, source_internal_id). The populate
  -- script relies on this to be idempotent via ON CONFLICT DO NOTHING.
  CONSTRAINT uq_dpl_source_row UNIQUE (source_table, source_internal_id),

  -- ─────────────── FKs ──────────────────────────────────────────

  CONSTRAINT fk_dpl_canonical_business
    FOREIGN KEY (canonical_business_id)
    REFERENCES nex.business_canonical (canonical_business_id)
    ON DELETE SET NULL
);

-- ─────────────── Indexes ──────────────────────────────────────

-- Primary scheduler read path · "which rows need which action next?"
CREATE INDEX IF NOT EXISTS idx_dpl_state_action
  ON nex.directory_processing_ledger (processing_state, next_action);

-- Reverse lookup · "which legacy rows resolved to this canonical?"
CREATE INDEX IF NOT EXISTS idx_dpl_canonical_business_id
  ON nex.directory_processing_ledger (canonical_business_id)
  WHERE canonical_business_id IS NOT NULL;

-- Direct per-source-row lookup. Complements the UNIQUE constraint ·
-- the service module reads by this key on every state transition.
CREATE INDEX IF NOT EXISTS idx_dpl_source_lookup
  ON nex.directory_processing_ledger (source_table, source_internal_id);

-- ─────────────── Documentation ──────────────────────────────────

COMMENT ON TABLE nex.directory_processing_ledger IS
  'Per-legacy-row processing state for every row in the 5 sealed vertical tables (food_business, accommodation_business, service_business, mp_seller, bike_rental_listing). The ONE table that answers "where is legacy row X right now?" with one of 7 processing states. Updated in-place as rows progress; not append-only. The service module in src/lib/nex-canonical/directory-processing-ledger.ts is the only authorised writer.';

COMMENT ON COLUMN nex.directory_processing_ledger.processing_state IS
  'One of: PENDING, RESOLVED, EXCLUDED, AWAITING_ENRICHMENT, AWAITING_SOURCE_PERMISSION, AWAITING_OWNER_VERIFICATION, FAILED_RETRYABLE. See CHECK ck_dpl_processing_state.';

COMMENT ON COLUMN nex.directory_processing_ledger.next_action IS
  'One of: INGEST, RESOLVE, ENRICH, PROMOTE, OWNER_CLAIM, LEGAL_REVIEW, NONE. See CHECK ck_dpl_next_action.';

COMMENT ON COLUMN nex.directory_processing_ledger.canonical_business_id IS
  'Non-NULL iff processing_state = RESOLVED. FK to nex.business_canonical with ON DELETE SET NULL · ledger survives if canonical is admin-purged.';

COMMENT ON COLUMN nex.directory_processing_ledger.evidence_count IS
  'Number of nex.business_evidence rows citing this legacy row. Maintained by the sealed canonical-handoff path in the same transaction as evidence inserts (no trigger here).';

-- ═══════════════════════════════════════════════════════════════════
-- End of migration 189.
-- ═══════════════════════════════════════════════════════════════════
