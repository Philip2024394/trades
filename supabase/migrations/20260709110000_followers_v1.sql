-- Followers — the single largest network-effect lever.
--
-- Every trade / merchant profile now has a real "follow" relationship.
-- New posts (products, beacons, promos) from a followed trade land in
-- the follower's personal activity feed. Reciprocal follows compound
-- the trust graph the way endorsements never quite could — endorsements
-- require asymmetric intent; follows are casual "keep me in the loop".
--
-- Sticky by design: trades leaving lose their audience. That's the moat.

BEGIN;

CREATE TABLE IF NOT EXISTS hammerex_trade_followers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_listing_id uuid NOT NULL
    REFERENCES hammerex_trade_off_listings(id) ON DELETE CASCADE,
  followed_listing_id uuid NOT NULL
    REFERENCES hammerex_trade_off_listings(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Follower can mute new-post notifications without unfollowing.
  notify boolean NOT NULL DEFAULT true,
  UNIQUE (follower_listing_id, followed_listing_id),
  -- Can't follow yourself.
  CHECK (follower_listing_id <> followed_listing_id)
);

CREATE INDEX IF NOT EXISTS trade_followers_follower_idx
  ON hammerex_trade_followers (follower_listing_id, created_at DESC);
CREATE INDEX IF NOT EXISTS trade_followers_followed_idx
  ON hammerex_trade_followers (followed_listing_id, created_at DESC);


-- Denormalised follower + following counts on the listing itself so
-- the profile page renders in one query.
ALTER TABLE hammerex_trade_off_listings
  ADD COLUMN IF NOT EXISTS follower_count int NOT NULL DEFAULT 0
    CHECK (follower_count >= 0),
  ADD COLUMN IF NOT EXISTS following_count int NOT NULL DEFAULT 0
    CHECK (following_count >= 0);


-- Recount trigger — bumps both sides on every INS/UPD/DEL. Simpler
-- than incremental math and always correct.
CREATE OR REPLACE FUNCTION hammerex_trade_followers_recount()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  follower_id uuid;
  followed_id uuid;
BEGIN
  follower_id := COALESCE(NEW.follower_listing_id, OLD.follower_listing_id);
  followed_id := COALESCE(NEW.followed_listing_id, OLD.followed_listing_id);
  UPDATE hammerex_trade_off_listings
     SET following_count = (
       SELECT count(*)
         FROM hammerex_trade_followers
        WHERE follower_listing_id = follower_id
     )
   WHERE id = follower_id;
  UPDATE hammerex_trade_off_listings
     SET follower_count = (
       SELECT count(*)
         FROM hammerex_trade_followers
        WHERE followed_listing_id = followed_id
     )
   WHERE id = followed_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trade_followers_recount_ins ON hammerex_trade_followers;
CREATE TRIGGER trade_followers_recount_ins
AFTER INSERT ON hammerex_trade_followers
FOR EACH ROW EXECUTE FUNCTION hammerex_trade_followers_recount();

DROP TRIGGER IF EXISTS trade_followers_recount_del ON hammerex_trade_followers;
CREATE TRIGGER trade_followers_recount_del
AFTER DELETE ON hammerex_trade_followers
FOR EACH ROW EXECUTE FUNCTION hammerex_trade_followers_recount();


-- Widen os_activity_events kind check so follower notifications flow
-- through the existing activity feed pipeline (personal + landing).
ALTER TABLE os_activity_events
  DROP CONSTRAINT IF EXISTS os_activity_events_kind_check;

ALTER TABLE os_activity_events
  ADD CONSTRAINT os_activity_events_kind_check
  CHECK (kind IN (
    'comment_reply',
    'contact_received',
    'lead_matched',
    'trade_joined',
    'tier_upgraded',
    'thread_hot',
    'project_posted',
    'system_tip',
    'beacon_fired',
    'follower_new_post',
    'follower_gained'
  ));

COMMIT;
