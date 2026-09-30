-- ============================================================================
-- NEX-native Migration 112 · nex_service
-- ============================================================================
--
-- Purpose:
--   Persist per-business "Services" so cover templates that render a
--   ServiceList (04 Tradesperson · 05 Salon · 09 Premium Business ·
--   10-14 Personal Brand family via a future Services tab) can pull
--   real seller-authored rows instead of the hardcoded mock services.
--
-- Founder-sealed shape (2026-09-30):
--   · name text NOT NULL · cap 80 chars · short service name
--     (e.g. "Private catering", "Boiler service", "Copywriting sprint")
--   · description text NOT NULL default '' · cap 300 chars · one to
--     two lines the buyer reads to decide whether to enquire
--   · from_price text NOT NULL default '' · cap 40 chars · free-text
--     price hint sellers author themselves ("from £45", "Rp 450k · pp",
--     "£1200 fixed"). Text field rather than numeric so the seller
--     controls the phrasing and currency/format.
--   · sort_order integer default 0 · display order (ties broken by
--     created_at asc)
--   · created_at / updated_at timestamptz · updated_at auto-touched
--   · CHECKs on lengths so the DB never accepts malformed payloads
--
-- RLS:
--   · Public read (buyers browse without auth)
--   · Deny direct client writes · mutations flow through
--     service-service.ts + /manage/services actions (Services-B/C).
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '112';
--     DROP TABLE IF EXISTS nex_service;
--   COMMIT;
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS nex_service (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL REFERENCES nex_business(id) ON DELETE CASCADE,
  name         text NOT NULL,
  description  text NOT NULL DEFAULT '',
  from_price   text NOT NULL DEFAULT '',
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nex_service_name_len
    CHECK (char_length(name) >= 1 AND char_length(name) <= 80),
  CONSTRAINT nex_service_description_len
    CHECK (char_length(description) <= 300),
  CONSTRAINT nex_service_from_price_len
    CHECK (char_length(from_price) <= 40)
);

COMMENT ON TABLE nex_service IS
  'Per-business services list rendered in the ServiceList block of cover Templates 04, 05, 09 (and the Personal Brand family via a future Services tab). Sealed 2026-09-30 · Bridge Services-A.';

COMMENT ON COLUMN nex_service.name IS
  'Short service name · 1-80 chars · e.g. "Private catering", "Boiler service".';

COMMENT ON COLUMN nex_service.description IS
  'One or two lines the buyer reads to decide whether to enquire · cap 300 chars · UI 2-line clamp.';

COMMENT ON COLUMN nex_service.from_price IS
  'Free-text price hint · cap 40 chars · seller-authored so they control currency and phrasing (e.g. "from Rp 450k", "£1200 fixed", "on request").';

COMMENT ON COLUMN nex_service.sort_order IS
  'Display order · lower renders first · ties broken by created_at asc.';

CREATE INDEX IF NOT EXISTS nex_service_business_idx
  ON nex_service (business_id, sort_order, created_at);

CREATE OR REPLACE FUNCTION nex_service_touch()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS nex_service_touch_trg ON nex_service;
CREATE TRIGGER nex_service_touch_trg
  BEFORE UPDATE ON nex_service
  FOR EACH ROW
  EXECUTE FUNCTION nex_service_touch();

ALTER TABLE nex_service ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nex_service_public_read ON nex_service;
CREATE POLICY nex_service_public_read
  ON nex_service
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS nex_service_deny_client_write ON nex_service;
CREATE POLICY nex_service_deny_client_write
  ON nex_service
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '112',
    'nex_service table · per-business services list for cover Templates 04, 05, 09 + Personal Brand family',
    'Founder-authorised 2026-09-30. Public read RLS · service-role writes · name 1-80 · description ≤ 300 · from_price ≤ 40. Bridge Services-A.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT table_name FROM information_schema.tables
--    WHERE table_name = 'nex_service';
--   SELECT column_name, data_type, is_nullable FROM information_schema.columns
--    WHERE table_name = 'nex_service' ORDER BY ordinal_position;
--   SELECT policyname, cmd FROM pg_policies
--    WHERE tablename = 'nex_service';
