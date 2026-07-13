-- app_trade_canteens — every trade's own public audience page.
--
-- Auto-provisioned at trade signup (see project_canteens_public_viewing.md).
-- One row per trade. Public read; owner-only write for owner-editable
-- fields. Trade-price gate on displayed prices still handled at UI
-- layer via useIsTrade().
--
-- Content flow:
--   • Identity fields (display_name, discipline, city) mirror
--     app_trade_profiles at provision time and can be re-synced.
--   • Rates auto-render from app_rates_submissions where
--     source_type='menu-rate' and trade_id = canteen owner.
--   • Photos + posts come in Phase 2 tables.

CREATE TABLE IF NOT EXISTS app_trade_canteens (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id          uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  slug              text NOT NULL UNIQUE,
  discipline        text,            -- e.g. 'plastering', synced from profile
  display_name      text NOT NULL,
  city              text,
  bio               text,            -- trade's own written intro
  hero_image_url    text,            -- optional cover image
  is_public         boolean NOT NULL DEFAULT true,
  is_verified       boolean NOT NULL DEFAULT false,   -- flips true on VTI upgrade
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_trade_canteens_slug_idx  ON app_trade_canteens (slug);
CREATE INDEX IF NOT EXISTS app_trade_canteens_owner_idx ON app_trade_canteens (trade_id);
CREATE INDEX IF NOT EXISTS app_trade_canteens_discipline_idx ON app_trade_canteens (discipline)
  WHERE is_public = true;

-- RLS: public read for public canteens; owner reads their own even
-- when private; owner writes their own.
ALTER TABLE app_trade_canteens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "canteens_public_read" ON app_trade_canteens;
CREATE POLICY "canteens_public_read"
  ON app_trade_canteens
  FOR SELECT
  USING (is_public = true OR auth.uid() = trade_id);

DROP POLICY IF EXISTS "canteens_owner_write" ON app_trade_canteens;
CREATE POLICY "canteens_owner_write"
  ON app_trade_canteens
  FOR UPDATE
  USING (auth.uid() = trade_id)
  WITH CHECK (auth.uid() = trade_id);

-- No INSERT policy: canteens are inserted by service-role at signup
-- provisioning only. Owners never create canteens directly (they're
-- auto-provisioned).

COMMENT ON TABLE app_trade_canteens IS
  '1:1 with app_trade_profiles for viewer_role=trade. Auto-provisioned at signup. Public URL: /canteen/[slug]. See project_canteens_public_viewing.md for the canonical rule.';
COMMENT ON COLUMN app_trade_canteens.slug IS
  'URL slug for /canteen/[slug]. Slugified from display_name at provision; can be edited by owner if uniqueness holds.';
COMMENT ON COLUMN app_trade_canteens.is_public IS
  'Default true — trade discovery is the whole point. Owner can flip to false to hide from public search but URL still works for direct visitors with knowledge of the slug.';
