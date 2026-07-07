-- WhatsApp send log.
--
-- Every WhatsApp send attempt lands here — success, failure, or
-- "no provider configured yet" (which is the current state until
-- the Meta Cloud API credentials land).
--
-- Admin dashboard reads this table to verify numbers work + spot
-- failures.

BEGIN;

CREATE TABLE IF NOT EXISTS os_whatsapp_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What this message is for
  purpose text NOT NULL
    CHECK (purpose IN (
      'brief_to_trade',      -- fired by /api/project/submit
      'reply_to_homeowner',  -- fired by /api/inbox/reply
      'admin_test',          -- fired from admin dashboard test button
      'other'
    )),

  -- Numbers (E.164 preferred but stored as text so we can inspect what
  -- the client actually gave us — including invalid ones)
  from_number text,
  to_number text NOT NULL,

  -- Message body as it would be sent — we store even skipped-no-provider
  -- messages so admin can verify what would have been sent
  body text NOT NULL,

  -- Delivery state
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',
      'sent',
      'delivered',
      'failed',
      'skipped_no_provider',
      'skipped_no_number',
      'skipped_no_consent'
    )),
  provider text,                       -- 'meta' | 'twilio' | null
  provider_message_id text,
  error_message text,

  -- Cross-references (nullable — an admin test send has none of these)
  linked_project_id uuid,
  linked_business_id uuid,
  linked_party_id uuid,

  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  delivered_at timestamptz
);

CREATE INDEX IF NOT EXISTS os_whatsapp_logs_created_idx
  ON os_whatsapp_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS os_whatsapp_logs_status_idx
  ON os_whatsapp_logs (status, created_at DESC);
CREATE INDEX IF NOT EXISTS os_whatsapp_logs_purpose_idx
  ON os_whatsapp_logs (purpose, created_at DESC);
CREATE INDEX IF NOT EXISTS os_whatsapp_logs_to_number_idx
  ON os_whatsapp_logs (to_number, created_at DESC);
CREATE INDEX IF NOT EXISTS os_whatsapp_logs_business_idx
  ON os_whatsapp_logs (linked_business_id)
  WHERE linked_business_id IS NOT NULL;

ALTER TABLE os_whatsapp_logs ENABLE ROW LEVEL SECURITY;
-- Service-role only. Admin dashboard reads via server-side helpers.

COMMIT;
