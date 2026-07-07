-- G1 · Feed Posts + Consent Records.
--
-- feed_posts is the first "publication" surface — a projection of
-- business_events into the merchant's live website timeline. Every
-- row is one card on the merchant's /feed page and (optionally) on
-- their landing page's live block.
--
-- consent_records tracks per-event customer permission so we never
-- publish photos of a customer's property without them saying yes.

BEGIN;

-- =========================================================================
-- feed_posts — the merchant's live feed timeline
-- =========================================================================

CREATE TABLE IF NOT EXISTS feed_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL,
  -- URL-friendly identifier: `{yyyymmdd}-{trade}-{service}-{city}`.
  -- Uniqueness enforced per merchant so slugs stay clean per site.
  slug text NOT NULL,
  headline text NOT NULL,
  body_markdown text NOT NULL,
  hero_image_url text,
  photo_urls text[] NOT NULL DEFAULT '{}',
  -- Structured facets — used by the feed page filter + the CTA
  -- picker (a boiler-repair post shows "Book a boiler repair"; a
  -- driveway post shows "Get a driveway quote").
  facets jsonb NOT NULL DEFAULT '{}'::jsonb,
  cta_kind text,       -- 'get_quote' | 'call' | 'book' | 'message' | null
  cta_target text,     -- URL / tel: / mailto: / null
  linked_event_id uuid REFERENCES business_events(id) ON DELETE SET NULL,
  linked_memory_record_id uuid REFERENCES memory_records(id) ON DELETE SET NULL,
  -- Approval buffer state. New rows start scheduled_for = now() + 60min.
  -- Merchant can tap Hold at any time before scheduled_for; after that
  -- it auto-flips to published on next feed read.
  status text NOT NULL DEFAULT 'scheduled',
  hold_reason text,
  scheduled_for timestamptz NOT NULL DEFAULT (now() + interval '60 minutes'),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status IN ('scheduled', 'published', 'held', 'archived', 'failed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS feed_posts_merchant_slug_unique
  ON feed_posts (merchant_id, slug);
CREATE INDEX IF NOT EXISTS feed_posts_scheduled_idx
  ON feed_posts (merchant_id, scheduled_for)
  WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS feed_posts_published_idx
  ON feed_posts (merchant_id, published_at DESC)
  WHERE status = 'published';
CREATE INDEX IF NOT EXISTS feed_posts_facets_gin_idx
  ON feed_posts USING gin (facets jsonb_path_ops);

CREATE OR REPLACE FUNCTION feed_posts_touch_updated()
  RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS feed_posts_touch_updated ON feed_posts;
CREATE TRIGGER feed_posts_touch_updated
  BEFORE UPDATE ON feed_posts
  FOR EACH ROW EXECUTE FUNCTION feed_posts_touch_updated();

-- =========================================================================
-- consent_records — per-event customer permission
-- =========================================================================

CREATE TABLE IF NOT EXISTS consent_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES business_events(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL,
  subject_type text NOT NULL,
    -- 'customer_property' | 'client_face' | 'staff_face' | 'child_present' | ...
  state text NOT NULL DEFAULT 'pending',
    -- 'granted' | 'denied' | 'pending' | 'not_required'
  requested_at timestamptz,
  granted_at timestamptz,
  method text,
    -- 'whatsapp' | 'form' | 'verbal_confirmed' | 'signed_contract' | 'assumed_from_context'
  audit_trail jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (state IN ('granted', 'denied', 'pending', 'not_required'))
);

CREATE INDEX IF NOT EXISTS consent_records_event_idx
  ON consent_records (event_id);
CREATE INDEX IF NOT EXISTS consent_records_merchant_state_idx
  ON consent_records (merchant_id, state, created_at DESC);

-- =========================================================================
-- RLS
-- =========================================================================

ALTER TABLE feed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feed_posts_public_read_published ON feed_posts;
CREATE POLICY feed_posts_public_read_published ON feed_posts
  FOR SELECT USING (status = 'published');

DROP POLICY IF EXISTS feed_posts_merchant_all ON feed_posts;
CREATE POLICY feed_posts_merchant_all ON feed_posts
  FOR ALL USING (merchant_id = auth.uid())
  WITH CHECK (merchant_id = auth.uid());

DROP POLICY IF EXISTS feed_posts_service_role ON feed_posts;
CREATE POLICY feed_posts_service_role ON feed_posts
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS consent_records_merchant_r ON consent_records;
CREATE POLICY consent_records_merchant_r ON consent_records
  FOR SELECT USING (merchant_id = auth.uid());

DROP POLICY IF EXISTS consent_records_service_role ON consent_records;
CREATE POLICY consent_records_service_role ON consent_records
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

COMMIT;
