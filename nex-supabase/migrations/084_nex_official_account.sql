-- ============================================================================
-- NEX-native Migration 084 · Bridge 31 · NEX1 canonical support account
-- ============================================================================
--
-- Seeds the NEX official support account · a real nex_account row that
-- every user can chat with for upgrade help, feature questions, and
-- account support. Founder direction 2026-09-28.
--
-- Identity:
--   id            00000000-0000-0000-0000-000000000001  (fixed sentinel)
--   nex_handle    nex-00001                               (below counter start)
--   display_name  NEX
--   chat_theme    default                                 (NEX cyan)
--   supabase_user_id  NULL                                (no auth login yet)
--
-- Why a fixed UUID:
--   Application code references this account via a well-known constant
--   NEX_OFFICIAL_ACCOUNT_ID · fixed UUID means no lookup indirection in
--   hot paths (settings pages, tier upgrade CTAs, "Chat with NEX" links).
--
-- Why nex-00001:
--   The sequential handle allocator (migration 013) starts its counter at
--   10000, so nex-00001 through nex-09999 are permanently reserved for
--   system accounts. Passes the nex-[0-9]{5,} format CHECK. Cannot
--   collide with any real allocated handle.
--
-- Idempotent · ON CONFLICT DO UPDATE keeps display_name / handle / theme
-- in sync if the migration is re-applied after admin edits.
--
-- Not seeded:
--   · supabase_user_id  · Founder can wire NEX's own login later by
--                          updating this column to a real auth.users id.
--   · avatar / profile   · Handled via nex_account_profile in a follow-up.
--   · verified flag      · Different verification model (nex_business
--                          has verified_at; nex_account uses is_official
--                          which is a future column).
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '084';
--     DELETE FROM nex_account WHERE id = '00000000-0000-0000-0000-000000000001';
--   COMMIT;
-- ============================================================================

BEGIN;

INSERT INTO nex_account (id, supabase_user_id, display_name, nex_handle, chat_theme)
  VALUES (
    '00000000-0000-0000-0000-000000000001'::uuid,
    NULL,
    'NEX',
    'nex-00001',
    'default'
  )
  ON CONFLICT (id) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        nex_handle   = EXCLUDED.nex_handle,
        chat_theme   = EXCLUDED.chat_theme;

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '084',
    'Bridge 31 · NEX1 canonical support account · fixed UUID + handle nex-00001',
    'Founder-authorised 2026-09-28. Seeds the official NEX support account that all users can chat with for upgrades / feature questions / account help. Handle nex-00001 lives below the 10000-counter allocator boundary so it cannot collide with user allocations. supabase_user_id NULL · Founder can wire login later.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT id, nex_handle, display_name, chat_theme
--     FROM nex_account
--    WHERE id = '00000000-0000-0000-0000-000000000001';
--   -- expect one row · handle nex-00001 · name NEX
