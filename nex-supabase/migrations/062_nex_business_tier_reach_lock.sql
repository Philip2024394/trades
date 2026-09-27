-- ============================================================================
-- NEX-native Migration 062 · Gratis-tier → local_only reach lock
-- ============================================================================
--
-- Doctrine (sealed 2026-09-27): the Bisnis subscription unlocks export.
-- Free/Gratis sellers stay on the local market. This trigger enforces
-- that at the DB level so no code path can accidentally give a Gratis
-- seller international visibility:
--
--   · INSERT / UPDATE on nex_business · if the owner is 'gratis',
--     market_reach snaps to 'local_only' regardless of what was
--     submitted.
--   · UPDATE on nex_account.tier · when a seller downgrades from
--     'bisnis' to 'gratis', every business they own has its
--     market_reach reset to 'local_only'. When they upgrade to
--     'bisnis', existing rows keep whatever value they had (default
--     'local_only' from the downgrade era) and the seller can then
--     switch to 'both' or 'export_only' via the setup form.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '062';
--     DROP TRIGGER IF EXISTS nex_business_tier_reach_trigger ON nex_business;
--     DROP TRIGGER IF EXISTS nex_account_tier_reach_sync_trigger ON nex_account;
--     DROP FUNCTION IF EXISTS nex_enforce_gratis_local_reach();
--     DROP FUNCTION IF EXISTS nex_sync_businesses_on_tier_change();
--   COMMIT;
-- ============================================================================

BEGIN;

-- 1. Enforce on nex_business insert/update
CREATE OR REPLACE FUNCTION nex_enforce_gratis_local_reach()
RETURNS TRIGGER AS $$
DECLARE
  owner_tier text;
BEGIN
  SELECT tier INTO owner_tier
    FROM nex_account
   WHERE id = NEW.owner_account_id;
  IF owner_tier IS NULL OR owner_tier = 'gratis' THEN
    NEW.market_reach := 'local_only';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS nex_business_tier_reach_trigger ON nex_business;
CREATE TRIGGER nex_business_tier_reach_trigger
  BEFORE INSERT OR UPDATE ON nex_business
  FOR EACH ROW EXECUTE FUNCTION nex_enforce_gratis_local_reach();

-- 2. Sync businesses when nex_account.tier flips
--    (Bisnis → Gratis · reset every owned business to 'local_only'.
--     Gratis → Bisnis · leave values alone so the seller can pick
--     'both' or 'export_only' in the setup form.)
CREATE OR REPLACE FUNCTION nex_sync_businesses_on_tier_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tier = 'gratis' AND OLD.tier <> 'gratis' THEN
    UPDATE nex_business
       SET market_reach = 'local_only'
     WHERE owner_account_id = NEW.id
       AND market_reach <> 'local_only';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS nex_account_tier_reach_sync_trigger ON nex_account;
CREATE TRIGGER nex_account_tier_reach_sync_trigger
  AFTER UPDATE OF tier ON nex_account
  FOR EACH ROW
  WHEN (OLD.tier IS DISTINCT FROM NEW.tier)
  EXECUTE FUNCTION nex_sync_businesses_on_tier_change();

-- 3. Backfill · any existing rows owned by gratis accounts snap to
--    local_only right now so state is consistent from day one.
UPDATE nex_business b
   SET market_reach = 'local_only'
  FROM nex_account a
 WHERE b.owner_account_id = a.id
   AND a.tier = 'gratis'
   AND b.market_reach <> 'local_only';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '062',
    'Gratis tier locked to market_reach=local_only via trigger · Bisnis unlocks export',
    'Founder-authorised 2026-09-27. Sealed doctrine: Gratis sellers stay local, Bisnis subscription unlocks international directory visibility.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT b.slug, a.tier, b.market_reach
--     FROM nex_business b JOIN nex_account a ON a.id = b.owner_account_id;
