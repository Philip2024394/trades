-- NEX · C6 · Real Production City Catalogue Seed (post-R5)
-- Authorized 2026-09-04 by Philip · "NEX · C6 · REAL PRODUCTION CITY CATALOGUE SEED · APPLY TO PROJECT B"
-- Executes as postgres via Supabase Management API · atomic single transaction.
--
-- Inserts exactly ONE production city definition: Yogyakarta at city-level.
-- Bbox is empirically derived from 1,728 existing nex.food_business rows
-- tagged city='Yogyakarta' (min/max coords). Deterministic. Unrounded. Not invented.
-- Overpass query complexity at this bbox size has NOT been operationally proven ·
-- a separate controlled proving slice is required before production activation.

BEGIN;

-- ─── Preservation preflight (aborts on any invariant drift) ────────────────
DO $body$
DECLARE
  v_cc_before int; v_jr int; v_wi int; v_wi_active int;
  v_food int; v_dup int; v_ev int; v_stg int; v_aud int;
  v_wf_pol int; v_food_pol int;
  v_r5_city_slug boolean; v_r5_cc boolean; v_r5_hardcode boolean; v_r5_grant boolean;
BEGIN
  SELECT count(*)::int INTO v_cc_before FROM nex_workforce.city_catalogue;
  IF v_cc_before <> 0 THEN
    RAISE EXCEPTION 'Preflight FAIL · city_catalogue expected empty · got %', v_cc_before;
  END IF;

  SELECT count(*)::int INTO v_jr FROM nex_workforce.job_registry;
  IF v_jr <> 1 THEN RAISE EXCEPTION 'Preflight FAIL · job_registry % <> expected 1 (C5)', v_jr; END IF;

  SELECT count(*)::int INTO v_wi FROM nex_workforce.work_item;
  IF v_wi <> 2 THEN RAISE EXCEPTION 'Preflight FAIL · work_item % <> expected 2', v_wi; END IF;

  SELECT count(*)::int INTO v_wi_active FROM nex_workforce.work_item WHERE state IN ('pending','leased');
  IF v_wi_active <> 0 THEN RAISE EXCEPTION 'Preflight FAIL · active work_items % <> expected 0', v_wi_active; END IF;

  SELECT count(*)::int INTO v_food FROM nex.food_business;
  IF v_food <> 23046 THEN RAISE EXCEPTION 'Preflight FAIL · food_business % <> expected 23046', v_food; END IF;

  SELECT count(*)::int INTO v_dup
    FROM (SELECT source_reference FROM nex.food_business WHERE source='osm_overpass' GROUP BY source_reference HAVING count(*)>1) x;
  IF v_dup <> 373 THEN RAISE EXCEPTION 'Preflight FAIL · dup groups % <> expected 373', v_dup; END IF;

  SELECT count(*)::int INTO v_ev FROM nex_workforce.evidence_record;
  IF v_ev <> 4 THEN RAISE EXCEPTION 'Preflight FAIL · evidence_record % <> expected 4', v_ev; END IF;

  SELECT count(*)::int INTO v_stg FROM nex_workforce.candidate_staging;
  IF v_stg <> 1284 THEN RAISE EXCEPTION 'Preflight FAIL · candidate_staging % <> expected 1284', v_stg; END IF;

  SELECT count(*)::int INTO v_aud FROM nex_workforce.persist_audit;
  IF v_aud <> 5 THEN RAISE EXCEPTION 'Preflight FAIL · persist_audit % <> expected 5', v_aud; END IF;

  SELECT count(*)::int INTO v_wf_pol
    FROM pg_policy pol JOIN pg_class c ON c.oid=pol.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='nex_workforce';
  IF v_wf_pol <> 12 THEN RAISE EXCEPTION 'Preflight FAIL · wf_policies % <> expected 12 (11 R2.2 + 1 R5)', v_wf_pol; END IF;

  SELECT count(*)::int INTO v_food_pol FROM pg_policy WHERE polrelid='nex.food_business'::regclass;
  IF v_food_pol <> 5 THEN RAISE EXCEPTION 'Preflight FAIL · food_policies % <> expected 5', v_food_pol; END IF;

  -- R5 preservation (§ 16)
  SELECT pg_get_functiondef(oid) ~ 'v_wi_row\.city_slug',
         pg_get_functiondef(oid) ~ 'nex_workforce\.city_catalogue',
         pg_get_functiondef(oid) ~ E'VALUES[^;]*''Yogyakarta''',
         has_table_privilege('nex_workforce_persister_food_business', 'nex_workforce.city_catalogue', 'SELECT')
    INTO v_r5_city_slug, v_r5_cc, v_r5_hardcode, v_r5_grant
    FROM pg_proc WHERE pronamespace='nex_workforce'::regnamespace AND proname='persist_to_food_business';
  IF NOT v_r5_city_slug THEN RAISE EXCEPTION 'Preflight FAIL · R5 persister missing v_wi_row.city_slug'; END IF;
  IF NOT v_r5_cc THEN RAISE EXCEPTION 'Preflight FAIL · R5 persister missing city_catalogue ref'; END IF;
  IF v_r5_hardcode THEN RAISE EXCEPTION 'Preflight FAIL · R5 persister still has hardcoded Yogyakarta'; END IF;
  IF NOT v_r5_grant THEN RAISE EXCEPTION 'Preflight FAIL · R5 persister missing SELECT on city_catalogue'; END IF;

  RAISE NOTICE 'Preflight OK · cc=0 · jr=1 · wi=2 · wi_active=0 · food=23046 · dup=373 · ev=4 · stg=1284 · aud=5 · wf_pol=12 · food_pol=5 · R5 intact';
