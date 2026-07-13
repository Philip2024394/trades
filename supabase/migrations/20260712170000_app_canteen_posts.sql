-- app_canteen_posts — posts within a trade or merchant canteen.
--
-- Per project_canteens_public_viewing.md:
--   • Only the canteen owner can post to their own canteen
--   • Public read for posts belonging to public canteens
--   • Posts flow into a global live feed (/canteen live)
--
-- Extending the canteens table so it can hold merchant canteens too
-- (per user's Phase 2 requirement: "same for building merchants they
-- also have every one except home owners and diy"). Merchant
-- canteen provisioning is a follow-up; the schema is ready now.

ALTER TABLE app_trade_canteens
  ADD COLUMN IF NOT EXISTS entity_type text NOT NULL DEFAULT 'trade'
    CHECK (entity_type IN ('trade', 'merchant'));

ALTER TABLE app_trade_canteens
  ADD COLUMN IF NOT EXISTS merchant_slug text;

CREATE INDEX IF NOT EXISTS app_trade_canteens_entity_type_idx
  ON app_trade_canteens (entity_type)
  WHERE is_public = true;

COMMENT ON COLUMN app_trade_canteens.entity_type IS
  'trade = individual tradesperson canteen. merchant = building merchant / product seller canteen. Homeowners + DIY never get a canteen.';
COMMENT ON COLUMN app_trade_canteens.merchant_slug IS
  'For entity_type=merchant, the slug that links to their MERCHANT_FIXTURES record (marketplace merchant profile).';

-- ─── Posts ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS app_canteen_posts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canteen_id    uuid NOT NULL REFERENCES app_trade_canteens(id) ON DELETE CASCADE,
  author_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body          text NOT NULL CHECK (char_length(body) > 0 AND char_length(body) <= 4000),
  image_url     text,
  is_promoted_to_yard boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  edited_at     timestamptz
);

CREATE INDEX IF NOT EXISTS app_canteen_posts_canteen_idx
  ON app_canteen_posts (canteen_id, created_at DESC);

CREATE INDEX IF NOT EXISTS app_canteen_posts_global_feed_idx
  ON app_canteen_posts (created_at DESC);

-- RLS
ALTER TABLE app_canteen_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "posts_public_read" ON app_canteen_posts;
CREATE POLICY "posts_public_read"
  ON app_canteen_posts
  FOR SELECT
  USING (
    canteen_id IN (
      SELECT id FROM app_trade_canteens WHERE is_public = true OR trade_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "posts_owner_insert" ON app_canteen_posts;
CREATE POLICY "posts_owner_insert"
  ON app_canteen_posts
  FOR INSERT
  WITH CHECK (
    canteen_id IN (SELECT id FROM app_trade_canteens WHERE trade_id = auth.uid())
    AND author_id = auth.uid()
  );

DROP POLICY IF EXISTS "posts_owner_update" ON app_canteen_posts;
CREATE POLICY "posts_owner_update"
  ON app_canteen_posts
  FOR UPDATE
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "posts_owner_delete" ON app_canteen_posts;
CREATE POLICY "posts_owner_delete"
  ON app_canteen_posts
  FOR DELETE
  USING (author_id = auth.uid());

COMMENT ON TABLE app_canteen_posts IS
  'Posts within a canteen. Only the canteen owner can post to their own canteen. Public read subject to canteen visibility. is_promoted_to_yard signals the post is elevated into the shared Yard feed (per project_canteen_stays_in_canteen.md).';
