-- Add 'beacon_fired' to os_activity_events kind check so beacons can
-- flow through the landing activity widget alongside comment replies,
-- new projects, and tier upgrades.

BEGIN;

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
    'beacon_fired'
  ));

COMMIT;
