-- XRatedTrade OS — Sync Health Monitoring (Phase 1.5, gap 4/4).
--
-- The sync trigger from hammerex_trade_off_listings → os_business_listings
-- (shipped in part 1/5) is load-bearing during the cutover window.
-- If it ever drifts — a legacy write that doesn't propagate, a race
-- condition under load, a bug we introduce — silent divergence
-- accumulates and V2 features start showing stale data.
--
-- This migration ships:
--   • os_sync_health_check() — SECURITY DEFINER function returning
--     a structured diff between legacy and V2 tables. Called by a
--     scheduled job every 10 minutes.
--   • os_sync_health_reports — persisted report table so drift over
--     time is observable, not just point-in-time.
--
-- Rollback for the entire V2 ecosystem foundation lives in the
-- companion file _ROLLBACK_V2_ECOSYSTEM.sql (not run automatically —
-- kept as an operational lever for emergencies).

BEGIN;

-- ---------------------------------------------------------------------
-- 1. os_sync_health_reports — persisted health check output
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_sync_health_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  check_run_at timestamptz NOT NULL DEFAULT now(),

  -- Row-count parity
  hammerex_row_count integer NOT NULL,
  os_business_row_count integer NOT NULL,
  os_business_active_count integer NOT NULL,   -- deleted_at IS NULL

  -- Divergence counts
  missing_in_os_business integer NOT NULL,     -- in hammerex, not in os_business
  missing_in_hammerex integer NOT NULL,        -- in os_business, not in hammerex
                                                -- (should always be 0 in cutover
                                                --  window — non-zero means V2
                                                --  writers created rows, which is
                                                --  fine post-cutover)
  field_drift_count integer NOT NULL,          -- rows where legacy-known fields differ

  -- Drift examples (up to first 20 for triage)
  divergence_samples jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Health signal
  is_healthy boolean NOT NULL,
  severity text NOT NULL DEFAULT 'ok'
    CHECK (severity IN ('ok','warning','critical')),

  -- Execution metadata
  check_duration_ms integer NOT NULL,
  checked_by text NOT NULL DEFAULT 'scheduled_job'
);

CREATE INDEX IF NOT EXISTS os_sync_health_reports_run_idx
  ON os_sync_health_reports (check_run_at DESC);
CREATE INDEX IF NOT EXISTS os_sync_health_reports_severity_idx
  ON os_sync_health_reports (severity, check_run_at DESC)
  WHERE severity IN ('warning','critical');

-- ---------------------------------------------------------------------
-- 2. os_sync_health_check() — the diagnostic function
--
-- Callable by scheduled job or manually. Returns structured JSON with
-- the divergence state. Also persists a report row for historical
-- observation. SECURITY DEFINER so the caller doesn't need direct
-- access to the underlying tables.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION os_sync_health_check()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_start timestamptz := clock_timestamp();
  v_hammerex_count integer;
  v_os_count integer;
  v_os_active_count integer;
  v_missing_in_os integer;
  v_missing_in_hammerex integer;
  v_field_drift integer;
  v_samples jsonb;
  v_is_healthy boolean;
  v_severity text;
  v_duration_ms integer;
  v_result jsonb;
