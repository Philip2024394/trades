-- XRatedTrade OS — Homeowner Billing (Property Vault subscription).
--
-- Existing billing tables (os_billing_subscriptions, os_billing_customers,
-- os_billing_entitlements) are merchant-side only — every FK references
-- merchant_id. Rather than introduce nullable dual-owner columns and
-- risk breaking existing merchant billing code, we ship parallel
-- homeowner-side tables.
--
-- Homeowner subscriptions are simpler than merchant ones:
--   • Fewer plan combinations
--   • No app_slug — subscription grants access to a bundle
--   • Add-on model (base Vault + optional video storage tiers)
--
-- Plans seeded (indicative prices; final commercial confirmation
-- required before publishing to production Stripe):
--   • property_vault_basic       — £4.99/mo, 5 GB documents
--   • video_storage_50gb         — £9.99/mo, +50 GB video
--   • video_storage_250gb        — £24.99/mo, +250 GB video
--   • video_storage_1tb          — £59.99/mo, +1 TB video
--   • property_passport_lifetime — £99 one-off, permanent vault
--                                  transferable to next owner at sale

BEGIN;

-- ---------------------------------------------------------------------
-- 1. os_homeowner_plans — plan registry
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_homeowner_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_key text NOT NULL UNIQUE,
  plan_type text NOT NULL
    CHECK (plan_type IN ('base','addon','lifetime','trial')),

  headline text NOT NULL,
  description text NOT NULL,

  -- Pricing
  monthly_price_pence integer,
  annual_price_pence integer,
  one_off_price_pence integer,             -- for lifetime plans
  currency text NOT NULL DEFAULT 'GBP',
  stripe_price_id_monthly text,
  stripe_price_id_annual text,
  stripe_price_id_one_off text,

  -- What it grants (JSON so shape can evolve)
  entitlements jsonb NOT NULL DEFAULT '{}'::jsonb,
    -- {"storage_bytes": 5368709120, "video_enabled": false,
    --  "bundle_export_enabled": true, "share_grants_max": 25}

  -- Presentation
  display_order integer NOT NULL DEFAULT 100,
  featured boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS os_homeowner_plans_type_idx
  ON os_homeowner_plans (plan_type, display_order) WHERE active = true;

