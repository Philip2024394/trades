-- NEX Communications · §5.5 · Campaigns + Campaign↔Segment junction
--
-- The Campaign Builder ORCHESTRATES a delivery. It NEVER stores a
-- contact list. It stores REFERENCES to saved Audience Engine
-- segments. At send-time the Audience Engine performs a FRESH query
-- so new contacts are included · unsubscribes respected ·
-- never-contact rules applied · compliance always current.
--
-- Separation doctrine (Philip 2026-08-07):
--   Campaign Builder      orchestrates
--   Audience Engine       selects recipients
--   Contact Registry      canonical identities
--   Compliance Engine     eligibility
--   Email Runtime         delivery
--
-- Idempotent · additive-only · safe to re-run.

CREATE TABLE IF NOT EXISTS nex.campaigns (
  campaign_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  description      TEXT,
  campaign_type    TEXT NOT NULL DEFAULT 'marketing'   CHECK (campaign_type IN ('marketing','transactional','announcement','newsletter')),
  status           TEXT NOT NULL DEFAULT 'draft'       CHECK (status IN ('draft','ready_for_review','approved','scheduled','sending','paused','completed','cancelled','archived')),
  subject          TEXT,
  preview_text     TEXT,
  body_html        TEXT,                                                -- composer (Phase 4c) fills this · MVP allows raw HTML paste
  body_text        TEXT,
  sender_name      TEXT,
  sender_from      TEXT,
  sender_reply_to  TEXT,
  scheduled_at     TIMESTAMPTZ,
  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  last_preview_at  TIMESTAMPTZ,
  last_preview     JSONB,                                                -- cached aggregate preview · refreshed by /preview endpoint
  send_stats       JSONB NOT NULL DEFAULT '{}'::jsonb,                   -- filled by Phase 4d/4e (sent · failed · bounced · opened · clicked)
  created_by       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS campaigns_status_idx       ON nex.campaigns (status)         WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS campaigns_scheduled_idx    ON nex.campaigns (scheduled_at)   WHERE status IN ('scheduled','sending','paused');
CREATE INDEX IF NOT EXISTS campaigns_updated_idx      ON nex.campaigns (updated_at DESC);

-- Many-to-many · one campaign targets one or more saved audiences.
-- Deleting a campaign removes junction rows · deleting a segment
-- blocks if referenced (ON DELETE RESTRICT · Audience Engine archives
-- via archived_at rather than hard delete, so this is safe).
CREATE TABLE IF NOT EXISTS nex.campaign_segments (
  campaign_id  UUID NOT NULL REFERENCES nex.campaigns(campaign_id) ON DELETE CASCADE,
  segment_id   UUID NOT NULL REFERENCES nex.contact_segments(segment_id) ON DELETE RESTRICT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (campaign_id, segment_id)
);

CREATE INDEX IF NOT EXISTS campaign_segments_segment_idx ON nex.campaign_segments (segment_id);

ALTER TABLE nex.campaigns          ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.campaign_segments  ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'nex' AND tablename = 'campaigns' AND policyname = 'service_role_all_campaigns') THEN
    CREATE POLICY "service_role_all_campaigns" ON nex.campaigns FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'nex' AND tablename = 'campaign_segments' AND policyname = 'service_role_all_campaign_segments') THEN
    CREATE POLICY "service_role_all_campaign_segments" ON nex.campaign_segments FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE nex.campaigns          IS 'Orchestrates a delivery · stores REFERENCES to segments · never a contact list';
COMMENT ON TABLE nex.campaign_segments  IS 'Junction · one campaign targets one or more saved audiences';
COMMENT ON COLUMN nex.campaigns.status  IS 'Lifecycle: draft → ready_for_review → approved → scheduled → sending → completed · paused/cancelled/archived as side branches';
