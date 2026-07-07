-- ai_visualiser — merchant-scoped AI renovation renders.
--
-- Model:
--   • Merchant installs the app + declares which catalogue leaves they
--     sell (e.g. a carpenter picks "internal_doors", "loft_ladders" but
--     NOT "staircases"). That declaration IS the AI's constraint schema.
--   • Homeowner registers on merchant page — name / email / whatsapp /
--     postcode — becomes a lead attached to that merchant.
--   • Every render is bound to (merchant_id, homeowner_id) and never
--     shared across merchants. Merchant owns their leads.
--   • Uploaded photo is classified against the merchant's ticked leaves
--     — off-scope uploads are rejected before AI is called, protecting
--     credits.
--   • Perceptual hash cache: same (photo_phash, prompt_hash) returns
--     the existing render_url — no AI call, no credit burn.

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Global taxonomy of catalogue leaves (seeded via app; admin editable)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_visualiser_taxonomy_leaves (
  slug text PRIMARY KEY,                    -- e.g. "internal_doors"
  trade_slug text NOT NULL,                 -- e.g. "carpenter"
  display_name text NOT NULL,               -- e.g. "Internal Doors"
  synonyms text[] NOT NULL DEFAULT '{}',    -- ["door", "internal door", "room door"]
  classifier_prompts text[] NOT NULL DEFAULT '{}', -- CLIP prompts to detect this in a photo
  render_style_options jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{key:"shaker",label:"Shaker"},...]
  render_material_options jsonb NOT NULL DEFAULT '[]'::jsonb,
  render_colour_options jsonb NOT NULL DEFAULT '[]'::jsonb,
  render_hardware_options jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_visualiser_taxonomy_leaves_trade_idx
  ON ai_visualiser_taxonomy_leaves (trade_slug) WHERE is_active;

-- ---------------------------------------------------------------------
-- 2. Per-merchant catalogue scope — WHICH leaves this merchant sells.
--    The AI can only render leaves in this set for this merchant.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_ai_visualiser_catalogue_scope (
  merchant_id uuid NOT NULL,
  leaf_slug text NOT NULL REFERENCES ai_visualiser_taxonomy_leaves(slug) ON DELETE CASCADE,
  product_count integer NOT NULL DEFAULT 0,   -- how many real catalogue products back this leaf
  is_enabled boolean NOT NULL DEFAULT true,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (merchant_id, leaf_slug)
);

CREATE INDEX IF NOT EXISTS app_ai_visualiser_scope_merchant_idx
  ON app_ai_visualiser_catalogue_scope (merchant_id) WHERE is_enabled;

