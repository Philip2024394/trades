-- G2 · Publications + channel connections + Gold Path + Signals.
--
-- Four new tables that turn events into cross-channel outputs, guide
-- the merchant weekly, and close the loop with engagement data.

BEGIN;

-- =========================================================================
-- merchant_channel_connections — OAuth tokens per merchant per platform
-- =========================================================================
CREATE TABLE IF NOT EXISTS merchant_channel_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL,
  channel text NOT NULL,
    -- 'instagram' | 'facebook' | 'gbp' | 'linkedin' | 'tiktok' | 'pinterest' | 'x'
  external_account_id text NOT NULL,
  display_name text,
  access_token text,          -- encrypted at rest via Supabase; NULL for stub
  refresh_token text,
  expires_at timestamptz,
  scopes text[],
  status text NOT NULL DEFAULT 'active',
  connected_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  CHECK (status IN ('active', 'expired', 'revoked'))
);

CREATE UNIQUE INDEX IF NOT EXISTS mcc_merchant_channel_unique
  ON merchant_channel_connections (merchant_id, channel, external_account_id);
CREATE INDEX IF NOT EXISTS mcc_merchant_active_idx
  ON merchant_channel_connections (merchant_id, channel)
  WHERE status = 'active';

-- =========================================================================
-- publications — one row per (event, channel) instance
-- =========================================================================
CREATE TABLE IF NOT EXISTS publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL,
  event_id uuid NOT NULL REFERENCES business_events(id) ON DELETE CASCADE,
  channel text NOT NULL,
    -- 'instagram' | 'facebook' | 'gbp' | 'linkedin' | 'tiktok' | 'website_feed' | ...
  connection_id uuid REFERENCES merchant_channel_connections(id) ON DELETE SET NULL,
  -- Channel-specific rendered content (caption, hashtags, images, cta).
  rendered_content jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Approval-buffer aware: publications are scheduled_for = 60min out
  -- by default. Merchant can hold before that time.
  status text NOT NULL DEFAULT 'scheduled',
  hold_reason text,
  scheduled_for timestamptz NOT NULL DEFAULT (now() + interval '60 minutes'),
  posted_at timestamptz,
  external_id text,        -- the platform's post id (for later edits/deletes)
  external_permalink text,
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status IN ('scheduled', 'posted', 'held', 'failed', 'archived'))
);

CREATE UNIQUE INDEX IF NOT EXISTS publications_event_channel_unique
  ON publications (event_id, channel);
CREATE INDEX IF NOT EXISTS publications_scheduled_idx
  ON publications (merchant_id, scheduled_for)
  WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS publications_posted_idx
  ON publications (merchant_id, channel, posted_at DESC)
  WHERE status = 'posted';

CREATE OR REPLACE FUNCTION publications_touch_updated()
  RETURNS trigger AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS publications_touch_updated ON publications;
CREATE TRIGGER publications_touch_updated
  BEFORE UPDATE ON publications
  FOR EACH ROW EXECUTE FUNCTION publications_touch_updated();

-- =========================================================================
-- gold_path_tasks — the weekly operating guide backing table
-- =========================================================================
CREATE TABLE IF NOT EXISTS gold_path_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL,
  task_kind text NOT NULL,
    -- 'reply_to_review' | 'complete_story_arc' | 'record_work' |
    -- 'chase_consent' | 'reconnect_channel' | 'reply_lead' | ...
  title text NOT NULL,
  body_markdown text,
  cta_kind text,           -- 'open_capture' | 'open_review' | 'open_settings' | ...
  cta_target text,
  urgency text NOT NULL DEFAULT 'normal',
  -- Which event triggered this task, if any. NULL for periodic tasks
  -- like "you haven't posted for 8 days" that come from a scheduled
  -- audit rather than a specific event.
  source_event_id uuid REFERENCES business_events(id) ON DELETE SET NULL,
  source_projection_type text,
  status text NOT NULL DEFAULT 'open',
    -- 'open' | 'in_progress' | 'done' | 'dismissed' | 'expired'
  opens_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  done_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (urgency IN ('low', 'normal', 'high', 'urgent')),
  CHECK (status IN ('open', 'in_progress', 'done', 'dismissed', 'expired'))
);