END $body$;

-- ─── INSERT the one real production city ───────────────────────────────────
INSERT INTO nex_workforce.city_catalogue
  (slug, name, province, country, bbox_json, enabled, priority, notes)
VALUES (
  'yogyakarta',
  'Yogyakarta',
  'Daerah Istimewa Yogyakarta',
  'Indonesia',
  '{"sw":{"lat":-7.944714,"lon":110.240493},"ne":{"lat":-7.592822,"lon":110.624452}}'::jsonb,
  true,
  100,
  'Production city · Yogyakarta at city-level. Bbox empirically derived from 1,728 existing nex.food_business rows with city=Yogyakarta and source=osm_overpass (MIN/MAX of coordinates_lat, coordinates_lng · unrounded). Lat span 0.351892 deg (17.6% of Slice 4 MAX_SPAN_DEGREES=2.0). Lon span 0.383959 deg (19.2% of limit). Country=Indonesia. Province=Daerah Istimewa Yogyakarta. Persister derives city name authoritatively via nex_workforce.city_catalogue.name (Slice 1h R5 · 2026-09-04). CONFIGURED BUT NOT YET OPERATIONALLY PROVEN: Overpass query complexity at this bbox size has never been tested end-to-end (Gate 5A #4 used the smaller Malioboro sub-bbox 0.05x0.05 deg). A separate controlled proving slice must validate Overpass reliability at this bbox size before production workforce activation.'
)
RETURNING slug, name, province, country, bbox_json, enabled, priority;

-- ─── Postflight assertions (aborts transaction on any drift) ───────────────
DO $body$
DECLARE
  v_cc_after int; v_yogya_present boolean; v_bbox_lat_span numeric; v_bbox_lon_span numeric;
  v_wi_after int; v_wi_active_after int;
  v_food_after int; v_dup_after int;
  v_wf_pol_after int; v_food_pol_after int;
  v_rot int;
