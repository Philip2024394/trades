-- The Network canteens.
--
-- Design contract mirrors src/lib/canteens.ts. Four tables:
--   1. hammerex_canteens          — the canteen container itself
--   2. hammerex_canteen_members   — trades who joined + their role
--   3. hammerex_canteen_products  — products the host sells inside
--   4. hammerex_canteen_posts     — posts + Counter listings
--
-- host_slug references the merchant's public slug in
-- hammerex_trade_off_listings. We don't add a hard FK because
-- listings and canteens are managed as separate concerns and mock
-- slugs (`demo-*`) may not have a listing row during migration.

-- ─── Canteens ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hammerex_canteens (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                    text NOT NULL UNIQUE,
  name                    text NOT NULL,
  tagline                 text,
  trade_slug              text NOT NULL,
  trade_label             text NOT NULL,
  host_slug               text NOT NULL,
  host_display_name       text NOT NULL,
  header_bg_url           text,
  is_founding_100         boolean NOT NULL DEFAULT false,
  member_count            int NOT NULL DEFAULT 1,
  posts_last_30d          int NOT NULL DEFAULT 0,
  activity_streak_months  int NOT NULL DEFAULT 0,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hammerex_canteens_slug         ON hammerex_canteens (slug);
CREATE INDEX IF NOT EXISTS hammerex_canteens_trade_slug   ON hammerex_canteens (trade_slug);
CREATE INDEX IF NOT EXISTS hammerex_canteens_host_slug    ON hammerex_canteens (host_slug);

-- ─── Canteen members ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS hammerex_canteen_members (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canteen_id              uuid NOT NULL REFERENCES hammerex_canteens(id) ON DELETE CASCADE,
  member_slug             text NOT NULL,
  display_name            text NOT NULL,
  trade_label             text NOT NULL,
  city                    text,
  avatar_url              text,
  role                    text NOT NULL DEFAULT 'member'
                             CHECK (role IN ('admin','moderator','member')),
  whatsapp                text,
  bio_short               text,
  -- Extended profile fields (used by the profile focus view)
  postcode_area           text,
  office_hours            text,
  showroom_address_line   text,
  showroom_postcode       text,
  verified_companies_house boolean NOT NULL DEFAULT false,
  verified_insurance_gbp  int,
  verified_trust_score    int CHECK (verified_trust_score BETWEEN 0 AND 100),
  availability            text,
  response_time           text,
  phone                   text,
  email                   text,
  instagram_handle        text,
  facebook_handle         text,
  tiktok_handle           text,
  youtube_handle          text,
  website_url             text,
  reviews_avg             numeric(3,2),
  reviews_count           int,
  portfolio_count         int,
  country                 text CHECK (country IN ('UK','IE','AU','US','DE')),
  member_of_canteen_slugs text[] DEFAULT ARRAY[]::text[],
  joined_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (canteen_id, member_slug)
);

CREATE INDEX IF NOT EXISTS hammerex_canteen_members_canteen ON hammerex_canteen_members (canteen_id);
CREATE INDEX IF NOT EXISTS hammerex_canteen_members_slug    ON hammerex_canteen_members (member_slug);
CREATE INDEX IF NOT EXISTS hammerex_canteen_members_admin
  ON hammerex_canteen_members (canteen_id)
  WHERE role = 'admin';

-- ─── Canteen products ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS hammerex_canteen_products (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canteen_id              uuid NOT NULL REFERENCES hammerex_canteens(id) ON DELETE CASCADE,
  host_slug               text NOT NULL,
  name                    text NOT NULL,
  blurb                   text,
  description             text,
  image_url               text,
  price_gbp               int NOT NULL DEFAULT 0,
  specs                   text[],
  trade_center_listing_id text,
  featured                boolean NOT NULL DEFAULT false,
  -- Bulk buy fields (nullable JSONB block for flexibility)
  bulk_buy                jsonb,
  -- Boost fields (nullable JSONB block for the active boost)
  boost                   jsonb,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hammerex_canteen_products_canteen  ON hammerex_canteen_products (canteen_id);
CREATE INDEX IF NOT EXISTS hammerex_canteen_products_featured ON hammerex_canteen_products (canteen_id)
  WHERE featured = true;

-- ─── Canteen posts ────────────────────────────────────────
--
-- Both canteen chat posts AND Counter listings live here. The
-- Counter is a cross-canteen aggregation query (posts of kind
-- 'counter' visible to everyone), while chat posts are canteen-
-- scoped.

CREATE TABLE IF NOT EXISTS hammerex_canteen_posts (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canteen_id              uuid REFERENCES hammerex_canteens(id) ON DELETE CASCADE,
  author_slug             text NOT NULL,
  author_display_name     text NOT NULL,
  author_avatar_url       text,
  kind                    text NOT NULL CHECK (kind IN (
    'chat','question','showcase','announcement','counter','make-offer'
  )),
  body                    text,
  photo_urls              text[] DEFAULT ARRAY[]::text[],
  mood_slug               text,
  price_gbp               int,
  currency                text DEFAULT 'GBP',
  target_trade_slugs      text[],
  boost_expires_at        timestamptz,
  boost_paid_gbp          int,
  reactions               jsonb,
  reply_count             int NOT NULL DEFAULT 0,
  is_pinned               boolean NOT NULL DEFAULT false,
  status                  text NOT NULL DEFAULT 'live'
                             CHECK (status IN ('live','hidden','removed')),
  created_at              timestamptz NOT NULL DEFAULT now(),
  expires_at              timestamptz
);

CREATE INDEX IF NOT EXISTS hammerex_canteen_posts_canteen   ON hammerex_canteen_posts (canteen_id, created_at DESC);
CREATE INDEX IF NOT EXISTS hammerex_canteen_posts_counter   ON hammerex_canteen_posts (created_at DESC)
  WHERE kind = 'counter' AND status = 'live';
CREATE INDEX IF NOT EXISTS hammerex_canteen_posts_boost
  ON hammerex_canteen_posts (boost_expires_at DESC)
  WHERE boost_expires_at IS NOT NULL AND status = 'live';

-- ─── Triggers ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION hammerex_canteens_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS hammerex_canteens_updated_at ON hammerex_canteens;
CREATE TRIGGER hammerex_canteens_updated_at
  BEFORE UPDATE ON hammerex_canteens
  FOR EACH ROW EXECUTE FUNCTION hammerex_canteens_set_updated_at();

DROP TRIGGER IF EXISTS hammerex_canteen_products_updated_at ON hammerex_canteen_products;
CREATE TRIGGER hammerex_canteen_products_updated_at
  BEFORE UPDATE ON hammerex_canteen_products
  FOR EACH ROW EXECUTE FUNCTION hammerex_canteens_set_updated_at();

-- ─── RLS ──────────────────────────────────────────────────

ALTER TABLE hammerex_canteens ENABLE ROW LEVEL SECURITY;
ALTER TABLE hammerex_canteen_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE hammerex_canteen_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE hammerex_canteen_posts ENABLE ROW LEVEL SECURITY;

-- Anon reads: canteens are public. Members + products + live posts
-- are readable. Removed/hidden posts are hidden at the DB level.
DROP POLICY IF EXISTS canteens_read_all ON hammerex_canteens;
CREATE POLICY canteens_read_all ON hammerex_canteens FOR SELECT USING (true);

DROP POLICY IF EXISTS canteen_members_read_all ON hammerex_canteen_members;
CREATE POLICY canteen_members_read_all ON hammerex_canteen_members FOR SELECT USING (true);

DROP POLICY IF EXISTS canteen_products_read_all ON hammerex_canteen_products;
CREATE POLICY canteen_products_read_all ON hammerex_canteen_products FOR SELECT USING (true);

DROP POLICY IF EXISTS canteen_posts_read_live ON hammerex_canteen_posts;
CREATE POLICY canteen_posts_read_live ON hammerex_canteen_posts FOR SELECT USING (status = 'live');

-- Service role bypasses RLS; all writes route through /api/canteens/*
-- using supabaseAdmin.
