-- ============================================================================
-- NEX-native Migration 033 · nex_account_relationship_prefs
-- ============================================================================
-- Wave B Slice 3f-a · per-relationship preferences between two accounts.
--
-- MVP fields: theme-visibility for each side. When account A has
--   `a_shares_theme = true`, account B (looking at their conversation with
--   A) sees A's chat_theme applied to messages A sent. Independent per side.
--
-- Design:
--   · Canonical pair (a_account_id < b_account_id) · one row per
--     relationship regardless of who first toggled a pref. Matches
--     nex_friend_edge (migration 025) so identity semantics are consistent.
--   · Both booleans default false (opt-in privacy).
--   · FKs CASCADE on account delete so orphaned prefs cannot linger.
--   · updated_at bumped by trigger 002 (reused).
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '033';
--     DROP TABLE IF EXISTS nex_account_relationship_prefs;
--   COMMIT;
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS nex_account_relationship_prefs (
  a_account_id     uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,
  b_account_id     uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,
  a_shares_theme   boolean NOT NULL DEFAULT false,
  b_shares_theme   boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (a_account_id, b_account_id),
  CONSTRAINT nex_account_relationship_prefs_canonical CHECK (a_account_id < b_account_id)
);

COMMENT ON TABLE nex_account_relationship_prefs IS
  'Per-relationship preferences between two NEX accounts · canonical pair (a<b) · one row per pair · MVP has theme-share booleans (opt-in default false).';

CREATE INDEX IF NOT EXISTS idx_nex_relationship_prefs_a ON nex_account_relationship_prefs (a_account_id);
CREATE INDEX IF NOT EXISTS idx_nex_relationship_prefs_b ON nex_account_relationship_prefs (b_account_id);

-- Reuse the touch trigger from migration 002.
DROP TRIGGER IF EXISTS nex_relationship_prefs_touch ON nex_account_relationship_prefs;
CREATE TRIGGER nex_relationship_prefs_touch
  BEFORE UPDATE ON nex_account_relationship_prefs
  FOR EACH ROW EXECUTE FUNCTION nex_touch_updated_at();

ALTER TABLE nex_account_relationship_prefs ENABLE ROW LEVEL SECURITY;

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '033',
    'nex_account_relationship_prefs · canonical-pair per-relationship prefs · MVP theme-share',
    'Wave B Slice 3f-a · backend for the /nex-app ContactsPanel rewire · frontend panel wired in a later sub-slice.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;
