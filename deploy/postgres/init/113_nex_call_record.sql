-- 113_nex_call_record.sql
--
-- NEX Internal Calling · Stage 2 · call history · Philip 2026-08-27.
--
-- One row per call between two NEX identities. Populated by the client on
-- call end via POST /api/nex-calling/call-record (which validates the
-- caller's Supabase session before insert). No FK to auth.users because
-- Supabase auth lives in a different DB · UUIDs stored as plain text.
--
-- Doctrine (Philip 2026-08-27):
--   · NEX transports ONLY signalling · never media
--   · Every call reports its measured path (p2p/srflx/relay) so future
--     Stage 2/3 infrastructure decisions are evidence-driven
--   · No business_id column yet · business calling is a future layer that
--     will add its own reference · not part of Stage 2 MVP
--
-- Reversible:
--   BEGIN; DROP TABLE IF EXISTS nex.call_record; COMMIT;

BEGIN;

CREATE TABLE IF NOT EXISTS nex.call_record (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- NEX identities (Supabase auth.users.id UUIDs · stored as text since the
  -- Supabase auth schema lives in a different database and cannot be FK'd).
  caller_user_id      UUID NOT NULL,
  callee_user_id      UUID NOT NULL,
  caller_display_name TEXT,
  callee_display_name TEXT,

  -- Call metadata.
  media_type          TEXT NOT NULL DEFAULT 'voice'
                        CHECK (media_type IN ('voice','video')),
  direction           TEXT NOT NULL DEFAULT 'outbound'
                        CHECK (direction IN ('outbound','inbound')),

  -- Lifecycle.
  started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  connected_at        TIMESTAMPTZ,
  ended_at            TIMESTAMPTZ,
  duration_sec        INTEGER,

  end_reason          TEXT NOT NULL DEFAULT 'ended'
                        CHECK (end_reason IN (
                          'completed','missed','declined','busy','failed','ended'
                        )),

  -- Media path evidence (Philip's core measurement).
  --   'p2p'   → direct host↔host
  --   'srflx' → STUN-discovered address · still direct
  --   'relay' → TURN was used (would be Stage 2 infra trigger · not deployed today)
  --   'unknown' → path could not be classified
  path                TEXT NOT NULL DEFAULT 'unknown'
                        CHECK (path IN ('p2p','srflx','relay','unknown')),

  -- Quality (client-collected via getStats() during the call).
  quality_median_rtt_ms      INTEGER,
  quality_median_jitter_ms   INTEGER,
  quality_packets_lost       INTEGER,
  bytes_sent                 BIGINT,
  bytes_received             BIGINT,

  -- Codec negotiated (informational).
  audio_codec         TEXT,
  video_codec         TEXT,
  video_resolution    TEXT,

  -- Client-reported call id from the signalling handshake · lets us tie
  -- multiple measurement snapshots back to the same call.
  client_call_id      TEXT
);

CREATE INDEX IF NOT EXISTS idx_call_record_caller   ON nex.call_record (caller_user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_record_callee   ON nex.call_record (callee_user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_record_path     ON nex.call_record (path);
CREATE INDEX IF NOT EXISTS idx_call_record_end      ON nex.call_record (end_reason);

COMMENT ON TABLE nex.call_record IS
  'NEX Internal Calling · one row per call between two NEX identities. Written by /api/nex-calling/call-record on call end. Path column is the core evidence for Stage 2/3 infrastructure decisions (relay share proves TURN necessity). Philip 2026-08-27.';

COMMIT;
