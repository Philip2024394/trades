-- image_licenses — the money layer.
--
-- One row per licence purchase. A single image can have many
-- non-exclusive rows (standard/extended), one row per postcode-region
-- (regional_exclusive), or exactly one row (full_buyout) that removes
-- the image from the catalogue for everyone else.
--
-- The watermark serve endpoint reads this table via resolveTier() to
-- decide which tier (preview / standard / clean) to composite.

BEGIN;

CREATE TABLE IF NOT EXISTS image_licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_id text NOT NULL,
  -- 'merchant' — buyer is an on-platform merchant identified by uuid
  -- 'external' — buyer is a public marketplace visitor identified by email
  buyer_type text NOT NULL,
  buyer_merchant_id uuid,
  buyer_email text,
  license_tier text NOT NULL,
  -- Postcode area / district prefix — populated ONLY for
  -- regional_exclusive rows. E.g. "SW1", "E14", "M1".
  postcode_prefix text,
  amount_pence int NOT NULL,
  currency char(3) NOT NULL DEFAULT 'GBP',
  stripe_session_id text,
  stripe_payment_intent_id text,
  status text NOT NULL DEFAULT 'pending',
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (buyer_type IN ('merchant', 'external')),
  CHECK (license_tier IN (
    'standard',
    'extended',
    'regional_exclusive',
    'full_buyout',
    'competitor'
  )),
  CHECK (status IN ('pending', 'active', 'expired', 'refunded')),
  -- Merchant buyers must have a merchant id; external buyers must
  -- have an email.
  CHECK (
    (buyer_type = 'merchant' AND buyer_merchant_id IS NOT NULL)
    OR (buyer_type = 'external' AND buyer_email IS NOT NULL)
  ),
  -- Regional exclusive must specify a postcode.
  CHECK (
    (license_tier <> 'regional_exclusive')
    OR (postcode_prefix IS NOT NULL AND length(postcode_prefix) > 0)
  )
);

-- Unique index: only ONE active regional_exclusive licence per
-- (image, postcode_prefix). We use a partial unique index to allow
-- multiple past (expired/refunded) rows for audit.
CREATE UNIQUE INDEX IF NOT EXISTS image_licenses_regional_unique
  ON image_licenses (image_id, postcode_prefix)
  WHERE license_tier = 'regional_exclusive' AND status = 'active';

-- Unique index: only ONE active full_buyout licence per image.
CREATE UNIQUE INDEX IF NOT EXISTS image_licenses_full_buyout_unique
  ON image_licenses (image_id)
  WHERE license_tier IN ('full_buyout', 'competitor') AND status = 'active';

-- Standard/extended lookup index by merchant.
CREATE INDEX IF NOT EXISTS image_licenses_merchant_lookup_idx
  ON image_licenses (buyer_merchant_id, image_id, status);

CREATE INDEX IF NOT EXISTS image_licenses_email_lookup_idx
  ON image_licenses (buyer_email, image_id, status);

CREATE INDEX IF NOT EXISTS image_licenses_regional_lookup_idx
  ON image_licenses (image_id, postcode_prefix, status)
  WHERE license_tier = 'regional_exclusive';

-- Touch updated_at on changes.
CREATE OR REPLACE FUNCTION image_licenses_touch_updated()
  RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS image_licenses_touch_updated ON image_licenses;
CREATE TRIGGER image_licenses_touch_updated
  BEFORE UPDATE ON image_licenses
  FOR EACH ROW
  EXECUTE FUNCTION image_licenses_touch_updated();

ALTER TABLE image_licenses ENABLE ROW LEVEL SECURITY;

-- Merchants can read + insert their own rows.
DROP POLICY IF EXISTS image_licenses_merchant_rw ON image_licenses;
CREATE POLICY image_licenses_merchant_rw
  ON image_licenses
  FOR ALL
  USING (buyer_merchant_id = auth.uid())
  WITH CHECK (buyer_merchant_id = auth.uid());

-- Service role has full access (webhook + admin dashboards).
DROP POLICY IF EXISTS image_licenses_service_role_all ON image_licenses;
CREATE POLICY image_licenses_service_role_all
  ON image_licenses
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

COMMIT;
