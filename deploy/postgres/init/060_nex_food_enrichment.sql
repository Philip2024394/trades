-- 060_nex_food_enrichment.sql
--
-- NEX Food · Phase 8.0 · Business Enrichment Pipeline (Philip 2026-08-21 ·
-- CONSTITUTIONAL · must precede Phase 8.4 WhatsApp campaigns).
--
-- Ships:
--   1  nex.food_enrichment_evidence · every piece of discovered evidence · one
--      row per (business_ref, field, source, discovered_at) · append-only
--   2  nex.food_enrichment_job · job queue for batch-processable agent runs ·
--      resumable · retryable · failure-isolated
--   3  nex.food_business_completeness · view computing NEX_PROFILE_COMPLETENESS
--      per business (configurable weights via nex.food_hq_rule)
--   4  Enums: nex_food_enrichment_agent · nex_food_enrichment_status ·
--      nex_food_source_type
--   5  Seed HQ rules for completeness weights (tuneable by admin)
--
-- Constitutional invariants preserved:
--   - Evidence is APPEND-ONLY · never mutated (audit trail permanent)
--   - Evidence does NOT directly update nex.food_business · a separate
--     application step reads high-confidence evidence and applies it
--     RESPECTING the trust hierarchy (source_import < nex_curated <
--     admin_verified < owner_verified · owner_verified never overwritten)
--   - Every evidence row carries: source · source_type · source_url ·
--     confidence · discovered_at · provenance_layer · agent_name
--
-- Reversible:
--   BEGIN;
--   DROP VIEW  IF EXISTS nex.food_business_completeness;
--   DROP TABLE IF EXISTS nex.food_enrichment_job CASCADE;
--   DROP TABLE IF EXISTS nex.food_enrichment_evidence CASCADE;
--   DROP TYPE  IF EXISTS nex_food_enrichment_status;
--   DROP TYPE  IF EXISTS nex_food_enrichment_agent;
--   DROP TYPE  IF EXISTS nex_food_source_type;
--   DELETE FROM nex.food_hq_rule WHERE rule_key LIKE 'completeness_weight_%';
--   COMMIT;

CREATE SCHEMA IF NOT EXISTS nex;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Enums ───────────────────────────────────────────────────────────────────

DO $body$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'nex_food_enrichment_agent') THEN
    CREATE TYPE nex_food_enrichment_agent AS ENUM (
      'discovery',     -- finds candidate official sources (website · social profiles)
      'identity',      -- confirms discovered source matches the business
      'contact',       -- WhatsApp · phone · website · social
      'hours',         -- opening hours
      'food',          -- cuisine + food categories → NEX taxonomy
      'menu',          -- menu URL · ordering · booking
      'media',         -- legally usable public imagery
      'verification',  -- compares conflicting evidence · admin-review flagger
      'osm_reextract'  -- special agent · pulls fields we already have in the
                       -- OSM snapshot but didn't originally import to typed columns
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'nex_food_enrichment_status') THEN
    CREATE TYPE nex_food_enrichment_status AS ENUM (
      'pending',
      'running',
      'done',
      'failed',
      'skipped',       -- business excluded (e.g. already owner_verified for this field)
      'needs_review'   -- conflict detected · admin must decide
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'nex_food_source_type') THEN
    CREATE TYPE nex_food_source_type AS ENUM (
      'owner_verified',       -- highest trust · owner confirmed
      'admin_verified',       -- NEX admin confirmed
      'official_website',     -- business's own domain
      'official_social',      -- business's own IG / FB / etc.
      'public_directory',     -- reputable API used with permission
      'openstreetmap',        -- OSM Overpass · ODbL
      'other'                 -- last resort · flag for review
    );
  END IF;
END $body$;

-- ── Evidence log (append-only) ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nex.food_enrichment_evidence (
  evidence_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_ref      text NOT NULL,                  -- public_listing_ref
  field_name        text NOT NULL,                  -- 'phone' | 'whatsapp_number' | 'website' | 'opening_hours' | 'cuisine' | ...
  value             text,                           -- the value discovered (JSON serialised for complex fields)
  value_normalised  text,                           -- normalised form for comparison / de-dupe
  source            text NOT NULL,                  -- 'openstreetmap_overpass_v1' | 'website:https://...' | ...
  source_type       nex_food_source_type NOT NULL,
  source_url        text,                           -- when applicable
  confidence        numeric(3,2) NOT NULL           -- 0.00 .. 1.00
    CHECK (confidence >= 0 AND confidence <= 1),
  agent_name        nex_food_enrichment_agent NOT NULL,
  discovered_at     timestamptz NOT NULL DEFAULT now(),
  provenance_layer  nex_food_field_trust NOT NULL DEFAULT 'source_import',
  raw_snippet       text,                           -- optional · exact text/snippet the evidence came from
  raw_payload       jsonb                           -- optional · full source object for later re-analysis
);

