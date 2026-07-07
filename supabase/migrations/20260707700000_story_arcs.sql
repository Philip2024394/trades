-- G3 · Story Arcs — multi-event narratives.
--
-- A story arc groups the events that describe one customer job over
-- time. Detection is job_id first (deterministic), postcode + trade
-- + 30-day window second (probabilistic). On close, a projection
-- composes a case study across the merchant's channels.
--
-- The join table (story_arc_events) is many-to-many even though
-- events currently only belong to one arc — that shape gives us the
-- flexibility to link cross-project events later (e.g. a "top 10
-- kitchens of 2026" arc that references 10 different job arcs).

BEGIN;

CREATE TABLE IF NOT EXISTS story_arcs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL,
  -- Deterministic key when a job_id is available — otherwise NULL and
  -- the arc is postcode/trade/time-window derived.
  natural_key text,
  arc_type text NOT NULL DEFAULT 'project_progress',
    -- 'project_progress' | 'seasonal' | 'series' | 'top_of_period'
  status text NOT NULL DEFAULT 'open',
    -- 'open' | 'closed' | 'archived' | 'expired'
  narrative jsonb DEFAULT '{}'::jsonb,
  -- Facets accumulated across the arc's events (trade, service, materials,
  -- postcode, cost_band). Used by the case-study composer.
  facets jsonb NOT NULL DEFAULT '{}'::jsonb,
  starts_at timestamptz NOT NULL DEFAULT now(),
  last_event_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  auto_close_after_days int NOT NULL DEFAULT 21,
  case_study_publication_ids uuid[] NOT NULL DEFAULT '{}',
  case_study_feed_post_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status IN ('open', 'closed', 'archived', 'expired'))
);

-- Fast lookup for the arc detector — "does this event's job_id already
-- belong to an open arc?"
CREATE UNIQUE INDEX IF NOT EXISTS story_arcs_natural_key_unique
  ON story_arcs (merchant_id, natural_key)
  WHERE natural_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS story_arcs_merchant_open_idx
  ON story_arcs (merchant_id, status, last_event_at DESC);

CREATE INDEX IF NOT EXISTS story_arcs_merchant_facets_gin_idx
  ON story_arcs USING gin (facets jsonb_path_ops);

CREATE OR REPLACE FUNCTION story_arcs_touch_updated()
  RETURNS trigger AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS story_arcs_touch_updated ON story_arcs;
CREATE TRIGGER story_arcs_touch_updated
  BEFORE UPDATE ON story_arcs
  FOR EACH ROW EXECUTE FUNCTION story_arcs_touch_updated();

CREATE TABLE IF NOT EXISTS story_arc_events (
  arc_id uuid NOT NULL REFERENCES story_arcs(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES business_events(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'progress',
    -- 'opener' | 'progress' | 'climax' | 'closer' | 'sequel'
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (arc_id, event_id)
);

CREATE INDEX IF NOT EXISTS story_arc_events_event_idx
  ON story_arc_events (event_id);

ALTER TABLE story_arcs ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_arc_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS story_arcs_owner ON story_arcs;
CREATE POLICY story_arcs_owner ON story_arcs
  FOR ALL USING (merchant_id = auth.uid())
  WITH CHECK (merchant_id = auth.uid());
DROP POLICY IF EXISTS story_arcs_service ON story_arcs;
CREATE POLICY story_arcs_service ON story_arcs
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS story_arc_events_owner ON story_arc_events;
CREATE POLICY story_arc_events_owner ON story_arc_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM story_arcs a
      WHERE a.id = story_arc_events.arc_id AND a.merchant_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS story_arc_events_service ON story_arc_events;
CREATE POLICY story_arc_events_service ON story_arc_events
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

COMMIT;
