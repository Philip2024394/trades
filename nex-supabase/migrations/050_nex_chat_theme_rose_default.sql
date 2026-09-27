-- ============================================================================
-- NEX-native Migration 050 · Rose becomes the flagship free theme
-- ============================================================================
--
-- Founder direction 2026-09-27:
--   "go back to Maria rose theme and update the design and save as 1st
--    free theme, where user uploads their image and image id displaying
--    in hero section with page shadow fade from under page up on hero
--    image."
--
-- Rose IS the Portrait Bloom design. The user's own profile photo
-- (nex_account_profile.avatar_url · migration 045) fills the hero
-- and the abyss gradient rises from the bottom up onto the image.
-- This migration:
--   · promotes 'pink' to the very top of the free-theme list
--     (sort_order 30 → 5) so it renders first in the picker
--   · sharpens the tagline to describe the Portrait Bloom mechanic ·
--     "your face becomes the chat" — makes the identity contract
--     legible at a glance
--   · leaves hero_image_url null on purpose · with no fixed hero
--     the shell falls back to the account owner's uploaded avatar,
--     which IS the whole point of Rose
--
-- No new columns · no schema change · only a row update.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '050';
--     UPDATE nex_chat_theme
--        SET tagline = 'Warm pink · playful energy',
--            sort_order = 30
--      WHERE id = 'pink';
--   COMMIT;
-- ============================================================================

BEGIN;

UPDATE nex_chat_theme
   SET name        = 'Rose',
       tagline     = 'Your portrait blooms · your face becomes the chat',
       sort_order  = 5
 WHERE id = 'pink';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '050',
    'Rose theme promoted to flagship free position (sort_order 5) · Portrait Bloom identity tagline',
    'Founder-authorised 2026-09-27. Rose uses the account owner uploaded profile photo as the hero · no built-in hero_image_url. Fade-up gradient on top is the sealed Portrait Bloom design.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT id, name, tagline, sort_order FROM nex_chat_theme WHERE id = 'pink';
--   SELECT * FROM nex_migration_history WHERE version = '050';
