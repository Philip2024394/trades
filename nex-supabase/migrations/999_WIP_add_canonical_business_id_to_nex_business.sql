-- nex-supabase/migrations/999_WIP_add_canonical_business_id_to_nex_business.sql
--
-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  WORK-IN-PROGRESS · NOT APPLIED · DRAFT ONLY                         ║
-- ║  ------------------------------------------------------------------  ║
-- ║  This file is prefixed `999_WIP_` deliberately so that no automated  ║
-- ║  migration runner picks it up. It is a DRAFT of the Supabase-side    ║
-- ║  change required to complete the cross-DB owner link described in   ║
-- ║  docs/doctrine/adr-nex-cross-db-owner-link-2026-10-09.md             ║
-- ║  and docs/doctrine/owner-claim-architecture-complete-2026-10-10.md   ║
-- ║  §4.                                                                 ║
-- ║                                                                      ║
-- ║  This file MUST NOT be applied until:                                ║
-- ║    1. An operator has reviewed it against the runbook at             ║
-- ║       docs/doctrine/nex-cross-db-operator-runbook-2026-10-10.md      ║
-- ║    2. Explicit founder authorisation is recorded as part of the      ║
-- ║       Supabase migration log (operator captures reference).         ║
-- ║    3. A point-in-time Supabase snapshot has been taken.              ║
-- ║    4. Pre-migration validation probes (runbook §2) have all passed.  ║
-- ║                                                                      ║
-- ║  When the above is satisfied, the operator renames the file to the  ║
-- ║  next sequential migration number (e.g. 146_nex_business_canonical_  ║
-- ║  business_id.sql) and applies it via the normal Supabase migration   ║
-- ║  path. This WIP file itself is NOT applied — it exists purely as a   ║
-- ║  review artefact.                                                    ║
-- ║                                                                      ║
-- ║  Status           · DRAFT · requires operator review + founder sign  ║
-- ║  Target database  · Supabase Project B · ijvqdvsvwtwxzcqmoqit        ║
-- ║  Target table     · public.nex_business                              ║
-- ║  Author           · NEX Directory agent E (Cross-DB Operator Runbook) ║
-- ║  Date drafted     · 2026-10-10                                       ║
-- ║  NEX side counterpart · deploy/postgres/init/176_nex_business_claim. ║
-- ║                        sql (already applied in nex_dev)              ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- WHAT THIS MIGRATION DOES
--   Adds a nullable `canonical_business_id uuid` column to
--   `public.nex_business`. This column is a SOFT reference to
--   `nex.business_canonical.canonical_business_id` in NEX Postgres.
--
--   It is NOT a foreign key. The two databases are physically separate
--   (Supabase Project B vs NEX Postgres); PostgreSQL does not support
--   cross-cluster foreign keys. The cross-DB "contract" is maintained
--   by the application-layer reconciler at verify time plus a weekly
--   orphan sweep (see runbook §5 and §6).
--
--   The column is deliberately nullable. NULL means either:
--     (a) a legacy `nex_business` row created before cross-DB linking,
--     (b) an owner profile that has not yet claimed any canonical, or
--     (c) a canonical whose claim is still in draft / code_requested
--         state (i.e. not yet VERIFIED).
--
-- CONSTRAINTS
--   - NO foreign key (impossible across DB boundary — this is intentional).
--   - NO ON DELETE / ON UPDATE semantics (there is no referenced side).
--   - NO NOT NULL (NULL is a valid, documented state).
--   - UNIQUE partial index on non-null values prevents two
--     `nex_business` rows from claiming the same canonical.
--
-- IDEMPOTENCE
--   Both statements use `IF NOT EXISTS`. Running twice is a no-op.
--
-- DATA MUTATION
--   None. This migration is additive-only. Zero existing rows are
--   touched. All existing `nex_business` rows receive
--   `canonical_business_id = NULL`.
--
-- POST-APPLY VERIFICATION
--   See docs/doctrine/nex-cross-db-operator-runbook-2026-10-10.md §4.
--
-- ROLLBACK
--   See trailing comment block at the end of this file.

BEGIN;

ALTER TABLE public.nex_business
  ADD COLUMN IF NOT EXISTS canonical_business_id uuid;

COMMENT ON COLUMN public.nex_business.canonical_business_id IS
  'Cross-DB soft reference to nex.business_canonical.canonical_business_id (NEX Postgres). Not a hard FK — enforced by the reconciler service at verify time. See docs/doctrine/nex-cross-db-operator-runbook-2026-10-10.md.';

CREATE UNIQUE INDEX IF NOT EXISTS nex_business_canonical_business_id_uq
  ON public.nex_business (canonical_business_id)
  WHERE canonical_business_id IS NOT NULL;

COMMIT;

-- ──────────────────────────────────────────────────────────────────────
-- ROLLBACK (manual, operator-executed; see runbook §7)
--
-- Before rolling back, dump any rows with non-null canonical_business_id
-- to a scratch table so the information can be re-linked if the migration
-- is re-applied later:
--
--   -- Dump non-null links to a scratch table first (runbook §7):
--   CREATE TABLE IF NOT EXISTS public._nex_business_canonical_link_backup AS
--     SELECT id, owner_account_id, canonical_business_id, now() AS backed_up_at
--       FROM public.nex_business
--      WHERE canonical_business_id IS NOT NULL;
--
--   -- Then roll back the schema change:
--   BEGIN;
--   DROP INDEX IF EXISTS public.nex_business_canonical_business_id_uq;
--   ALTER TABLE public.nex_business DROP COLUMN IF EXISTS canonical_business_id;
--   COMMIT;
--
-- Rolling back AFTER the reconciler has started writing links WILL lose
-- those links from the live row unless the backup table is captured
-- first. Do not skip the backup step.
-- ──────────────────────────────────────────────────────────────────────
