-- 195_nex_emergency_pending_confirmation_states.sql
--
-- NEX Emergency Help · pending-alert + early-location refactor (L1 · 2026-10-10).
--
-- SAFE ON POPULATED DB · idempotent · additive · session-identity gated.
--
-- ═══════════════════════════════════════════════════════════════════
-- WHAT THIS MIGRATION DOES
-- ═══════════════════════════════════════════════════════════════════
--
-- Flips the architecture of the "10-second confirmation countdown" so
-- that the alert row + the location stream are created at T=0 (the
-- moment the user taps I NEED HELP after a category pick) and are
-- REVOCABLE until T=10, instead of waiting until T=10 to persist
-- anything.
--
-- Rationale (attacker-removes-phone-mid-countdown threat model):
--   · In the old model, if the user's phone was snatched any time
--     between T=0 and T=10 the alert would never land. The countdown
--     window was a hard delay.
--   · In the new model, up to 10 seconds of transmission + live GPS
--     stream has already left the device by the time the countdown
--     naturally fires. The 10-second window becomes a SAFETY REVOCATION
--     window instead of a submission delay.
--
-- Two new terminal states + two new timestamps extend the incident
-- lifecycle. Nothing existing changes:
--
--   draft                     (unchanged · back-compat)
--   pending_confirmation      NEW · T=0 pre-countdown state
--   active                    (unchanged)
--   responders_assigned       (unchanged)
--   resolved                  (unchanged terminal)
--   cancelled                 (unchanged terminal)
--   revoked_within_window     NEW · terminal state when user cancels
--                             during the 10-second countdown
--   expired                   (unchanged terminal)
--
-- Doctrine (sealed with this migration):
--   · pending_confirmation is a REAL alert. The three-layer resolver
--     may fire for it. The only safety mechanism is the 10-second
--     revocation window. Never silently discarded.
--   · revoked_within_window is distinct from cancelled. Responders
--     who saw the pending alert must see that it was revoked WITHIN
--     the safety window (vs cancelled by a request-side action after
--     active). The emotional distinction matters for responders who
--     may already be moving.
--   · The CHECK constraint on state is widened to 8 values (added
--     pending_confirmation + revoked_within_window). No DML.
--
-- ═══════════════════════════════════════════════════════════════════
-- TABLES
-- ═══════════════════════════════════════════════════════════════════
--
-- 1. nex.emergency_incident (ALTER · widen CHECK + add 2 timestamps)
--
-- ═══════════════════════════════════════════════════════════════════
-- CROSS-DB IDENTITIES
-- ═══════════════════════════════════════════════════════════════════
--
-- No new soft references. incident_id continues to be the hard primary
-- key on nex.emergency_incident.
--
-- ═══════════════════════════════════════════════════════════════════
-- IDEMPOTENCE
-- ═══════════════════════════════════════════════════════════════════
--
-- DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT · idempotent sequence.
-- ADD COLUMN IF NOT EXISTS for both timestamps. Zero DML. Safe to
-- re-run.
--
-- ═══════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════
--
--   -- Revert to 193's CHECK (will fail if any row is in a new state).
--   ALTER TABLE nex.emergency_incident
--     DROP CONSTRAINT IF EXISTS emergency_incident_state_check;
--   ALTER TABLE nex.emergency_incident
--     ADD CONSTRAINT emergency_incident_state_check
--     CHECK (state IN ('draft','active','responders_assigned',
--                      'resolved','cancelled','expired'));
--   ALTER TABLE nex.emergency_incident
--     DROP COLUMN IF EXISTS pending_confirmed_at,
--     DROP COLUMN IF EXISTS revoked_within_window_at;
--
-- ═══════════════════════════════════════════════════════════════════
-- DEPLOYMENT PREREQUISITES
-- ═══════════════════════════════════════════════════════════════════
--
-- · migration 193 applied (nex.emergency_incident must exist).
--
-- ═══════════════════════════════════════════════════════════════════
-- NOT APPLIED
-- ═══════════════════════════════════════════════════════════════════
--
-- Must only be applied via
-- `scripts/nex-canonical/_apply-migration-195.mjs` with the
-- session-identity gate (current_database() = 'nex_dev').

BEGIN;

-- Widen the sealed state CHECK · drop the old constraint (by both
-- possible names from 193's inline definition) then add the new
-- 8-value CHECK.
ALTER TABLE nex.emergency_incident
  DROP CONSTRAINT IF EXISTS emergency_incident_state_check;

ALTER TABLE nex.emergency_incident
  DROP CONSTRAINT IF EXISTS ck_ei_state;

ALTER TABLE nex.emergency_incident
  ADD CONSTRAINT emergency_incident_state_check
  CHECK (state IN (
    'draft',
    'pending_confirmation',
    'active',
    'responders_assigned',
    'resolved',
    'cancelled',
    'revoked_within_window',
    'expired'
  ));

-- Add the two new timestamp columns for the new transitions.
ALTER TABLE nex.emergency_incident
  ADD COLUMN IF NOT EXISTS pending_confirmed_at     timestamptz NULL,
  ADD COLUMN IF NOT EXISTS revoked_within_window_at timestamptz NULL;

COMMIT;

COMMENT ON COLUMN nex.emergency_incident.pending_confirmed_at IS
  'Timestamp of the pending_confirmation → active transition. NULL for incidents that never entered pending_confirmation (legacy draft→active path) or that were revoked.';

COMMENT ON COLUMN nex.emergency_incident.revoked_within_window_at IS
  'Timestamp of the pending_confirmation → revoked_within_window transition. NULL unless the alert was revoked during the 10-second safety window.';

-- ═══════════════════════════════════════════════════════════════════
-- End of migration 195.
-- Downstream (NOT shipped here):
--   · src/lib/nex-native/emergency/incident-service.ts · 3 new transitions
--   · src/lib/nex-native/emergency/actions.ts · 3 new server actions
--   · src/components/nex-native/emergency/EmergencyConfirmationScreen.tsx
--   · Responder-side pending/revoked UI (L2 scope)
--   · Multi-channel fan-out (L3 scope · 196)
-- ═══════════════════════════════════════════════════════════════════
