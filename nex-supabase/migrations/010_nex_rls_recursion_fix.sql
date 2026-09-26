-- ============================================================================
-- NEX-native Migration 010 · RLS recursion fix (Wave 3.1 · discovered
-- during authenticated per-user isolation testing)
-- ============================================================================
--
-- Bug: nex_conversation policy inline-selects from nex_conversation_participant;
--      nex_conversation_participant policy inline-selects from nex_conversation.
--      Under an authenticated JWT, evaluating either policy triggers the other,
--      producing "infinite recursion detected in policy" errors.
--
-- Wave 3 anon-boundary test did NOT catch this because anon (no auth.uid())
-- short-circuits every USING clause to empty · policy body never actually
-- executes the recursive sub-select. Only surfaced when Wave 3.1 signed in
-- real users A and B.
--
-- Fix: replace recursive inline sub-selects with SECURITY DEFINER helper
-- functions. This is the standard Supabase pattern for cross-table RLS
-- without recursion. Policy intent is UNCHANGED · only the mechanical
-- implementation swaps to SECURITY DEFINER helpers so the sub-select does
-- not re-enter the RLS engine.
--
-- Policies affected:
--   nex_conversation_participant_read           on nex_conversation
--   nex_conversation_participant_self_read      on nex_conversation_participant
--   nex_message_participant_read                on nex_message
--   nex_message_participant_insert              on nex_message
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '010';
--     -- Recreate original recursive policies (see migration 004 body)
--     -- Drop helper functions
--     DROP FUNCTION IF EXISTS nex_current_account_ids();
--     DROP FUNCTION IF EXISTS nex_current_owned_business_ids();
--     DROP FUNCTION IF EXISTS nex_current_participant_conversation_ids();
--     DROP FUNCTION IF EXISTS nex_conversations_of_my_businesses();
--   COMMIT;
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- SECURITY DEFINER helper functions
-- Run with the definer's privileges (bypasses RLS during their own execution).
-- STABLE so PG can memoise them within a query.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION nex_current_account_ids()
RETURNS SETOF uuid
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT id FROM nex_account WHERE supabase_user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION nex_current_owned_business_ids()
RETURNS SETOF uuid
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT b.id
    FROM nex_business b
    JOIN nex_account a ON a.id = b.owner_account_id
   WHERE a.supabase_user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION nex_current_participant_conversation_ids()
RETURNS SETOF uuid
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT p.conversation_id
    FROM nex_conversation_participant p
    JOIN nex_account a ON a.id = p.account_id
   WHERE a.supabase_user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION nex_conversations_of_my_businesses()
RETURNS SETOF uuid
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT c.id
    FROM nex_conversation c
    JOIN nex_business b ON b.id = c.business_id
    JOIN nex_account a ON a.id = b.owner_account_id
   WHERE a.supabase_user_id = auth.uid();
$$;

COMMENT ON FUNCTION nex_current_account_ids() IS 'SECURITY DEFINER helper · returns nex_account ids for the current JWT · used by RLS to avoid recursive sub-selects.';
COMMENT ON FUNCTION nex_current_owned_business_ids() IS 'SECURITY DEFINER helper · returns nex_business ids owned by the current JWT.';
COMMENT ON FUNCTION nex_current_participant_conversation_ids() IS 'SECURITY DEFINER helper · returns nex_conversation ids the current JWT is a participant in.';
COMMENT ON FUNCTION nex_conversations_of_my_businesses() IS 'SECURITY DEFINER helper · returns nex_conversation ids on businesses owned by the current JWT.';

-- ---------------------------------------------------------------------------
-- Rewrite policies using helpers · intent unchanged
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS nex_conversation_participant_read ON nex_conversation;
CREATE POLICY nex_conversation_participant_read
  ON nex_conversation
  FOR SELECT
  TO authenticated
  USING (
    id IN (SELECT nex_current_participant_conversation_ids())
    OR business_id IN (SELECT nex_current_owned_business_ids())
  );

DROP POLICY IF EXISTS nex_conversation_participant_self_read ON nex_conversation_participant;
CREATE POLICY nex_conversation_participant_self_read
  ON nex_conversation_participant
  FOR SELECT
  TO authenticated
  USING (
    account_id IN (SELECT nex_current_account_ids())
    OR conversation_id IN (SELECT nex_conversations_of_my_businesses())
  );

DROP POLICY IF EXISTS nex_message_participant_read ON nex_message;
CREATE POLICY nex_message_participant_read
  ON nex_message
  FOR SELECT
  TO authenticated
  USING (
    conversation_id IN (SELECT nex_current_participant_conversation_ids())
    OR conversation_id IN (SELECT nex_conversations_of_my_businesses())
  );

DROP POLICY IF EXISTS nex_message_participant_insert ON nex_message;
CREATE POLICY nex_message_participant_insert
  ON nex_message
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_account_id IN (SELECT nex_current_account_ids())
    AND conversation_id IN (SELECT nex_current_participant_conversation_ids())
  );

INSERT INTO nex_migration_history (version, description, notes)
VALUES ('010', 'RLS recursion fix · replace recursive inline sub-selects with SECURITY DEFINER helpers · policy intent unchanged', 'Wave 3.1 · discovered during authenticated isolation testing · anon-boundary test did not surface this because anon short-circuits USING clauses.')
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT * FROM nex_migration_history WHERE version = '010';
--   SELECT proname FROM pg_proc
--    WHERE proname IN ('nex_current_account_ids','nex_current_owned_business_ids',
--                      'nex_current_participant_conversation_ids','nex_conversations_of_my_businesses');
