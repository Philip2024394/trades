-- ============================================================================
-- NEX-native Migration 037 · nex_email_campaign · Wave C Slice 11c
-- ============================================================================
-- Draftable/scheduled/sent campaign rows scoped to an email list.
-- Compose UI drafts a campaign; send infrastructure (Slice 11d) transitions
-- draft → scheduled → sent and populates sent_at + sent_count.
--
-- Schema:
--   · id           uuid PK
--   · list_id      FK nex_email_list ON DELETE CASCADE
--   · subject      text NOT NULL · CHECK 1..200
--   · body_text    text NOT NULL · CHECK 1..50000 (plain-text fallback)
--   · body_html    text · nullable · CHECK ≤50000 when set (rich preview)
--   · status       text · CHECK IN ('draft','scheduled','sent','cancelled')
--                  default 'draft'
--   · scheduled_for timestamptz · nullable · set when status='scheduled'
--   · sent_at      timestamptz · nullable · set by markCampaignSent
--   · sent_count   integer NOT NULL DEFAULT 0
--   · created_at + updated_at (touch trigger)
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '037';
--     DROP TABLE IF EXISTS nex_email_campaign;
--   COMMIT;
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS nex_email_campaign (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id        uuid NOT NULL REFERENCES nex_email_list(id) ON DELETE CASCADE,
  subject        text NOT NULL,
  body_text      text NOT NULL,
  body_html      text,
  status         text NOT NULL DEFAULT 'draft',
  scheduled_for  timestamptz,
  sent_at        timestamptz,
  sent_count     integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nex_email_campaign_subject_length CHECK (char_length(subject) BETWEEN 1 AND 200),
  CONSTRAINT nex_email_campaign_body_text_length CHECK (char_length(body_text) BETWEEN 1 AND 50000),
  CONSTRAINT nex_email_campaign_body_html_length CHECK (body_html IS NULL OR char_length(body_html) <= 50000),
  CONSTRAINT nex_email_campaign_status_known CHECK (status IN ('draft','scheduled','sent','cancelled')),
  CONSTRAINT nex_email_campaign_sent_count_nonneg CHECK (sent_count >= 0)
);

COMMENT ON TABLE nex_email_campaign IS
  'Campaign draft/scheduled/sent state on an nex_email_list · body_text required · body_html optional · status transitions enforced app-side by email-service.';

CREATE INDEX IF NOT EXISTS idx_nex_email_campaign_list ON nex_email_campaign (list_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nex_email_campaign_status ON nex_email_campaign (status, created_at DESC);

DROP TRIGGER IF EXISTS nex_email_campaign_touch ON nex_email_campaign;
CREATE TRIGGER nex_email_campaign_touch
  BEFORE UPDATE ON nex_email_campaign
  FOR EACH ROW EXECUTE FUNCTION nex_touch_updated_at();

ALTER TABLE nex_email_campaign ENABLE ROW LEVEL SECURITY;

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '037',
    'Wave C Slice 11c · nex_email_campaign · draftable campaign rows',
    'Compose UI drafts · send infra (11d) transitions to sent + fills sent_count.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;
