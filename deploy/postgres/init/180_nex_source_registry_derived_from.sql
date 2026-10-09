-- 180_nex_source_registry_derived_from.sql
--
-- NEX Canonical · Directory Publication Gate · A-2 Phase 1 of 2.
--
-- EXTENDS `nex.source_registry` (migration 166) with:
--   (1) `derived_from_source_id` — the sealed one-hop provenance chain
--       pointer. When set, declares "this source is a NEX-internal
--       collection layer that fetches from the pointed-to origin
--       source". The licensing-origin's attribution and permission
--       govern downstream display, not the derivative's.
--   (2) `ck_sr_attribution_template_present` — the sealed fail-closed
--       CHECK that refuses any source carrying can_display = TRUE +
--       attribution_required = TRUE + a missing/blank
--       attribution_template.
--
-- Founder decisions sealed in this migration (A-1, 2026-10-09):
--   D-A8 · M-2 provenance model (one hop, admin-path enforced).
--   D-A9 · DB-level CHECK on source_registry.
--
-- WHAT THIS MIGRATION IS NOT
--   · Not a value-write. ZERO row INSERT / UPDATE / DELETE. The new
--     column is added NULL on every existing row; the operator sets
--     a value per source in a separate A-3 authorised wave.
--   · Not a `can_display` flip. Every source remains at its sealed
--     migration-166 default (`can_display = FALSE`) after apply.
--   · Not a view authoring. The sibling attribution view lives in
--     migration 181.
--   · Not an attribution_template write. The CHECK is additive · it
--     refuses operator mistakes at write time, but zero existing rows
--     violate it (every row has can_display = FALSE, so the first
--     disjunct of the CHECK is TRUE for every row).
--   · Not a GRANT or REVOKE. DP-3 is a separate wave.
--
-- SEALED ONE-HOP INVARIANT (D-A8 · documented, not DB-enforced)
--
--   Every source_registry row either:
--     (a) `derived_from_source_id IS NULL` and is itself the
--         licensing origin, OR
--     (b) `derived_from_source_id` points at a row whose own
--         `derived_from_source_id IS NULL`.
--
--   Equivalently: a derivative's parent must be an origin. There is
--   no second-level derivation. If NEX ever needs an intermediate
--   collection layer that itself derives from another NEX
--   intermediate, the correct action is to flatten the chain at
--   migration time, not deepen it.
--
--   Enforcement discipline (per founder decision D-A8):
--     · Sealed documentation (this comment block).
--     · The sealed admin UPDATE path (authored in A-3 or later) must
--       validate the parent is an origin before accepting any
--       `derived_from_source_id` write. The admin surface does not
--       exist in A-2 · no value is ever written here, so no runtime
--       enforcement is required by A-2.
--     · Postgres CHECK constraints cannot subquery · a trigger would
--       work but is explicitly out of scope for A-2 per the
--       smallest-correct discipline.
--
-- IDEMPOTENCY
--   `ADD COLUMN IF NOT EXISTS`.
--   DO-block pattern for FK + CHECK · existence-guarded. Safe to
--   re-run.
--
-- ROLLBACK (admin discretion · operational, not architectural)
--   ALTER TABLE nex.source_registry
--     DROP CONSTRAINT IF EXISTS ck_sr_attribution_template_present,
--     DROP CONSTRAINT IF EXISTS fk_sr_derived_from,
--     DROP COLUMN IF EXISTS derived_from_source_id;
--
-- SAFE ON POPULATED DB
--   Yes. New nullable column + two additive constraints. No ALTERs
--   to data. The CHECK does not fire against any existing row
--   (every row has can_display = FALSE after migration 166 + 179).

-- ═══════════════════════════════════════════════════════════════════
-- (1) · derived_from_source_id column + self-FK
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE nex.source_registry
  ADD COLUMN IF NOT EXISTS derived_from_source_id text NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_sr_derived_from'
      AND conrelid = 'nex.source_registry'::regclass
  ) THEN
    ALTER TABLE nex.source_registry
      ADD CONSTRAINT fk_sr_derived_from
      FOREIGN KEY (derived_from_source_id)
      REFERENCES nex.source_registry (source_id);
  END IF;
END$$;

COMMENT ON COLUMN nex.source_registry.derived_from_source_id IS
  'Sealed one-hop provenance chain pointer (migration 180). NULL means this source is itself the licensing origin. When set, this source is a NEX-internal collection layer and its licensing attribution flows from the pointed-to origin. Admin-path validation must ensure the pointed-to row is itself an origin (derived_from_source_id IS NULL on the parent) · the one-hop invariant is sealed in migration 180''s header.';

-- ═══════════════════════════════════════════════════════════════════
-- (2) · attribution-template-present CHECK (D-A9 · fail-closed)
-- ═══════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_sr_attribution_template_present'
      AND conrelid = 'nex.source_registry'::regclass
  ) THEN
    ALTER TABLE nex.source_registry
      ADD CONSTRAINT ck_sr_attribution_template_present
      CHECK (
        can_display = FALSE
        OR attribution_required = FALSE
        OR length(trim(coalesce(attribution_template, ''))) > 0
      );
  END IF;
END$$;

-- Equivalent logical statement:
--   For any source where can_display is TRUE AND attribution_required
--   is TRUE, attribution_template MUST be present and non-blank.
--   Otherwise the row is refused at write time.
--   The admin UPDATE path (A-3) that flips can_display from FALSE to
--   TRUE must therefore ensure attribution_template is set in the
--   same statement or in a prior statement.

-- ═══════════════════════════════════════════════════════════════════
-- End of migration 180.
--
-- Downstream (180 does NOT ship):
--   181 · nex.business_directory_v · CREATE OR REPLACE VIEW with
--         chain-aware attribution predicate (A-2 Phase 2 of 2).
--   181 · nex.business_directory_attribution_v · sibling view.
--
-- Downstream (deferred to A-3, separate authorisation):
--   Admin UPDATE path that writes attribution_template per source
--   and (optionally, after legal review) flips can_display = TRUE.
--   No value is written by this A-2 wave.
-- ═══════════════════════════════════════════════════════════════════
