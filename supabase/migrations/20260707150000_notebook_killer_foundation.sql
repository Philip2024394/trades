-- Notebook Killer Foundation
--
-- Three additions that unlock the ultimate trades operating system:
--
--   1. os_project_payments — receipt screenshot URL + payment_type
--      (so Sarah can attach a bank-transfer screenshot and split
--      deposit / interim / final / materials / labour).
--
--   2. os_sites — the Foreman/Builder tier's fundamental unit. A site
--      is a place where multiple sub-trades work over time under a
--      foreman's oversight. One project can span multiple sites (rare)
--      or one site can host many projects (common on new builds).
--
--   3. os_site_engagements — the atomic record of "foreman hired Dave
--      the carpenter for £2400, deposit £800, start 15 Aug, finish 22
--      Aug." Every hire on-site logs one row. This is the primitive
--      the AI extractor writes to when a foreman photographs a
--      scribbled agreement.

BEGIN;

-- 1. Payments enhancements ---------------------------------------------
ALTER TABLE os_project_payments
  ADD COLUMN IF NOT EXISTS payment_type text
    CHECK (payment_type IN ('deposit','interim','final','materials','labour','other'))
    DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS receipt_screenshot_url text,
  ADD COLUMN IF NOT EXISTS receipt_parse_source text
    CHECK (receipt_parse_source IN ('manual','ai_vision','trade_confirmed')),
  ADD COLUMN IF NOT EXISTS materials_amount_pence integer,
  ADD COLUMN IF NOT EXISTS labour_amount_pence integer;

CREATE INDEX IF NOT EXISTS os_project_payments_from_to_idx
  ON os_project_payments (from_party_id, to_business_id, paid_at DESC);


-- 2. Sites — Foreman/Builder tier's fundamental unit -------------------
CREATE TABLE IF NOT EXISTS os_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Whose site is it? A builder company OR a foreman as a party.
  builder_party_id uuid NOT NULL REFERENCES os_parties(id) ON DELETE CASCADE,
  builder_business_id uuid REFERENCES os_business_listings(id) ON DELETE SET NULL,

  name text NOT NULL,                       -- "27 Elm Grove Renovation"
  address_line_1 text,
  postcode text,
  property_id uuid REFERENCES os_properties(id) ON DELETE SET NULL,

  site_type text NOT NULL DEFAULT 'renovation'
    CHECK (site_type IN ('renovation','new_build','commercial','extension','maintenance')),

  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('planned','active','on_hold','completed','archived')),

  started_at timestamptz,
  estimated_completion_at timestamptz,
  completed_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS os_sites_builder_idx
  ON os_sites (builder_party_id, created_at DESC);
CREATE INDEX IF NOT EXISTS os_sites_status_idx
  ON os_sites (status);


-- 3. Site engagements — every sub-trade hire on a site -----------------
CREATE TABLE IF NOT EXISTS os_site_engagements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  site_id uuid NOT NULL REFERENCES os_sites(id) ON DELETE CASCADE,

  -- The foreman making the hire (a party who acts on behalf of the site).
  foreman_party_id uuid NOT NULL REFERENCES os_parties(id) ON DELETE SET NULL,

  -- Who was hired.
  business_id uuid REFERENCES os_business_listings(id) ON DELETE SET NULL,
  hired_display_name text NOT NULL,          -- "Dave the Carpenter" — free text before the trade is linked
  hired_trade text NOT NULL,                 -- 'carpenter'

  -- Commercial terms.
  service_description text,                  -- "Kitchen carcass install + worktop cut"
  agreed_price_pence integer,
  deposit_pence integer,
  currency text NOT NULL DEFAULT 'GBP',

  -- Timeline.
  agreed_start_date date,
  agreed_end_date date,
  actual_start_date date,
  actual_end_date date,

  -- Provenance — how did this engagement get recorded?
  captured_via text NOT NULL DEFAULT 'manual'
    CHECK (captured_via IN ('manual','ai_vision','trade_accepted','import')),
  captured_source_url text,                  -- e.g. screenshot of the WhatsApp agreement

  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','in_progress','completed','disputed','cancelled')),

  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS os_site_engagements_site_idx
  ON os_site_engagements (site_id, created_at DESC);
CREATE INDEX IF NOT EXISTS os_site_engagements_business_idx
  ON os_site_engagements (business_id);
CREATE INDEX IF NOT EXISTS os_site_engagements_foreman_idx
  ON os_site_engagements (foreman_party_id, created_at DESC);


-- 4. Foreman-mode waitlist (unblock UI without committing to full tier)
CREATE TABLE IF NOT EXISTS os_foreman_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  company_name text,
  team_size text,                            -- '1-5', '6-20', '21-50', '50+'
  primary_use_case text,                     -- 'domestic', 'commercial', 'new_build', 'mixed'
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS os_foreman_waitlist_email_idx
  ON os_foreman_waitlist (lower(email));


-- 5. Touch triggers so updated_at stays honest
CREATE OR REPLACE FUNCTION os_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS os_sites_touch ON os_sites;
CREATE TRIGGER os_sites_touch
  BEFORE UPDATE ON os_sites
  FOR EACH ROW EXECUTE FUNCTION os_touch_updated_at();

DROP TRIGGER IF EXISTS os_site_engagements_touch ON os_site_engagements;
CREATE TRIGGER os_site_engagements_touch
  BEFORE UPDATE ON os_site_engagements
  FOR EACH ROW EXECUTE FUNCTION os_touch_updated_at();

COMMIT;
