-- 062_nex_food_owner_supplied.sql
--
-- NEX Food · Layer 3 · owner-supplied data tracking on claim codes.
-- Extends the Phase 6 claim_code table so a self-service claim can remember
-- what fields the owner supplied at CODE-REQUEST time, and promote them to
-- `owner_verified` trust layer at CODE-VERIFY time.
--
-- Motivation
--   Phase 6 built admin-initiated claim codes (CLI issues code · owner
--   receives on WhatsApp · owner enters code · flip status to claimed).
--   Layer 3 opens two new entry paths:
--     · self_service_claim   — owner clicks "Are you the owner?" on a
--                              discovered listing · supplies contact fields
--                              at request time · flips to claimed on verify.
--     · self_service_register — owner comes to /food/register · supplies a
--                               brand-new business record · claim code fires
--                               against their WhatsApp · verify promotes
--                               every supplied field to owner_verified.
--
--   Both need to remember what the owner said BEFORE they proved the phone
--   they said it from. This migration adds the small storage for that.
--
-- What ships in this migration
--   1  New column nex.food_claim_code.pending_owner_data (jsonb)
--        Shape: { name?, whatsapp?, phone?, address?, hours?, cuisine?,
--                 category?, city? }
--        NULL for admin-initiated codes (Phase 6 default).
--   2  New column nex.food_claim_code.entry_path (text)
--        Values: 'admin_cli' | 'self_service_claim' | 'self_service_register'
--   3  Small helper view showing pending self-service claims for HQ
--        awareness (never used to auto-promote · just observability).
--
-- Rules (enforced in application code)
--   · pending_owner_data is NEVER written to nex.food_business without a
--     successful OTP verify first. This preserves Discovery ≠ Outreach
--     and the trust hierarchy (never overwrite owner_verified with
--     unverified owner claims).
--   · On verify, EACH field in pending_owner_data becomes a row in
--     nex.food_business_field_provenance with trust_layer='owner_verified'.
--   · No schema change to nex.food_business — provenance table already
--     handles per-field trust layer (from Phase 8.0 enrichment schema).
--
-- Reversible
--   BEGIN;
--   DROP VIEW IF EXISTS nex.food_pending_self_service_claims;
--   ALTER TABLE nex.food_claim_code DROP COLUMN IF EXISTS pending_owner_data;
--   ALTER TABLE nex.food_claim_code DROP COLUMN IF EXISTS entry_path;
--   COMMIT;

ALTER TABLE nex.food_claim_code
  ADD COLUMN IF NOT EXISTS pending_owner_data jsonb,
  ADD COLUMN IF NOT EXISTS entry_path         text NOT NULL DEFAULT 'admin_cli';

COMMENT ON COLUMN nex.food_claim_code.pending_owner_data IS
  'Owner-supplied fields captured at code-request time. Promoted to owner_verified provenance only after successful OTP verify. NEVER trusted until then.';

COMMENT ON COLUMN nex.food_claim_code.entry_path IS
  'admin_cli · self_service_claim · self_service_register — audit trail for how the claim was initiated.';

CREATE OR REPLACE VIEW nex.food_pending_self_service_claims AS
SELECT
  cc.claim_code_id,
  cc.business_ref,
  cc.entry_path,
  cc.requested_at,
  cc.expires_at,
  cc.attempt_count,
  cc.destination,
  b.business_name,
  b.claim_status,
  b.owner_status,
  cc.pending_owner_data
FROM nex.food_claim_code cc
JOIN nex.food_business b ON b.public_listing_ref = cc.business_ref
WHERE cc.consumed_at IS NULL
  AND cc.invalidated_at IS NULL
  AND cc.expires_at > now()
  AND cc.entry_path IN ('self_service_claim', 'self_service_register');

COMMENT ON VIEW nex.food_pending_self_service_claims IS
  'HQ observability of live owner-initiated claims. Never auto-promoted · admin-visible only.';
