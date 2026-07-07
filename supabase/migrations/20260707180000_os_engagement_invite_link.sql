-- Engagement ↔ Trade Invite linkage.
--
-- When a foreman photographs a hire ("Dave the Carpenter, £2,400,
-- start 15 Aug"), we can now send Dave a Notebook invite that carries
-- the engagement context. When Dave signs up, his new listing links
-- back to the engagement automatically — no re-entry.

BEGIN;

ALTER TABLE os_homeowner_trade_invites
  ADD COLUMN IF NOT EXISTS engagement_id uuid
    REFERENCES os_site_engagements(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS os_homeowner_trade_invites_engagement_idx
  ON os_homeowner_trade_invites (engagement_id);

COMMIT;
