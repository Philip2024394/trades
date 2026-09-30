-- ============================================================================
-- NEX-native Migration 114 · nex_profession
-- ============================================================================
--
-- Profession registry. Each row lives under a vertical (FK to
-- nex_vertical.id) and may override the vertical's default cover-layout
-- suggestion and default terminology. The final resolved terminology
-- for a business is:
--
--    profession override → vertical default → global default
--
-- ~120 professions seeded across the 25 verticals. Adding a new row is
-- an INSERT · no schema change.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '114';
--     DROP TABLE IF EXISTS nex_profession;
--   COMMIT;
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS nex_profession (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical_id               uuid NOT NULL REFERENCES nex_vertical(id) ON DELETE CASCADE,
  slug                      text NOT NULL UNIQUE,
  label                     text NOT NULL,
  sort_order                integer NOT NULL DEFAULT 0,
  default_cover_layout_id   text,
  default_terminology       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nex_profession_slug_shape
    CHECK (slug ~ '^[a-z][a-z0-9_-]{1,60}$'),
  CONSTRAINT nex_profession_label_len
    CHECK (char_length(label) >= 1 AND char_length(label) <= 80)
);

COMMENT ON TABLE nex_profession IS
  'Profession registry · seeded rows under each vertical · owns optional per-profession cover-template + terminology overrides. Sealed 2026-09-30 · Bridge Profession-B.';

COMMENT ON COLUMN nex_profession.default_terminology IS
  'Sparse jsonb · only keys the profession OVERRIDES from its vertical default. Missing keys fall through to vertical, then to global default.';

CREATE INDEX IF NOT EXISTS nex_profession_vertical_idx
  ON nex_profession (vertical_id, sort_order, label);

CREATE OR REPLACE FUNCTION nex_profession_touch()
RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS nex_profession_touch_trg ON nex_profession;
CREATE TRIGGER nex_profession_touch_trg
  BEFORE UPDATE ON nex_profession
  FOR EACH ROW
  EXECUTE FUNCTION nex_profession_touch();

ALTER TABLE nex_profession ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nex_profession_public_read ON nex_profession;
CREATE POLICY nex_profession_public_read
  ON nex_profession FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS nex_profession_deny_client_write ON nex_profession;
CREATE POLICY nex_profession_deny_client_write
  ON nex_profession FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- ~120 professions seeded. Slug format vertical_slug + "_" + profession
-- kebab. label is display-only. default_terminology is sparse · only
-- specifies keys that differ from the vertical default.
--
-- Cover layout hints (default_cover_layout_id) intentionally reference
-- ONLY green-ticked layouts (cafe · product · personal_brand + their
-- landscape/round variants). Non-green templates render fine but the
-- picker only suggests confirmed ones.

