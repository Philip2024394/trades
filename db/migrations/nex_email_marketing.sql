-- Founder 2026-09-10 · NEX Lab Email Marketing System.
-- ADR-0307 · Additive · zero destructive changes to existing tables.

-- ─── Unified contact database ─────────────────────────────────────
-- Every email NEX has ever seen lands here, deduped by lowercase email.
-- Populated by migration script + ongoing enrichers. This is the single
-- source of truth for marketing sends — never send to an address that
-- isn't here.
CREATE TABLE IF NOT EXISTS nex.marketing_contact (
  contact_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                TEXT NOT NULL,
  business_name        TEXT,
  category_group       TEXT, -- 'accommodation' | 'food-beverage' | 'services' | 'retail' | 'health' | 'other'
  category_slug        TEXT, -- e.g. 'accommodation-hotel', 'food-beverage-coffee-cafe'
  country              TEXT NOT NULL DEFAULT 'ID',
  city                 TEXT,
  district             TEXT,
  phone                TEXT,
  whatsapp             TEXT,
  website              TEXT,
  language             TEXT NOT NULL DEFAULT 'id', -- 'id' | 'en' | 'ja' etc
  consent_basis        TEXT NOT NULL DEFAULT 'discovered', -- 'discovered' | 'implicit' | 'explicit_opt_in'
  first_seen_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_tables        TEXT[] NOT NULL DEFAULT '{}', -- which nex.* tables this contact came from
  source_reference     TEXT, -- primary source URL
  contact_confidence   NUMERIC(3,2), -- 0..1 · from quality signals (own-domain email = 1.0, generic = 0.5)
  opt_out              BOOLEAN NOT NULL DEFAULT FALSE,
  opt_out_at           TIMESTAMPTZ,
  opt_out_reason       TEXT,
  hard_bounced         BOOLEAN NOT NULL DEFAULT FALSE,
  complaint_count      INTEGER NOT NULL DEFAULT 0,
  last_sent_at         TIMESTAMPTZ,
  send_count           INTEGER NOT NULL DEFAULT 0,
  open_count           INTEGER NOT NULL DEFAULT 0,
  click_count          INTEGER NOT NULL DEFAULT 0,
  metadata             JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_marketing_contact_email
  ON nex.marketing_contact (LOWER(email));
CREATE INDEX IF NOT EXISTS ix_marketing_contact_category_country
  ON nex.marketing_contact (category_group, country) WHERE opt_out = FALSE AND hard_bounced = FALSE;
CREATE INDEX IF NOT EXISTS ix_marketing_contact_country_city
  ON nex.marketing_contact (country, city) WHERE opt_out = FALSE;
CREATE INDEX IF NOT EXISTS ix_marketing_contact_recent
  ON nex.marketing_contact (last_seen_at DESC);

-- ─── Saved segments (dynamic queries) ────────────────────────────
CREATE TABLE IF NOT EXISTS nex.marketing_segment (
  segment_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                 TEXT NOT NULL UNIQUE, -- 'restaurants-indonesia', 'hotels-yogyakarta'
  display_name         TEXT NOT NULL,
  category_group       TEXT,       -- optional filter
  category_slug        TEXT,       -- optional filter (finer)
  country              TEXT,       -- optional filter
  city                 TEXT,       -- optional filter
  language             TEXT,       -- optional filter
  extra_where          TEXT,       -- optional additional SQL WHERE clause (validated on save)
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_computed_count  INTEGER,
  last_computed_at     TIMESTAMPTZ
);

-- ─── Templates (MJML + inlined HTML) ─────────────────────────────
CREATE TABLE IF NOT EXISTS nex.marketing_template (
  template_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                 TEXT NOT NULL UNIQUE, -- 'welcome-listing-invite-2026-09'
  display_name         TEXT NOT NULL,
  subject_line         TEXT NOT NULL,
  from_email           TEXT NOT NULL,
  from_name            TEXT NOT NULL DEFAULT 'NEX',
  reply_to             TEXT,
  mjml_source          TEXT NOT NULL, -- founder edits this
  html_compiled        TEXT NOT NULL, -- server-compiled from mjml_source
  text_fallback        TEXT NOT NULL, -- plain-text version for spam filters
  banner_image_url     TEXT,
  cta_url              TEXT, -- primary click-through
  variables            JSONB NOT NULL DEFAULT '{}'::jsonb, -- placeholder defaults ({{business_name}}, {{city}})
  language             TEXT NOT NULL DEFAULT 'id',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by           TEXT
);

-- ─── Campaigns (template + segment + schedule + approval) ────────
CREATE TABLE IF NOT EXISTS nex.marketing_campaign (
  campaign_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                 TEXT NOT NULL UNIQUE,
  display_name         TEXT NOT NULL,
  template_id          UUID NOT NULL REFERENCES nex.marketing_template(template_id),
  segment_id           UUID NOT NULL REFERENCES nex.marketing_segment(segment_id),
  scheduled_at         TIMESTAMPTZ, -- NULL = send now on confirm
  status               TEXT NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft','pending_approval','approved','sending','sent','failed','cancelled')),
  target_count         INTEGER, -- snapshot of segment count at approval time
  proposed_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at          TIMESTAMPTZ,
  approved_by          TEXT,
  signature_hmac_sha256 TEXT, -- HMAC per promotion contract
  started_at           TIMESTAMPTZ,
  completed_at         TIMESTAMPTZ,
  send_count           INTEGER NOT NULL DEFAULT 0,
  fail_count           INTEGER NOT NULL DEFAULT 0,
  opened_count         INTEGER NOT NULL DEFAULT 0,
  clicked_count        INTEGER NOT NULL DEFAULT 0,
  bounced_count        INTEGER NOT NULL DEFAULT 0,
  complained_count     INTEGER NOT NULL DEFAULT 0,
  error_reason         TEXT
);

-- ─── Send queue (one row per recipient per campaign) ─────────────
CREATE TABLE IF NOT EXISTS nex.marketing_send_queue (
  queue_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id          UUID NOT NULL REFERENCES nex.marketing_campaign(campaign_id) ON DELETE CASCADE,
  contact_id           UUID NOT NULL REFERENCES nex.marketing_contact(contact_id),
  email                TEXT NOT NULL, -- snapshot at queue time (in case contact updated)
  status               TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','claimed','sending','sent','failed','skipped_opt_out','skipped_bounced')),
  attempts             INTEGER NOT NULL DEFAULT 0,
  next_attempt_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at           TIMESTAMPTZ,
  claimed_by           TEXT, -- worker id (for concurrent workers)
  sent_at              TIMESTAMPTZ,
  esp_message_id       TEXT, -- ESP-provided id for tracking
  error                TEXT
);
CREATE INDEX IF NOT EXISTS ix_send_queue_pending
  ON nex.marketing_send_queue (next_attempt_at ASC)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS ix_send_queue_campaign
  ON nex.marketing_send_queue (campaign_id, status);

-- ─── Send log (immutable audit trail) ────────────────────────────
CREATE TABLE IF NOT EXISTS nex.marketing_send_log (
  send_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id          UUID NOT NULL REFERENCES nex.marketing_campaign(campaign_id),
  contact_id           UUID NOT NULL REFERENCES nex.marketing_contact(contact_id),
  email                TEXT NOT NULL,
  sent_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  esp                  TEXT NOT NULL, -- 'ses' | 'resend' | 'smtp-generic'
  esp_message_id       TEXT,
  status               TEXT NOT NULL, -- 'accepted' | 'rejected'
  status_detail        TEXT
);
CREATE INDEX IF NOT EXISTS ix_send_log_campaign ON nex.marketing_send_log (campaign_id);
CREATE INDEX IF NOT EXISTS ix_send_log_contact ON nex.marketing_send_log (contact_id);

-- ─── Bounce / complaint log (ESP webhooks) ───────────────────────
CREATE TABLE IF NOT EXISTS nex.marketing_bounce_log (
  event_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  esp                  TEXT NOT NULL,
  esp_message_id       TEXT,
  email                TEXT NOT NULL,
  event_type           TEXT NOT NULL, -- 'bounce' | 'complaint' | 'delivery' | 'open' | 'click'
  bounce_type          TEXT, -- 'permanent' | 'transient' | 'undetermined'
  bounce_subtype       TEXT,
  raw_payload          JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_bounce_log_email ON nex.marketing_bounce_log (LOWER(email));
CREATE INDEX IF NOT EXISTS ix_bounce_log_esp_id ON nex.marketing_bounce_log (esp_message_id);

-- ─── Global opt-out registry ─────────────────────────────────────
-- Extends the existing nex.business_lead_opt_out. Anyone unsubscribing
-- via ANY channel (email link, WA STOP, admin action) lands here.
CREATE TABLE IF NOT EXISTS nex.marketing_opt_out (
  opt_out_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                TEXT NOT NULL,
  first_recorded_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason               TEXT NOT NULL, -- 'unsubscribe_link' | 'user_request' | 'hard_bounce' | 'complaint' | 'admin'
  channel              TEXT NOT NULL DEFAULT 'email',
  metadata             JSONB
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_marketing_opt_out_email
  ON nex.marketing_opt_out (LOWER(email));
