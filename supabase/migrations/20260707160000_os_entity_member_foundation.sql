-- Phase 2 — Entity + Member Foundation.
--
-- The single load-bearing pivot that turns XRatedTrade from a homeowner
-- app into a construction operating system. Everything above Tier 1
-- (foreman, boss, enterprise, public sector) depends on this model.
--
-- Design:
--   ENTITY = the commissioning organisation (individual OR company).
--            Every os_parties row auto-gets a personal single-member
--            entity so Tier 1 users never see the concept.
--   MEMBER = a person's role inside an entity. Multiple entities per
--            person is normal (my personal + my work). Multiple people
--            per entity is normal (boss + foremen + estimators + trades).
--   INVITE = pending membership. Same shape as the homeowner-trade
--            invite table, scoped to entity membership.
--   AUDIT  = every membership + role change is logged. Enterprise
--            compliance depends on this.

BEGIN;

-- 1. ENTITIES ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What kind of commissioning entity?
  tier text NOT NULL DEFAULT 'individual'
    CHECK (tier IN (
      'individual',        -- one person (default for every homeowner)
      'small_business',    -- shop, café, single-site operator
      'contractor',        -- builder / foreman running their own book
      'enterprise',        -- multi-site business, housing, dev
      'public_sector'      -- council, NHS, MoD, DfE, etc.
    )),

  -- Display + legal identity.
  display_name text NOT NULL,
  legal_name text,
  companies_house_number text,
  vat_number text,
  website text,

  -- Address of the commissioning entity itself (HQ, home address).
  address_line_1 text,
  city text,
  postcode text,
  country text NOT NULL DEFAULT 'GB',

  -- Personal entities have `personal_of_party_id` set to their sole
  -- owner. Business/enterprise entities leave this null.
  personal_of_party_id uuid UNIQUE REFERENCES os_parties(id) ON DELETE CASCADE,

  -- Slug lets us build /entity/[slug] URLs later.
  slug text UNIQUE,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS os_entities_tier_idx ON os_entities (tier);


-- 2. MEMBERS -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_entity_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  entity_id uuid NOT NULL REFERENCES os_entities(id) ON DELETE CASCADE,
  party_id uuid NOT NULL REFERENCES os_parties(id) ON DELETE CASCADE,

  -- One canonical role per member (composable via role_grants below
  -- if a member needs to wear multiple hats).
  role text NOT NULL DEFAULT 'owner'
    CHECK (role IN (
      'owner',       -- full control (only role that can grant/revoke roles)
      'finance',     -- financial visibility across the entity
      'foreman',     -- site-scoped operational access
      'estimator',   -- quotes, materials, budgets
      'viewer',      -- read-only (Notebook Passport holders)
      'trade'        -- external trade linked as a member for engagement clarity
    )),

  -- Financial visibility toggle — foreman defaults to false; owner
  -- opens the tap explicitly per member. Enterprise needs this.
  can_see_financials boolean NOT NULL DEFAULT false,

  -- Optional site scope for foremen (empty = all sites they're on).
  scoped_site_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],

  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','paused','removed')),

  invited_by_party_id uuid REFERENCES os_parties(id) ON DELETE SET NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT os_entity_members_unique_active_party UNIQUE (entity_id, party_id)
);

CREATE INDEX IF NOT EXISTS os_entity_members_entity_idx
  ON os_entity_members (entity_id, role);
CREATE INDEX IF NOT EXISTS os_entity_members_party_idx
  ON os_entity_members (party_id);


-- 3. INVITES to join an entity as a member ------------------------------
CREATE TABLE IF NOT EXISTS os_entity_member_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  entity_id uuid NOT NULL REFERENCES os_entities(id) ON DELETE CASCADE,
  inviter_party_id uuid NOT NULL REFERENCES os_parties(id) ON DELETE CASCADE,

  invited_email text NOT NULL,
  invited_email_hash text NOT NULL,
  invited_display_name text,
  proposed_role text NOT NULL DEFAULT 'foreman'
    CHECK (proposed_role IN ('finance','foreman','estimator','viewer','trade')),
  can_see_financials boolean NOT NULL DEFAULT false,

  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  note text,

  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','declined','expired','revoked')),

  sent_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),

  resulting_member_id uuid REFERENCES os_entity_members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS os_entity_member_invites_entity_idx
  ON os_entity_member_invites (entity_id, status);


