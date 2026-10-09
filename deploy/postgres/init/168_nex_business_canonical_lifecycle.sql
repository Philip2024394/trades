-- 168_nex_business_canonical_lifecycle.sql
--
-- NEX Directory Canonical Spine · migration 3 of 12 · lifecycle transition log.
-- Phase 1 of the N=7-primitive architecture (founder-sealed 2026-10-07,
-- Phase-1 build authorised 2026-10-09).
--
-- WHAT THIS MIGRATION DOES
--   Creates `nex.business_canonical_lifecycle_log` · an append-only audit
--   trail that records every `lifecycle_state` transition on
--   `nex.business_canonical` with its causing evidence citation.
--
--   One row per transition. The CURRENT state of a canonical lives in
--   `nex.business_canonical.lifecycle_state`; THIS table records HOW it
--   got there. The pair makes it possible to answer:
--     · "Who promoted this row from DISCOVERED to VERIFIED?"
--     · "What approval record authorised the OWNER_CLAIMED transition?"
--     · "When did this canonical first appear with evidence?"
--   without reconstructing from scattered sources.
--
-- APPEND-ONLY INTENT
--   Like business_evidence (migration 170), this table is a historical
--   record. Once inserted, a row is never updated. The sealed convention
--   does not add a role/permission layer in this wave; DP-3 (separate
--   authorisation) adds INSERT-only privileges to the directory role.
--
-- IDEMPOTENCE
--   CREATE TABLE IF NOT EXISTS. CREATE INDEX IF NOT EXISTS. No DML.
--   Safe to re-run.
--
-- ROLLBACK
--   DROP TABLE nex.business_canonical_lifecycle_log;
--   (No FKs point AT this table.)
--
-- SAFE ON POPULATED DB
--   Yes. New table. No ALTERs to existing tables. No GRANT/REVOKE on
--   existing tables. Zero impact on current readers or writers of
--   `nex.business_canonical`.
--
-- WHAT THIS TABLE IS NOT
--   · Not the source of truth for CURRENT lifecycle (that's
--     `nex.business_canonical.lifecycle_state`).
--   · Not a trigger-driven mirror (triggers deliberately out of scope ·
--     the sealed canonical-handoff write path writes this log row in the
--     same transaction as the canonical UPDATE).
--   · Not a replacement for `nex.business_evidence`. Evidence attests to
--     the derivation that caused a change; this log records the state
--     transition itself. The two are complementary and FK-linked
--     (nullable; some transitions are owner-initiated with no evidence
--     row · e.g., manual admin override).
--
-- DEPLOYMENT PREREQUISITES
--   · nex.business_canonical: migration 167.
--   · gen_random_uuid(): PG 13+ pg_catalog.
--
-- NOT APPLIED
--   Phase 1 of the sealed architecture. MUST NOT be applied to any live
--   database without an explicit founder authorisation of the deployment
--   window.

