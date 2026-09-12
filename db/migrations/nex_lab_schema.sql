-- db/migrations/nex_lab_schema.sql
--
-- Founder ADR-0304 · 2026-09-10 · Autonomous Research Lab schema.
-- Creates 10 lab "rooms" each with their own sub-schema, plus the
-- shared promotion_events audit table.
--
-- Golden rule: nothing in a nex_lab_*.* schema reaches nex.* without
-- a founder-signed promotion event. Enforced by role permissions +
-- HMAC signature verification at the promotion executor.
--
-- Idempotent · safe to re-run. Every CREATE uses IF NOT EXISTS.

-- ══════════════════════════════════════════════════════════════════
-- 10 Lab rooms · one Postgres schema each
-- ══════════════════════════════════════════════════════════════════

CREATE SCHEMA IF NOT EXISTS nex_lab_accommodation;
CREATE SCHEMA IF NOT EXISTS nex_lab_food;
CREATE SCHEMA IF NOT EXISTS nex_lab_transport;
CREATE SCHEMA IF NOT EXISTS nex_lab_business;
CREATE SCHEMA IF NOT EXISTS nex_lab_activities;
CREATE SCHEMA IF NOT EXISTS nex_lab_image;
CREATE SCHEMA IF NOT EXISTS nex_lab_news;
CREATE SCHEMA IF NOT EXISTS nex_lab_voice;
CREATE SCHEMA IF NOT EXISTS nex_lab_chat;
CREATE SCHEMA IF NOT EXISTS nex_lab_monetization;

-- Shared control-plane schema for promotions + growth history
CREATE SCHEMA IF NOT EXISTS nex_lab;

-- ══════════════════════════════════════════════════════════════════
-- Shared: promotion events · IMMUTABLE audit trail
-- ══════════════════════════════════════════════════════════════════
-- Every fact/UI/agent moving from lab → production writes exactly one
-- row here. HMAC signature ties the row to a specific founder session.
-- Never DELETE from this table. Rollback is via replay of rollback_sql.

CREATE TABLE IF NOT EXISTS nex_lab.promotion_events (
  promotion_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id               TEXT NOT NULL,
  room_slug              TEXT NOT NULL,                    -- e.g. 'accommodation'
  proposed_at_iso        TIMESTAMPTZ NOT NULL,
  approved_at_iso        TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by_user_id    TEXT NOT NULL,                    -- founder ID
  signature_hmac_sha256  TEXT NOT NULL,                    -- HMAC(secret, brief_id | ts | user_id)
  rows_promoted          INTEGER NOT NULL DEFAULT 0,       -- how many nex_lab.* rows landed in nex.*
  target_schema          TEXT NOT NULL,                    -- e.g. 'nex.accommodation_business'
  rollback_sql           TEXT,                             -- pre-computed reversal SQL
  ui_merge_manifest      JSONB,                            -- which UI components were merged
  status                 TEXT NOT NULL DEFAULT 'pending',  -- pending/succeeded/failed/rolled_back
  error_reason           TEXT,
  metrics_snapshot       JSONB                             -- test outcomes, demand signal, fact volume
);

CREATE INDEX IF NOT EXISTS ix_promotion_events_room
  ON nex_lab.promotion_events (room_slug, approved_at_iso DESC);
CREATE INDEX IF NOT EXISTS ix_promotion_events_status
  ON nex_lab.promotion_events (status, approved_at_iso DESC);

COMMENT ON TABLE nex_lab.promotion_events IS
  'IMMUTABLE audit trail for Lab → Main NEX promotions. Never DELETE. Rollback via rollback_sql replay.';

-- ══════════════════════════════════════════════════════════════════
-- Shared: growth history · hourly snapshots per room
-- ══════════════════════════════════════════════════════════════════
-- Populated by lab_growth_snapshotter agent every hour. Feeds the HQ
-- "hourly growth %" widget. This is the ONLY source of truth for
-- growth measurements — the client-side ring buffer in HQ page is a
-- fallback, this is the durable measured record.

CREATE TABLE IF NOT EXISTS nex_lab.growth_history (
  snapshot_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ts_iso                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  room_slug              TEXT NOT NULL,                    -- 'accommodation' | 'food' | ...
  metric_key             TEXT NOT NULL,                    -- 'total_rows' | 'verified_rows' | 'promoted_rows'
  metric_value           BIGINT NOT NULL,
  source_query_hash      TEXT                              -- SHA of the query that produced this
);

CREATE INDEX IF NOT EXISTS ix_growth_history_recent
  ON nex_lab.growth_history (room_slug, metric_key, ts_iso DESC);

COMMENT ON TABLE nex_lab.growth_history IS
  'Hourly measured snapshots per Lab room · powers HQ growth chart. Never fabricated.';

-- ══════════════════════════════════════════════════════════════════
-- Shared: room registry · declarative list of active rooms
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS nex_lab.rooms (
  room_slug              TEXT PRIMARY KEY,
  display_name           TEXT NOT NULL,
  schema_name            TEXT NOT NULL,
  primary_agent_id       TEXT NOT NULL,
  data_sources           TEXT[],                           -- ['osm', 'wikidata', 'kemenparekraf']
  target_records         BIGINT,                           -- ambition (e.g. 100000)
  created_at_iso         TIMESTAMPTZ NOT NULL DEFAULT now(),
  founder_authorized     BOOLEAN NOT NULL DEFAULT FALSE
);

