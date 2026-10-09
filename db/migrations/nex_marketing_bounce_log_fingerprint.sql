-- NEX Deliverability · Session-7 · bounce_log idempotency + classifier audit
-- Founder-authorised programme · Part 11c · 2026-09-21.
--
-- Additive · idempotent · never destructive. Adds:
--   * event_fingerprint       · UNIQUE · enables idempotent event recording
--   * classifier_reason        · audit trail from Session-6 classifier
--   * classifier_matched_signal · exact payload field/value that triggered classification
--   * recipient_updated_at    · when the contact-suppression cascade ran

BEGIN;

ALTER TABLE nex.marketing_bounce_log
  ADD COLUMN IF NOT EXISTS event_fingerprint         TEXT,
  ADD COLUMN IF NOT EXISTS classifier_reason         TEXT,
  ADD COLUMN IF NOT EXISTS classifier_matched_signal TEXT,
  ADD COLUMN IF NOT EXISTS classifier_kind           TEXT,
  ADD COLUMN IF NOT EXISTS recipient_updated_at      TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS ux_bounce_log_event_fingerprint
  ON nex.marketing_bounce_log (event_fingerprint)
  WHERE event_fingerprint IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_bounce_log_kind
  ON nex.marketing_bounce_log (classifier_kind, received_at DESC)
  WHERE classifier_kind IS NOT NULL;

COMMIT;
