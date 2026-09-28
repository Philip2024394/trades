-- Bridge 23a · Restaurant dish upgrades · sealed 2026-09-28.
-- ----------------------------------------------------------
-- Two additive changes to nex_menu_item:
--
--   1. Widen spice_level from 0-3 → 0-5 so restaurants can express
--      the full mild/medium/hot/very-hot/volcano spectrum with
--      chilli-glyph rendering on the buyer surfaces.
--
--   2. Add `perks text[]` + `perks_note text` for the free-perk
--      concept ("Buy 1 Get 1 Free", "Free drink", "Free rice",
--      "Free fries", "Free delivery"). Allowed values are enforced
--      at the service boundary · the array stays free-form text[]
--      so we can add new perk kinds without a migration each time.
--      A dish with the 'free_delivery' perk renders a prominent
--      badge on the menu page + dish bubble.
--
-- Existing rows keep spice_level 0-3 unchanged · new upper bound
-- is inclusive. Perks columns default empty. No data migration
-- needed.
--
-- Rollback:
--   BEGIN;
--     ALTER TABLE nex_menu_item
--       DROP CONSTRAINT IF EXISTS nex_menu_item_spice_level_check,
--       ADD  CONSTRAINT nex_menu_item_spice_level_check
--         CHECK (spice_level BETWEEN 0 AND 3),
--       DROP COLUMN IF EXISTS perks,
--       DROP COLUMN IF EXISTS perks_note;
--     DELETE FROM nex_migration_history WHERE version = '079';
--   COMMIT;

BEGIN;

-- 1. Widen the CHECK constraint to 0-5.
ALTER TABLE public.nex_menu_item
  DROP CONSTRAINT IF EXISTS nex_menu_item_spice_level_check;

ALTER TABLE public.nex_menu_item
  ADD CONSTRAINT nex_menu_item_spice_level_check
  CHECK (spice_level BETWEEN 0 AND 5);

COMMENT ON COLUMN public.nex_menu_item.spice_level IS
  '0 = none · 1 = mild · 2 = medium · 3 = hot · 4 = very hot · 5 = volcano. Renders as chili glyph count on the menu page + dish bubble.';

-- 2. Perks · array of tokens the service normalises to a fixed set
-- (bogo / free_drink / free_rice / free_fries / free_delivery / other).
ALTER TABLE public.nex_menu_item
  ADD COLUMN IF NOT EXISTS perks text[] NOT NULL DEFAULT ARRAY[]::text[];

ALTER TABLE public.nex_menu_item
  ADD COLUMN IF NOT EXISTS perks_note text;

COMMENT ON COLUMN public.nex_menu_item.perks IS
  'Free-perk tokens · service normalises to bogo / free_drink / free_rice / free_fries / free_delivery / other. Renders as icon badges on buyer surfaces · free_delivery gets a prominent 🚚 pill.';
COMMENT ON COLUMN public.nex_menu_item.perks_note IS
  'Optional custom note when perks contains ''other'' · e.g. "Free tea refills for 1 hour" or "Second free item chef''s choice".';

INSERT INTO public.nex_migration_history (version, description, notes)
  VALUES (
    '079',
    'Bridge 23a · spice_level widened 0-5 · perks text[] + perks_note text on nex_menu_item',
    'Founder-authorised 2026-09-28. Restaurants can now express volcano-level spice + attach free-perk chips to dishes. free_delivery is the flagship perk and renders prominently on the menu page + dish bubble.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT conname, pg_get_constraintdef(oid)
--     FROM pg_constraint
--    WHERE conrelid = 'public.nex_menu_item'::regclass
--      AND conname LIKE '%spice_level%';
--
--   SELECT column_name, data_type
--     FROM information_schema.columns
--    WHERE table_name = 'nex_menu_item'
--      AND column_name IN ('perks', 'perks_note');
