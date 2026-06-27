-- Xrated Trades — Job Diary add-on.
--
-- Live-update stream a tradesperson runs per project. Customers see
-- *"currently working on the loft conversion in Camden — day 4, on
-- track"* with photos and status chips. Built-in social-share turns
-- each post into Instagram/TikTok content with a backlink.
--
-- Three tables:
--
-- 1. hammerex_xrated_projects — one row per project a tradesperson
--    advertises. Privacy-disclaimer gate (no faces / no addresses /
--    customer agreed) is enforced via NOT NULL on
--    privacy_disclaimer_confirmed_at. A consistency CHECK ensures the
--    completed status always carries a completed_at + final_summary
--    pair, and a `live` project never has a completed_at.
--
-- 2. hammerex_xrated_project_updates — one row per "post" within a
--    project. status_chip is a controlled enum of 8 neutral-framed
--    values. image_urls cardinality capped at 4 (matches the editor
--    UI cap; 5+ images per post starts to look like a graveyard).
--
-- 3. hammerex_xrated_project_removal_requests — public right-to-
--    removal audit trail. A customer or member of the public can ask
--    a project to be hidden; the API soft-hides the project
--    immediately and the admin reviews within 24h.
--
-- All three tables ON DELETE CASCADE from the parent listing. The
-- shared hammerex_xrated_touch_updated_at() trigger function already
-- exists (created in the Shop Mode migration) so we DROP-CREATE the
-- trigger only.

CREATE TABLE IF NOT EXISTS hammerex_xrated_projects (
  id                               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id                       uuid NOT NULL
    REFERENCES hammerex_trade_off_listings(id) ON DELETE CASCADE,
  title                            text NOT NULL
    CHECK (char_length(title) BETWEEN 3 AND 80),
  location_label                   text NOT NULL
    CHECK (char_length(location_label) BETWEEN 2 AND 60),
  started_at                       timestamptz NOT NULL DEFAULT now(),
  estimated_complete_at            timestamptz,
  completed_at                     timestamptz,
  cover_image_url                  text NOT NULL,
  final_summary                    text
    CHECK (final_summary IS NULL OR char_length(final_summary) <= 500),
  status                           text NOT NULL DEFAULT 'live'
    CHECK (status IN ('live', 'completed', 'archived')),
  privacy_disclaimer_confirmed_at  timestamptz NOT NULL,
  sort_order                       int NOT NULL DEFAULT 0,
  created_at                       timestamptz NOT NULL DEFAULT now(),
  updated_at                       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT projects_completed_consistency CHECK (
    (status = 'completed' AND completed_at IS NOT NULL AND final_summary IS NOT NULL)
    OR (status <> 'completed' AND completed_at IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS hammerex_xrated_projects_listing_status_idx
  ON hammerex_xrated_projects (listing_id, status, started_at DESC);

CREATE INDEX IF NOT EXISTS hammerex_xrated_projects_listing_live_idx
  ON hammerex_xrated_projects (listing_id)
  WHERE status = 'live';

CREATE TABLE IF NOT EXISTS hammerex_xrated_project_updates (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          uuid NOT NULL
    REFERENCES hammerex_xrated_projects(id) ON DELETE CASCADE,
  status_chip         text NOT NULL
    CHECK (status_chip IN (
      'on_track','stage_complete','inspection_passed',
      'weather_delay','materials_delay','scope_change',
      'snagging','completed'
    )),
  image_urls          text[] NOT NULL DEFAULT '{}'
    CHECK (cardinality(image_urls) BETWEEN 0 AND 4),
  note                text
    CHECK (note IS NULL OR char_length(note) <= 280),
  shared_platforms    text[] NOT NULL DEFAULT '{}',
  ip_hash             text,
  posted_at           timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hammerex_xrated_project_updates_project_idx
  ON hammerex_xrated_project_updates (project_id, posted_at DESC);

CREATE TABLE IF NOT EXISTS hammerex_xrated_project_removal_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL
    REFERENCES hammerex_xrated_projects(id) ON DELETE CASCADE,
  reason          text NOT NULL,
  requester_email text NOT NULL,
  resolved_at     timestamptz,
  resolution_note text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS hammerex_xrated_projects_touch ON hammerex_xrated_projects;
CREATE TRIGGER hammerex_xrated_projects_touch
  BEFORE UPDATE ON hammerex_xrated_projects
  FOR EACH ROW EXECUTE FUNCTION hammerex_xrated_touch_updated_at();