BEGIN
  -- Row counts
  SELECT count(*) INTO v_hammerex_count FROM hammerex_trade_off_listings;
  SELECT count(*) INTO v_os_count FROM os_business_listings;
  SELECT count(*) INTO v_os_active_count
    FROM os_business_listings WHERE deleted_at IS NULL;

  -- Missing in os_business (should be 0 if sync trigger is healthy)
  SELECT count(*) INTO v_missing_in_os
  FROM hammerex_trade_off_listings h
  LEFT JOIN os_business_listings o ON o.id = h.id
  WHERE o.id IS NULL;

  -- Missing in hammerex (fine post-cutover; during cutover we alert)
  SELECT count(*) INTO v_missing_in_hammerex
  FROM os_business_listings o
  LEFT JOIN hammerex_trade_off_listings h ON h.id = o.id
  WHERE h.id IS NULL AND o.deleted_at IS NULL;

  -- Field drift on legacy-known fields
  SELECT count(*) INTO v_field_drift
  FROM hammerex_trade_off_listings h
  JOIN os_business_listings o ON o.id = h.id
  WHERE
    h.slug IS DISTINCT FROM o.slug
    OR h.display_name IS DISTINCT FROM o.display_name
    OR h.primary_trade IS DISTINCT FROM o.primary_trade
    OR h.city IS DISTINCT FROM o.city
    OR h.status IS DISTINCT FROM o.status
    OR h.email IS DISTINCT FROM o.email
    OR h.whatsapp IS DISTINCT FROM o.whatsapp;

  -- Drift samples (first 20 rows with any drift). Reworked from an
  -- attempted `drift_rows(h,o)` alias — Postgres doesn't allow row
  -- aliasing after `SELECT *, *`. Using a CTE with explicit columns
  -- gets the same result and passes SQL parsing.
  WITH drift AS (
    SELECT
      h.id AS h_id, h.slug AS h_slug,
      h.display_name AS h_display_name, h.primary_trade AS h_primary_trade,
      h.city AS h_city, h.status AS h_status,
      h.email AS h_email, h.whatsapp AS h_whatsapp,
      o.id AS o_id, o.slug AS o_slug,
      o.display_name AS o_display_name, o.primary_trade AS o_primary_trade,
      o.city AS o_city, o.status AS o_status,
      o.email AS o_email, o.whatsapp AS o_whatsapp
    FROM hammerex_trade_off_listings h
    LEFT JOIN os_business_listings o ON o.id = h.id
    WHERE
      o.id IS NULL
      OR h.slug IS DISTINCT FROM o.slug
      OR h.display_name IS DISTINCT FROM o.display_name
      OR h.primary_trade IS DISTINCT FROM o.primary_trade
      OR h.city IS DISTINCT FROM o.city
      OR h.status IS DISTINCT FROM o.status
      OR h.email IS DISTINCT FROM o.email
      OR h.whatsapp IS DISTINCT FROM o.whatsapp
    LIMIT 20
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', d.h_id,
      'slug', d.h_slug,
      'drift_type',
        CASE
          WHEN d.o_id IS NULL THEN 'missing_in_os_business'
          WHEN d.h_slug IS DISTINCT FROM d.o_slug THEN 'slug'
          WHEN d.h_display_name IS DISTINCT FROM d.o_display_name THEN 'display_name'
          WHEN d.h_primary_trade IS DISTINCT FROM d.o_primary_trade THEN 'primary_trade'
          WHEN d.h_city IS DISTINCT FROM d.o_city THEN 'city'
          WHEN d.h_status IS DISTINCT FROM d.o_status THEN 'status'
          WHEN d.h_email IS DISTINCT FROM d.o_email THEN 'email'
          WHEN d.h_whatsapp IS DISTINCT FROM d.o_whatsapp THEN 'whatsapp'
          ELSE 'unknown'
        END
    )
  ) INTO v_samples
  FROM drift d;

  v_samples := COALESCE(v_samples, '[]'::jsonb);

  -- Health verdict
  v_is_healthy := (v_missing_in_os = 0 AND v_field_drift = 0);
  v_severity := CASE
    WHEN v_missing_in_os > 0 OR v_field_drift > v_hammerex_count * 0.05 THEN 'critical'
    WHEN v_field_drift > 0 THEN 'warning'
    ELSE 'ok'
  END;

  v_duration_ms := extract(millisecond from clock_timestamp() - v_start)::integer;

  -- Persist report
  INSERT INTO os_sync_health_reports (
    hammerex_row_count, os_business_row_count, os_business_active_count,
    missing_in_os_business, missing_in_hammerex, field_drift_count,
    divergence_samples, is_healthy, severity, check_duration_ms
  )
  VALUES (
    v_hammerex_count, v_os_count, v_os_active_count,
    v_missing_in_os, v_missing_in_hammerex, v_field_drift,
    v_samples, v_is_healthy, v_severity, v_duration_ms
  );

  -- Return structured result
  v_result := jsonb_build_object(
    'is_healthy', v_is_healthy,
    'severity', v_severity,
    'hammerex_row_count', v_hammerex_count,
    'os_business_row_count', v_os_count,
    'os_business_active_count', v_os_active_count,
    'missing_in_os_business', v_missing_in_os,
    'missing_in_hammerex', v_missing_in_hammerex,
    'field_drift_count', v_field_drift,
    'divergence_samples', v_samples,
    'check_duration_ms', v_duration_ms,
    'checked_at', v_start
  );

  RETURN v_result;
END;
$$;

-- ---------------------------------------------------------------------
-- 3. Prime the health check now — captures baseline immediately after
--    Phase 1 migrations ran, so the very first row shows healthy state
--    (or catches a defect before pilot ships).
-- ---------------------------------------------------------------------
SELECT os_sync_health_check();

-- ---------------------------------------------------------------------
-- 4. RLS — service-role only
-- ---------------------------------------------------------------------
ALTER TABLE os_sync_health_reports ENABLE ROW LEVEL SECURITY;

COMMIT;
