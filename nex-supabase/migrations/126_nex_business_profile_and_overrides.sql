-- ============================================================================
-- NEX-native Migration 126 · Business Experience architecture · profile +
-- recommendation/override separation + documentary evidence + overrides
-- ============================================================================
--
-- Implements Revision 6 (FROZEN · founder-sealed 2026-10-02) of the NEX
-- Business Experience architecture: Profile → Recommendation → Owner
-- Configuration → Capability/Content/Trust → Terminology → CTA → Template
-- → Theme. Six prior design-review revisions landed in a frozen conceptual
-- model with two load-bearing principles:
--
--   1. Classification can influence the starting point. It can never
--      define the boundary of the system.
--   2. Recommendations may influence the starting configuration; they
--      must never become hidden permissions.
--
-- Every column added here stores OWNER STATE only. Recommendations live
-- entirely in code (src/lib/nex-native/business/) · recomputed on the fly
-- from the business's current primary + secondary profile. The DB never
-- stores a derivative of a recommendation.
--
-- Effective state is always computed, never stored:
--   effective[key] = owner_override[key] ?? recommendation[key] ?? default
--
-- This is how owner overrides survive subtype changes (per Rev 6 §5).
--
-- ---------------------------------------------------------------------------
-- Columns added · nex_business
-- ---------------------------------------------------------------------------
--
--   profile                   jsonb · { primary: {category, subtype},
--                                       secondary: [{category, subtype}, …] }
--
--                             The owner's business classification. Primary
--                             drives default template suggestion, default
--                             theme personality recommendation, primary
--                             terminology context, primary CTA suggestion.
--                             Secondary profiles ADD recommendations ·
--                             they NEVER partition the NEX into mini-NEXes.
--
--   capability_overrides      jsonb · { capability_key: boolean, … }
--
--                             Owner's EXPLICIT capability choices. Only
--                             keys the owner has touched appear here.
--                             Keys not present fall through to the
--                             subtype recommendation layer in code.
--                             Changing subtype never alters this blob.
--
--   content_overrides         jsonb · { content_type_key: boolean, … }
--
--                             Owner's EXPLICIT content-type enable/disable
--                             choices. Same resolution model as capability
--                             overrides. Universal content catalog remains
--                             AVAILABLE regardless of this blob; this blob
--                             sets which types are currently ENABLED
--                             (surfaced on the cover + editable).
--
--   terminology_overrides     jsonb · { "<context>.<concept>": { en, id },
--                                       … }
--
--                             Owner's EXPLICIT terminology overrides.
--                             Keyed as "context.concept" (e.g.
--                             "accommodation.booking", "restaurant.order").
--                             Values localized {en, id}; new locales add
--                             fields without a migration.
--
--   documentary_evidence      jsonb · { <evidence_key>: { status, data },
--                                       … }
--
--                             Documentary evidence per Rev 6 §6a. Each
--                             entry carries a status on the epistemic
--                             ladder (unknown · self_declared · verified
--                             · expired · not_applicable) plus the
--                             evidence item's own data payload. Trust
--                             signals (portfolio, testimonials, reviews)
--                             are NOT stored here · they live in their
--                             own content tables and are read as
--                             presence-model signals.
--
--   cta_preference            text · nullable
--
--                             Owner's PREFERRED primary CTA intent. One
--                             of: order, book, appointment, reserve,
--                             enquire, quote, callback, buy. Resolution
--                             still feasibility-checks before returning
--                             (Rev 6 §12). A preference that cannot
--                             semantically complete falls through.
--
-- ---------------------------------------------------------------------------
-- What this migration does NOT add
-- ---------------------------------------------------------------------------
--
-- NEW CONTENT TABLES (nex_service, nex_accommodation_unit, nex_property_
-- listing, nex_portfolio_item, nex_offer, nex_testimonial) land in their
-- OWN migrations as each content type is implemented. This migration is
-- the Phase 1 foundation only · the owner-state surface area + the
-- separation of recommendation (code) from override (DB).
--
-- The validation sequence (Rev 6 §19) runs against the engine first:
--   categories/subtypes/capabilities/content catalogs defined in code,
--   engine functions produce correct effective state across the 15 daily
--   -business scenarios, no leakage of recommendation into permission.
--
-- ---------------------------------------------------------------------------
-- Rollback (destructive · never run in production without founder approval)
-- ---------------------------------------------------------------------------
--
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '126';
--     ALTER TABLE nex_business
--       DROP COLUMN cta_preference,
--       DROP COLUMN documentary_evidence,
--       DROP COLUMN terminology_overrides,
--       DROP COLUMN content_overrides,
--       DROP COLUMN capability_overrides,
--       DROP COLUMN profile;
--   COMMIT;
--
-- ============================================================================

