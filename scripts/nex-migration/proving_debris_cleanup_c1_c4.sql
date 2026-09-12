-- NEX · Production Proving-Debris Cleanup · C1-C4
-- Authorized 2026-09-04 by Philip · executes as postgres via Supabase Mgmt API
-- Removes 3 known synthetic v2 work_items · preserves all legitimate acquisition.
-- Transactional · SELECT before DELETE · pre + post preservation assertions.

BEGIN;

-- ─── Preservation preflight (aborts if any invariant differs) ───────────────
DO $body$
DECLARE
  v_legitimate_gate5a4 uuid;
  v_food_count int;
  v_dup_count int;
BEGIN
  SELECT id INTO v_legitimate_gate5a4
    FROM nex_workforce.work_item
   WHERE id = 'cd3d42d4-0387-4087-b35a-46bf2ac22072'
     AND state = 'completed'
     AND records_new = 315
     AND finished_at IS NOT NULL;
  IF v_legitimate_gate5a4 IS NULL THEN
    RAISE EXCEPTION 'Preflight FAIL · Legitimate Gate 5A #4 row cd3d42d4 not found in expected shape';
  END IF;

  SELECT count(*)::int INTO v_food_count FROM nex.food_business;
  IF v_food_count <> 23046 THEN
    RAISE EXCEPTION 'Preflight FAIL · food_business count % <> expected 23046', v_food_count;
  END IF;

  SELECT count(*)::int INTO v_dup_count
    FROM (SELECT source_reference FROM nex.food_business WHERE source='osm_overpass' GROUP BY source_reference HAVING count(*)>1) x;
  IF v_dup_count <> 373 THEN
    RAISE EXCEPTION 'Preflight FAIL · duplicate groups % <> expected 373', v_dup_count;
  END IF;

  -- Verify exactly the 3 known synthetic targets are present and match expected shape
  IF NOT EXISTS (SELECT 1 FROM nex_workforce.work_item WHERE id = '28bc876a-65ed-41a0-91cf-1da583b403e3' AND state='pending' AND city_slug='gate5a-yogya-1788523383420') THEN
    RAISE EXCEPTION 'Preflight FAIL · target 28bc876a not in expected shape (pending · gate5a-yogya-1788523383420)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM nex_workforce.work_item WHERE id = '5828fab5-83e2-4ff9-8624-c882e9c45b23' AND state='pending' AND city_slug='gate5a-yogya-1788520336353') THEN
    RAISE EXCEPTION 'Preflight FAIL · target 5828fab5 not in expected shape (pending · gate5a-yogya-1788520336353)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM nex_workforce.work_item WHERE id = '341ac49e-e01d-4941-ad59-78fa54eaca99' AND state='leased' AND city_slug='gate5a-yogya') THEN
    RAISE EXCEPTION 'Preflight FAIL · target 341ac49e not in expected shape (leased · gate5a-yogya)';
  END IF;

  RAISE NOTICE 'Preflight OK · legitimate Gate 5A #4 preserved · food=23046 · dup=373 · 3 synthetic targets identified';
END $body$;

-- ─── DELETE the 3 synthetic proving work_items ──────────────────────────────
DELETE FROM nex_workforce.work_item
 WHERE id IN (
   '28bc876a-65ed-41a0-91cf-1da583b403e3',
   '5828fab5-83e2-4ff9-8624-c882e9c45b23',
   '341ac49e-e01d-4941-ad59-78fa54eaca99'
 )
RETURNING id, state, city_slug, agent_id, generation, attempts;

-- ─── Postflight assertions (aborts transaction on any drift) ───────────────
DO $body$
DECLARE
  v_targets_left int;
  v_gate5a4_still_here uuid;
  v_wi_total_after int;
  v_food_after int;
  v_dup_after int;
BEGIN
  SELECT count(*)::int INTO v_targets_left
    FROM nex_workforce.work_item
   WHERE id IN (
     '28bc876a-65ed-41a0-91cf-1da583b403e3',
     '5828fab5-83e2-4ff9-8624-c882e9c45b23',
     '341ac49e-e01d-4941-ad59-78fa54eaca99'
   );
  IF v_targets_left <> 0 THEN
    RAISE EXCEPTION 'Postflight FAIL · targets_left=% <> 0', v_targets_left;
  END IF;

  SELECT id INTO v_gate5a4_still_here
    FROM nex_workforce.work_item
   WHERE id = 'cd3d42d4-0387-4087-b35a-46bf2ac22072'
     AND state = 'completed'
     AND records_new = 315
     AND finished_at IS NOT NULL;
  IF v_gate5a4_still_here IS NULL THEN
    RAISE EXCEPTION 'Postflight FAIL · legitimate Gate 5A #4 row cd3d42d4 disappeared';
  END IF;

  SELECT count(*)::int INTO v_wi_total_after FROM nex_workforce.work_item;
  IF v_wi_total_after <> 2 THEN
    RAISE EXCEPTION 'Postflight FAIL · wi_total=% <> expected 2', v_wi_total_after;
  END IF;

  SELECT count(*)::int INTO v_food_after FROM nex.food_business;
  IF v_food_after <> 23046 THEN
    RAISE EXCEPTION 'Postflight FAIL · food_business %=<> expected 23046', v_food_after;
  END IF;

  SELECT count(*)::int INTO v_dup_after
    FROM (SELECT source_reference FROM nex.food_business WHERE source='osm_overpass' GROUP BY source_reference HAVING count(*)>1) x;
  IF v_dup_after <> 373 THEN
    RAISE EXCEPTION 'Postflight FAIL · dup groups % <> expected 373', v_dup_after;
  END IF;

  RAISE NOTICE 'Postflight OK · 3 targets removed · Gate 5A #4 preserved · wi_total=2 · food=23046 · dup=373';
END $body$;

COMMIT;
