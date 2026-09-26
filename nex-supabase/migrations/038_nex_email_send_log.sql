-- ============================================================================
-- NEX-native Migration 038 · nex_email_send_log · Wave C Slice 11d
-- ============================================================================
-- Per-recipient send record for an email campaign. One row per (campaign,
-- subscriber) attempt. When the sender adapter is a real transactional
-- provider (Resend/Postmark/SMTP), status flips from 'queued' to 'sent'
-- (or 'failed' + error_message) at delivery attempt. The default
-- ConsoleAdapter marks status='sent' immediately (dry-run doctrine · no
-- lie about delivery · dry-run = "would have sent to this address").
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS nex_email_send_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id    uuid NOT NULL REFERENCES nex_email_campaign(id) ON DELETE CASCADE,
  subscriber_id  uuid NOT NULL REFERENCES nex_email_subscriber(id) ON DELETE CASCADE,
  status         text NOT NULL,
  error_message  text,
  sent_at        timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nex_email_send_log_status_known
    CHECK (status IN ('queued','sent','failed','skipped')),
  CONSTRAINT nex_email_send_log_error_length
    CHECK (error_message IS NULL OR char_length(error_message) <= 500)
);

COMMENT ON TABLE nex_email_send_log IS
  'One row per (campaign, subscriber) send attempt · status queued/sent/failed/skipped · CASCADE both sides · adapter fills sent_at + error_message.';

CREATE INDEX IF NOT EXISTS idx_nex_email_send_log_campaign
  ON nex_email_send_log (campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nex_email_send_log_status
  ON nex_email_send_log (status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_nex_email_send_log_unique_pair
  ON nex_email_send_log (campaign_id, subscriber_id);

ALTER TABLE nex_email_send_log ENABLE ROW LEVEL SECURITY;

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '038',
    'Wave C Slice 11d · nex_email_send_log · per-recipient dispatch log',
    'Default ConsoleAdapter is dry-run (marks sent immediately). Real provider adapter (Resend/Postmark/SMTP) swaps at the class level.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;
