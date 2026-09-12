-- 056_nex_food_outreach.sql
--
-- NEX Food Discovery Yogyakarta V1 · Phase 5 · outreach schema.
--
-- Motivation
--   Owner outreach must be channel-swappable (WhatsApp-first Indonesia,
--   email-first UK) with the SAME eligibility/opt-out/suppression rules
--   across all channels. This migration lands the storage substrate for
--   templates, attempts (audit log), and permanent suppressions.
--
-- What ships in this migration
--   1  nex.food_outreach_template  · reusable message templates (EN + ID)
--   2  nex.food_outreach_attempt   · one row per outreach attempt · audit log
--   3  nex.food_outreach_suppression · permanent opt-out · never re-message
--   4  Enum type nex_food_outreach_channel  (whatsapp|email|phone|website)
--   5  Enum type nex_food_outreach_status   (dry_run|queued|sent|delivered|
--                                             failed|opted_out|rate_limited)
--   6  Indexes for eligibility checks (business_ref · last_attempt_at)
--
-- Doctrine
--   project_nex_food_discovery_yogyakarta_v1_2026_08_21 · Phase 5
--   project_nex_business_acquisition_pipeline_2026_08_21 · outreach engine
--   feedback_role_master_ai_engineer_for_nex_2026_08_21 · never bypass suppression
--
-- Reversible
--   BEGIN;
--   DROP TABLE IF EXISTS nex.food_outreach_attempt CASCADE;
--   DROP TABLE IF EXISTS nex.food_outreach_suppression CASCADE;
--   DROP TABLE IF EXISTS nex.food_outreach_template CASCADE;
--   DROP TYPE IF EXISTS nex.nex_food_outreach_status;
--   DROP TYPE IF EXISTS nex.nex_food_outreach_channel;
--   COMMIT;

CREATE SCHEMA IF NOT EXISTS nex;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Enums ───────────────────────────────────────────────────────────────────

DO $body$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'nex_food_outreach_channel' AND n.nspname = 'nex'
  ) THEN
    CREATE TYPE nex.nex_food_outreach_channel AS ENUM (
      'whatsapp',   -- first-class Indonesia
      'email',      -- first-class UK trades · works for food too when owner has email
      'phone',      -- manual · admin logs a call
      'website'     -- website contact form submission
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'nex_food_outreach_status' AND n.nspname = 'nex'
  ) THEN
    CREATE TYPE nex.nex_food_outreach_status AS ENUM (
      'dry_run',     -- --dry-run mode · nothing actually sent
      'queued',      -- passed eligibility · awaiting provider send
      'sent',        -- provider accepted the message
      'delivered',   -- provider confirmed delivery (WhatsApp read receipts etc.)
      'failed',      -- provider returned error
      'opted_out',   -- attempt blocked by suppression list
      'rate_limited' -- attempt blocked by 30-day cooldown
    );
  END IF;
END $body$;

-- ── Templates ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nex.food_outreach_template (
  template_id      text PRIMARY KEY,
  channel          nex_food_outreach_channel NOT NULL,
  language         text NOT NULL,                    -- 'en' | 'id'
  purpose          text NOT NULL,                    -- 'first_invitation' | 'reminder_7d' | ...
  subject          text,                             -- email only · NULL for WhatsApp/phone
  body             text NOT NULL,                    -- placeholders: {{business_name}} {{public_listing_ref}} {{claim_link}}
  active           boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nex_food_outreach_template_language_check
    CHECK (language IN ('en', 'id'))
);

CREATE INDEX IF NOT EXISTS idx_nex_food_outreach_template_purpose_lang
  ON nex.food_outreach_template (purpose, language) WHERE active = true;

COMMENT ON TABLE nex.food_outreach_template IS
  'Reusable outreach message templates · one row per (channel, language, purpose) combination. Placeholders substituted at send time.';

