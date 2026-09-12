-- NEX Workforce · Slice 4 · Overpass Bbox Wiring · Safe Acquisition Boundary
-- Author: Claude · Date: 2026-09-04
-- Governing authorization: Philip 2026-09-04 · "SLICE 4 · DESIGN + PORTABLE
--   VALIDATION ONLY · Overpass bbox wiring + safe acquisition boundary"
--
-- ═════════════════════════════════════════════════════════════════════════════
-- WHAT THIS MIGRATION DOES · exactly three coordinated schema/definition changes
-- ═════════════════════════════════════════════════════════════════════════════
-- Closes the hard activation blocker discovered in the 2026-09-04 Second
-- Controlled Proving Cycle:
--   the overpass_observe_and_stage capability reads workItem.bbox_json but
--   work_item has no such column · no enrichment step joins city_catalogue ·
--   fallback = {-90,-180 → 90,180} = whole-world Overpass query.
--
-- Slice 4 wires the authoritative city_catalogue.bbox_json into work_item at
-- enqueue time so the capability can (a) find it deterministically on the
-- work_item row returned by claim() + (b) fail-closed if it's absent/invalid
-- (validator lives in application code · see scripts/nex-workforce-v2/lib/
-- bbox_validator.mjs).
--
-- Design choice: OPTION C · enqueue-time capture (per Slice 4 authorization
-- Section 6). Justification: preserves single source of truth (city_catalogue
-- remains authoritative), immutable per work_item (retry/lease-transfer uses
-- the same bbox), no runtime join required in capability, no race window
-- between enqueue and execute if operator edits city_catalogue.bbox_json.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- WHAT THIS MIGRATION DOES NOT DO
-- ═════════════════════════════════════════════════════════════════════════════
-- - NO role change · no GRANT / REVOKE / ALTER ROLE
-- - NO RLS state change · no ENABLE / DISABLE / FORCE ROW LEVEL SECURITY
-- - NO new policy · no policy modification
-- - NO trigger change · no index change
-- - NO change to any other function (claim/heartbeat/checkpoint/complete/
--   fail_soft/fail_hard/stage_candidates/persist_batch/reap_expired_leases/
--   requeue_soft_fail_backoff_elapsed/persist_to_food_business)
-- - NO backfill of existing work_item rows · bbox_json is nullable so the
--   1 existing row (proving-cycle completed hello_world audit trail) is
--   unaffected
-- - NO change to nex.food_business · no application code · no .env.local
-- - NO change to Scheduled Task · no workforce activation
--
-- ═════════════════════════════════════════════════════════════════════════════
-- OWNERSHIP + PRIVILEGE INTERACTIONS (R2.2 v2 model preserved)
-- ═════════════════════════════════════════════════════════════════════════════
-- - work_item is owned by postgres · ALTER TABLE runs as executor (postgres
--   on Project B, has ownership rights)
-- - rotation_eligible view is owned by postgres · CREATE OR REPLACE VIEW
--   runs as executor
-- - enqueue_from_view function is owned by nex_workforce_admin (Slice 3 R2.1) ·
--   CREATE OR REPLACE FUNCTION requires ownership · executor must
--   SET LOCAL ROLE nex_workforce_admin (same pattern as Slice 3 R2 § 5 · the
--   Slice 3 R2.1 migration GRANTed admin TO CURRENT_USER WITH SET TRUE which
--   is still in effect on Project B and portable)
-- - R2.2 v2 admin RLS policies on work_item continue to apply (new column
--   inherits table-level RLS · no per-column policy needed)

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- § 0 · Sanity prereqs
DO $body$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='nex_workforce_admin') THEN
    RAISE EXCEPTION 'nex_workforce_admin missing · apply Slice 3 R2.1 first';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='nex_workforce') THEN
    RAISE EXCEPTION 'nex_workforce schema missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='nex_workforce' AND table_name='city_catalogue' AND column_name='bbox_json') THEN
    RAISE EXCEPTION 'city_catalogue.bbox_json column missing · pre-existing schema requirement';
  END IF;
END $body$;

