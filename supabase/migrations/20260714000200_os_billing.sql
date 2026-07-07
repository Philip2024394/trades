-- OS Billing — the ONE source of truth for merchant subscriptions.
--
-- Stripe is authoritative for money. We mirror the state we care about
-- into these tables so app entitlement checks are one cheap query
-- (never a Stripe API round-trip on the hot path).
--
-- Plans are static (defined in code: src/lib/os/billing/plans.ts) so
-- this schema doesn't try to model them. Subscriptions are dynamic and
-- driven entirely by Stripe webhooks.

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Subscriptions — one row per Stripe subscription. A merchant may
--    hold multiple (bundle + per-app add-ons); entitlements are the
--    projection.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_billing_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL,
  stripe_customer_id text NOT NULL,
  stripe_subscription_id text NOT NULL UNIQUE,
  stripe_price_id text NOT NULL,
  plan_key text NOT NULL,                       -- e.g. 'ai_visualiser.starter'
  app_slug text NOT NULL,                       -- 'ai-visualiser' | 'quote-workspace' | 'merchant-pro-bundle' | ...
  status text NOT NULL CHECK (status IN (
    'trialing','active','past_due','unpaid','canceled','incomplete','incomplete_expired','paused'
  )),
  quantity integer NOT NULL DEFAULT 1,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  canceled_at timestamptz,
  trial_end timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS os_billing_subs_merchant_idx
  ON os_billing_subscriptions (merchant_id, status);
CREATE INDEX IF NOT EXISTS os_billing_subs_customer_idx
  ON os_billing_subscriptions (stripe_customer_id);
CREATE INDEX IF NOT EXISTS os_billing_subs_period_idx
  ON os_billing_subscriptions (current_period_end)
  WHERE status IN ('active', 'past_due');

-- ---------------------------------------------------------------------
-- 2. Customer index — maps merchant → Stripe customer id (1:1). Kept
--    separate from subscriptions so a merchant that unsubscribes still
--    holds their customer record for later reactivation.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_billing_customers (
  merchant_id uuid PRIMARY KEY,
  stripe_customer_id text NOT NULL UNIQUE,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 3. Entitlements — the DERIVED "what can this merchant use" cache.
--    Recomputed from subscriptions on every relevant webhook. This is
--    what apps actually check.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_billing_entitlements (
  merchant_id uuid NOT NULL,
  app_slug text NOT NULL,
  plan_key text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  monthly_quota integer,                        -- NULL = unlimited
  overage_rate_pence integer NOT NULL DEFAULT 0,
  current_period_end timestamptz,
  source_subscription_id uuid REFERENCES os_billing_subscriptions(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (merchant_id, app_slug)
);

CREATE INDEX IF NOT EXISTS os_billing_entitlements_active_idx
  ON os_billing_entitlements (merchant_id) WHERE active;

-- ---------------------------------------------------------------------
-- 4. Webhook events — every incoming Stripe event, once, idempotent.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_billing_webhook_events (
  id text PRIMARY KEY,                          -- Stripe event id (evt_...)
  type text NOT NULL,
  status text NOT NULL DEFAULT 'received' CHECK (status IN (
    'received','processed','failed','ignored'
  )),
  payload jsonb NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0,
  last_error text,
  processed_at timestamptz,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS os_billing_webhook_events_type_idx
  ON os_billing_webhook_events (type, received_at DESC);
CREATE INDEX IF NOT EXISTS os_billing_webhook_events_status_idx
  ON os_billing_webhook_events (status) WHERE status = 'failed';

-- ---------------------------------------------------------------------
-- Touch triggers
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION os_billing_touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'os_billing_subscriptions',
      'os_billing_customers',
      'os_billing_entitlements'
    ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_touch ON %I;', t, t);
    EXECUTE format(
      'CREATE TRIGGER %I_touch BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION os_billing_touch_updated_at();',
      t, t
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- RLS — service-role only. Merchants read their entitlements through
-- server-side helpers.
-- ---------------------------------------------------------------------
ALTER TABLE os_billing_subscriptions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_billing_customers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_billing_entitlements   ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_billing_webhook_events ENABLE ROW LEVEL SECURITY;

COMMIT;
