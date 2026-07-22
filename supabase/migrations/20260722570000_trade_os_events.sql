-- Trade OS · Event Store + Dead Letter Queue
-- Backs the in-process EventBus (src/lib/design/trade-os/event-bus.ts).
--
-- Per V1 Part 4 spec:
--   • Append-only: never UPDATE, never DELETE
--   • Every event immutable — replay from history is a first-class op
--   • Ordering per (organisation_id, brand_version) — never global
--   • Correlation IDs threaded through every event
--
-- Interface stays identical when we swap to NATS JetStream (Phase 3).

CREATE TABLE IF NOT EXISTS public.hammerex_events (
  id              UUID PRIMARY KEY,
  type            TEXT NOT NULL,             -- e.g. "Brand.ColourChanged.v1"
  version         INTEGER NOT NULL DEFAULT 1,
  merchant_id     TEXT,
  organisation_id TEXT,
  brand_version   TEXT,
  correlation_id  UUID NOT NULL,
  causation_id    UUID,
  producer        TEXT NOT NULL,
  payload_json    JSONB NOT NULL,
  envelope_json   JSONB NOT NULL,            -- full envelope for replay
  processed       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ordering support — index the (merchant, brand_version) key path so
-- per-brand replay stays fast.
CREATE INDEX IF NOT EXISTS idx_events_merchant_brand
  ON public.hammerex_events (merchant_id, brand_version, created_at);

-- Correlation-based query — trace all events in a single request.
CREATE INDEX IF NOT EXISTS idx_events_correlation
  ON public.hammerex_events (correlation_id, created_at);

-- Type prefix search for replay (e.g. "Brand.%").
CREATE INDEX IF NOT EXISTS idx_events_type
  ON public.hammerex_events (type, created_at);

-- Never allow UPDATE or DELETE on events. Enforce append-only at the
-- database level via a trigger.
CREATE OR REPLACE FUNCTION public.fn_events_append_only()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'hammerex_events is append-only. UPDATE not allowed.';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'hammerex_events is append-only. DELETE not allowed.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_events_append_only ON public.hammerex_events;
CREATE TRIGGER trg_events_append_only
  BEFORE UPDATE OR DELETE ON public.hammerex_events
  FOR EACH ROW EXECUTE FUNCTION public.fn_events_append_only();

ALTER TABLE public.hammerex_events ENABLE ROW LEVEL SECURITY;

-- ─── Dead Letter Queue ──────────────────────────────────────────
-- When a subscriber fails all retries, the failure lands here for
-- admin triage at /admin/events/dead-letter.

CREATE TABLE IF NOT EXISTS public.hammerex_events_dead_letter (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID NOT NULL,
  subscriber_id     UUID NOT NULL,
  event_type        TEXT NOT NULL,
  handler           TEXT NOT NULL,
  error_message     TEXT NOT NULL,
  envelope_json     JSONB NOT NULL,           -- so admin can retry
  dead_lettered_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at       TIMESTAMPTZ,
  resolved_by       TEXT
);

CREATE INDEX IF NOT EXISTS idx_dlq_unresolved
  ON public.hammerex_events_dead_letter (dead_lettered_at DESC)
  WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_dlq_event
  ON public.hammerex_events_dead_letter (event_id);

ALTER TABLE public.hammerex_events_dead_letter ENABLE ROW LEVEL SECURITY;
