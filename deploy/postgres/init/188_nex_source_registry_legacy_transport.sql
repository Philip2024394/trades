-- 188_nex_source_registry_legacy_transport.sql
--
-- NEX Canonical · seed `nex_transport_acquisition_legacy` into
-- `nex.source_registry` (the sealed source-registry table from
-- migration 166).
--
-- WHY · WHAT · HOW TO APPLY
-- -------------------------
-- The legacy table `nex.transport_acquisition_record` carries NEX's
-- real transport-provider acquisition rows (107 live rows at authoring
-- time; 105 route to entity_type='transport_operator' and 0 to
-- 'transport_driver' under the sealed Rule 5l routing · 2 rows with
-- provider_kind='unknown' are quarantined). The sealed source-adapter
-- module `scripts/nex-canonical/source-legacy-transport.ts` already
-- declares:
--
--   export const LEGACY_TRANSPORT_SOURCE_ID =
--     "nex_transport_acquisition_legacy"
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
-- row it ingests from `nex.transport_acquisition_record`.
--
-- Operator decision pinned by this migration
--   can_derive = TRUE. Reason: the legacy
--   `nex.transport_acquisition_record` table is owned by NEX and the
--   derivation (projecting into the sealed business_canonical +
--   business_evidence primitives) is NEX's own downstream
--   transformation of its own data. Per migration 166's SAFETY
--   POSTURE comment, flipping `can_derive` away from its restrictive
--   default is an "admin UPDATE after legal review" action — recorded
--   here, in source control, so the operator decision is auditable
--   rather than ad-hoc psql.
--
-- The other policy flags stay at their migration-166 defaults:
--   can_collect           = TRUE   (safe · we already own this data)
--   can_store             = TRUE   (safe · already stored in NEX DB)
--   can_display           = FALSE  (publication is a downstream
--                                   lifecycle_state decision · not a
--                                   registry-wide blanket. Transport
--                                   publication additionally depends
--                                   on the migration-091 legal model
--                                   being `approved` for the
--                                   jurisdiction · see
--                                   nex.transport_legal_model.)
--   can_redistribute      = FALSE  (internal NEX data · no third-
--                                   party redistribution authorised)
--   attribution_required  = TRUE   (user-generated acquisition data
--                                   may still require NEX credit;
--                                   admin may adjust later)
--
-- PDP / migration 091 relationship (why can_display stays FALSE)
--   `nex.transport_acquisition_record` can carry natural-person
--   signals via `contact_person_name`. Migration 091 is the sealed
--   legal boundary for transport in Indonesia and requires that
--   driver personal data be processed only under a stated PDP
--   purpose with a recorded lawful basis. The adapter itself refuses
--   to promote a bare `contact_person_name` to the canonical
--   `name_canonical` (business_name is required). Leaving
--   `can_display = FALSE` on this source_id gives a second,
--   registry-level, backstop · publication requires an explicit
--   downstream decision that confirms migration 091's conditions
--   are met for the jurisdiction.
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
--   A pre-existing row with id `nex_transport_acquisition_legacy` is
--   left untouched; this migration never overwrites prior admin
--   state. The verification step (SELECT after apply) is where the
--   operator confirms the resulting shape matches intent.
--
-- ROLLBACK
--   DELETE FROM nex.source_registry
--     WHERE source_id = 'nex_transport_acquisition_legacy';
--   Safe when no business_evidence or business_media row references
--   this source_id yet. Downstream FKs are RESTRICT by default; the
--   DELETE will refuse itself if any dependent rows exist. Note that
--   `nex.transport_acquisition_record(source_id)` has
--   `ON DELETE SET NULL`, so acquisition rows referencing this
--   registry id would be unlinked, not blocked.
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
  'nex_transport_acquisition_legacy',
  'directory_import',
  'NEX Transport Acquisition (legacy table)',
  TRUE
)
ON CONFLICT (source_id) DO NOTHING;

-- End of migration 188.
--
-- Verification (operator runs this after apply):
--
--   SELECT source_id, source_type, can_derive, can_display,
--          can_redistribute, attribution_required
--   FROM nex.source_registry
--   WHERE source_id = 'nex_transport_acquisition_legacy';
--
-- Expected: exactly one row with can_derive=t, can_display=f,
--           can_redistribute=f, attribution_required=t.