BEGIN
  SELECT count(*)::int INTO v_cc_after FROM nex_workforce.city_catalogue;
  IF v_cc_after <> 1 THEN RAISE EXCEPTION 'Postflight FAIL · city_catalogue after=% <> expected 1', v_cc_after; END IF;

  SELECT EXISTS (
    SELECT 1 FROM nex_workforce.city_catalogue
     WHERE slug = 'yogyakarta'
       AND name = 'Yogyakarta'
       AND province = 'Daerah Istimewa Yogyakarta'
       AND country = 'Indonesia'
       AND enabled = true
       AND (bbox_json->'sw'->>'lat')::numeric = -7.944714
       AND (bbox_json->'sw'->>'lon')::numeric = 110.240493
       AND (bbox_json->'ne'->>'lat')::numeric = -7.592822
       AND (bbox_json->'ne'->>'lon')::numeric = 110.624452
  ) INTO v_yogya_present;
  IF NOT v_yogya_present THEN RAISE EXCEPTION 'Postflight FAIL · seeded row not present in expected shape'; END IF;

  -- Bbox spans within Slice 4 invariant
  SELECT (bbox_json->'ne'->>'lat')::numeric - (bbox_json->'sw'->>'lat')::numeric,
         (bbox_json->'ne'->>'lon')::numeric - (bbox_json->'sw'->>'lon')::numeric
    INTO v_bbox_lat_span, v_bbox_lon_span
    FROM nex_workforce.city_catalogue WHERE slug = 'yogyakarta';
  IF v_bbox_lat_span > 2.0 OR v_bbox_lon_span > 2.0 THEN
    RAISE EXCEPTION 'Postflight FAIL · bbox spans lat=% lon=% exceed Slice 4 MAX 2.0', v_bbox_lat_span, v_bbox_lon_span;
  END IF;

  -- Work-item non-generation (§ 13)
  SELECT count(*)::int INTO v_wi_after FROM nex_workforce.work_item;
  IF v_wi_after <> 2 THEN RAISE EXCEPTION 'Postflight FAIL · work_item drift · % <> expected 2', v_wi_after; END IF;
  SELECT count(*)::int INTO v_wi_active_after FROM nex_workforce.work_item WHERE state IN ('pending','leased');
  IF v_wi_active_after <> 0 THEN RAISE EXCEPTION 'Postflight FAIL · wi_active drift · % <> expected 0', v_wi_active_after; END IF;

  -- Data preservation (§ 15)
  SELECT count(*)::int INTO v_food_after FROM nex.food_business;
  IF v_food_after <> 23046 THEN RAISE EXCEPTION 'Postflight FAIL · food_business % <> expected 23046', v_food_after; END IF;
  SELECT count(*)::int INTO v_dup_after
    FROM (SELECT source_reference FROM nex.food_business WHERE source='osm_overpass' GROUP BY source_reference HAVING count(*)>1) x;
  IF v_dup_after <> 373 THEN RAISE EXCEPTION 'Postflight FAIL · dup groups % <> expected 373', v_dup_after; END IF;

  -- Security preservation (§ 17)
  SELECT count(*)::int INTO v_wf_pol_after
    FROM pg_policy pol JOIN pg_class c ON c.oid=pol.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='nex_workforce';
  IF v_wf_pol_after <> 12 THEN RAISE EXCEPTION 'Postflight FAIL · wf_policies drift · % <> expected 12', v_wf_pol_after; END IF;
  SELECT count(*)::int INTO v_food_pol_after FROM pg_policy WHERE polrelid='nex.food_business'::regclass;
  IF v_food_pol_after <> 5 THEN RAISE EXCEPTION 'Postflight FAIL · food_policies drift · % <> expected 5', v_food_pol_after; END IF;

  -- rotation_eligible expected to become non-zero (§ 12)
  SELECT count(*)::int INTO v_rot FROM nex_workforce.rotation_eligible;
  IF v_rot <> 1 THEN
    RAISE EXCEPTION 'Postflight FAIL · rotation_eligible expected 1 (yogyakarta x restaurants-overpass) · got %', v_rot;
  END IF;

  RAISE NOTICE 'Postflight OK · cc=1 · yogyakarta seeded · bbox spans %/% deg · wi=2 · wi_active=0 · food=23046 · dup=373 · policies 5+12 · rotation_eligible=1', v_bbox_lat_span, v_bbox_lon_span;
END $body$;

COMMIT;
