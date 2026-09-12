-- NEX · C5 · Real Production Job Registry Seed
-- Authorized 2026-09-04 by Philip · "NEX · REAL PRODUCTION JOB REGISTRY SEED · C5 ONLY"
-- Executes as postgres via Supabase Management API · atomic single transaction.
--
-- Inserts exactly ONE production job definition: the end-to-end proven
-- (restaurants, overpass) tuple from Gate 5A #4. Everything else is deferred
-- to future slices per the discovery ambiguity report (cafes needs proving;
-- retail-* needs a new persister; ice-cream/fast-food need capability additions).

BEGIN;

-- ─── Preservation preflight (aborts on any invariant drift) ────────────────
DO $body$
DECLARE
  v_jr_before int;
  v_food int;
  v_dup int;
  v_wi int;
  v_wi_active int;
  v_cities int;
  v_wf_policies int;
  v_food_policies int;
  v_wf_roles int;
  v_persister_secdef boolean;
BEGIN
  SELECT count(*)::int INTO v_jr_before FROM nex_workforce.job_registry;
  IF v_jr_before <> 0 THEN
    RAISE EXCEPTION 'Preflight FAIL · job_registry expected empty · got %', v_jr_before;
  END IF;

  SELECT count(*)::int INTO v_food FROM nex.food_business;
  IF v_food <> 23046 THEN
    RAISE EXCEPTION 'Preflight FAIL · food_business % <> expected 23046', v_food;
  END IF;

  SELECT count(*)::int INTO v_dup
    FROM (SELECT source_reference FROM nex.food_business WHERE source='osm_overpass' GROUP BY source_reference HAVING count(*)>1) x;
  IF v_dup <> 373 THEN
    RAISE EXCEPTION 'Preflight FAIL · duplicate groups % <> expected 373', v_dup;
  END IF;

  SELECT count(*)::int INTO v_wi FROM nex_workforce.work_item;
  IF v_wi <> 2 THEN
    RAISE EXCEPTION 'Preflight FAIL · work_item % <> expected 2 (post-cleanup baseline)', v_wi;
  END IF;

  SELECT count(*)::int INTO v_wi_active FROM nex_workforce.work_item WHERE state IN ('pending','leased');
  IF v_wi_active <> 0 THEN
    RAISE EXCEPTION 'Preflight FAIL · wi_active % <> expected 0', v_wi_active;
  END IF;

  SELECT count(*)::int INTO v_cities FROM nex_workforce.city_catalogue;
  IF v_cities <> 0 THEN
    RAISE EXCEPTION 'Preflight FAIL · city_catalogue % <> expected 0 (C6 untouched)', v_cities;
  END IF;

  SELECT count(*)::int INTO v_wf_policies FROM pg_policy pol
    JOIN pg_class c ON c.oid=pol.polrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='nex_workforce';
  IF v_wf_policies <> 11 THEN
    RAISE EXCEPTION 'Preflight FAIL · wf_policies % <> expected 11', v_wf_policies;
  END IF;

  SELECT count(*)::int INTO v_food_policies FROM pg_policy WHERE polrelid='nex.food_business'::regclass;
  IF v_food_policies <> 5 THEN
    RAISE EXCEPTION 'Preflight FAIL · food_policies % <> expected 5', v_food_policies;
  END IF;

  SELECT count(*)::int INTO v_wf_roles FROM pg_roles WHERE rolname LIKE 'nex_workforce%';
  IF v_wf_roles <> 3 THEN
    RAISE EXCEPTION 'Preflight FAIL · wf_roles % <> expected 3', v_wf_roles;
  END IF;

  SELECT prosecdef INTO v_persister_secdef FROM pg_proc
   WHERE pronamespace='nex_workforce'::regnamespace AND proname='persist_to_food_business';
  IF v_persister_secdef IS NOT TRUE THEN
    RAISE EXCEPTION 'Preflight FAIL · persister SECDEF <> true';
  END IF;

  RAISE NOTICE 'Preflight OK · job_registry=0 · food=23046 · dup=373 · wi=2 · wi_active=0 · cities=0 · policies 5+11 · roles=3 · SECDEF=true';
END $body$;

-- ─── INSERT the one proven production job ──────────────────────────────────
INSERT INTO nex_workforce.job_registry
  (slug, category_slug, source_slug,
   cadence_minutes, max_concurrent_per_source, max_attempts, lease_minutes,
   enabled, priority, notes)
