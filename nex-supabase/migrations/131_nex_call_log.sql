-- ============================================================================
-- NEX-native Migration 131 · nex_call_log
-- ============================================================================
--
-- Per-viewer call-history table backing the /nex-native/calls hub's
-- "Recent calls" section. One row per viewer per call event · a 1:1
-- call between A and B produces two rows, one for A ("outgoing to B")
-- and one for B ("incoming from A"). This keeps RLS simple (viewer
-- sees only their own rows) and makes direction-filtering trivial.
--
-- Owner-scoped RLS. No shared/global call-history row. SA6 spirit:
-- call records are the viewer's own data, not a cross-account
-- observation table. If a counterparty's account is deleted (SA9
-- cryptographic erasure), the dangling peer_account_id surfaces as
-- an "unknown contact" placeholder; the viewer's row is retained.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '131';
--     DROP TABLE IF EXISTS nex_call_log CASCADE;
--   COMMIT;
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS nex_call_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Viewer this row belongs to. All reads are scoped to this via RLS.
  account_id UUID NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,
  -- The other party in the call. No FK CASCADE: viewer's row survives
  -- even if the counterparty's account is deleted.
  peer_account_id UUID NOT NULL,
  -- Optional link back to the peer conversation the call rode on.
  conversation_id UUID NULL,
  -- From the viewer's perspective.
  direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  media_type TEXT NOT NULL CHECK (media_type IN ('audio', 'video')),
  -- The viewer's resolved outcome. 'completed' = call connected and
  -- was then ended by either party. 'missed' = ring timed out /
  -- unanswered. 'declined' = someone explicitly declined. 'failed' =
  -- error (network, permissions, etc).
  outcome TEXT NOT NULL CHECK (outcome IN ('completed', 'missed', 'declined', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ NULL,
  duration_seconds INTEGER NULL CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Primary query path: viewer's most recent calls (plus filter by
-- direction/media/outcome which are composite inside the index).
CREATE INDEX IF NOT EXISTS nex_call_log_by_account_recent
  ON nex_call_log (account_id, started_at DESC);

CREATE INDEX IF NOT EXISTS nex_call_log_by_peer
  ON nex_call_log (account_id, peer_account_id, started_at DESC);

ALTER TABLE nex_call_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY nex_call_log_select_own
  ON nex_call_log FOR SELECT
  USING (
    account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())
  );

CREATE POLICY nex_call_log_insert_own
  ON nex_call_log FOR INSERT
  WITH CHECK (
    account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())
  );

-- Users may UPDATE their own rows (e.g. to patch ended_at + duration
-- after the call wraps up when we only had partial info at
-- call-start). No DELETE policy · call history is immutable to the
-- viewer; a future "clear history" affordance would require a
-- separate explicit policy + UI confirmation.
CREATE POLICY nex_call_log_update_own
  ON nex_call_log FOR UPDATE
  USING (
    account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())
  )
  WITH CHECK (
    account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())
  );

COMMENT ON TABLE nex_call_log IS
  'Per-viewer call history (one row per viewer per call). Owner-scoped RLS. Powers /nex-native/calls Recent calls.';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '131',
    'nex_call_log · per-viewer call history',
    'Stage 2 of NEX Calls hub. Owner-scoped RLS. Direction + media_type + outcome fields drive the filter dropdown.'
  );

COMMIT;
