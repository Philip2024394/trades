-- M6.2 FIXUP · The original migration's CREATE TABLE IF NOT EXISTS was a no-op
-- because a minimal claim_requests table already existed. This ALTER pass adds
-- the missing columns Philip specified (2026-08-15).
--
-- COPY-PASTE INTO Supabase Dashboard → SQL Editor → New Query → Run
-- Idempotent · safe to re-run

ALTER TABLE claim_requests
  ADD COLUMN IF NOT EXISTS company_name_snapshot text,
  ADD COLUMN IF NOT EXISTS claimant_name         text,
  ADD COLUMN IF NOT EXISTS claimant_email        text,
  ADD COLUMN IF NOT EXISTS claimant_role         text,
  ADD COLUMN IF NOT EXISTS reason                text,
  ADD COLUMN IF NOT EXISTS status                text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS submitted_at          timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS reviewed_at           timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by           text;

-- Status enum · same as original migration (drop+add pattern, evolvable)
ALTER TABLE claim_requests DROP CONSTRAINT IF EXISTS claim_requests_status_check;
ALTER TABLE claim_requests ADD CONSTRAINT claim_requests_status_check
  CHECK (status IN ('pending','approved','rejected','cancelled'));

-- Indexes
CREATE INDEX IF NOT EXISTS claim_requests_listing_id_idx ON claim_requests(listing_id);
CREATE INDEX IF NOT EXISTS claim_requests_status_idx     ON claim_requests(status);
CREATE INDEX IF NOT EXISTS claim_requests_submitted_at_idx ON claim_requests(submitted_at DESC);
CREATE INDEX IF NOT EXISTS claim_requests_status_submitted_idx
  ON claim_requests(status, submitted_at DESC) WHERE status = 'pending';

-- Force PostgREST schema cache reload
SELECT pg_notify('pgrst', 'reload schema');

-- Verify · should show all 12 columns
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_name = 'claim_requests'
 ORDER BY ordinal_position;
