-- G7E · Studio foundation — app_installations + app_data.
--
-- app_installations tracks which Apps a merchant has active.
-- app_data is the App-scoped KV store — every App reads / writes
-- through the Runtime's storage helper which enforces the
-- (app_slug, merchant_id) scoping.

BEGIN;

CREATE TABLE IF NOT EXISTS app_installations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL,
  app_slug text NOT NULL,
  installed_version text NOT NULL,
  installed_at timestamptz NOT NULL DEFAULT now(),
  uninstalled_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  UNIQUE (merchant_id, app_slug)
);

CREATE INDEX IF NOT EXISTS app_installations_merchant_idx
  ON app_installations (merchant_id, active);

CREATE TABLE IF NOT EXISTS app_data (
  app_slug text NOT NULL,
  merchant_id uuid NOT NULL,
  key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (app_slug, merchant_id, key)
);

CREATE OR REPLACE FUNCTION app_data_touch_updated()
  RETURNS trigger AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS app_data_touch_updated ON app_data;
CREATE TRIGGER app_data_touch_updated
  BEFORE UPDATE ON app_data
  FOR EACH ROW EXECUTE FUNCTION app_data_touch_updated();

ALTER TABLE app_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_installations_owner ON app_installations;
CREATE POLICY app_installations_owner ON app_installations
  FOR ALL USING (merchant_id = auth.uid())
  WITH CHECK (merchant_id = auth.uid());
DROP POLICY IF EXISTS app_installations_service ON app_installations;
CREATE POLICY app_installations_service ON app_installations
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS app_data_owner ON app_data;
CREATE POLICY app_data_owner ON app_data
  FOR ALL USING (merchant_id = auth.uid())
  WITH CHECK (merchant_id = auth.uid());
DROP POLICY IF EXISTS app_data_service ON app_data;
CREATE POLICY app_data_service ON app_data
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

COMMIT;
