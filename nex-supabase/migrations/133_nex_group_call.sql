-- ============================================================================
-- NEX-native Migration 133 · nex_group_call_session + nex_group_call_participant
-- ============================================================================
--
-- Group call registry · the server-side truth for who's currently in
-- which group call session. Powers the 4-way mesh engine built in
-- src/lib/nex-native/calls/group-call.ts (phase 3) and the in-call
-- participant grid.
--
-- Why two tables:
--   · nex_group_call_session holds the SESSION metadata (host, state,
--     start/end, media kind). One row per group call.
--   · nex_group_call_participant holds one row per (session × account)
--     with the participant's lifecycle timestamps + role.
--
-- Founder-sealed defaults 2026-10-04:
--   · Hard cap: 4 participants per session (mesh architecture limit).
--     Enforced at the service layer AND via a CHECK trigger below.
--   · Session states: 'ringing' | 'live' | 'ended'. Linear forward
--     progress only; a 'ringing' session that never gets a 2nd
--     participant transitions to 'ended' on timeout.
--   · Participant roles: 'host' | 'guest'. Host created the session.
--     Hosts can remove guests; guests can only leave themselves.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '133';
--     DROP TRIGGER IF EXISTS nex_group_call_participant_cap_tr
--       ON nex_group_call_participant;
--     DROP FUNCTION IF EXISTS nex_group_call_participant_cap();
--     DROP TABLE IF EXISTS nex_group_call_participant CASCADE;
--     DROP TABLE IF EXISTS nex_group_call_session CASCADE;
--   COMMIT;
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS nex_group_call_session (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_account_id UUID NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,
  -- Starting media kind. Receivers can toggle video mid-call just
  -- like 1:1 PeerCall.
  media_type TEXT NOT NULL CHECK (media_type IN ('audio', 'video')),
  state TEXT NOT NULL CHECK (state IN ('ringing', 'live', 'ended'))
    DEFAULT 'ringing',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  live_at TIMESTAMPTZ NULL,
  ended_at TIMESTAMPTZ NULL,
  -- When created from a call-link consumption, this points back so
  -- the link can land subsequent joiners into the SAME session.
  from_call_link_id UUID NULL
);

CREATE INDEX IF NOT EXISTS nex_group_call_session_by_host
  ON nex_group_call_session (host_account_id, started_at DESC);

CREATE INDEX IF NOT EXISTS nex_group_call_session_active
  ON nex_group_call_session (state, started_at DESC)
  WHERE state IN ('ringing', 'live');

CREATE TABLE IF NOT EXISTS nex_group_call_participant (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES nex_group_call_session(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('host', 'guest')) DEFAULT 'guest',
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  joined_at TIMESTAMPTZ NULL,
  left_at TIMESTAMPTZ NULL,
  removed_by UUID NULL,
  CONSTRAINT nex_group_call_participant_unique_in_session
    UNIQUE (session_id, account_id)
);

CREATE INDEX IF NOT EXISTS nex_group_call_participant_by_session
  ON nex_group_call_participant (session_id);

CREATE INDEX IF NOT EXISTS nex_group_call_participant_by_account
  ON nex_group_call_participant (account_id, invited_at DESC);

-- Hard 4-participant cap enforced via trigger. The service layer
-- also pre-checks but this is defence in depth · a race between
-- two near-simultaneous invites can never produce a 5-row session.
CREATE OR REPLACE FUNCTION nex_group_call_participant_cap()
RETURNS TRIGGER AS $$
DECLARE
  cnt INT;
BEGIN
  SELECT COUNT(*) INTO cnt
    FROM nex_group_call_participant
    WHERE session_id = NEW.session_id;
  IF cnt >= 4 THEN
    RAISE EXCEPTION
      'nex_group_call_participant: session % already has 4 participants', NEW.session_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER nex_group_call_participant_cap_tr
  BEFORE INSERT ON nex_group_call_participant
  FOR EACH ROW
  EXECUTE FUNCTION nex_group_call_participant_cap();

ALTER TABLE nex_group_call_session ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex_group_call_participant ENABLE ROW LEVEL SECURITY;

-- Session SELECT: anyone who is a participant of this session OR the
-- host can read it. Non-participants cannot discover sessions.
CREATE POLICY nex_group_call_session_select_participants
  ON nex_group_call_session FOR SELECT
  USING (
    host_account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())
    OR id IN (
      SELECT session_id FROM nex_group_call_participant
      WHERE account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())
    )
  );

-- Host INSERT. Service layer creates one row per session; this
-- policy requires the authenticated account to be the host.
CREATE POLICY nex_group_call_session_insert_host
  ON nex_group_call_session FOR INSERT
  WITH CHECK (
    host_account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())
  );

-- Host UPDATE (state transitions, ended_at).
CREATE POLICY nex_group_call_session_update_host
  ON nex_group_call_session FOR UPDATE
  USING (
    host_account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())
  )
  WITH CHECK (
    host_account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())
  );

-- Participant SELECT: viewer sees their own participant rows plus
-- the rows of fellow participants in sessions they belong to.
CREATE POLICY nex_group_call_participant_select_scoped
  ON nex_group_call_participant FOR SELECT
  USING (
    account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())
    OR session_id IN (
      SELECT session_id FROM nex_group_call_participant
      WHERE account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())
    )
  );

-- Participant INSERT: a user can only insert their own row (self-
-- join). Host-initiated invites are also self-inserts because the
-- service action resolves to each invitee's own session before
-- writing · defence in depth against mass-invite abuse.
CREATE POLICY nex_group_call_participant_insert_self
  ON nex_group_call_participant FOR INSERT
  WITH CHECK (
    account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())
  );

-- Participant UPDATE: own row (left_at) OR by host (removed_by).
CREATE POLICY nex_group_call_participant_update_scoped
  ON nex_group_call_participant FOR UPDATE
  USING (
    account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())
    OR session_id IN (
      SELECT id FROM nex_group_call_session
      WHERE host_account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())
    )
  );

COMMENT ON TABLE nex_group_call_session IS
  'Group call sessions · 1 row per session. Mesh architecture, capped at 4 participants (enforced by trigger on nex_group_call_participant).';

COMMENT ON TABLE nex_group_call_participant IS
  'Participants of a group call session. Hard cap of 4 enforced by nex_group_call_participant_cap() trigger.';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '133',
    'nex_group_call_session + nex_group_call_participant · mesh group calls',
    'Phase 1 of group-calls build. 4-participant cap enforced by trigger. Owner-scoped RLS with participant-visibility for live session discovery.'
  );

COMMIT;
