-- 192_nex_osm_odbl_attribution_template.sql
--
-- NEX Directory · Accommodation Clearance Prep · F3 wave · 2026-10-10.
--
-- WHAT THIS MIGRATION DOES
--   Creates `nex.attribution_template` — a reviewable catalog of
--   candidate attribution strings for data sources that have not yet
--   had their `source_registry.attribution_template` column
--   authoritatively set. Seeds four initial template rows describing
--   OpenStreetMap-derived content under the Open Database License.
--
--   Every row is seeded with `simulated = TRUE`. A future migration
--   (or an admin UPDATE after legal review) flips `simulated = FALSE`
--   on the templates the founder has signed off on. Only non-simulated
--   templates may be referenced when an operator writes
--   `nex.source_registry.attribution_template` and flips `can_display`.
--
-- WHY A SEPARATE CATALOG (NOT A COLUMN ON source_registry)
--   `nex.source_registry.attribution_template` is a free-text column
--   that, once set, is immediately usable by the sealed publication
--   view (migration 181). There is no "pending review" state on that
--   column — any non-blank value admits publication. The founder's
--   doctrine for F3 explicitly asks for a reviewable layer separate
--   from the live source_registry column so that:
--
--     (a) Candidate attribution strings can be drafted, reviewed, and
--         amended without ever being visible to the publication gate.
--     (b) The `simulated` flag can be flipped per template as legal
--         review completes, with no risk of inadvertently publishing
--         a row that cites an unapproved attribution.
--     (c) The catalog can hold multiple candidate wordings for the
--         same source (e.g. short vs long form) that a future operator
--         decision picks between.
--
--   The sealed `source_registry.attribution_template` column stays
--   authoritative for the publication gate. Migration 192 does NOT
--   touch any `source_registry` row. The catalog here is a review
--   staging ground, not a parallel enforcement surface.
--
-- SEEDED TEMPLATES
--   osm_odbl_v1                      · ODbL · short form
--     "© OpenStreetMap contributors"
--   osm_cc_by_sa_v1                  · legacy CC-BY-SA 2.0 OSM content
--     "© OpenStreetMap contributors (CC-BY-SA 2.0 legacy)"
--   openstreetmap_contributor_v2     · current OSMF-preferred wording
--     "© OpenStreetMap contributors (openstreetmap.org/copyright)"
--   osm_derived_via_overpass_v1      · Overpass-enriched · reduced-field
--     "Derived from OpenStreetMap (ODbL) via Overpass · reduced-field distribution"
--
-- WHAT THIS MIGRATION IS NOT
--   · Not a `source_registry.attribution_template` write. ZERO
--     UPDATEs on nex.source_registry. Confirmed by text absence of
--     `UPDATE nex.source_registry` in this migration (operator and
--     structural test both verify).
--   · Not a `can_display` flip. ZERO flips of any policy flag in
--     source_registry. The accommodation source stays at the
--     migration-185 state (can_display = FALSE).
--   · Not a FK target. Migration 192 does NOT add a FK from
--     source_registry.attribution_template or any other column into
--     this catalog. The catalog is a free-standing operator-facing
--     review surface.
--   · Not a GRANT or REVOKE. DP-3 lockdown is a separate wave.
--   · Not a lifecycle promotion. Migration 192 touches no row in
--     business_canonical, business_evidence, or any legacy table.
--
-- IDEMPOTENCY
--   CREATE TABLE IF NOT EXISTS + INSERT ... ON CONFLICT (template_id)
--   DO NOTHING. Safe to re-apply. A pre-existing row with any of the
--   four template_ids is left untouched (never overwrites admin edits).
--
-- ROLLBACK
--   DROP TABLE nex.attribution_template;
--   (No downstream FK dependencies by design.)
--
-- SAFE ON POPULATED DB
--   Yes. Pure CREATE TABLE + INSERT ON CONFLICT DO NOTHING in the new
--   catalog. No ALTERs on any existing table. No DML on any existing
--   row. The sealed publication path is unchanged by this migration.
--
-- NOT AUTO-APPLIED
--   Per the sealed migration discipline, `deploy/postgres/init/*.sql`
--   files are explicit manual-apply scripts, not an auto-run chain.
--   This migration is applied by the operator via
--   `scripts/nex-canonical/_apply-migration-192.mjs --apply` after
--   verifying session identity (`current_database() = 'nex_dev'`).

CREATE SCHEMA IF NOT EXISTS nex;

