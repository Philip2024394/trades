-- 187_nex_source_registry_legacy_mp_seller.sql
--
-- NEX Canonical · seed `nex_mp_seller_legacy` into
-- `nex.source_registry` (the sealed source-registry table from
-- migration 166).
--
-- WHY · WHAT · HOW TO APPLY
-- -------------------------
-- The legacy table `nex.mp_seller` carries NEX's marketplace-seller
-- vertical · the LARGEST single legacy vertical with 23,580 live
-- rows in nex_dev as of 2026-10-09 (more rows than food_business).
-- The sealed source-adapter module
-- `scripts/nex-canonical/source-legacy-mp-seller.ts` already declares:
--
--     export const LEGACY_MP_SELLER_SOURCE_ID = "nex_mp_seller_legacy"
--
-- Downstream enforcement — specifically the FK `fk_be_source` on
-- `nex.business_evidence(source_id)` added by migration 170 — refuses
-- any evidence insert whose cited `source_id` is not present in
-- `nex.source_registry`. The sealed canonical write path also refuses
-- to proceed when the registry row carries `can_derive = false` (see
-- `scripts/nex-canonical/canonical-handoff.ts`).
--
-- This migration adds the missing row so the sealed directory-
-- ingestion pipeline (candidate generation → founder approval →
-- canonical write) has a legitimate registry anchor for every real
-- row it ingests from `nex.mp_seller`.
--
-- Operator decision pinned by this migration
--   can_derive = TRUE. Reason: the legacy `nex.mp_seller` table is
--   owned by NEX and the derivation (projecting into the sealed
--   business_canonical + business_evidence primitives) is NEX's own
--   downstream transformation of its own data. Per migration 166's
--   SAFETY POSTURE comment, flipping `can_derive` away from its
--   restrictive default is an "admin UPDATE after legal review"
--   action — recorded here, in source control, so the operator
--   decision is auditable rather than ad-hoc psql.
--
-- The other policy flags stay at their migration-166 defaults:
--   can_collect           = TRUE   (safe · we already own this data)
--   can_store             = TRUE   (safe · already stored in NEX DB)
--   can_display           = FALSE  (publication is a downstream
--                                   lifecycle_state decision · not a
--                                   registry-wide blanket. NO
--                                   can_display source is currently
--                                   cleared for marketplace sellers)
--   can_redistribute      = FALSE  (internal NEX data · no third-
--                                   party redistribution authorised)
--   attribution_required  = TRUE   (user-generated seller content may
--                                   still need NEX credit; admin may
--                                   adjust later)
--
-- Honest-null fields:
--   licence_id            = NULL   (same deferral posture as every
--                                   migration-166 seed row · formal
--                                   licence-identifier management
--                                   awaits a separate registry audit)
--   attribution_template  = NULL   (admin writes the exact string
--                                   later if required)
--   rate_limit_rps        = NULL   (not applicable · internal DB
--                                   read · no network rate limit)
--   base_host             = NULL   (not applicable · no external
--                                   HTTP host)
--
-- IDEMPOTENCY
--   INSERT ... ON CONFLICT (source_id) DO NOTHING. Safe to re-apply.
--   A pre-existing row with id `nex_mp_seller_legacy` is left
--   untouched; this migration never overwrites prior admin state.
--   The verification step (SELECT after apply) is where the operator
--   confirms the resulting shape matches intent.
--
-- RELATION TO OTHER mp_seller SOURCE_IDs
--   `nex.mp_seller` carries a `source_id text` column (added by a
--   prior migration) that is FKed to `nex.source_registry` on
--   ON DELETE SET NULL. Existing per-row `source_id` values (e.g.
--   crawl-specific slugs populated by the walker) stay untouched by
--   this migration · this row is the vertical-level anchor the
--   canonical pipeline uses when projecting the legacy rows into
--   `nex.business_canonical` / `nex.business_evidence`.
--
-- ROLLBACK
--   DELETE FROM nex.source_registry
--     WHERE source_id = 'nex_mp_seller_legacy';
--   Safe when no business_evidence or business_media row references
--   this source_id yet. Downstream FKs are RESTRICT by default; the
--   DELETE will refuse itself if any dependent rows exist.
--
-- SAFE ON POPULATED DB
--   Yes. Pure INSERT with ON CONFLICT DO NOTHING on a seed row. No
--   ALTERs, no GRANT/REVOKE, no DML on any other row.
--
-- NOT AUTO-APPLIED
--   Per the sealed migration discipline, `deploy/postgres/init/*.sql`
--   files are explicit manual-apply scripts, not an auto-run chain.
--   This migration is applied by the operator when authorised and
--   verified by the SELECT at the end of this comment block.

INSERT INTO nex.source_registry (
  source_id,
  source_type,
  display_name,
  can_derive
)
VALUES (
  'nex_mp_seller_legacy',
  'directory_import',
  'NEX Marketplace Seller (legacy table)',
  TRUE
)
ON CONFLICT (source_id) DO NOTHING;

-- End of migration 187.
--
-- Verification (operator runs this after apply):
--
--   SELECT source_id, source_type, can_derive, can_display,
--          can_redistribute, attribution_required
--   FROM nex.source_registry
--   WHERE source_id = 'nex_mp_seller_legacy';
--
-- Expected: exactly one row with can_derive=t, can_display=f,
--           can_redistribute=f, attribution_required=t.