-- 4. AUDIT LOG — every role/membership change is recorded --------------
CREATE TABLE IF NOT EXISTS os_entity_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  entity_id uuid NOT NULL REFERENCES os_entities(id) ON DELETE CASCADE,
  actor_party_id uuid REFERENCES os_parties(id) ON DELETE SET NULL,

  verb text NOT NULL,        -- e.g. 'member.added','member.role_changed','member.removed','entity.tier_changed'
  target_party_id uuid REFERENCES os_parties(id) ON DELETE SET NULL,
  target_member_id uuid REFERENCES os_entity_members(id) ON DELETE SET NULL,

  before_state jsonb,
  after_state jsonb,

  ip_class text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS os_entity_audit_entity_idx
  ON os_entity_audit_events (entity_id, created_at DESC);


-- 5. AUTO-PROVISION personal entity for every party --------------------
CREATE OR REPLACE FUNCTION os_provision_personal_entity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_entity_id uuid;
BEGIN
  -- Only for person parties (business parties may back an entity as
  -- their business_listing_id, but never get an auto personal entity).
  IF NEW.kind <> 'person' THEN
    RETURN NEW;
  END IF;

  INSERT INTO os_entities (
    tier, display_name, personal_of_party_id
  ) VALUES (
    'individual', NEW.display_name, NEW.id
  )
  ON CONFLICT (personal_of_party_id) DO NOTHING
  RETURNING id INTO new_entity_id;

  IF new_entity_id IS NOT NULL THEN
    INSERT INTO os_entity_members (
      entity_id, party_id, role, can_see_financials
    ) VALUES (
      new_entity_id, NEW.id, 'owner', true
    ) ON CONFLICT (entity_id, party_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS os_provision_personal_entity_trg ON os_parties;
CREATE TRIGGER os_provision_personal_entity_trg
  AFTER INSERT ON os_parties
  FOR EACH ROW EXECUTE FUNCTION os_provision_personal_entity();


-- 6. BACKFILL personal entities for every existing person party --------
INSERT INTO os_entities (tier, display_name, personal_of_party_id)
SELECT
  'individual', p.display_name, p.id
FROM os_parties p
WHERE p.kind = 'person'
  AND NOT EXISTS (
    SELECT 1 FROM os_entities e WHERE e.personal_of_party_id = p.id
  )
ON CONFLICT (personal_of_party_id) DO NOTHING;

INSERT INTO os_entity_members (entity_id, party_id, role, can_see_financials)
SELECT
  e.id, e.personal_of_party_id, 'owner', true
FROM os_entities e
WHERE e.personal_of_party_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM os_entity_members m
    WHERE m.entity_id = e.id AND m.party_id = e.personal_of_party_id
  );


-- 7. Touch triggers
CREATE OR REPLACE FUNCTION os_entities_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS os_entities_touch_trg ON os_entities;
CREATE TRIGGER os_entities_touch_trg
  BEFORE UPDATE ON os_entities
  FOR EACH ROW EXECUTE FUNCTION os_entities_touch();

DROP TRIGGER IF EXISTS os_entity_members_touch_trg ON os_entity_members;
CREATE TRIGGER os_entity_members_touch_trg
  BEFORE UPDATE ON os_entity_members
  FOR EACH ROW EXECUTE FUNCTION os_entities_touch();

DROP TRIGGER IF EXISTS os_entity_member_invites_touch_trg ON os_entity_member_invites;
CREATE TRIGGER os_entity_member_invites_touch_trg
  BEFORE UPDATE ON os_entity_member_invites
  FOR EACH ROW EXECUTE FUNCTION os_entities_touch();

COMMIT;
