-- ============================================================================
-- NEX-native Migration 002 · nex_business
-- ============================================================================
--
-- Purpose:
--   Business identity. Every business is owned by exactly one nex_account.
--   Slug is the URL-safe identifier used by conversation/product/order FKs
--   indirectly (they FK to business.id UUID, but slug is how the business
--   is addressed publicly).
--
-- Doctrine references:
--   · Identity Doctrine · owner_account_id is UUID FK to nex_account.id
--     · never phone/email
--   · Commercial Doctrine · basic business participation is free · no gate
--     on listing or receiving enquiries (permissions layer enforces later)
--
-- FK behaviour:
--   owner_account_id → ON DELETE RESTRICT · a business without an owner is
--   not allowed. To delete an account that owns a business, transfer or
--   archive the business first.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '002';
--     DROP TABLE IF EXISTS nex_business;
--   COMMIT;
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS nex_business (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_account_id    uuid NOT NULL REFERENCES nex_account(id) ON DELETE RESTRICT,
  display_name        text NOT NULL CHECK (length(trim(display_name)) > 0),
  slug                text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]([-a-z0-9]{0,62}[a-z0-9])?$'),
    -- URL-safe · lowercase letters/digits/hyphens · 1-64 chars ·
    -- can't start or end with hyphen · matches typical NEX slug rules
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE nex_business IS
  'NEX-native business identity. Owner is a nex_account UUID · never phone/email keyed. Slug is URL-safe public identifier.';

COMMENT ON COLUMN nex_business.owner_account_id IS
  'nex_account UUID that owns this business. ON DELETE RESTRICT · deleting an owner requires transferring/archiving the business first.';

COMMENT ON COLUMN nex_business.slug IS
  'URL-safe unique identifier · lowercase alphanumerics + hyphens · 1-64 chars.';

CREATE INDEX IF NOT EXISTS idx_nex_business_owner_account_id
  ON nex_business (owner_account_id);

-- updated_at auto-maintenance
CREATE OR REPLACE FUNCTION nex_touch_updated_at()
  RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_nex_business_touch_updated_at
  BEFORE UPDATE ON nex_business
  FOR EACH ROW EXECUTE FUNCTION nex_touch_updated_at();

-- RLS
ALTER TABLE nex_business ENABLE ROW LEVEL SECURITY;

-- Public can read every business (basic discovery is free per Commercial Doctrine).
-- Later can restrict to `status IN ('live')` when a status column is added.
CREATE POLICY nex_business_public_read
  ON nex_business
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Owner can update their own business.
CREATE POLICY nex_business_owner_update
  ON nex_business
  FOR UPDATE
  TO authenticated
  USING (owner_account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid()));

-- Owner can insert businesses (they will be owner by definition).
CREATE POLICY nex_business_owner_insert
  ON nex_business
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid()));

-- DELETE only via service-role (business lifecycle is a governed operation).

INSERT INTO nex_migration_history (version, description, notes)
VALUES ('002', 'nex_business · identity + slug + owner FK + RLS + updated_at trigger', 'FK to nex_account ON DELETE RESTRICT preserves data integrity.')
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT * FROM nex_migration_history WHERE version = '002';
--   SELECT count(*) FROM nex_business;                          -- expect 0
--   SELECT policyname FROM pg_policies WHERE tablename = 'nex_business';
--     -- expect: nex_business_public_read, nex_business_owner_update, nex_business_owner_insert
