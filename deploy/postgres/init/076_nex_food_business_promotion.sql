-- 076_nex_food_business_promotion.sql
--
-- Task #88 · Phase 1 · Discovery → Directory Promotion Pipeline · 2026-08-22
--
-- Doctrine anchors:
--   project_nex_task88_promotion_pipeline_spec_2026_08_22
--   project_nex_task88_phase0_inventory_2026_08_22
--   project_nex_walker_dev_frozen_2026_08_22
--   project_nex_walker_stays_pure_acquisition_2026_08_22
--   project_nex_architecture_replaceable_plumbing_and_provable_causality_2026_08_22
--   project_nex_dashboard_singularity_constitutional_rule_2026_08_22
--
-- Constitutional binding (Philip 2026-08-22 verbatim · Task #88 Phase 1 greenlight):
--   Q1  · "Use a separate food_business_promotion side table. Keep food_business
--         as the canonical discovery/business record. The promotion lifecycle
--         belongs in its own state machine with full provenance and auditability."
--   Q2  · "Score-based quality checking. Do NOT require a contact channel for
--         a business to enter the queue. Every discovered business should remain
--         visible to the admin pipeline. The score determines priority/readiness,
--         not automatic promotion."
--
-- What this migration creates:
--   1. nex.food_business_promotion       · current-state upsert · one row per business_ref
--   2. nex.food_business_promotion_audit · append-only log of state advances
--
-- What this migration does NOT do:
--   · Does NOT modify nex.food_business (canonical discovery record preserved)
--   · Does NOT modify claim_status CHECK values (all 6 pipeline states already there)
--   · Does NOT modify Walker, CLE, RAG, provenance, HQ pages, /food customer view
--   · Does NOT auto-promote anything (state advance to `listed` requires admin action · future Phase 3)
--
-- Reversible:
--   BEGIN;
--     DROP TABLE IF EXISTS nex.food_business_promotion_audit;
--     DROP TABLE IF EXISTS nex.food_business_promotion;
--   COMMIT;

BEGIN;

-- ── 1. Current-state table · one row per business_ref (upsert on cycle) ──
CREATE TABLE IF NOT EXISTS nex.food_business_promotion (
  business_ref     TEXT PRIMARY KEY REFERENCES nex.food_business(public_listing_ref) ON DELETE CASCADE,

  -- Task #88 Phase 1 state machine.
  -- Phase 1 only writes: quality_pending · ready_for_promotion · needs_enrichment · poor_evidence.
  -- Later phases will write: admin_reviewed (Phase 3) · owner_invited (Phase 4) · archived (any phase).
  -- Every value here is Phase 1-safe · nothing downstream of ready_for_promotion is triggered by this worker.
  current_state    TEXT NOT NULL DEFAULT 'quality_pending'
                     CHECK (current_state IN (
                       'quality_pending',      -- newly-inserted row · not yet scored
                       'ready_for_promotion',  -- score >= HIGH threshold (default 70)  🟢
                       'needs_enrichment',     -- score in MID band     (default 40-69) 🟡
                       'poor_evidence',        -- score <  LOW threshold (default 40)   🔴
                       'admin_reviewed',       -- reserved · Phase 3 · admin approved for promotion
                       'owner_invited',        -- reserved · Phase 4 · outreach fired
                       'archived'              -- reserved · dead/dupe/rejected · out of pipeline
                     )),

  quality_score    INTEGER CHECK (quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 100)),

  -- Full per-criterion breakdown · admin queue reads this for UI hints.
  -- Shape: { name:15, coord:20, category:10, address:10, contact:15, web:10, secondary:5, freshness:10, total:95 }
  score_breakdown  JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Timestamps.
  evaluated_at     TIMESTAMPTZ,               -- last time the worker scored this row
  entered_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Direct-Provenance A · Task #74 pattern.
  -- Every state advance is written by a worker_cycle_run · this FK proves causality.
  -- ON DELETE SET NULL so a cycle_run cleanup doesn't cascade-drop a promotion row.
  cycle_run_id     UUID REFERENCES nex.worker_cycle_run(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_food_business_promotion_state
  ON nex.food_business_promotion (current_state);

CREATE INDEX IF NOT EXISTS idx_food_business_promotion_score
  ON nex.food_business_promotion (quality_score DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_food_business_promotion_cycle_run
  ON nex.food_business_promotion (cycle_run_id) WHERE cycle_run_id IS NOT NULL;

COMMENT ON TABLE  nex.food_business_promotion IS
  'Task #88 Phase 1 · Promotion lifecycle for discovered food businesses. Side table (not columns on food_business) so promotion state machine can iterate without touching the canonical discovery record. One row per business_ref. Every write comes from a worker_cycle_run (cycle_run_id FK · Direct-Provenance A). Never auto-advances to listed · admin/owner gate mandatory.';
COMMENT ON COLUMN nex.food_business_promotion.current_state    IS 'Phase 1 writes quality_pending / ready_for_promotion / needs_enrichment / poor_evidence. Later phases write admin_reviewed (Phase 3) / owner_invited (Phase 4) / archived. No value advances to nex.food_business.claim_status without explicit admin/owner action.';
COMMENT ON COLUMN nex.food_business_promotion.quality_score    IS 'Integer 0-100. Weighted sum of per-criterion scores (see score_breakdown). Score determines READINESS, never automatic promotion.';
COMMENT ON COLUMN nex.food_business_promotion.score_breakdown  IS 'JSONB · per-criterion points earned. Keys match the pure scoring function in scripts/nex-promotion/quality-score.mjs.';
COMMENT ON COLUMN nex.food_business_promotion.cycle_run_id     IS 'Direct-Provenance A · which worker_cycle_run last wrote this row. Enables the six-criteria evaluator to JOIN on causal FK rather than time-window intersect.';

-- ── 2. Audit table · append-only · one row per meaningful state/score change ──
CREATE TABLE IF NOT EXISTS nex.food_business_promotion_audit (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_ref   TEXT NOT NULL REFERENCES nex.food_business(public_listing_ref) ON DELETE CASCADE,

  from_state     TEXT,          -- NULL on the first evaluation for a business
  to_state       TEXT NOT NULL,
  score_before   INTEGER,       -- NULL on first evaluation
  score_after    INTEGER,

  cycle_run_id   UUID NOT NULL REFERENCES nex.worker_cycle_run(id) ON DELETE CASCADE,
  reason         TEXT NOT NULL, -- e.g. 'initial evaluation' · 'state change: needs_enrichment → ready_for_promotion' · 'material score shift'

  written_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_food_business_promotion_audit_biz_written
  ON nex.food_business_promotion_audit (business_ref, written_at DESC);

CREATE INDEX IF NOT EXISTS idx_food_business_promotion_audit_cycle
  ON nex.food_business_promotion_audit (cycle_run_id);

COMMENT ON TABLE nex.food_business_promotion_audit IS
  'Task #88 Phase 1 · append-only log of every state/score change on food_business_promotion. Every row FK-linked to the worker_cycle_run that wrote it (Direct-Provenance A). Read by future admin queue UI + HQ funnel API for audit trail.';

-- ── Sanity check ─────────────────────────────────────────────────────
DO $$
DECLARE tbl_state BOOLEAN; tbl_audit BOOLEAN; idx_state BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM information_schema.tables
    WHERE table_schema='nex' AND table_name='food_business_promotion') INTO tbl_state;
  SELECT EXISTS(SELECT 1 FROM information_schema.tables
    WHERE table_schema='nex' AND table_name='food_business_promotion_audit') INTO tbl_audit;
  SELECT EXISTS(SELECT 1 FROM pg_indexes
    WHERE schemaname='nex' AND indexname='idx_food_business_promotion_state') INTO idx_state;
  IF NOT tbl_state THEN RAISE EXCEPTION 'Migration 076 failed: food_business_promotion table not created'; END IF;
  IF NOT tbl_audit THEN RAISE EXCEPTION 'Migration 076 failed: food_business_promotion_audit table not created'; END IF;
  IF NOT idx_state THEN RAISE EXCEPTION 'Migration 076 failed: idx_food_business_promotion_state not created'; END IF;
  RAISE NOTICE 'Migration 076 complete: promotion state table + audit table + indexes in place';
END $$;

COMMIT;
