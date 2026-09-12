-- 146_nex_conversation_brain.sql
--
-- NEX LIVE CHAT · CONVERSATION BRAIN · Phase 3.1 · storage layer.
-- Founder BEGIN Phase 3.1 · Master AI Engineer · 2026-09-09.
--
-- Doctrine anchor:
--   Founder Phase 3 architecture mandate 2026-09-09
--   (permanent-conversation-brain · 10-mission north star · §1 conversation brain).
--
-- Purpose (STRICT this migration):
--   1. nex.conversation_state · one row per conversation_id · durable state
--      the turn interpreter reads + writes on every turn.
--   2. nex.result_set         · one row per surfaced-list turn · enables
--      "which one has a pool?" to filter the SAME list rendered previously.
--
-- Design:
--   · Idempotent · CREATE TABLE IF NOT EXISTS · matches 143..145 pattern.
--   · Zero rows inserted here.
--   · Does NOT alter accommodation_business / question_variant / knowledge_gap.
--   · Does NOT alter kf_worker_heartbeat / category_scorecard / master_rulebook.
--   · dialogue_turns bounded via trigger (last 20) — future work; migration
--     ships the column shape only.
--
-- Reversible (not scripted · Philip's design rule 7):
--   BEGIN;
--     DROP TABLE IF EXISTS nex.result_set CASCADE;
--     DROP TABLE IF EXISTS nex.conversation_state CASCADE;
--   COMMIT;

CREATE SCHEMA IF NOT EXISTS nex;

-- ═══════════════════════════════════════════════════════════════════
-- conversation_state · durable slots per conversation
-- ═══════════════════════════════════════════════════════════════════
-- One row per conversation_id. Rewritten on every turn by the store.
-- Ephemeral in feel, but persisted so a chat that crosses a server
-- restart doesn't lose "we were just looking at Hotel X".
CREATE TABLE IF NOT EXISTS nex.conversation_state (
  conversation_id             text        PRIMARY KEY,
  active_domain               text        NULL,        -- accommodation / food / ...
  active_goal                 text        NULL,        -- NONE · search · refine · compare · decide
  active_entity_ref           text        NULL,        -- currently focused entity
  candidate_entity_refs       text[]      NOT NULL DEFAULT ARRAY[]::text[],
  current_result_set_id       uuid        NULL,
  resolved_facts              jsonb       NOT NULL DEFAULT '{}'::jsonb,   -- e.g. {"wifi": {"entity": "acc_x", "verified": true}}
  user_constraints            jsonb       NOT NULL DEFAULT '{}'::jsonb,   -- e.g. {"city": "yogyakarta", "price_band": "cheap"}
  previous_intents            text[]      NOT NULL DEFAULT ARRAY[]::text[],
  dialogue_turns              jsonb       NOT NULL DEFAULT '[]'::jsonb,   -- bounded (last 20) — enforced by the store
  first_seen_at               timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nex_conversation_state_updated_at
  ON nex.conversation_state (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_nex_conversation_state_domain
  ON nex.conversation_state (active_domain);

COMMENT ON TABLE nex.conversation_state IS
  'Founder BEGIN Phase 3.1 · one row per conversation. Turn interpreter reads before compose, writes after. Never contains raw customer text beyond bounded dialogue_turns.';

-- ═══════════════════════════════════════════════════════════════════
-- result_set · surfaced-list memory · enables list-filtering follow-ups
-- ═══════════════════════════════════════════════════════════════════
-- Every time the composer surfaces a list of entities, we register the
-- set here. current_result_set_id on conversation_state points at the
-- most recent one. "which has a pool?" fetches this row and filters
-- against its entities — no re-search.
CREATE TABLE IF NOT EXISTS nex.result_set (
  result_set_id       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id     text        NOT NULL,
  domain              text        NOT NULL,
  intent_slug         text        NOT NULL,   -- the intent that produced the list (list_in_city, etc.)
  city                text        NULL,
  category            text        NULL,       -- hotel · villa · etc.
  entity_refs         text[]      NOT NULL,   -- canonical entities in the surfaced order
  render_summary      text        NULL,       -- one-line summary of what was shown
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nex_result_set_conversation
  ON nex.result_set (conversation_id, created_at DESC);

COMMENT ON TABLE nex.result_set IS
  'Founder BEGIN Phase 3.1 · surfaced-list memory. "which has a pool?" filters entity_refs of the most recent set for the conversation.';
