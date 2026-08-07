-- NEX Delivery Engine · §5.7 · Persistent job queue + recipient snapshot
--
-- Layer position (Philip 2026-08-07):
--   Composer → Renderer → Scheduler → Queue → Worker → Runtime → Provider Adapter
--
-- Everything a campaign needs to be sent lives here so the process is
-- resumable after restart · workers never double-send (SELECT ... FOR
-- UPDATE SKIP LOCKED + explicit lease TTL) · every transition is
-- audited · providers are swappable (simulator by default).
--
-- Table names prefixed `delivery_` because `nex.jobs` is already used
-- by the knowledge/brain snapshot subsystem.
--
-- Idempotent · additive-only.

-- ── nex.delivery_jobs · durable queue ─────────────────────────────
CREATE TABLE IF NOT EXISTS nex.delivery_jobs (
  job_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type          TEXT NOT NULL         CHECK (job_type IN ('campaign.expand','campaign.send_batch','campaign.finalise')),
  status            TEXT NOT NULL DEFAULT 'pending'   CHECK (status IN ('pending','running','completed','failed','cancelled','dead_letter')),
  priority          INT NOT NULL DEFAULT 100,
  scheduled_for     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  campaign_id       UUID REFERENCES nex.campaigns(campaign_id) ON DELETE CASCADE,
  payload           JSONB NOT NULL DEFAULT '{}'::jsonb,
  result            JSONB,
  attempts          INT NOT NULL DEFAULT 0,
  max_attempts      INT NOT NULL DEFAULT 5,
  lease_owner       TEXT,
  lease_expires_at  TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  last_error        TEXT
);

CREATE INDEX IF NOT EXISTS delivery_jobs_pending_idx   ON nex.delivery_jobs (status, scheduled_for) WHERE status IN ('pending','running');
CREATE INDEX IF NOT EXISTS delivery_jobs_campaign_idx  ON nex.delivery_jobs (campaign_id);
CREATE INDEX IF NOT EXISTS delivery_jobs_lease_idx     ON nex.delivery_jobs (lease_expires_at) WHERE status = 'running';

-- ── nex.delivery_job_attempts · one row per execution attempt ─────
CREATE TABLE IF NOT EXISTS nex.delivery_job_attempts (
  attempt_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id         UUID NOT NULL REFERENCES nex.delivery_jobs(job_id) ON DELETE CASCADE,
  attempt_no     INT NOT NULL,
  worker_id      TEXT NOT NULL,
  started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at   TIMESTAMPTZ,
  outcome        TEXT   CHECK (outcome IN ('success','transient_failure','permanent_failure','abandoned') OR outcome IS NULL),
  latency_ms     INT,
  error          TEXT,
  detail         JSONB
);
CREATE INDEX IF NOT EXISTS delivery_job_attempts_job_idx ON nex.delivery_job_attempts (job_id, attempt_no DESC);

-- ── nex.delivery_workers · heartbeat table ────────────────────────
CREATE TABLE IF NOT EXISTS nex.delivery_workers (
  worker_id       TEXT PRIMARY KEY,
  hostname        TEXT,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  jobs_processed  INT NOT NULL DEFAULT 0,
  jobs_failed     INT NOT NULL DEFAULT 0,
  mode            TEXT NOT NULL DEFAULT 'simulation'   CHECK (mode IN ('simulation','runtime'))
);

-- ── nex.campaign_recipients · immutable per-campaign snapshot ─────
--
-- Written ONCE at expansion time · uniqueness on (campaign, contact)
-- means re-runs of expansion are safe (ON CONFLICT DO NOTHING). This
-- is the "immutable snapshot" from the doctrine — new contacts added
-- to segments after expansion do NOT retroactively join the campaign;
-- they'll join future campaigns.
CREATE TABLE IF NOT EXISTS nex.campaign_recipients (
  campaign_id          UUID NOT NULL REFERENCES nex.campaigns(campaign_id) ON DELETE CASCADE,
  contact_id           UUID NOT NULL,
  email                TEXT NOT NULL,
  country              TEXT,
  variables            JSONB NOT NULL DEFAULT '{}'::jsonb,
  send_status          TEXT NOT NULL DEFAULT 'pending'  CHECK (send_status IN ('pending','sent','failed','suppressed','skipped_window')),
  suppressed_reason    TEXT,
  attempts             INT NOT NULL DEFAULT 0,
  scheduled_for        TIMESTAMPTZ,
  sent_at              TIMESTAMPTZ,
  failed_at            TIMESTAMPTZ,
  provider             TEXT,
  provider_message_id  TEXT,
  latency_ms           INT,
  last_error           TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (campaign_id, contact_id)
);
CREATE INDEX IF NOT EXISTS campaign_recipients_status_idx  ON nex.campaign_recipients (campaign_id, send_status);
CREATE INDEX IF NOT EXISTS campaign_recipients_pending_idx ON nex.campaign_recipients (campaign_id) WHERE send_status = 'pending';

-- ── Row Level Security ────────────────────────────────────────────
ALTER TABLE nex.delivery_jobs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.delivery_job_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.delivery_workers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.campaign_recipients   ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'nex' AND tablename = 'delivery_jobs' AND policyname = 'service_role_all_delivery_jobs') THEN
    CREATE POLICY "service_role_all_delivery_jobs" ON nex.delivery_jobs FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'nex' AND tablename = 'delivery_job_attempts' AND policyname = 'service_role_all_delivery_job_attempts') THEN
    CREATE POLICY "service_role_all_delivery_job_attempts" ON nex.delivery_job_attempts FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'nex' AND tablename = 'delivery_workers' AND policyname = 'service_role_all_delivery_workers') THEN
    CREATE POLICY "service_role_all_delivery_workers" ON nex.delivery_workers FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'nex' AND tablename = 'campaign_recipients' AND policyname = 'service_role_all_campaign_recipients') THEN
    CREATE POLICY "service_role_all_campaign_recipients" ON nex.campaign_recipients FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE nex.delivery_jobs         IS 'Durable job queue for the Delivery Engine · resumable · leased via SELECT ... FOR UPDATE SKIP LOCKED';
COMMENT ON TABLE nex.delivery_job_attempts IS 'Every worker attempt · success/transient_failure/permanent_failure/abandoned';
COMMENT ON TABLE nex.delivery_workers      IS 'One row per live worker · last_seen refreshed on every tick';
COMMENT ON TABLE nex.campaign_recipients   IS 'Immutable per-campaign recipient snapshot · written at expansion · never mutated after send';
