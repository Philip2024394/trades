-- ============================================================================
-- NEX-native Migration 086 · Bridge 39 + 41 · Personal profile trust signals
-- ============================================================================
--
-- Adds three columns to nex_account_profile so the personal profile
-- editor can capture structured day-to-day context AND the app can
-- derive a "Verified Personal ✓" tick when the profile is complete
-- AND the avatar was captured live via the on-device camera (Bridge
-- 40, deferred).
--
--   daily_activity         · text · NULL by default. When set, one of:
--       'student' | 'self_employed' | 'company_employee' | 'unemployed' | 'other'
--     Founder direction 2026-09-28: personal profiles must state what
--     the person does day to day so friends have context, and future
--     Directory work has a stable axis to match on.
--
--   daily_activity_detail  · jsonb NOT NULL DEFAULT '{}'. Cascading
--     follow-ups per activity. Free-form so the shape can evolve:
--       student           → { field_of_study, institution, year }
--       self_employed     → { business, industry }
--       company_employee  → { company, role }
--       unemployed        → { seeking, since_month }
--       other             → { note }
--
--   avatar_face_verified   · boolean NOT NULL DEFAULT false. True only
--     when the current avatar_url came through the live-camera capture
--     flow (MediaPipe face detection + on-device stream). File-upload
--     paths keep this false. Drives the Verified Personal ✓ tick which
--     needs BOTH avatar_face_verified AND a completed daily_activity.
--
-- No RLS change · nex_account_profile is world-readable for accepted
-- friends and always readable via service role (existing policies).
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '086';
--     ALTER TABLE nex_account_profile
--       DROP CONSTRAINT IF EXISTS nex_account_profile_daily_activity_known,
--       DROP COLUMN IF EXISTS daily_activity,
--       DROP COLUMN IF EXISTS daily_activity_detail,
--       DROP COLUMN IF EXISTS avatar_face_verified;
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_account_profile
  ADD COLUMN IF NOT EXISTS daily_activity text;

ALTER TABLE nex_account_profile
  DROP CONSTRAINT IF EXISTS nex_account_profile_daily_activity_known;

ALTER TABLE nex_account_profile
  ADD CONSTRAINT nex_account_profile_daily_activity_known
    CHECK (
      daily_activity IS NULL OR daily_activity IN (
        'student', 'self_employed', 'company_employee', 'unemployed', 'other'
      )
    );

ALTER TABLE nex_account_profile
  ADD COLUMN IF NOT EXISTS daily_activity_detail jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE nex_account_profile
  ADD COLUMN IF NOT EXISTS avatar_face_verified boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN nex_account_profile.daily_activity IS
  'Structured day-to-day status · student / self_employed / company_employee
   / unemployed / other. Cascading details live in daily_activity_detail.
   Sealed 2026-09-28 · Bridge 39.';

COMMENT ON COLUMN nex_account_profile.daily_activity_detail IS
  'Free-form jsonb with per-activity follow-up fields. Never null ·
   defaults to empty object. Sealed 2026-09-28 · Bridge 39.';

COMMENT ON COLUMN nex_account_profile.avatar_face_verified IS
  'True only when the current avatar_url was captured through the
   live-camera + MediaPipe face-detection flow (Bridge 40). Combined
   with a completed daily_activity, drives the Verified Personal ✓
   tick. Sealed 2026-09-28 · Bridge 41.';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '086',
    'Bridge 39/41 · nex_account_profile · daily_activity + avatar_face_verified',
    'Founder-authorised 2026-09-28. Structured occupation field + trust signal for the Verified Personal tick.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT column_name, data_type FROM information_schema.columns
--    WHERE table_name = 'nex_account_profile'
--      AND column_name IN ('daily_activity','daily_activity_detail','avatar_face_verified');
