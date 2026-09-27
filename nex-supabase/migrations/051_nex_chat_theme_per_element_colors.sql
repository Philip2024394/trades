-- ============================================================================
-- NEX-native Migration 051 · Per-element theme colours
-- ============================================================================
--
-- Founder direction 2026-09-27:
--   "for the theme owner for maria theme, there container bubble rim
--    will be the blue color and footer rim color text input will be
--    orange color"
--
-- Themes can now specify DIFFERENT colours for different UI elements
-- instead of one accent painting everything. Rose gets the flagship
-- treatment: blue bubble rims (identity signal) · orange composer rim
-- (action zone) · pink accent kept for ripple + portrait halo (brand).
--
-- Columns added:
--   · bubble_rim_hex     text · optional · nullable falls back to accent_hex
--   · composer_rim_hex   text · optional · nullable falls back to accent_hex
--
-- accent_hex remains the canonical brand colour · ripple + portrait
-- halo always paint with it. The two new columns are OVERRIDES that
-- specific elements adopt when the theme wants a multi-colour scheme.
--
-- All existing themes get nulls · they still render single-accent as
-- before (backward compatible).
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '051';
--     ALTER TABLE nex_chat_theme
--       DROP COLUMN IF EXISTS bubble_rim_hex,
--       DROP COLUMN IF EXISTS composer_rim_hex;
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_chat_theme
  ADD COLUMN IF NOT EXISTS bubble_rim_hex   text
    CHECK (bubble_rim_hex IS NULL OR bubble_rim_hex ~ '^#[0-9A-Fa-f]{6}$');

ALTER TABLE nex_chat_theme
  ADD COLUMN IF NOT EXISTS composer_rim_hex text
    CHECK (composer_rim_hex IS NULL OR composer_rim_hex ~ '^#[0-9A-Fa-f]{6}$');

COMMENT ON COLUMN nex_chat_theme.bubble_rim_hex IS
  'Optional override for message bubble rims · both incoming and outgoing · nullable falls back to accent_hex. Sealed 2026-09-27 for Rose theme multi-colour scheme.';
COMMENT ON COLUMN nex_chat_theme.composer_rim_hex IS
  'Optional override for the chat composer input rim · nullable falls back to accent_hex. Send button stays universal orange regardless.';

-- Rose · the flagship free theme · three-colour scheme
UPDATE nex_chat_theme
   SET bubble_rim_hex   = '#009FEF',
       composer_rim_hex = '#FF7800'
 WHERE id = 'pink';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '051',
    'nex_chat_theme.bubble_rim_hex + composer_rim_hex · per-element overrides · Rose gets blue bubbles + orange composer',
    'Founder-authorised 2026-09-27. Doctrine expands: themes can carry more than one colour · accent stays canonical for ripple + halo, new columns override specific elements. Backward compatible · null columns keep current single-accent behaviour.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT id, name, accent_hex, bubble_rim_hex, composer_rim_hex
--     FROM nex_chat_theme WHERE id IN ('pink', 'default');
