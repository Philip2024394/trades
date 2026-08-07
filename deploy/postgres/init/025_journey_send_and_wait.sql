-- NEX Journey Engine · §5.14 · Phase 5.1.4 · SendCampaignAndWait
--
-- Doctrine: docs/JOURNEY_ENGINE_CHARTER.md · Philip's 5.1.4 rules:
--   1. Journey NEVER polls individual providers · only reads the
--      canonical nex.campaign_recipients.send_status
--   2. Explicit completion vs permanent failure semantics ·
--      temporary failures do not "finish" the campaign
--   3. Idempotency · one journey_state MUST correspond to one
--      campaign execution · enforced by UNIQUE(journey_state_id)
--
-- Single additive table · zero changes to any v1.0 table · zero
-- changes to nex.journey_events (reuses existing event vocabulary).

CREATE TABLE IF NOT EXISTS nex.journey_campaign_executions (
  execution_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_state_id      UUID NOT NULL REFERENCES nex.journey_states(state_id) ON DELETE CASCADE,
  journey_id            UUID NOT NULL,
  journey_slug          TEXT NOT NULL,
  journey_version       INT  NOT NULL,
  node_id               TEXT NOT NULL,
  campaign_id           UUID NOT NULL REFERENCES nex.campaigns(campaign_id) ON DELETE RESTRICT,
  contact_id            UUID NOT NULL,
  status                TEXT NOT NULL DEFAULT 'in_flight'
                          CHECK (status IN ('in_flight','completed','failed_permanent','timed_out')),
  dispatched_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at          TIMESTAMPTZ,
  timed_out_at          TIMESTAMPTZ,
  last_checked_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  poll_count            INT NOT NULL DEFAULT 0,
  last_recipient_status TEXT,                             -- pending · sent · failed · suppressed · skipped_window
  outcome_reason        TEXT,
  metadata              JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Idempotency · Philip's rule #3 · one journey state = one execution
CREATE UNIQUE INDEX IF NOT EXISTS journey_campaign_executions_state_uniq
  ON nex.journey_campaign_executions (journey_state_id);

CREATE INDEX IF NOT EXISTS journey_campaign_executions_journey_idx
  ON nex.journey_campaign_executions (journey_id, dispatched_at DESC);

CREATE INDEX IF NOT EXISTS journey_campaign_executions_in_flight_idx
  ON nex.journey_campaign_executions (status, dispatched_at)
  WHERE status = 'in_flight';

ALTER TABLE nex.journey_campaign_executions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'nex' AND tablename = 'journey_campaign_executions' AND policyname = 'service_role_all_journey_campaign_executions') THEN
    CREATE POLICY "service_role_all_journey_campaign_executions" ON nex.journey_campaign_executions FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE  nex.journey_campaign_executions IS 'One row per (journey_state, campaign) dispatched via SendCampaignAndWait · UNIQUE(journey_state_id) enforces idempotency · reads nex.campaign_recipients.send_status for progress · never polls providers directly';
COMMENT ON COLUMN nex.journey_campaign_executions.status IS 'in_flight · completed · failed_permanent · timed_out · SendCampaignAndWait sets these based on canonical recipient send_status';
