-- 182_nex_source_registry_attribution_templates.sql
--
-- NEX Directory Canonical Spine · A-3 Phase 1 · attribution templates.
-- Phase-1 build authorised 2026-10-09.
--
-- WHAT THIS MIGRATION DOES
--   Sets `attribution_template` on sealed `nex.source_registry` seed rows
--   so publication of any canonical that cites them is unblocked by the
--   `ck_sr_attribution_template_present` CHECK added in migration 180
--   AND by the D-5 "attribution_template present" predicate in migration
--   181's `nex.business_directory_v`.
--
--   This migration does NOT flip `can_display`. Setting a template is a
--   necessary but not sufficient precondition for publication; the
--   `can_display` flip is a separate operator decision under A-3 Phase 2
--   authorisation.
--
-- PER-SOURCE DECISIONS (sealed by this file)
--
--   osm_overpass        · attribution_template =
--                         '© OpenStreetMap contributors (ODbL)'
--                         Per ODbL 1.0 §4.3 attribution clause.
--
--   wikidata            · attribution_template = NULL (CC0 1.0 is public
--                         domain · attribution_required = TRUE is set to
--                         FALSE by this migration to match the licence).
--
--   wikimedia_commons   · attribution_template = NULL BY DEFAULT because
--                         Commons licences vary PER FILE (CC-BY, CC-BY-SA,
--                         public domain, Fair Use, etc.) · a per-media
--                         attribution model is required and lives on the
--                         `nex.business_media` row, not on this blanket
--                         source template. attribution_required stays TRUE
--                         so the publication gate refuses any Commons
--                         evidence until per-media attribution is wired.
--
--   business_website    · attribution_template = NULL. Per-site attribution
--                         handling · the owner-upload flow should attach
--                         the specific site's required credit. Blanket
--                         template is wrong.
--
--   owner_upload        · attribution_required = FALSE (owner uploaded
--                         to NEX; NEX does not need to attribute).
--
--   user_upload         · attribution_required = TRUE until policy decides
--                         (default conservative) · template NULL blocks
--                         publication by design until policy signs off.
--
--   nex_food_business_legacy · attribution_required = FALSE (NEX-internal
--                         table; NEX does not need to attribute itself).
--
-- IDEMPOTENCE
--   Each UPDATE is guarded with `WHERE attribution_template IS NULL AND
--   source_id = <slug>` so re-running does not overwrite operator-adjusted
--   values. For the `attribution_required = FALSE` flips, the guard is
--   `WHERE source_id = <slug> AND attribution_required = TRUE`.
--
-- ROLLBACK (operational, not architectural)
--   BEGIN;
--     UPDATE nex.source_registry
--       SET attribution_template = NULL
--       WHERE source_id = 'osm_overpass';
--     UPDATE nex.source_registry
--       SET attribution_required = TRUE
--       WHERE source_id IN ('wikidata', 'owner_upload', 'nex_food_business_legacy');
--   COMMIT;
--
--   Rollback restores the migration-166 default of
--   `attribution_required = TRUE`. The sealed CHECK stays satisfied if
--   can_display remains FALSE (always true in the current state).
--
-- SAFE ON POPULATED DB
--   Yes. Per-source UPDATEs with explicit WHERE guards. No ALTERs, no
--   DROP, no GRANT/REVOKE. The sealed CHECK (migration 180) is already
--   defence-in-depth so a well-formed template cannot admit malformed
--   rows.
--
-- WHAT THIS MIGRATION IS NOT
--   · Not a can_display flip. Publication requires an admin UPDATE to
--     flip can_display per legal review (A-3 Phase 2).
--   · Not a licence policy decision. The licence slugs in the templates
--     are canonical (ODbL 1.0, CC0 1.0, CC-BY-SA 4.0) but the specific
--     text wording follows each licence's attribution clause.
--   · Not a per-media attribution writer. Commons / business_website
--     attribution lives on `nex.business_media.source_id` + the sibling
--     Commons media row's provenance.
--
-- NOT APPLIED
--   Phase 1 of the sealed architecture. MUST NOT be applied to any live
--   database without an explicit founder authorisation of the deployment
--   window. On a vanilla populated DB with ≥1 canonical citing
--   osm_overpass, this migration unblocks that canonical's publication
--   gate for D-5 (template present) but still requires A-3 Phase 2 to
--   flip can_display before any row actually appears in the view.

-- ═══════════════════════════════════════════════════════════════════
-- (1) · osm_overpass · ODbL 1.0 attribution
-- ═══════════════════════════════════════════════════════════════════

UPDATE nex.source_registry
   SET attribution_template = '© OpenStreetMap contributors (ODbL)'
 WHERE source_id = 'osm_overpass'
   AND attribution_template IS NULL;

-- ═══════════════════════════════════════════════════════════════════
-- (2) · wikidata · CC0 1.0 (public domain) · attribution not required
-- ═══════════════════════════════════════════════════════════════════

UPDATE nex.source_registry
   SET attribution_required = FALSE
 WHERE source_id = 'wikidata'
   AND attribution_required = TRUE;

-- ═══════════════════════════════════════════════════════════════════
-- (3) · owner_upload · NEX-received · attribution not required
-- ═══════════════════════════════════════════════════════════════════

UPDATE nex.source_registry
   SET attribution_required = FALSE
 WHERE source_id = 'owner_upload'
   AND attribution_required = TRUE;

-- ═══════════════════════════════════════════════════════════════════
-- (4) · nex_food_business_legacy · NEX-internal · attribution not required
-- ═══════════════════════════════════════════════════════════════════

UPDATE nex.source_registry
   SET attribution_required = FALSE
 WHERE source_id = 'nex_food_business_legacy'
   AND attribution_required = TRUE;

-- ═══════════════════════════════════════════════════════════════════
-- (5) · wikimedia_commons · attribution handled per-media
--      · intentionally no blanket template · attribution_required stays TRUE
--      · publication of commons-cited canonicals is blocked by D-5 until
--        a per-media attribution model is wired on business_media
-- ═══════════════════════════════════════════════════════════════════
--
-- No UPDATE here · the migration-166 default (template NULL, attribution_
-- required TRUE) is the correct state for Commons because file licences
-- vary. Documented for the operator and the next-wave author.

-- ═══════════════════════════════════════════════════════════════════
-- (6) · business_website / user_upload · same reasoning · no blanket
--      template · publication blocked until per-source model lands
-- ═══════════════════════════════════════════════════════════════════

-- No UPDATE. Documented.

-- ═══════════════════════════════════════════════════════════════════
-- End of migration 182.
--
-- Operator verification (expected result after apply):
--
--   SELECT source_id, attribution_required, attribution_template
--   FROM nex.source_registry
--   ORDER BY source_id;
--
-- Expected shape:
--   nex_food_business_legacy  | f | NULL
--   osm_overpass              | t | '© OpenStreetMap contributors (ODbL)'
--   owner_upload              | f | NULL
--   user_upload               | t | NULL
--   wikidata                  | f | NULL
--   wikimedia_commons         | t | NULL
--   business_website          | t | NULL
--
-- Downstream (182 does NOT ship these):
--   · A-3 Phase 2 can_display flip migration (separate authorisation
--     per source, pending legal review).
--   · Per-media attribution writer (business_media row attribution
--     resolution for Commons + business_website sources).
-- ═══════════════════════════════════════════════════════════════════
