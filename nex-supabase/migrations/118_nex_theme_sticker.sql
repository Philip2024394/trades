-- ============================================================================
-- NEX-native Migration 118 · nex_theme_sticker
-- ============================================================================
--
-- Per-theme sticker library · founder-sealed 2026-10-01.
--
-- Stickers are a DISTINCT content type from theme emojis (Migration 116).
-- Reasons:
--   · stickers are portrait scene-art (257x358 for Joker-set-1), emojis
--     are square expressive faces (~200x200).
--   · stickers send as a dedicated peer-message attachment type (see
--     'sticker' in NexPeerAttachmentKind), rendered ~140px tall in the
--     bubble lane · NEVER as inline 32px emoji chips.
--   · the picker renders stickers in their own tab (Stickers) with
--     portrait tiles that preserve aspect ratio.
--
-- Schema is theme-neutral · any current/future theme (Joker, Pink Dream,
-- Night Sky, …) can supply its own sticker set. First set is Joker's
-- nine static scenes (Thinking… / Laughing / etc.) uploaded via
-- `scripts/upload-joker-stickers.mjs`.
--
-- Animation-ready: `sticker_type` is already in the schema so a future
-- bridge can add 'animated' stickers (3-5s NEX character reactions,
-- APNG/WebP-animated/LOTTIE) without a second rebuild. Phase 1 ships
-- 'static' only · do NOT render animated playback yet.
--
-- Storage · new bucket `nex-theme-sticker`:
--   · Public read (recipients see stickers without an auth round-trip)
--   · Writes only via service role from the future
--     theme-sticker-service upload helper
--   · 2 MB file cap (stickers can be richer than emojis)
--   · png / webp / gif only (apng rides on png MIME)
--   · Path convention: `<theme_id>/<slug>.<ext>` so bulk delete on
--     theme removal is a single storage.remove() over the prefix
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '118';
--     DROP TABLE IF EXISTS nex_theme_sticker;
--     DROP POLICY IF EXISTS nex_theme_sticker_bucket_public_read ON storage.objects;
--     DELETE FROM storage.buckets WHERE id = 'nex-theme-sticker';
--   COMMIT;
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS nex_theme_sticker (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id       text NOT NULL REFERENCES nex_chat_theme(id) ON DELETE CASCADE,
  slug           text NOT NULL,
  image_url      text NOT NULL,
  label          text NOT NULL DEFAULT '',
  sort_order     integer NOT NULL DEFAULT 0,
  -- Phase 1 ships 'static' only. 'animated' is reserved for future
  -- NEX-character reaction stickers (APNG / animated WebP / Lottie) ·
  -- the renderer must branch on this column so animated playback can
  -- land as a drop-in later. DO NOT populate 'animated' yet.
  sticker_type   text NOT NULL DEFAULT 'static'
    CHECK (sticker_type IN ('static', 'animated')),
  -- Aspect ratio = width / height · stored so the picker + bubble
  -- renderer can reserve the right amount of space before the image
  -- loads (prevents layout shift). Default 1 keeps square assets safe.
  aspect_ratio   numeric NOT NULL DEFAULT 1
    CHECK (aspect_ratio > 0 AND aspect_ratio < 10),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nex_theme_sticker_slug_shape
    CHECK (slug ~ '^[a-z0-9][a-z0-9_-]{0,60}$'),
  CONSTRAINT nex_theme_sticker_label_len
    CHECK (char_length(label) <= 40),
  CONSTRAINT nex_theme_sticker_url_nonempty
    CHECK (char_length(image_url) > 0),
  UNIQUE (theme_id, slug)
);

COMMENT ON TABLE nex_theme_sticker IS
  'Per-theme sticker library · dedicated content type separate from nex_theme_emoji. Stickers render ~140px tall in bubbles via attachment_type=sticker · never as inline emoji chips. Sealed 2026-10-01.';

COMMENT ON COLUMN nex_theme_sticker.sticker_type IS
  'static (Phase 1 · PNG/WEBP/GIF single frame) or animated (future · APNG/animated-WebP/Lottie for NEX character reaction stickers). The renderer must branch on this column.';

COMMENT ON COLUMN nex_theme_sticker.aspect_ratio IS
  'width / height · stored at upload time so the picker and bubble renderer can reserve the correct portrait/square footprint before the image loads.';

CREATE INDEX IF NOT EXISTS nex_theme_sticker_theme_idx
  ON nex_theme_sticker (theme_id, sort_order, created_at);

CREATE OR REPLACE FUNCTION nex_theme_sticker_touch()
RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS nex_theme_sticker_touch_trg ON nex_theme_sticker;
CREATE TRIGGER nex_theme_sticker_touch_trg
  BEFORE UPDATE ON nex_theme_sticker
  FOR EACH ROW
  EXECUTE FUNCTION nex_theme_sticker_touch();

ALTER TABLE nex_theme_sticker ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nex_theme_sticker_public_read ON nex_theme_sticker;
CREATE POLICY nex_theme_sticker_public_read
  ON nex_theme_sticker FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS nex_theme_sticker_deny_client_write ON nex_theme_sticker;
CREATE POLICY nex_theme_sticker_deny_client_write
  ON nex_theme_sticker FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- Storage bucket · 2 MB cap · png / webp / gif
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'nex-theme-sticker',
    'nex-theme-sticker',
    true,
    2097152,
    ARRAY['image/png', 'image/webp', 'image/gif']
  )
  ON CONFLICT (id) DO UPDATE
    SET public = EXCLUDED.public,
        file_size_limit = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS nex_theme_sticker_bucket_public_read ON storage.objects;
CREATE POLICY nex_theme_sticker_bucket_public_read
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'nex-theme-sticker');

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '118',
    'nex_theme_sticker table + nex-theme-sticker public bucket for per-theme sticker sets · theme-neutral · sticker_type ready for future animated stickers',
    'Founder-authorised 2026-10-01. First set is Joker (theme-0) · nine static scenes seeded via scripts/upload-joker-stickers.mjs. Peer-message attachment_type ''sticker'' extends NexPeerAttachmentKind without touching nex_theme_emoji (Migration 116) or the existing emoji/reaction surfaces.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;
