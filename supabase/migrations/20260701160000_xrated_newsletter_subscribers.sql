-- Xrated Trades — Newsletter signup (Model A: email capture only).
--
-- Merchant-grade trades collect email subscribers on their public
-- profile (gated by isMerchantGradeTrade). Xrated stores the list;
-- the merchant exports CSV from their dashboard and sends emails via
-- their own tool (Mailchimp / Brevo / etc). No emails are ever sent
-- by Xrated under Model A.
--
-- UK GDPR + PECR compliance:
--   - consent_at + consent_text persisted per subscriber as audit trail
--   - unsubscribe_token unique per row, used by /newsletter/unsubscribe/<token>
--   - status transitions: active → unsubscribed | bounced | complained
--   - ip_hash is sha256(ip)[0..16] — for abuse mitigation, not identification
--
-- UNIQUE (listing_id, email) — one subscriber per listing per email; a
-- re-subscribe after unsubscribe flips status='active' on the same row
-- (ON CONFLICT DO UPDATE) so we never double-bill the merchant's quota.

CREATE TABLE IF NOT EXISTS hammerex_xrated_newsletter_subscribers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id          uuid NOT NULL
    REFERENCES hammerex_trade_off_listings(id) ON DELETE CASCADE,
  email               text NOT NULL
    CHECK (char_length(email) BETWEEN 5 AND 254),
  consent_at          timestamptz NOT NULL DEFAULT now(),
  consent_text        text NOT NULL,
  ip_hash             text,
  unsubscribe_token   uuid NOT NULL DEFAULT gen_random_uuid(),
  status              text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','unsubscribed','bounced','complained')),
  unsubscribed_at     timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, email)
);

CREATE INDEX IF NOT EXISTS hammerex_xrated_newsletter_subscribers_listing_idx
  ON hammerex_xrated_newsletter_subscribers (listing_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS hammerex_xrated_newsletter_subscribers_token_idx
  ON hammerex_xrated_newsletter_subscribers (unsubscribe_token)
  WHERE status = 'active';
