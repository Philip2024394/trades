-- Materials passport plumbing (shift 3, v1 minimal).
--
-- Adds property_id to yard posts + beacon responses so buyers can
-- optionally tag "this is for property X" during a transaction. Once
-- the pass-through UI + surveyor B2B API land in v2, the plumbing is
-- already in place — no rewrite needed.
--
-- SCOPE INTENTIONALLY MINIMAL: this migration ships columns +
-- indexes only. UI to select a property, verification for surveyor
-- readouts, QR pages, and monetisation all land in a follow-on
-- sprint. The columns being present now means retrofit is a 2-hour
-- add rather than a schema change.

BEGIN;

-- Yard post owner can tag "this beacon is for property X". Nullable
-- because the vast majority of posts won't be property-scoped.
ALTER TABLE hammerex_trade_off_yard_posts
  ADD COLUMN IF NOT EXISTS property_id uuid
    REFERENCES os_properties(id) ON DELETE SET NULL;

-- Accepted beacon responses inherit the property from their beacon
-- post — but store it locally too so we don't have to JOIN for the
-- materials trail query.
ALTER TABLE hammerex_yard_beacon_responses
  ADD COLUMN IF NOT EXISTS property_id uuid
    REFERENCES os_properties(id) ON DELETE SET NULL;

-- Hot-path: fetch all yard activity for a given property
CREATE INDEX IF NOT EXISTS yard_posts_property_idx
  ON hammerex_trade_off_yard_posts (property_id, created_at DESC)
  WHERE property_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS yard_beacon_responses_property_idx
  ON hammerex_yard_beacon_responses (property_id, created_at DESC)
  WHERE property_id IS NOT NULL;

COMMIT;
