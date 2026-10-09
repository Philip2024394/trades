-- db/migrations/nex_email_intelligence.sql
--
-- NEX Email Intelligence · verification + per-domain intelligence
-- Founder-authorised 2026-09-22.
--
-- ADDITIVE ONLY. Zero modification to existing tables.
--
-- Layers captured:
--   1) email_verification    · per-address SMTP verification result (one row per address)
--   2) domain_intelligence   · per-domain rolling aggregate (one row per domain)
--
-- Both start empty. verification writes only from the SMTP verifier module.
-- domain_intelligence is maintained incrementally on every verification.

CREATE TABLE IF NOT EXISTS nex.email_verification (
  email_address           TEXT PRIMARY KEY,          -- lowercase
  domain                  TEXT NOT NULL,
  deliverable             TEXT NOT NULL
                            CHECK (deliverable IN ('deliverable','undeliverable','catch_all','risky','unknown')),
  mx_host                 TEXT,
  mx_preference           INT,
  smtp_greeting           TEXT,
  rcpt_code               INT,
  rcpt_response           TEXT,
  catch_all_probe_local   TEXT,
  catch_all_probe_code    INT,
  catch_all_probe_response TEXT,
  connect_ms              INT,
  total_ms                INT,
  verified_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  verifier_actor          TEXT,                       -- founder:localhost / founder:hq-token / cron
  error_reason            TEXT,
  attempt_count           INT NOT NULL DEFAULT 1,
  metadata                JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS ix_email_verification_domain
  ON nex.email_verification (domain);
CREATE INDEX IF NOT EXISTS ix_email_verification_deliverable
  ON nex.email_verification (deliverable);
CREATE INDEX IF NOT EXISTS ix_email_verification_verified_at
  ON nex.email_verification (verified_at DESC);

CREATE TABLE IF NOT EXISTS nex.domain_intelligence (
  domain                  TEXT PRIMARY KEY,           -- e.g. 'geruestbau-heiling.at'
  mx_host                 TEXT,
  is_catch_all            BOOLEAN,                    -- TRUE if any verified address returned catch_all
  addresses_seen          INT NOT NULL DEFAULT 0,
  addresses_verified      INT NOT NULL DEFAULT 0,
  addresses_deliverable   INT NOT NULL DEFAULT 0,
  addresses_undeliverable INT NOT NULL DEFAULT 0,
  addresses_risky         INT NOT NULL DEFAULT 0,
  addresses_unknown       INT NOT NULL DEFAULT 0,
  bounces_recorded        INT NOT NULL DEFAULT 0,
  complaints_recorded     INT NOT NULL DEFAULT 0,
  known_patterns          TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],   -- e.g. {'info','office','sales'}
  reputation_score        NUMERIC(4,3),               -- 0.000 - 1.000 · null = insufficient data
  first_seen_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_verified_at        TIMESTAMPTZ,
  last_updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata                JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS ix_domain_intelligence_deliverable_rate
  ON nex.domain_intelligence ((CASE WHEN addresses_verified > 0
                                     THEN addresses_deliverable::float / addresses_verified
                                     ELSE NULL END) DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS ix_domain_intelligence_is_catch_all
  ON nex.domain_intelligence (is_catch_all);

CREATE INDEX IF NOT EXISTS ix_domain_intelligence_last_verified
  ON nex.domain_intelligence (last_verified_at DESC NULLS LAST);

ALTER TABLE nex.email_verification    DISABLE ROW LEVEL SECURITY;
ALTER TABLE nex.domain_intelligence   DISABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nex_app_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON nex.email_verification    TO nex_app_runtime;
    GRANT SELECT, INSERT, UPDATE, DELETE ON nex.domain_intelligence   TO nex_app_runtime;
  END IF;
END$$;
