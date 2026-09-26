-- ============================================================================
-- NEX-native Migration 025 · nex_friend_edge · canonical friendship graph
-- ============================================================================
--
-- Purpose:
--   Wave B Slice 9a · opens the "Social" keypad capability with the FRIEND
--   layer (intent bubbles land in a later slice · this is the underlying
--   relationship graph).
--
--   Canonical-pair design:
--     · Each friendship / invite is stored as ONE row (not two mirrored).
--     · a_account_id < b_account_id (lex sort of UUIDs) · enforced by CHECK.
--     · The row's `requested_by` names which side sent the invite.
--     · This makes "does an edge already exist between (X, Y)?" a single
--       primary-key lookup independent of who initiated.
--
--   Status state machine (enforced by service layer for now · a follow-up
--   slice can add a trigger if needed):
--     · pending   → accepted · declined
--     · accepted  → (stable · unfriend deletes the row · not a status change)
--     · declined  → pending (allowed · lets a rejected invite be re-sent)
--
-- Doctrine:
--   · Identity Doctrine · every FK references nex_account.id (UUID)
--   · Anti-fabrication · self-friend blocked by CHECK a_account_id < b_account_id
--   · No fourth account architecture · pair uniqueness enforced by PK
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '025';
--     DROP TABLE IF EXISTS nex_friend_edge;
--   COMMIT;
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS nex_friend_edge (
  a_account_id   uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,
  b_account_id   uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,
  requested_by   uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,
  status         text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (a_account_id, b_account_id),
  CONSTRAINT nex_friend_edge_canonical CHECK (a_account_id < b_account_id),
  CONSTRAINT nex_friend_edge_status_known CHECK (status IN ('pending', 'accepted', 'declined')),
  CONSTRAINT nex_friend_edge_requested_by_is_participant CHECK (
    requested_by = a_account_id OR requested_by = b_account_id
  )
);

COMMENT ON TABLE nex_friend_edge IS
  'Canonical friendship graph · one row per pair · a_account_id < b_account_id · requested_by identifies the inviting side · status = pending | accepted | declined.';

CREATE INDEX IF NOT EXISTS idx_nex_friend_edge_status
  ON nex_friend_edge (status);
CREATE INDEX IF NOT EXISTS idx_nex_friend_edge_a
  ON nex_friend_edge (a_account_id, status);
CREATE INDEX IF NOT EXISTS idx_nex_friend_edge_b
  ON nex_friend_edge (b_account_id, status);

-- Maintain updated_at on any row update (reuses touch_updated_at from
-- migration 002; if missing we fall back to inline pg_trigger).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'nex_touch_updated_at') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_nex_friend_edge_touch_updated_at ON nex_friend_edge';
    EXECUTE 'CREATE TRIGGER trg_nex_friend_edge_touch_updated_at
             BEFORE UPDATE ON nex_friend_edge
             FOR EACH ROW EXECUTE FUNCTION nex_touch_updated_at()';
  END IF;
END $$;

ALTER TABLE nex_friend_edge ENABLE ROW LEVEL SECURITY;
-- Service-role only for now · authenticated policies deferred to when a
-- dedicated /nex-native/friends surface ships in Slice 9b.

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '025',
    'nex_friend_edge · canonical friendship graph · pending/accepted/declined',
    'Wave B Slice 9a · Founder-authorised keypad build 2026-09-24. Backend only · UI in Slice 9b. Canonical pair (a<b) with requested_by disambiguation.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ============================================================================
-- Post-apply verification:
--   SELECT tablename FROM pg_tables WHERE tablename = 'nex_friend_edge';
--     -- expect: 1 row
--   SELECT conname FROM pg_constraint
--    WHERE conrelid = 'nex_friend_edge'::regclass
--      AND conname IN ('nex_friend_edge_canonical',
--                       'nex_friend_edge_status_known',
--                       'nex_friend_edge_requested_by_is_participant');
--     -- expect: 3 rows
--   SELECT indexname FROM pg_indexes
--    WHERE tablename = 'nex_friend_edge';
--     -- expect: 3+ indexes (PK + status + a + b)
-- ============================================================================
