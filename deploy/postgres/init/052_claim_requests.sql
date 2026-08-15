-- 052 · claim_requests audit table for M6.2 (Philip 2026-08-15)
-- ─────────────────────────────────────────────────────────────────────
-- Complete audit trail for every claim request submitted via
-- /nex-app/claim → POST /api/nex/claim/request.
--
-- Philip's rule: a claim request must NEVER automatically make a company
-- a paid member or mark it as NEX-verified. Approval only moves the
-- listing to `claimed`. Payment is a separate commercial event handled
-- by M6.3 (Stripe · not yet built).
--
-- Statuses: pending → approved | rejected | cancelled
--
-- Applies to the NEX Supabase project (ijvqdvsvwtwxzcqmoqit).
-- Run via Supabase Dashboard → SQL Editor. Idempotent · safe to re-run.

CREATE TABLE IF NOT EXISTS claim_requests (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The listing being claimed (FK to directory_seeds).
  listing_id            uuid REFERENCES directory_seeds(id) ON DELETE SET NULL,

  -- Name of the business at the moment the claim was submitted. Preserved
  -- separately so the audit trail survives even if the directory_seeds row
  -- is later renamed, merged, or (rarely) deleted.
  company_name_snapshot text NOT NULL,

  -- Claimant details as submitted
  claimant_name         text,
  claimant_email        text NOT NULL,
  claimant_role         text,   -- "Owner" · "Director" · "Marketing Manager" · etc.
  reason                text,   -- Optional note / additional context

  -- Lifecycle
  status                text NOT NULL DEFAULT 'pending',

  -- Timestamps
  submitted_at          timestamptz NOT NULL DEFAULT now(),
  reviewed_at           timestamptz,
  reviewed_by           text,             -- Admin identifier (email or user id)
  admin_note            text              -- Reason for approve/reject/cancel decision
);

-- Explicit status enum via CHECK constraint (evolvable · drop+add later if we add statuses)
ALTER TABLE claim_requests DROP CONSTRAINT IF EXISTS claim_requests_status_check;
ALTER TABLE claim_requests ADD CONSTRAINT claim_requests_status_check
  CHECK (status IN ('pending','approved','rejected','cancelled'));

-- Indexes for the admin review dashboard
CREATE INDEX IF NOT EXISTS claim_requests_listing_id_idx ON claim_requests(listing_id);
CREATE INDEX IF NOT EXISTS claim_requests_status_idx     ON claim_requests(status);
CREATE INDEX IF NOT EXISTS claim_requests_submitted_at_idx ON claim_requests(submitted_at DESC);

-- Composite for the primary admin query · "show me pending requests newest first"
CREATE INDEX IF NOT EXISTS claim_requests_status_submitted_idx
  ON claim_requests(status, submitted_at DESC)
  WHERE status = 'pending';

-- ── Verification queries (run after apply to confirm) ──

-- 1 row expected
SELECT table_name FROM information_schema.tables
 WHERE table_schema = 'public' AND table_name = 'claim_requests';

-- 11 rows expected: one per column
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_name = 'claim_requests'
 ORDER BY ordinal_position;

-- 1 row expected: the status CHECK constraint
SELECT conname FROM pg_constraint
 WHERE conrelid = 'claim_requests'::regclass
   AND conname LIKE '%_check';

-- 4 rows expected: the indexes
SELECT indexname FROM pg_indexes
 WHERE tablename = 'claim_requests'
 ORDER BY indexname;
