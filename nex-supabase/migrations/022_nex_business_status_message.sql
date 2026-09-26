-- ============================================================================
-- NEX-native Migration 022 · nex_business.status_message + expires_at
-- ============================================================================
--
-- Purpose:
--   Wave B Slice 3c · merchants publish a short temporary message on their
--   business page ("Open till 8pm today" · "Restocked oak" · "Closed Mon").
--   Optional TTL via status_message_expires_at · display layer filters
--   past-expiry messages so they naturally disappear without a cron.
--
-- Doctrine:
--   · Anti-fabrication · both fields nullable · null message = nothing to show
--   · Storage-layer cap: 200 chars (CHECK)
--   · CHECK: expires_at can be null (no expiry) OR must be a timestamp
--   · CHECK: expires_at requires message to be non-null (no expiry without
--     something to expire)
--   · Public display: business_service does NOT filter · consumers filter by
--     now() against expires_at at render time
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '022';
--     ALTER TABLE nex_business DROP CONSTRAINT IF EXISTS nex_business_status_message_length;
--     ALTER TABLE nex_business DROP CONSTRAINT IF EXISTS nex_business_status_message_expires_requires_message;
--     ALTER TABLE nex_business DROP COLUMN IF EXISTS status_message;
--     ALTER TABLE nex_business DROP COLUMN IF EXISTS status_message_expires_at;
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_business
  ADD COLUMN IF NOT EXISTS status_message           text,
  ADD COLUMN IF NOT EXISTS status_message_expires_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'nex_business_status_message_length'
       AND conrelid = 'nex_business'::regclass
  ) THEN
    ALTER TABLE nex_business
      ADD CONSTRAINT nex_business_status_message_length CHECK (
        status_message IS NULL OR char_length(status_message) <= 200
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'nex_business_status_message_expires_requires_message'
       AND conrelid = 'nex_business'::regclass
  ) THEN
    ALTER TABLE nex_business
      ADD CONSTRAINT nex_business_status_message_expires_requires_message CHECK (
        status_message_expires_at IS NULL OR status_message IS NOT NULL
      );
  END IF;
END $$;

COMMENT ON COLUMN nex_business.status_message IS
  'Merchant-editable short status message shown on their public page · max 200 chars · nullable.';
COMMENT ON COLUMN nex_business.status_message_expires_at IS
  'Optional TTL for status_message · timestamptz · when past, consumers filter out the message · null = no expiry (message stays until manually cleared).';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '022',
    'nex_business.status_message + status_message_expires_at · nullable + CHECK',
    'Wave B Slice 3c · Founder-authorised keypad build 2026-09-24. Optional TTL · consumers filter by now() at render time · no cron needed.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ============================================================================
-- Post-apply verification:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'nex_business'
--      AND column_name IN ('status_message', 'status_message_expires_at');
--     -- expect: 2 rows
--   SELECT conname FROM pg_constraint
--    WHERE conrelid = 'nex_business'::regclass
--      AND conname IN ('nex_business_status_message_length',
--                       'nex_business_status_message_expires_requires_message');
--     -- expect: 2 rows
-- ============================================================================