-- ═══════════════════════════════════════════════════════════════════
-- business_canonical_lifecycle_log — append-only transition audit
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS nex.business_canonical_lifecycle_log (
  log_id                      uuid         PRIMARY KEY DEFAULT gen_random_uuid(),

  canonical_business_id       uuid         NOT NULL,

  -- Previous state. NULL only for the row that records the initial
  -- transition into DISCOVERED (the row's birth); every other row has
  -- a non-NULL from_state matching the sealed 7-value enum.
  from_state                  text         NULL,

  -- New state. Always set; matches the sealed 7-value enum from
  -- migration 167's ck_bc_lifecycle_state.
  to_state                    text         NOT NULL,

  -- Human-readable transition category · guides admin UIs and audit
  -- queries. Not a FK; small controlled vocabulary.
  --   'birth'                — initial write (from_state is NULL)
  --   'enrichment'           — more evidence landed; was DISCOVERED
  --   'multi_source_verify'  — ≥2 sources agree; promoted to VERIFIED
  --   'admin_verify'         — admin manually confirmed
  --   'owner_claim'          — a claim action was accepted
  --   'owner_verify'         — admin / verified_note recorded for claim
  --   'dormancy'             — freshness decay crossed 24-month gate
  --   'reactivation'         — fresh evidence lifted dormancy
  --   'supersede'            — merged into another canonical (terminal)
  transition_reason           text         NOT NULL,

  -- Optional link to the DecisionRecord (approval content hash) that
  -- authorised this transition. NULL for owner-initiated and admin-
  -- initiated transitions that do not carry an approval record.
  -- Matches the format used in business_evidence.decision_record_id
  -- (64-char lowercase hex SHA-256).
  decision_record_id          text         NULL,

  -- Optional link to the business_evidence row that this transition
  -- is attested by. NULL for owner_claim / admin_verify / dormancy /
  -- reactivation transitions that are not evidence-row-citing.
  attesting_evidence_id       uuid         NULL,

  -- Supersession target. Populated only when to_state = 'SUPERSEDED'
  -- and matches nex.business_canonical.superseded_by_business_id on
  -- the same canonical row.
  superseded_by_business_id   uuid         NULL,

  -- Actor identity · 'system:canonical-handoff', 'admin:<id>',
  -- 'owner:<account_id>', 'walker:<worker_id>', etc. Non-blank.
  transitioned_by             text         NOT NULL,

  -- Wall-clock stamp.
  transitioned_at             timestamptz  NOT NULL DEFAULT now(),

  -- ─────────────── CHECKs ────────────────────────────────────────

  CONSTRAINT ck_bcll_from_state CHECK (
    from_state IS NULL
    OR from_state IN (
      'DISCOVERED', 'ENRICHED', 'VERIFIED',
      'OWNER_CLAIMED', 'OWNER_VERIFIED', 'DORMANT', 'SUPERSEDED'
    )
  ),

  CONSTRAINT ck_bcll_to_state CHECK (to_state IN (
    'DISCOVERED', 'ENRICHED', 'VERIFIED',
    'OWNER_CLAIMED', 'OWNER_VERIFIED', 'DORMANT', 'SUPERSEDED'
  )),

  CONSTRAINT ck_bcll_transition_reason CHECK (transition_reason IN (
    'birth',
    'enrichment',
    'multi_source_verify',
    'admin_verify',
    'owner_claim',
    'owner_verify',
    'dormancy',
    'reactivation',
    'supersede'
  )),

  -- birth rows (from_state IS NULL) must have to_state = DISCOVERED
  -- and transition_reason = 'birth'. Non-birth rows must have
  -- from_state NOT NULL.
  CONSTRAINT ck_bcll_birth_consistency CHECK (
    (from_state IS NULL AND to_state = 'DISCOVERED' AND transition_reason = 'birth')
    OR
    (from_state IS NOT NULL AND transition_reason <> 'birth')
  ),

  -- supersede rows must carry a non-NULL superseded_by_business_id.
  -- Non-supersede rows must leave it NULL.
  CONSTRAINT ck_bcll_supersede_consistency CHECK (
    (to_state = 'SUPERSEDED' AND superseded_by_business_id IS NOT NULL)
    OR
    (to_state <> 'SUPERSEDED' AND superseded_by_business_id IS NULL)
  ),

  -- Non-blank actor identity.
  CONSTRAINT ck_bcll_transitioned_by_nonblank CHECK (
    length(trim(transitioned_by)) > 0
  ),

  -- Hash format when provided.
  CONSTRAINT ck_bcll_decision_record_fmt CHECK (
    decision_record_id IS NULL
    OR decision_record_id ~ '^[a-f0-9]{64}$'
  ),

  -- Guard against self-supersede (defence in depth; also enforced on
  -- business_canonical in migration 167).
  CONSTRAINT ck_bcll_supersede_not_self CHECK (
    superseded_by_business_id IS NULL
    OR superseded_by_business_id <> canonical_business_id
  ),

  -- ─────────────── FKs ──────────────────────────────────────────

  CONSTRAINT fk_bcll_canonical_business
    FOREIGN KEY (canonical_business_id)
    REFERENCES nex.business_canonical (canonical_business_id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_bcll_superseded_by
    FOREIGN KEY (superseded_by_business_id)
    REFERENCES nex.business_canonical (canonical_business_id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_bcll_attesting_evidence
    FOREIGN KEY (attesting_evidence_id)
    REFERENCES nex.business_evidence (evidence_id)
    ON DELETE RESTRICT
);

-- ─────────────── Indexes ──────────────────────────────────────

-- Primary audit read path: "what happened to THIS canonical?"
CREATE INDEX IF NOT EXISTS idx_bcll_canonical_business
  ON nex.business_canonical_lifecycle_log (canonical_business_id, transitioned_at DESC);

-- "which transitions came from this decision?" · correlates with
-- business_evidence.decision_record_id.
CREATE INDEX IF NOT EXISTS idx_bcll_decision_record
  ON nex.business_canonical_lifecycle_log (decision_record_id)
  WHERE decision_record_id IS NOT NULL;

-- "which canonicals transitioned on day X?" · supports lifecycle
-- observability dashboards.
CREATE INDEX IF NOT EXISTS idx_bcll_transitioned_at
  ON nex.business_canonical_lifecycle_log (transitioned_at DESC);

-- ─────────────── Documentation ──────────────────────────────────

COMMENT ON TABLE nex.business_canonical_lifecycle_log IS
  'Append-only audit of every lifecycle_state transition on nex.business_canonical. Written in the same transaction as the canonical UPDATE by the sealed canonical-handoff path. Append-only by convention; DP-3 adds INSERT-only privilege.';

COMMENT ON COLUMN nex.business_canonical_lifecycle_log.from_state IS
  'NULL on the row that records the initial transition into DISCOVERED (the row''s birth). Every other row has from_state matching migration 167''s 7-value lifecycle enum.';

COMMENT ON COLUMN nex.business_canonical_lifecycle_log.transition_reason IS
  'birth | enrichment | multi_source_verify | admin_verify | owner_claim | owner_verify | dormancy | reactivation | supersede. See CHECK ck_bcll_transition_reason.';

-- ═══════════════════════════════════════════════════════════════════
-- End of migration 168.
-- ═══════════════════════════════════════════════════════════════════
