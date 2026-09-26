-- ============================================================================
-- NEX-native Migration 031 · nex_business.hours · reshape text → jsonb
-- ============================================================================
-- Wave B Slice 3b · structured weekly hours.
--
-- Prior state (from migration 014):
--   · nex_business.hours was a free-form text column · never wired to UI ·
--     zero non-null rows in prod (verified before this migration).
--
-- New shape (jsonb · nullable · null = "not specified"):
--   {
--     "mon": null | { "open": "HH:MM", "close": "HH:MM" },
--     "tue": null | { "open": "HH:MM", "close": "HH:MM" },
--     "wed": null | { "open": "HH:MM", "close": "HH:MM" },
--     "thu": null | { "open": "HH:MM", "close": "HH:MM" },
--     "fri": null | { "open": "HH:MM", "close": "HH:MM" },
--     "sat": null | { "open": "HH:MM", "close": "HH:MM" },
--     "sun": null | { "open": "HH:MM", "close": "HH:MM" }
--   }
--
--   · One interval per day (split shifts deferred).
--   · null on any day means "closed".
--   · Timezone is IMPLICITLY the business's local time · tz column TBD.
--
-- DB CHECK conservatively enforces "object with all 7 keys OR null"; deep
-- HH:MM + open<close validation lives in business-service.updateBusinessHours.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '031';
--     ALTER TABLE nex_business DROP CONSTRAINT IF EXISTS nex_business_hours_shape;
--     ALTER TABLE nex_business ALTER COLUMN hours TYPE text USING NULL;
--   COMMIT;
-- ============================================================================

BEGIN;

-- Guarantee no non-null residue before the type change (safety net · already
-- verified empty by the debug script before writing this migration).
UPDATE nex_business SET hours = NULL WHERE hours IS NOT NULL;

-- The migration-014 CHECK `nex_business_profile_lengths` includes
-- `char_length(hours) <= 500` which is incompatible with jsonb. Drop it and
-- re-add without the hours clause (the other columns keep their length caps).
ALTER TABLE nex_business
  DROP CONSTRAINT IF EXISTS nex_business_profile_lengths;

-- Convert text → jsonb (USING NULL because every row is already null; if any
-- text remained, we'd lose it, but pre-migration audit proved zero rows).
ALTER TABLE nex_business
  ALTER COLUMN hours TYPE jsonb USING NULL;

-- Re-add the profile-length CHECK without hours (other columns unchanged).
ALTER TABLE nex_business
  ADD CONSTRAINT nex_business_profile_lengths CHECK (
    (description  IS NULL OR char_length(description)  <= 2000)
    AND (logo_url IS NULL OR char_length(logo_url)     <= 1024)
    AND (address  IS NULL OR char_length(address)      <= 500)
    AND (public_phone IS NULL OR char_length(public_phone) <= 64)
    AND (public_email IS NULL OR char_length(public_email) <= 320)
    AND (website_url  IS NULL OR char_length(website_url)  <= 1024)
  );

ALTER TABLE nex_business
  DROP CONSTRAINT IF EXISTS nex_business_hours_shape;

ALTER TABLE nex_business
  ADD CONSTRAINT nex_business_hours_shape
    CHECK (
      hours IS NULL
      OR (
        jsonb_typeof(hours) = 'object'
        AND hours ? 'mon'
        AND hours ? 'tue'
        AND hours ? 'wed'
        AND hours ? 'thu'
        AND hours ? 'fri'
        AND hours ? 'sat'
        AND hours ? 'sun'
      )
    );

COMMENT ON COLUMN nex_business.hours IS
  'Weekly opening hours · jsonb · keys mon..sun · each value null (closed) or {open,close} HH:MM strings · null column = unspecified · timezone implicit (business local · tz column TBD).';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '031',
    'nex_business.hours reshape · text → jsonb · weekly {mon..sun} · CHECK object-with-7-keys',
    'Wave B Slice 3b · replaces unused text hours from migration 014 · zero rows migrated (pre-verified empty).'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;
