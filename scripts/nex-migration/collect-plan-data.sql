-- Read-only data collection for restore batch planning.
-- Runs against LOCAL nex_dev (source of truth · authoritative row counts + sizes).

\pset format aligned
\pset border 2
\pset pager off

\echo === ALL 191 nex.* TABLES with authoritative row counts + physical sizes ===
DO $body$
DECLARE r record; cnt bigint;
BEGIN
  CREATE TEMP TABLE _plan (
    table_name text PRIMARY KEY,
    row_count bigint,
    total_size_bytes bigint,
    heap_size_bytes bigint,
    indexes_size_bytes bigint,
    toast_size_bytes bigint,
    has_toast boolean,
    has_indexes boolean
  ) ON COMMIT DROP;
  FOR r IN
    SELECT c.oid, c.relname, c.reltoastrelid, pg_total_relation_size(c.oid) AS total,
           pg_relation_size(c.oid) AS heap, pg_indexes_size(c.oid) AS idx
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='nex' AND c.relkind='r'
  LOOP
    EXECUTE 'SELECT count(*) FROM nex.' || quote_ident(r.relname) INTO cnt;
    INSERT INTO _plan VALUES (
      r.relname,
      cnt,
      r.total,
      r.heap,
      r.idx,
      COALESCE(pg_total_relation_size(r.reltoastrelid), 0),
      r.reltoastrelid > 0,
      r.idx > 0
    );
  END LOOP;
END $body$;

-- Show all tables sorted by total size desc
\echo
\echo === TABLES BY SIZE (largest first) — includes indexes + toast ===
SELECT table_name,
       row_count,
       pg_size_pretty(total_size_bytes)   AS total,
       pg_size_pretty(heap_size_bytes)    AS heap,
       pg_size_pretty(indexes_size_bytes) AS idx,
       pg_size_pretty(toast_size_bytes)   AS toast
FROM _plan
WHERE row_count > 0
ORDER BY total_size_bytes DESC;

\echo
\echo === TABLES with row_count = 0 (skip in data restore) ===
SELECT table_name FROM _plan WHERE row_count = 0 ORDER BY table_name;

\echo
\echo === TOTAL SUMMARY ===
SELECT
  count(*) AS total_tables,
  count(*) FILTER (WHERE row_count > 0) AS populated_tables,
  count(*) FILTER (WHERE row_count = 0) AS empty_tables,
  sum(row_count) AS total_rows,
  pg_size_pretty(sum(total_size_bytes)) AS total_size,
  pg_size_pretty(sum(heap_size_bytes)) AS total_heap_only
FROM _plan;

\echo
\echo === FK DEPENDENCY GRAPH (nex.* internal FKs) ===
SELECT
  c.conname                       AS fk_name,
  cl.relname                      AS source_table,
  rc.relname                      AS references_table,
  pg_get_constraintdef(c.oid)     AS constraint_def
FROM pg_constraint c
JOIN pg_class cl ON cl.oid = c.conrelid
JOIN pg_namespace n ON n.oid = cl.relnamespace
JOIN pg_class rc ON rc.oid = c.confrelid
JOIN pg_namespace rn ON rn.oid = rc.relnamespace
WHERE c.contype = 'f' AND n.nspname = 'nex' AND rn.nspname = 'nex'
ORDER BY cl.relname, c.conname;
