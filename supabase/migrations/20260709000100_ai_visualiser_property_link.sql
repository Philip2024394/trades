-- Link the AI Visualiser (App #001) into the OS foundation graph.
--
-- Adds nullable FKs so:
--   • Every homeowner registered through AI Visualiser gets an
--     os_parties row + an os_property_claim on the property.
--   • Every render sits under a Project + Specification (the two
--     concepts already implicit in AI Visualiser choices + BOM).
--   • Every routed lead can point to the property that spawned it.
--
-- Backward-compatible: existing rows keep working with NULL FKs, and
-- new inserts populate them. Backfill lives in the register/render
-- route code — not this migration — because we need address normalising
-- + hashing that only the server helper has.

BEGIN;

-- Homeowners → parties + properties
ALTER TABLE app_ai_visualiser_homeowners
  ADD COLUMN IF NOT EXISTS party_id uuid REFERENCES os_parties(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES os_properties(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS app_ai_visualiser_homeowners_party_idx
  ON app_ai_visualiser_homeowners (party_id) WHERE party_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS app_ai_visualiser_homeowners_property_idx
  ON app_ai_visualiser_homeowners (property_id) WHERE property_id IS NOT NULL;

-- Renders → project + specification (BOM)
ALTER TABLE app_ai_visualiser_renders
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES os_projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS specification_id uuid REFERENCES os_specifications(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS app_ai_visualiser_renders_project_idx
  ON app_ai_visualiser_renders (project_id) WHERE project_id IS NOT NULL;

-- Leads → project (once we have one, the merchant sees "this lead is
-- for the Kitchen project on 4 Elm Grove")
ALTER TABLE app_ai_visualiser_leads
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES os_projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS app_ai_visualiser_leads_project_idx
  ON app_ai_visualiser_leads (project_id) WHERE project_id IS NOT NULL;

-- Routed leads → property (so we can offer the customer to nearby
-- merchants who service that postcode)
ALTER TABLE app_ai_visualiser_routed_leads
  ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES os_properties(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS app_ai_visualiser_routed_leads_property_idx
  ON app_ai_visualiser_routed_leads (property_id) WHERE property_id IS NOT NULL;

COMMIT;
