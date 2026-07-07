-- Job Diary — App #003.
--
-- Every quote.accepted auto-opens a job. The merchant + team log
-- check-ins, photos, notes, and milestones. Homeowner sees progress
-- updates on their /home page. Sign-off flips the project to
-- signed_off, registers warranties, and fires the review request.
--
-- Storage: app_job_diary_* per the OS constitution (nothing leaks).

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Jobs — one per accepted project
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_job_diary_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UNIQUE REFERENCES os_projects(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES os_properties(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL,             -- hammerex_trade_off_listings.id
  quote_id uuid REFERENCES app_quote_workspace_quotes(id) ON DELETE SET NULL,
  homeowner_id uuid REFERENCES app_ai_visualiser_homeowners(id) ON DELETE SET NULL,
  homeowner_party_id uuid REFERENCES os_parties(id) ON DELETE SET NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN (
    'open','in_progress','snagging','signed_off','closed','abandoned'
  )),
  scheduled_start_date date,
  scheduled_end_date date,
  actual_start_date date,
  actual_end_date date,
  progress_percent integer NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  homeowner_visible boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_job_diary_jobs_merchant_idx
  ON app_job_diary_jobs (merchant_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS app_job_diary_jobs_property_idx
  ON app_job_diary_jobs (property_id, created_at DESC);

-- ---------------------------------------------------------------------
-- 2. Entries — daily log of everything that happens on the job
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_job_diary_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES app_job_diary_jobs(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN (
    'check_in','photo','note','milestone','snag','material_arrived','delay'
  )),
  headline text NOT NULL,
  body text,
  media_urls text[] NOT NULL DEFAULT '{}',
  author_party_id uuid REFERENCES os_parties(id),
  author_business_listing_id uuid,
  author_display_name text,
  location_lat numeric(9,6),
  location_lng numeric(9,6),
  homeowner_visible boolean NOT NULL DEFAULT true,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_job_diary_entries_job_idx
  ON app_job_diary_entries (job_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS app_job_diary_entries_kind_idx
  ON app_job_diary_entries (job_id, kind);

-- ---------------------------------------------------------------------
-- 3. Team members — who's assigned to this job
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_job_diary_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES app_job_diary_jobs(id) ON DELETE CASCADE,
  party_id uuid REFERENCES os_parties(id),
  display_name text NOT NULL,
  role text NOT NULL DEFAULT 'installer',
  added_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_job_diary_team_members_job_idx
  ON app_job_diary_team_members (job_id);
CREATE UNIQUE INDEX IF NOT EXISTS app_job_diary_team_members_uk
  ON app_job_diary_team_members (job_id, party_id) WHERE party_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- 4. Sign-offs — the final chapter
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_job_diary_signoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL UNIQUE REFERENCES app_job_diary_jobs(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL,
  homeowner_party_id uuid REFERENCES os_parties(id),
  customer_signature_name text,
  customer_signature_captured_at timestamptz,
  merchant_signature_name text,
  merchant_signature_captured_at timestamptz,
  warranties_registered_count integer NOT NULL DEFAULT 0,
  review_requested_at timestamptz,
  photos text[] NOT NULL DEFAULT '{}',    -- final finished photos
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Touch triggers
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION job_diary_touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS app_job_diary_jobs_touch ON app_job_diary_jobs;
CREATE TRIGGER app_job_diary_jobs_touch
  BEFORE UPDATE ON app_job_diary_jobs
  FOR EACH ROW
  EXECUTE FUNCTION job_diary_touch_updated_at();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
ALTER TABLE app_job_diary_jobs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_job_diary_entries        ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_job_diary_team_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_job_diary_signoffs       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_job_diary_jobs_merchant ON app_job_diary_jobs;
CREATE POLICY app_job_diary_jobs_merchant
  ON app_job_diary_jobs
  FOR ALL
  USING (merchant_id = auth.uid())
  WITH CHECK (merchant_id = auth.uid());

DROP POLICY IF EXISTS app_job_diary_entries_via_job ON app_job_diary_entries;
CREATE POLICY app_job_diary_entries_via_job
  ON app_job_diary_entries
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM app_job_diary_jobs j
      WHERE j.id = job_id AND j.merchant_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_job_diary_jobs j
      WHERE j.id = job_id AND j.merchant_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS app_job_diary_team_via_job ON app_job_diary_team_members;
CREATE POLICY app_job_diary_team_via_job
  ON app_job_diary_team_members
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM app_job_diary_jobs j
      WHERE j.id = job_id AND j.merchant_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_job_diary_jobs j
      WHERE j.id = job_id AND j.merchant_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS app_job_diary_signoffs_via_job ON app_job_diary_signoffs;
CREATE POLICY app_job_diary_signoffs_via_job
  ON app_job_diary_signoffs
  FOR ALL
  USING (merchant_id = auth.uid())
  WITH CHECK (merchant_id = auth.uid());

COMMIT;
