-- NEX Compliance Engine · §5.9 · structured compliance state + audit trail
--
-- Doctrine (Philip 2026-08-08):
--   Provider Webhook → Signature Validation → Canonical Event
--     → Event Ingest → COMPLIANCE ENGINE → Contact Registry
--     → Future Campaign Expansion
--
-- The Compliance Engine is the ONLY subsystem that writes to a
-- contact's compliance fields. Analytics ingests the event · engine
-- decides the policy · registry stores the result. The old fields
-- (never_contact, unsubscribe_at) remain as computed convenience so
-- expansion queries don't have to change.
--
-- Idempotent · additive-only.

-- ── Structured compliance columns on nex.contacts ─────────────────
ALTER TABLE nex.contacts ADD COLUMN IF NOT EXISTS compliance_state         TEXT NOT NULL DEFAULT 'allowed'
  CHECK (compliance_state IN ('allowed','suppressed_soft','suppressed_hard','unsubscribed','complaint','manual_block'));
ALTER TABLE nex.contacts ADD COLUMN IF NOT EXISTS compliance_reason         TEXT;
ALTER TABLE nex.contacts ADD COLUMN IF NOT EXISTS compliance_source         TEXT;      -- 'sendgrid_webhook' | 'ses_webhook' | 'mailgun_webhook' | 'postmark_webhook' | 'simulator' | 'manual_admin' | 'expansion_check'
ALTER TABLE nex.contacts ADD COLUMN IF NOT EXISTS compliance_updated_at     TIMESTAMPTZ;
ALTER TABLE nex.contacts ADD COLUMN IF NOT EXISTS soft_bounce_count         INT NOT NULL DEFAULT 0;
ALTER TABLE nex.contacts ADD COLUMN IF NOT EXISTS soft_bounce_last_at       TIMESTAMPTZ;
ALTER TABLE nex.contacts ADD COLUMN IF NOT EXISTS last_provider_message_id  TEXT;

CREATE INDEX IF NOT EXISTS contacts_compliance_state_idx
  ON nex.contacts (compliance_state) WHERE deleted_at IS NULL AND compliance_state <> 'allowed';

-- ── nex.compliance_events · immutable audit trail ────────────────
CREATE TABLE IF NOT EXISTS nex.compliance_events (
  event_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id         UUID NOT NULL,
  event_type         TEXT NOT NULL   CHECK (event_type IN (
                       'hard_bounce_received','soft_bounce_received','complaint_received',
                       'unsubscribed','suppressed_soft_threshold','manual_suppressed','reinstated',
                       'delivered_reset_soft_streak'
                     )),
  old_state          TEXT,
  new_state          TEXT,
  reason             TEXT,
  source             TEXT NOT NULL,   -- one of the compliance_source values above
  provider           TEXT,            -- when source is a webhook
  provider_message_id TEXT,
  campaign_id        UUID,
  actor              TEXT,            -- admin id for manual actions · 'system' for automatic
  analytics_event_id UUID,            -- link back to nex.analytics_events row that triggered this
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS compliance_events_contact_idx  ON nex.compliance_events (contact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS compliance_events_type_idx     ON nex.compliance_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS compliance_events_source_idx   ON nex.compliance_events (source, created_at DESC);

-- ── RLS ───────────────────────────────────────────────────────────
ALTER TABLE nex.compliance_events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'nex' AND tablename = 'compliance_events' AND policyname = 'service_role_all_compliance_events') THEN
    CREATE POLICY "service_role_all_compliance_events" ON nex.compliance_events FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMENT ON COLUMN nex.contacts.compliance_state IS 'Structured compliance state · authoritative · updated ONLY by the Compliance Engine';
COMMENT ON COLUMN nex.contacts.compliance_reason IS 'Human-readable reason for current state · e.g. "hard bounce · SES · Permanent/General"';
COMMENT ON COLUMN nex.contacts.compliance_source IS 'Which subsystem last updated compliance · provider webhook / manual_admin / expansion_check';
COMMENT ON TABLE nex.compliance_events IS 'Immutable audit trail · every automatic and manual compliance action · never mutated after insert';
