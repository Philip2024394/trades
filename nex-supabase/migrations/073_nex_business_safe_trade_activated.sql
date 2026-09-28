-- ============================================================================
-- NEX-native Migration 073 · Bridge 17d · Safe-trade activation
-- ============================================================================
--
-- Adds a boolean the seller must explicitly flip to signal they
-- commit to NEX safe-trade practices. Default false so new sellers
-- appear as "not yet activated" until they've read the doctrine and
-- opted in on /manage/shop.
--
-- Consumed by the TradeAgreementCard at the top of every commerce
-- chat · shows one of two messages:
--   true  · "Priya has safe trade activated"
--   false · "Priya has not yet activated safe trade · request
--            activation before placing order"
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '073';
--     ALTER TABLE nex_business DROP COLUMN IF EXISTS safe_trade_activated;
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_business
  ADD COLUMN IF NOT EXISTS safe_trade_activated boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN nex_business.safe_trade_activated IS
  'Seller has explicitly committed to NEX safe-trade practices via
   the toggle on /manage/shop. Default false · buyers see a warning
   card until the seller opts in. Sealed 2026-09-28 · Bridge 17d.';

CREATE INDEX IF NOT EXISTS idx_nex_business_safe_trade_activated
  ON nex_business (safe_trade_activated)
  WHERE safe_trade_activated = true;

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '073',
    'Bridge 17d · nex_business.safe_trade_activated boolean',
    'Founder-authorised 2026-09-28. Default false · seller must opt in from /manage/shop. Drives the compact TradeAgreementCard binary message at the top of every commerce chat.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;
