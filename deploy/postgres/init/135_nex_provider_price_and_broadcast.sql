-- 135_nex_provider_price_and_broadcast.sql · Philip 2026-08-29
--
-- Two v3 locks land in schema here:
--
--   Lock 27 · PRICE IS FIRST-CLASS
--     · nex.provider_profile.price_per_service_idr
--     · nex.service_request.price_agreed_idr (snapshotted on accept)
--
--   Lock 28 · REQUEST BROADCAST · FIRST-TO-ACCEPT
--     · nex.service_request.eligible_provider_ids uuid[]
--     · nex.service_request.broadcast_at timestamptz
--     · nex.service_request.first_accept_window_seconds int default 15
--     · nex.service_request.broadcast_expires_at generated
--     · nex.service_request_offer table for per-provider audit trail
--     · unique constraint · only one accepted provider can win
--
-- Doctrine anchor: project_nex_mobility_doctrine_2026_08_29.md (v3 locks 27-32)

-- ── Provider price · lock 27 ─────────────────────────────────────────
ALTER TABLE nex.provider_profile
  ADD COLUMN IF NOT EXISTS price_per_service_idr integer
    CHECK (price_per_service_idr IS NULL OR price_per_service_idr > 0);

COMMENT ON COLUMN nex.provider_profile.price_per_service_idr IS
  'Provider-set base price in IDR · displayed to user BEFORE request per doctrine lock 27 · NEX never premium-prices by category · Philip 2026-08-29';

-- ── Service request · broadcast + race · locks 28/29/31 ──────────────
ALTER TABLE nex.service_request
  ADD COLUMN IF NOT EXISTS eligible_provider_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS broadcast_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_accept_window_seconds integer NOT NULL DEFAULT 15
    CHECK (first_accept_window_seconds BETWEEN 5 AND 60),
  -- Plain column (not generated) · callers set it at broadcast time to
  -- broadcast_at + first_accept_window_seconds. Postgres 17 does not allow
  -- STABLE functions like make_interval in generated columns · trigger
  -- approach was heavier than the value adds.
  ADD COLUMN IF NOT EXISTS broadcast_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS price_agreed_idr integer
    CHECK (price_agreed_idr IS NULL OR price_agreed_idr > 0);

COMMENT ON COLUMN nex.service_request.eligible_provider_ids IS
  'The set of provider_ids the request was broadcast to · lock 28 · first to accept wins · others notified withdrawn';
COMMENT ON COLUMN nex.service_request.first_accept_window_seconds IS
  'Internal mechanics · NEVER surfaced as a countdown to user · v1 = 15s per Grab Indonesia reference';
COMMENT ON COLUMN nex.service_request.broadcast_expires_at IS
  'Computed cutoff · if no accept by this timestamp, transition to TIMED_OUT and surface calm retry';
COMMENT ON COLUMN nex.service_request.price_agreed_idr IS
  'Snapshot of the accepted provider price at CONNECT time · lock 31 · future provider price changes never corrupt this record';

CREATE INDEX IF NOT EXISTS idx_service_request_broadcast_open ON nex.service_request (broadcast_expires_at)
  WHERE state = 'REQUEST_BROADCAST';

-- Rename the REQUESTED state to REQUEST_BROADCAST · lock 29
-- CHECK constraint recreated safely.
ALTER TABLE nex.service_request
  DROP CONSTRAINT IF EXISTS service_request_state_check;
ALTER TABLE nex.service_request
  ADD CONSTRAINT service_request_state_check
    CHECK (state IN (
      'DESTINATION',
      'NETWORK_CHECK',
      'PROVIDERS',
      'REQUEST_BROADCAST',
      'CONNECTED',
      'APPROACHING',
      'NEARBY',
      'SERVICE',
      'COMPLETED',
      'CANCELLED_BY_USER',
      'DECLINED_BY_PROVIDER',
      'TIMED_OUT',
      'PROVIDER_LOST_SIGNAL'
    ));
-- Migrate any existing REQUESTED rows (there shouldn't be any yet)
UPDATE nex.service_request SET state = 'REQUEST_BROADCAST' WHERE state = 'REQUESTED';

-- ── Per-provider offer audit · lock 28 ───────────────────────────────
CREATE TABLE IF NOT EXISTS nex.service_request_offer (
  offer_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id          uuid NOT NULL REFERENCES nex.service_request(request_id) ON DELETE CASCADE,
  provider_id         uuid NOT NULL REFERENCES nex.provider_profile(provider_id),

  -- The offered price at the moment of broadcast · usually equals
  -- provider_profile.price_per_service_idr but snapshotted so a mid-broadcast
  -- price edit doesn't affect this specific offer.
  offered_price_idr   integer NOT NULL CHECK (offered_price_idr > 0),

  sent_at             timestamptz NOT NULL DEFAULT now(),
  seen_at             timestamptz,
  responded_at        timestamptz,
  response            text CHECK (response IN ('accepted','declined','withdrawn','expired')),

  -- Ordering guard · only ONE provider can accept per request
  UNIQUE (request_id, provider_id)
);
CREATE INDEX IF NOT EXISTS idx_service_offer_request  ON nex.service_request_offer (request_id);
CREATE INDEX IF NOT EXISTS idx_service_offer_provider ON nex.service_request_offer (provider_id, sent_at DESC);

-- Partial unique index · at most one row per request can be 'accepted'.
-- Server-side race resolution: whichever INSERT/UPDATE reaches this
-- constraint first wins · others get 23505 and must fall back to 'withdrawn'.
CREATE UNIQUE INDEX IF NOT EXISTS uq_service_offer_one_accepted
  ON nex.service_request_offer (request_id)
  WHERE response = 'accepted';

COMMENT ON TABLE nex.service_request_offer IS
  'One row per (request, eligible_provider) pair · records the race · unique-accepted index enforces first-to-accept-wins at DB level · Philip 2026-08-29';
