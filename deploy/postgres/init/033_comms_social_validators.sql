-- NEX Comms Centre · Social · Phase 3 · Safety Validator Pipeline
--
-- Charter §S-VIII: Fact → Rights → Policy → Brand → Platform. Rights
-- and Policy re-verify at T-adapter-call (worker-side · Phase 4 hooks
-- into functions built here). Fail-closed on every stage — timeout,
-- error, ambiguity all route to Manual.
--
-- Three schema changes:
--   1. nex.social_brand_profiles     · per-tenant brand configuration
--      (tone whitelist supplement · forbidden terms · required hashtags
--       · required disclaimers)
--   2. nex.social_validator_runs      · one row per pipeline execution ·
--      per-stage outcome JSONB · timing · fail-closed markers
--   3. alter nex.social_content_drafts · add validator_run_id (latest run)
--
-- Zero changes to v1.0 tables. Zero changes to Phase 0-2 tables beyond
-- the drafts column addition.

-- ── 1 · Brand profiles ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nex.social_brand_profiles (
  tenant_id                UUID PRIMARY KEY REFERENCES nex.social_tenants(tenant_id) ON DELETE CASCADE,
  tone                     TEXT NOT NULL DEFAULT 'friendly' CHECK (tone IN (
                             'professional','friendly','premium','traditional',
                             'modern','technical','local')),
  additional_whitelist     TEXT[] NOT NULL DEFAULT '{}',                      -- per-tenant additions to the green descriptor whitelist
  forbidden_terms          TEXT[] NOT NULL DEFAULT '{}',                      -- merchant-authored "never use these words"
  required_hashtags        TEXT[] NOT NULL DEFAULT '{}',                      -- if any post-kind requires certain hashtags
  required_disclaimers     JSONB NOT NULL DEFAULT '[]'::jsonb,                -- [{applies_to_kind, text}]
  preferred_cta_defaults   JSONB NOT NULL DEFAULT '{}'::jsonb,                -- {kind: "Contact {{name}}"}
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2 · Validator runs ────────────────────────────────────────
--
-- One row per full pipeline execution. Stages array captures ordered
-- results. `outcome` is the terminal state: passed | rejected | failed_closed.
-- `failed_closed` distinguishes "post rejected on merit" from "we
-- couldn't determine an answer" (both route to Manual; distinct for
-- audit).
CREATE TABLE IF NOT EXISTS nex.social_validator_runs (
  run_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES nex.social_tenants(tenant_id) ON DELETE CASCADE,
  draft_id          UUID REFERENCES nex.social_content_drafts(draft_id) ON DELETE SET NULL,
  subject           TEXT NOT NULL CHECK (subject IN ('draft','ad_hoc','at_adapter_call')),
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ,
  total_ms          INT,
  stages            JSONB NOT NULL DEFAULT '[]'::jsonb,                       -- [{name, outcome, ms, detail?, rejections?, failed_closed_reason?}]
  outcome           TEXT NOT NULL DEFAULT 'pending' CHECK (outcome IN ('pending','passed','rejected','failed_closed')),
  rejection_summary JSONB NOT NULL DEFAULT '[]'::jsonb                        -- flattened rejections across stages
);
CREATE INDEX IF NOT EXISTS social_validator_runs_tenant_time_idx
  ON nex.social_validator_runs (tenant_id, started_at DESC);
CREATE INDEX IF NOT EXISTS social_validator_runs_draft_idx
  ON nex.social_validator_runs (draft_id) WHERE draft_id IS NOT NULL;

-- INSERT-only audit shape: revoke UPDATE/DELETE from PUBLIC.
-- (`completed_at`, `stages`, `outcome`, `rejection_summary` are set at
--  INSERT time in a single row — the pipeline builds the final row
--  in memory then INSERTs once. There is no "partial run" record.)
REVOKE UPDATE, DELETE ON nex.social_validator_runs FROM PUBLIC;

-- ── 3 · Drafts get a latest-run pointer ──────────────────────
ALTER TABLE nex.social_content_drafts
  ADD COLUMN IF NOT EXISTS validator_run_id UUID REFERENCES nex.social_validator_runs(run_id);
CREATE INDEX IF NOT EXISTS social_content_drafts_validator_run_idx
  ON nex.social_content_drafts (validator_run_id) WHERE validator_run_id IS NOT NULL;

-- ── 4 · RLS on new tables ────────────────────────────────────
ALTER TABLE nex.social_brand_profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.social_brand_profiles  FORCE  ROW LEVEL SECURITY;
ALTER TABLE nex.social_validator_runs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.social_validator_runs  FORCE  ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['social_brand_profiles','social_validator_runs']) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_tenant_select ON nex.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_tenant_select ON nex.%I FOR SELECT USING ((tenant_id = nex._current_social_tenant()) OR nex._admin_bypass_active())',
      t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_tenant_insert ON nex.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_tenant_insert ON nex.%I FOR INSERT WITH CHECK (tenant_id = nex._current_social_tenant())',
      t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_tenant_update ON nex.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_tenant_update ON nex.%I FOR UPDATE USING (tenant_id = nex._current_social_tenant()) WITH CHECK (tenant_id = nex._current_social_tenant())',
      t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_tenant_delete ON nex.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_tenant_delete ON nex.%I FOR DELETE USING (tenant_id = nex._current_social_tenant())',
      t, t);
  END LOOP;
END $$;

-- ── 5 · Grants ────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON nex.social_brand_profiles  TO nex_social_app;
GRANT SELECT, INSERT              ON nex.social_validator_runs  TO nex_social_app;

COMMENT ON TABLE nex.social_brand_profiles IS
  'Charter §S-VIII Brand stage · per-tenant brand configuration · forbidden terms, required tags, tone whitelist supplement';
COMMENT ON TABLE nex.social_validator_runs IS
  'Charter §S-VIII pipeline audit · one row per run · INSERT-only · stages JSONB captures ordered per-stage outcomes';