INSERT INTO nex_profession (vertical_id, slug, label, sort_order, default_cover_layout_id, default_terminology) VALUES
  -- Trades & Repair
  ((SELECT id FROM nex_vertical WHERE slug='trades'), 'trades_plumber',       'Plumber',              10, 'product', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='trades'), 'trades_electrician',   'Electrician',          20, 'product', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='trades'), 'trades_carpenter',     'Carpenter',            30, 'product', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='trades'), 'trades_builder',       'Builder',              40, 'product', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='trades'), 'trades_roofer',        'Roofer',               50, 'product', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='trades'), 'trades_mechanic',      'Mechanic',             60, 'product', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='trades'), 'trades_phone_repair',  'Phone Repair',         70, 'product', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='trades'), 'trades_locksmith',     'Locksmith',            80, 'product', '{"primary_action_label":"Call now"}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='trades'), 'trades_tiler',         'Tiler',                90, 'product', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='trades'), 'trades_decorator',     'Decorator',           100, 'product', '{}'::jsonb),

  -- Home & Property Services
  ((SELECT id FROM nex_vertical WHERE slug='home_services'), 'home_cleaner',      'Cleaner',           10, 'product', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='home_services'), 'home_gardener',     'Gardener',          20, 'product', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='home_services'), 'home_landscaper',   'Landscaper',        30, 'product', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='home_services'), 'home_painter',      'Painter',           40, 'product', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='home_services'), 'home_handyman',     'Handyman',          50, 'product', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='home_services'), 'home_pest_control', 'Pest Control',      60, 'product', '{}'::jsonb),

  -- Restaurants & Food
  ((SELECT id FROM nex_vertical WHERE slug='food'), 'food_restaurant',  'Restaurant',    10, 'cafe',            '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='food'), 'food_cafe',        'Café',          20, 'cafe',            '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='food'), 'food_bakery',      'Bakery',        30, 'cafe',            '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='food'), 'food_takeaway',    'Takeaway',      40, 'cafe',            '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='food'), 'food_street',      'Street Food',   50, 'cafe',            '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='food'), 'food_truck',       'Food Truck',    60, 'cafe',            '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='food'), 'food_caterer',     'Caterer',       70, 'cafe',            '{"catalog_heading":"Menus","primary_action_label":"Enquire"}'::jsonb),

  -- Retail & Products
  ((SELECT id FROM nex_vertical WHERE slug='retail'), 'retail_shop',       'Shop',             10, 'product',       '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='retail'), 'retail_clothing',   'Clothing Store',   20, 'product',       '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='retail'), 'retail_electronics','Electronics',      30, 'product',       '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='retail'), 'retail_furniture',  'Furniture',        40, 'product_landscape','{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='retail'), 'retail_hardware',   'Hardware',         50, 'product',       '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='retail'), 'retail_cosmetics',  'Cosmetics',        60, 'product_round', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='retail'), 'retail_accessories','Accessories',      70, 'product_round', '{}'::jsonb),

  -- Maker & Artisan
  ((SELECT id FROM nex_vertical WHERE slug='maker'), 'maker_jeweller',    'Jeweller',       10, 'product_round',    '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='maker'), 'maker_woodworker',  'Woodworker',     20, 'product_landscape','{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='maker'), 'maker_craft',       'Craft Maker',    30, 'product_round',    '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='maker'), 'maker_gifts',       'Custom Gifts',   40, 'product_round',    '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='maker'), 'maker_pottery',     'Pottery',        50, 'product_round',    '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='maker'), 'maker_leather',     'Leather Goods',  60, 'product_round',    '{}'::jsonb),

  -- Beauty & Personal Care
  ((SELECT id FROM nex_vertical WHERE slug='beauty'), 'beauty_barber',    'Barber',            10, 'personal_brand', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='beauty'), 'beauty_salon',     'Hair Salon',        20, 'personal_brand', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='beauty'), 'beauty_nails',     'Nail Artist',       30, 'personal_brand', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='beauty'), 'beauty_makeup',    'Makeup Artist',     40, 'personal_brand', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='beauty'), 'beauty_spa',       'Spa',               50, 'personal_brand', '{}'::jsonb),

  -- Health & Wellness
  ((SELECT id FROM nex_vertical WHERE slug='wellness'), 'wellness_fitness',      'Fitness Trainer',      10, 'personal_brand', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='wellness'), 'wellness_yoga',         'Yoga Teacher',         20, 'personal_brand', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='wellness'), 'wellness_massage',      'Massage Therapist',    30, 'personal_brand', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='wellness'), 'wellness_practitioner', 'Wellness Practitioner',40, 'personal_brand', '{}'::jsonb),

  -- Professional Services
  ((SELECT id FROM nex_vertical WHERE slug='professional'), 'pro_accountant', 'Accountant',       10, 'personal_brand', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='professional'), 'pro_consultant', 'Consultant',       20, 'personal_brand', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='professional'), 'pro_designer',   'Designer',         30, 'personal_brand', '{"catalog_heading":"Portfolio"}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='professional'), 'pro_lawyer',     'Lawyer',           40, 'personal_brand', '{"primary_action_label":"Book a consultation"}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='professional'), 'pro_agency',     'Agency',           50, 'personal_brand', '{"catalog_heading":"Services"}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='professional'), 'pro_marketing',  'Marketing',        60, 'personal_brand', '{}'::jsonb),

  -- Automotive
  ((SELECT id FROM nex_vertical WHERE slug='automotive'), 'auto_garage',     'Garage / Workshop', 10, 'product', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='automotive'), 'auto_detailing',  'Detailing',         20, 'product', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='automotive'), 'auto_tyres',      'Tyre Service',      30, 'product', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='automotive'), 'auto_dealer',     'Dealer',            40, 'product_landscape', '{"catalog_heading":"Vehicles"}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='automotive'), 'auto_parts',      'Parts Seller',      50, 'product', '{"catalog_heading":"Parts"}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='automotive'), 'auto_rental',     'Vehicle Rental',    60, 'product', '{"catalog_heading":"Fleet","primary_action_label":"Reserve"}'::jsonb),

  -- Construction & Building
  ((SELECT id FROM nex_vertical WHERE slug='construction'), 'con_scaffolder',   'Scaffolder',      10, 'product', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='construction'), 'con_steelworker',  'Steelworker',     20, 'product', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='construction'), 'con_architect',    'Architect',       30, 'personal_brand', '{"catalog_heading":"Projects"}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='construction'), 'con_surveyor',     'Surveyor',        40, 'personal_brand', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='construction'), 'con_company',      'Construction Co', 50, 'product', '{"catalog_heading":"Projects"}'::jsonb),

  -- Creative & Media
  ((SELECT id FROM nex_vertical WHERE slug='creative'), 'creative_photographer','Photographer',    10, 'personal_brand', '{"catalog_heading":"Packages","primary_action_label":"Book me"}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='creative'), 'creative_videographer','Videographer',    20, 'personal_brand', '{"catalog_heading":"Packages","primary_action_label":"Book me"}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='creative'), 'creative_designer',    'Designer',        30, 'personal_brand', '{"catalog_heading":"Portfolio"}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='creative'), 'creative_illustrator', 'Illustrator',     40, 'personal_brand_round', '{"catalog_heading":"Portfolio"}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='creative'), 'creative_animator',    'Animator',        50, 'personal_brand', '{"catalog_heading":"Portfolio"}'::jsonb),

  -- Creator & Influencer
  ((SELECT id FROM nex_vertical WHERE slug='creator'), 'creator_influencer', 'Influencer',  10, 'personal_brand',       '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='creator'), 'creator_youtuber',   'YouTuber',    20, 'personal_brand',       '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='creator'), 'creator_streamer',   'Streamer',    30, 'personal_brand',       '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='creator'), 'creator_tiktok',     'TikTok Creator', 40, 'personal_brand',    '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='creator'), 'creator_content',    'Content Creator', 50, 'personal_brand',   '{}'::jsonb),

  -- Music & Entertainment
  ((SELECT id FROM nex_vertical WHERE slug='music'), 'music_musician',  'Musician',    10, 'personal_brand', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='music'), 'music_dj',        'DJ',          20, 'personal_brand', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='music'), 'music_band',      'Band',        30, 'personal_brand', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='music'), 'music_performer', 'Performer',   40, 'personal_brand', '{}'::jsonb),

  -- Education & Coaching
  ((SELECT id FROM nex_vertical WHERE slug='education'), 'edu_tutor',       'Tutor',            10, 'personal_brand', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='education'), 'edu_teacher',     'Teacher',          20, 'personal_brand', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='education'), 'edu_coach',       'Coach',            30, 'personal_brand', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='education'), 'edu_course',      'Course Creator',   40, 'personal_brand', '{"catalog_heading":"Courses"}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='education'), 'edu_language',    'Language Teacher', 50, 'personal_brand', '{}'::jsonb),

  -- Events & Weddings
  ((SELECT id FROM nex_vertical WHERE slug='events'), 'events_planner',   'Wedding Planner', 10, 'personal_brand', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='events'), 'events_venue',     'Venue',           20, 'cafe',           '{"catalog_heading":"Spaces"}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='events'), 'events_florist',   'Florist',         30, 'product_round',  '{"catalog_heading":"Collections"}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='events'), 'events_entertainer','Entertainer',    40, 'personal_brand', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='events'), 'events_photographer','Wedding Photographer',50,'personal_brand','{"catalog_heading":"Packages","primary_action_label":"Book me"}'::jsonb),

  -- Travel & Accommodation
  ((SELECT id FROM nex_vertical WHERE slug='travel'), 'travel_hotel',       'Hotel',        10, 'cafe',           '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='travel'), 'travel_guesthouse',  'Guesthouse',   20, 'cafe',           '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='travel'), 'travel_villa',       'Villa Rental', 30, 'cafe',           '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='travel'), 'travel_guide',       'Tour Guide',   40, 'personal_brand', '{"catalog_heading":"Tours"}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='travel'), 'travel_operator',    'Tour Operator',50, 'product',        '{"catalog_heading":"Tours"}'::jsonb),

  -- Real Estate
  ((SELECT id FROM nex_vertical WHERE slug='real_estate'), 'rs_agent',       'Agent',            10, 'personal_brand', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='real_estate'), 'rs_property_mgr','Property Manager', 20, 'personal_brand', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='real_estate'), 'rs_developer',   'Developer',        30, 'product_landscape','{"catalog_heading":"Developments"}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='real_estate'), 'rs_rental',      'Rental Listing',   40, 'product_landscape','{"catalog_heading":"Available"}'::jsonb),

  -- Professional Creator / Freelancer
  ((SELECT id FROM nex_vertical WHERE slug='freelancer'), 'fl_developer',    'Developer',    10, 'personal_brand', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='freelancer'), 'fl_writer',       'Writer',       20, 'personal_brand', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='freelancer'), 'fl_translator',   'Translator',   30, 'personal_brand', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='freelancer'), 'fl_va',           'Virtual Assistant',40,'personal_brand','{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='freelancer'), 'fl_freelancer',   'Freelancer',   50, 'personal_brand', '{}'::jsonb),

  -- B2B & Industrial
  ((SELECT id FROM nex_vertical WHERE slug='b2b'), 'b2b_manufacturer', 'Manufacturer', 10, 'product', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='b2b'), 'b2b_wholesaler',   'Wholesaler',   20, 'product', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='b2b'), 'b2b_supplier',     'Supplier',     30, 'product', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='b2b'), 'b2b_distributor',  'Distributor',  40, 'product', '{}'::jsonb),

  -- Organisations & Communities
  ((SELECT id FROM nex_vertical WHERE slug='community'), 'community_club',        'Club',       10, 'personal_brand', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='community'), 'community_association','Association', 20, 'personal_brand', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='community'), 'community_charity',    'Charity',    30, 'personal_brand', '{"primary_action_label":"Donate"}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='community'), 'community_membership', 'Membership Organisation',40,'personal_brand','{"primary_action_label":"Join"}'::jsonb),

  -- Brands
  ((SELECT id FROM nex_vertical WHERE slug='brand'), 'brand_consumer', 'Consumer Brand', 10, 'product', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='brand'), 'brand_fashion',  'Fashion Brand',  20, 'product_landscape', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='brand'), 'brand_product',  'Product Brand',  30, 'product_round',    '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='brand'), 'brand_d2c',      'D2C Brand',      40, 'product',         '{}'::jsonb),

  -- Local Services
  ((SELECT id FROM nex_vertical WHERE slug='local_services'), 'local_delivery', 'Delivery',     10, 'product', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='local_services'), 'local_moving',   'Moving',       20, 'product', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='local_services'), 'local_laundry',  'Laundry',      30, 'product', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='local_services'), 'local_courier',  'Courier',      40, 'product', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='local_services'), 'local_transport','Transport',    50, 'product', '{}'::jsonb),

  -- Digital Products
  ((SELECT id FROM nex_vertical WHERE slug='digital'), 'digital_software',   'Software',   10, 'product', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='digital'), 'digital_templates',  'Templates',  20, 'product_round', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='digital'), 'digital_membership', 'Membership', 30, 'personal_brand', '{"primary_action_label":"Join"}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='digital'), 'digital_downloads',  'Downloads',  40, 'product', '{}'::jsonb),

  -- Rental Businesses
  ((SELECT id FROM nex_vertical WHERE slug='rental'), 'rent_tools',      'Tool Rental',      10, 'product', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='rental'), 'rent_vehicles',   'Vehicle Rental',   20, 'product', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='rental'), 'rent_equipment',  'Equipment Rental', 30, 'product', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='rental'), 'rent_cameras',    'Camera Rental',    40, 'product_landscape', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='rental'), 'rent_events',     'Event Equipment',  50, 'product', '{}'::jsonb),

  -- Marketplace Seller
  ((SELECT id FROM nex_vertical WHERE slug='marketplace'), 'mkt_reseller',    'Reseller',        10, 'product',           '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='marketplace'), 'mkt_collector',   'Collector',       20, 'product_landscape', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='marketplace'), 'mkt_antiques',    'Antique Dealer',  30, 'product_landscape', '{}'::jsonb),
  ((SELECT id FROM nex_vertical WHERE slug='marketplace'), 'mkt_secondhand',  'Second-hand',     40, 'product',           '{}'::jsonb)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '114',
    'nex_profession table + ~120 row seed across 25 verticals',
    'Founder-authorised 2026-09-30. Public read RLS · client writes denied · default_terminology jsonb is SPARSE (only keys profession overrides). Bridge Profession-B.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;