-- Dedupe — same task_kind triggered by the same event = one row.
CREATE UNIQUE INDEX IF NOT EXISTS gold_path_tasks_source_kind_unique
  ON gold_path_tasks (source_event_id, task_kind)
  WHERE source_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS gold_path_tasks_merchant_open_idx
  ON gold_path_tasks (merchant_id, status, opens_at DESC)
  WHERE status IN ('open', 'in_progress');

CREATE OR REPLACE FUNCTION gold_path_tasks_touch_updated()
  RETURNS trigger AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS gold_path_tasks_touch_updated ON gold_path_tasks;
CREATE TRIGGER gold_path_tasks_touch_updated
  BEFORE UPDATE ON gold_path_tasks
  FOR EACH ROW EXECUTE FUNCTION gold_path_tasks_touch_updated();

-- =========================================================================
-- signals — engagement + conversion data closing the learning loop
-- =========================================================================
CREATE TABLE IF NOT EXISTS signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL,
  publication_id uuid REFERENCES publications(id) ON DELETE SET NULL,
  event_id uuid REFERENCES business_events(id) ON DELETE SET NULL,
  signal_type text NOT NULL,
    -- 'like' | 'comment' | 'save' | 'share' | 'click_through' |
    -- 'view' | 'lead_form_submit' | 'call' | 'whatsapp_tap' | 'booking'
  observed_at timestamptz NOT NULL DEFAULT now(),
  value numeric,           -- likes count / lead value pence / etc.
  source text,             -- 'instagram_webhook' | 'gsc' | 'gbp_insights' | 'plausible' | ...
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS signals_pub_lookup_idx
  ON signals (publication_id, signal_type, observed_at DESC);
CREATE INDEX IF NOT EXISTS signals_event_lookup_idx
  ON signals (event_id, signal_type, observed_at DESC);
CREATE INDEX IF NOT EXISTS signals_merchant_type_idx
  ON signals (merchant_id, signal_type, observed_at DESC);

-- =========================================================================
-- RLS
-- =========================================================================
ALTER TABLE merchant_channel_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE gold_path_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mcc_owner_all ON merchant_channel_connections;
CREATE POLICY mcc_owner_all ON merchant_channel_connections
  FOR ALL USING (merchant_id = auth.uid())
  WITH CHECK (merchant_id = auth.uid());

DROP POLICY IF EXISTS publications_public_read_posted ON publications;
CREATE POLICY publications_public_read_posted ON publications
  FOR SELECT USING (status = 'posted');

DROP POLICY IF EXISTS publications_owner_all ON publications;
CREATE POLICY publications_owner_all ON publications
  FOR ALL USING (merchant_id = auth.uid())
  WITH CHECK (merchant_id = auth.uid());

DROP POLICY IF EXISTS gold_path_tasks_owner ON gold_path_tasks;
CREATE POLICY gold_path_tasks_owner ON gold_path_tasks
  FOR ALL USING (merchant_id = auth.uid())
  WITH CHECK (merchant_id = auth.uid());

DROP POLICY IF EXISTS signals_owner_r ON signals;
CREATE POLICY signals_owner_r ON signals
  FOR SELECT USING (merchant_id = auth.uid());

DROP POLICY IF EXISTS all_service_role ON merchant_channel_connections;
CREATE POLICY all_service_role ON merchant_channel_connections
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
DROP POLICY IF EXISTS all_service_role ON publications;
CREATE POLICY all_service_role ON publications
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
DROP POLICY IF EXISTS all_service_role ON gold_path_tasks;
CREATE POLICY all_service_role ON gold_path_tasks
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
DROP POLICY IF EXISTS all_service_role ON signals;
CREATE POLICY all_service_role ON signals
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

COMMIT;