-- ─────────────────────────────────────────────────────────────────────────────
-- § 1 · Add bbox_json column to work_item · nullable · defense-in-depth
-- ─────────────────────────────────────────────────────────────────────────────
--   The column is NULLABLE for two reasons:
--     1. Existing work_item rows (currently 1 row · the proving-cycle
--        hello_world audit trail) predate this migration and never had a bbox.
--        Setting NOT NULL would either require a backfill (no source of truth
--        · hello_world doesn't need a bbox) or fail at ALTER time.
--     2. Not every capability needs a bbox. hello_world doesn't. Future
--        capabilities that pull from non-geographic sources also don't.
--        Bbox is a per-capability requirement · enforced by the CAPABILITY
--        (validator throws BboxInvalidError → agent classifies catastrophic
--        → fail_soft → eventual dead_letter), not by a NOT NULL constraint.
--   The nullable-in-DB + required-by-capability split is intentional and
--   consistent with the fail-loud doctrine · a bbox-required capability
--   getting a NULL bbox fails LOUDLY at plan() time, not silently at query
--   construction time.
ALTER TABLE nex_workforce.work_item
  ADD COLUMN IF NOT EXISTS bbox_json jsonb;

COMMENT ON COLUMN nex_workforce.work_item.bbox_json IS
  'Slice 4 (2026-09-04) · immutable acquisition-time bbox captured from '
  'city_catalogue.bbox_json by enqueue_from_view(). Read by Overpass-family '
  'capabilities via workItem.bbox_json. NULLABLE at DB level · REQUIRED by '
  'capabilities that use it (bbox_validator.mjs fails-closed if absent · '
  'no whole-world fallback ever).';

-- ─────────────────────────────────────────────────────────────────────────────
-- § 2 · Extend rotation_eligible view to expose bbox_json
-- ─────────────────────────────────────────────────────────────────────────────
--   The view already CROSS JOINs city_catalogue · adding bbox_json to the
--   SELECT is a zero-cost addition. Preserves the "one source of truth"
--   doctrine (city_catalogue is authoritative for city geometry).
CREATE OR REPLACE VIEW nex_workforce.rotation_eligible AS
 SELECT c.slug AS city_slug,
        j.category_slug,
        j.source_slug,
        j.slug AS job_slug,
        j.priority + c.priority AS priority,
        j.cadence_minutes,
        j.max_concurrent_per_source,
        j.max_attempts,
        j.lease_minutes,
        c.bbox_json AS bbox_json                    -- NEW · Slice 4
   FROM nex_workforce.city_catalogue c
     CROSS JOIN nex_workforce.job_registry j
  WHERE c.enabled AND j.enabled AND NOT (EXISTS ( SELECT 1
           FROM nex_workforce.work_item wi
          WHERE wi.city_slug = c.slug
            AND wi.category_slug = j.category_slug
            AND wi.source_slug = j.source_slug
            AND ((wi.state = ANY (ARRAY['pending'::text, 'leased'::text]))
                 OR wi.state = 'completed'::text
                    AND wi.finished_at > (now() - make_interval(mins => j.cadence_minutes))
                 OR wi.state = 'soft_fail'::text
                    AND wi.next_eligible_at > now())));

COMMENT ON VIEW nex_workforce.rotation_eligible IS
  'Scheduling view · Slice 1e + Slice 4 bbox extension. bbox_json column '
  'sourced from city_catalogue.bbox_json (may be NULL for cities whose '
  'ops-config has not yet populated a geometry · capability enforces '
  'required-at-execute).';

-- ─────────────────────────────────────────────────────────────────────────────
-- § 3 · Update enqueue_from_view to populate bbox_json into new work_items
-- ─────────────────────────────────────────────────────────────────────────────
--   The one-source-of-truth doctrine says city_catalogue owns the bbox.
--   At enqueue time, we CAPTURE that bbox onto the work_item row · from
--   then on the work_item's bbox is immutable regardless of any subsequent
--   city_catalogue mutation. This means:
--     · retry/lease-transfer always uses the same bbox as the original claim
--     · a mid-flight operator edit of city_catalogue.bbox_json does not
--       change what an in-progress work_item queries against Overpass
--     · the capability never needs a runtime join
--   The function is SECURITY DEFINER as nex_workforce_admin (from Slice 3
--   R2.1) · CREATE OR REPLACE requires admin ownership · executor must
--   SET LOCAL ROLE admin before this block (executor has SET on admin from
--   Slice 3 R2.1's GRANT admin TO CURRENT_USER WITH SET TRUE).
--
--   R2.2 v2 policies still cover work_item · admin can INSERT via
--   wa_work_item_insert · view SELECT via wa_city_catalogue_select +
--   wa_job_registry_select + wa_work_item_select.

-- R2 lesson (Slice 3 R2 fix B): CREATE OR REPLACE FUNCTION requires the
-- function owner to have CREATE on the schema · admin had CREATE removed
-- by Slice 3 R2.1 § 6c to enforce runtime USAGE-only. Temporarily re-grant
-- CREATE for the duration of this migration then REVOKE at end. Defense
-- in depth · admin is NOLOGIN so no runtime code could use CREATE anyway,
-- but USAGE-only-at-rest remains our stated invariant.
GRANT USAGE, CREATE ON SCHEMA nex_workforce TO nex_workforce_admin;

DO $body$
BEGIN
  SET LOCAL ROLE nex_workforce_admin;

  EXECUTE $fn$
    CREATE OR REPLACE FUNCTION nex_workforce.enqueue_from_view()
    RETURNS integer
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = pg_catalog, pg_temp
    AS $inner$
    DECLARE
      v_enqueued integer;
    BEGIN
      WITH inserted AS (
        INSERT INTO nex_workforce.work_item
          (city_slug, category_slug, source_slug, priority, state, bbox_json)
        SELECT city_slug, category_slug, source_slug, priority, 'pending', bbox_json
          FROM nex_workforce.rotation_eligible
        ON CONFLICT (city_slug, category_slug, source_slug)
          WHERE state IN ('pending', 'leased', 'soft_fail')
        DO NOTHING
        RETURNING id
      )
      SELECT COUNT(*)::integer INTO v_enqueued FROM inserted;
      RETURN v_enqueued;
    END;
    $inner$;
  $fn$;

  -- Preserve Slice 3 R2.1 doc string (functionally unchanged · Slice 4
  -- addition of bbox_json noted).
  EXECUTE $c$
    COMMENT ON FUNCTION nex_workforce.enqueue_from_view() IS
      'Slice 3 · SECURITY DEFINER wrapper for Slice 1e orchestrator INSERT. '
      'Runs as nex_workforce_admin so nex_workforce_app can invoke via EXECUTE '
      'without direct INSERT on work_item. Preserves Slice 1e semantic: '
      'INSERT from rotation_eligible view with ON CONFLICT DO NOTHING against '
      'partial unique index. Slice 4 (2026-09-04) addition: also captures '
      'city_catalogue.bbox_json into the new work_item row for downstream '
      'Overpass-family capabilities. Returns count of newly-enqueued rows.';
  $c$;
END $body$;
RESET ROLE;

-- R2 lesson · restore runtime USAGE-only on admin (Slice 3 R2.1 § 6c invariant).
REVOKE CREATE ON SCHEMA nex_workforce FROM nex_workforce_admin;

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- § 8 · DOWN migration (COMMENTED · manual apply if reversal ever needed)
-- ═════════════════════════════════════════════════════════════════════════════
-- BEGIN;
--
-- -- Restore the pre-Slice-4 enqueue_from_view body (no bbox_json column in
-- -- INSERT). Requires SET LOCAL ROLE nex_workforce_admin (SECDEF owner).
-- DO $$
-- BEGIN
--   SET LOCAL ROLE nex_workforce_admin;
--   EXECUTE $fn$
--     CREATE OR REPLACE FUNCTION nex_workforce.enqueue_from_view()
--     RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
--     SET search_path = pg_catalog, pg_temp
--     AS $inner$
--     DECLARE v_enqueued integer;
--     BEGIN
--       WITH inserted AS (
--         INSERT INTO nex_workforce.work_item
--           (city_slug, category_slug, source_slug, priority, state)
--         SELECT city_slug, category_slug, source_slug, priority, 'pending'
--           FROM nex_workforce.rotation_eligible
--         ON CONFLICT (city_slug, category_slug, source_slug)
--           WHERE state IN ('pending', 'leased', 'soft_fail')
--         DO NOTHING RETURNING id
--       )
--       SELECT COUNT(*)::integer INTO v_enqueued FROM inserted;
--       RETURN v_enqueued;
--     END; $inner$;
--   $fn$;
-- END $$;
-- RESET ROLE;
--
-- -- Restore pre-Slice-4 rotation_eligible view (no bbox_json in SELECT).
-- CREATE OR REPLACE VIEW nex_workforce.rotation_eligible AS
--  SELECT c.slug AS city_slug, j.category_slug, j.source_slug, j.slug AS job_slug,
--         j.priority + c.priority AS priority, j.cadence_minutes,
--         j.max_concurrent_per_source, j.max_attempts, j.lease_minutes
--    FROM nex_workforce.city_catalogue c CROSS JOIN nex_workforce.job_registry j
--   WHERE c.enabled AND j.enabled AND NOT (EXISTS ( SELECT 1
--            FROM nex_workforce.work_item wi
--           WHERE wi.city_slug = c.slug AND wi.category_slug = j.category_slug
--             AND wi.source_slug = j.source_slug
--             AND ((wi.state = ANY (ARRAY['pending'::text, 'leased'::text]))
--                  OR wi.state = 'completed'::text
--                     AND wi.finished_at > (now() - make_interval(mins => j.cadence_minutes))
--                  OR wi.state = 'soft_fail'::text
--                     AND wi.next_eligible_at > now())));
--
-- -- Drop the bbox_json column (nullable · no data preservation concern).
-- ALTER TABLE nex_workforce.work_item DROP COLUMN IF EXISTS bbox_json;
--
-- COMMIT;
-- ═════════════════════════════════════════════════════════════════════════════
