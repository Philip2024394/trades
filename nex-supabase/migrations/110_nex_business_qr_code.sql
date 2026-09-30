-- ============================================================================
-- NEX-native Migration 110 · nex_business.qr_code_image_url + assets bucket
-- ============================================================================
--
-- Purpose:
--   Persist the seller's QRIS / bank / e-wallet payment QR image so the
--   cover Info Tray Payment panel can render it to buyers directly.
--   Doctrine-safe: NEX displays a seller-uploaded image · money moves
--   directly buyer → seller via QRIS/bank rail · NEX never handles funds.
--
-- Founder-sealed guardrails (2026-09-30):
--   · QR renders only when seller has 'qris_delivery' in accepted methods.
--   · Auto-authored warning below the image: "Scan when your order
--     arrives · verify the merchant name" (system copy, not seller-
--     editable).
--   · NEX never modifies the QR bytes (no branding overlay, no watermark).
--   · NEX never routes buyer traffic through a scanning intermediary.
--
-- Storage:
--   · New bucket `nex-business-assets` for seller-authored public assets
--     (starts with QR codes · future banner / logo revamp uses same
--     bucket to keep chat attachments separated from public shop assets).
--   · Public read (RLS on storage.objects) so buyers can fetch the image.
--   · Writes only via service role from business-service upload helper ·
--     seller-facing form pipes through updateBusinessQrCodeAction.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '110';
--     ALTER TABLE nex_business DROP COLUMN IF EXISTS qr_code_image_url;
--     DROP POLICY IF EXISTS nex_business_assets_public_read ON storage.objects;
--     DELETE FROM storage.buckets WHERE id = 'nex-business-assets';
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_business
  ADD COLUMN IF NOT EXISTS qr_code_image_url text;

COMMENT ON COLUMN nex_business.qr_code_image_url IS
  'Public URL of the seller-uploaded payment QR image (QRIS / bank / e-wallet). Renders in the cover Info Tray Payment panel with a system-authored "scan on arrival" warning. Sealed 2026-09-30 · NEX never touches the funds this QR triggers.';

-- Public storage bucket for seller-authored public assets.
-- Idempotent · safe to re-run.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'nex-business-assets',
    'nex-business-assets',
    true,
    2097152,
    ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
  )
  ON CONFLICT (id) DO UPDATE
    SET public = EXCLUDED.public,
        file_size_limit = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public read on the bucket's objects.
DROP POLICY IF EXISTS nex_business_assets_public_read ON storage.objects;
CREATE POLICY nex_business_assets_public_read
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'nex-business-assets');

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '110',
    'nex_business.qr_code_image_url + nex-business-assets public bucket + public-read RLS',
    'Founder-authorised 2026-09-30. Displays seller QR to buyers · money never touches NEX. 2MB image cap · png/jpg/webp only · writes via service role from updateBusinessQrCodeAction.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT column_name, data_type FROM information_schema.columns
--    WHERE table_name = 'nex_business' AND column_name = 'qr_code_image_url';
--   SELECT id, public, file_size_limit FROM storage.buckets
--    WHERE id = 'nex-business-assets';
--   SELECT policyname FROM pg_policies
--    WHERE tablename = 'objects' AND policyname = 'nex_business_assets_public_read';
