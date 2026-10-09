-- NEX Chat Complete Ecosystem · Wave 1 · Foundation (Option C · Variant C1).
--
-- Persists the AppBlueprint business-identity contract onto the existing
-- OS layer by extending os_business_listings with six additive columns.
-- Additive-only migration · zero drops · zero renames · zero data loss.
--
-- Rationale (per project_nex_chat_complete_ecosystem_build_wave_master_directive_2026_09_23):
--   · Founder chose Option C (OS-layer persistence) over new nex_businesses table
--   · Variant C1 (extend existing canonical merchant table) over C2 (new profile table)
--   · Zero coupling to Trade Centre / Tradeoff assumptions — legacy fields stay
--   · Backwards-compatible for every existing os_business_listings reader
--
-- The AppBlueprint contract itself lives at src/lib/app-builder/blueprint-schema.ts
-- and is unchanged. This migration only provides its persistence home.
--
-- Rollback (append-only migration ⇒ trivial):
--   ALTER TABLE os_business_listings
--     DROP COLUMN owning_entity_id,
--     DROP COLUMN published_by_party_id,
--     DROP COLUMN blueprint_published_at,
--     DROP COLUMN blueprint_revision,
--     DROP COLUMN blueprint_snapshot,
--     DROP COLUMN blueprint_id;
--   DROP INDEX IF EXISTS os_business_listings_blueprint_id_idx;
--   DROP INDEX IF EXISTS os_business_listings_owning_entity_id_idx;
--   -- Audit-log rows written by this migration remain (audit trail is immutable).

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Additive columns for AppBlueprint persistence
-- ---------------------------------------------------------------------
ALTER TABLE os_business_listings
  ADD COLUMN IF NOT EXISTS blueprint_id           uuid,
  ADD COLUMN IF NOT EXISTS blueprint_snapshot     jsonb,
  ADD COLUMN IF NOT EXISTS blueprint_revision     integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS blueprint_published_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_by_party_id  uuid REFERENCES os_parties(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS owning_entity_id       uuid REFERENCES os_entities(id) ON DELETE RESTRICT;

-- UNIQUE indexes rather than table-level UNIQUE constraints so partial
-- WHERE clauses work — until every row has a blueprint published, most
-- rows carry NULL for these columns and multiple NULLs must be allowed.
CREATE UNIQUE INDEX IF NOT EXISTS os_business_listings_blueprint_id_idx
  ON os_business_listings (blueprint_id)
  WHERE blueprint_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS os_business_listings_owning_entity_id_idx
  ON os_business_listings (owning_entity_id)
  WHERE owning_entity_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- 2. Optional backfill for owning_entity_id
--
-- We can only derive owning_entity_id where a party_id → entity mapping
-- is unambiguous: the party is an active owner of exactly ONE business
-- entity (tier in small_business / contractor / enterprise). Ambiguous
-- rows (party owns 0 or 2+ business entities) stay NULL and will be
-- populated at next blueprint publish. Doctrine §25 (no fake data)
-- forbids guessing.
--
-- The backfill logs one audit event per updated row so the trail is
-- auditable (verb 'business.entity_backfilled_from_party').
-- ---------------------------------------------------------------------
WITH candidates AS (
  SELECT
    bl.id                                 AS listing_id,
    bl.party_id                           AS party_id,
    (
      SELECT m.entity_id
      FROM os_entity_members m
      JOIN os_entities e ON e.id = m.entity_id
      WHERE m.party_id = bl.party_id
        AND m.role = 'owner'
        AND m.status = 'active'
        AND e.tier IN ('small_business', 'contractor', 'enterprise')
      LIMIT 2
    )                                     AS resolved_entity_id,
    (
      SELECT COUNT(*)
      FROM os_entity_members m
      JOIN os_entities e ON e.id = m.entity_id
      WHERE m.party_id = bl.party_id
        AND m.role = 'owner'
        AND m.status = 'active'
        AND e.tier IN ('small_business', 'contractor', 'enterprise')
    )                                     AS match_count
  FROM os_business_listings bl
  WHERE bl.party_id IS NOT NULL
    AND bl.owning_entity_id IS NULL
)
UPDATE os_business_listings bl
SET owning_entity_id = c.resolved_entity_id
FROM candidates c
WHERE bl.id = c.listing_id
  AND c.match_count = 1
  AND c.resolved_entity_id IS NOT NULL;

-- Audit the backfill (best-effort · will only fire if os_entity_audit_events
-- exists; wrapped in DO block so migration doesn't fail on schemas that
-- haven't shipped the audit table yet).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'os_entity_audit_events'
  ) THEN
    INSERT INTO os_entity_audit_events (entity_id, verb, actor_party_id, subject_kind, subject_id, at, payload)
    SELECT
      bl.owning_entity_id,
      'business.entity_backfilled_from_party',
      NULL,
      'business_listing',
      bl.id,
      now(),
      jsonb_build_object(
        'migration', '20260923170000_os_business_listings_blueprint',
        'derived_from_party_id', bl.party_id,
        'reason', 'unambiguous_owner_business_entity_match'
      )
    FROM os_business_listings bl
    WHERE bl.owning_entity_id IS NOT NULL
      -- Only audit rows we just backfilled in this transaction. Filter by
      -- created_at strictly older than now() minus 1 second is unreliable;
      -- instead audit every row that has owning_entity_id set but not yet
      -- an audit event for this exact verb.
      AND NOT EXISTS (
        SELECT 1 FROM os_entity_audit_events e
        WHERE e.subject_kind = 'business_listing'
          AND e.subject_id = bl.id
          AND e.verb = 'business.entity_backfilled_from_party'
      );
  END IF;
END$$;

-- ---------------------------------------------------------------------
-- 3. Column comments (self-documenting schema for future readers)
-- ---------------------------------------------------------------------
COMMENT ON COLUMN os_business_listings.blueprint_id IS
  'AppBlueprint.id ("ab_<ulid>") of the currently-published blueprint · NULL until first publish · UNIQUE where non-null';
COMMENT ON COLUMN os_business_listings.blueprint_snapshot IS
  'Serialised AppBlueprint at last publish · full JSON per src/lib/app-builder/blueprint-schema.ts';
COMMENT ON COLUMN os_business_listings.blueprint_revision IS
  'Monotonic DB-level revision counter · increments on every publishBlueprint call · starts at 1';
COMMENT ON COLUMN os_business_listings.blueprint_published_at IS
  'Timestamp of the most recent successful publish · NULL until first publish';
COMMENT ON COLUMN os_business_listings.published_by_party_id IS
  'os_parties.id of the party that authored the most recent publish · NULL for system publishes';
COMMENT ON COLUMN os_business_listings.owning_entity_id IS
  'os_entities.id of the business commissioning entity that owns this listing · UNIQUE where non-null · NULL until backfill resolves or first authenticated publish';

COMMIT;
