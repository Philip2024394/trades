-- ============================================================================
-- NEX-native Migration 116 · nex_theme_emoji
-- ============================================================================
--
-- Per-theme emoji library. When a chat theme has one or more emojis in
-- this table, the composer emoji picker renders THAT theme's set
-- instead of the default 40-emoji hardcoded array. Themes without any
-- rows continue to see the default set · no seller UI change required.
--
-- Founder-sealed 2026-10-01 · Theme 0 (Joker) is the first theme with
-- a custom emoji set.
--
-- Storage · new bucket `nex-theme-emoji`:
--   · Public read (buyers see emojis without an auth round-trip)
--   · Writes only via service role from the future
--     theme-emoji-service upload helper
--   · 500 KB file cap (emojis should be tiny transparent PNGs)
--   · png / webp / gif only (jpg strips transparency)
--   · Path convention: `<theme_id>/<slug>.<ext>` so bulk delete on
--     theme removal is a single storage.remove() over the prefix
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '116';
--     DROP TABLE IF EXISTS nex_theme_emoji;
--     DROP POLICY IF EXISTS nex_theme_emoji_public_read ON storage.objects;
--     DELETE FROM storage.buckets WHERE id = 'nex-theme-emoji';
--   COMMIT;
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS nex_theme_emoji (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id     text NOT NULL REFERENCES nex_chat_theme(id) ON DELETE CASCADE,
  slug         text NOT NULL,
  image_url    text NOT NULL,
  label        text NOT NULL DEFAULT '',
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nex_theme_emoji_slug_shape
    CHECK (slug ~ '^[a-z0-9][a-z0-9_-]{0,60}$'),
  CONSTRAINT nex_theme_emoji_label_len
    CHECK (char_length(label) <= 40),
  CONSTRAINT nex_theme_emoji_url_nonempty
    CHECK (char_length(image_url) > 0),
  UNIQUE (theme_id, slug)
);

COMMENT ON TABLE nex_theme_emoji IS
  'Per-theme emoji library · overrides the composer default 40-emoji set when the current theme has one or more rows. Sealed 2026-10-01 · Theme 0 Joker is the first theme with a custom set.';

COMMENT ON COLUMN nex_theme_emoji.slug IS
  'Stable id within a theme · alphanumeric + dash + underscore · 1-60 chars · unique per theme_id.';

COMMENT ON COLUMN nex_theme_emoji.image_url IS
  'Public URL in the nex-theme-emoji bucket. Path convention <theme_id>/<slug>.<ext>.';

COMMENT ON COLUMN nex_theme_emoji.sort_order IS
  'Display order in the picker · lower renders first · ties broken by created_at asc.';

CREATE INDEX IF NOT EXISTS nex_theme_emoji_theme_idx
  ON nex_theme_emoji (theme_id, sort_order, created_at);

CREATE OR REPLACE FUNCTION nex_theme_emoji_touch()
RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS nex_theme_emoji_touch_trg ON nex_theme_emoji;
CREATE TRIGGER nex_theme_emoji_touch_trg
  BEFORE UPDATE ON nex_theme_emoji
  FOR EACH ROW
  EXECUTE FUNCTION nex_theme_emoji_touch();

ALTER TABLE nex_theme_emoji ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nex_theme_emoji_public_read ON nex_theme_emoji;
CREATE POLICY nex_theme_emoji_public_read
  ON nex_theme_emoji FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS nex_theme_emoji_deny_client_write ON nex_theme_emoji;
CREATE POLICY nex_theme_emoji_deny_client_write
  ON nex_theme_emoji FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- Storage bucket · 500 KB cap · png / webp / gif for transparency
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'nex-theme-emoji',
    'nex-theme-emoji',
    true,
    524288,
    ARRAY['image/png', 'image/webp', 'image/gif']
  )
  ON CONFLICT (id) DO UPDATE
    SET public = EXCLUDED.public,
        file_size_limit = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS nex_theme_emoji_bucket_public_read ON storage.objects;
CREATE POLICY nex_theme_emoji_bucket_public_read
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'nex-theme-emoji');

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '116',
    'nex_theme_emoji table + nex-theme-emoji public bucket for per-theme emoji sets',
    'Founder-authorised 2026-10-01. Public read on rows AND bucket · service-role writes · slug 1-60 chars unique per theme · 500 KB cap · png/webp/gif only. Theme 0 (Joker) is the first custom set.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;
