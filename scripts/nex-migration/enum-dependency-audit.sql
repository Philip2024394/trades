-- READ-ONLY dependency audit for the 10 misplaced public.nex_food_* ENUM types.
-- Answers three questions before Philip approves the ALTER TYPE ... SET SCHEMA plan:
--   (1) What columns / views / functions / indexes depend on each type?
--   (2) Where does each type currently live (schema + oid + owner)?
--   (3) Is any dependent object in a schema other than nex? (would block a clean move)

\pset format aligned
\pset border 2
\timing off

\echo === TYPE INVENTORY ===
SELECT n.nspname AS current_schema,
       t.typname AS type_name,
       t.oid,
       pg_catalog.pg_get_userbyid(t.typowner) AS owner,
       t.typtype
FROM pg_type t
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE t.typname IN (
  'nex_food_claim_status','nex_food_enrichment_agent','nex_food_enrichment_status',
  'nex_food_event_type','nex_food_field_trust','nex_food_next_action',
  'nex_food_outreach_channel','nex_food_outreach_status','nex_food_owner_status',
  'nex_food_source_type'
)
ORDER BY t.typname;

\echo
\echo === DEPENDENT COLUMNS (grouped by type + dependent-schema) ===
SELECT tt.typname AS type_name,
       n.nspname  AS dependent_schema,
       c.relname  AS dependent_table,
       a.attname  AS dependent_column,
       c.relkind  AS relkind
FROM pg_type tt
JOIN pg_depend d ON d.refobjid = tt.oid AND d.refclassid = 'pg_type'::regclass
JOIN pg_class c ON c.oid = d.objid
JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = d.objsubid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE tt.typname LIKE 'nex_food_%'
ORDER BY tt.typname, n.nspname, c.relname, a.attname;

\echo
\echo === DEPENDENT VIEWS / MATVIEWS (via rewrite rules referring to these types) ===
SELECT DISTINCT tt.typname AS type_name,
       n.nspname AS view_schema,
       c.relname AS view_name,
       c.relkind AS relkind
FROM pg_type tt
JOIN pg_depend d1 ON d1.refobjid = tt.oid AND d1.refclassid = 'pg_type'::regclass
JOIN pg_rewrite r ON r.oid = d1.objid
JOIN pg_class c ON c.oid = r.ev_class
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE tt.typname LIKE 'nex_food_%'
ORDER BY tt.typname, n.nspname, c.relname;

\echo
\echo === DEPENDENT FUNCTIONS ===
SELECT DISTINCT tt.typname AS type_name,
       n.nspname AS func_schema,
       p.proname AS func_name,
       pg_get_function_identity_arguments(p.oid) AS args
FROM pg_type tt
JOIN pg_depend d ON d.refobjid = tt.oid AND d.refclassid = 'pg_type'::regclass
JOIN pg_proc p ON p.oid = d.objid
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE tt.typname LIKE 'nex_food_%'
ORDER BY tt.typname, n.nspname, p.proname;

\echo
\echo === INDEXES REFERENCING THESE TYPES (via partial-index predicates) ===
SELECT DISTINCT tt.typname AS type_name,
       n.nspname AS index_schema,
       ic.relname AS index_name,
       pg_get_indexdef(i.indexrelid) AS indexdef
FROM pg_type tt
JOIN pg_index i ON true
JOIN pg_class ic ON ic.oid = i.indexrelid
JOIN pg_namespace n ON n.oid = ic.relnamespace
WHERE pg_get_indexdef(i.indexrelid) LIKE '%' || tt.typname || '%'
  AND tt.typname LIKE 'nex_food_%'
ORDER BY tt.typname, n.nspname, ic.relname;

\echo
\echo === DEPENDENT-SCHEMA HISTOGRAM (any schema OTHER than nex is a red flag) ===
SELECT tt.typname AS type_name,
       n.nspname  AS dependent_schema,
       count(*)   AS dependent_objects
FROM pg_type tt
JOIN pg_depend d ON d.refobjid = tt.oid AND d.refclassid = 'pg_type'::regclass
JOIN pg_class c ON c.oid = d.objid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE tt.typname LIKE 'nex_food_%'
GROUP BY tt.typname, n.nspname
ORDER BY tt.typname, n.nspname;

\echo
\echo === SEARCH_PATH + DATABASE CONTEXT ===
SELECT current_database() AS db, current_schema() AS current_schema, current_setting('search_path') AS search_path;