CREATE INDEX IF NOT EXISTS idx_food_evidence_business_field
  ON nex.food_enrichment_evidence (business_ref, field_name, discovered_at DESC);

CREATE INDEX IF NOT EXISTS idx_food_evidence_agent
  ON nex.food_enrichment_evidence (agent_name, discovered_at DESC);

CREATE INDEX IF NOT EXISTS idx_food_evidence_source_type
  ON nex.food_enrichment_evidence (source_type, confidence DESC);

COMMENT ON TABLE nex.food_enrichment_evidence IS
  'Append-only evidence log. Every enrichment agent output writes exactly one row per (business_ref, field, source, discovered_at). NEVER updates nex.food_business directly · a separate application step applies high-confidence evidence RESPECTING the trust hierarchy. owner_verified rows on nex.food_business_field_provenance are NEVER overwritten.';

-- ── Job queue (batch-processable · resumable · failure-isolated) ───────────

CREATE TABLE IF NOT EXISTS nex.food_enrichment_job (
  job_id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_ref     text NOT NULL,
  agent            nex_food_enrichment_agent NOT NULL,
  status           nex_food_enrichment_status NOT NULL DEFAULT 'pending',
  attempts         integer NOT NULL DEFAULT 0,
  max_attempts     integer NOT NULL DEFAULT 3,
  next_attempt_at  timestamptz NOT NULL DEFAULT now(),
  last_error       text,
  started_at       timestamptz,
  completed_at     timestamptz,
  input_snapshot   jsonb,                            -- what the job saw at start
  output_summary   jsonb,                            -- brief · e.g. { evidence_rows_written: 3 }
  created_at       timestamptz NOT NULL DEFAULT now(),
  created_by       text                              -- 'admin:philip' | 'cron:daily_enrichment'
);

