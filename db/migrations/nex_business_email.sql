-- db/migrations/nex_business_email.sql
--
-- Multi-email persistence · additive migration · 2026-09-22.
--
-- Founder-authorised Volume Upgrade Wave A · Tier A · free-only sources.
--
-- Purpose: capture EVERY unique email found on a business's site, not just
-- the highest-confidence one. Real DE / AT / CH businesses publish 3-5
-- distinct addresses on their /impressum page (Vertrieb / Buchhaltung /
-- Info / etc.); the existing 1-row-per-business schema kept only one.
--
-- ADDITIVE ONLY. Zero modification to nex.discovery_business_evidence.
-- The evidence row stays as the "business anchor"; email rows FK-back to it.

CREATE TABLE IF NOT EXISTS nex.business_email (
  business_email_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id         UUID NOT NULL REFERENCES nex.discovery_business_evidence(evidence_id) ON DELETE CASCADE,
  email_address       TEXT NOT NULL,             -- lowercased at write
  email_source_url    TEXT,                       -- exact page URL the email came from
  extraction_method   TEXT NOT NULL,              -- json_ld_contact_point / mailto_href / plain_text_regex / etc
  email_type          TEXT,                       -- business_domain / free_provider / role_address / etc
  email_evidence_tier TEXT,                       -- directly_published_by_entity / published_on_entity_website / etc
  email_provider_domain TEXT,
  role_hint           TEXT,                       -- info / sales / office / etc when found nearby
  extraction_confidence NUMERIC(4,3),             -- 0.000 - 0.999
  same_apex_as_business BOOLEAN,                  -- TRUE if email domain matches business website apex
  first_seen_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- One row per (evidence, lowercased email) · re-walking updates last_seen_at
CREATE UNIQUE INDEX IF NOT EXISTS ux_business_email_unique
  ON nex.business_email (evidence_id, LOWER(email_address));

CREATE INDEX IF NOT EXISTS ix_business_email_address
  ON nex.business_email (LOWER(email_address));

CREATE INDEX IF NOT EXISTS ix_business_email_recency
  ON nex.business_email (first_seen_at DESC);

CREATE INDEX IF NOT EXISTS ix_business_email_confidence
  ON nex.business_email (extraction_confidence DESC NULLS LAST);

ALTER TABLE nex.business_email DISABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nex_app_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON nex.business_email TO nex_app_runtime;
  END IF;
END$$;

-- Backfill: import every currently-stored email from discovery_business_evidence
-- into nex.business_email as the initial row. Safe because we only insert where
-- discovered_email is set and no matching business_email row exists.
INSERT INTO nex.business_email
  (evidence_id, email_address, email_source_url, extraction_method,
   email_type, email_evidence_tier, email_provider_domain, role_hint,
   extraction_confidence, same_apex_as_business, first_seen_at, last_seen_at, metadata)
SELECT
  e.evidence_id,
  LOWER(e.discovered_email),
  e.email_source_url,
  COALESCE(e.metadata->>'extraction_method', 'legacy_backfill') AS extraction_method,
  COALESCE(e.email_type, e.metadata->>'email_type'),
  COALESCE(e.email_evidence_tier, e.metadata->>'email_evidence_tier'),
  COALESCE(e.email_provider_domain, e.metadata->>'email_provider_domain'),
  e.metadata->>'role_hint',
  e.email_extraction_confidence,
  CASE
    WHEN e.website_url IS NULL OR e.discovered_email IS NULL THEN NULL
    ELSE (SPLIT_PART(LOWER(e.discovered_email), '@', 2)
          = REGEXP_REPLACE(REGEXP_REPLACE(LOWER(e.website_url), '^https?://(www\.)?', ''), '/.*', ''))
  END,
  e.first_seen_at,
  e.last_seen_at,
  COALESCE(e.metadata, '{}'::jsonb)
FROM nex.discovery_business_evidence e
WHERE e.discovered_email IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM nex.business_email be
     WHERE be.evidence_id = e.evidence_id
       AND LOWER(be.email_address) = LOWER(e.discovered_email)
  );