-- ── Attempts (audit log) ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nex.food_outreach_attempt (
  attempt_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_ref     text NOT NULL,                    -- public_listing_ref from nex.food_business
  channel          nex_food_outreach_channel NOT NULL,
  template_id      text NOT NULL,                    -- FK-like reference · not enforced (templates can retire)
  status           nex_food_outreach_status NOT NULL,
  status_reason    text,                             -- 'suppressed since 2025-...' or provider error
  destination      text NOT NULL,                    -- WhatsApp number, email, etc. captured verbatim at send
  rendered_body    text NOT NULL,                    -- exact text after placeholder substitution
  attempted_by     text NOT NULL,                    -- 'admin:philipofarrell' or 'cli:outreach.mjs'
  provider_message_id text,                          -- WhatsApp msg id, email msg id, etc.
  provider_response jsonb,                           -- full provider response for audit
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nex_food_outreach_attempt_business_ref
  ON nex.food_outreach_attempt (business_ref, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_nex_food_outreach_attempt_status
  ON nex.food_outreach_attempt (status, created_at DESC);

COMMENT ON TABLE nex.food_outreach_attempt IS
  'Append-only audit log. Every outreach attempt writes exactly one row here, even dry runs. Rate-limit checks read business_ref + created_at.';

-- ── Suppressions (permanent opt-out) ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS nex.food_outreach_suppression (
  suppression_id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_ref     text NOT NULL,                    -- public_listing_ref from nex.food_business
  channel          nex_food_outreach_channel,        -- NULL = suppressed on ALL channels
  reason           text NOT NULL,                    -- 'owner_opt_out' | 'unreachable' | 'inappropriate' | ...
  suppressed_by    text NOT NULL,                    -- 'admin:philipofarrell' or 'auto:hard_bounce'
  suppressed_at    timestamptz NOT NULL DEFAULT now(),
  notes            text
);

-- One suppression per (business_ref, channel) when channel is specified.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_nex_food_outreach_suppression_ref_channel
  ON nex.food_outreach_suppression (business_ref, channel)
  WHERE channel IS NOT NULL;

-- One ALL-channel suppression per business_ref (channel IS NULL means suppressed everywhere).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_nex_food_outreach_suppression_ref_all
  ON nex.food_outreach_suppression (business_ref)
  WHERE channel IS NULL;

CREATE INDEX IF NOT EXISTS idx_nex_food_outreach_suppression_business_ref
  ON nex.food_outreach_suppression (business_ref);

COMMENT ON TABLE nex.food_outreach_suppression IS
  'Permanent opt-out list. Any row here for a given (business_ref, channel-or-ALL) BLOCKS all future outreach attempts. Rows are never automatically removed · admin must delete manually if the block was created in error.';

-- ── Seed the two starter templates (idempotent) ────────────────────────────

INSERT INTO nex.food_outreach_template (template_id, channel, language, purpose, subject, body)
VALUES
  (
    'first_invitation_id_whatsapp_v1',
    'whatsapp',
    'id',
    'first_invitation',
    NULL,
    'Halo {{business_name}},

Kami dari NEX Yogyakarta.

Bisnis Anda telah kami temukan dan sekarang terdaftar di direktori makanan NEX Yogyakarta (referensi: {{public_listing_ref}}).

Klaim bisnis Anda untuk mengambil kendali penuh atas halaman NEX Anda:
- Kelola menu dan foto hidangan
- Terima permintaan pelanggan langsung
- Kontrol harga dan penawaran
- Terima chat pelanggan melalui NEX

Klaim di sini: {{claim_link}}

Jika Anda tidak ingin menerima pesan seperti ini di masa depan, balas STOP.

Salam,
Tim NEX'
  ),
  (
    'first_invitation_en_whatsapp_v1',
    'whatsapp',
    'en',
    'first_invitation',
    NULL,
    'Hi {{business_name}},

We are from NEX Yogyakarta.

Your business has been discovered and is now listed on the NEX Yogyakarta food directory (reference: {{public_listing_ref}}).

Claim your business to take full control of your NEX page:
- Manage your menu and dish photos
- Receive customer enquiries directly
- Control pricing and offers
- Receive customer chats through NEX

Claim here: {{claim_link}}

If you do not want to receive messages like this in the future, reply STOP.

Kind regards,
The NEX Team'
  )
ON CONFLICT (template_id) DO NOTHING;

-- ── updated_at trigger for templates ───────────────────────────────────────

CREATE OR REPLACE FUNCTION nex.food_outreach_template_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $body$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$body$;

DROP TRIGGER IF EXISTS trg_nex_food_outreach_template_touch ON nex.food_outreach_template;
CREATE TRIGGER trg_nex_food_outreach_template_touch
  BEFORE UPDATE ON nex.food_outreach_template
  FOR EACH ROW EXECUTE FUNCTION nex.food_outreach_template_touch_updated_at();
