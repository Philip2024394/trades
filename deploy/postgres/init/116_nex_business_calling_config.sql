-- 116_nex_business_calling_config.sql
--
-- NEX Calling · Business Calling Gate · Philip 2026-08-27.
--
-- Per-business voice/video enable flags + hours + consent. Enables the future
-- Phase 2 marketplace-to-customer calling flow (a buyer inside NEX Marketplace
-- clicks "call this seller" and the gate decides voice/video is allowed for
-- that business right now).
--
-- Preserves the "Discovery ≠ Outreach" doctrine (project_nex_walker_production_launch_directive_2026_08_26):
-- discovery walkers never populate this table. Businesses opt in via claim +
-- self-serve settings. Anonymous / discovered rows carry NO calling flags.
--
-- Idempotent: uses CREATE TABLE IF NOT EXISTS + guarded ALTERs.

CREATE TABLE IF NOT EXISTS nex.business_calling_config (
  config_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Which business this config governs. Uses public_listing_ref so the same
  -- table can gate food_business, accommodation_business, service_business,
  -- and mp_seller.slug — the identity-resolver + funnel already share ref
  -- semantics per the dedup doctrine.
  business_table TEXT NOT NULL CHECK (business_table IN (
    'nex.food_business', 'nex.accommodation_business',
    'nex.service_business', 'nex.mp_seller'
  )),
  business_ref TEXT NOT NULL,   -- public_listing_ref or slug

  -- Enablement flags (both default false · opt-in only)
  voice_enabled BOOLEAN NOT NULL DEFAULT false,
  video_enabled BOOLEAN NOT NULL DEFAULT false,

  -- Hours the business accepts calls. NULL = 24/7.
  -- Format: '{"mon": {"open":"09:00","close":"17:00"}, "tue": {...}, ...}'
  -- Timezone always assumed 'Asia/Jakarta' (Indonesia · WIB) — future column
  -- can override per business.
  hours JSONB,
  timezone TEXT DEFAULT 'Asia/Jakarta',

  -- Consent: business owner explicitly opted in on this date.
  consent_at TIMESTAMPTZ,
  consent_by TEXT,   -- who granted (user_id / trade_id / admin)

  -- Blocked callers (list of caller identities the business does not want to
  -- take calls from). Complements the platform-level block list.
  blocked_callers TEXT[] DEFAULT '{}',

  -- Optional: fixed message when calls are declined (voicemail-like).
  auto_reply_text TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (business_table, business_ref)
);

CREATE INDEX IF NOT EXISTS ix_bcc_ref
  ON nex.business_calling_config (business_ref);

CREATE INDEX IF NOT EXISTS ix_bcc_enabled
  ON nex.business_calling_config (business_table, voice_enabled, video_enabled)
  WHERE voice_enabled OR video_enabled;

COMMENT ON TABLE nex.business_calling_config IS
  'Per-business calling enablement · voice/video flags · hours · consent · blocked callers. '
  'Discovery walkers NEVER populate this. Businesses opt in via claim + self-serve settings. '
  'Read by the calling gate service before allowing a marketplace-to-business call.';
