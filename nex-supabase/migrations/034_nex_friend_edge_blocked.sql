-- ============================================================================
-- NEX-native Migration 034 · nex_friend_edge · add 'blocked' status
-- ============================================================================
-- Wave B Slice 9d · closes the Friends capability with a "block" state.
--
-- Semantics:
--   · status='blocked' + requested_by=X   means X blocked the other party.
--   · A blocked row survives across friend-remove: the canonical pair
--     stays occupied so re-invite from either side is rejected.
--   · Only the blocker (requested_by) can unblock (removes the row).
--   · CASCADE on nex_account delete still drops all blocked rows.
--
-- The prior CHECK (migration 025) allowed 'pending','accepted','declined'.
-- We drop it and re-add with 'blocked' included.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '034';
--     ALTER TABLE nex_friend_edge DROP CONSTRAINT IF EXISTS nex_friend_edge_status_known;
--     ALTER TABLE nex_friend_edge
--       ADD CONSTRAINT nex_friend_edge_status_known
--         CHECK (status IN ('pending','accepted','declined'));
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_friend_edge
  DROP CONSTRAINT IF EXISTS nex_friend_edge_status_known;

ALTER TABLE nex_friend_edge
  ADD CONSTRAINT nex_friend_edge_status_known
    CHECK (status IN ('pending','accepted','declined','blocked'));

COMMENT ON COLUMN nex_friend_edge.status IS
  'pending · accepted · declined · blocked (from Slice 9d · requested_by identifies the blocker · unblock deletes row)';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '034',
    'nex_friend_edge.status extended with blocked · Slice 9d',
    'Blocker identified via requested_by · unblock is DELETE by blocker only.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;
