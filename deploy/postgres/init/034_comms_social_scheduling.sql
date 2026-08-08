-- NEX Comms Centre · Social · Phase 4 · Scheduling + Workers + Pause
--
-- Charter §S-V (approval-default-ON with active-consent maintenance),
-- §S-VI (one-way publishing pipeline), §S-VII (two-phase publish +
-- idempotency), §S-VIII re-check at T-adapter-call (via the Phase 3
-- reCheckAtAdapterCall() hook · consumed by the worker built here).
--
-- Two new tables + one alter:
--   1. nex.social_category_automation   · per-tenant per-category ·
--      enabled Manual/Assisted/Automatic · last_check_in_at drives the
--      14-day active-consent auto-degrade rule
--   2. nex.social_scheduled_posts       · queued publish work · lease
--      pattern (owner + expires_at) · pause-aware · ties back to
--      draft + intent rows
--   3. alter nex.social_publish_intents · add worker_id · lease_owner ·
--      final_outcome for post-verify state
--
-- Zero changes to any v1.0 table or any Phase 0-3 existing column.

-- ── 1 · Category automation state ─────────────────────────────
CREATE TABLE IF NOT EXISTS nex.social_category_automation (
  tenant_id         UUID    NOT NULL REFERENCES nex.social_tenants(tenant_id) ON DELETE CASCADE,
  category          TEXT    NOT NULL CHECK (category IN (
                              'project','educational','inspiration','product','faq',
                              'before_after','testimonial','seasonal','company','offer')),
  mode              TEXT    NOT NULL DEFAULT 'manual' CHECK (mode IN ('manual','assisted','automatic')),
  enabled_by        TEXT,                                                     -- user_id who enabled
  enabled_at        TIMESTAMPTZ,
  last_check_in_at  TIMESTAMPTZ,                                              -- driven by merchant activity (approves post · toggles a control · dashboard visit)
  auto_degraded_at  TIMESTAMPTZ,                                              -- set when the 14-day rule flips automatic → assisted
  auto_degraded_reason TEXT,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, category)
);

-- ── 2 · Scheduled posts queue ─────────────────────────────────
--
-- One row per queued publish attempt. Workers acquire leases with
-- SELECT ... FOR UPDATE SKIP LOCKED and re-check pause + validator
-- re-check before dispatching.
CREATE TABLE IF NOT EXISTS nex.social_scheduled_posts (
  scheduled_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES nex.social_tenants(tenant_id) ON DELETE CASCADE,
  draft_id          UUID NOT NULL REFERENCES nex.social_content_drafts(draft_id) ON DELETE CASCADE,
  account_id        UUID NOT NULL REFERENCES nex.social_accounts(account_id) ON DELETE RESTRICT,
  platform          TEXT NOT NULL,
  run_at            TIMESTAMPTZ NOT NULL,                                     -- earliest time this may be dispatched
  attempts          INT  NOT NULL DEFAULT 0,
  max_attempts      INT  NOT NULL DEFAULT 3,
  status            TEXT NOT NULL DEFAULT 'queued' CHECK (status IN (
                       'queued',
                       'leased',
                       'dispatched',
                       'published',
                       'refused_at_recheck',
                       'failed',
                       'paused_at_lease',
                       'abandoned')),
  lease_owner       TEXT,
  lease_expires_at  TIMESTAMPTZ,
  intent_id         UUID REFERENCES nex.social_publish_intents(intent_id) ON DELETE SET NULL,
  last_error        TEXT,
  refused_reasons   JSONB,                                                    -- populated when refused_at_recheck
  enqueued_by       TEXT NOT NULL,
  enqueued_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS social_scheduled_posts_ready_idx
  ON nex.social_scheduled_posts (run_at)
  WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS social_scheduled_posts_tenant_status_idx
  ON nex.social_scheduled_posts (tenant_id, status, run_at);

-- ── 3 · Publish intent addenda ────────────────────────────────
ALTER TABLE nex.social_publish_intents
  ADD COLUMN IF NOT EXISTS scheduled_id   UUID REFERENCES nex.social_scheduled_posts(scheduled_id),
  ADD COLUMN IF NOT EXISTS worker_id      TEXT,
  ADD COLUMN IF NOT EXISTS final_outcome  TEXT CHECK (final_outcome IN ('verified_published','verified_no_op','failed','abandoned') OR final_outcome IS NULL);

-- ── 4 · RLS on new tables + policy for the alter ──────────────
ALTER TABLE nex.social_category_automation   ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.social_category_automation   FORCE  ROW LEVEL SECURITY;
ALTER TABLE nex.social_scheduled_posts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.social_scheduled_posts       FORCE  ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['social_category_automation','social_scheduled_posts']) LOOP
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
GRANT SELECT, INSERT, UPDATE, DELETE ON
  nex.social_category_automation,
  nex.social_scheduled_posts
  TO nex_social_app;

COMMENT ON TABLE nex.social_category_automation IS
  'Charter §S-V per-category opt-in · 14-day active-consent auto-degrade lives on this row';
COMMENT ON TABLE nex.social_scheduled_posts IS
  'Charter §S-VI one-way pipeline · lease pattern · re-check pause on acquisition · Phase 4 worker consumes';
