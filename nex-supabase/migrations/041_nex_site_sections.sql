-- ============================================================================
-- NEX-native Migration 041 · nex_generated_site · default sections
-- ============================================================================
-- Wave D Slice 16d · introduces the ordered `sections` array into params.
-- No column change · params is already jsonb · this migration only backfills
-- existing rows so their public page keeps rendering in the same order.
-- The DEFAULT_SECTIONS array below mirrors site-service.DEFAULT_SECTIONS.
-- ============================================================================

BEGIN;

UPDATE nex_generated_site
  SET params = jsonb_set(
    params,
    '{sections}',
    '["hero","banners","features","products","cta_band","hours_contact"]'::jsonb,
    true
  )
  WHERE NOT (params ? 'sections');

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '041',
    'Wave D Slice 16d · backfill nex_generated_site.params.sections with default order',
    'No column change · jsonb backfill only · new sections: features, cta_band. Existing rows keep working.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;
