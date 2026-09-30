-- ============================================================================
-- NEX-native Migration 113 · nex_vertical
-- ============================================================================
--
-- Purpose (Founder-sealed 2026-09-30 · theme × template × profession lock):
--   The vertical is the top level of the profession registry. It holds
--   the DEFAULT cover-template suggestion for its child professions AND
--   the DEFAULT terminology jsonb (catalog_heading, catalog_action_label,
--   primary_action_label, section_about_label, section_location_label,
--   story_eyebrow).
--
-- Fallback chain (documented in code, not the DB):
--   profession override → vertical default → global default
--
-- 25 verticals seeded from the founder's list. Adding a new vertical is
-- an INSERT; no schema change. Adding a terminology key is an app-side
-- change; the jsonb is intentionally open-shape so we don't ship a
-- migration every time we widen the vocabulary.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '113';
--     DROP TABLE IF EXISTS nex_vertical;
--   COMMIT;
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS nex_vertical (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                      text NOT NULL UNIQUE,
  label                     text NOT NULL,
  sort_order                integer NOT NULL DEFAULT 0,
  default_cover_layout_id   text,
  default_terminology       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nex_vertical_slug_shape
    CHECK (slug ~ '^[a-z][a-z0-9_-]{1,40}$'),
  CONSTRAINT nex_vertical_label_len
    CHECK (char_length(label) >= 1 AND char_length(label) <= 80)
);

COMMENT ON TABLE nex_vertical IS
  'Top-level profession vertical (25 rows seeded). Owns default cover template + default terminology for all child professions. Sealed 2026-09-30.';

COMMENT ON COLUMN nex_vertical.default_cover_layout_id IS
  'Suggested cover layout id · references (but does NOT foreign-key) the layout-ids.ts registry so vertical seeds do not couple to layout changes. May reference a green-ticked layout OR a not-yet-shipped one · the picker filters to Done layouts at render time.';

COMMENT ON COLUMN nex_vertical.default_terminology IS
  'JSONB · open-shape · seed keys: catalog_heading, catalog_action_label, primary_action_label, section_about_label, section_location_label, story_eyebrow.';

CREATE OR REPLACE FUNCTION nex_vertical_touch()
RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS nex_vertical_touch_trg ON nex_vertical;
CREATE TRIGGER nex_vertical_touch_trg
  BEFORE UPDATE ON nex_vertical
  FOR EACH ROW
  EXECUTE FUNCTION nex_vertical_touch();

ALTER TABLE nex_vertical ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nex_vertical_public_read ON nex_vertical;
CREATE POLICY nex_vertical_public_read
  ON nex_vertical FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS nex_vertical_deny_client_write ON nex_vertical;
CREATE POLICY nex_vertical_deny_client_write
  ON nex_vertical FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- 25 verticals · founder-provided list. Slugs are stable · labels are
-- display-only and safe to edit later. Sort order matches the founder's
-- original ordering. Terminology defaults chosen to be maximally
-- vertical-appropriate · profession rows will refine further.

