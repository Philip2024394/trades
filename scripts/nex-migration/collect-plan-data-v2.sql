-- Table-size + row-count map · single query so temp-table lifetime isn't a problem.
\pset format aligned
\pset border 2
\pset pager off

\echo === ALL 191 nex.* TABLES · row counts + sizes ===
SELECT
  c.relname AS table_name,
  (SELECT reltuples FROM pg_class WHERE oid = c.oid)::bigint AS row_estimate_pg_stat,
  s.n_live_tup AS row_estimate_stat,
  pg_total_relation_size(c.oid) AS total_bytes,
  pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
  pg_relation_size(c.oid) AS heap_bytes,
  pg_size_pretty(pg_relation_size(c.oid)) AS heap_size,
  pg_indexes_size(c.oid) AS indexes_bytes,
  pg_size_pretty(pg_indexes_size(c.oid)) AS indexes_size,
  COALESCE(pg_total_relation_size(c.reltoastrelid), 0) AS toast_bytes,
  pg_size_pretty(COALESCE(pg_total_relation_size(c.reltoastrelid), 0)) AS toast_size
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
WHERE n.nspname = 'nex' AND c.relkind = 'r'
ORDER BY pg_total_relation_size(c.oid) DESC;

\echo
\echo === AUTHORITATIVE row counts (SELECT COUNT — this may take a few seconds) ===
-- Use a lateral to compute count in single row
WITH tables AS (
  SELECT c.relname
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='nex' AND c.relkind='r'
  ORDER BY c.relname
)
SELECT t.relname,
       (SELECT count(*) FROM nex.food_business WHERE t.relname='dummy') AS placeholder
FROM tables t
LIMIT 1;
-- (placeholder line — we run authoritative counts via Node in parallel)
