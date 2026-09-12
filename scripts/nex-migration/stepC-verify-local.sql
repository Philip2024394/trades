-- Step C · READ-ONLY verification after Step B ALTER TYPE.
-- Confirms all 10 types now in nex.*, none in public.*, dependencies intact,
-- matview data preserved, dependent tables/views still queryable.

\pset format aligned
\pset border 2

\echo === 1 · TYPE INVENTORY (all 10 must be in nex, none in public) ===
SELECT n.nspname AS schema, t.typname AS type_name, t.oid
FROM pg_type t
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE t.typname LIKE 'nex_food_%'
ORDER BY t.typname;

\echo
\echo === 2 · STRAGGLER CHECK (must be zero) ===
SELECT count(*) AS stragglers_in_public
FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public' AND t.typname LIKE 'nex_food_%';

\echo
\echo === 3 · DEPENDENT-COLUMN COUNT PER TYPE (should match pre-audit: 26 total) ===
SELECT tt.typname AS type_name, count(*) AS dependent_columns
FROM pg_type tt
JOIN pg_depend d ON d.refobjid = tt.oid AND d.refclassid = 'pg_type'::regclass
JOIN pg_class c ON c.oid = d.objid
JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = d.objsubid
WHERE tt.typname LIKE 'nex_food_%'
GROUP BY tt.typname
ORDER BY tt.typname;

\echo
\echo === 4 · MATVIEW DATA INTACT: nex.food_business_value row count ===
SELECT count(*) AS food_business_value_rows FROM nex.food_business_value;

\echo
\echo === 5 · TABLE QUERY: nex.food_business row count + sample column type resolution ===
SELECT count(*)                                 AS food_business_rows,
       count(claim_status)                      AS claim_status_present,
       count(owner_status)                      AS owner_status_present,
       count(DISTINCT claim_status::text)       AS distinct_claim_values,
       count(DISTINCT owner_status::text)       AS distinct_owner_values
FROM nex.food_business;

\echo
\echo === 6 · VIEW RESOLUTION: nex.food_commercial_universe (uses claim_status + owner_status) ===
SELECT count(*) AS food_commercial_universe_rows FROM nex.food_commercial_universe;

\echo
\echo === 7 · VIEW RESOLUTION: nex.food_business_completeness ===
SELECT count(*) AS food_business_completeness_rows FROM nex.food_business_completeness;

\echo
\echo === 8 · VIEW RESOLUTION: nex.food_business_freshness ===
SELECT count(*) AS food_business_freshness_rows FROM nex.food_business_freshness;

\echo
\echo === 9 · VIEW RESOLUTION: nex.food_pending_self_service_claims ===
SELECT count(*) AS food_pending_self_service_claims_rows FROM nex.food_pending_self_service_claims;

\echo
\echo === 10 · INDEX INTEGRITY: partial-index predicates using nex_food_enrichment_status ===
SELECT ic.relname                          AS index_name,
       pg_get_indexdef(i.indexrelid)       AS indexdef_regenerated
FROM pg_index i
JOIN pg_class ic ON ic.oid = i.indexrelid
JOIN pg_namespace n ON n.oid = ic.relnamespace
WHERE ic.relname IN ('idx_food_job_status_next','uniq_food_job_active_per_business_agent')
ORDER BY ic.relname;

\echo
\echo === 11 · UNEXPECTED PUBLIC.* CHANGES CHECK (should show ONLY the original 17 UK trades tables + zero new nex_food_ objects) ===
SELECT n.nspname AS schema, c.relname AS name, c.relkind
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND (c.relname LIKE 'nex_food_%' OR c.relname LIKE '%nex_food%')
UNION ALL
SELECT n.nspname AS schema, t.typname AS name, 't'
FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public' AND t.typname LIKE 'nex_food_%';
-- If empty, public.* is clean.

\echo
\echo === 12 · SCHEMA SUMMARY ===
SELECT n.nspname AS schema,
  (SELECT count(*) FROM pg_class WHERE relnamespace=n.oid AND relkind='r') AS tables,
  (SELECT count(*) FROM pg_type  WHERE typnamespace=n.oid AND typtype='e') AS enum_types
FROM pg_namespace n
WHERE n.nspname IN ('nex','public')
ORDER BY n.nspname;