-- ═══════════════════════════════════════════════════════════════════
-- attribution_template · reviewable catalog of candidate strings
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS nex.attribution_template (
  template_id       text        PRIMARY KEY,            -- slug · stable identifier
  display_short     text        NOT NULL,               -- short-form credit (e.g. "© OpenStreetMap contributors")
  display_long      text        NOT NULL,               -- long-form credit for about / credits pages
  license_name      text        NOT NULL,               -- human-readable licence name (e.g. "Open Database License 1.0")
  license_url       text        NOT NULL,               -- canonical licence URL
  required_fields   jsonb       NOT NULL,               -- array of fields the renderer must substitute (e.g. ["source_reference"])
  simulated         boolean     NOT NULL DEFAULT TRUE,  -- TRUE until founder signs off wording · FALSE unlocks production use
  created_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE nex.attribution_template IS
  'Reviewable catalog of candidate attribution strings (migration 192). Separate from `source_registry.attribution_template` which is the authoritative column read by the sealed publication view. Rows seeded with `simulated = TRUE`; a future admin UPDATE flips `simulated = FALSE` as legal review completes per template. The catalog does NOT drive publication; it is operator-facing staging only.';

COMMENT ON COLUMN nex.attribution_template.simulated IS
  'TRUE while the wording is a draft awaiting founder / legal sign-off. FALSE once approved. Only templates where simulated = FALSE may be copied into source_registry.attribution_template by the operator.';

-- Lookup index on simulated so operator queries ("show me approved
-- templates") remain cheap as the catalog grows.
CREATE INDEX IF NOT EXISTS idx_nex_at_simulated
  ON nex.attribution_template (simulated);

-- ═══════════════════════════════════════════════════════════════════
-- Seed · four OSM-derived candidate attribution templates
-- All simulated = TRUE · operator-reviewable · not yet production
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO nex.attribution_template (
  template_id,
  display_short,
  display_long,
  license_name,
  license_url,
  required_fields,
  simulated
)
VALUES
  (
    'osm_odbl_v1',
    '© OpenStreetMap contributors',
    'Business data © OpenStreetMap contributors, released under the Open Database License (ODbL) 1.0.',
    'Open Database License 1.0',
    'https://opendatacommons.org/licenses/odbl/1-0/',
    '[]'::jsonb,
    TRUE
  ),
  (
    'osm_cc_by_sa_v1',
    '© OpenStreetMap contributors (CC-BY-SA 2.0 legacy)',
    'Legacy OpenStreetMap data (pre-2012-09-12) released under Creative Commons Attribution-ShareAlike 2.0. Attribution to OpenStreetMap contributors required.',
    'Creative Commons Attribution-ShareAlike 2.0',
    'https://creativecommons.org/licenses/by-sa/2.0/',
    '[]'::jsonb,
    TRUE
  ),
  (
    'openstreetmap_contributor_v2',
    '© OpenStreetMap contributors',
    'Business data © OpenStreetMap contributors. See https://www.openstreetmap.org/copyright for licence details.',
    'OpenStreetMap Foundation attribution guidance',
    'https://www.openstreetmap.org/copyright',
    '[]'::jsonb,
    TRUE
  ),
  (
    'osm_derived_via_overpass_v1',
    'Derived from OpenStreetMap contributors (ODbL)',
    'Data derived from OpenStreetMap contributors via the Overpass API, released under the Open Database License (ODbL) 1.0. Reduced-field distribution — see record for the specific OSM reference.',
    'Open Database License 1.0',
    'https://opendatacommons.org/licenses/odbl/1-0/',
    '["source_reference"]'::jsonb,
    TRUE
  )
ON CONFLICT (template_id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════
-- End of migration 192.
--
-- Verification (operator runs this after apply):
--
--   SELECT template_id, simulated, license_name
--   FROM nex.attribution_template
--   ORDER BY template_id;
--
-- Expected shape (exactly four rows, every row simulated = TRUE):
--   openstreetmap_contributor_v2  | t | OpenStreetMap Foundation attribution guidance
--   osm_cc_by_sa_v1               | t | Creative Commons Attribution-ShareAlike 2.0
--   osm_derived_via_overpass_v1   | t | Open Database License 1.0
--   osm_odbl_v1                   | t | Open Database License 1.0
--
-- Downstream (192 does NOT ship these):
--   · Admin UPDATE flipping `simulated = FALSE` on approved templates
--     (separate operator action after founder sign-off on wording).
--   · Admin UPDATE copying an approved `display_short` into
--     `nex.source_registry.attribution_template` for a specific source
--     (separate operator action per source).
--   · Admin UPDATE flipping `nex.source_registry.can_display = TRUE`
--     for accommodation / service / transport / mp_seller (separate
--     wave per vertical, per the clearance paths doctrine).
-- ═══════════════════════════════════════════════════════════════════
