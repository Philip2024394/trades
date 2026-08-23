-- 058_nex_food_claim_codes.sql
--
-- NEX Food · Phase 6 · owner claim verification codes.
--
-- Motivation
--   Owner claims a business by receiving a 6-digit code via WhatsApp
--   (channel-swappable · same Phase 5 outreach infra) and entering it on
--   the claim page. Successful verification flips claim_status
--   'invited' → 'claimed' AND owner_status 'contacted' → 'verified'.
--
-- What ships in this migration
--   1  nex.food_claim_code — one row per code request · code stored as
--      pgcrypto crypt() hash · plaintext never at rest
--   2  Indexes for the verify-hot-path (business_ref + active codes)
--   3  Seed two claim-code outreach templates (EN + ID) into
--      nex.food_outreach_template so Phase 5 outreach.mjs can send them
--
-- Rules (enforced in application code)
--   - 6-digit numeric code
--   - 10-minute expiry
--   - 5-attempt limit per code
--   - Requesting a new code invalidates the previous unused code
--   - Only claim_status='invited' or 'listed' rows can request a code
--
-- Reversible
--   BEGIN;
--   DELETE FROM nex.food_outreach_template WHERE template_id LIKE 'claim_code%';
--   DROP TABLE IF EXISTS nex.food_claim_code CASCADE;
--   COMMIT;

CREATE SCHEMA IF NOT EXISTS nex;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS nex.food_claim_code (
  claim_code_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_ref      text NOT NULL,             -- public_listing_ref from nex.food_business
  code_hash         text NOT NULL,             -- pgcrypto crypt() output · plaintext NEVER stored
  destination       text NOT NULL,             -- WhatsApp number the code was sent to
  channel           text NOT NULL DEFAULT 'whatsapp',
  requested_by      text NOT NULL,             -- 'admin:philip' | 'owner:self-service' (future)
  requested_at      timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz NOT NULL,
  attempt_count     integer NOT NULL DEFAULT 0,
  consumed_at       timestamptz,               -- set on successful verify
  invalidated_at    timestamptz,               -- set when superseded by a new code request
  invalidated_reason text,
  CONSTRAINT nex_food_claim_code_channel_check
    CHECK (channel IN ('whatsapp','email','phone','website'))
);

-- Fast lookup for verify · one row per (business_ref) where code is still active
CREATE INDEX IF NOT EXISTS idx_nex_food_claim_code_active
  ON nex.food_claim_code (business_ref, requested_at DESC)
  WHERE consumed_at IS NULL AND invalidated_at IS NULL;

-- Housekeeping index for expiry sweep
CREATE INDEX IF NOT EXISTS idx_nex_food_claim_code_expires_at
  ON nex.food_claim_code (expires_at)
  WHERE consumed_at IS NULL AND invalidated_at IS NULL;

COMMENT ON TABLE nex.food_claim_code IS
  'Owner claim verification codes. Code hash stored (never plaintext). 10-minute expiry · 5-attempt limit · new code request invalidates previous. Successful verify flips nex.food_business.claim_status to claimed + owner_status to verified.';

-- ── Claim-code outreach templates (Indonesian + English) ──────────────────

INSERT INTO nex.food_outreach_template (template_id, channel, language, purpose, subject, body)
VALUES
  (
    'claim_code_id_whatsapp_v1',
    'whatsapp',
    'id',
    'claim_code',
    NULL,
    'Halo {{business_name}},

Kode verifikasi klaim NEX Anda: *{{claim_code}}*

Kode ini akan kedaluwarsa dalam 10 menit.

Untuk klaim bisnis Anda, buka: {{claim_link}}

Referensi: {{public_listing_ref}}

Jika Anda tidak meminta kode ini, abaikan pesan ini. Balas STOP untuk berhenti menerima pesan.

Tim NEX'
  ),
  (
    'claim_code_en_whatsapp_v1',
    'whatsapp',
    'en',
    'claim_code',
    NULL,
    'Hi {{business_name}},

Your NEX claim verification code: *{{claim_code}}*

This code will expire in 10 minutes.

To claim your business, open: {{claim_link}}

Reference: {{public_listing_ref}}

If you did not request this code, ignore this message. Reply STOP to stop receiving messages.

The NEX Team'
  )
ON CONFLICT (template_id) DO NOTHING;
