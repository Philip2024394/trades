-- ============================================================================
-- NEX-native Migration 129 · nex_vault_file + nex-vault-files bucket
-- ============================================================================
--
-- Private, owner-scoped storage foundation for Vault file rooms. Sealed
-- by Vault build-plan 2026-10-03 (docs/doctrine/vault-build-plan-2026-10-
-- 03.md · founder decision D2).
--
-- LOAD-BEARING BOUNDARY
-- ---------------------
-- Access-controlled storage ≠ E2E Vault encryption. In Stage 4 state the
-- server CAN read object bytes (service-role has access to the bucket).
-- Phase A (not yet authorised) adds client-side encryption with keys the
-- server never holds. Until Phase A ships every Vault surface must carry
-- the honest-limits disclaimer established on /vault/settings.
--
-- SCOPE
-- -----
-- 1. Create a NEW private bucket `nex-vault-files`. NEVER reuse any
--    existing public bucket (`nex-peer-chat-attachments`, etc.).
-- 2. Create `nex_vault_file` metadata table with owner-scoped RLS.
-- 3. Create storage policies on `nex-vault-files` so clients may only
--    SELECT / INSERT / DELETE objects they own. Service-role bypasses
--    for admin-driven cascade only.
--
-- Downloads happen via short-lived signed URLs issued by the application
-- after verifying ownership. There is no public URL path.
--
-- category CHECK · drives which Vault room the file appears in:
--   'documents' | 'photos' | 'videos' | 'plans' | 'important' | 'archived'
--
-- bucket_path layout · deterministic from (account_id, id) so path
-- guessing is impossible and listing is scoped per account:
--   {account_id}/{id}
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '129';
--     DROP TABLE IF EXISTS nex_vault_file CASCADE;
--     -- Storage policies then bucket:
--     DROP POLICY IF EXISTS "nex-vault-files owner select"  ON storage.objects;
--     DROP POLICY IF EXISTS "nex-vault-files owner insert"  ON storage.objects;
--     DROP POLICY IF EXISTS "nex-vault-files owner delete"  ON storage.objects;
--     -- DELETE objects before DROP BUCKET (bucket must be empty)
--     DELETE FROM storage.objects WHERE bucket_id = 'nex-vault-files';
--     DELETE FROM storage.buckets WHERE id = 'nex-vault-files';
--   COMMIT;
-- ============================================================================

BEGIN;

-- ─── 1. Metadata table ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nex_vault_file (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN (
    'documents', 'photos', 'videos', 'plans', 'important', 'archived'
  )),
  folder_path TEXT NULL,
  display_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size BIGINT NOT NULL CHECK (byte_size >= 0),
  bucket_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT nex_vault_file_bucket_path_unique UNIQUE (bucket_path),
  CONSTRAINT nex_vault_file_display_name_len CHECK (
    char_length(display_name) BETWEEN 1 AND 256
  )
);

CREATE INDEX IF NOT EXISTS nex_vault_file_by_account_category
  ON nex_vault_file (account_id, category, created_at DESC);

CREATE INDEX IF NOT EXISTS nex_vault_file_by_folder
  ON nex_vault_file (account_id, category, folder_path);

-- updated_at trigger
CREATE OR REPLACE FUNCTION nex_vault_file_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS nex_vault_file_touch ON nex_vault_file;
CREATE TRIGGER nex_vault_file_touch
  BEFORE UPDATE ON nex_vault_file
  FOR EACH ROW
  EXECUTE FUNCTION nex_vault_file_touch_updated_at();

ALTER TABLE nex_vault_file ENABLE ROW LEVEL SECURITY;

CREATE POLICY nex_vault_file_select_own
  ON nex_vault_file FOR SELECT
  USING (
    account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())
  );

CREATE POLICY nex_vault_file_insert_own
  ON nex_vault_file FOR INSERT
  WITH CHECK (
    account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())
  );

CREATE POLICY nex_vault_file_update_own
  ON nex_vault_file FOR UPDATE
  USING (
    account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())
  )
  WITH CHECK (
    account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())
  );

CREATE POLICY nex_vault_file_delete_own
  ON nex_vault_file FOR DELETE
  USING (
    account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())
  );

COMMENT ON TABLE nex_vault_file IS
  'Vault file metadata · owner-scoped. Sealed by vault-build-plan-2026-10-03 D2. Stage 4 of 7-stage Vault build. Access-controlled, NOT end-to-end encrypted (Phase A deferred).';

-- ─── 2. Private storage bucket ─────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('nex-vault-files', 'nex-vault-files', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Storage object policies · bucket is PRIVATE; owner-scoped CRUD.
-- The object path convention is `{account_id}/{file_id}`. Users can
-- only touch paths whose first segment matches their account_id. Since
-- storage.objects doesn't know about nex_account, we join through it
-- via the same supabase_user_id → account_id lookup used elsewhere.

DROP POLICY IF EXISTS "nex-vault-files owner select"  ON storage.objects;
DROP POLICY IF EXISTS "nex-vault-files owner insert"  ON storage.objects;
DROP POLICY IF EXISTS "nex-vault-files owner delete"  ON storage.objects;
DROP POLICY IF EXISTS "nex-vault-files owner update"  ON storage.objects;

CREATE POLICY "nex-vault-files owner select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'nex-vault-files'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM nex_account WHERE supabase_user_id = auth.uid()
    )
  );

CREATE POLICY "nex-vault-files owner insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'nex-vault-files'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM nex_account WHERE supabase_user_id = auth.uid()
    )
  );

CREATE POLICY "nex-vault-files owner update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'nex-vault-files'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM nex_account WHERE supabase_user_id = auth.uid()
    )
  );

CREATE POLICY "nex-vault-files owner delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'nex-vault-files'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM nex_account WHERE supabase_user_id = auth.uid()
    )
  );

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '129',
    'nex_vault_file metadata table + nex-vault-files private bucket + owner-scoped RLS',
    'Sealed by vault-build-plan-2026-10-03 D2. Stage 4 of 7-stage Vault build. New private bucket (NEVER reuse public buckets). Downloads via short-lived signed URLs only. Phase A (E2E encryption) not yet authorised; honest-limits disclaimer required on every Vault surface.'
  );

COMMIT;
