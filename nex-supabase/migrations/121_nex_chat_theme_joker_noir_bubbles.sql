-- ============================================================================
-- NEX-native Migration 121 · Joker theme · Noir-restraint bubbles + composer
-- ============================================================================
--
-- Pulls back the toxic-green (#8FFF6E) chrome on outgoing bubbles and the
-- composer so the Joker theme reads as noir — "night alley with occasional
-- green light" instead of "neon dungeon." The accent stays acid-green so
-- signature moments (send button, action chips, read receipts, Wise Card,
-- lightning) still bite; it's only the always-on bubble/composer rim that
-- gets dialled back to a muted dark-green hairline so legibility and
-- cinematic restraint win on the message surface itself.
--
--   accent_hex       = '#8FFF6E'   · unchanged · signature acid green
--   bubble_rim_hex   = '#2C4A33'   · muted forest · thin dark hairline
--   composer_rim_hex = '#2C4A33'   · same muted forest · belongs to the
--                                     message surface, not the overlay
--                                     accents
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '121';
--     UPDATE nex_chat_theme
--        SET bubble_rim_hex = NULL,
--            composer_rim_hex = NULL
--      WHERE id = 'theme-0';
--   COMMIT;
-- ============================================================================

BEGIN;

UPDATE nex_chat_theme
   SET bubble_rim_hex   = '#2C4A33',
       composer_rim_hex = '#2C4A33',
       updated_at       = now()
 WHERE id = 'theme-0';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '121',
    'Joker theme · noir-restraint bubbles + composer · muted dark-green rims so the toxic-green accent punctuates instead of saturating',
    'Founder-authorised 2026-10-01. Accent (#8FFF6E) unchanged; only the always-on bubble + composer rims pulled back to #2C4A33. Signature moments (send button, action chips, read receipts, Wise Card, lightning) still carry the acid green.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT id, name, accent_hex, bubble_rim_hex, composer_rim_hex
--     FROM nex_chat_theme WHERE id='theme-0';