INSERT INTO nex_vertical (slug, label, sort_order, default_cover_layout_id, default_terminology) VALUES
  ('trades',          'Trades & Repair',                   10, 'product',       '{"catalog_heading":"Services","catalog_action_label":"View services","primary_action_label":"Get a quote","section_about_label":"About us","section_location_label":"Service area","story_eyebrow":"Our work"}'::jsonb),
  ('home_services',   'Home & Property Services',          20, 'product',       '{"catalog_heading":"Services","catalog_action_label":"View services","primary_action_label":"Book a visit","section_about_label":"About us","section_location_label":"Service area","story_eyebrow":"Our work"}'::jsonb),
  ('food',            'Restaurants & Food',                30, 'cafe',          '{"catalog_heading":"Menu","catalog_action_label":"View menu","primary_action_label":"Order now","section_about_label":"Our story","section_location_label":"Find us","story_eyebrow":"Our story"}'::jsonb),
  ('retail',          'Retail & Products',                 40, 'product',       '{"catalog_heading":"Products","catalog_action_label":"Shop","primary_action_label":"Buy now","section_about_label":"About the shop","section_location_label":"Visit us","story_eyebrow":"About"}'::jsonb),
  ('maker',           'Maker & Artisan',                   50, 'product_round', '{"catalog_heading":"Collection","catalog_action_label":"Shop collection","primary_action_label":"Order","section_about_label":"About the maker","section_location_label":"Studio","story_eyebrow":"Craft"}'::jsonb),
  ('beauty',          'Beauty & Personal Care',            60, 'personal_brand','{"catalog_heading":"Services","catalog_action_label":"View services","primary_action_label":"Book now","section_about_label":"About","section_location_label":"Salon","story_eyebrow":"About"}'::jsonb),
  ('wellness',        'Health & Wellness',                 70, 'personal_brand','{"catalog_heading":"Sessions","catalog_action_label":"View sessions","primary_action_label":"Book a session","section_about_label":"About","section_location_label":"Studio","story_eyebrow":"About"}'::jsonb),
  ('professional',    'Professional Services',             80, 'personal_brand','{"catalog_heading":"Services","catalog_action_label":"View services","primary_action_label":"Get in touch","section_about_label":"About","section_location_label":"Office","story_eyebrow":"About"}'::jsonb),
  ('automotive',      'Automotive',                        90, 'product',       '{"catalog_heading":"Services","catalog_action_label":"View services","primary_action_label":"Get a quote","section_about_label":"About","section_location_label":"Workshop","story_eyebrow":"About"}'::jsonb),
  ('construction',    'Construction & Building',          100, 'product',       '{"catalog_heading":"Projects","catalog_action_label":"See projects","primary_action_label":"Get a quote","section_about_label":"About","section_location_label":"Coverage","story_eyebrow":"Our work"}'::jsonb),
  ('creative',        'Creative & Media',                 110, 'personal_brand','{"catalog_heading":"Portfolio","catalog_action_label":"See portfolio","primary_action_label":"Work with me","section_about_label":"About","section_location_label":"Studio","story_eyebrow":"Portfolio"}'::jsonb),
  ('creator',         'Creator & Influencer',             120, 'personal_brand','{"catalog_heading":"Content","catalog_action_label":"See work","primary_action_label":"Collab","section_about_label":"About","section_location_label":"Based","story_eyebrow":"About"}'::jsonb),
  ('music',           'Music & Entertainment',            130, 'personal_brand','{"catalog_heading":"Set list","catalog_action_label":"Listen","primary_action_label":"Book me","section_about_label":"About","section_location_label":"Based","story_eyebrow":"About"}'::jsonb),
  ('education',       'Education & Coaching',             140, 'personal_brand','{"catalog_heading":"Programmes","catalog_action_label":"View programmes","primary_action_label":"Book a session","section_about_label":"About","section_location_label":"Location","story_eyebrow":"About"}'::jsonb),
  ('events',          'Events & Weddings',                150, 'personal_brand','{"catalog_heading":"Services","catalog_action_label":"View packages","primary_action_label":"Enquire","section_about_label":"About","section_location_label":"Coverage","story_eyebrow":"Portfolio"}'::jsonb),
  ('travel',          'Travel & Accommodation',           160, 'cafe',          '{"catalog_heading":"Rooms","catalog_action_label":"See rooms","primary_action_label":"Book now","section_about_label":"About","section_location_label":"Find us","story_eyebrow":"About"}'::jsonb),
  ('real_estate',     'Real Estate',                      170, 'personal_brand','{"catalog_heading":"Listings","catalog_action_label":"View listings","primary_action_label":"Enquire","section_about_label":"About","section_location_label":"Coverage","story_eyebrow":"About"}'::jsonb),
  ('freelancer',      'Professional Creator / Freelancer',180, 'personal_brand','{"catalog_heading":"Services","catalog_action_label":"View services","primary_action_label":"Work with me","section_about_label":"About","section_location_label":"Based","story_eyebrow":"About"}'::jsonb),
  ('b2b',             'B2B & Industrial',                 190, 'product',       '{"catalog_heading":"Catalogue","catalog_action_label":"View catalogue","primary_action_label":"Request a quote","section_about_label":"About","section_location_label":"Facilities","story_eyebrow":"About"}'::jsonb),
  ('community',       'Organisations & Communities',      200, 'personal_brand','{"catalog_heading":"Programmes","catalog_action_label":"See programmes","primary_action_label":"Get involved","section_about_label":"About us","section_location_label":"Find us","story_eyebrow":"Our mission"}'::jsonb),
  ('brand',           'Brands',                           210, 'product',       '{"catalog_heading":"Products","catalog_action_label":"Shop","primary_action_label":"Buy now","section_about_label":"About the brand","section_location_label":"Find us","story_eyebrow":"About"}'::jsonb),
  ('local_services',  'Local Services',                   220, 'product',       '{"catalog_heading":"Services","catalog_action_label":"View services","primary_action_label":"Book now","section_about_label":"About","section_location_label":"Service area","story_eyebrow":"About"}'::jsonb),
  ('digital',         'Digital Products',                 230, 'product',       '{"catalog_heading":"Products","catalog_action_label":"Browse","primary_action_label":"Buy now","section_about_label":"About","section_location_label":"Based","story_eyebrow":"About"}'::jsonb),
  ('rental',          'Rental Businesses',                240, 'product',       '{"catalog_heading":"Rentals","catalog_action_label":"View rentals","primary_action_label":"Book now","section_about_label":"About","section_location_label":"Location","story_eyebrow":"About"}'::jsonb),
  ('marketplace',     'Marketplace Seller',               250, 'product',       '{"catalog_heading":"Listings","catalog_action_label":"Browse listings","primary_action_label":"Enquire","section_about_label":"About the seller","section_location_label":"Based","story_eyebrow":"About"}'::jsonb)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '113',
    'nex_vertical table + 25-row seed for the profession registry',
    'Founder-authorised 2026-09-30. Public read RLS · client writes denied · default_terminology jsonb open-shape (seed keys: catalog_heading, catalog_action_label, primary_action_label, section_about_label, section_location_label, story_eyebrow). Bridge Profession-A.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;
