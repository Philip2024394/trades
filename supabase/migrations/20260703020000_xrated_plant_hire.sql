-- Plant Hire service add-on.
--
-- Stored as a single JSONB column on the listing so the merchant can
-- flip categories (mini_excavator / midi_excavator / dumper /
-- telehandler / roller / scissor_lift / cherry_picker / skid_steer /
-- breaker / generator / welfare_unit / attachments) on/off, adjust
-- day/week/month rates, toggle fulfilment modes (collect / delivery /
-- operator / long_term), configure waivers, delivery zones, fuel
-- policy, deposit, CPCS requirements, and update banner/copy without
-- a schema migration.
--
-- Full JSONB shape lives in src/lib/plantHire.ts (PlantHireConfig).

ALTER TABLE hammerex_trade_off_listings
  ADD COLUMN IF NOT EXISTS plant_hire jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN hammerex_trade_off_listings.plant_hire IS
  'Plant Hire add-on config. See src/lib/plantHire.ts for full JSONB shape.';
