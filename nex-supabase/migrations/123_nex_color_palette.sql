-- ============================================================================
-- NEX-native Migration 123 · nex_color_palette
-- ============================================================================
--
-- Sealed 2026-10-01 · Phase 1 of Shoppe-grade variant input.
--
-- NEX-managed master palette of 24 named colours. Sellers pick up to
-- 10 colours per product from this palette when creating / editing
-- product variants with attribute='colour'. The palette's hex values
-- are the SINGLE SOURCE OF TRUTH for colour swatches shown to buyers
-- on product cards, detail sheets, and cart lines — guarantees a
-- "Red" product in Shop A looks identical to a "Red" product in Shop
-- B, which keeps the Directory + search facets honest.
--
-- Sellers CANNOT define arbitrary hex values at the product level in
-- Phase 1 — they can only pick from this master list. If a seller
-- needs a colour not in the palette they request it via a form, we
-- bulk-add quarterly. Keeps brand consistency without blocking real
-- commerce.
--
-- Seed set (24 colours · 2026-10-01 Phase 1):
--   neutrals   · black, white, grey, cream
--   reds       · red, burgundy, pink, rose
--   warms      · orange, peach, coral, gold
--   yellows    · yellow, mustard
--   greens     · lime, green, mint, teal
--   blues      · cyan, sky, blue, navy
--   purples    · purple, lavender
--   browns     · brown, beige
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '123';
--     DROP TABLE IF EXISTS nex_color_palette;
--   COMMIT;
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS nex_color_palette (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL UNIQUE,
  label       text NOT NULL,
  hex         text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nex_color_palette_slug_shape
    CHECK (slug ~ '^[a-z][a-z0-9_-]{1,40}$'),
  CONSTRAINT nex_color_palette_hex_shape
    CHECK (hex ~ '^#[0-9A-Fa-f]{6}$'),
  CONSTRAINT nex_color_palette_label_len
    CHECK (char_length(label) BETWEEN 1 AND 40)
);

COMMENT ON TABLE nex_color_palette IS
  'NEX-managed master colour palette · Phase 1 Shoppe-grade variants. Sellers pick up to 10 colours per product from this list; hex is the single source of truth for colour swatches shown to buyers everywhere. Sealed 2026-10-01.';

CREATE INDEX IF NOT EXISTS idx_nex_color_palette_active
  ON nex_color_palette (sort_order ASC)
  WHERE is_active = true;

-- Reuse updated_at trigger from migration 002
DROP TRIGGER IF EXISTS nex_color_palette_touch ON nex_color_palette;
CREATE TRIGGER nex_color_palette_touch
  BEFORE UPDATE ON nex_color_palette
  FOR EACH ROW EXECUTE FUNCTION nex_touch_updated_at();

ALTER TABLE nex_color_palette ENABLE ROW LEVEL SECURITY;

-- Public read · anyone (authenticated or not) can see the palette so
-- buyer-side rendering works for anonymous visitors on cover pages.
DROP POLICY IF EXISTS nex_color_palette_public_read ON nex_color_palette;
CREATE POLICY nex_color_palette_public_read
  ON nex_color_palette FOR SELECT
  USING (is_active = true);

-- Writes are service-role only (NEX staff curate the master list).
-- No INSERT / UPDATE / DELETE policies for authenticated users.

-- Seed the 24-colour master palette.
INSERT INTO nex_color_palette (slug, label, hex, sort_order) VALUES
  ('black',     'Black',     '#000000',  10),
  ('white',     'White',     '#FFFFFF',  20),
  ('grey',      'Grey',      '#8A8F99',  30),
  ('cream',     'Cream',     '#F5EBDA',  40),
  ('red',       'Red',       '#E53935',  50),
  ('burgundy',  'Burgundy',  '#7A1F2B',  60),
  ('pink',      'Pink',      '#F48FB1',  70),
  ('rose',      'Rose',      '#E91E63',  80),
  ('orange',    'Orange',    '#FB8C00',  90),
  ('peach',     'Peach',     '#FFB088', 100),
  ('coral',     'Coral',     '#FF7B6B', 110),
  ('gold',      'Gold',      '#C9A227', 120),
  ('yellow',    'Yellow',    '#FDD835', 130),
  ('mustard',   'Mustard',   '#B9871A', 140),
  ('lime',      'Lime',      '#C6E04B', 150),
  ('green',     'Green',     '#2E7D32', 160),
  ('mint',      'Mint',      '#8FFF6E', 170),
  ('teal',      'Teal',      '#00897B', 180),
  ('cyan',      'Cyan',      '#009FEF', 190),
  ('sky',       'Sky',       '#7DC8F7', 200),
  ('blue',      'Blue',      '#1E6FD9', 210),
  ('navy',      'Navy',      '#0A1F44', 220),
  ('purple',    'Purple',    '#6A1B9A', 230),
  ('lavender',  'Lavender',  '#B39DDB', 240),
  ('brown',     'Brown',     '#5D4037', 250),
  ('beige',     'Beige',     '#D7C8A5', 260)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '123',
    'nex_color_palette · master palette seed (26 colours, numbered 10..260) · public-read / service-role-write',
    'Phase 1 Shoppe-grade variants. Sellers pick up to 10 per product from this list for attribute=''colour'' variants. Hex is the single source of truth for swatches shown to buyers everywhere.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT slug, label, hex FROM nex_color_palette ORDER BY sort_order;
--   SELECT count(*) FROM nex_color_palette WHERE is_active = true;
