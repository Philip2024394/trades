-- XRatedTrade OS — User Discovery (V2 Ecosystem Foundation, part 5/5).
--
-- Sarah is not a homeowner journey — she is the consumer discovery
-- platform. This migration adds the personal-library primitives that
-- let her save favourites, follow businesses, compare, and receive a
-- personalised feed. Recently-viewed telemetry captures behavioural
-- signal from Day 0 (unrecoverable if skipped).
--
-- All tables key on party_id (os_parties) for logged-in users;
-- anonymous browsing uses a session-scoped variant that lives in
-- browser storage, not this table.

BEGIN;

-- ---------------------------------------------------------------------
-- 1. os_user_follows — Sarah follows a business
--
-- Following means: appear in her feed when the business posts an
-- offer, portfolio project, or update. Unfollow is a hard delete —
-- she asked for it, so we honour it. (Un-follows do NOT affect the
-- graph — following is a homeowner-side signal, not a merchant edge.)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_user_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES os_parties(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES os_business_listings(id) ON DELETE CASCADE,
  followed_at timestamptz NOT NULL DEFAULT now(),
  notify_new_offers boolean NOT NULL DEFAULT true,
  notify_new_portfolio boolean NOT NULL DEFAULT true,
  notify_general boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT os_user_follows_unique UNIQUE (party_id, business_id)
);

CREATE INDEX IF NOT EXISTS os_user_follows_party_idx
  ON os_user_follows (party_id, followed_at DESC);
CREATE INDEX IF NOT EXISTS os_user_follows_business_idx
  ON os_user_follows (business_id);

-- ---------------------------------------------------------------------
-- 2. os_user_favourites — save businesses, products, services, offers
--
-- Polymorphic target — target_type + target_id. Favourites are Sarah's
-- private list; they never appear on the business side.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_user_favourites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES os_parties(id) ON DELETE CASCADE,
  target_type text NOT NULL
    CHECK (target_type IN ('business','product','service','offer','portfolio_project')),
  target_id uuid NOT NULL,
  saved_at timestamptz NOT NULL DEFAULT now(),
  note text,                                -- Sarah's private note
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT os_user_favourites_unique UNIQUE (party_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS os_user_favourites_party_idx
  ON os_user_favourites (party_id, saved_at DESC);
CREATE INDEX IF NOT EXISTS os_user_favourites_target_idx
  ON os_user_favourites (target_type, target_id);

-- ---------------------------------------------------------------------
-- 3. os_user_compare_set — 2–4 businesses side-by-side
--
-- Compare sets are ephemeral in the UI but persisted here so Sarah
-- can return to a comparison she started on mobile from desktop.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_user_compare_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES os_parties(id) ON DELETE CASCADE,
  target_type text NOT NULL DEFAULT 'business'
    CHECK (target_type IN ('business','product','service')),
  target_ids uuid[] NOT NULL DEFAULT '{}',
  label text,                               -- Sarah names her comparison
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT os_user_compare_sets_size
    CHECK (array_length(target_ids, 1) IS NULL
      OR array_length(target_ids, 1) BETWEEN 1 AND 4)
);

CREATE INDEX IF NOT EXISTS os_user_compare_sets_party_idx
  ON os_user_compare_sets (party_id, updated_at DESC);

-- ---------------------------------------------------------------------
-- 4. os_user_recently_viewed — behavioural telemetry
--
-- Written on every business / product / service page view. Powers
-- "Recently viewed" homepage tile and personalisation signal for
-- future recommendation ranking. High write volume — narrow schema,
-- no updates, aggregated to daily buckets by scheduled job.
--
-- Anonymous browsing writes visitor_session_id only; logged-in
-- writes carry party_id so history persists across sessions.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_user_recently_viewed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid REFERENCES os_parties(id) ON DELETE CASCADE,
  visitor_session_id text,
  target_type text NOT NULL
    CHECK (target_type IN ('business','product','service','portfolio_project','offer')),
  target_id uuid NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  dwell_seconds integer,                    -- optional client-tracked
  entry_source text,                        -- "search", "banner", "circle", "feed"

  CONSTRAINT os_user_recently_viewed_identity
    CHECK (party_id IS NOT NULL OR visitor_session_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS os_user_recently_viewed_party_idx
  ON os_user_recently_viewed (party_id, viewed_at DESC)
  WHERE party_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS os_user_recently_viewed_session_idx
  ON os_user_recently_viewed (visitor_session_id, viewed_at DESC)
  WHERE visitor_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS os_user_recently_viewed_target_idx
  ON os_user_recently_viewed (target_type, target_id, viewed_at DESC);

-- ---------------------------------------------------------------------
-- 5. os_search_popularity — aggregated query popularity
--
-- Written by a scheduled job that reads raw search event logs (kept
-- elsewhere / in the event bus) and updates counts weekly. Used for
-- "Popular searches" autocomplete suggestions.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_search_popularity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query text NOT NULL,
  scope text NOT NULL DEFAULT 'all'
    CHECK (scope IN ('all','businesses','products','services','circles')),
  city text,                                -- optional geo scoping
  count_this_week integer NOT NULL DEFAULT 0,
  count_last_week integer NOT NULL DEFAULT 0,
  count_all_time integer NOT NULL DEFAULT 0,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT os_search_popularity_unique UNIQUE (lower(query), scope, lower(city))
);

CREATE INDEX IF NOT EXISTS os_search_popularity_scope_idx
  ON os_search_popularity (scope, count_this_week DESC);
CREATE INDEX IF NOT EXISTS os_search_popularity_city_idx
  ON os_search_popularity (lower(city), count_this_week DESC)
  WHERE city IS NOT NULL;

-- ---------------------------------------------------------------------
-- 6. Touch triggers
-- ---------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'os_user_compare_sets',
      'os_search_popularity'
    ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_touch ON %I;', t, t);
    EXECUTE format(
      'CREATE TRIGGER %I_touch BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION os_touch_updated_at();',
      t, t
    );
  END LOOP;
END $$;

-- Follows / favourites / recently_viewed are append/hard-delete only —
-- no updated_at, no touch trigger.

-- ---------------------------------------------------------------------
-- 7. RLS — service-role only
-- ---------------------------------------------------------------------
ALTER TABLE os_user_follows          ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_user_favourites       ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_user_compare_sets     ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_user_recently_viewed  ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_search_popularity     ENABLE ROW LEVEL SECURITY;

COMMIT;
