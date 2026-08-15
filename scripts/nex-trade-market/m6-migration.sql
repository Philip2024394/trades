-- COPY-PASTE INTO Supabase Dashboard → SQL Editor → New Query → Run
-- (NEX project · ijvqdvsvwtwxzcqmoqit)
--
-- Mirror of deploy/postgres/init/052_claim_requests.sql
-- M6.2 · Philip 2026-08-15 · admin-only claim flow
-- Idempotent · safe to re-run

CREATE TABLE IF NOT EXISTS claim_requests (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id            uuid REFERENCES directory_seeds(id) ON DELETE SET NULL,
  company_name_snapshot text NOT NULL,
  claimant_name         text,
  claimant_email        text NOT NULL,
  claimant_role         text,
  reason                text,
  status                text NOT NULL DEFAULT 'pending',
  submitted_at          timestamptz NOT NULL DEFAULT now(),
  reviewed_at           timestamptz,
  reviewed_by           text,
  admin_note            text
);

ALTER TABLE claim_requests DROP CONSTRAINT IF EXISTS claim_requests_status_check;
ALTER TABLE claim_requests ADD CONSTRAINT claim_requests_status_check
  CHECK (status IN ('pending','approved','rejected','cancelled'));

CREATE INDEX IF NOT EXISTS claim_requests_listing_id_idx ON claim_requests(listing_id);
CREATE INDEX IF NOT EXISTS claim_requests_status_idx     ON claim_requests(status);
CREATE INDEX IF NOT EXISTS claim_requests_submitted_at_idx ON claim_requests(submitted_at DESC);
CREATE INDEX IF NOT EXISTS claim_requests_status_submitted_idx
  ON claim_requests(status, submitted_at DESC) WHERE status = 'pending';

-- Verify (should return: 1 table · 11 columns · 1 check constraint · 4 indexes)
SELECT table_name FROM information_schema.tables WHERE table_name = 'claim_requests';
SELECT column_name FROM information_schema.columns WHERE table_name = 'claim_requests' ORDER BY ordinal_position;
SELECT conname FROM pg_constraint WHERE conrelid = 'claim_requests'::regclass AND conname LIKE '%_check';
SELECT indexname FROM pg_indexes WHERE tablename = 'claim_requests' ORDER BY indexname;
