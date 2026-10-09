-- NEX World Email Intelligence · Part 12 · Deliverability Intelligence
-- Founder-authorised programme · Session-5 · 2026-09-21.
--
-- Two additive tables. NEVER hard-codes provider limits · never fabricates
-- auth state · every field carries provenance.
--
-- DOCTRINE PRESERVED:
--   * Provider limits from marketing_sender_identity.capacity_source · never assumed
--   * DKIM/SPF/DMARC state has an authoritative check_source (DNS lookup adapter · Founder-runtime)
--   * Reputation aggregates from real send_log · never synthetic
--   * Suppression remains authoritative (§Clause 8 preserved)
--   * No lane leakage · deliverability applies to AUTO+MEMBER+FOUNDER senders equally

BEGIN;

-- ─── 1 · Per-domain DKIM/SPF/DMARC state ─────────────────────────────
CREATE TABLE IF NOT EXISTS nex.marketing_sender_domain_auth (
  sending_domain     TEXT PRIMARY KEY,                     -- normalised lowercase apex domain
  spf_status         TEXT NOT NULL DEFAULT 'unknown'
                     CHECK (spf_status IN ('unknown','missing','pass','soft_fail','hard_fail','permerror')),
  spf_record         TEXT,                                   -- raw record string when observed
  dkim_status        TEXT NOT NULL DEFAULT 'unknown'
                     CHECK (dkim_status IN ('unknown','missing','pass','fail','no_signature')),
  dkim_selector      TEXT,                                    -- e.g. 's1' · 'google' · 'k1'
  dmarc_status       TEXT NOT NULL DEFAULT 'unknown'
                     CHECK (dmarc_status IN ('unknown','missing','pass','fail','none_policy','quarantine_policy','reject_policy')),
  dmarc_policy       TEXT,                                    -- 'none' · 'quarantine' · 'reject'
  dmarc_pct          INTEGER,
  aligned            BOOLEAN NOT NULL DEFAULT FALSE,          -- all three pass + aligned

  -- Authoritative source of the check · never inferred
  check_source       TEXT,                                    -- 'dns:google-public-dns-8.8.8.8' · 'dns:cloudflare-1.1.1.1' · 'manual:founder' · 'provider:resend-sender-auth-api'
  check_method       TEXT,                                    -- 'txt-lookup' · 'provider-api' · 'manual-verification'
  last_verified_at   TIMESTAMPTZ,
  last_check_error   TEXT,

  -- Provenance
  first_observed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS ix_domain_auth_status
  ON nex.marketing_sender_domain_auth (aligned, dmarc_status);

-- ─── 2 · Per-sender rolling reputation metrics ───────────────────────
-- Aggregates from existing marketing_send_log + marketing_bounce_log at query
-- time · this table caches the rolling windows for fast Founder-UI reads.
-- Recomputed by the deliverability calculator · never accepts synthetic input.
CREATE TABLE IF NOT EXISTS nex.marketing_sender_reputation (
  sender_id                UUID PRIMARY KEY REFERENCES nex.marketing_sender_identity(sender_id) ON DELETE CASCADE,

  -- Rolling counts (last 24h and last 7d)
  sends_24h                INTEGER NOT NULL DEFAULT 0,
  sends_7d                 INTEGER NOT NULL DEFAULT 0,
  bounces_24h              INTEGER NOT NULL DEFAULT 0,
  bounces_7d               INTEGER NOT NULL DEFAULT 0,
  complaints_24h           INTEGER NOT NULL DEFAULT 0,
  complaints_7d            INTEGER NOT NULL DEFAULT 0,
  unsubs_24h               INTEGER NOT NULL DEFAULT 0,
  unsubs_7d                INTEGER NOT NULL DEFAULT 0,

  -- Rates (deterministic · derived · never assumed)
  bounce_rate_24h          NUMERIC(5,4),
  bounce_rate_7d           NUMERIC(5,4),
  complaint_rate_24h       NUMERIC(5,4),
  complaint_rate_7d        NUMERIC(5,4),

  -- Delivery latency (accepted → delivery event) in milliseconds
  delivery_latency_p50_ms  INTEGER,
  delivery_latency_p95_ms  INTEGER,

  -- Reputation floor · declarative check applied when planning a send
  reputation_state         TEXT NOT NULL DEFAULT 'unknown'
                           CHECK (reputation_state IN (
                             'unknown','healthy','watch','warning','limited','frozen'
                           )),
  reputation_reason        TEXT,

  computed_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  window_end_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_reputation_state
  ON nex.marketing_sender_reputation (reputation_state);

COMMIT;