-- Seed the 10 rooms (idempotent)
INSERT INTO nex_lab.rooms (room_slug, display_name, schema_name, primary_agent_id, data_sources, target_records)
VALUES
  ('accommodation', 'Accommodation Lab', 'nex_lab_accommodation', 'lab_harvest_accommodation', ARRAY['osm','kemenparekraf'], 100000),
  ('food',          'Food Lab',          'nex_lab_food',          'lab_harvest_food',          ARRAY['osm','kemenparekraf'], 250000),
  ('transport',     'Transport Lab',     'nex_lab_transport',     'lab_harvest_transport',     ARRAY['osm','bmkg','gov_transit'], 5000),
  ('business',      'Business Lab',      'nex_lab_business',      'lab_harvest_business',      ARRAY['wikidata','msme_registry'], 500000),
  ('activities',    'Activities & Rentals Lab', 'nex_lab_activities', 'lab_harvest_activities', ARRAY['osm','tourism_boards'], 50000),
  ('image',         'Image Lab',         'nex_lab_image',         'lab_image_fetcher',         ARRAY['osm_wikimedia'], 500000),
  ('news',          'News & Trends Lab', 'nex_lab_news',          'lab_news_harvester',        ARRAY['rss'], 100000),
  ('voice',         'Voice Lab',         'nex_lab_voice',         'lab_voice_benchmark',       ARRAY['local_whisper'], 10000),
  ('chat',          'Chat Lab',          'nex_lab_chat',          'lab_chat_experimenter',     ARRAY['conversation_ledger'], 100000),
  ('monetization',  'Monetization Lab',  'nex_lab_monetization',  'lab_monetization_modeller', ARRAY['stripe','pilots'], 0)
ON CONFLICT (room_slug) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════
-- Per-room minimal table: harvest ledger (canonical shape)
-- ══════════════════════════════════════════════════════════════════
-- Each room mirrors this shape. Rooms MAY add columns via later
-- migrations · they MUST NOT drop these baseline columns.

DO $$
DECLARE
  room_schema TEXT;
BEGIN
  FOREACH room_schema IN ARRAY ARRAY[
    'nex_lab_accommodation','nex_lab_food','nex_lab_transport','nex_lab_business',
    'nex_lab_activities','nex_lab_image','nex_lab_news','nex_lab_voice',
    'nex_lab_chat','nex_lab_monetization'
  ]
  LOOP
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I.harvest_raw (
        record_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        harvested_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        source          TEXT NOT NULL,
        source_ref      TEXT,
        payload         JSONB NOT NULL,
        dedupe_hash     TEXT
      )', room_schema);
    EXECUTE format('
      CREATE INDEX IF NOT EXISTS ix_harvest_dedupe_%I
        ON %I.harvest_raw (dedupe_hash)', room_schema, room_schema);
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I.verified (
        fact_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        verified_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
        subject_ref     TEXT NOT NULL,
        field_name      TEXT NOT NULL,
        field_value     JSONB NOT NULL,
        confidence      NUMERIC(4,3) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
        source_count    INTEGER NOT NULL DEFAULT 1,
        evidence_refs   TEXT[]
      )', room_schema);
    EXECUTE format('
      CREATE INDEX IF NOT EXISTS ix_verified_subject_%I
        ON %I.verified (subject_ref, field_name)', room_schema, room_schema);
  END LOOP;
END $$;

-- ══════════════════════════════════════════════════════════════════
-- Role · nex_lab_worker · GRANT limited access
-- ══════════════════════════════════════════════════════════════════
-- Lab workers connect as this role · they cannot touch nex.* unless
-- a promotion event fires (which uses a separate SECURITY DEFINER
-- function that switches role · not built in this migration).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nex_lab_worker') THEN
    CREATE ROLE nex_lab_worker NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA nex_lab TO nex_lab_worker;
GRANT USAGE ON SCHEMA nex_lab_accommodation TO nex_lab_worker;
GRANT USAGE ON SCHEMA nex_lab_food TO nex_lab_worker;
GRANT USAGE ON SCHEMA nex_lab_transport TO nex_lab_worker;
GRANT USAGE ON SCHEMA nex_lab_business TO nex_lab_worker;
GRANT USAGE ON SCHEMA nex_lab_activities TO nex_lab_worker;
GRANT USAGE ON SCHEMA nex_lab_image TO nex_lab_worker;
GRANT USAGE ON SCHEMA nex_lab_news TO nex_lab_worker;
GRANT USAGE ON SCHEMA nex_lab_voice TO nex_lab_worker;
GRANT USAGE ON SCHEMA nex_lab_chat TO nex_lab_worker;
GRANT USAGE ON SCHEMA nex_lab_monetization TO nex_lab_worker;

GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA nex_lab TO nex_lab_worker;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA nex_lab_accommodation TO nex_lab_worker;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA nex_lab_food TO nex_lab_worker;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA nex_lab_transport TO nex_lab_worker;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA nex_lab_business TO nex_lab_worker;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA nex_lab_activities TO nex_lab_worker;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA nex_lab_image TO nex_lab_worker;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA nex_lab_news TO nex_lab_worker;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA nex_lab_voice TO nex_lab_worker;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA nex_lab_chat TO nex_lab_worker;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA nex_lab_monetization TO nex_lab_worker;

-- Read-only access to nex.* signals needed by the Lab (per ADR-0304 §10 auth 1)
GRANT USAGE ON SCHEMA nex TO nex_lab_worker;
GRANT SELECT ON TABLE nex.knowledge_gap TO nex_lab_worker;
-- (Add SELECT on nex.conversation_message when the table is confirmed present.)

-- Final sanity: report what we built
SELECT
  (SELECT count(*) FROM information_schema.schemata WHERE schema_name LIKE 'nex_lab%') AS lab_schemas_created,
  (SELECT count(*) FROM nex_lab.rooms) AS rooms_registered;
