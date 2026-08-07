-- NEX Infrastructure Runtime · §5.4 · contacts
-- Snapshot store · append-only · latest-per-key on contact_id.
-- Retention: forever. GDPR erasure via superseding snapshot with deleted_at.

CREATE TABLE IF NOT EXISTS nex.contacts (
  snapshot_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id             TEXT NOT NULL,
  email                  TEXT,
  phone                  TEXT,
  name                   TEXT,
  kind                   TEXT,
  source                 TEXT,
  source_ref             TEXT,
  tags                   JSONB NOT NULL DEFAULT '[]'::jsonb,
  consent_marketing      BOOLEAN,
  consent_transactional  BOOLEAN,
  consent_source         TEXT,
  attributes             JSONB NOT NULL DEFAULT '{}'::jsonb,
  lifecycle_stage        TEXT,
  first_seen_at          TIMESTAMPTZ,
  last_seen_at           TIMESTAMPTZ,
  linked_business_id     UUID,
  updated_at             TIMESTAMPTZ NOT NULL,
  business_id            UUID,
  inserted_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Uniqueness lives at the *latest* level (a view) not on the append-only
-- history · a contact's email/phone can change across snapshots. Enforce
-- at read time via `SELECT DISTINCT ON (contact_id) ... ORDER BY contact_id, updated_at DESC`.
CREATE INDEX IF NOT EXISTS contacts_contact_id_idx     ON nex.contacts (contact_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS contacts_email_idx          ON nex.contacts (email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS contacts_phone_idx          ON nex.contacts (phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS contacts_lifecycle_idx      ON nex.contacts (lifecycle_stage) WHERE lifecycle_stage IS NOT NULL;
CREATE INDEX IF NOT EXISTS contacts_business_id_idx    ON nex.contacts (business_id, updated_at DESC) WHERE business_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS contacts_linked_biz_idx     ON nex.contacts (linked_business_id) WHERE linked_business_id IS NOT NULL;

ALTER TABLE nex.contacts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'nex' AND tablename = 'contacts' AND policyname = 'service_role_all_contacts') THEN
    CREATE POLICY "service_role_all_contacts" ON nex.contacts FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE nex.contacts IS 'Infrastructure Runtime §5.4 · Master Contact DB snapshots · retention forever';
