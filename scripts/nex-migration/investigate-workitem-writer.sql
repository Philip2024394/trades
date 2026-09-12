-- READ-ONLY investigation of local nex.work_item activity since dump 2026-09-03 02:30:44.

\pset format aligned
\pset border 2
\pset pager off

\echo === 1 · Current local work_item count ===
SELECT count(*) AS local_now FROM nex.work_item;

\echo
\echo === 2 · Rows split by dump-time boundary ===
SELECT
  count(*) FILTER (WHERE created_at <= '2026-09-03 02:30:44'::timestamptz) AS at_or_before_dump,
  count(*) FILTER (WHERE created_at >  '2026-09-03 02:30:44'::timestamptz) AS after_dump,
  count(*) FILTER (WHERE updated_at IS NOT NULL AND updated_at > '2026-09-03 02:30:44'::timestamptz AND created_at <= '2026-09-03 02:30:44'::timestamptz) AS updated_after_dump_but_created_before
FROM nex.work_item;

\echo
\echo === 3 · Schema of nex.work_item (columns for grouping) ===
SELECT attname, format_type(atttypid, atttypmod) AS type
FROM pg_attribute
WHERE attrelid = 'nex.work_item'::regclass AND attnum > 0 AND NOT attisdropped
ORDER BY attnum;

\echo
\echo === 4 · The 904 post-dump rows · minute-level timeline ===
SELECT
  date_trunc('minute', created_at) AS minute,
  count(*) AS rows_created
FROM nex.work_item
WHERE created_at > '2026-09-03 02:30:44'::timestamptz
GROUP BY 1 ORDER BY 1;

\echo
\echo === 5 · Post-dump rows grouped by job_slug ===
SELECT job_slug, count(*) AS rows
FROM nex.work_item
WHERE created_at > '2026-09-03 02:30:44'::timestamptz
GROUP BY job_slug ORDER BY count(*) DESC;

\echo
\echo === 6 · Post-dump rows grouped by status ===
SELECT status, count(*) AS rows
FROM nex.work_item
WHERE created_at > '2026-09-03 02:30:44'::timestamptz
GROUP BY status ORDER BY count(*) DESC;

\echo
\echo === 7 · Post-dump rows grouped by worker_id (or similar identity) ===
SELECT
  CASE WHEN column_name = 'claimed_by' THEN claimed_by::text
       ELSE '(no worker_id column)' END AS claimed_by_or_similar,
  count(*) AS rows
FROM nex.work_item, (SELECT column_name FROM information_schema.columns WHERE table_schema='nex' AND table_name='work_item' AND column_name IN ('claimed_by','worker_id','created_by') LIMIT 1) c
WHERE created_at > '2026-09-03 02:30:44'::timestamptz
GROUP BY 1 ORDER BY 2 DESC LIMIT 20;

\echo
\echo === 8 · Sample of 10 post-dump rows (all columns, most recent first) ===
SELECT * FROM nex.work_item WHERE created_at > '2026-09-03 02:30:44'::timestamptz
ORDER BY created_at DESC LIMIT 10;

\echo
\echo === 9 · Triggers on nex.work_item (would show auto-insert sources) ===
SELECT tgname, tgtype, tgenabled,
       pg_get_triggerdef(oid) AS definition
FROM pg_trigger
WHERE tgrelid = 'nex.work_item'::regclass AND NOT tgisinternal;

\echo
\echo === 10 · Foreign keys REFERENCING nex.work_item (what would break if we later reconcile) ===
SELECT cl.relname AS referencing_table, c.conname, pg_get_constraintdef(c.oid) AS def
FROM pg_constraint c
JOIN pg_class cl ON cl.oid = c.conrelid
JOIN pg_namespace n ON n.oid = cl.relnamespace
WHERE c.contype='f' AND c.confrelid = 'nex.work_item'::regclass;

\echo
\echo === 11 · Foreign keys FROM nex.work_item to others (dependencies for reconciliation) ===
SELECT rc.relname AS references_table, c.conname, pg_get_constraintdef(c.oid) AS def
FROM pg_constraint c
JOIN pg_class cl ON cl.oid = c.conrelid
JOIN pg_class rc ON rc.oid = c.confrelid
WHERE c.contype='f' AND c.conrelid = 'nex.work_item'::regclass;

\echo
\echo === 12 · Live sessions on local nex_dev right now (what's connected + what queries) ===
SELECT pid, usename, application_name, client_addr::text, backend_start, state, wait_event, LEFT(query, 200) AS query_preview
FROM pg_stat_activity
WHERE datname = 'nex_dev' AND pid <> pg_backend_pid()
ORDER BY backend_start;

\echo
\echo === 13 · Any other tables that received writes since dump (peek at n_tup_ins deltas via pg_stat) ===
SELECT schemaname, relname, n_tup_ins, n_tup_upd, n_live_tup
FROM pg_stat_user_tables
WHERE schemaname = 'nex' AND (n_tup_ins > 0 OR n_tup_upd > 0)
ORDER BY n_tup_ins DESC LIMIT 20;
