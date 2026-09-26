-- ============================================================================
-- NEX-native Migration 009 · nex_message hard immutability (Wave 3.1 · C3)
-- ============================================================================
--
-- Wave 3 §5 recorded an honest gap: nex_message immutability was protected
-- only by (a) service layer omitting an updateMessage export, and (b) RLS
-- policies blocking authenticated writes. But service-role bypasses RLS ·
-- so casual direct admin-client UPDATE/DELETE of a nex_message row would
-- succeed silently.
--
-- Wave 3.1 hardens this at the DB layer with BEFORE UPDATE and BEFORE DELETE
-- triggers that RAISE EXCEPTION regardless of role. Immutability now holds
-- even when a caller has service-role credentials.
--
-- INSERT and SELECT continue to work as designed.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '009';
--     DROP TRIGGER IF EXISTS trg_nex_message_no_update ON nex_message;
--     DROP TRIGGER IF EXISTS trg_nex_message_no_delete ON nex_message;
--     DROP FUNCTION IF EXISTS nex_reject_message_mutation();
--   COMMIT;
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION nex_reject_message_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'nex_message is immutable · UPDATE rejected'
      USING ERRCODE = 'check_violation';
  ELSIF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'nex_message is immutable · DELETE rejected'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL; -- unreachable · RAISE aborts the txn
END;
$$;

COMMENT ON FUNCTION nex_reject_message_mutation() IS
  'Rejects any UPDATE or DELETE on nex_message · enforces immutability at DB layer regardless of role. INSERT and SELECT unaffected.';

DROP TRIGGER IF EXISTS trg_nex_message_no_update ON nex_message;
CREATE TRIGGER trg_nex_message_no_update
  BEFORE UPDATE ON nex_message
  FOR EACH ROW
  EXECUTE FUNCTION nex_reject_message_mutation();

DROP TRIGGER IF EXISTS trg_nex_message_no_delete ON nex_message;
CREATE TRIGGER trg_nex_message_no_delete
  BEFORE DELETE ON nex_message
  FOR EACH ROW
  EXECUTE FUNCTION nex_reject_message_mutation();

INSERT INTO nex_migration_history (version, description, notes)
VALUES ('009', 'nex_message hard immutability · BEFORE UPDATE + BEFORE DELETE triggers · service-role has no bypass', 'Wave 3.1 · C3 · closes soft-immutability gap · INSERT and SELECT continue to work.')
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT * FROM nex_migration_history WHERE version = '009';
--   SELECT tgname FROM pg_trigger
--     WHERE tgname IN ('trg_nex_message_no_update','trg_nex_message_no_delete');
