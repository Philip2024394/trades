-- db/migrations/nex_founder_email_batch.sql
--
-- Founder Batch Outbound · additive migration · 2026-09-22
--
-- Purpose: audit trail for every batch email sent by the Founder from the
-- consolidated /nex-head-quarters/email-harvest page. Every send attempt
-- persists a row · every recipient persists a row · every unsubscribe
-- persists a row. Never fabricates delivery status. Real SMTP result or
-- 'smtp_not_configured' string · nothing in between.
--
-- ADDITIVE ONLY. Zero modification to existing tables. Zero effect on
-- G3-24h endurance run · zero effect on discovery_business_evidence.

CREATE TABLE IF NOT EXISTS nex.founder_email_batch (
  batch_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          TEXT NOT NULL,                    -- founder:localhost / founder:cookie / founder:hq-token
  subject             TEXT NOT NULL,
  body_text           TEXT NOT NULL,
  body_html           TEXT,
  from_address        TEXT NOT NULL,
  from_name           TEXT,
  reply_to            TEXT,
  recipient_count     INT NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','sending','sent','partial_sent','smtp_not_configured','failed')),
  smtp_host           TEXT,                             -- honestly recorded post-attempt (never a secret)
  sent_started_at     TIMESTAMPTZ,
  sent_completed_at   TIMESTAMPTZ,
  error_reason        TEXT,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS ix_founder_email_batch_created_at
  ON nex.founder_email_batch (created_at DESC);

CREATE TABLE IF NOT EXISTS nex.founder_email_recipient (
  recipient_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id            UUID NOT NULL REFERENCES nex.founder_email_batch(batch_id) ON DELETE CASCADE,
  email_address       TEXT NOT NULL,
  business_name       TEXT,
  country_iso         TEXT,
  evidence_id         UUID,                             -- provenance link back to discovery_business_evidence
  status              TEXT NOT NULL DEFAULT 'queued'
                        CHECK (status IN ('queued','suppressed','sent','failed','smtp_not_configured')),
  sent_at             TIMESTAMPTZ,
  error_reason        TEXT,
  smtp_message_id     TEXT,
  unsubscribe_token   TEXT UNIQUE,
  UNIQUE (batch_id, email_address)
);

CREATE INDEX IF NOT EXISTS ix_founder_email_recipient_batch
  ON nex.founder_email_recipient (batch_id);
CREATE INDEX IF NOT EXISTS ix_founder_email_recipient_status
  ON nex.founder_email_recipient (status);
CREATE INDEX IF NOT EXISTS ix_founder_email_recipient_email
  ON nex.founder_email_recipient (email_address);

CREATE TABLE IF NOT EXISTS nex.founder_email_suppression (
  email_address       TEXT PRIMARY KEY,
  suppressed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason              TEXT NOT NULL,                    -- 'unsubscribe' · 'bounce' · 'complaint' · 'manual'
  batch_id            UUID,                             -- if triggered by a specific batch
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE nex.founder_email_batch DISABLE ROW LEVEL SECURITY;
ALTER TABLE nex.founder_email_recipient DISABLE ROW LEVEL SECURITY;
ALTER TABLE nex.founder_email_suppression DISABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nex_app_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON nex.founder_email_batch TO nex_app_runtime;
    GRANT SELECT, INSERT, UPDATE, DELETE ON nex.founder_email_recipient TO nex_app_runtime;
    GRANT SELECT, INSERT, UPDATE, DELETE ON nex.founder_email_suppression TO nex_app_runtime;
  END IF;
END$$;
