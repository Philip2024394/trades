-- The Network reviews system.
--
-- Design contract mirrors src/lib/reviews.ts. Three tables:
--   1. hammerex_network_reviews             — the reviews themselves
--   2. hammerex_network_review_events       — audit log (submitted,
--        owner_replied_public, admin_frozen, admin_verified, published,
--        withdrawn, ...) — every state change is a row
--   3. hammerex_network_reviewer_accountability — per-reviewer weight
--
-- Publish flow:
--   - Overall >= 4.0 → status='published', publish_at=NOW()
--   - Overall <  4.0 → status='pending',   publish_at=NOW() + 72h
--   - A scheduled Edge Function flips 'pending' → 'published' when
--     publish_at passes AND admin hasn't frozen/removed the row.
--
-- RLS anchors on `reviewer_cookie` — an anonymous cookie ID we set
-- server-side on first review. Real auth (session-based reviewer
-- identity) lands with the auth system; the cookie model keeps the
-- write path safe against random anonymous inserts.

-- ─── Tables ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hammerex_network_reviews (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Merchant being reviewed. String slug (not FK) because the
  -- listings table is a separate concern and mocks may share slugs
  -- during migration.
  merchant_slug             text NOT NULL,

  -- Reviewer identity. Cookie-based initially; real listing_id lands
  -- with auth. Both are nullable so anonymous reviews can still be
  -- captured and weighted down.
  reviewer_slug             text,
  reviewer_cookie           text,
  reviewer_display_name     text NOT NULL,
  reviewer_trade_label      text,
  reviewer_city             text,
  reviewer_avatar_url       text,

  -- Job verification. Weakest signal (invoice) weights 0.5×,
  -- WhatsApp 1.0×, job-tag 1.5×.
  job_verification_kind     text CHECK (job_verification_kind IN ('job-tag','whatsapp-thread','invoice')),
  job_verification_at       timestamptz,
  job_verification_label    text,

  -- Dimension scores (1-5 each). trade_specific is optional per trade.
  quality_score             int NOT NULL CHECK (quality_score BETWEEN 1 AND 5),
  communication_score       int NOT NULL CHECK (communication_score BETWEEN 1 AND 5),
  punctuality_score         int NOT NULL CHECK (punctuality_score BETWEEN 1 AND 5),
  value_score               int NOT NULL CHECK (value_score BETWEEN 1 AND 5),
  cleanliness_score         int NOT NULL CHECK (cleanliness_score BETWEEN 1 AND 5),
  trade_specific_score      int CHECK (trade_specific_score BETWEEN 1 AND 5),
  overall_score             numeric(3,2) NOT NULL,

  body                      text NOT NULL CHECK (char_length(body) >= 60),
  photo_urls                text[] DEFAULT ARRAY[]::text[],

  status                    text NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','published','frozen','removed','withdrawn')),
  publish_at                timestamptz NOT NULL,

  -- Merchant response, folded into the row for read-simplicity.
  owner_response_body       text,
  owner_response_at         timestamptz,
  owner_response_kind       text CHECK (owner_response_kind IN ('public-reply','private-resolution')),

  -- Admin action, similarly folded.
  admin_action              text CHECK (admin_action IN ('verified','frozen','removed')),
  admin_action_reason       text,
  admin_action_at           timestamptz,
  admin_action_by           text,

  helpful_count             int NOT NULL DEFAULT 0,

  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE hammerex_network_reviews IS
  'The Network reviews. See src/lib/reviews.ts for the design contract and math.';

CREATE INDEX IF NOT EXISTS hammerex_trade_off_reviews_merchant_pub
  ON hammerex_network_reviews (merchant_slug, status, publish_at DESC);

CREATE INDEX IF NOT EXISTS hammerex_trade_off_reviews_publish_at_pending
  ON hammerex_network_reviews (publish_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS hammerex_trade_off_reviews_reviewer_cookie
  ON hammerex_network_reviews (reviewer_cookie)
  WHERE reviewer_cookie IS NOT NULL;

-- ─── Event log ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hammerex_network_review_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id     uuid NOT NULL REFERENCES hammerex_network_reviews(id) ON DELETE CASCADE,
  kind          text NOT NULL CHECK (kind IN (
    'submitted',
    'owner_replied_private',
    'owner_replied_public',
    'owner_disputed',
    'reviewer_edited',
    'reviewer_withdrew',
    'admin_frozen',
    'admin_removed',
    'admin_verified',
    'published'
  )),
  actor         text NOT NULL CHECK (actor IN ('reviewer','owner','admin','system')),
  actor_slug    text,
  note          text,
  meta          jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hammerex_network_review_events_review
  ON hammerex_network_review_events (review_id, created_at DESC);

-- ─── Reviewer accountability ───────────────────────────────

CREATE TABLE IF NOT EXISTS hammerex_network_reviewer_accountability (
  reviewer_slug         text PRIMARY KEY,
  reviews_submitted     int NOT NULL DEFAULT 0,
  reviews_disputed      int NOT NULL DEFAULT 0,
  reviews_removed       int NOT NULL DEFAULT 0,
  -- Weight multiplier applied to this reviewer's votes in the Bayesian
  -- aggregate. 0.5 = contested, 1.0 = default, 1.5 = verified.
  weight_multiplier     numeric(3,2) NOT NULL DEFAULT 1.0
                          CHECK (weight_multiplier BETWEEN 0.0 AND 2.0),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- ─── Trigger: keep updated_at + emit submitted event ───────

CREATE OR REPLACE FUNCTION hammerex_trade_off_reviews_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS hammerex_trade_off_reviews_updated_at ON hammerex_network_reviews;
CREATE TRIGGER hammerex_trade_off_reviews_updated_at
  BEFORE UPDATE ON hammerex_network_reviews
  FOR EACH ROW
  EXECUTE FUNCTION hammerex_trade_off_reviews_set_updated_at();

-- ─── RLS ──────────────────────────────────────────────────

ALTER TABLE hammerex_network_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE hammerex_network_review_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE hammerex_network_reviewer_accountability ENABLE ROW LEVEL SECURITY;

-- Anon read: published only. Never expose pending/frozen/removed to
-- the public (frozen/removed still render tombstones via server code).
DROP POLICY IF EXISTS reviews_read_published ON hammerex_network_reviews;
CREATE POLICY reviews_read_published
  ON hammerex_network_reviews
  FOR SELECT
  USING (status = 'published');

-- Service role bypasses RLS; all writes go through the API via
-- supabaseAdmin which uses the service role key.
