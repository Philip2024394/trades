-- NEX Infrastructure Runtime · bootstrap · local roles
--
-- Runs BEFORE the canonical schema in deploy/postgres/init/ on non-Supabase
-- Postgres targets (local dev · self-hosted · on-prem · other cloud).
--
-- Why this file exists:
--   The canonical schema uses `service_role` — a role Supabase provides out
--   of the box. Raw Postgres has no such role, so the RLS DDL in 001..011
--   would fail. Rather than teach the canonical schema about environments,
--   we create the role here so the schema stays pristine.
--
-- Doctrine: infrastructure differences belong in the bootstrap layer, never
-- in the canonical schema or the application. This mirrors the provider-
-- agnostic architecture — the adapter absorbs environment gaps.
--
-- Safety:
--   · Idempotent · safe to re-run
--   · Never modifies existing role privileges beyond the additive grants
--   · No-op on Supabase (service_role already exists · IF NOT EXISTS guard)
--     but that's not the intended target — Supabase does not need bootstrap.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END $$;

-- Ensure the nex schema exists before granting on it. The apply step also
-- creates it (CREATE SCHEMA IF NOT EXISTS), but running bootstrap FIRST
-- means we can't assume it's there yet.
CREATE SCHEMA IF NOT EXISTS nex;

GRANT USAGE ON SCHEMA nex TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA nex GRANT ALL ON TABLES    TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA nex GRANT ALL ON SEQUENCES TO service_role;