-- ---------------------------------------------------------------------
-- 3. Merchant credit / plan state
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_ai_visualiser_credits (
  merchant_id uuid PRIMARY KEY,
  tier text NOT NULL DEFAULT 'starter'
    CHECK (tier IN ('bundled', 'starter', 'growth', 'unlimited')),
  monthly_quota integer NOT NULL DEFAULT 100,      -- renders included in plan
  renders_used_this_period integer NOT NULL DEFAULT 0,
  overage_pence integer NOT NULL DEFAULT 0,        -- accumulated overage this period
  overage_rate_pence integer NOT NULL DEFAULT 30,  -- pence per render over quota
  period_started_at timestamptz NOT NULL DEFAULT now(),
  period_ends_at timestamptz NOT NULL DEFAULT (now() + interval '1 month'),
  stripe_subscription_id text,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 4. Homeowner account (per merchant page)
--    Contact-only. No WhatsApp OTP — the WhatsApp number is captured
--    for the merchant to use when they reply. Email may be verified via
--    a magic link (cheap, blocks pure junk addresses). Merchants never
--    see each other's leads. Fingerprint / hashes let the platform spot
--    one person farming multiple merchant pages without exposing PII
--    across merchant boundaries.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_ai_visualiser_homeowners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL,          -- lead belongs to this merchant only
  full_name text NOT NULL,
  email text NOT NULL,
  email_verified_at timestamptz,      -- via magic link (optional soft gate)
  whatsapp_e164 text NOT NULL,        -- +447700900123 — captured, NOT OTP-verified
  home_phone text,                    -- optional landline / mobile
  postcode text NOT NULL,             -- upper, no space: "NG74AB"
  -- anti-abuse hashes (salted, no PII in the clear across merchants)
  whatsapp_hash text NOT NULL,        -- sha256(whatsapp_e164 + platform_salt)
  email_hash text NOT NULL,           -- sha256(lower(email) + platform_salt)
  fingerprint_id text,                -- FingerprintJS visitorId
  ip_class text,                      -- /24 for IPv4, /64 for IPv6
  -- rate-limit windows are computed from renders table; here we cache
  -- day/week counts for cheap read
  renders_today integer NOT NULL DEFAULT 0,
  renders_this_week integer NOT NULL DEFAULT 0,
  day_window_started_at timestamptz NOT NULL DEFAULT now(),
  week_window_started_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS app_ai_visualiser_homeowners_merchant_email_uk
  ON app_ai_visualiser_homeowners (merchant_id, lower(email));

CREATE INDEX IF NOT EXISTS app_ai_visualiser_homeowners_merchant_idx
  ON app_ai_visualiser_homeowners (merchant_id, created_at DESC);

-- cross-merchant abuse detection: query by whatsapp/fingerprint to spot
-- one person farming multiple merchant pages.
CREATE INDEX IF NOT EXISTS app_ai_visualiser_homeowners_whatsapp_hash_idx
  ON app_ai_visualiser_homeowners (whatsapp_hash);
CREATE INDEX IF NOT EXISTS app_ai_visualiser_homeowners_fingerprint_idx
  ON app_ai_visualiser_homeowners (fingerprint_id) WHERE fingerprint_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- 5. Renders — every AI generation (or cache hit)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_ai_visualiser_renders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL,
  homeowner_id uuid NOT NULL REFERENCES app_ai_visualiser_homeowners(id) ON DELETE CASCADE,
  leaf_slug text NOT NULL REFERENCES ai_visualiser_taxonomy_leaves(slug) ON DELETE RESTRICT,
  -- source photo
  source_photo_url text NOT NULL,
  source_photo_phash text NOT NULL,          -- perceptual hash (16-64 hex)
  -- prompt was assembled from design tree, never user free text
  prompt_json jsonb NOT NULL,                -- {style, material, colour, hardware, product_skus[]}
  prompt_hash text NOT NULL,                 -- sha256(prompt_json canonical)
  cache_key text GENERATED ALWAYS AS (source_photo_phash || ':' || prompt_hash) STORED,
  -- output
  render_url text,                           -- SD watermarked
  render_url_hd text,                        -- unlocked on quote request only
  stego_watermark text,                      -- steganographic account tag
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'complete', 'failed', 'blocked')),
  block_reason text,                         -- 'off_scope' | 'over_limit' | 'no_credits' | 'moderation'
  -- billing
  was_cache_hit boolean NOT NULL DEFAULT false,
  credit_consumed boolean NOT NULL DEFAULT false,
  ai_cost_pence integer NOT NULL DEFAULT 0,  -- cost we paid to render provider
  -- provenance
  render_provider text,                      -- 'flux-1.1-pro' | 'nano-banana' | ...
  provider_request_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS app_ai_visualiser_renders_cache_key_idx
  ON app_ai_visualiser_renders (cache_key) WHERE status = 'complete';

CREATE INDEX IF NOT EXISTS app_ai_visualiser_renders_merchant_idx
  ON app_ai_visualiser_renders (merchant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS app_ai_visualiser_renders_homeowner_idx
  ON app_ai_visualiser_renders (homeowner_id, created_at DESC);

-- ---------------------------------------------------------------------
-- 6. Leads — merchant's inbox row
--    One row per verified homeowner-on-merchant pair. Renders link back
--    to this row so the merchant sees a growing set of designs from the
--    same interested customer.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_ai_visualiser_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL,
  homeowner_id uuid NOT NULL UNIQUE REFERENCES app_ai_visualiser_homeowners(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'viewed', 'contacted', 'quoted', 'won', 'lost', 'ignored')),
  hottest_render_id uuid REFERENCES app_ai_visualiser_renders(id) ON DELETE SET NULL,
  render_count integer NOT NULL DEFAULT 0,
  bom_summary jsonb NOT NULL DEFAULT '{}'::jsonb, -- rolled-up material/colour/hardware picks
  first_render_at timestamptz,
  last_render_at timestamptz,
  merchant_notified_at timestamptz,
  merchant_first_viewed_at timestamptz,
  merchant_replied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_ai_visualiser_leads_merchant_idx
  ON app_ai_visualiser_leads (merchant_id, status, created_at DESC);

