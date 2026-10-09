-- ============================================================================
-- NEX-native Migration 101 · Bridge 98 · nex_business.social_links
-- ============================================================================
--
-- Founder-sealed 2026-09-30 · ONE NEX IDENTITY doctrine.
--
-- Adds `social_links` jsonb to nex_business so the CoverIdentityRail can
-- render the compact social/identity strip Founder specified — SEPARATE
-- from the sticky action bar (conversion) and part of the public identity
-- (discovery).
--
-- Structure (all keys optional):
--   {
--     "instagram": "mariascafe",
--     "tiktok":    "@mariascafe.bali",
--     "facebook":  "mariascafeubud",
--     "whatsapp":  "+62812XXXXXXXX",
--     "website":   "https://mariascafe.com",
--     "other":     [{ "label": "Threads", "url": "..." }]
--   }
--
-- Rendered as compact icon rail above `Powered by NEX`. Icons inherit the
-- theme's visual language (accent + charm palette) · never generic
-- black/white social-media footer treatment.
--
-- Applied via scripts/apply-nex-migration-101.mjs or psql.
--
-- Rollback (never in production):
--   BEGIN;
--     ALTER TABLE nex_business DROP COLUMN IF EXISTS social_links;
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_business
  ADD COLUMN IF NOT EXISTS social_links jsonb;

COMMENT ON COLUMN nex_business.social_links IS
  'Compact social/identity rail data for the public cover (Bridge 98).
   Structure: { instagram?, tiktok?, facebook?, whatsapp?, website?,
   other?: [{ label, url }] }. Rendered by CoverIdentityRail — SEPARATE
   from the sticky action bar (conversion) · part of the public identity
   (discovery). Icons inherit the theme''s visual language.';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '101',
    'Bridge 98 · nex_business.social_links jsonb · sealed 2026-09-30',
    'Adds social_links jsonb for CoverIdentityRail · discovery separate from conversion · icons inherit theme visual language.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;
