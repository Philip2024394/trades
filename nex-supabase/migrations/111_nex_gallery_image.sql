-- ============================================================================
-- NEX-native Migration 111 · nex_gallery_image
-- ============================================================================
--
-- Purpose:
--   Persist per-business gallery images so the Personal Brand templates
--   (10 / 13 / 14) can render the seller's real photography on the
--   Images tab instead of the current "IMAGE HERE" placeholder wall.
--
-- Founder-sealed shape (2026-09-30):
--   · Each image row carries a short caption (~40 chars, appears under
--     the thumbnail on the 3×3 grid) AND a long description (~700 chars,
--     rendered in the lightbox when the buyer taps the tile). The
--     7-line clamp in the lightbox lives in the layout · this column is
--     the FULL body.
--   · Images uploaded to the existing `nex-business-assets` public
--     bucket under `gallery/<business_id>/<filename>`. No new bucket ·
--     bucket already carries public-read RLS from migration 110.
--   · Sort_order controls the tile order. Nulls sort last.
--   · Public read on the ROW so buyers can list gallery entries when
--     they browse a cover. Writes only via the service role from the
--     upcoming gallery-image-service (Gallery-B).
--
-- Downstream (this migration alone does NOT ship any UI):
--   · Gallery-B · service + server actions (list, upload, update caption,
--     update long description, delete, reorder).
--   · Gallery-C · /manage/gallery seller editor.
--   · Wire real rows into `ImagePlaceholderGallery` in layouts.tsx ·
--     empty state keeps the current placeholder pattern so the surface
--     never renders blank.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '111';
--     DROP TABLE IF EXISTS nex_gallery_image;
--   COMMIT;
--   -- Storage objects under nex-business-assets/gallery/* must be
--   -- deleted manually (Supabase Storage does not cascade).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS nex_gallery_image (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      uuid NOT NULL REFERENCES nex_business(id) ON DELETE CASCADE,
  image_url        text NOT NULL,
  caption          text NOT NULL DEFAULT '',
  long_description text NOT NULL DEFAULT '',
  sort_order       integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nex_gallery_image_caption_len
    CHECK (char_length(caption) <= 200),
  CONSTRAINT nex_gallery_image_long_description_len
    CHECK (char_length(long_description) <= 2000),
  CONSTRAINT nex_gallery_image_url_nonempty
    CHECK (char_length(image_url) > 0)
);

COMMENT ON TABLE nex_gallery_image IS
  'Per-business gallery images for cover Personal Brand templates (10 / 13 / 14). Rendered as a 3x3 tile grid on the Images tab with tap-to-open lightbox. Sealed 2026-09-30 · Bridge Gallery-A.';

COMMENT ON COLUMN nex_gallery_image.caption IS
  'Short caption rendered under the thumbnail on the 3x3 grid · cap 200 chars · 2-line clamp in UI · sellers keep it under ~40 chars for clean layout.';

COMMENT ON COLUMN nex_gallery_image.long_description IS
  'Longer body rendered in the lightbox when the buyer taps a tile · cap 2000 chars · UI clamps to 7 lines with ellipsis · buyers who want more tap the chat composer.';

COMMENT ON COLUMN nex_gallery_image.sort_order IS
  'Display order · lower renders first · ties broken by created_at asc.';

CREATE INDEX IF NOT EXISTS nex_gallery_image_business_idx
  ON nex_gallery_image (business_id, sort_order, created_at);

-- updated_at auto-touch trigger (matches convention across other tables).
CREATE OR REPLACE FUNCTION nex_gallery_image_touch()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS nex_gallery_image_touch_trg ON nex_gallery_image;
CREATE TRIGGER nex_gallery_image_touch_trg
  BEFORE UPDATE ON nex_gallery_image
  FOR EACH ROW
  EXECUTE FUNCTION nex_gallery_image_touch();

-- Row Level Security · public read · owner writes via service role.
ALTER TABLE nex_gallery_image ENABLE ROW LEVEL SECURITY;

-- Buyers (anon + authenticated) can read every gallery row so covers
-- render without an auth round-trip. Service role bypasses RLS for
-- inserts / updates / deletes issued from server actions.
DROP POLICY IF EXISTS nex_gallery_image_public_read ON nex_gallery_image;
CREATE POLICY nex_gallery_image_public_read
  ON nex_gallery_image
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- No direct client-side writes. All mutation flows through
-- gallery-image-service on the server (upcoming Gallery-B).
DROP POLICY IF EXISTS nex_gallery_image_deny_client_write ON nex_gallery_image;
CREATE POLICY nex_gallery_image_deny_client_write
  ON nex_gallery_image
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '111',
    'nex_gallery_image table · per-business gallery images for Personal Brand cover templates',
    'Founder-authorised 2026-09-30. Public read RLS · service-role writes · caption cap 200 chars · long_description cap 2000 chars · images live in nex-business-assets bucket under gallery/<business_id>/. Bridge Gallery-A.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT table_name FROM information_schema.tables
--    WHERE table_name = 'nex_gallery_image';
--   SELECT column_name, data_type, is_nullable FROM information_schema.columns
--    WHERE table_name = 'nex_gallery_image' ORDER BY ordinal_position;
--   SELECT policyname, cmd FROM pg_policies
--    WHERE tablename = 'nex_gallery_image';
--   SELECT id FROM storage.buckets WHERE id = 'nex-business-assets';
