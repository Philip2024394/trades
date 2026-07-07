-- Phase 2.2 — Entity attachment.
--
-- Every existing record type that pivots on a party now also stores
-- the entity it happened on behalf of. Nullable for backfill safety;
-- new inserts always populate.

BEGIN;

-- Projects — owning entity (defaults to homeowner's personal entity).
ALTER TABLE os_projects
  ADD COLUMN IF NOT EXISTS owner_entity_id uuid REFERENCES os_entities(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS os_projects_owner_entity_idx
  ON os_projects (owner_entity_id, created_at DESC);

-- Payments — paying entity.
ALTER TABLE os_project_payments
  ADD COLUMN IF NOT EXISTS paying_entity_id uuid REFERENCES os_entities(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS os_project_payments_paying_entity_idx
  ON os_project_payments (paying_entity_id, paid_at DESC);

-- Trade invites — inviting entity.
ALTER TABLE os_homeowner_trade_invites
  ADD COLUMN IF NOT EXISTS inviter_entity_id uuid REFERENCES os_entities(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS os_homeowner_trade_invites_inviter_entity_idx
  ON os_homeowner_trade_invites (inviter_entity_id, created_at DESC);

-- Site engagements — the owning entity (foreman's contractor entity).
ALTER TABLE os_site_engagements
  ADD COLUMN IF NOT EXISTS owner_entity_id uuid REFERENCES os_entities(id) ON DELETE SET NULL;

-- Sites — the owning entity too (already have builder_party_id).
ALTER TABLE os_sites
  ADD COLUMN IF NOT EXISTS owner_entity_id uuid REFERENCES os_entities(id) ON DELETE SET NULL;


-- Backfill existing rows using the personal entity of the party they
-- reference. Safe because every party has a personal entity via the
-- trigger + initial backfill.

UPDATE os_projects p
   SET owner_entity_id = e.id
  FROM os_entities e
 WHERE p.primary_party_id IS NOT NULL
   AND e.personal_of_party_id = p.primary_party_id
   AND p.owner_entity_id IS NULL;

UPDATE os_project_payments pp
   SET paying_entity_id = e.id
  FROM os_entities e
 WHERE pp.from_party_id IS NOT NULL
   AND e.personal_of_party_id = pp.from_party_id
   AND pp.paying_entity_id IS NULL;

UPDATE os_homeowner_trade_invites i
   SET inviter_entity_id = e.id
  FROM os_entities e
 WHERE i.inviter_party_id IS NOT NULL
   AND e.personal_of_party_id = i.inviter_party_id
   AND i.inviter_entity_id IS NULL;

UPDATE os_sites s
   SET owner_entity_id = e.id
  FROM os_entities e
 WHERE s.builder_party_id IS NOT NULL
   AND e.personal_of_party_id = s.builder_party_id
   AND s.owner_entity_id IS NULL;

COMMIT;
