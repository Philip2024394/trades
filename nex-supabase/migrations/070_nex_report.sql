-- ============================================================================
-- NEX-native Migration 070 · Bridge 16d · Report a seller/buyer
-- ============================================================================
--
-- User-generated abuse / scam reports. Every report snapshots the
-- offending conversation into `chat_snapshot jsonb` so the reviewer
-- has evidence even if the reported party later deletes messages.
--
-- Enforcement doctrine (sealed 2026-09-28 · /terms sections 3 + 6):
--   · Single report doesn't suspend · we require multiple
--     independent reports before auto-suspending a listing
--   · Illegal content (fraud > Rp 1M, threats, prohibited goods)
--     escalates to human review immediately
--   · Confirmed scam · listings suspended within 24h · repeat
--     offenders permanently banned
--   · Reports are permanent record · not user-deletable
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '070';
--     DROP TABLE IF EXISTS nex_report;
--   COMMIT;
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS nex_report (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_account_id    uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,
  reported_account_id    uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,
  conversation_id        uuid REFERENCES nex_peer_conversation(id) ON DELETE SET NULL,
  reason                 text NOT NULL
                         CHECK (reason IN (
                           'scam',
                           'harassment',
                           'prohibited_goods',
                           'impersonation',
                           'spam',
                           'off_doctrine_payment',
                           'other'
                         )),
  note                   text CHECK (length(note) <= 2000),
  chat_snapshot          jsonb,
  status                 text NOT NULL DEFAULT 'pending'
                         CHECK (status IN (
                           'pending',
                           'under_review',
                           'action_taken',
                           'dismissed',
                           'escalated_to_law'
                         )),
  reviewer_note          text,
  reviewed_by            uuid REFERENCES nex_account(id) ON DELETE SET NULL,
  reviewed_at            timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nex_report_no_self_report CHECK (reporter_account_id <> reported_account_id)
);

CREATE INDEX IF NOT EXISTS idx_nex_report_reporter
  ON nex_report (reporter_account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nex_report_reported
  ON nex_report (reported_account_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nex_report_pending
  ON nex_report (status, created_at)
  WHERE status = 'pending';

COMMENT ON TABLE nex_report IS
  'User-generated abuse / scam reports. Chat snapshot captured at
   report time so evidence survives message deletion. Sealed
   2026-09-28 · Bridge 16d. Reviewed manually during pilot ·
   admin surface deferred to a later bridge.';
COMMENT ON COLUMN nex_report.chat_snapshot IS
  'JSONB snapshot of the peer conversation at report time · full
   message list including sender_account_id, body, sent_at, and any
   attachment_url/type/meta. Reviewers use this as evidence.';
COMMENT ON COLUMN nex_report.reason IS
  'scam | harassment | prohibited_goods | impersonation | spam |
   off_doctrine_payment (seller pressured buyer to pay direct
   bank/QR before delivery) | other.';
COMMENT ON COLUMN nex_report.status IS
  'pending → under_review → (action_taken | dismissed | escalated_to_law).
   Auto-suspend logic reads count(status=pending) · threshold 3+
   pending reports triggers a review sweep (queued admin bridge).';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '070',
    'Bridge 16d · nex_report table for user-filed abuse / scam reports',
    'Founder-authorised 2026-09-28. Chat snapshot captured at file time · permanent record · reviewer flow admin surface queued. Referenced by /support?topic=report and by the peer chat 3-dot menu.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT table_name FROM information_schema.tables
--    WHERE table_name = 'nex_report';
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conname = 'nex_report_reason_check';