BEGIN;

ALTER TABLE nex_business
  ADD COLUMN IF NOT EXISTS profile               jsonb,
  ADD COLUMN IF NOT EXISTS capability_overrides  jsonb,
  ADD COLUMN IF NOT EXISTS content_overrides     jsonb,
  ADD COLUMN IF NOT EXISTS terminology_overrides jsonb,
  ADD COLUMN IF NOT EXISTS documentary_evidence  jsonb,
  ADD COLUMN IF NOT EXISTS cta_preference        text;

-- Narrow CHECK on cta_preference · prevents mistyped intents landing
-- as effective CTA (resolver falls through if present but infeasible).
ALTER TABLE nex_business
  DROP CONSTRAINT IF EXISTS nex_business_cta_preference_check;

ALTER TABLE nex_business
  ADD CONSTRAINT nex_business_cta_preference_check
  CHECK (
    cta_preference IS NULL OR cta_preference IN (
      'order', 'book', 'appointment', 'reserve',
      'enquire', 'quote', 'callback', 'buy'
    )
  );

-- Shape invariants for the jsonb columns · relaxed JSON object/array
-- checks so the engine can trust the shape without validating per row.
-- Deep-shape validation (e.g. that profile.primary has category + subtype)
-- lives in the engine, not in the DB.
ALTER TABLE nex_business
  DROP CONSTRAINT IF EXISTS nex_business_profile_shape_check,
  DROP CONSTRAINT IF EXISTS nex_business_capability_overrides_shape_check,
  DROP CONSTRAINT IF EXISTS nex_business_content_overrides_shape_check,
  DROP CONSTRAINT IF EXISTS nex_business_terminology_overrides_shape_check,
  DROP CONSTRAINT IF EXISTS nex_business_documentary_evidence_shape_check;

ALTER TABLE nex_business
  ADD CONSTRAINT nex_business_profile_shape_check
    CHECK (profile IS NULL OR jsonb_typeof(profile) = 'object'),
  ADD CONSTRAINT nex_business_capability_overrides_shape_check
    CHECK (capability_overrides IS NULL OR jsonb_typeof(capability_overrides) = 'object'),
  ADD CONSTRAINT nex_business_content_overrides_shape_check
    CHECK (content_overrides IS NULL OR jsonb_typeof(content_overrides) = 'object'),
  ADD CONSTRAINT nex_business_terminology_overrides_shape_check
    CHECK (terminology_overrides IS NULL OR jsonb_typeof(terminology_overrides) = 'object'),
  ADD CONSTRAINT nex_business_documentary_evidence_shape_check
    CHECK (documentary_evidence IS NULL OR jsonb_typeof(documentary_evidence) = 'object');

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '126',
    'NEX Business Experience architecture (Rev 6 FROZEN) · owner-state surface area · profile + overrides + documentary_evidence + cta_preference',
    'Founder-sealed 2026-10-02 after six design-review revisions. Columns store OWNER STATE only; recommendations live in code at src/lib/nex-native/business/. Effective state is always computed, never persisted. New content tables (service, accommodation_unit, property_listing, portfolio_item, offer, testimonial) land in subsequent migrations as each content type is implemented.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT column_name, data_type
--     FROM information_schema.columns
--    WHERE table_name = 'nex_business'
--      AND column_name IN ('profile','capability_overrides','content_overrides',
--                          'terminology_overrides','documentary_evidence','cta_preference');
