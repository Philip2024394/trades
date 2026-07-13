-- Phase B of the Nearby Installers pattern.
--
-- Every time a shopper hits "Book fit + shop" on a PDP we log a
-- pairing row: the anchor product, the installer's service, and an
-- optional buyer contact (WhatsApp number they typed). Both the
-- merchant selling the product AND the installer can query this table
-- to see the bundled-lead flow.
--
-- Deliberately NOT a booking or a commitment — just a lead. The
-- actual scheduling happens WhatsApp-to-WhatsApp between the two
-- parties. Storing a lead lets us report "your product drove 12
-- installer leads this month" back to the merchant without touching
-- any payment or scheduling primitives.

CREATE TABLE IF NOT EXISTS hammerex_xrated_install_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The physical product the shopper started from (a door, a lock, a
  -- tap, a boiler). ON DELETE CASCADE keeps orphans out if the SKU
  -- is retired.
  anchor_product_id uuid NOT NULL
    REFERENCES hammerex_xrated_products(id) ON DELETE CASCADE,
  -- The installer's service row (kind='service' with a matching
  -- service_category). Same CASCADE rules.
  installer_service_id uuid NOT NULL
    REFERENCES hammerex_xrated_products(id) ON DELETE CASCADE,
  -- Optional buyer contact — if the shopper typed a phone number
  -- into the mini form, we cache it here so admin can follow up.
  -- Never required (WhatsApp handoff is enough for the base flow).
  buyer_contact text
    CHECK (buyer_contact IS NULL OR char_length(buyer_contact) BETWEEN 1 AND 100),
  -- Which surface the lead came from — 'pdp' today, could add
  -- 'cart' or 'checkout' later without a migration.
  source text NOT NULL DEFAULT 'pdp'
    CHECK (source IN ('pdp', 'cart', 'checkout', 'other')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Read path 1: "leads by installer" (installer wants to see their
-- inbound leads).
CREATE INDEX IF NOT EXISTS xrated_install_leads_installer_idx
  ON hammerex_xrated_install_leads (installer_service_id, created_at DESC);

-- Read path 2: "leads by anchor product" (merchant wants to see how
-- often their SKU triggered an install lead).
CREATE INDEX IF NOT EXISTS xrated_install_leads_anchor_idx
  ON hammerex_xrated_install_leads (anchor_product_id, created_at DESC);
