-- Reviews — App #004.
--
-- Consumes review.requested (fired by Job Diary sign-off), sends the
-- homeowner a signed link, collects a review, publishes review.posted.
--
-- Verification model:
--   • verified=true when the review is tied to a completed sign-off
--     for that (merchant, homeowner). Everything from Job Diary is
--     auto-verified.
--   • unverified reviews reserved for future manual claim import.
--
-- Nothing here duplicates hammerex_xrated_reviews (legacy). This is
-- the OS-native table that binds to Property → Project → Job → Merchant
-- and lives on the Home Timeline.

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Review requests — one per sign-off; tokenised, non-guessable
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_reviews_review_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL UNIQUE REFERENCES app_job_diary_jobs(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES os_projects(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES os_properties(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL,
  homeowner_party_id uuid REFERENCES os_parties(id) ON DELETE SET NULL,
  homeowner_id uuid REFERENCES app_ai_visualiser_homeowners(id) ON DELETE SET NULL,
  share_token text NOT NULL UNIQUE,          -- for /review/[token]
  status text NOT NULL DEFAULT 'queued' CHECK (status IN (
    'queued','sent','opened','completed','declined','expired'
  )),
  sent_at timestamptz,
  opened_at timestamptz,
  completed_at timestamptz,
  reminder_count integer NOT NULL DEFAULT 0,
  last_reminder_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_reviews_review_requests_merchant_idx
  ON app_reviews_review_requests (merchant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS app_reviews_review_requests_expiry_idx
  ON app_reviews_review_requests (expires_at) WHERE status IN ('sent','opened');

-- ---------------------------------------------------------------------
-- 2. Reviews — the actual public content
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_reviews_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES app_reviews_review_requests(id) ON DELETE SET NULL,
  merchant_id uuid NOT NULL,
  project_id uuid REFERENCES os_projects(id) ON DELETE SET NULL,
  property_id uuid REFERENCES os_properties(id) ON DELETE SET NULL,
  job_id uuid REFERENCES app_job_diary_jobs(id) ON DELETE SET NULL,
  homeowner_party_id uuid REFERENCES os_parties(id) ON DELETE SET NULL,
  reviewer_display_name text NOT NULL,       -- e.g. "Sarah in Nottingham"
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  headline text NOT NULL,
  body text NOT NULL,
  media_urls text[] NOT NULL DEFAULT '{}',
  verified boolean NOT NULL DEFAULT true,    -- true when derived from sign-off
  verified_reason text,                       -- e.g. 'job_sign_off', 'warranty_bind', 'manual_admin'
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN (
    'public','hidden','pending_moderation','disputed_pending'
  )),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_reviews_reviews_merchant_public_idx
  ON app_reviews_reviews (merchant_id, created_at DESC)
  WHERE visibility = 'public';
CREATE INDEX IF NOT EXISTS app_reviews_reviews_project_idx
  ON app_reviews_reviews (project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS app_reviews_reviews_verified_idx
  ON app_reviews_reviews (merchant_id, verified)
  WHERE visibility = 'public';

-- ---------------------------------------------------------------------
-- 3. Merchant responses — one per review, public reply
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_reviews_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL UNIQUE REFERENCES app_reviews_reviews(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL,
  body text NOT NULL,
  responder_display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_reviews_responses_merchant_idx
  ON app_reviews_responses (merchant_id, created_at DESC);

-- ---------------------------------------------------------------------
-- 4. Disputes — merchant flags a review; admin adjudicates
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_reviews_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES app_reviews_reviews(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL,
  reason text NOT NULL,
  evidence_urls text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'open' CHECK (status IN (
    'open','upheld','rejected','withdrawn'
  )),
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS app_reviews_disputes_status_idx
  ON app_reviews_disputes (status, created_at DESC);

-- ---------------------------------------------------------------------
-- Touch triggers
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION reviews_touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'app_reviews_review_requests',
      'app_reviews_reviews',
      'app_reviews_responses'
    ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_touch ON %I;', t, t);
    EXECUTE format(
      'CREATE TRIGGER %I_touch BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION reviews_touch_updated_at();',
      t, t
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
ALTER TABLE app_reviews_review_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_reviews_reviews         ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_reviews_responses       ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_reviews_disputes        ENABLE ROW LEVEL SECURITY;

-- Reviews are public-read (visibility='public') for storefront consumption.
DROP POLICY IF EXISTS app_reviews_reviews_public_read ON app_reviews_reviews;
CREATE POLICY app_reviews_reviews_public_read
  ON app_reviews_reviews FOR SELECT
  USING (visibility = 'public');

-- Merchant-scoped write on their own reviews rows (e.g. flag hidden)
DROP POLICY IF EXISTS app_reviews_reviews_merchant_write ON app_reviews_reviews;
CREATE POLICY app_reviews_reviews_merchant_write
  ON app_reviews_reviews FOR UPDATE
  USING (merchant_id = auth.uid())
  WITH CHECK (merchant_id = auth.uid());

-- Requests: merchant-scoped.
DROP POLICY IF EXISTS app_reviews_review_requests_merchant ON app_reviews_review_requests;
CREATE POLICY app_reviews_review_requests_merchant
  ON app_reviews_review_requests
  FOR ALL
  USING (merchant_id = auth.uid())
  WITH CHECK (merchant_id = auth.uid());

-- Responses: public read + merchant write.
DROP POLICY IF EXISTS app_reviews_responses_public_read ON app_reviews_responses;
CREATE POLICY app_reviews_responses_public_read
  ON app_reviews_responses FOR SELECT USING (true);

DROP POLICY IF EXISTS app_reviews_responses_merchant_write ON app_reviews_responses;
CREATE POLICY app_reviews_responses_merchant_write
  ON app_reviews_responses
  FOR ALL
  USING (merchant_id = auth.uid())
  WITH CHECK (merchant_id = auth.uid());

-- Disputes: merchant-scoped.
DROP POLICY IF EXISTS app_reviews_disputes_merchant ON app_reviews_disputes;
CREATE POLICY app_reviews_disputes_merchant
  ON app_reviews_disputes
  FOR ALL
  USING (merchant_id = auth.uid())
  WITH CHECK (merchant_id = auth.uid());

COMMIT;
