-- ═══════════════════════════════════════════════════════════════════
-- 170_nex_business_evidence.sql
-- NEX Business Canonical · Immutable evidence · one row per approved
-- canonical write (either insert_new or merge_match).
-- Philip 2026-10-08 · FOUNDER CEREMONIAL AUTHORIZATION · Write Boundary Wave
-- ═══════════════════════════════════════════════════════════════════
--
-- WHAT THIS MIGRATION DOES
--   Creates the durable lineage table `nex.business_evidence`.
--
--   Each row explains WHY a canonical business was created or updated:
--     · which Candidate contributed the identity signals
--     · which DecisionRecord (approval) authorised it
--     · which ReviewPackage was in force at that approval
--     · which legacy source row was projected into the Candidate
--     · which resolver verdict (MATCH / NO_MATCH) routed the write
--     · which source_registry source permitted the derivation
--     · the full observation provenance (generator, run id, timestamps,
--       founder id)
--
--   The TypeScript source contract is `HandoffEvidence` in
--   `scripts/nex-canonical/canonical-handoff.ts`. This migration MUST
--   mirror that contract.
--
-- APPEND-ONLY INTENT
--   Business evidence is a historical record. Once inserted, a row is
--   never updated. The existing repository convention does not include
--   a role/permission system; append-only is a documented operational
--   convention here. If a role/permission layer is later introduced,
--   `nex.business_evidence` must receive INSERT privilege only · no
--   UPDATE / DELETE / TRUNCATE.
--
-- IDEMPOTENCE
--   CREATE TABLE IF NOT EXISTS.
--   CREATE INDEX IF NOT EXISTS for every index.
--   No DML. Safe to re-run.
--
-- ROLLBACK
--   DROP TABLE nex.business_evidence;
--   (No FKs point AT this table yet.)
--
-- SAFE ON POPULATED DB
--   Yes. New table. No ALTERs to existing tables. No GRANT/REVOKE on
--   existing tables. Zero impact on current readers or writers of
--   `nex.business_canonical`, `nex.source_registry`, or any other
--   table.
--
-- ═══════════════════════════════════════════════════════════════════
-- DEPLOYMENT PREREQUISITES
-- ═══════════════════════════════════════════════════════════════════
--   · PostGIS: NOT required by this table itself · migration 167
--     already requires it for `nex.business_canonical.coordinates`.
--   · gen_random_uuid(): available in PG 13+ via pg_catalog (same
--     assumption as migration 167).
--   · nex.business_canonical: must exist (migration 167).
--   · nex.source_registry: must exist (migration 166).
--
-- ═══════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════
-- business_evidence — immutable lineage · one row per authorised write
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS nex.business_evidence (
  -- Surrogate primary key · deterministic bind to a single write.
  evidence_id                   uuid         PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The canonical row this evidence attests to. ALWAYS set on a
  -- successful write · for merge_match this is the existing target,
  -- for insert_new this is the newly created canonical row.
  canonical_business_id         uuid         NOT NULL,

  -- Mirrors HandoffEvidence.schema_version · pinned literal.
  schema_version                text         NOT NULL,

  -- Candidate integrity triple (mirrors HandoffEvidence.*)
  candidate_id                  text         NOT NULL,
  candidate_integrity_hash      text         NOT NULL,
  decision_record_id            text         NOT NULL,
  review_package_id             text         NOT NULL,

  -- Mirrors HandoffEvidence.legacy_source (flattened)
  legacy_source_table           text         NOT NULL,
  legacy_source_ref             text         NOT NULL,
  legacy_source_internal_id     text         NULL,

  -- Mirrors HandoffEvidence.resolver_verdict_summary (flattened)
  -- resolver_target_id is NULL for NO_MATCH · equals canonical_business_id
  -- for MATCH (the merge target).
  resolver_verdict_kind         text         NOT NULL,
  resolver_target_id            uuid         NULL,
  resolver_score                double precision NOT NULL,

  -- Mirrors HandoffEvidence.observation_provenance (flattened)
  observation_generator            text        NOT NULL,
  observation_run_id               text        NOT NULL,
  observation_generated_at         timestamptz NOT NULL,
  observation_decision_timestamp   timestamptz NOT NULL,
  observation_founder_id           text        NOT NULL,

  -- Mirrors HandoffEvidence.source_id · FK into source_registry.
  source_id                     text         NOT NULL,

  -- DB-side lineage (immutable observation stamp).
  created_at                    timestamptz  NOT NULL DEFAULT now(),

  -- ─────────────── CHECKs ────────────────────────────────────────

  -- Pin to the sealed evidence schema version. Future schema versions
  -- land in a NEW table / NEW migration, not an UPDATE on this one.
  CONSTRAINT ck_be_schema_version CHECK (schema_version = 'evidence-v1'),

  -- Verdict kinds that reach evidence are only MATCH or NO_MATCH ·
  -- AMBIGUOUS verdicts are blocked by precheckHandoff and never arrive
  -- at the write boundary.
  CONSTRAINT ck_be_resolver_verdict_kind CHECK (
    resolver_verdict_kind IN ('MATCH', 'NO_MATCH')
  ),

  -- Score was computed by the Layer-B resolver in [0,1].
  CONSTRAINT ck_be_resolver_score_range CHECK (
    resolver_score >= 0 AND resolver_score <= 1
  ),

  -- Content-hash columns are 64-char lowercase hex (SHA-256).
  CONSTRAINT ck_be_candidate_hash_fmt CHECK (
    candidate_integrity_hash ~ '^[a-f0-9]{64}$'
  ),
  CONSTRAINT ck_be_decision_record_fmt CHECK (
    decision_record_id ~ '^[a-f0-9]{64}$'
  ),
  CONSTRAINT ck_be_review_pkg_fmt CHECK (
    review_package_id ~ '^[a-f0-9]{64}$'
  ),

  -- Non-blank identifiers.
  CONSTRAINT ck_be_candidate_id_nonblank CHECK (
    length(trim(candidate_id)) > 0
  ),
  CONSTRAINT ck_be_legacy_table_nonblank CHECK (
    length(trim(legacy_source_table)) > 0
  ),
  CONSTRAINT ck_be_legacy_ref_nonblank CHECK (
    length(trim(legacy_source_ref)) > 0
  ),
  CONSTRAINT ck_be_generator_nonblank CHECK (
    length(trim(observation_generator)) > 0
  ),
  CONSTRAINT ck_be_run_id_nonblank CHECK (
    length(trim(observation_run_id)) > 0
  ),
  CONSTRAINT ck_be_founder_nonblank CHECK (
    length(trim(observation_founder_id)) > 0
  ),

  -- Verdict/target consistency: NO_MATCH must have NULL target, MATCH
  -- must have a non-NULL target and that target must equal the
  -- canonical_business_id on the row (because merge_match writes
  -- evidence under the target's id).
  CONSTRAINT ck_be_verdict_target_consistency CHECK (
    (resolver_verdict_kind = 'NO_MATCH' AND resolver_target_id IS NULL)
    OR
    (resolver_verdict_kind = 'MATCH'
      AND resolver_target_id IS NOT NULL
      AND resolver_target_id = canonical_business_id)
  ),

  -- ─────────────── FKs ──────────────────────────────────────────

  -- The canonical business this evidence attests to. ON DELETE
  -- RESTRICT · evidence is a historical record · deleting a canonical
  -- row must not silently invalidate its lineage.
  CONSTRAINT fk_be_canonical_business
    FOREIGN KEY (canonical_business_id)
    REFERENCES nex.business_canonical (canonical_business_id)
    ON DELETE RESTRICT,

  -- The source_registry entry that permitted the derivation (its
  -- can_derive flag). ON DELETE RESTRICT for the same reason.
  CONSTRAINT fk_be_source
    FOREIGN KEY (source_id)
    REFERENCES nex.source_registry (source_id)
    ON DELETE RESTRICT
);

-- ─────────────── Indexes ──────────────────────────────────────

-- "What evidence attests to this canonical business?" · the primary
-- read path when auditing a canonical row.
CREATE INDEX IF NOT EXISTS idx_be_canonical_business
  ON nex.business_evidence (canonical_business_id);

-- "Which evidence rows came from this approval?" · supports the
-- supersession-chain audit · one DecisionRecord may produce evidence
-- rows across multiple canonical businesses only in extraordinary
-- future flows (not expected under current approval-v1 / handoff-v1,
-- but the index is cheap).
CREATE INDEX IF NOT EXISTS idx_be_decision_record
  ON nex.business_evidence (decision_record_id);

-- "Which evidence rows reference this Candidate?" · supports
-- cross-run deduplication audits.
CREATE INDEX IF NOT EXISTS idx_be_candidate_id
  ON nex.business_evidence (candidate_id);

-- "Which evidence rows came from this source?" · supports source-
-- registry policy audits (e.g. prove that no evidence rows reference
-- a source whose can_derive was retroactively revoked).
CREATE INDEX IF NOT EXISTS idx_be_source_id
  ON nex.business_evidence (source_id);

-- ─────────────── Documentation comments ──────────────────────

COMMENT ON TABLE nex.business_evidence IS
  'NEX Business Canonical · immutable per-write lineage. One row per '
  'authorised canonical write (insert_new or merge_match). The '
  'TypeScript source contract is HandoffEvidence in '
  'canonical-handoff.ts. Append-only by convention.';

COMMENT ON COLUMN nex.business_evidence.canonical_business_id IS
  'The canonical business this evidence attests to. For merge_match '
  'this is the pre-existing target; for insert_new this is the '
  'newly-created row (captured via INSERT ... RETURNING in the same '
  'transaction).';

COMMENT ON COLUMN nex.business_evidence.resolver_target_id IS
  'NULL on NO_MATCH; equals canonical_business_id on MATCH. The '
  'ck_be_verdict_target_consistency CHECK enforces this.';