-- ---------------------------------------------------------------------
-- 7. Routed leads — homeowner uploaded an off-scope photo on merchant
--    A's page (e.g. a staircase on a door merchant's Visualiser). We
--    capture their intent and offer to route to appropriate merchants.
--    This is the marketplace-fee lane.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_ai_visualiser_routed_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  originating_merchant_id uuid NOT NULL,     -- whose page they landed on
  homeowner_id uuid REFERENCES app_ai_visualiser_homeowners(id) ON DELETE SET NULL,
  detected_leaf_slug text NOT NULL REFERENCES ai_visualiser_taxonomy_leaves(slug),
  source_photo_url text NOT NULL,
  status text NOT NULL DEFAULT 'detected'
    CHECK (status IN ('detected', 'offered', 'accepted', 'routed', 'expired', 'declined')),
  offered_merchant_ids uuid[] NOT NULL DEFAULT '{}',
  accepted_by_merchant_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_ai_visualiser_routed_leads_originating_idx
  ON app_ai_visualiser_routed_leads (originating_merchant_id, created_at DESC);

-- ---------------------------------------------------------------------
-- 8. Provider config — admin-managed, write-only credentials.
--    Row per (provider_id). Admin dashboard sets api_key later; the
--    render route reads the enabled row at request time. Only ONE row
--    should be enabled at a time — enforced by a partial unique index.
--    Credentials JSONB is masked when read via the admin UI (never
--    returned to the client in the clear).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_visualiser_provider_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id text NOT NULL UNIQUE,           -- 'openai-images' | 'flux-1.1-pro' | 'nano-banana' | ...
  display_name text NOT NULL,                 -- 'ChatGPT / OpenAI Images (gpt-image-1)'
  model_id text,                              -- 'gpt-image-1' | 'flux-1.1-pro' | ...
  enabled boolean NOT NULL DEFAULT false,
  credentials jsonb NOT NULL DEFAULT '{}'::jsonb, -- {api_key: "..."} — write-only through app layer
  cost_per_render_pence integer NOT NULL DEFAULT 0, -- for margin telemetry
  last_tested_at timestamptz,
  last_test_ok boolean,
  last_test_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- only one enabled provider at a time
CREATE UNIQUE INDEX IF NOT EXISTS ai_visualiser_provider_config_one_enabled
  ON ai_visualiser_provider_config ((true))
  WHERE enabled;

