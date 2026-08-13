-- scripts/schema-diff-supabase-side.sql
--
-- Companion to scripts/schema-diff-supabase-vs-postgres.mjs.
--
-- The Node script infers Supabase table columns from PostgREST samples,
-- which returns nothing useful for EMPTY tables (deprecations,
-- llm_retry_queue in current state). It also cannot reach pg_indexes
-- or pg_policies without an RPC.
--
-- Paste this file into the Supabase SQL editor to get authoritative
-- answers for the 14 brain tables. Compare output to the Node script's
-- Postgres-side summary section.
--
-- READ-ONLY. Zero writes. Safe to run at any time.

-- ── SECTION 1 · Table presence + column shape ───────────────────────
SELECT
  table_name,
  string_agg(column_name || '::' || data_type, ', ' ORDER BY column_name) AS columns
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'knowledge_records', 'record_versions', 'graph_edges',
    'worker_jobs', 'worker_results', 'sources',
    'confidence_scores', 'contradictions', 'deprecations',
    'knowledge_feedback', 'audit_log', 'llm_retry_queue',
    'worker_heartbeats', 'worker_audit_events'
  )
GROUP BY table_name
ORDER BY table_name;

-- ── SECTION 2 · Index presence ──────────────────────────────────────
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'knowledge_records', 'record_versions', 'graph_edges',
    'worker_jobs', 'worker_results', 'sources',
    'confidence_scores', 'contradictions', 'deprecations',
    'knowledge_feedback', 'audit_log', 'llm_retry_queue',
    'worker_heartbeats', 'worker_audit_events'
  )
ORDER BY tablename, indexname;

-- ── SECTION 3 · RLS policies ────────────────────────────────────────
SELECT
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'knowledge_records', 'record_versions', 'graph_edges',
    'worker_jobs', 'worker_results', 'sources',
    'confidence_scores', 'contradictions', 'deprecations',
    'knowledge_feedback', 'audit_log', 'llm_retry_queue',
    'worker_heartbeats', 'worker_audit_events'
  )
ORDER BY tablename, policyname;

-- ── SECTION 4 · Foreign-key + primary-key constraints ───────────────
SELECT
  t.relname             AS table_name,
  c.conname             AS constraint_name,
  CASE c.contype WHEN 'p' THEN 'PRIMARY KEY' WHEN 'f' THEN 'FOREIGN KEY' WHEN 'u' THEN 'UNIQUE' WHEN 'c' THEN 'CHECK' END AS kind,
  pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_class      t ON t.oid = c.conrelid
JOIN pg_namespace  n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND t.relname IN (
    'knowledge_records', 'record_versions', 'graph_edges',
    'worker_jobs', 'worker_results', 'sources',
    'confidence_scores', 'contradictions', 'deprecations',
    'knowledge_feedback', 'audit_log', 'llm_retry_queue',
    'worker_heartbeats', 'worker_audit_events'
  )
ORDER BY t.relname, c.conname;

-- ── SECTION 5 · Explicit check · worker_audit_events presence ──────
--
-- The audit's known miss. If this returns 0 rows, migration 004
-- (db/migrations/004_worker_audit_events.sql) must be applied to
-- Supabase BEFORE the audit trail is durable across a cutover.
SELECT
  COUNT(*) AS worker_audit_events_present
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name   = 'worker_audit_events';
