-- 077_nex_food_business_promotion_decision.sql
--
-- Task #88 · Phase 3 · Promotion queue admin decision table · 2026-08-22
--
-- Doctrine anchors:
--   project_nex_task88_promotion_pipeline_spec_2026_08_22
--   project_nex_task88_phase2_shipped_2026_08_22
--   project_nex_walker_dev_frozen_2026_08_22
--   project_nex_architecture_replaceable_plumbing_and_provable_causality_2026_08_22
--   project_nex_dashboard_singularity_constitutional_rule_2026_08_22
--
-- Philip 2026-08-22 Phase 3 lock (verbatim):
--   · "Evidence is never automatically promoted."
--   · "Approve must be field-specific."
--   · "A rejected candidate should be recorded as admin_rejected."
--   · "Never silently overwrite an existing fact."
--   · "Every admin action gets provenance ... cycle_run_id."
--
-- Creates ONE table:
--   nex.food_business_promotion_decision · one row per (evidence_id, decision)
--   append-only for audit trail · new decision on same evidence row means older
--   row remains (denormalized) but latest is authoritative per query.
--
-- Reject churn prevention: the promotion queue view filters evidence rows whose
-- (business_ref, field_name, value_normalised) has been rejected. Future
-- enrichment agents can INSERT evidence but the queue won't re-present it.
--
-- Reversible:
--   BEGIN;
--     DROP TABLE IF EXISTS nex.food_business_promotion_decision;
--   COMMIT;

BEGIN;

CREATE TABLE IF NOT EXISTS nex.food_business_promotion_decision (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id       UUID NOT NULL REFERENCES nex.food_enrichment_evidence(evidence_id) ON DELETE CASCADE,
  business_ref      TEXT NOT NULL REFERENCES nex.food_business(public_listing_ref) ON DELETE CASCADE,

  -- Denormalized for cheap "was this value rejected" lookups without JOIN.
  -- Kept in sync at INSERT time from the referenced evidence row · never updated.
  field_name        TEXT NOT NULL,
  value             TEXT,
  value_normalised  TEXT,

  -- Admin decision.
  -- 'approved'  · admin adopted the value into food_business.<field> (writes provenance admin_verified)
  -- 'rejected'  · admin permanently rejected · queue suppresses future evidence with same value
  -- 'replaced'  · admin explicitly overwrote an existing food_business.<field> value (rare · logged loudly)
  decision          TEXT NOT NULL CHECK (decision IN ('approved','rejected','replaced')),

  -- Admin identifier · defaults to 'admin:promotion-queue' when not supplied.
  decided_by        TEXT NOT NULL DEFAULT 'admin:promotion-queue',
  decided_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Direct-Provenance A · every admin action registers a worker_cycle_run with
  -- worker_type='promotion', worker_config='food:Yogyakarta:admin-decision'.
  cycle_run_id      UUID NOT NULL REFERENCES nex.worker_cycle_run(id),

  -- Free-text reason from admin (optional · surfaces in audit / journal).
  reason            TEXT,

  -- If decision='approved' or 'replaced', the value from before the write.
  -- Kept so the audit trail is SQL-reversible without needing to consult logs.
  previous_field_value TEXT
);

CREATE INDEX IF NOT EXISTS idx_promotion_decision_business_field_decided
  ON nex.food_business_promotion_decision (business_ref, field_name, decided_at DESC);

-- Fast "has this value been rejected for this (biz, field)?" lookup that the
-- promotion queue view uses to suppress re-suggestion by future enrichment.
CREATE INDEX IF NOT EXISTS idx_promotion_decision_rejected_lookup
  ON nex.food_business_promotion_decision (business_ref, field_name, value_normalised)
  WHERE decision = 'rejected';

CREATE INDEX IF NOT EXISTS idx_promotion_decision_evidence
  ON nex.food_business_promotion_decision (evidence_id);

CREATE INDEX IF NOT EXISTS idx_promotion_decision_cycle
  ON nex.food_business_promotion_decision (cycle_run_id);

COMMENT ON TABLE nex.food_business_promotion_decision IS
  'Task #88 Phase 3 · append-only admin adjudication of food_enrichment_evidence rows. Each row records an approve/reject/replace decision + the cycle_run_id (Direct-Provenance A) of the admin action. Rejected (biz,field,value) tuples are suppressed from the promotion queue view so future enrichment agents cannot re-present a rejected candidate.';
COMMENT ON COLUMN nex.food_business_promotion_decision.decision IS 'approved (accepted the value · writes to food_business.<field>) · rejected (permanent · queue suppresses future re-suggestion) · replaced (explicit overwrite of existing food_business.<field> value).';
COMMENT ON COLUMN nex.food_business_promotion_decision.previous_field_value IS 'Value of food_business.<field> immediately before the admin action · enables SQL-reversibility from the row alone.';
COMMENT ON COLUMN nex.food_business_promotion_decision.cycle_run_id IS 'Direct-Provenance A · every admin action registers a worker_cycle_run row (worker_type=promotion · worker_config=food:Yogyakarta:admin-decision) so provenance chain matches Walker / quality-check pattern.';

-- Sanity check
DO $$
DECLARE tbl BOOLEAN; idx1 BOOLEAN; idx2 BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM information_schema.tables
    WHERE table_schema='nex' AND table_name='food_business_promotion_decision') INTO tbl;
  SELECT EXISTS(SELECT 1 FROM pg_indexes
    WHERE schemaname='nex' AND indexname='idx_promotion_decision_business_field_decided') INTO idx1;
  SELECT EXISTS(SELECT 1 FROM pg_indexes
    WHERE schemaname='nex' AND indexname='idx_promotion_decision_rejected_lookup') INTO idx2;
  IF NOT tbl  THEN RAISE EXCEPTION 'Migration 077 failed: table not created'; END IF;
  IF NOT idx1 THEN RAISE EXCEPTION 'Migration 077 failed: primary index missing'; END IF;
  IF NOT idx2 THEN RAISE EXCEPTION 'Migration 077 failed: rejection-lookup index missing'; END IF;
  RAISE NOTICE 'Migration 077 complete: food_business_promotion_decision table + 4 indexes';
END $$;

COMMIT;
