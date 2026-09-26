-- ============================================================================
-- NEX-native Migration 014 · nex_business profile fields
-- ============================================================================
--
-- Purpose:
--   Extend nex_business with the merchant-editable profile fields required
--   for a world-class public business page. All columns are nullable · a
--   business can ship a public page with just display_name + slug and add
--   the rest progressively.
--
--   Adds:
--     · description       · text (max 2000 chars enforced app-side)
--     · logo_url          · text (URL string · validated app-side)
--     · hours             · text (free-form for Slice 3 · structured JSON
--                          reserved for a later slice)
--     · address           · text (multi-line free text · UK-style)
--     · public_phone      · text (formatted string · not the auth phone)
--     · public_email      · text (business contact email · not the auth email)
--     · website_url       · text (URL string · validated app-side)
--
--   Doctrine:
--     · Anti-fabrication · every field is caller input · nullable when unset
--     · Identity Doctrine · public_phone / public_email are ATTRIBUTES · never
--       relationship keys · never conflated with account credentials
--     · Storage-layer only enforces size and null shape · deeper validation
--       (URL grammar · phone format) is app-side to keep DB constraints simple
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '014';
--     ALTER TABLE nex_business
--       DROP COLUMN IF EXISTS description,
--       DROP COLUMN IF EXISTS logo_url,
--       DROP COLUMN IF EXISTS hours,
--       DROP COLUMN IF EXISTS address,
--       DROP COLUMN IF EXISTS public_phone,
--       DROP COLUMN IF EXISTS public_email,
--       DROP COLUMN IF EXISTS website_url;
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_business
  ADD COLUMN IF NOT EXISTS description   text,
  ADD COLUMN IF NOT EXISTS logo_url      text,
  ADD COLUMN IF NOT EXISTS hours         text,
  ADD COLUMN IF NOT EXISTS address       text,
  ADD COLUMN IF NOT EXISTS public_phone  text,
  ADD COLUMN IF NOT EXISTS public_email  text,
  ADD COLUMN IF NOT EXISTS website_url   text;

-- Storage-layer size caps · defence-in-depth beyond app validation.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'nex_business_profile_lengths'
       AND conrelid = 'nex_business'::regclass
  ) THEN
    ALTER TABLE nex_business
      ADD CONSTRAINT nex_business_profile_lengths CHECK (
        (description  IS NULL OR char_length(description)  <= 2000) AND
        (logo_url     IS NULL OR char_length(logo_url)     <= 1024) AND
        (hours        IS NULL OR char_length(hours)        <= 500)  AND
        (address      IS NULL OR char_length(address)      <= 500)  AND
        (public_phone IS NULL OR char_length(public_phone) <= 64)   AND
        (public_email IS NULL OR char_length(public_email) <= 320)  AND
        (website_url  IS NULL OR char_length(website_url)  <= 1024)
      );
  END IF;
END $$;

COMMENT ON COLUMN nex_business.description  IS 'Merchant-editable business description · max 2000 chars · nullable.';
COMMENT ON COLUMN nex_business.logo_url     IS 'Public logo URL · nullable · validated app-side.';
COMMENT ON COLUMN nex_business.hours        IS 'Free-form hours of operation · nullable · structured hours JSON reserved for future migration.';
COMMENT ON COLUMN nex_business.address      IS 'Public address · multi-line free text · nullable.';
COMMENT ON COLUMN nex_business.public_phone IS 'Public contact phone · ATTRIBUTE only · not the auth phone · never a relationship key.';
COMMENT ON COLUMN nex_business.public_email IS 'Public contact email · ATTRIBUTE only · not the auth email · never a relationship key.';
COMMENT ON COLUMN nex_business.website_url  IS 'Public website URL · nullable · validated app-side.';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '014',
    'nex_business profile fields · description · logo_url · hours · address · public_phone · public_email · website_url',
    'Wave A Slice 3 · Founder Decision Pass 2026-09-24. All fields nullable · storage-layer size caps · no relationship semantics for public_phone / public_email.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ============================================================================
-- Post-apply verification:
--
--   SELECT column_name, data_type FROM information_schema.columns
--    WHERE table_name = 'nex_business'
--      AND column_name IN ('description','logo_url','hours','address',
--                          'public_phone','public_email','website_url')
--    ORDER BY column_name;
--     -- expect: 7 rows · all text
--
--   SELECT conname FROM pg_constraint
--    WHERE conrelid = 'nex_business'::regclass
--      AND conname = 'nex_business_profile_lengths';
--     -- expect: 1 row
-- ============================================================================
