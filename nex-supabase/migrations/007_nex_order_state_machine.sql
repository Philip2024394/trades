-- ============================================================================
-- NEX-native Migration 007 · nex_order state machine hardening (Wave 3.1 · C1)
-- ============================================================================
--
-- Wave 3 §5 recorded an honest gap: the DB CHECK on nex_order.state accepts
-- any of the six valid state VALUES, but has no transition rules · so a row
-- could jump 'created' → 'refunded' or move backwards from 'completed'.
--
-- This migration structurally enforces the NEX-native order lifecycle at
-- the DB layer via BEFORE UPDATE trigger. Service-role and authenticated
-- callers alike are subject to the trigger · no bypass path from any role.
--
-- Lifecycle (NEX-native · simple):
--
--   created ─┬─→ pending ─→ paid ─┬─→ completed ─→ refunded (terminal)
--            │             │      └─→ refunded (terminal)
--            │             └─→ cancelled (terminal)
--            ├─→ cancelled (terminal · pre-payment)
--            └─→ paid (shortcut: created directly to paid for simple checkout)
--
-- Transition rules:
--   created   → pending · cancelled · paid
--   pending   → paid · cancelled
--   paid      → completed · refunded
--   completed → refunded
--   cancelled → (terminal · no exit)
--   refunded  → (terminal · no exit)
--
-- No-op transitions (OLD.state = NEW.state) are allowed to keep UPDATEs of
-- unrelated columns safe.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '007';
--     DROP TRIGGER IF EXISTS trg_nex_order_state_machine ON nex_order;
--     DROP FUNCTION IF EXISTS nex_validate_order_transition();
--   COMMIT;
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION nex_validate_order_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- no-op UPDATE (state didn't change) is fine · other columns may be edited
  IF OLD.state = NEW.state THEN
    RETURN NEW;
  END IF;

  IF (OLD.state = 'created'   AND NEW.state IN ('pending', 'cancelled', 'paid')) OR
     (OLD.state = 'pending'   AND NEW.state IN ('paid', 'cancelled'))            OR
     (OLD.state = 'paid'      AND NEW.state IN ('completed', 'refunded'))        OR
     (OLD.state = 'completed' AND NEW.state = 'refunded')
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'nex_order: invalid state transition % -> %', OLD.state, NEW.state
    USING ERRCODE = 'check_violation';
END;
$$;

COMMENT ON FUNCTION nex_validate_order_transition() IS
  'Enforces NEX-native order lifecycle. Called by BEFORE UPDATE trigger on nex_order.state. Rejects invalid transitions regardless of role (service-role has no bypass because trigger runs on every UPDATE).';

DROP TRIGGER IF EXISTS trg_nex_order_state_machine ON nex_order;
CREATE TRIGGER trg_nex_order_state_machine
  BEFORE UPDATE OF state ON nex_order
  FOR EACH ROW
  EXECUTE FUNCTION nex_validate_order_transition();

INSERT INTO nex_migration_history (version, description, notes)
VALUES ('007', 'nex_order state machine · BEFORE UPDATE trigger enforces valid transitions · terminals protected · service-role has no bypass', 'Wave 3.1 · C1 · lifecycle: created → (pending,cancelled,paid); pending → (paid,cancelled); paid → (completed,refunded); completed → refunded; cancelled and refunded terminal.')
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT * FROM nex_migration_history WHERE version = '007';
--   SELECT tgname FROM pg_trigger WHERE tgname = 'trg_nex_order_state_machine';
--   SELECT proname FROM pg_proc WHERE proname = 'nex_validate_order_transition';
