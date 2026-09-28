-- Bridge 23b · Restaurant events profile + venue gallery.
-- --------------------------------------------------------
-- Two additive columns on nex_business:
--
--   events_profile jsonb
--     · hosts_parties            bool
--     · seat_capacity            int  (null = not disclosed)
--     · outside_catering         bool
--     · has_live_music_or_dj     bool
--     · can_book_private_party   bool
--     · has_sound_system_pa      bool
--     · other_event_info         text (free-form paragraph)
--
--   venue_gallery text[]  (up to 6 URLs · client-enforced cap)
--
-- JSONB keeps the schema forgiving as new event fields land.
-- Non-restaurant businesses may set fields to false / null and the
-- About page hides the section when nothing meaningful is set.
--
-- Rollback:
--   BEGIN;
--     ALTER TABLE nex_business
--       DROP COLUMN IF EXISTS events_profile,
--       DROP COLUMN IF EXISTS venue_gallery;
--     DELETE FROM nex_migration_history WHERE version = '080';
--   COMMIT;

BEGIN;

ALTER TABLE public.nex_business
  ADD COLUMN IF NOT EXISTS events_profile jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.nex_business
  ADD COLUMN IF NOT EXISTS venue_gallery text[] NOT NULL DEFAULT ARRAY[]::text[];

COMMENT ON COLUMN public.nex_business.events_profile IS
  'Structured event-hosting profile for venues (restaurants, cafes, bars). Keys: hosts_parties, seat_capacity, outside_catering, has_live_music_or_dj, can_book_private_party, has_sound_system_pa, other_event_info. Buyer About page renders an Events section under About Us when any field is set.';
COMMENT ON COLUMN public.nex_business.venue_gallery IS
  'Up to 6 photo URLs showcasing the venue itself · dining room, private party space, sound stage, kitchen, outside catering setup. Client caps at 6; server-side we trust the caller.';

INSERT INTO public.nex_migration_history (version, description, notes)
  VALUES (
    '080',
    'Bridge 23b · nex_business.events_profile jsonb + venue_gallery text[]',
    'Founder-authorised 2026-09-28. Restaurants, cafes, and bars can now advertise party hosting, seat capacity, outside catering, live music/DJ, private-party booking, and PA system on the buyer-facing About page. Venue gallery gives visitors the visual proof they need before booking an event.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT column_name, data_type
--     FROM information_schema.columns
--    WHERE table_name = 'nex_business'
--      AND column_name IN ('events_profile', 'venue_gallery');