-- ---------------------------------------------------------------------
-- 2. os_homeowner_subscriptions
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_homeowner_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES os_parties(id) ON DELETE CASCADE,
  plan_key text NOT NULL REFERENCES os_homeowner_plans(plan_key),

  -- Stripe linkage
  stripe_subscription_id text UNIQUE,
  stripe_customer_id text,
  stripe_price_id text,

  status text NOT NULL DEFAULT 'incomplete'
    CHECK (status IN (
      'incomplete',
      'trialing',
      'active',
      'past_due',
      'canceled',
      'unpaid',
      'paused'
    )),

  -- Billing cycle
  billing_interval text CHECK (billing_interval IN ('monthly','annual','one_off')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  canceled_at timestamptz,

  -- Denormalised entitlements for fast lookup
  entitlements_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS os_homeowner_subscriptions_party_idx
  ON os_homeowner_subscriptions (party_id, status);
CREATE INDEX IF NOT EXISTS os_homeowner_subscriptions_active_idx
  ON os_homeowner_subscriptions (party_id, plan_key) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS os_homeowner_subscriptions_stripe_idx
  ON os_homeowner_subscriptions (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS os_homeowner_subscriptions_period_end_idx
  ON os_homeowner_subscriptions (current_period_end) WHERE status = 'active';

-- ---------------------------------------------------------------------
-- 3. os_homeowner_entitlements — derived cache
--
-- Aggregates all active subscriptions for a party into a single row.
-- Rebuilt on subscription state change (webhook handler) so runtime
-- entitlement checks are O(1).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_homeowner_entitlements (
  party_id uuid PRIMARY KEY REFERENCES os_parties(id) ON DELETE CASCADE,

  -- Rolled-up capabilities
  vault_active boolean NOT NULL DEFAULT false,
  vault_tier text CHECK (vault_tier IN ('none','basic','lifetime','trial')),
  storage_included_bytes bigint NOT NULL DEFAULT 524288000,   -- 500MB baseline
  storage_addon_bytes bigint NOT NULL DEFAULT 0,

  video_enabled boolean NOT NULL DEFAULT false,
  bundle_export_enabled boolean NOT NULL DEFAULT true,
  share_grants_max integer NOT NULL DEFAULT 5,
  passport_transferable boolean NOT NULL DEFAULT false,

  -- Contributing subscriptions
  active_subscription_ids uuid[] NOT NULL DEFAULT '{}',
  active_plan_keys text[] NOT NULL DEFAULT '{}',

  last_calculated_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS os_homeowner_entitlements_vault_idx
  ON os_homeowner_entitlements (vault_active, vault_tier);
CREATE INDEX IF NOT EXISTS os_homeowner_entitlements_video_idx
  ON os_homeowner_entitlements (video_enabled) WHERE video_enabled = true;

-- ---------------------------------------------------------------------
-- 4. Seed the plan registry
--
-- Stripe price IDs (stripe_price_id_*) are left null — populated when
-- the products are created in Stripe. Server code should refuse
-- checkout until a price ID exists for the requested cadence.
-- ---------------------------------------------------------------------
INSERT INTO os_homeowner_plans
  (plan_key, plan_type, headline, description,
   monthly_price_pence, annual_price_pence, one_off_price_pence, currency,
   entitlements, display_order, featured, active)
VALUES
  ('property_vault_basic',
   'base',
   'Property Vault',
   'Every quote, receipt, warranty, document and photo from every project on your home — stored securely. Download the full record when a project completes. Passes to the next owner at sale.',
   499, 4990, NULL, 'GBP',
   jsonb_build_object(
     'storage_bytes', 5368709120,           -- 5 GB
     'video_enabled', false,
     'bundle_export_enabled', true,
     'share_grants_max', 25,
     'passport_transferable', true,
     'retention_years', 10
   ),
   100, true, true),

  ('video_storage_50gb',
   'addon',
   'Video Storage — 50 GB',
   'Record walkthroughs, share progress with your trades, keep every video safe alongside your project records.',
   999, 9990, NULL, 'GBP',
   jsonb_build_object(
     'addon_storage_bytes', 53687091200,    -- 50 GB
     'video_enabled', true,
     'requires_plan', 'property_vault_basic'
   ),
   200, false, true),

  ('video_storage_250gb',
   'addon',
   'Video Storage — 250 GB',
   'For large renovations, multi-property portfolios, or long-form video documentation.',
   2499, 24990, NULL, 'GBP',
   jsonb_build_object(
     'addon_storage_bytes', 268435456000,   -- 250 GB
     'video_enabled', true,
     'requires_plan', 'property_vault_basic'
   ),
   201, false, true),

  ('video_storage_1tb',
   'addon',
   'Video Storage — 1 TB',
   'For property professionals, landlords with multiple properties, and video-heavy projects.',
   5999, 59990, NULL, 'GBP',
   jsonb_build_object(
     'addon_storage_bytes', 1099511627776,  -- 1 TB
     'video_enabled', true,
     'requires_plan', 'property_vault_basic'
   ),
   202, false, true),

  ('property_passport_lifetime',
   'lifetime',
   'Property Passport — Lifetime',
   'One-off payment. Your Property Vault is preserved for the lifetime of this property, transferable to future owners. Storage capped at 20 GB documents, 100 GB video. Full download rights forever.',
   NULL, NULL, 9900, 'GBP',
   jsonb_build_object(
     'storage_bytes', 21474836480,          -- 20 GB
     'addon_storage_bytes', 107374182400,   -- 100 GB video
     'video_enabled', true,
     'bundle_export_enabled', true,
     'share_grants_max', 100,
     'passport_transferable', true,
     'retention_years', null                -- indefinite
   ),
   50, false, true),

  ('property_vault_trial',
   'trial',
   'Property Vault — 30-day trial',
   'Try Property Vault free for 30 days. Auto-renews at £4.99/month unless cancelled.',
   0, NULL, NULL, 'GBP',
   jsonb_build_object(
     'storage_bytes', 5368709120,
     'video_enabled', false,
     'bundle_export_enabled', true,
     'share_grants_max', 10,
     'passport_transferable', false,
     'retention_years', 1,
     'trial_days', 30,
     'converts_to_plan', 'property_vault_basic'
   ),
   99, true, true)
ON CONFLICT (plan_key) DO NOTHING;

-- ---------------------------------------------------------------------
-- 5. Touch triggers
-- ---------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'os_homeowner_plans',
      'os_homeowner_subscriptions',
      'os_homeowner_entitlements'
    ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_touch ON %I;', t, t);
    EXECUTE format(
      'CREATE TRIGGER %I_touch BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION os_touch_updated_at();',
      t, t
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 6. RLS — service-role only
-- ---------------------------------------------------------------------
ALTER TABLE os_homeowner_plans          ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_homeowner_subscriptions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_homeowner_entitlements   ENABLE ROW LEVEL SECURITY;

COMMIT;
