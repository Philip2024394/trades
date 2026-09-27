-- ============================================================================
-- NEX-native Migration 048 · Bridge 4 · nex_chat_theme
-- ============================================================================
--
-- Purpose:
--   Move chat theme definitions from a hardcoded switch statement in
--   the peer chat page into a first-class table. Admin can now create
--   and edit themes via /nex-native/admin/theme/new · users see them
--   in the /settings/theme picker · Bisnis-tier gating decides which
--   themes each account can activate.
--
-- Doctrine (sealed 2026-09-27 · doctrine_theme_ownership_2026_09_27.md):
--   Your chat_theme is your PUBLIC visual identity. Every friend
--   sees your theme when they open your chat. Free tier gets the
--   base themes · Bisnis unlocks premium ready-made themes.
--
-- Schema:
--   · id                slug primary key (matches nex_account.chat_theme values)
--   · name              display name
--   · tagline           short marketing line
--   · accent_hex        the primary colour used for bubble rims, composer,
--                       ripple, presence highlights
--   · tier              'gratis' (always usable) | 'bisnis' (needs upgrade)
--   · category          'standard' (base library) | 'premium' (ready-made)
--   · hero_image_url    optional image · reserved for future portrait /
--                       background variants · text URL only for now,
--                       upload pipeline comes later
--   · is_active         false hides from picker without deleting
--   · sort_order        numeric · lower renders first in the picker
--
-- Seed:
--   Ships with 5 gratis + 3 premium themes so the picker has real
--   content on first load. Existing nex_account.chat_theme values
--   (default / titanium / pink / gold / night) are all seeded so no
--   account row breaks.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '048';
--     DROP TABLE IF EXISTS nex_chat_theme;
--   COMMIT;
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS nex_chat_theme (
  id              text PRIMARY KEY CHECK (id ~ '^[a-z][a-z0-9_-]{1,30}$'),
  name            text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 60),
  tagline         text CHECK (tagline IS NULL OR length(tagline) <= 200),
  accent_hex      text NOT NULL CHECK (accent_hex ~ '^#[0-9A-Fa-f]{6}$'),
  tier            text NOT NULL DEFAULT 'gratis' CHECK (tier IN ('gratis', 'bisnis')),
  category        text NOT NULL DEFAULT 'standard' CHECK (category IN ('standard', 'premium')),
  hero_image_url  text CHECK (hero_image_url IS NULL OR char_length(hero_image_url) <= 1024),
  is_active       boolean NOT NULL DEFAULT true,
  sort_order      integer NOT NULL DEFAULT 100,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE nex_chat_theme IS
  'Chat theme catalogue · every value that nex_account.chat_theme may hold ships as a row here · gratis themes are always usable, bisnis themes require the account to be on an active Bisnis subscription (checked at picker time via tier-gate). Sealed 2026-09-27.';

CREATE INDEX IF NOT EXISTS idx_nex_chat_theme_active_sort
  ON nex_chat_theme (is_active, sort_order, id);

-- Row-Level Security ----------------------------------------------------------
ALTER TABLE nex_chat_theme ENABLE ROW LEVEL SECURITY;

-- Everyone can read active themes · needed for the picker to render.
DROP POLICY IF EXISTS nex_chat_theme_select ON nex_chat_theme;
CREATE POLICY nex_chat_theme_select
  ON nex_chat_theme FOR SELECT
  USING (is_active = true);

-- Writes go through the admin route with the service-role key. RLS
-- deliberately does NOT allow insert / update / delete under auth ·
-- there is no user path that should be creating themes.

-- Trigger · maintain updated_at ------------------------------------------------
CREATE OR REPLACE FUNCTION nex_chat_theme_touch_updated_at()
  RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS nex_chat_theme_updated_at ON nex_chat_theme;
CREATE TRIGGER nex_chat_theme_updated_at
  BEFORE UPDATE ON nex_chat_theme
  FOR EACH ROW EXECUTE FUNCTION nex_chat_theme_touch_updated_at();

-- Seed data · the 5 standard themes (gratis) + 3 premium (bisnis) ------------
INSERT INTO nex_chat_theme (id, name, tagline, accent_hex, tier, category, sort_order)
VALUES
  ('default',  'Origin',   'The NEX standard · free forever',              '#00AFFF', 'gratis', 'standard', 10),
  ('titanium', 'Titanium', 'Silver metal · calm confidence',               '#B0B7C3', 'gratis', 'standard', 20),
  ('pink',     'Rose',     'Warm pink · playful energy',                   '#EC4899', 'gratis', 'standard', 30),
  ('gold',     'Gold',     'Amber warmth · timeless craftsmanship',        '#F59E0B', 'gratis', 'standard', 40),
  ('night',    'Night',    'Deep blue · focused presence',                 '#3B82F6', 'gratis', 'standard', 50),
  -- Premium · locked until Bisnis
  ('aurora',   'Aurora',   'Green northern lights · rare and alive',       '#00FFB4', 'bisnis', 'premium',  100),
  ('sunset',   'Sunset',   'Molten orange · endless summer',               '#FF6B4A', 'bisnis', 'premium',  110),
  ('obsidian', 'Obsidian', 'Volcanic red · high-contrast luxury',          '#FF3355', 'bisnis', 'premium',  120)
ON CONFLICT (id) DO UPDATE
  SET name        = EXCLUDED.name,
      tagline     = EXCLUDED.tagline,
      accent_hex  = EXCLUDED.accent_hex,
      tier        = EXCLUDED.tier,
      category    = EXCLUDED.category,
      sort_order  = EXCLUDED.sort_order;

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '048',
    'Bridge 4 · nex_chat_theme catalogue table + 8 seed themes',
    'Founder-authorised 2026-09-27. Themes: 5 gratis standard + 3 bisnis premium. Admin builder at /nex-native/admin/theme/new · user picker at /nex-native/settings/theme.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT id, tier, category, accent_hex FROM nex_chat_theme ORDER BY sort_order;
--   SELECT policyname FROM pg_policies WHERE tablename = 'nex_chat_theme';
--   SELECT * FROM nex_migration_history WHERE version = '048';