VALUES (
  'restaurants-overpass',
  'restaurants',
  'overpass',
  60,   -- cadence_minutes (default)
  3,    -- max_concurrent_per_source (default)
  5,    -- max_attempts (default)
  15,   -- lease_minutes (default)
  true, -- enabled
  100,  -- priority (default)
  'Production job · restaurants via OpenStreetMap Overpass API. End-to-end proven by Gate 5A #4 on 2026-09-04 (Yogyakarta Malioboro · 321 candidates · 296 INSERT + 19 UPDATE + 6 REJECT · 315 persists via nex_workforce.persist_to_food_business · sink nex.food_business). Slice 4.1 v2 extensions.digest verified. Cities activated via nex_workforce.city_catalogue (C6 · separate gate).'
)
RETURNING slug, category_slug, source_slug, cadence_minutes, max_concurrent_per_source, max_attempts, lease_minutes, enabled, priority;

-- ─── Postflight preservation + no-side-effect assertions ───────────────────
DO $body$
DECLARE
  v_jr_after int;
  v_seed_row_present boolean;
  v_wi_after int;
  v_wi_active_after int;
  v_food_after int;
  v_dup_after int;
  v_cities_after int;
  v_wf_policies_after int;
  v_food_policies_after int;
  v_rotation_count int;
BEGIN
  SELECT count(*)::int INTO v_jr_after FROM nex_workforce.job_registry;
  IF v_jr_after <> 1 THEN
    RAISE EXCEPTION 'Postflight FAIL · job_registry after=% <> expected 1', v_jr_after;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM nex_workforce.job_registry
     WHERE slug = 'restaurants-overpass'
       AND category_slug = 'restaurants'
       AND source_slug = 'overpass'
       AND enabled = true
  ) INTO v_seed_row_present;
  IF NOT v_seed_row_present THEN
    RAISE EXCEPTION 'Postflight FAIL · seeded row not present in expected shape';
  END IF;

  -- work_item MUST NOT have changed (insertion alone must not enqueue)
  SELECT count(*)::int INTO v_wi_after FROM nex_workforce.work_item;
  IF v_wi_after <> 2 THEN
    RAISE EXCEPTION 'Postflight FAIL · work_item drift · % <> expected 2', v_wi_after;
  END IF;
  SELECT count(*)::int INTO v_wi_active_after FROM nex_workforce.work_item WHERE state IN ('pending','leased');
  IF v_wi_active_after <> 0 THEN
    RAISE EXCEPTION 'Postflight FAIL · wi_active drift · % <> expected 0', v_wi_active_after;
  END IF;

  -- Business data untouched
  SELECT count(*)::int INTO v_food_after FROM nex.food_business;
  IF v_food_after <> 23046 THEN
    RAISE EXCEPTION 'Postflight FAIL · food_business % <> expected 23046', v_food_after;
  END IF;
  SELECT count(*)::int INTO v_dup_after
    FROM (SELECT source_reference FROM nex.food_business WHERE source='osm_overpass' GROUP BY source_reference HAVING count(*)>1) x;
  IF v_dup_after <> 373 THEN
    RAISE EXCEPTION 'Postflight FAIL · dup groups % <> expected 373', v_dup_after;
  END IF;

  -- C6 (city_catalogue) untouched
  SELECT count(*)::int INTO v_cities_after FROM nex_workforce.city_catalogue;
  IF v_cities_after <> 0 THEN
    RAISE EXCEPTION 'Postflight FAIL · city_catalogue drift · % <> expected 0', v_cities_after;
  END IF;

  -- Security unchanged
  SELECT count(*)::int INTO v_wf_policies_after FROM pg_policy pol
    JOIN pg_class c ON c.oid=pol.polrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='nex_workforce';
  IF v_wf_policies_after <> 11 THEN
    RAISE EXCEPTION 'Postflight FAIL · wf_policies drift · % <> expected 11', v_wf_policies_after;
  END IF;
  SELECT count(*)::int INTO v_food_policies_after FROM pg_policy WHERE polrelid='nex.food_business'::regclass;
  IF v_food_policies_after <> 5 THEN
    RAISE EXCEPTION 'Postflight FAIL · food_policies drift · % <> expected 5', v_food_policies_after;
  END IF;

  -- rotation_eligible MUST still be empty (no cities yet · C6 untouched)
  SELECT count(*)::int INTO v_rotation_count FROM nex_workforce.rotation_eligible;
  IF v_rotation_count <> 0 THEN
    RAISE EXCEPTION 'Postflight FAIL · rotation_eligible % <> expected 0 (no cities · view is empty until C6)', v_rotation_count;
  END IF;

  RAISE NOTICE 'Postflight OK · job_registry=1 · wi=2 · wi_active=0 · food=23046 · dup=373 · cities=0 · policies 5+11 · rotation_eligible=0 (correct · pending C6)';
END $body$;

COMMIT;
