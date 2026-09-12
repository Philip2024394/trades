-- 153_nex_turn_latency_event.sql
--
-- NEX PER-TURN LATENCY + PROMOTION-PATH TELEMETRY · Phase OBS-2 · Migration 153.
-- Founder Path A · 2026-09-09.
--
-- Purpose:
--   One append-only row per chat request. Captures:
--     · end-to-end wall time
--     · per-stage timings (adapter · composer · rescue · research · gate)
--     · which promotion path won (adapter · composer · rescue · research · none)
--     · whether the LLM was invoked at all (composition-first discipline monitor)
--     · domain classified
--   Observatory Brain reads this to report:
--     · adapter_promoted_ratio · composer_accepted_ratio · rescue_fired_ratio
--     · research_fired_ratio · llm_invoked_ratio
--     · P50 / P95 per stage + end-to-end
--   Composition-Pilot target: llm_invoked_ratio < 0.05 · Observatory alerts if >.

CREATE SCHEMA IF NOT EXISTS nex;

CREATE TABLE IF NOT EXISTS nex.turn_latency_event (
  event_id             uuid        PRIMARY KEY,
  emitted_at           timestamptz NOT NULL DEFAULT now(),
  conversation_id      text        NULL,
  domain               text        NULL,
  promotion_path       text        NOT NULL,             -- adapter | composer | rescue | research | none
  llm_invoked          boolean     NOT NULL DEFAULT false,
  research_activated   boolean     NOT NULL DEFAULT false,
  total_ms             integer     NOT NULL,
  adapter_ms           integer     NULL,
  composer_ms          integer     NULL,
  rescue_ms            integer     NULL,
  research_ms          integer     NULL,
  vision_ms            integer     NULL,
  file_ms              integer     NULL,
  memory_ms            integer     NULL,
  gate_alignment_mean  double precision NULL,             -- average alignment score of kept claims this turn
  CONSTRAINT turn_latency_event_promotion_path_bounds CHECK (promotion_path IN
    ('adapter','composer','rescue','research','none'))
);

CREATE INDEX IF NOT EXISTS idx_nex_turn_latency_recent
  ON nex.turn_latency_event (emitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_nex_turn_latency_domain
  ON nex.turn_latency_event (domain, emitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_nex_turn_latency_path
  ON nex.turn_latency_event (promotion_path, emitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_nex_turn_latency_llm
  ON nex.turn_latency_event (llm_invoked, emitted_at DESC);

COMMENT ON TABLE nex.turn_latency_event IS
  'Founder Path A · Phase OBS-2 · per-turn latency + promotion-path telemetry. Feeds Observatory Brain composition-first discipline monitor.';