-- ---------------------------------------------------------------------
-- 9. Admin lead log — mirror of every homeowner registration, visible
--    to platform admin regardless of which merchant they landed on.
--    Keeps a single view for platform ops / audit / analytics without
--    breaking the per-merchant RLS on the leads table.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_visualiser_admin_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  homeowner_id uuid NOT NULL REFERENCES app_ai_visualiser_homeowners(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  whatsapp_e164 text NOT NULL,
  home_phone text,
  postcode text NOT NULL,
  first_leaf_slug text,
  render_count integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'merchant-page'
    CHECK (source IN ('merchant-page', 'gold-path', 'marketplace')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_visualiser_admin_leads_created_idx
  ON ai_visualiser_admin_leads (created_at DESC);
CREATE INDEX IF NOT EXISTS ai_visualiser_admin_leads_merchant_idx
  ON ai_visualiser_admin_leads (merchant_id, created_at DESC);

-- ---------------------------------------------------------------------
-- Triggers — touch updated_at
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ai_visualiser_touch_updated_at() RETURNS trigger AS $$
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
      'ai_visualiser_taxonomy_leaves',
      'app_ai_visualiser_credits',
      'app_ai_visualiser_homeowners',
      'app_ai_visualiser_leads',
      'app_ai_visualiser_routed_leads',
      'ai_visualiser_provider_config',
      'ai_visualiser_admin_leads'
    ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_touch ON %I;', t, t);
    EXECUTE format(
      'CREATE TRIGGER %I_touch BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION ai_visualiser_touch_updated_at();',
      t, t
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
ALTER TABLE ai_visualiser_taxonomy_leaves       ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_ai_visualiser_catalogue_scope   ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_ai_visualiser_credits           ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_ai_visualiser_homeowners        ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_ai_visualiser_renders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_ai_visualiser_leads             ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_ai_visualiser_routed_leads      ENABLE ROW LEVEL SECURITY;

-- taxonomy is publicly readable (it powers the storefront UI)
DROP POLICY IF EXISTS ai_visualiser_taxonomy_read_all ON ai_visualiser_taxonomy_leaves;
CREATE POLICY ai_visualiser_taxonomy_read_all
  ON ai_visualiser_taxonomy_leaves FOR SELECT USING (true);

-- catalogue scope: read all (so storefront can render the design tree),
-- write only by the owning merchant
DROP POLICY IF EXISTS app_ai_visualiser_scope_read_all ON app_ai_visualiser_catalogue_scope;
CREATE POLICY app_ai_visualiser_scope_read_all
  ON app_ai_visualiser_catalogue_scope FOR SELECT USING (true);

DROP POLICY IF EXISTS app_ai_visualiser_scope_owner_write ON app_ai_visualiser_catalogue_scope;
CREATE POLICY app_ai_visualiser_scope_owner_write
  ON app_ai_visualiser_catalogue_scope
  FOR ALL
  USING (merchant_id = auth.uid())
  WITH CHECK (merchant_id = auth.uid());

-- credits: private to owning merchant
DROP POLICY IF EXISTS app_ai_visualiser_credits_owner ON app_ai_visualiser_credits;
CREATE POLICY app_ai_visualiser_credits_owner
  ON app_ai_visualiser_credits
  FOR ALL
  USING (merchant_id = auth.uid())
  WITH CHECK (merchant_id = auth.uid());

-- homeowners / renders / leads: merchant-scoped
DROP POLICY IF EXISTS app_ai_visualiser_homeowners_merchant ON app_ai_visualiser_homeowners;
CREATE POLICY app_ai_visualiser_homeowners_merchant
  ON app_ai_visualiser_homeowners
  FOR ALL
  USING (merchant_id = auth.uid())
  WITH CHECK (merchant_id = auth.uid());

DROP POLICY IF EXISTS app_ai_visualiser_renders_merchant ON app_ai_visualiser_renders;
CREATE POLICY app_ai_visualiser_renders_merchant
  ON app_ai_visualiser_renders
  FOR ALL
  USING (merchant_id = auth.uid())
  WITH CHECK (merchant_id = auth.uid());

DROP POLICY IF EXISTS app_ai_visualiser_leads_merchant ON app_ai_visualiser_leads;
CREATE POLICY app_ai_visualiser_leads_merchant
  ON app_ai_visualiser_leads
  FOR ALL
  USING (merchant_id = auth.uid())
  WITH CHECK (merchant_id = auth.uid());

DROP POLICY IF EXISTS app_ai_visualiser_routed_leads_owner ON app_ai_visualiser_routed_leads;
CREATE POLICY app_ai_visualiser_routed_leads_owner
  ON app_ai_visualiser_routed_leads
  FOR ALL
  USING (originating_merchant_id = auth.uid())
  WITH CHECK (originating_merchant_id = auth.uid());

-- Provider config + admin leads log: no client-side access. All reads
-- and writes go through the server with the service key (admin-only
-- routes). Enabling RLS with no policies denies all client access by
-- default — which is exactly what we want.
ALTER TABLE ai_visualiser_provider_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_visualiser_admin_leads     ENABLE ROW LEVEL SECURITY;

-- Homeowner-side writes (registration, render insert) run through the
-- server with the service key, so no anonymous-write policy needed.

COMMIT;