CREATE INDEX IF NOT EXISTS idx_food_job_status_next
  ON nex.food_enrichment_job (status, next_attempt_at)
  WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_food_job_business
  ON nex.food_enrichment_job (business_ref, agent, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_food_job_active_per_business_agent
  ON nex.food_enrichment_job (business_ref, agent)
  WHERE status IN ('pending', 'running');

COMMENT ON TABLE nex.food_enrichment_job IS
  'Job queue for batch-processable enrichment agent runs. One active (pending/running) job per (business, agent) at a time · avoids duplicate work. Failed jobs eligible for retry up to max_attempts. Resumable and failure-isolated · one bad job never stops the batch.';

-- ── Completeness view (NEX_PROFILE_COMPLETENESS · configurable weights) ────

CREATE OR REPLACE VIEW nex.food_business_completeness AS
WITH weights AS (
  SELECT
    COALESCE((SELECT rule_value_int FROM nex.food_hq_rule WHERE rule_key = 'completeness_weight_identity'), 20) AS w_identity,
    COALESCE((SELECT rule_value_int FROM nex.food_hq_rule WHERE rule_key = 'completeness_weight_location'), 15) AS w_location,
    COALESCE((SELECT rule_value_int FROM nex.food_hq_rule WHERE rule_key = 'completeness_weight_contact'),  20) AS w_contact,
    COALESCE((SELECT rule_value_int FROM nex.food_hq_rule WHERE rule_key = 'completeness_weight_hours'),    10) AS w_hours,
    COALESCE((SELECT rule_value_int FROM nex.food_hq_rule WHERE rule_key = 'completeness_weight_food'),     15) AS w_food,
    COALESCE((SELECT rule_value_int FROM nex.food_hq_rule WHERE rule_key = 'completeness_weight_menu'),     10) AS w_menu,
    COALESCE((SELECT rule_value_int FROM nex.food_hq_rule WHERE rule_key = 'completeness_weight_media'),    10) AS w_media
),
scores AS (
  SELECT
    b.public_listing_ref AS business_ref,
    b.business_name,
    b.category,
    b.city,
    b.district,
    b.claim_status,
    b.owner_status,

    -- Identity · name + category (both mandatory · always 100% or 0%)
    CASE WHEN b.business_name IS NOT NULL AND b.business_name <> '' AND b.category IS NOT NULL
         THEN 1.0 ELSE 0.0 END AS identity_score,

    -- Location · address (0.5) + coords (0.5)
    ( (CASE WHEN b.address IS NOT NULL AND b.address <> '' THEN 0.5 ELSE 0.0 END)
    + (CASE WHEN b.coordinates_lat IS NOT NULL AND b.coordinates_lng IS NOT NULL THEN 0.5 ELSE 0.0 END)
    ) AS location_score,

    -- Contact · whatsapp (0.5 · most valuable) + phone (0.25) + website (0.25)
    ( (CASE WHEN b.whatsapp_number IS NOT NULL AND b.whatsapp_number <> '' THEN 0.5 ELSE 0.0 END)
    + (CASE WHEN b.phone IS NOT NULL AND b.phone <> '' THEN 0.25 ELSE 0.0 END)
    + (CASE WHEN b.website IS NOT NULL AND b.website <> '' THEN 0.25 ELSE 0.0 END)
    ) AS contact_score,

    -- Hours · presence of opening_information (binary for V1 · richer parse later)
    CASE WHEN b.opening_information IS NOT NULL THEN 1.0 ELSE 0.0 END AS hours_score,

    -- Food · cuisine (0.5) + dish/food evidence from enrichment table (0.5)
    ( (CASE WHEN EXISTS(SELECT 1 FROM nex.food_enrichment_evidence ev
                        WHERE ev.business_ref = b.public_listing_ref
                          AND ev.field_name = 'cuisine') THEN 0.5 ELSE 0.0 END)
    + (CASE WHEN EXISTS(SELECT 1 FROM nex.food_enrichment_evidence ev
                        WHERE ev.business_ref = b.public_listing_ref
                          AND ev.field_name IN ('dish_tokens','food_category')) THEN 0.5 ELSE 0.0 END)
    ) AS food_score,

    -- Menu · any menu/ordering/booking URL evidence
    CASE WHEN EXISTS(SELECT 1 FROM nex.food_enrichment_evidence ev
                     WHERE ev.business_ref = b.public_listing_ref
                       AND ev.field_name IN ('menu_url','ordering_url','booking_url'))
         THEN 1.0 ELSE 0.0 END AS menu_score,

    -- Media · approved hero image
    CASE WHEN b.hero_image_url IS NOT NULL AND b.hero_image_url <> '' AND b.hero_image_approved
         THEN 1.0 ELSE 0.0 END AS media_score
  FROM nex.food_business b
)
SELECT
  s.*,
  w.w_identity + w.w_location + w.w_contact + w.w_hours + w.w_food + w.w_menu + w.w_media AS max_score,
  ROUND(
    ( s.identity_score * w.w_identity
    + s.location_score * w.w_location
    + s.contact_score  * w.w_contact
    + s.hours_score    * w.w_hours
    + s.food_score     * w.w_food
    + s.menu_score     * w.w_menu
    + s.media_score    * w.w_media
    )::numeric, 2
  ) AS completeness_score,
  ROUND(
    ( ( s.identity_score * w.w_identity
      + s.location_score * w.w_location
      + s.contact_score  * w.w_contact
      + s.hours_score    * w.w_hours
      + s.food_score     * w.w_food
      + s.menu_score     * w.w_menu
      + s.media_score    * w.w_media
      ) / NULLIF(w.w_identity + w.w_location + w.w_contact + w.w_hours + w.w_food + w.w_menu + w.w_media, 0)
      * 100
    )::numeric, 1
  ) AS completeness_pct
FROM scores s
CROSS JOIN weights w;

COMMENT ON VIEW nex.food_business_completeness IS
  'NEX_PROFILE_COMPLETENESS score per business · configurable weights via nex.food_hq_rule. Completeness ≠ trust · a field can be complete but low-trust.';

-- ── Seed weights (tuneable · Philip 2026-08-21 defaults) ───────────────────

INSERT INTO nex.food_hq_rule (rule_key, rule_value_int, description, updated_by) VALUES
  ('completeness_weight_identity', 20, 'Weight of identity fields (name + category) in NEX_PROFILE_COMPLETENESS', 'seed'),
  ('completeness_weight_location', 15, 'Weight of location fields (address + coords) in NEX_PROFILE_COMPLETENESS', 'seed'),
  ('completeness_weight_contact',  20, 'Weight of contact fields (whatsapp + phone + website) in NEX_PROFILE_COMPLETENESS · commercial priority',  'seed'),
  ('completeness_weight_hours',    10, 'Weight of opening-hours field in NEX_PROFILE_COMPLETENESS',                                                'seed'),
  ('completeness_weight_food',     15, 'Weight of cuisine + food-taxonomy tokens in NEX_PROFILE_COMPLETENESS',                                     'seed'),
  ('completeness_weight_menu',     10, 'Weight of menu/ordering/booking URLs in NEX_PROFILE_COMPLETENESS',                                         'seed'),
  ('completeness_weight_media',    10, 'Weight of approved hero image in NEX_PROFILE_COMPLETENESS',                                                'seed')
ON CONFLICT (rule_key) DO NOTHING;
