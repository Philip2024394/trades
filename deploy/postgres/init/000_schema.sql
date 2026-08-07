-- NEX Infrastructure Runtime · schema bootstrap
--
-- Two schemas, one Postgres (Contract §2 principle 7):
--   · public.*  → knowledge layer (existing, owned by db/migrations/*)
--   · nex.*     → operational layer (this contract, owned by deploy/postgres/init/*)
--
-- Every table in nex.* carries a `business_id UUID NULL` column plus an
-- index on it (Contract §2 principle 6 · tenancy from day 1). NULL rows
-- are system-level (crons, platform events not owned by any business).

CREATE SCHEMA IF NOT EXISTS nex;

-- gen_random_uuid() lives in pgcrypto · Supabase enables it by default
-- but we assert it here so a bare Postgres also works.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- NOTE · RLS policies in 001..011 target `service_role` (a Supabase-provided
-- role). On raw Postgres that role does not exist. Rather than pollute this
-- canonical schema with env-specific compatibility, run the bootstrap layer
-- FIRST on non-Supabase targets:
--     npm run nex:bootstrap-postgres     (local / self-hosted only · idempotent)
--     npm run nex:apply-storage-schema   (any target · Supabase-safe)
-- Doctrine: infrastructure differences belong in the bootstrap layer, never
-- in the canonical schema. See constitution_nex_backend_provider_agnostic.md.

COMMENT ON SCHEMA nex IS 'NEX operational layer · Infrastructure Runtime v1 · Philip 2026-08-07';
