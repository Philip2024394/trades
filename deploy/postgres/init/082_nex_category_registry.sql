-- 082_nex_category_registry.sql
--
-- Directory Factory · Phase 0 · 2026-08-23
-- Registry-to-DB migration. Creates nex.category_registry as the DB
-- source of truth for NEX categories and seeds it with the 10 current
-- TypeScript CATEGORY_REGISTRY entries + 3 thin trade rows.
--
-- Phase 0 is INTENTIONALLY BEHAVIOUR-PRESERVING. Runtime consumers
-- (helpers in src/lib/nex/category-registry.ts) still read from the TS
-- constant. The DB table exists in parallel · a validator (added in
-- this phase) enforces they match at startup. Consumers move to DB in
-- a later phase.
--
-- Doctrine anchors:
--   project_nex_directory_factory_doctrine_2026_08_22        (Decisions 1-13, Phase 0 gate)
--   project_nex_country_scope_from_phone_country_code_2026_08_22 (country is foundational)
--   project_nex_truth_invariant_2026_08_22                   (never claim inventory that isn't there)
--   project_nex_walker_stays_pure_acquisition_2026_08_22    (Walker cannot INSERT here)
--   project_nex_universal_directory_image_doctrine_2026_08_22 (Image Phase 1 already shipped)
--
-- Design decisions locked in the approved Phase 0 plan:
--   D1 · Two-tier trade merge (thin rows for staircase-refacing /
--        staircase-manufacture / kitchens · extended semantics stay
--        in src/lib/nex/centre-publishing/tradeCategoryRegistry.ts).
--   D2 · Country CHECK whitelist (ID GB US MY SG TH VN PH AU NZ) ·
--        expandable via future migration.
--   D6 · Migration numbering 082 (verified free 2026-08-23).
--   D10 · Trade route paths preserved verbatim in the seed.
--
-- Idempotent · rollback path documented at the bottom.
-- Zero user-facing effect on ship (TS constant still authoritative).

BEGIN;

-- ── 1 · TABLE ─────────────────────────────────────────────────────
--
-- NOTE: origin_candidate_id FK to nex.category_candidate is added in
-- migration 083 (after that table exists · avoids circular reference
-- in a single migration).
CREATE TABLE IF NOT EXISTS nex.category_registry (
    id                   text PRIMARY KEY
                         CHECK (id ~ '^[a-z][a-z0-9-]*$'),

    parent_vertical      text NOT NULL
                         CHECK (parent_vertical IN
                            ('food','accommodation','rentals','services','tourism')),

    display_name_en      text NOT NULL,
    display_name_id      text NOT NULL,

    icon                 text,                       -- emoji · legacy compat
    visual_glyph         text NOT NULL,              -- lucide-react export name
    visual_family        text,                       -- optional grouping token

    -- Route CHECK is a shape guard (leading slash · URL-safe chars) rather
    -- than a full URL validator. Uppercase permitted for legacy trade
    -- route query params (e.g. /nex-app/centre?category=Staircase+Manufacture).
    route                text NOT NULL UNIQUE
                         CHECK (route ~ '^/[a-zA-Z][a-zA-Z0-9?=+&/_.:%-]*$'),

    active               boolean NOT NULL DEFAULT false,

    brain_keywords       jsonb NOT NULL DEFAULT '[]'::jsonb
                         CHECK (jsonb_typeof(brain_keywords) = 'array'),

    countries            text[] NOT NULL
                         CHECK (
                           array_length(countries, 1) >= 1
                           AND countries <@ ARRAY['ID','GB','US','MY','SG','TH','VN','PH','AU','NZ']::text[]
                         ),

    business_table       text,
    category_filter      text,

    schema_version       text NOT NULL DEFAULT 'v1',
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now(),
    activated_at         timestamptz,
    activated_by         text,

    origin_candidate_id  uuid            -- FK added in migration 083
);

CREATE INDEX IF NOT EXISTS category_registry_parent_vertical_idx
    ON nex.category_registry (parent_vertical);

CREATE INDEX IF NOT EXISTS category_registry_active_idx
    ON nex.category_registry (active) WHERE active = true;

CREATE INDEX IF NOT EXISTS category_registry_countries_gin_idx
    ON nex.category_registry USING GIN (countries);

-- ── 2 · SEED · 10 general rows (verbatim from TS CATEGORY_REGISTRY) ──
-- Idempotent · ON CONFLICT DO NOTHING · re-runs are safe.

INSERT INTO nex.category_registry
    (id, parent_vertical, display_name_en, display_name_id, icon, visual_glyph, visual_family,
     route, active, brain_keywords, countries, business_table, category_filter)
VALUES
    ('food', 'food', 'Food', 'Makanan', '🍜', 'Utensils', 'food',
     '/food', true,
     '["food","makanan","restaurant","restoran","eat","makan"]'::jsonb,
     ARRAY['ID'], 'nex.food_business', NULL),

    ('accommodation', 'accommodation', 'Accommodation', 'Penginapan', '🏨', 'Bed', 'accommodation',
     '/accommodation', true,
     '["accommodation","penginapan","stay","menginap","tempat menginap","where to stay","somewhere to stay"]'::jsonb,
     ARRAY['ID'], 'nex.accommodation_business', NULL),

    ('hotel', 'accommodation', 'Hotel', 'Hotel', '🏨', 'Hotel', 'accommodation',
     '/hotel', true,
     '["hotel","hotels","cheap hotel","boutique hotel"]'::jsonb,
     ARRAY['ID'], 'nex.accommodation_business', 'category=''hotel'''),

    ('villa', 'accommodation', 'Villa', 'Villa', '🏡', 'Palmtree', 'accommodation',
     '/villa', false,
     '["villa","villas","private villa","family villa"]'::jsonb,
     ARRAY['ID'], 'nex.accommodation_business', 'category=''villa'''),

    ('guesthouse', 'accommodation', 'Guesthouse', 'Wisma', '🏠', 'Home', 'accommodation',
     '/guesthouse', true,
     '["guesthouse","guest house","wisma","penginapan kecil"]'::jsonb,
     ARRAY['ID'], 'nex.accommodation_business', 'category=''guesthouse'''),

    ('homestay', 'accommodation', 'Homestay', 'Homestay', '🏘️', 'HeartHandshake', 'accommodation',
     '/homestay', false,
     '["homestay","homestays","rumah warga"]'::jsonb,
     ARRAY['ID'], 'nex.accommodation_business', 'category=''homestay'''),

    ('resort', 'accommodation', 'Resort', 'Resort', '🌴', 'Sun', 'accommodation',
     '/resort', false,
     '["resort","resorts","spa resort","beach resort"]'::jsonb,
     ARRAY['ID'], 'nex.accommodation_business', 'category=''resort'''),

    ('hostel', 'accommodation', 'Hostel', 'Hostel', '🛏️', 'Users', 'accommodation',
     '/hostel', true,
     '["hostel","hostels","backpacker","dorm"]'::jsonb,
     ARRAY['ID'], 'nex.accommodation_business', 'category=''hostel'''),

    ('apartment', 'accommodation', 'Apartment', 'Apartemen', '🏢', 'Building2', 'accommodation',
     '/apartment', false,
     '["apartment","apartments","apartemen","long stay","serviced apartment"]'::jsonb,
     ARRAY['ID'], 'nex.accommodation_business', 'category=''apartment'''),

    ('kos', 'accommodation', 'Kos (monthly rental)', 'Kos', '🛖', 'KeyRound', 'accommodation',
     '/kos', true,
     '["kos","kost","kosan","indekos","kos-kosan","monthly rental","boarding house"]'::jsonb,
     ARRAY['ID'], 'nex.accommodation_business', 'category=''kos''')
ON CONFLICT (id) DO NOTHING;

-- ── 3 · SEED · 3 thin trade rows (D1 · two-tier trade strategy) ──
-- Extended trade semantics remain in
-- src/lib/nex/centre-publishing/tradeCategoryRegistry.ts.
-- These rows only establish canonical identity + surface presence.
-- business_table + category_filter left NULL because trade queries use
-- trade-specific storage paths.

INSERT INTO nex.category_registry
    (id, parent_vertical, display_name_en, display_name_id, icon, visual_glyph, visual_family,
     route, active, brain_keywords, countries, business_table, category_filter)
VALUES
    ('staircase-refacing', 'services', 'Staircase Refacing', 'Staircase Refacing',
     '🪜', 'Stairs', 'trade',
     '/nex-app/refacing/companies', true,
     '["staircase refacing","staircase refurbishment","stair covering","stair cladding"]'::jsonb,
     ARRAY['GB'], NULL, NULL),

    ('staircase-manufacture', 'services', 'Staircase Manufacture', 'Staircase Manufacture',
     '🔨', 'Hammer', 'trade',
     '/nex-app/centre?category=Staircase+Manufacture', true,
     '["staircase manufacture","staircase manufacturer","bespoke staircase","new staircase"]'::jsonb,
     ARRAY['GB'], NULL, NULL),

    ('kitchens', 'services', 'Kitchens', 'Kitchens',
     '🍳', 'ChefHat', 'trade',
     '/nex-app/kitchens/companies', false,
     '["kitchen","kitchens","kitchen fitter","kitchen installer","kitchen refit"]'::jsonb,
     ARRAY['GB'], NULL, NULL)
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- ── ROLLBACK ─────────────────────────────────────────────────────
-- If Phase 0 needs to be rolled back before migration 083 runs:
--   BEGIN;
--   DROP INDEX IF EXISTS nex.category_registry_countries_gin_idx;
--   DROP INDEX IF EXISTS nex.category_registry_active_idx;
--   DROP INDEX IF EXISTS nex.category_registry_parent_vertical_idx;
--   DROP TABLE IF EXISTS nex.category_registry;
--   COMMIT;
--
-- Zero user-facing effect · TS CATEGORY_REGISTRY constant continues
-- to serve all runtime consumers · Walker unaffected · no route breaks.
