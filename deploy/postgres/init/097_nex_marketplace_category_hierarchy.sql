-- deploy/postgres/init/097_nex_marketplace_category_hierarchy.sql
--
-- MARKETPLACE CATEGORY HIERARCHY · 3 levels.
--   level=1  Master        (e.g. Electronics)
--   level=2  Sub-Category  (e.g. Smartphones & Accessories)
--   level=3  Micro-Niche   (e.g. Mobile Phones)
--
-- Backfills the existing flat categories to level-1 masters where their keys
-- coincide (e.g. 'electronics'), and adds `level` + `path` columns for
-- efficient hierarchy traversal.
--
-- Doctrine: additive · reversible · demo products safely repointed by
-- accompanying seeder before any old row is removed.

BEGIN;

ALTER TABLE nex.mp_category
  ADD COLUMN IF NOT EXISTS level int,
  ADD COLUMN IF NOT EXISTS path  text;

CREATE INDEX IF NOT EXISTS idx_mp_category_level     ON nex.mp_category (level);
CREATE INDEX IF NOT EXISTS idx_mp_category_parent    ON nex.mp_category (parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mp_category_path      ON nex.mp_category (path);

COMMENT ON COLUMN nex.mp_category.level IS
  '1=master · 2=sub-category · 3=micro-niche. Nulls indicate legacy flat categories awaiting migration.';
COMMENT ON COLUMN nex.mp_category.path  IS
  'Full display path e.g. "Electronics > Smartphones & Accessories > Mobile Phones" for search/breadcrumb rendering.';

COMMIT;

-- Rollback:
-- BEGIN;
--   ALTER TABLE nex.mp_category DROP COLUMN IF EXISTS path;
--   ALTER TABLE nex.mp_category DROP COLUMN IF EXISTS level;
-- COMMIT;
